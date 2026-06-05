import { useEffect, useState } from "react";
import { doc, getDoc, collection, query, where, getDocs, limit } from "firebase/firestore";
import { db } from "@/integrations/firebase/client";
import {
  X, Star, Phone, Mail, Award,
  Package, Car, Camera, User,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { DriverDoc, VehicleDoc, UserDoc } from "@/services/firebase";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DriverReview {
  id: string;
  rating: number;
  feedback?: string;
  customerName?: string;
  createdAt?: unknown;
}

interface FullDriverProfile {
  driverId: string;
  user: UserDoc | null;
  driver: DriverDoc | null;
  vehicle: VehicleDoc | null;
  vehicleImages: string[];         // ordered: Front, Back, Left side, Right side
  vehiclePhotoUrls?: Record<string, string>; // raw map for side labels
  selfieUrl?: string | null;
  reviews: DriverReview[];
}

interface DriverProfileModalProps {
  driverId: string;
  onClose: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Extract all Cloudinary URLs from whatever shape the vehicle photos were saved in.
 *
 * DriverRegistration.tsx saves:
 *   vehicles/{uid}.photoUrls      = { Front: "https://…", Back: "https://…", "Left side": "…", "Right side": "…" }
 *   drivers/{uid}.vehiclePhotoUrls = same object (duplicate for easy access)
 *
 * This function handles that object shape, plus legacy array/string fields.
 */
function extractVehicleImages(vData: any, dData: any): string[] {
  const raw: string[] = [];

  const fromObj = (obj: unknown) => {
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return;
    // Preserve display order: Front → Back → Left side → Right side
    const ORDER = ["Front", "Back", "Left side", "Right side"];
    const entries = Object.entries(obj as Record<string, unknown>);
    const sorted = [
      ...ORDER.map(k => entries.find(([key]) => key === k)).filter(Boolean) as [string, unknown][],
      ...entries.filter(([k]) => !ORDER.includes(k)),
    ];
    sorted.forEach(([, v]) => {
      if (typeof v === "string" && v.startsWith("http")) raw.push(v);
    });
  };

  // Primary: photoUrls on vehicles doc (written by DriverRegistration)
  fromObj(vData?.photoUrls);

  // Backup: vehiclePhotoUrls on drivers doc (also written by DriverRegistration)
  fromObj(dData?.vehiclePhotoUrls);

  // Legacy array fields
  for (const src of [vData, dData]) {
    if (!src) continue;
    for (const field of ["images", "vehicleImages", "photos", "imageUrls", "photoURLs"]) {
      if (Array.isArray(src[field])) raw.push(...src[field]);
    }
    // Legacy single-string field
    for (const field of ["photoURL", "vehiclePhotoURL", "imageUrl", "photo"]) {
      if (typeof src[field] === "string" && src[field].startsWith("http")) raw.push(src[field]);
    }
  }

  // Dedupe while preserving order
  return raw
    .filter((url): url is string => typeof url === "string" && url.startsWith("http"))
    .filter((v, i, a) => a.indexOf(v) === i);
}

async function loadFullDriverProfile(driverId: string): Promise<FullDriverProfile> {
  const [driverSnap, userSnap, vehicleSnap] = await Promise.all([
    getDoc(doc(db, "drivers",  driverId)),
    getDoc(doc(db, "users",    driverId)),
    getDoc(doc(db, "vehicles", driverId)),
  ]);

  const driver  = driverSnap.exists()  ? (driverSnap.data()  as DriverDoc)  : null;
  const user    = userSnap.exists()    ? (userSnap.data()    as UserDoc)    : null;
  const vehicle = vehicleSnap.exists() ? (vehicleSnap.data() as VehicleDoc) : null;

  const vData = vehicleSnap.exists() ? vehicleSnap.data() as any : {};
  const dData = driverSnap.exists()  ? driverSnap.data()  as any : {};

  // Vehicle images — from photoUrls object (DriverRegistration saves it this way)
  const vehicleImages = extractVehicleImages(vData, dData);

  // Profile photo — selfieUrl is on drivers doc (saved by DriverRegistration)
  const selfieUrl = dData?.selfieUrl ?? (user as any)?.photoURL ?? null;

  // Reviews: find completed delivery_requests rated for this driver
  // Strategy 1: query delivery_requests directly by driverId + completed status
  // Strategy 2: fallback via assignments (no orderBy to avoid composite index)
  let reviews: DriverReview[] = [];
  try {
    // Primary: delivery_requests where driverId matches and a rating exists
    const reqQ = query(
      collection(db, "delivery_requests"),
      where("driverId", "==", driverId),
      where("status", "==", "completed"),
      limit(30),
    );
    const reqSnap = await getDocs(reqQ);

    const enriched = await Promise.all(
      reqSnap.docs.map(async (r): Promise<DriverReview | null> => {
        const rd = r.data() as any;
        if (!rd.rating?.rating) return null;
        let customerName = "Customer";
        try {
          const cSnap = await getDoc(doc(db, "users", rd.customerId));
          if (cSnap.exists()) {
            const cd = cSnap.data() as UserDoc;
            customerName = [cd.firstName, cd.lastName].filter(Boolean).join(" ") || "Customer";
          }
        } catch { /* non-blocking */ }
        return {
          id: r.id,
          rating: rd.rating.rating as number,
          feedback: rd.rating.feedback as string | undefined,
          customerName,
          createdAt: rd.updatedAt ?? rd.createdAt,
        };
      }),
    );

    reviews = (enriched.filter(Boolean) as DriverReview[])
      .sort((a, b) => {
        const ta = (a.createdAt as any)?.seconds ?? 0;
        const tb = (b.createdAt as any)?.seconds ?? 0;
        return tb - ta;
      });

    // Fallback: if no results (driverId not stored on requests), try via assignments
    if (reviews.length === 0) {
      const assignQ = query(
        collection(db, "assignments"),
        where("driverId", "==", driverId),
        limit(30),
      );
      const assignSnap = await getDocs(assignQ);
      const fallback = await Promise.all(
        assignSnap.docs.map(async (a): Promise<DriverReview | null> => {
          const aData = a.data() as any;
          if (!aData.completedAt) return null;
          const reqDocSnap = await getDoc(doc(db, "delivery_requests", aData.requestId));
          if (!reqDocSnap.exists()) return null;
          const rd = reqDocSnap.data() as any;
          if (!rd.rating?.rating) return null;
          let customerName = "Customer";
          try {
            const cSnap = await getDoc(doc(db, "users", rd.customerId));
            if (cSnap.exists()) {
              const cd = cSnap.data() as UserDoc;
              customerName = [cd.firstName, cd.lastName].filter(Boolean).join(" ") || "Customer";
            }
          } catch { /* non-blocking */ }
          return {
            id: a.id,
            rating: rd.rating.rating as number,
            feedback: rd.rating.feedback as string | undefined,
            customerName,
            createdAt: aData.completedAt,
          };
        }),
      );
      reviews = (fallback.filter(Boolean) as DriverReview[])
        .sort((a, b) => ((b.createdAt as any)?.seconds ?? 0) - ((a.createdAt as any)?.seconds ?? 0));
    }
  } catch (e) {
    console.error("Reviews fetch error:", e);
  }

  return { driverId, user, driver, vehicle, vehicleImages, vehiclePhotoUrls: vData?.photoUrls ?? dData?.vehiclePhotoUrls ?? undefined, selfieUrl, reviews };
}

// ── Star display ──────────────────────────────────────────────────────────────

function Stars({ rating, size = "sm" }: { rating: number; size?: "sm" | "md" | "lg" }) {
  const sz = { sm: "w-3.5 h-3.5", md: "w-4 h-4", lg: "w-5 h-5" }[size];
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <Star key={s} className={`${sz} ${s <= Math.round(rating) ? "fill-amber-400 text-amber-400" : "text-gray-200"}`} />
      ))}
    </div>
  );
}

// ── Rating bar ────────────────────────────────────────────────────────────────

function RatingBar({ star, count, total }: { star: number; count: number; total: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-semibold text-gray-500 w-2 text-right">{star}</span>
      <Star className="w-3 h-3 fill-amber-400 text-amber-400 flex-shrink-0" />
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full bg-amber-400 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-400 w-4 text-right">{count}</span>
    </div>
  );
}

// ── Vehicle image gallery ─────────────────────────────────────────────────────

const SIDE_LABELS: Record<string, string> = {
  "Front": "Front",
  "Back": "Back",
  "Left side": "Left",
  "Right side": "Right",
};

function VehicleGallery({ images, photoUrls }: { images: string[]; photoUrls?: Record<string, string> }) {
  const [active, setActive] = useState(0);

  if (images.length === 0) {
    return (
      <div className="h-40 bg-gray-50 rounded-2xl border border-dashed border-gray-200 flex flex-col items-center justify-center gap-2">
        <Camera className="h-8 w-8 text-gray-300" />
        <p className="text-xs text-gray-400">No vehicle photos yet</p>
      </div>
    );
  }

  // Build label map: index → side label
  const ORDER = ["Front", "Back", "Left side", "Right side"];
  const labelFor = (idx: number) => {
    if (photoUrls) {
      const entry = ORDER.find(k => photoUrls[k] === images[idx]);
      if (entry) return SIDE_LABELS[entry] ?? entry;
    }
    return `Photo ${idx + 1}`;
  };

  return (
    <div className="space-y-2">
      {/* Main image */}
      <div className="relative h-52 bg-gray-100 rounded-2xl overflow-hidden">
        <img
          src={images[active]}
          alt={labelFor(active)}
          className="w-full h-full object-cover transition-all duration-300"
        />
        {/* Side label badge */}
        <div className="absolute top-2.5 left-2.5 bg-black/50 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded-lg uppercase tracking-wider">
          {labelFor(active)}
        </div>
        {/* Dot nav */}
        {images.length > 1 && (
          <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex gap-1.5">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => setActive(i)}
                className={`rounded-full transition-all ${i === active ? "bg-white w-4 h-1.5" : "bg-white/60 w-1.5 h-1.5"}`}
              />
            ))}
          </div>
        )}
        {/* Prev/next arrows */}
        {images.length > 1 && (
          <>
            <button
              onClick={() => setActive(i => (i - 1 + images.length) % images.length)}
              className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 bg-black/40 hover:bg-black/60 rounded-full flex items-center justify-center text-white transition-colors"
            >‹</button>
            <button
              onClick={() => setActive(i => (i + 1) % images.length)}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 bg-black/40 hover:bg-black/60 rounded-full flex items-center justify-center text-white transition-colors"
            >›</button>
          </>
        )}
      </div>

      {/* Thumbnail strip with side labels */}
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={`flex-shrink-0 flex flex-col gap-1 items-center transition-all`}
            >
              <div className={`w-16 h-14 rounded-xl overflow-hidden border-2 transition-all ${i === active ? "border-primary" : "border-transparent"}`}>
                <img src={img} alt={labelFor(i)} className="w-full h-full object-cover" />
              </div>
              <span className={`text-[9px] font-bold uppercase tracking-wide ${i === active ? "text-primary" : "text-gray-400"}`}>
                {labelFor(i)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function DriverProfileModal({ driverId, onClose }: DriverProfileModalProps) {
  const [profile, setProfile] = useState<FullDriverProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFullDriverProfile(driverId)
      .then(setProfile)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [driverId]);

  const avgRating = profile?.reviews.length
    ? profile.reviews.reduce((s, r) => s + r.rating, 0) / profile.reviews.length
    : profile?.driver?.averageRating ?? 0;

  const totalDeliveries = profile?.driver?.totalDeliveries ?? profile?.reviews.length ?? 0;

  const driverName = profile?.user
    ? [profile.user.firstName, profile.user.lastName].filter(Boolean).join(" ")
    : "Driver";

  const vehicleLine = profile?.vehicle
    ? [profile.vehicle.color, profile.vehicle.brand, profile.vehicle.model]
        .filter(Boolean).join(" ") || profile.vehicle.vehicleType?.replace(/_/g, " ")
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[92dvh] flex flex-col animate-in slide-in-from-bottom-4 duration-300">

        {/* Drag handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 flex-shrink-0">
          <h2 className="font-bold text-base text-gray-900">Driver Profile</h2>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <p className="text-sm text-muted-foreground">Loading profile…</p>
            </div>
          ) : !profile ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <User className="h-10 w-10 text-gray-300" />
              <p className="text-sm text-muted-foreground">Profile not found</p>
            </div>
          ) : (
            <div className="p-5 space-y-5">

              {/* ── Hero ── */}
              <div className="flex items-start gap-4">
                <div className="relative flex-shrink-0">
                  <Avatar className="h-20 w-20 rounded-2xl ring-2 ring-primary/15 ring-offset-2">
                    <AvatarImage src={profile.selfieUrl ?? undefined} className="object-cover" />
                    <AvatarFallback className="rounded-2xl bg-primary/10 text-primary text-2xl font-bold">
                      {(profile.user?.firstName?.[0] ?? "") + (profile.user?.lastName?.[0] ?? "")}
                    </AvatarFallback>
                  </Avatar>
                  {profile.driver?.isOnline && (
                    <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-white" />
                    </span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-lg text-gray-900 leading-tight truncate">{driverName}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5 capitalize">
                    {profile.vehicle?.vehicleType?.replace(/_/g, " ") ?? "Driver"}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Stars rating={avgRating} size="sm" />
                    <span className="text-sm font-bold text-gray-800">{avgRating > 0 ? avgRating.toFixed(1) : "New"}</span>
                    {profile.reviews.length > 0 && (
                      <span className="text-xs text-muted-foreground">({profile.reviews.length})</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      profile.driver?.status === "approved"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-amber-50 text-amber-700 border-amber-200"
                    }`}>
                      {profile.driver?.status === "approved" ? "✓ Verified" : "Pending"}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      profile.driver?.isOnline
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-gray-100 text-gray-500 border-gray-200"
                    }`}>
                      {profile.driver?.isOnline ? "● Online" : "○ Offline"}
                    </span>
                  </div>
                </div>
              </div>

              {/* ── Stats ── */}
              <div className="grid grid-cols-3 gap-2.5">
                {[
                  { icon: Package, label: "Deliveries", value: totalDeliveries,                             color: "bg-primary/10 text-primary" },
                  { icon: Star,    label: "Rating",     value: avgRating > 0 ? avgRating.toFixed(1) : "New", color: "bg-amber-50 text-amber-600" },
                  { icon: Award,   label: "Reviews",    value: profile.reviews.length,                      color: "bg-violet-50 text-violet-600" },
                ].map(s => (
                  <div key={s.label} className="bg-gray-50 rounded-2xl p-3 text-center border border-gray-100">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center mx-auto mb-1.5 ${s.color}`}>
                      <s.icon className="w-4 h-4" />
                    </div>
                    <p className="text-lg font-bold text-gray-900 leading-none">{s.value}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* ── Contact ── */}
              {(profile.user?.phone || profile.user?.email) && (
                <div className="bg-muted/40 rounded-2xl p-4 space-y-2.5">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Contact</p>
                  {profile.user?.phone && (
                    <a href={`tel:${profile.user.phone}`} className="flex items-center gap-3 group">
                      <div className="h-8 w-8 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-100 transition-colors">
                        <Phone className="h-3.5 w-3.5 text-emerald-600" />
                      </div>
                      <span className="text-sm font-semibold text-gray-800 group-hover:text-primary transition-colors">{profile.user.phone}</span>
                    </a>
                  )}
                  {profile.user?.email && (
                    <a href={`mailto:${profile.user.email}`} className="flex items-center gap-3 group">
                      <div className="h-8 w-8 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-100 transition-colors">
                        <Mail className="h-3.5 w-3.5 text-blue-600" />
                      </div>
                      <span className="text-sm font-semibold text-gray-800 group-hover:text-primary transition-colors truncate">{profile.user.email}</span>
                    </a>
                  )}
                </div>
              )}

              {/* ── Vehicle info ── */}
              {profile.vehicle && (
                <div className="space-y-3">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Vehicle</p>
                  <div className="bg-muted/40 rounded-2xl p-4 border border-border/50">
                    <div className="flex items-center gap-3 mb-3.5">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Car className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-gray-900 truncate capitalize">{vehicleLine || "Vehicle"}</p>
                        <p className="text-xs font-mono text-muted-foreground mt-0.5">{profile.vehicle.plateNumber}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {[
                        { label: "Type",   value: profile.vehicle.vehicleType?.replace(/_/g, " ") },
                        { label: "Color",  value: profile.vehicle.color },
                        { label: "Brand",  value: profile.vehicle.brand },
                        { label: "Model",  value: profile.vehicle.model },
                      ].filter(r => r.value).map(r => (
                        <div key={r.label} className="bg-white rounded-xl px-3 py-2 border border-gray-100">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{r.label}</p>
                          <p className="font-semibold text-gray-800 capitalize mt-0.5 truncate">{r.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Vehicle photo gallery — reads photoUrls from DriverRegistration */}
                  <VehicleGallery
                    images={profile.vehicleImages}
                    photoUrls={profile.vehiclePhotoUrls}
                  />
                </div>
              )}

              {/* ── Reviews ── */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Customer Reviews</p>
                  {profile.reviews.length > 0 && (
                    <span className="text-xs text-muted-foreground">{profile.reviews.length} total</span>
                  )}
                </div>

                {profile.reviews.length > 0 ? (
                  <>
                    {/* Rating breakdown */}
                    <div className="bg-muted/40 rounded-2xl p-4 border border-border/50">
                      <div className="flex items-center gap-4 mb-3">
                        <div className="text-center">
                          <p className="text-4xl font-bold text-gray-900 leading-none">{avgRating.toFixed(1)}</p>
                          <Stars rating={avgRating} size="sm" />
                          <p className="text-[10px] text-muted-foreground mt-1">{profile.reviews.length} reviews</p>
                        </div>
                        <div className="flex-1 space-y-1">
                          {[5, 4, 3, 2, 1].map(star => (
                            <RatingBar
                              key={star}
                              star={star}
                              count={profile.reviews.filter(r => r.rating === star).length}
                              total={profile.reviews.length}
                            />
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Individual reviews */}
                    <div className="space-y-2.5">
                      {profile.reviews.slice(0, 5).map(review => (
                        <div key={review.id} className="bg-white border border-gray-100 rounded-2xl p-3.5">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2.5">
                              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                <span className="text-xs font-bold text-primary">
                                  {review.customerName?.[0] ?? "C"}
                                </span>
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-gray-800">{review.customerName ?? "Customer"}</p>
                                <Stars rating={review.rating} size="sm" />
                              </div>
                            </div>
                          </div>
                          {review.feedback
                            ? <p className="text-sm text-gray-600 leading-relaxed">{review.feedback}</p>
                            : <p className="text-xs text-muted-foreground italic">No written feedback</p>
                          }
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="bg-muted/30 rounded-2xl p-8 text-center border border-dashed border-border">
                    <Star className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No reviews yet</p>
                    <p className="text-xs text-muted-foreground/70 mt-0.5">Be the first to rate this driver</p>
                  </div>
                )}
              </div>

              <div className="h-4" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
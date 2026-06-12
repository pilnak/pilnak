import { useState, useMemo, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CameraCapture } from "@/components/camera/CameraCapture";
import { useGeolocation } from "@/hooks/useGeolocation";
import {
  useLocationSearch,
  formatLocationName,
  bootstrapGoogleMaps,
} from "@/hooks/useLocationSearch";
import type { LocationSuggestion } from "@/hooks/useLocationSearch";
import {
  createDeliveryRequest,
  createAssignment,
  updateDeliveryStatus,
  setDriverAccepted,
  listOnlineApprovedDrivers,
  haversineKm,
  createBroadcast,
  expireBroadcast,
  fulfillBroadcast,
  respondToBroadcast,
  dismissBroadcastResponse,
  selectBroadcastDriver,
  resetBroadcastDriverSelection,
  listenBroadcastResponses,
  notifyBroadcastDriversCancelled,
  type DriverDoc,
  type BroadcastResponseDoc,
} from "@/services/firebase";
import { DeliveryNegotiationSection } from "./DeliveryNegotiationSection";
import { collection, doc, getDocs, getDoc, onSnapshot, query, serverTimestamp, updateDoc, Timestamp, where } from "firebase/firestore";
import { db } from "@/integrations/firebase/client";
import { estimatePriceNgN } from "@/lib/pricing";
import type { FreightVehicleType } from "@/lib/pricing";
import { generateDeliveryName } from "@/lib/deliveryName";
import { toast } from "sonner";
import {
  Package,
  Truck,
  Car,
  Snowflake,
  Zap,
  ChevronRight,
  ChevronLeft,
  LocateFixed,
  X,
  Clock,
  Weight,
  FileText,
  User,
  Building2,
  CheckCircle2,
  MapPin,
  Loader2,
  Star,
  RefreshCw,
  Sparkles,
  Camera,
  AlertCircle,
} from "lucide-react";

// ── Cloudinary ────────────────────────────────────────────────────────────────

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

async function uploadPackagePhoto(dataUrl: string): Promise<string> {
  const fd = new FormData();
  fd.append("file", dataUrl);
  fd.append("upload_preset", UPLOAD_PRESET);
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    { method: "POST", body: fd },
  );
  if (!res.ok) throw new Error("Photo upload failed");
  return ((await res.json()) as { secure_url: string }).secure_url;
}

// ── GPS / reverse-geocoding helpers ──────────────────────────────────────────

type GPSErrorCode = "denied" | "unavailable" | "timeout" | "unsupported";
type LocFieldState = "idle" | "loading" | "success" | "error";

type GPSResult =
  | { ok: true; lat: number; lng: number; accuracy: number }
  | { ok: false; code: GPSErrorCode };

const GPS_ERRORS: Record<GPSErrorCode, { title: string; hint: string }> = {
  denied: {
    title: "Location permission denied",
    hint: "Tap the lock icon in your browser's address bar, allow location, then try again.",
  },
  unavailable: {
    title: "Location services are off",
    hint: "Enable GPS on your device and try again, or type your address manually.",
  },
  timeout: {
    title: "Location took too long",
    hint: "Move to an area with better GPS signal and try again.",
  },
  unsupported: {
    title: "Geolocation not supported",
    hint: "Your browser doesn't support location access. Please type your address.",
  },
};

function fetchCurrentPosition(): Promise<GPSResult> {
  if (!navigator.geolocation) return Promise.resolve({ ok: false, code: "unsupported" });

  // Phase 1: fast network/cached fix (low accuracy, stale ok)
  const fast = new Promise<GPSResult>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) =>
        resolve({ ok: true, lat: coords.latitude, lng: coords.longitude, accuracy: coords.accuracy }),
      (err) => {
        const code: GPSErrorCode = err.code === 1 ? "denied" : err.code === 2 ? "unavailable" : "timeout";
        resolve({ ok: false, code });
      },
      { enableHighAccuracy: false, timeout: 4000, maximumAge: 30000 },
    );
  });

  // Phase 2: precise GPS fix (only used if phase 1 result is poor)
  const precise = new Promise<GPSResult>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) =>
        resolve({ ok: true, lat: coords.latitude, lng: coords.longitude, accuracy: coords.accuracy }),
      (err) => {
        const code: GPSErrorCode = err.code === 1 ? "denied" : err.code === 2 ? "unavailable" : "timeout";
        resolve({ ok: false, code });
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  });

  return fast.then((result) => {
    // If phase 1 gave a usable fix (accuracy ≤ 1000 m), use it immediately
    if (result.ok && result.accuracy <= 1000) return result;
    // Otherwise wait for the precise fix
    return precise;
  });
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  await bootstrapGoogleMaps();
  const geocoder = new (window as any).google.maps.Geocoder();
  const result = await geocoder.geocode({ location: { lat, lng } });
  const address: string | undefined = result?.results?.[0]?.formatted_address;
  if (!address) throw new Error("No address found");
  // Trim trailing country name to keep address concise
  return address.replace(/,\s*[A-Z][a-zA-Z ]+$/, "").trim();
}

// ── Props / types ─────────────────────────────────────────────────────────────

interface DeliveryRequestFormProps {
  customerId: string;
  onSuccess?: (requestId: string) => void;
  onCancel?: () => void;
  preselectedDriver?: {
    id: string;
    firstName?: string;
    lastName?: string;
    photoURL?: string;
    vehicleType?: string;
    plateNumber?: string;
    carModel?: string;
    averageRating?: number;
    phone?: string;
  } | null;
  initialPickup?: { address: string; lat: number; lon: number } | null;
  initialDropoff?: { address: string; lat: number; lon: number } | null;
  fullPage?: boolean;
}

type VehicleType = FreightVehicleType;
type ItemSize = "small" | "medium" | "large" | "extra_large";
type DriverType = "self_driver" | "company_driver";

// ── Form state persistence ────────────────────────────────────────────────────

const FORM_STORAGE_KEY = "pilnak_delivery_form_state";

interface PersistedFormState {
  step: number;
  formData: {
    pickupAddress: string;
    dropoffAddress: string;
    itemDescription: string;
    itemWeight: string;
    itemSize: ItemSize;
    vehicleType: VehicleType;
    driverType: DriverType;
    isScheduled: boolean;
    scheduledTime: string;
    pickupLatitude: number | null;
    pickupLongitude: number | null;
    dropoffLatitude: number | null;
    dropoffLongitude: number | null;
  };
  broadcastId: string | null;
  waitingRequestId: string | null;
  waitingAssignmentId: string | null;
  selectedDriverId: string | null;
  packagePhotoUrl: string | null;
  reusableRequestId: string | null;
  counterOfferPrice: number | null;
  acceptedBroadcastOffer: { driverId: string; price: number } | null;
}

function clearPersistedForm() {
  try { sessionStorage.removeItem(FORM_STORAGE_KEY); } catch {}
}

interface NearbyDriver {
  id: string;
  firstName?: string;
  lastName?: string;
  photoURL?: string;
  selfieUrl?: string | null;
  vehicleType?: string;
  plateNumber?: string;
  averageRating?: number;
  distanceKm: number;
  etaMinutes: number;
  currentLocation?: { lat: number; lng: number };
  broadcastResponse?: BroadcastResponseDoc | null;
}

const vehicleOptions: {
  type: VehicleType;
  label: string;
  icon: React.ElementType;
  description: string;
  tag: string;
}[] = [
  {
    type: "cargo_van",
    label: "Cargo Van",
    icon: Truck,
    description: "Versatile enclosed van",
    tag: "Most popular",
  },
  {
    type: "box_truck",
    label: "Box Truck",
    icon: Package,
    description: "Medium-volume freight",
    tag: "Versatile",
  },
  {
    type: "dry_van",
    label: "Dry Van",
    icon: Truck,
    description: "Standard enclosed trailer",
    tag: "Standard",
  },
  {
    type: "flatbed",
    label: "Flatbed",
    icon: Truck,
    description: "Open deck, oversized loads",
    tag: "Open cargo",
  },
  {
    type: "reefer",
    label: "Reefer",
    icon: Snowflake,
    description: "Temperature-controlled",
    tag: "Cold chain",
  },
  {
    type: "power_only",
    label: "Power Only",
    icon: Zap,
    description: "Tractor unit, no trailer",
    tag: "Trailer only",
  },
  {
    type: "auto_transport",
    label: "Auto Transport",
    icon: Car,
    description: "Vehicle hauling",
    tag: "Vehicles",
  },
];

const VALID_VEHICLE_TYPES = new Set(vehicleOptions.map((o) => o.type));

const sizeOptions: { value: ItemSize; label: string; sub: string }[] = [
  { value: "small", label: "Small", sub: "< 5 kg" },
  { value: "medium", label: "Medium", sub: "5–20 kg" },
  { value: "large", label: "Large", sub: "20–50 kg" },
  { value: "extra_large", label: "Extra Large", sub: "> 50 kg" },
];


const STEPS_SELF = [
  "Locations",
  "Item Details",
  "Vehicle & Schedule",
  "Choose Driver",
];
const STEPS_COMPANY = ["Locations", "Item Details", "Vehicle & Schedule"];

// ── Location Input ────────────────────────────────────────────────────────────

interface LocationInputProps {
  value: string;
  placeholder: string;
  dotColor: "primary" | "destructive";
  onSelect: (suggestion: LocationSuggestion) => void;
  onChange: (value: string) => void;
}

function LocationInput({
  value,
  placeholder,
  dotColor,
  onSelect,
  onChange,
}: LocationInputProps) {
  const { suggestions, isLoading, search, clearSuggestions } =
    useLocationSearch();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleChange = (val: string) => {
    onChange(val);
    search(val);
    setOpen(true);
  };

  const handleSelect = (s: LocationSuggestion) => {
    onSelect(s);
    clearSuggestions();
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative flex-1">
      <div
        className={`absolute left-3 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full z-10 ${dotColor === "primary" ? "bg-primary" : "bg-destructive"}`}
      />
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        className="pl-8 pr-8 rounded-xl border-border/80 focus-visible:ring-primary/30"
        autoComplete="off"
      />
      {isLoading && (
        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
      )}
      {open && suggestions.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-lg overflow-hidden">
          {suggestions.map((s) => (
            <button
              key={s.place_id}
              type="button"
              onMouseDown={() => handleSelect(s)}
              className="w-full flex items-start gap-2.5 px-3 py-2.5 text-left hover:bg-muted/60 transition-colors border-b border-border/40 last:border-0"
            >
              <MapPin className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">
                  {formatLocationName(s)}
                </p>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {s.display_name}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Driver Card ───────────────────────────────────────────────────────────────

function DriverCard({
  driver,
  selected,
  estimatedPrice,
  onSelect,
  onAcceptCounter,
  onDeclineCounter,
}: {
  driver: NearbyDriver;
  selected: boolean;
  estimatedPrice?: number | null;
  onSelect: () => void;
  onAcceptCounter?: (price: number) => void;
  onDeclineCounter?: () => void;
}) {
  const name =
    [driver.firstName, driver.lastName].filter(Boolean).join(" ") || "Driver";
  const initials = (driver.firstName?.[0] ?? "") + (driver.lastName?.[0] ?? "");
  const resp = driver.broadcastResponse;
  const hasCounter = resp?.responseType === "counter_offer" && resp.counterOfferPrice != null;
  const isInterested = resp?.responseType === "interested";

  return (
    <div
      className={`w-full rounded-xl border text-left transition-all overflow-hidden ${
        selected
          ? "bg-primary/5 border-primary ring-1 ring-primary/30"
          : hasCounter
            ? "border-blue-200 bg-blue-50/40"
            : isInterested
              ? "border-green-200 bg-green-50/30"
              : "border-border bg-muted/20"
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        className="w-full flex items-center gap-3 p-3.5 text-left"
      >
        <Avatar className="h-11 w-11 rounded-xl flex-shrink-0">
          {driver.selfieUrl && (
            <AvatarImage src={driver.selfieUrl} alt={name} className="object-cover" />
          )}
          <AvatarFallback className="rounded-xl bg-primary/10 text-primary text-sm font-bold">
            {initials || <User className="h-4 w-4" />}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className={`font-semibold text-sm truncate ${selected ? "text-primary" : ""}`}>
              {name}
            </p>
            {isInterested && !hasCounter && (
              <span className="inline-flex items-center gap-0.5 text-[9px] font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">
                ✓ Interested
              </span>
            )}
            {hasCounter && (
              <span className="inline-flex items-center gap-0.5 text-[9px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">
                ₦{resp!.counterOfferPrice!.toLocaleString()} offer
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-xs text-muted-foreground capitalize">
              {driver.vehicleType?.replace(/_/g, " ") || "Vehicle"}
            </span>
            {driver.plateNumber && (
              <>
                <span className="text-border">·</span>
                <span className="text-xs font-mono text-muted-foreground">
                  {driver.plateNumber}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1">
            <div className="flex items-center gap-0.5">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              <span className="text-xs font-semibold">
                {driver.averageRating?.toFixed(1) ?? "5.0"}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">
              {driver.distanceKm.toFixed(1)} km away
            </span>
            <span className="text-xs text-muted-foreground">
              ~{driver.etaMinutes} min
            </span>
          </div>
        </div>
        {selected && (
          <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
        )}
      </button>

      {/* Inline counter-offer response controls */}
      {hasCounter && onAcceptCounter && onDeclineCounter && (
        <div className="px-3.5 pb-3 pt-0 space-y-2">
          <div className="flex items-stretch gap-2 bg-white rounded-lg overflow-hidden border border-blue-100 text-xs">
            <div className="flex-1 px-3 py-2">
              <p className="font-bold text-muted-foreground uppercase tracking-wide text-[9px]">Est.</p>
              <p className="font-semibold text-muted-foreground line-through">
                {estimatedPrice != null ? `₦${estimatedPrice.toLocaleString()}` : "—"}
              </p>
            </div>
            <div className="w-px bg-blue-100" />
            <div className="flex-1 px-3 py-2 text-right">
              <p className="font-bold text-blue-600 uppercase tracking-wide text-[9px]">Driver Offer</p>
              <p className="font-bold text-blue-700 text-base">
                ₦{resp!.counterOfferPrice!.toLocaleString()}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDeclineCounter(); }}
              className="flex-1 text-xs font-bold py-2 rounded-lg border border-red-200 text-red-500 bg-white"
            >
              Decline
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onAcceptCounter(resp!.counterOfferPrice!); }}
              className="flex-1 text-xs font-bold py-2 rounded-lg bg-blue-600 text-white"
            >
              Accept ₦{resp!.counterOfferPrice!.toLocaleString()}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Description → delivery name ───────────────────────────────────────────────

function descriptionToName(description: string): string | null {
  if (!description.trim()) return null;

  const stopWords = new Set([
    "and",
    "or",
    "the",
    "a",
    "an",
    "of",
    "for",
    "from",
    "to",
    "at",
    "in",
    "on",
    "by",
    "with",
    "some",
    "few",
    "bag",
    "bags",
    "box",
    "boxes",
    "piece",
    "pieces",
    "pack",
    "packs",
    "kg",
    "gram",
    "grams",
    "liter",
    "liters",
    "bottle",
    "bottles",
    "set",
    "sets",
  ]);

  const cleaned = description
    .toLowerCase()
    .replace(
      /^\d+\s*(bags?|boxes?|pieces?|packs?|kg|g|l|liters?|bottles?)?\s*(of\s*)?/i,
      "",
    )
    .replace(/[^a-z0-9'\s]/gi, " ")
    .trim();

  const words = cleaned
    .split(/\s+/)
    .filter((w) => w.length > 1 && !stopWords.has(w))
    .slice(0, 3);

  if (!words.length) return null;

  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

// ── Auto-name preview pill ────────────────────────────────────────────────────

function AutoNamePreview({
  description,
  pickup,
  dropoff,
}: {
  description: string;
  pickup: string;
  dropoff: string;
}) {
  const descName = descriptionToName(description);

  let previewName: string;
  if (descName) {
    previewName = `${descName} · Delivery #4821`;
  } else if (pickup && dropoff) {
    previewName = generateDeliveryName({
      firestoreId: "preview0001preview0001",
      pickupAddress: pickup,
      dropoffAddress: dropoff,
      includeRoute: true,
    });
  } else {
    return null;
  }

  return (
    <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-xl px-3.5 py-2.5 animate-fade-in">
      <Sparkles className="h-3.5 w-3.5 text-primary flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] font-semibold text-primary/70 uppercase tracking-wide">
          {descName ? "Name from your description" : "Auto-generated name"}
        </p>
        <p className="text-sm font-bold text-primary truncate">{previewName}</p>
      </div>
    </div>
  );
}

// ── Main Form ─────────────────────────────────────────────────────────────────

export function DeliveryRequestForm({
  customerId,
  onSuccess,
  onCancel,
  preselectedDriver,
  initialPickup,
  initialDropoff,
  fullPage = false,
}: DeliveryRequestFormProps) {
  // Load persisted state once at mount — skip if hero pre-fill is present
  const restoredRef = useRef<PersistedFormState | null>(
    (() => {
      if (initialPickup || initialDropoff) return null;
      try {
        const raw = sessionStorage.getItem(FORM_STORAGE_KEY);
        return raw ? (JSON.parse(raw) as PersistedFormState) : null;
      } catch {
        return null;
      }
    })()
  );
  const R = restoredRef.current;

  const [step, setStep] = useState<number>(() => {
    if (!R) return 1;
    const maxStep = preselectedDriver ? 3 : R.formData?.driverType === "self_driver" ? 4 : 3;
    return Math.min(R.step, maxStep);
  });
  const [isLoading, setIsLoading] = useState(false);
  const { latitude, longitude } = useGeolocation({});

  // Per-field GPS state
  const [locState, setLocState] = useState<{ pickup: LocFieldState; dropoff: LocFieldState }>({
    pickup: "idle",
    dropoff: "idle",
  });
  const [locError, setLocError] = useState<{ field: "pickup" | "dropoff"; code: GPSErrorCode } | null>(null);
  const [locAccuracy, setLocAccuracy] = useState<{ field: "pickup" | "dropoff"; meters: number } | null>(null);

  const [formData, setFormData] = useState({
    pickupAddress: initialPickup?.address ?? R?.formData.pickupAddress ?? "",
    dropoffAddress: initialDropoff?.address ?? R?.formData.dropoffAddress ?? "",
    itemDescription: R?.formData.itemDescription ?? "",
    itemWeight: R?.formData.itemWeight ?? "",
    itemSize: (R?.formData.itemSize ?? "small") as ItemSize,
    vehicleType: (R?.formData.vehicleType && VALID_VEHICLE_TYPES.has(R.formData.vehicleType as VehicleType)
      ? R.formData.vehicleType
      : "cargo_van") as VehicleType,
    driverType: (R?.formData.driverType ?? "self_driver") as DriverType,
    isScheduled: R?.formData.isScheduled ?? false,
    scheduledTime: R?.formData.scheduledTime ?? "",
    pickupLatitude: initialPickup?.lat ?? R?.formData.pickupLatitude ?? (null as number | null),
    pickupLongitude: initialPickup?.lon ?? R?.formData.pickupLongitude ?? (null as number | null),
    dropoffLatitude: initialDropoff?.lat ?? R?.formData.dropoffLatitude ?? (null as number | null),
    dropoffLongitude: initialDropoff?.lon ?? R?.formData.dropoffLongitude ?? (null as number | null),
  });

  const [nearbyDrivers, setNearbyDrivers] = useState<NearbyDriver[]>([]);
  const [loadingDrivers, setLoadingDrivers] = useState(false);
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(
    preselectedDriver?.id ?? R?.selectedDriverId ?? null,
  );

  const [showCamera, setShowCamera] = useState(false);
  const [packagePhotoUrl, setPackagePhotoUrl] = useState<string | null>(R?.packagePhotoUrl ?? null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [waitingRequestId, setWaitingRequestId] = useState<string | null>(R?.waitingRequestId ?? null);
  const [negotiationRequestId, setNegotiationRequestId] = useState<string | null>(null);
  const [waitingAssignmentId, setWaitingAssignmentId] = useState<string | null>(R?.waitingAssignmentId ?? null);
  // Holds an existing delivery request ID to reuse when the customer goes back to choose
  // another driver, preventing a duplicate request from being created on re-submit.
  const [reusableRequestId, setReusableRequestId] = useState<string | null>(R?.reusableRequestId ?? null);
  const [driverDeclined, setDriverDeclined] = useState(false);
  const [counterOfferPrice, setCounterOfferPrice] = useState<number | null>(R?.counterOfferPrice ?? null);
  const [counterOfferNegotiating, setCounterOfferNegotiating] = useState(false);

  // Broadcast state
  const [broadcastId, setBroadcastId] = useState<string | null>(R?.broadcastId ?? null);
  const broadcastIdRef = useRef<string | null>(R?.broadcastId ?? null);
  const [broadcastResponses, setBroadcastResponses] = useState<Array<BroadcastResponseDoc & { id: string }>>([]);
  // Price accepted from a broadcast counter-offer on the nearby drivers page
  const [acceptedBroadcastOffer, setAcceptedBroadcastOffer] = useState<{ driverId: string; price: number } | null>(R?.acceptedBroadcastOffer ?? null);

  const STEPS = preselectedDriver
    ? ["Locations", "Item Details", "Vehicle & Schedule"]
    : formData.driverType === "self_driver"
      ? STEPS_SELF
      : STEPS_COMPANY;
  const totalSteps = STEPS.length;

  const patch = (updates: Partial<typeof formData>) =>
    setFormData((prev) => ({ ...prev, ...updates }));

  const handleUseCurrentLocation = async (field: "pickup" | "dropoff") => {
    // Clear stale error/accuracy for this field before starting
    if (locError?.field === field) setLocError(null);
    if (locAccuracy?.field === field) setLocAccuracy(null);
    setLocState((prev) => ({ ...prev, [field]: "loading" }));

    try {
      const gps = await fetchCurrentPosition();

      if (gps.ok === false) {
        setLocError({ field, code: gps.code });
        setLocState((prev) => ({ ...prev, [field]: "error" }));
        return;
      }

      // Warn if accuracy is poor (> 200 m) — address may be approximate
      if (gps.accuracy > 200) {
        setLocAccuracy({ field, meters: Math.round(gps.accuracy) });
      }

      let address: string;
      try {
        address = await reverseGeocode(gps.lat, gps.lng);
      } catch {
        // Geocoding failed — coords are still valid, fall back to coordinate string
        address = `${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)}`;
      }

      if (field === "pickup") {
        patch({ pickupAddress: address, pickupLatitude: gps.lat, pickupLongitude: gps.lng });
      } else {
        patch({ dropoffAddress: address, dropoffLatitude: gps.lat, dropoffLongitude: gps.lng });
      }

      setLocState((prev) => ({ ...prev, [field]: "success" }));
      setTimeout(() => setLocState((prev) => ({ ...prev, [field]: "idle" })), 2500);
    } catch {
      setLocError({ field, code: "timeout" });
      setLocState((prev) => ({ ...prev, [field]: "error" }));
    }
  };

  const calculatedPrice = useMemo(() => {
    if (formData.driverType !== "self_driver") return null;
    const {
      pickupLatitude,
      pickupLongitude,
      dropoffLatitude,
      dropoffLongitude,
    } = formData;
    if (
      pickupLatitude == null ||
      pickupLongitude == null ||
      dropoffLatitude == null ||
      dropoffLongitude == null
    )
      return null;
    const distanceKm = haversineKm(
      pickupLatitude,
      pickupLongitude,
      dropoffLatitude,
      dropoffLongitude,
    );
    return { price: estimatePriceNgN(distanceKm, formData.vehicleType), distanceKm };
  }, [
    formData.driverType,
    formData.vehicleType,
    formData.pickupLatitude,
    formData.pickupLongitude,
    formData.dropoffLatitude,
    formData.dropoffLongitude,
  ]);

  const loadNearbyDrivers = async () => {
    setLoadingDrivers(true);
    setSelectedDriverId(null);
    try {
      const raw = await listOnlineApprovedDrivers(20);
      const pickupLat = formData.pickupLatitude ?? latitude ?? 0;
      const pickupLng = formData.pickupLongitude ?? longitude ?? 0;

      const enriched: NearbyDriver[] = await Promise.all(
        raw
          .filter((d) => d.currentLocation?.lat && d.currentLocation?.lng)
          .map(async (d) => {
            const distanceKm = haversineKm(
              pickupLat,
              pickupLng,
              d.currentLocation!.lat,
              d.currentLocation!.lng,
            );
            let firstName: string | undefined;
            let lastName: string | undefined;
            let photoURL: string | undefined;
            try {
              const userSnap = await getDoc(doc(db, "users", d.id));
              if (userSnap.exists()) {
                const u = userSnap.data() as any;
                firstName = u.firstName;
                lastName = u.lastName;
                photoURL = u.photoURL;
              }
            } catch {}

            let plateNumber: string | undefined;
            let vehicleType: string | undefined;
            try {
              const vSnap = await getDoc(doc(db, "vehicles", d.id));
              if (vSnap.exists()) {
                const vData = vSnap.data() as any;
                plateNumber = vData.plateNumber;
                vehicleType = vData.vehicleType;
              }
            } catch {}

            return {
              id: d.id,
              firstName,
              lastName,
              photoURL,
              selfieUrl: (d as DriverDoc & { id: string }).selfieUrl ?? null,
              vehicleType: vehicleType ?? (d as any).vehicleType,
              plateNumber,
              averageRating: (d as DriverDoc & { id: string }).averageRating,
              distanceKm,
              etaMinutes: Math.round((distanceKm / 30) * 60),
              currentLocation: d.currentLocation,
            };
          }),
      );

      const nearby = enriched
        .filter((d) => d.distanceKm <= 10 && d.vehicleType === formData.vehicleType)
        .sort((a, b) => a.distanceKm - b.distanceKm);

      setNearbyDrivers(nearby);
      if (nearby.length === 0) {
        const label = vehicleOptions.find((o) => o.type === formData.vehicleType)?.label ?? "drivers";
        toast.info(`No ${label} drivers found nearby.`);
      }
    } catch {
      toast.error("Failed to load nearby drivers");
    } finally {
      setLoadingDrivers(false);
    }
  };

  const createAndBroadcast = async () => {
    if (!calculatedPrice || !formData.pickupLatitude || !formData.dropoffLatitude) return;
    // If a broadcast already exists, reuse it while it's still active rather than
    // creating a duplicate (avoids spamming drivers on every refresh).
    if (broadcastIdRef.current) {
      try {
        const snap = await getDoc(doc(db, "delivery_broadcasts", broadcastIdRef.current));
        if (snap.exists()) {
          const bd = snap.data() as any;
          const expiresAt = bd.expiresAt?.toDate?.() ?? new Date(0);
          if (bd.status === "active" && expiresAt > new Date()) {
            return; // still live — reuse it
          }
        }
      } catch {}
      broadcastIdRef.current = null;
    }
    // Expire every active broadcast for this customer before creating a new one.
    // Fire-and-forget expiry (on back/cancel/unmount) is unreliable: the write can be
    // dropped on page unload, or the customer can advance again before it completes,
    // leaving orphaned active docs visible to drivers. Querying here is the only safe
    // dedup point regardless of how many stale docs exist.
    try {
      const staleQ = query(
        collection(db, "delivery_broadcasts"),
        where("customerId", "==", customerId),
        where("status", "==", "active"),
      );
      const staleSnap = await getDocs(staleQ);
      await Promise.all(staleSnap.docs.map((d) => expireBroadcast(d.id).catch(() => {})));
    } catch {}
    try {
      const id = await createBroadcast({
        customerId,
        pickup: {
          address: formData.pickupAddress,
          lat: formData.pickupLatitude,
          lng: formData.pickupLongitude ?? 0,
        },
        dropoff: {
          address: formData.dropoffAddress,
          lat: formData.dropoffLatitude,
          lng: formData.dropoffLongitude ?? 0,
        },
        transportType: formData.vehicleType,
        estimatedPrice: calculatedPrice.price,
        distanceKm: calculatedPrice.distanceKm,
        allowNegotiation: true,
        itemDescription: formData.itemDescription || null,
        itemSize: formData.itemSize,
        packagePhotoUrl: packagePhotoUrl,
      });
      setBroadcastId(id);
      broadcastIdRef.current = id;
      setBroadcastResponses([]);
      setAcceptedBroadcastOffer(null);
    } catch {
      // broadcast is best-effort; don't block the UI
    }
  };

  const handleNextStep = async () => {
    const next = step + 1;
    setStep(next);
    if (formData.driverType === "self_driver" && next === 4) {
      setIsLoading(true);
      try {
        await Promise.all([loadNearbyDrivers(), createAndBroadcast()]);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handlePrevStep = () => {
    // Going back from the nearby-drivers step: expire the broadcast and notify interested drivers
    if (step === 4 && formData.driverType === "self_driver" && broadcastIdRef.current) {
      const idToExpire = broadcastIdRef.current;
      expireBroadcast(idToExpire).catch(() => {});
      notifyBroadcastDriversCancelled(idToExpire).catch(() => {});
      broadcastIdRef.current = null;
      setBroadcastId(null);
      setBroadcastResponses([]);
      setAcceptedBroadcastOffer(null);
    }
    setStep(step - 1);
  };

  const canProceedStep1 =
    formData.pickupAddress.trim() && formData.dropoffAddress.trim();

  const handlePhotoCapture = async (dataUrl: string) => {
    setShowCamera(false);
    setUploadingPhoto(true);
    try {
      const url = await uploadPackagePhoto(dataUrl);
      setPackagePhotoUrl(url);
      toast.success("Package photo uploaded!");
    } catch {
      setPackagePhotoUrl(dataUrl);
      toast.success("Photo captured — will upload on submit.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const ensurePhotoUploaded = async (): Promise<string | null> => {
    if (!packagePhotoUrl) return null;
    if (packagePhotoUrl.startsWith("data:")) {
      try {
        return await uploadPackagePhoto(packagePhotoUrl);
      } catch {
        return null;
      }
    }
    return packagePhotoUrl;
  };

  // ── Waiting for acceptance ───────────────────────────────────────────────

  useEffect(() => {
    if (!waitingAssignmentId || !waitingRequestId) return;
    const rId = waitingRequestId;
    const unsub = onSnapshot(doc(db, "assignments", waitingAssignmentId), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      if (data.driverAccepted === true) {
        if (broadcastIdRef.current) {
          fulfillBroadcast(broadcastIdRef.current, data.driverId ?? "", rId).catch(() => {});
          broadcastIdRef.current = null;
        }
        clearPersistedForm();
        onSuccess?.(rId);
      } else if (data.driverAccepted === false) {
        // Reset delivery back to pending so the customer can select another driver
        updateDeliveryStatus(rId, "pending").catch(() => {});
        setDriverDeclined(true);
        setCounterOfferNegotiating(false);
        setCounterOfferPrice(null);
      }
    });
    return () => unsub();
  }, [waitingAssignmentId, waitingRequestId]);

  // Watch the request doc to detect driver counter-offers
  useEffect(() => {
    if (!waitingRequestId) return;
    const unsub = onSnapshot(doc(db, "delivery_requests", waitingRequestId), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data() as any;
      if (data.status === "negotiating_price" && data.counterOfferPrice != null) {
        setCounterOfferPrice(data.counterOfferPrice);
        setCounterOfferNegotiating(true);
      } else if (data.status !== "negotiating_price") {
        setCounterOfferNegotiating(false);
        setCounterOfferPrice(null);
      }
    });
    return () => unsub();
  }, [waitingRequestId]);

  // Expire broadcast on unmount if not already fulfilled
  useEffect(() => {
    return () => {
      if (broadcastIdRef.current) {
        expireBroadcast(broadcastIdRef.current).catch(() => {});
      }
    };
  }, []);

  // Listen to broadcast responses and merge into nearbyDrivers
  useEffect(() => {
    if (!broadcastId) return;
    return listenBroadcastResponses(broadcastId, setBroadcastResponses);
  }, [broadcastId]);

  // On mount: validate any restored waitingRequestId is still live; discard stale sessions
  useEffect(() => {
    const restored = restoredRef.current;
    if (!restored) return;

    const validateAndRestore = async () => {
      if (restored.waitingRequestId) {
        try {
          const snap = await getDoc(doc(db, "delivery_requests", restored.waitingRequestId));
          if (!snap.exists()) { clearPersistedForm(); return; }
          const data = snap.data() as any;
          const terminal = ["completed", "cancelled"];
          if (terminal.includes(data.status)) {
            clearPersistedForm();
            return;
          }
        } catch {
          clearPersistedForm();
          return;
        }
      }
      // Session is still valid — re-fetch drivers only when on step 4 and NOT waiting for a driver
      if (restored.step === 4 && restored.formData?.driverType === "self_driver" && !restored.waitingRequestId) {
        loadNearbyDrivers();
        createAndBroadcast();
      }
    };

    validateAndRestore();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist form state to sessionStorage on every relevant change
  useEffect(() => {
    if (initialPickup || initialDropoff) return; // never save hero-booking state
    if (step === 1 && !formData.pickupAddress && !formData.dropoffAddress) {
      try { sessionStorage.removeItem(FORM_STORAGE_KEY); } catch {}
      return;
    }
    const toSave: PersistedFormState = {
      step,
      formData,
      broadcastId,
      waitingRequestId,
      waitingAssignmentId,
      selectedDriverId,
      packagePhotoUrl: packagePhotoUrl?.startsWith("data:") ? null : packagePhotoUrl,
      reusableRequestId,
      counterOfferPrice,
      acceptedBroadcastOffer,
    };
    try { sessionStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(toSave)); } catch {}
  }, [step, formData, broadcastId, waitingRequestId, waitingAssignmentId, selectedDriverId, packagePhotoUrl, reusableRequestId, counterOfferPrice, acceptedBroadcastOffer]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAcceptCounterOffer = async () => {
    if (!waitingAssignmentId || !waitingRequestId || counterOfferPrice === null) return;
    setIsLoading(true);
    try {
      // Lock in the agreed counter price and return status to driver_assigned so the
      // driver still needs to click "Accept Job" — this keeps the normal acceptance
      // flow intact rather than auto-completing the job on the customer side.
      await updateDoc(doc(db, "delivery_requests", waitingRequestId), {
        estimatedPrice: counterOfferPrice,
        fixedPrice: true,
        allowNegotiation: false,
        counterOfferPrice: null,
        counterOfferDriverId: null,
        counterOfferAt: null,
        counterOfferAccepted: true,
        acceptedCounterPrice: counterOfferPrice,
        status: "driver_assigned" as const,
        updatedAt: serverTimestamp(),
      });
      // counterOfferNegotiating clears via the request listener detecting status !== "negotiating_price"
      // The customer stays on the waiting screen until the driver clicks "Accept Job"
    } catch {
      toast.error("Failed to accept offer");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToDriverSelection = async () => {
    if (waitingAssignmentId && !driverDeclined) {
      try {
        await setDriverAccepted(waitingAssignmentId, false, waitingRequestId ?? undefined);
      } catch {}
    }
    if (waitingRequestId && counterOfferNegotiating) {
      try {
        await updateDoc(doc(db, "delivery_requests", waitingRequestId), {
          counterOfferPrice: null,
          counterOfferDriverId: null,
          counterOfferAt: null,
        });
      } catch {}
    }
    // Keep the existing delivery request ID so re-submit reuses it instead of creating a
    // duplicate. Clearing waitingRequestId hides the waiting screen; reusableRequestId
    // carries the ID forward to handleSubmit.
    if (waitingRequestId) setReusableRequestId(waitingRequestId);
    setWaitingRequestId(null);
    setWaitingAssignmentId(null);
    setDriverDeclined(false);
    setCounterOfferPrice(null);
    setCounterOfferNegotiating(false);
    setSelectedDriverId(null);
    setStep(4);
    loadNearbyDrivers();
  };

  // Switch to a different driver from the waiting page (broadcast other-interested panel)
  const handleSwitchToDriver = async (newDriverId: string) => {
    if (!waitingRequestId || !waitingAssignmentId) return;
    setIsLoading(true);
    try {
      await setDriverAccepted(waitingAssignmentId, false, waitingRequestId);
      // Reset old driver's "selected" broadcast response back to "pending"
      if (broadcastIdRef.current && selectedDriverId) {
        resetBroadcastDriverSelection(broadcastIdRef.current, selectedDriverId).catch(() => {});
      }
      if (counterOfferNegotiating) {
        await updateDoc(doc(db, "delivery_requests", waitingRequestId), {
          counterOfferPrice: null,
          counterOfferDriverId: null,
          counterOfferAt: null,
        });
      }
      const newAssignmentId = await createAssignment(waitingRequestId, newDriverId, "customer");
      await updateDeliveryStatus(waitingRequestId, "driver_assigned");
      if (broadcastIdRef.current) {
        selectBroadcastDriver(broadcastIdRef.current, newDriverId, newAssignmentId, waitingRequestId).catch(() => {});
      }
      setWaitingAssignmentId(newAssignmentId);
      setSelectedDriverId(newDriverId);
      setDriverDeclined(false);
      setCounterOfferPrice(null);
      setCounterOfferNegotiating(false);
    } catch {
      toast.error("Failed to switch driver");
    } finally {
      setIsLoading(false);
    }
  };

  // Accept a counter-offer from the broadcast on the nearby drivers page
  const handleAcceptBroadcastCounter = async (driverId: string, price: number) => {
    setAcceptedBroadcastOffer({ driverId, price });
    setSelectedDriverId(driverId);
    // Pass values directly so the submit doesn't wait for React state to settle
    await handleSubmit({ driverId, acceptedOffer: { driverId, price } });
  };

  // Decline a counter-offer from the broadcast (dismiss it from the card)
  const handleDeclineBroadcastCounter = async (driverId: string) => {
    if (!broadcastIdRef.current) return;
    try {
      await dismissBroadcastResponse(broadcastIdRef.current, driverId);
    } catch {}
  };

  // ── Submit ───────────────────────────────────────────────────────────────

  const handleSubmit = async (opts?: {
    driverId?: string;
    acceptedOffer?: { driverId: string; price: number } | null;
  }) => {
    // Allow callers to pass values directly so React state doesn't need to settle first
    const effectiveDriverId = opts?.driverId ?? selectedDriverId;
    const effectiveOffer =
      opts !== undefined && "acceptedOffer" in opts
        ? opts.acceptedOffer
        : acceptedBroadcastOffer;

    if (!canProceedStep1) {
      toast.error("Please fill in both addresses");
      return;
    }
    if (formData.driverType === "self_driver" && !effectiveDriverId) {
      toast.error("Please select a driver");
      return;
    }

    setIsLoading(true);
    try {
      const isSelf = formData.driverType === "self_driver";
      const finalPhotoUrl = await ensurePhotoUploaded();

      // Reuse an existing delivery request when retrying after a driver decline,
      // so we don't create duplicate documents in the customer's dashboard.
      let requestId = reusableRequestId ?? null;
      let deliveryName = "";

      // Snapshot customer contact info so companies can see it on the marketplace card
      let customerName: string | null = null;
      let customerPhone: string | null = null;
      try {
        const userSnap = await getDoc(doc(db, "users", customerId));
        if (userSnap.exists()) {
          const u = userSnap.data() as any;
          customerName = [u.firstName, u.lastName].filter(Boolean).join(" ") || null;
          customerPhone = u.phone ?? null;
        }
      } catch { /* non-critical — request still created */ }

      if (!requestId) {
        requestId = await createDeliveryRequest({
          customerId,
          customerName,
          customerPhone,
          pickup: {
            address: formData.pickupAddress,
            lat: formData.pickupLatitude ?? 0,
            lng: formData.pickupLongitude ?? 0,
          },
          dropoff: {
            address: formData.dropoffAddress,
            lat: formData.dropoffLatitude ?? 0,
            lng: formData.dropoffLongitude ?? 0,
          },
          transportType: formData.vehicleType,
          driverType: formData.driverType,
          status: "pending",
          workflowOwner: isSelf ? "admin" : "company",
          ...(isSelf ? {} : {
            companyAssignmentStatus: "open" as const,
            quoteExpiresAt: Timestamp.fromMillis(Date.now() + 30 * 60 * 1000),
          }),
          itemDescription: formData.itemDescription,
          itemWeight: formData.itemWeight,
          itemSize: formData.itemSize,
          packagePhotoUrl: finalPhotoUrl ?? null,
          isScheduled: formData.isScheduled,
          scheduledTime: formData.isScheduled ? formData.scheduledTime : null,
          ...(isSelf && effectiveOffer?.driverId === effectiveDriverId
            ? {
                estimatedPrice: effectiveOffer.price,
                distanceKm: calculatedPrice?.distanceKm ?? 0,
                fixedPrice: true,
                allowNegotiation: false,
                counterOfferAccepted: true,
                acceptedCounterPrice: effectiveOffer.price,
              }
            : isSelf && calculatedPrice
              ? {
                  estimatedPrice: calculatedPrice.price,
                  distanceKm: calculatedPrice.distanceKm,
                  fixedPrice: false,
                  allowNegotiation: true,
                }
              : { fixedPrice: false, allowNegotiation: false }),
        });

        const descName = descriptionToName(formData.itemDescription);
        deliveryName = descName
          ? (() => {
              const hex = requestId.replace(/[^0-9a-f]/gi, "").slice(-4);
              const num = (parseInt(hex || "0", 16) % 10000)
                .toString()
                .padStart(4, "0");
              return `${descName} #${num}`;
            })()
          : generateDeliveryName({
              firestoreId: requestId,
              pickupAddress: formData.pickupAddress,
              dropoffAddress: formData.dropoffAddress,
              includeRoute: true,
            });

        const { updateDoc: _updateDoc, doc: fbDoc } = await import("firebase/firestore");
        const { db: fbDb } = await import("@/integrations/firebase/client");
        await _updateDoc(fbDoc(fbDb, "delivery_requests", requestId), { deliveryName });
      } else {
        // Fetch the name from the existing request so the toast message is accurate
        try {
          const snap = await getDoc(doc(db, "delivery_requests", requestId));
          deliveryName = snap.exists() ? ((snap.data() as any).deliveryName ?? "") : "";
        } catch {}
        // If the customer accepted a counter offer, update the price on the reused document
        if (isSelf && effectiveOffer?.driverId === effectiveDriverId) {
          await updateDoc(doc(db, "delivery_requests", requestId), {
            estimatedPrice: effectiveOffer.price,
            fixedPrice: true,
            allowNegotiation: false,
            counterOfferAccepted: true,
            acceptedCounterPrice: effectiveOffer.price,
            updatedAt: serverTimestamp(),
          });
        }
        setReusableRequestId(null);
      }

      if (isSelf && effectiveDriverId) {
        const assignmentId = await createAssignment(requestId, effectiveDriverId, "customer");
        await updateDeliveryStatus(requestId, "driver_assigned");
        if (broadcastIdRef.current) {
          selectBroadcastDriver(broadcastIdRef.current, effectiveDriverId, assignmentId, requestId).catch(() => {});
        }
        toast.success(`"${deliveryName || "Delivery"}" sent to driver!`);
        setWaitingRequestId(requestId);
        setWaitingAssignmentId(assignmentId);
      } else {
        // For company-driver flow, expire the broadcast (shouldn't exist, but guard anyway)
        if (broadcastIdRef.current) {
          expireBroadcast(broadcastIdRef.current).catch(() => {});
          broadcastIdRef.current = null;
          setBroadcastId(null);
        }
        clearPersistedForm();
        setNegotiationRequestId(requestId);
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to create request");
    } finally {
      setIsLoading(false);
    }
  };

  if (showCamera) {
    return (
      <CameraCapture
        title="Package Photo"
        facingMode="environment"
        onCapture={handlePhotoCapture}
        onCancel={() => setShowCamera(false)}
      />
    );
  }

  // ── Company-driver negotiation section ───────────────────────────────────

  if (negotiationRequestId) {
    return (
      <div className={fullPage ? "w-full max-w-2xl mx-auto bg-white" : "bg-card rounded-2xl border border-border overflow-hidden max-w-lg mx-auto"}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Waiting for quotes
            </p>
            <p className="font-bold text-base mt-0.5">Company Offers</p>
          </div>
          <Building2 className="w-5 h-5 text-muted-foreground" />
        </div>
        <div className="p-5">
          <DeliveryNegotiationSection
            requestId={negotiationRequestId}
            onAccepted={(id) => {
              setNegotiationRequestId(null);
              onSuccess?.(id);
            }}
            onCancelled={() => {
              setNegotiationRequestId(null);
              onCancel?.();
            }}
          />
        </div>
      </div>
    );
  }

  // ── Waiting for acceptance screen ────────────────────────────────────────

  if (waitingRequestId) {
    const waitingDriver = preselectedDriver
      ? {
          firstName: preselectedDriver.firstName,
          lastName: preselectedDriver.lastName,
          vehicleType: preselectedDriver.vehicleType,
          plateNumber: preselectedDriver.plateNumber,
          averageRating: preselectedDriver.averageRating,
        }
      : nearbyDrivers.find((d) => d.id === selectedDriverId);

    const driverName =
      [waitingDriver?.firstName, waitingDriver?.lastName].filter(Boolean).join(" ") || "Driver";
    const initials =
      (waitingDriver?.firstName?.[0] ?? "") + (waitingDriver?.lastName?.[0] ?? "");

    return (
      <div className={fullPage ? "w-full max-w-2xl mx-auto bg-white" : "bg-card rounded-2xl border border-border overflow-hidden max-w-lg mx-auto"}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="font-bold text-base">
              {counterOfferNegotiating
                ? "Driver Counter Offer"
                : driverDeclined
                  ? "Driver Unavailable"
                  : "Waiting for Acceptance"}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {counterOfferNegotiating
                ? "Review and respond to the driver's price offer"
                : driverDeclined
                  ? "The driver couldn't take this job"
                  : "Awaiting driver response…"}
            </p>
          </div>
          {onCancel && (
            <button
              onClick={() => { clearPersistedForm(); onCancel(); }}
              className="h-8 w-8 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="px-5 py-6 space-y-5">
          {/* Driver card */}
          {waitingDriver && (
            <div
              className={`flex items-center gap-3 p-4 rounded-2xl border transition-colors ${
                driverDeclined
                  ? "border-destructive/20 bg-destructive/5"
                  : counterOfferNegotiating
                    ? "border-blue-200 bg-blue-50"
                    : "border-primary/20 bg-primary/5"
              }`}
            >
              <Avatar className="h-12 w-12 rounded-xl flex-shrink-0">
                <AvatarFallback
                  className={`rounded-xl text-sm font-bold ${
                    driverDeclined
                      ? "bg-destructive/10 text-destructive"
                      : counterOfferNegotiating
                        ? "bg-blue-100 text-blue-700"
                        : "bg-primary/10 text-primary"
                  }`}
                >
                  {initials || <User className="h-4 w-4" />}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className={`font-semibold text-sm ${driverDeclined ? "text-destructive" : counterOfferNegotiating ? "text-blue-700" : "text-primary"}`}>
                  {driverName}
                </p>
                <p className="text-xs text-muted-foreground capitalize truncate">
                  {waitingDriver.vehicleType?.replace(/_/g, " ") ?? ""}
                  {waitingDriver.plateNumber ? ` · ${waitingDriver.plateNumber}` : ""}
                </p>
                {waitingDriver.averageRating != null && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    <span className="text-xs font-semibold">
                      {waitingDriver.averageRating.toFixed(1)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Status area — three mutually exclusive states */}
          {counterOfferNegotiating && counterOfferPrice !== null ? (
            <div className="rounded-2xl border-2 border-blue-200 bg-blue-50/60 overflow-hidden animate-fade-in">
              <div className="px-4 pt-4 pb-3 space-y-3">
                {/* Price comparison */}
                <div className="flex items-stretch gap-3 bg-white rounded-xl overflow-hidden border border-blue-100">
                  <div className="flex-1 px-4 py-3">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Was</p>
                    {calculatedPrice ? (
                      <p className="text-base font-semibold line-through text-muted-foreground mt-0.5">
                        ₦{calculatedPrice.price.toLocaleString()}
                      </p>
                    ) : (
                      <p className="text-base text-muted-foreground mt-0.5">—</p>
                    )}
                  </div>
                  <div className="w-px bg-blue-100" />
                  <div className="flex-1 px-4 py-3 text-right">
                    <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wide">New Price</p>
                    <p className="text-2xl font-bold text-blue-700 mt-0.5">
                      ₦{counterOfferPrice.toLocaleString()}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-blue-700 text-center">
                  Accept to lock in this price. Decline to choose a different driver.
                </p>
              </div>
              {/* Actions */}
              <div className="flex gap-2.5 px-4 pb-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBackToDriverSelection}
                  disabled={isLoading}
                  className="flex-1 h-11 rounded-xl border-destructive/50 text-destructive hover:bg-destructive/5 hover:border-destructive"
                >
                  <X className="h-4 w-4 mr-1.5" />
                  Decline
                </Button>
                <Button
                  type="button"
                  onClick={handleAcceptCounterOffer}
                  disabled={isLoading}
                  className="flex-1 h-11 rounded-xl"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-1.5" />
                      Accept ₦{counterOfferPrice.toLocaleString()}
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : !driverDeclined ? (
            <div className="flex flex-col items-center py-6 gap-3">
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                <div className="relative w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Clock className="w-7 h-7 text-primary" />
                </div>
              </div>
              <p className="font-semibold text-sm">Waiting for driver to respond…</p>
              <p className="text-xs text-muted-foreground text-center">
                The driver will accept or decline shortly. You can go back and choose a different driver at any time.
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center py-6 gap-3">
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                <X className="w-7 h-7 text-destructive" />
              </div>
              <p className="font-semibold text-sm">Driver declined this job</p>
              <p className="text-xs text-muted-foreground text-center">
                Choose a different driver to continue with your delivery.
              </p>
            </div>
          )}

          {/* Other interested drivers from the broadcast */}
          {(() => {
            const others = broadcastResponses.filter(
              (r) => r.driverId !== selectedDriverId
            );
            if (others.length === 0) return null;
            return (
              <div className="border-t border-border pt-4 space-y-2">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                  Other drivers interested
                </p>
                {others.map((r) => {
                  const info = nearbyDrivers.find((d) => d.id === r.driverId);
                  const name =
                    [info?.firstName, info?.lastName].filter(Boolean).join(" ") ||
                    "Driver";
                  return (
                    <div
                      key={r.driverId}
                      className={`flex items-center gap-3 p-3 rounded-xl border ${
                        r.responseType === "counter_offer"
                          ? "border-blue-200 bg-blue-50/40"
                          : "border-green-200 bg-green-50/30"
                      }`}
                    >
                      <Avatar className="h-9 w-9 rounded-xl flex-shrink-0">
                        <AvatarFallback className="rounded-xl bg-primary/10 text-primary text-xs font-bold">
                          {(info?.firstName?.[0] ?? "") + (info?.lastName?.[0] ?? "") || <User className="h-3.5 w-3.5" />}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{name}</p>
                        <p className="text-xs text-muted-foreground">
                          {r.responseType === "counter_offer"
                            ? `₦${r.counterOfferPrice?.toLocaleString()} offer`
                            : "Interested"}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="text-xs rounded-lg h-8 px-3 flex-shrink-0"
                        disabled={isLoading}
                        onClick={() => handleSwitchToDriver(r.driverId)}
                      >
                        Switch
                      </Button>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* Back button — hidden during counter-offer (actions are inline above) */}
          {!counterOfferNegotiating && (
            <Button
              variant={driverDeclined ? "default" : "outline"}
              className="w-full h-11 rounded-xl"
              onClick={handleBackToDriverSelection}
            >
              {driverDeclined ? "Choose Another Driver" : "Back to Choose Driver"}
            </Button>
          )}
        </div>
      </div>
    );
  }

  const hasPrefilledLocations = !!(initialPickup?.lat && initialDropoff?.lat);

  return (
    <div className={fullPage ? "w-full max-w-2xl mx-auto bg-white" : "bg-card rounded-2xl border border-border overflow-hidden max-w-lg mx-auto"}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div>
          <h2 className="font-bold text-base">New Delivery</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {STEPS[step - 1]}
          </p>
        </div>
        {onCancel && (
          <button
            onClick={() => {
              if (broadcastIdRef.current) {
                const idToExpire = broadcastIdRef.current;
                expireBroadcast(idToExpire).catch(() => {});
                notifyBroadcastDriversCancelled(idToExpire).catch(() => {});
                broadcastIdRef.current = null;
              }
              clearPersistedForm();
              onCancel();
            }}
            className="h-8 w-8 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div className="flex gap-1 px-5 pt-4">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-all duration-500 ${i + 1 <= step ? "bg-primary" : "bg-muted"}`}
          />
        ))}
      </div>

      <div className="px-5 py-5">
        {/* ── Pre-filled locations banner ── */}
        {hasPrefilledLocations && step === 1 && (
          <div className="flex items-start gap-3 bg-primary/5 border border-primary/20 rounded-2xl px-4 py-3 mb-4 animate-fade-in">
            <MapPin className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-primary/70 uppercase tracking-wider mb-1">
                Locations from your search
              </p>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                  <p className="text-xs font-medium text-gray-700 truncate">
                    {formData.pickupAddress}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-destructive flex-shrink-0" />
                  <p className="text-xs font-medium text-gray-700 truncate">
                    {formData.dropoffAddress}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Preselected driver banner ── */}
        {preselectedDriver && (
          <div className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-2xl px-4 py-3 mb-4">
            <div className="h-11 w-11 rounded-xl overflow-hidden bg-primary/10 flex-shrink-0 ring-2 ring-primary/20">
              {preselectedDriver.photoURL ? (
                <img
                  src={preselectedDriver.photoURL}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-primary font-bold text-sm">
                  {preselectedDriver.firstName?.[0]}
                  {preselectedDriver.lastName?.[0]}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-primary/70 uppercase tracking-wider">
                Booking with
              </p>
              <p className="font-bold text-sm text-gray-900 truncate">
                {[preselectedDriver.firstName, preselectedDriver.lastName]
                  .filter(Boolean)
                  .join(" ") || "Driver"}
              </p>
              {preselectedDriver.carModel && (
                <p className="text-xs text-gray-400 truncate">
                  {preselectedDriver.carModel}
                  {preselectedDriver.plateNumber
                    ? ` · ${preselectedDriver.plateNumber}`
                    : ""}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              <span className="text-sm font-bold text-gray-800">
                {(preselectedDriver.averageRating ?? 5).toFixed(1)}
              </span>
            </div>
          </div>
        )}

        {/* ── Step 1: Locations ── */}
        {step === 1 && (
          <div className="space-y-4 animate-fade-in">
            {!preselectedDriver && (
              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">
                  Driver Type
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => patch({ driverType: "self_driver" })}
                    className={`relative p-4 rounded-xl border text-left transition-all ${formData.driverType === "self_driver" ? "bg-primary/5 border-primary ring-1 ring-primary/30" : "border-border hover:border-primary/30 bg-muted/30"}`}
                  >
                    {formData.driverType === "self_driver" && (
                      <span className="absolute top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground">
                        Negotiable
                      </span>
                    )}
                    <User
                      className={`h-5 w-5 mb-2 ${formData.driverType === "self_driver" ? "text-primary" : "text-muted-foreground"}`}
                    />
                    <p
                      className={`font-semibold text-sm ${formData.driverType === "self_driver" ? "text-primary" : ""}`}
                    >
                      Self Driver
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Auto price · you pick driver
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => patch({ driverType: "company_driver" })}
                    className={`relative p-4 rounded-xl border text-left transition-all ${formData.driverType === "company_driver" ? "bg-primary/5 border-primary ring-1 ring-primary/30" : "border-border hover:border-primary/30 bg-muted/30"}`}
                  >
                    <Building2
                      className={`h-5 w-5 mb-2 ${formData.driverType === "company_driver" ? "text-primary" : "text-muted-foreground"}`}
                    />
                    <p
                      className={`font-semibold text-sm ${formData.driverType === "company_driver" ? "text-primary" : ""}`}
                    >
                      Company Driver
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Price set by admin
                    </p>
                  </button>
                </div>

                {formData.driverType === "self_driver" && (
                  <div className="mt-2 flex items-start gap-2 bg-primary/5 border border-primary/20 rounded-xl px-3 py-2.5 text-xs text-primary animate-fade-in">
                    <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                    <span>
                      Price is auto-calculated from distance. The driver may
                      counter-offer before accepting.
                    </span>
                  </div>
                )}

                {formData.driverType === "company_driver" && (
                  <div className="mt-2 flex items-start gap-2 bg-muted/50 border border-border rounded-xl px-3 py-2.5 text-xs text-muted-foreground animate-fade-in">
                    <Building2 className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                    <span>
                      The first company to accept will handle pricing,
                      assignment, tracking, and communication.
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Pickup */}
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">
                Pickup Location
              </Label>
              <div className="flex gap-2">
                <LocationInput
                  value={formData.pickupAddress}
                  placeholder="Search pickup address…"
                  dotColor="primary"
                  onChange={(val) => {
                    patch({ pickupAddress: val, pickupLatitude: null, pickupLongitude: null });
                    if (locError?.field === "pickup") setLocError(null);
                    if (locAccuracy?.field === "pickup") setLocAccuracy(null);
                  }}
                  onSelect={(s) =>
                    patch({
                      pickupAddress: formatLocationName(s),
                      pickupLatitude: parseFloat(s.lat),
                      pickupLongitude: parseFloat(s.lon),
                    })
                  }
                />
                <button
                  type="button"
                  onClick={() => handleUseCurrentLocation("pickup")}
                  disabled={locState.pickup === "loading"}
                  title={locState.pickup === "error" ? "Retry location" : "Use current location"}
                  className={`h-10 w-10 flex-shrink-0 rounded-xl border flex items-center justify-center transition-all disabled:pointer-events-none ${
                    locState.pickup === "error"
                      ? "border-red-200 bg-red-50 text-red-500 hover:bg-red-100"
                      : locState.pickup === "success"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-600"
                      : locState.pickup === "loading"
                      ? "border-primary/20 bg-primary/5 text-primary/40"
                      : "border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 hover:border-primary/50"
                  }`}
                >
                  {locState.pickup === "loading" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : locState.pickup === "error" ? (
                    <RefreshCw className="h-4 w-4" />
                  ) : locState.pickup === "success" ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <LocateFixed className="h-4 w-4" />
                  )}
                </button>
              </div>
              {/* Pickup GPS error */}
              {locError?.field === "pickup" && (
                <div className="mt-2 flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
                  <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-red-500" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-red-700">{GPS_ERRORS[locError.code].title}</p>
                    <p className="text-xs text-red-600/80 mt-0.5">{GPS_ERRORS[locError.code].hint}</p>
                  </div>
                  <button type="button" onClick={() => setLocError(null)} className="text-red-400 hover:text-red-600 flex-shrink-0 mt-0.5">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              {/* Pickup accuracy warning */}
              {locAccuracy?.field === "pickup" && (
                <div className="mt-2 flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5">
                  <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-amber-500" />
                  <p className="text-xs text-amber-700 flex-1">
                    Location accuracy is ~{locAccuracy.meters}m — address may be approximate. Review and edit if needed.
                  </p>
                  <button type="button" onClick={() => setLocAccuracy(null)} className="text-amber-400 hover:text-amber-600 flex-shrink-0 mt-0.5">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Route line */}
            <div className="flex items-center gap-3 py-0.5 px-1">
              <div className="w-3 flex flex-col items-center gap-0.5 flex-shrink-0">
                <div className="w-px h-3 bg-border" />
                <div className="w-px h-3 bg-border" />
              </div>
              <p className="text-xs text-muted-foreground">Route</p>
            </div>

            {/* Dropoff */}
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">
                Drop-off Location
              </Label>
              <div className="flex gap-2">
                <LocationInput
                  value={formData.dropoffAddress}
                  placeholder="Search drop-off address…"
                  dotColor="destructive"
                  onChange={(val) => {
                    patch({ dropoffAddress: val, dropoffLatitude: null, dropoffLongitude: null });
                    if (locError?.field === "dropoff") setLocError(null);
                    if (locAccuracy?.field === "dropoff") setLocAccuracy(null);
                  }}
                  onSelect={(s) =>
                    patch({
                      dropoffAddress: formatLocationName(s),
                      dropoffLatitude: parseFloat(s.lat),
                      dropoffLongitude: parseFloat(s.lon),
                    })
                  }
                />
                <button
                  type="button"
                  onClick={() => handleUseCurrentLocation("dropoff")}
                  disabled={locState.dropoff === "loading"}
                  title={locState.dropoff === "error" ? "Retry location" : "Use current location"}
                  className={`h-10 w-10 flex-shrink-0 rounded-xl border flex items-center justify-center transition-all disabled:pointer-events-none ${
                    locState.dropoff === "error"
                      ? "border-red-200 bg-red-50 text-red-500 hover:bg-red-100"
                      : locState.dropoff === "success"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-600"
                      : locState.dropoff === "loading"
                      ? "border-primary/20 bg-primary/5 text-primary/40"
                      : "border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 hover:border-primary/50"
                  }`}
                >
                  {locState.dropoff === "loading" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : locState.dropoff === "error" ? (
                    <RefreshCw className="h-4 w-4" />
                  ) : locState.dropoff === "success" ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <LocateFixed className="h-4 w-4" />
                  )}
                </button>
              </div>
              {/* Drop-off GPS error */}
              {locError?.field === "dropoff" && (
                <div className="mt-2 flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
                  <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-red-500" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-red-700">{GPS_ERRORS[locError.code].title}</p>
                    <p className="text-xs text-red-600/80 mt-0.5">{GPS_ERRORS[locError.code].hint}</p>
                  </div>
                  <button type="button" onClick={() => setLocError(null)} className="text-red-400 hover:text-red-600 flex-shrink-0 mt-0.5">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              {/* Drop-off accuracy warning */}
              {locAccuracy?.field === "dropoff" && (
                <div className="mt-2 flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5">
                  <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-amber-500" />
                  <p className="text-xs text-amber-700 flex-1">
                    Location accuracy is ~{locAccuracy.meters}m — address may be approximate. Review and edit if needed.
                  </p>
                  <button type="button" onClick={() => setLocAccuracy(null)} className="text-amber-400 hover:text-amber-600 flex-shrink-0 mt-0.5">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>

            {(formData.pickupAddress.trim() ||
              formData.dropoffAddress.trim()) && (
              <AutoNamePreview
                description={formData.itemDescription}
                pickup={formData.pickupAddress}
                dropoff={formData.dropoffAddress}
              />
            )}
          </div>
        )}

        {/* ── Step 2: Item Details ── */}
        {step === 2 && (
          <div className="space-y-4 animate-fade-in">
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" /> Item Description
                <span className="text-[10px] font-normal text-primary/70 ml-1">
                  — used to name your delivery
                </span>
              </Label>
              <Textarea
                placeholder="e.g. Mum's groceries, Office documents, Birthday cake"
                value={formData.itemDescription}
                onChange={(e) => patch({ itemDescription: e.target.value })}
                className="mt-2 rounded-xl min-h-[90px] resize-none border-border/80 focus-visible:ring-primary/30"
              />
              {formData.itemDescription.trim() ? (
                descriptionToName(formData.itemDescription) ? (
                  <div className="flex items-center gap-2 mt-2 bg-primary/5 border border-primary/20 rounded-xl px-3 py-2 animate-fade-in">
                    <Sparkles className="h-3 w-3 text-primary flex-shrink-0" />
                    <span className="text-xs text-primary/70">
                      Delivery will be named
                    </span>
                    <span className="text-xs font-bold text-primary truncate">
                      &ldquo;{descriptionToName(formData.itemDescription)}{" "}
                      &middot; Delivery&rdquo;
                    </span>
                  </div>
                ) : (
                  <p className="text-[10px] text-muted-foreground mt-1.5 px-1">
                    Add more detail for a better name (e.g. mum&apos;s
                    groceries, not just stuff).
                  </p>
                )
              ) : null}
            </div>

            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Weight className="h-3.5 w-3.5" /> Estimated Weight
              </Label>
              <Input
                placeholder="e.g. 5kg"
                value={formData.itemWeight}
                onChange={(e) => patch({ itemWeight: e.target.value })}
                className="mt-2 rounded-xl border-border/80 focus-visible:ring-primary/30"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">
                Package Size
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {sizeOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => patch({ itemSize: opt.value })}
                    className={`px-4 py-3 rounded-xl border text-left transition-all ${formData.itemSize === opt.value ? "bg-primary/5 border-primary ring-1 ring-primary/30 text-primary" : "border-border hover:border-primary/30 bg-muted/30"}`}
                  >
                    <p className="font-semibold text-sm">{opt.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {opt.sub}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Package Photo */}
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5 mb-2">
                <Camera className="h-3.5 w-3.5" /> Package Photo
                <span className="text-[10px] font-normal text-muted-foreground ml-1">
                  — optional, helps the driver identify your package
                </span>
              </Label>

              {packagePhotoUrl ? (
                <div className="relative rounded-xl overflow-hidden border border-border">
                  <img
                    src={packagePhotoUrl}
                    alt="Package"
                    className="w-full h-44 object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-3 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                      <span className="text-xs font-semibold text-white">
                        Photo added
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowCamera(true)}
                        className="flex items-center gap-1 bg-white/20 hover:bg-white/30 text-white text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors"
                      >
                        <Camera className="h-3 w-3" /> Retake
                      </button>
                      <button
                        type="button"
                        onClick={() => setPackagePhotoUrl(null)}
                        className="h-7 w-7 bg-white/20 hover:bg-red-500/70 rounded-lg flex items-center justify-center text-white transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowCamera(true)}
                  disabled={uploadingPhoto}
                  className="w-full h-28 rounded-xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-primary transition-all disabled:opacity-50"
                >
                  {uploadingPhoto ? (
                    <>
                      <Loader2 className="h-6 w-6 animate-spin" />
                      <span className="text-sm font-medium">Uploading…</span>
                    </>
                  ) : (
                    <>
                      <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center">
                        <Camera className="h-5 w-5" />
                      </div>
                      <span className="text-sm font-medium">
                        Take a photo of your package
                      </span>
                      <span className="text-xs opacity-70">
                        Helps the driver identify it at pickup
                      </span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Step 3: Vehicle & Schedule ── */}
        {step === 3 && (
          <div className="space-y-4 animate-fade-in">
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">
                Select Vehicle
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {vehicleOptions.map((opt) => {
                  const Icon = opt.icon;
                  const isSelected = formData.vehicleType === opt.type;
                  return (
                    <button
                      key={opt.type}
                      type="button"
                      onClick={() => patch({ vehicleType: opt.type })}
                      className={`relative p-4 rounded-xl border text-left transition-all ${isSelected ? "bg-primary/5 border-primary ring-1 ring-primary/30" : "border-border hover:border-primary/30 bg-muted/30"}`}
                    >
                      {opt.tag && (
                        <span
                          className={`absolute top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                        >
                          {opt.tag}
                        </span>
                      )}
                      <Icon
                        className={`h-6 w-6 mb-2 ${isSelected ? "text-primary" : "text-muted-foreground"}`}
                      />
                      <p
                        className={`font-semibold text-sm ${isSelected ? "text-primary" : ""}`}
                      >
                        {opt.label}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {opt.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="bg-muted/40 rounded-xl p-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${formData.isScheduled ? "bg-primary border-primary" : "border-border bg-card"}`}
                  onClick={() => patch({ isScheduled: !formData.isScheduled })}
                >
                  {formData.isScheduled && (
                    <span className="text-primary-foreground text-xs font-bold">
                      ✓
                    </span>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <p className="font-semibold text-sm">Schedule for later</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Set a specific pickup time
                  </p>
                </div>
              </label>
              {formData.isScheduled && (
                <div className="mt-3 animate-fade-in">
                  <Input
                    type="datetime-local"
                    value={formData.scheduledTime}
                    onChange={(e) => patch({ scheduledTime: e.target.value })}
                    min={new Date().toISOString().slice(0, 16)}
                    className="rounded-xl border-border/80 focus-visible:ring-primary/30"
                  />
                </div>
              )}
            </div>

            <div className="bg-muted/30 rounded-xl p-4 space-y-2 text-sm">
              <p className="font-semibold text-xs text-muted-foreground uppercase tracking-wide mb-2">
                Summary
              </p>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="h-3 w-3 text-primary flex-shrink-0" />
                <span className="text-xs font-semibold text-primary truncate">
                  {(() => {
                    const descName = descriptionToName(
                      formData.itemDescription,
                    );
                    if (descName) return `${descName} · Delivery`;
                    return generateDeliveryName({
                      firestoreId: "preview0001preview0001",
                      pickupAddress: formData.pickupAddress,
                      dropoffAddress: formData.dropoffAddress,
                      includeRoute: true,
                    });
                  })()}
                </span>
                <span className="text-[9px] text-muted-foreground/60 italic flex-shrink-0">
                  {descriptionToName(formData.itemDescription)
                    ? "(from description)"
                    : "(from route)"}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                <span className="text-muted-foreground text-xs truncate">
                  {formData.pickupAddress}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 rounded-full bg-destructive mt-1.5 flex-shrink-0" />
                <span className="text-muted-foreground text-xs truncate">
                  {formData.dropoffAddress}
                </span>
              </div>
              {formData.itemDescription && (
                <p className="text-xs text-muted-foreground pl-4 truncate">
                  📦 {formData.itemDescription}
                </p>
              )}
              {packagePhotoUrl && (
                <div className="flex items-center gap-2 pl-4 pt-1">
                  <img
                    src={packagePhotoUrl}
                    alt="Package"
                    className="h-8 w-8 rounded-md object-cover border border-border flex-shrink-0"
                  />
                  <span className="text-xs text-muted-foreground">
                    Package photo attached
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between pt-1 border-t border-border mt-1">
                <span className="text-xs text-muted-foreground">Driver</span>
                <span className="text-xs font-semibold">
                  {formData.driverType === "self_driver"
                    ? "Self Driver"
                    : "Company Driver"}
                </span>
              </div>
              {formData.driverType === "self_driver" && (
                <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-1.5">
                  <span className="text-[10px] text-blue-700 font-semibold">
                    Driver may counter-offer before accepting
                  </span>
                </div>
              )}
              {formData.driverType === "self_driver" && calculatedPrice && (
                <div className="bg-muted/40 border border-border rounded-xl px-4 py-3 animate-fade-in">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                    Estimated Price
                  </p>
                  <div className="flex items-end justify-between">
                    <p className="text-2xl font-bold text-primary">
                      ₦{calculatedPrice.price.toLocaleString()}
                    </p>
                    <span className="text-[10px] font-bold bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                      NEGOTIABLE
                    </span>
                  </div>
                </div>
              )}
              {formData.driverType === "company_driver" && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Price</span>
                  <span className="text-xs text-muted-foreground italic">
                    Set by the company that accepts first
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Step 4 (Self Driver only): Choose Driver ── */}
        {step === 4 &&
          formData.driverType === "self_driver" &&
          !preselectedDriver && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block">
                    Nearby Self Drivers
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {loadingDrivers
                      ? "Searching…"
                      : `${nearbyDrivers.length} driver${nearbyDrivers.length !== 1 ? "s" : ""} found within 10km`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={loadNearbyDrivers}
                  disabled={loadingDrivers}
                  className="h-8 w-8 rounded-xl border border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-colors disabled:opacity-50"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${loadingDrivers ? "animate-spin" : ""}`}
                  />
                </button>
              </div>

              {calculatedPrice && (
                <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-xl px-3.5 py-2.5">
                  <div>
                    <span className="text-xs text-muted-foreground">
                      Base price (negotiable)
                    </span>
                    <p className="text-[10px] text-blue-600 font-semibold mt-0.5">
                      Driver may propose a different price
                    </p>
                  </div>
                  <span className="text-sm font-bold text-primary">
                    ₦{calculatedPrice.price.toLocaleString()}
                  </span>
                </div>
              )}

              {/* Broadcast live responses count */}
              {broadcastResponses.length > 0 && (
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
                  <p className="text-xs font-semibold text-green-800">
                    {broadcastResponses.length} driver{broadcastResponses.length !== 1 ? "s" : ""} responded to your request
                  </p>
                </div>
              )}

              {loadingDrivers ? (
                <div className="py-10 flex flex-col items-center gap-3">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Loader2 className="h-6 w-6 text-primary animate-spin" />
                    </div>
                    <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-ping" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Finding drivers near your pickup…
                  </p>
                </div>
              ) : nearbyDrivers.length > 0 ? (
                <div className="space-y-2">
                  {nearbyDrivers.map((driver) => {
                    const resp = broadcastResponses.find((r) => r.driverId === driver.id) ?? null;
                    const driverWithResp: NearbyDriver = { ...driver, broadcastResponse: resp };
                    return (
                      <DriverCard
                        key={driver.id}
                        driver={driverWithResp}
                        selected={selectedDriverId === driver.id}
                        estimatedPrice={calculatedPrice?.price ?? null}
                        onSelect={() => {
                          setSelectedDriverId(driver.id);
                          // Clear any previously accepted counter if switching driver
                          if (acceptedBroadcastOffer?.driverId !== driver.id) {
                            setAcceptedBroadcastOffer(null);
                          }
                        }}
                        onAcceptCounter={(price) => handleAcceptBroadcastCounter(driver.id, price)}
                        onDeclineCounter={() => handleDeclineBroadcastCounter(driver.id)}
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="py-10 text-center">
                  <div className="h-14 w-14 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <User className="h-7 w-7 text-muted-foreground" />
                  </div>
                  <p className="font-semibold text-sm text-muted-foreground">
                    No {vehicleOptions.find((o) => o.type === formData.vehicleType)?.label ?? "matching"} drivers nearby
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Try refreshing or switch to a different vehicle type
                  </p>
                  <button
                    type="button"
                    onClick={loadNearbyDrivers}
                    className="mt-3 text-xs font-semibold text-primary flex items-center gap-1 mx-auto"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Refresh
                  </button>
                </div>
              )}
            </div>
          )}

        {/* Navigation */}
        <div className="flex gap-2.5 mt-6">
          {step > 1 && (
            <Button
              type="button"
              variant="outline"
              onClick={handlePrevStep}
              className="flex-1 rounded-xl h-11"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          )}
          {step < totalSteps ? (
            <Button
              type="button"
              onClick={handleNextStep}
              className="flex-1 rounded-xl h-11"
              disabled={step === 1 && !canProceedStep1}
            >
              Continue <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => handleSubmit()}
              className="flex-1 rounded-xl h-11"
              disabled={
                isLoading ||
                (formData.driverType === "self_driver" &&
                  !selectedDriverId &&
                  !preselectedDriver)
              }
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground animate-spin" />
                  Sending…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  {formData.driverType === "company_driver"
                    ? "Broadcast to Companies"
                    : "Send to Driver"}
                </span>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

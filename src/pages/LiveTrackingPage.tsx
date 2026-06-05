import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, onSnapshot, getDoc } from "firebase/firestore";
import { db } from "@/integrations/firebase/client";
import {
  listenDeliveryRequest,
  listenAssignmentsForRequest,
  type DeliveryRequestDoc,
  type AssignmentDoc,
  type DriverDoc,
} from "@/services/firebase";
import { haversineKm } from "@/lib/haversine";
import { MapView } from "@/components/map/MapView";
import type { MapMarker } from "@/components/map/MapView";
import { Truck, Package, CheckCircle, ArrowLeft } from "lucide-react";

type DeliveryRequest = DeliveryRequestDoc & { id: string };
type Assignment = AssignmentDoc & { id: string };

interface DriverInfo {
  name: string;
  selfieUrl?: string | null;
  vehicleType?: string;
  plateNumber?: string;
}

export default function LiveTrackingPage() {
  const { requestId } = useParams<{ requestId: string }>();
  const navigate = useNavigate();
  const [request, setRequest] = useState<DeliveryRequest | null>(null);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [driverLoc, setDriverLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [driverInfo, setDriverInfo] = useState<DriverInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const driverUnsubRef = useRef<(() => void) | null>(null);
  const fetchedDriverRef = useRef<string | null>(null);

  useEffect(() => {
    if (!requestId) return;
    const unsub = listenDeliveryRequest(requestId, (req) => {
      setRequest(req);
      setLoading(false);
    });
    return () => unsub();
  }, [requestId]);

  useEffect(() => {
    if (!requestId) return;
    const unsub = listenAssignmentsForRequest(requestId, (docs) => {
      const active = docs.find((d) => d.driverAccepted === true) ?? docs[0] ?? null;
      setAssignment(active ?? null);
    });
    return () => unsub();
  }, [requestId]);

  useEffect(() => {
    const driverId = assignment?.driverId;
    if (!driverId || fetchedDriverRef.current === driverId) return;
    fetchedDriverRef.current = driverId;

    Promise.all([
      getDoc(doc(db, "users", driverId)),
      getDoc(doc(db, "drivers", driverId)),
      getDoc(doc(db, "vehicles", driverId)),
    ]).then(([userSnap, driverSnap, vehicleSnap]) => {
      const u = userSnap.exists() ? (userSnap.data() as Record<string, unknown>) : {};
      const d = driverSnap.exists() ? (driverSnap.data() as DriverDoc) : ({} as DriverDoc);
      const v = vehicleSnap.exists() ? (vehicleSnap.data() as Record<string, unknown>) : {};
      setDriverInfo({
        name: [u.firstName, u.lastName].filter(Boolean).join(" ") || "Driver",
        selfieUrl: d.selfieUrl ?? null,
        vehicleType: (v.vehicleType as string | undefined) ?? (d.assignedVehicleBrand as string | undefined),
        plateNumber: v.plateNumber as string | undefined,
      });
    });

    if (driverUnsubRef.current) driverUnsubRef.current();
    const unsub = onSnapshot(doc(db, "drivers", driverId), (snap) => {
      const data = snap.data() as DriverDoc | undefined;
      if (data?.currentLocation?.lat && data?.currentLocation?.lng) {
        setDriverLoc({ lat: data.currentLocation.lat, lng: data.currentLocation.lng });
      }
    });
    driverUnsubRef.current = unsub;

    return () => {
      if (driverUnsubRef.current) {
        driverUnsubRef.current();
        driverUnsubRef.current = null;
      }
    };
  }, [assignment?.driverId]);

  const dropoff = request?.dropoff;
  const pickup = request?.pickup;

  const distKm = driverLoc && dropoff
    ? haversineKm(driverLoc.lat, driverLoc.lng, dropoff.lat, dropoff.lng)
    : null;
  const etaMinutes = distKm !== null ? Math.max(1, Math.round((distKm / 30) * 60)) : null;

  const markers: MapMarker[] = [];
  if (driverLoc) {
    markers.push({
      id: "driver",
      latitude: driverLoc.lat,
      longitude: driverLoc.lng,
      type: "driver",
      label: driverInfo?.name ?? "Driver",
    });
  }
  if (dropoff?.lat && dropoff?.lng) {
    markers.push({
      id: "dropoff",
      latitude: dropoff.lat,
      longitude: dropoff.lng,
      type: "dropoff",
      label: "Destination",
    });
  }

  const isCompleted = request?.status === "completed";
  const isActive = request &&
    ["in_progress", "arrived", "awaiting_signature"].includes(request.status);

  const initials = driverInfo
    ? driverInfo.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "";

  // ── Loading ───────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ background: "#0d1f13" }}>
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#4db464]" />
          <p className="text-[#4db464] text-sm font-medium tracking-wide">Loading tracking…</p>
        </div>
      </div>
    );
  }

  // ── Not found ─────────────────────────────────────────────────────────────────
  if (!request) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3 px-8">
          <Package className="h-12 w-12 text-muted-foreground mx-auto" />
          <p className="font-bold text-foreground">Delivery not found</p>
          <p className="text-sm text-muted-foreground">
            This tracking link may have expired or the delivery doesn't exist.
          </p>
        </div>
      </div>
    );
  }

  // ── Main layout ───────────────────────────────────────────────────────────────
  return (
    // h-screen + overflow-hidden gives flex-1 a bounded height so the map fills correctly
    <div className="h-screen overflow-hidden flex flex-col bg-background">

      {/* ── Header ── */}
      <div
        className="flex-shrink-0 flex items-center gap-2 px-4 pb-3 bg-card border-b border-border"
        style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top, 0px))" }}
      >
        {/* Back button */}
        <button
          onClick={() => {
            if (window.history.length > 1) {
              navigate(-1);
            } else {
              navigate("/customer");
            }
          }}
          aria-label="Back"
          className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted active:scale-95 transition-all flex-shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        {/* Truck icon */}
        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Truck className="h-4 w-4 text-primary" />
        </div>

        {/* Delivery info */}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-foreground leading-tight">Pilnak Live Tracking</p>
          <p className="text-[11px] text-muted-foreground leading-tight">
            Delivery #{requestId?.slice(0, 8).toUpperCase()}
          </p>
        </div>

        {/* Status badge */}
        <div className="flex-shrink-0">
          {isCompleted ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full">
              <CheckCircle className="h-3 w-3" />
              Delivered
            </span>
          ) : isActive ? (
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse flex-shrink-0" />
              Live
            </span>
          ) : (
            <span className="inline-flex items-center text-[10px] font-medium bg-muted text-muted-foreground px-2.5 py-1 rounded-full capitalize">
              {request.status.replace(/_/g, " ")}
            </span>
          )}
        </div>
      </div>

      {/* ── Map — flex-1 + min-h-0 lets it expand to fill the bounded h-screen ── */}
      <div className="flex-1 min-h-0 relative">
        <MapView
          markers={markers}
          center={
            driverLoc
              ? [driverLoc.lat, driverLoc.lng]
              : dropoff?.lat && dropoff?.lng
              ? [dropoff.lat, dropoff.lng]
              : undefined
          }
          zoom={14}
          routeFrom={driverLoc && !isCompleted ? [driverLoc.lat, driverLoc.lng] : undefined}
          routeTo={dropoff?.lat && dropoff?.lng ? [dropoff.lat, dropoff.lng] : undefined}
          className="w-full h-full"
          hideExternalLink
        />
        {/* Driver live badge */}
        {driverLoc && !isCompleted && (
          <div className="absolute bottom-3 left-3 z-[1000] bg-black/60 text-white text-[10px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5 backdrop-blur-sm pointer-events-none">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Driver live
          </div>
        )}
        {isCompleted && (
          <div className="absolute bottom-3 left-3 z-[1000] bg-black/60 text-white text-[10px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5 backdrop-blur-sm pointer-events-none">
            <CheckCircle className="h-3 w-3 text-emerald-400" />
            Delivered
          </div>
        )}
      </div>

      {/* ── Bottom info card ── */}
      <div className="flex-shrink-0 bg-card border-t border-border">
        <div className="px-4 pt-4 pb-6 space-y-3 max-w-lg mx-auto">

          {/* Driver row + ETA */}
          <div className="flex items-center gap-3">
            {/* Avatar */}
            <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center overflow-hidden relative flex-shrink-0">
              <span className="text-sm font-bold text-primary">{initials}</span>
              {driverInfo?.selfieUrl && (
                <img
                  src={driverInfo.selfieUrl}
                  alt={driverInfo?.name}
                  className="absolute inset-0 w-full h-full object-cover"
                  onError={(e) => { e.currentTarget.style.display = "none"; }}
                />
              )}
            </div>
            {/* Name + vehicle */}
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm text-foreground truncate">
                {driverInfo?.name ?? "Fetching driver…"}
              </p>
              <p className="text-xs text-muted-foreground truncate capitalize">
                {driverInfo?.vehicleType?.replace(/_/g, " ") ?? "Driver"}
                {driverInfo?.plateNumber ? ` · ${driverInfo.plateNumber}` : ""}
              </p>
            </div>
            {/* ETA / Delivered */}
            {isCompleted ? (
              <div className="flex items-center gap-1.5 text-emerald-600 flex-shrink-0">
                <CheckCircle className="h-5 w-5" />
                <span className="text-sm font-bold">Done</span>
              </div>
            ) : etaMinutes !== null ? (
              <div className="text-right flex-shrink-0">
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide leading-tight">ETA</p>
                <p className="font-bold text-xl text-primary leading-tight">{etaMinutes} min</p>
              </div>
            ) : null}
          </div>

          {/* Divider */}
          <div className="h-px bg-border" />

          {/* Addresses */}
          <div className="space-y-2">
            <div className="flex items-start gap-2.5">
              <div className="w-2 h-2 rounded-full bg-primary mt-[5px] flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide leading-tight">Pickup</p>
                <p className="text-xs text-foreground leading-snug">{pickup?.address ?? "—"}</p>
              </div>
            </div>
            <div className="ml-[3px] w-px h-3 bg-border" />
            <div className="flex items-start gap-2.5">
              <div className="w-2 h-2 rounded-full bg-destructive mt-[5px] flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide leading-tight">Drop-off</p>
                <p className="text-xs text-foreground leading-snug">{dropoff?.address ?? "—"}</p>
              </div>
            </div>
          </div>

          <p className="text-center text-[10px] text-muted-foreground/40 pt-1">
            Powered by Pilnak · Real-time delivery tracking
          </p>
        </div>
      </div>
    </div>
  );
}

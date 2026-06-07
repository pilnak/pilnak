import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { MapView } from "@/components/map/MapView";
import { LocationPermissionModal } from "@/components/map/LocationPermissionModal";
import { CameraCapture } from "@/components/camera/CameraCapture";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { addDoc, collection, doc, getDoc, getDocs, onSnapshot, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { db } from "@/integrations/firebase/client";
import { shortDeliveryName } from "@/lib/deliveryName";
import { Logo } from "@/components/Logo";

import {
  listenAssignmentsForDriver,
  setDriverAccepted,
  updateDriverLocation,
  markDriverArrived,
  markAssignmentStarted,
  completeDeliveryWithProof,
  updateDeliveryStatus,
  listenActiveBroadcasts,
  respondToBroadcast,
  dismissBroadcastResponse,
  haversineKm,
  listenDriverNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  cancelDeliveryByDriver,
  getUserCancellationCount,
  type AssignmentDoc,
  type AdminNotificationDoc,
  type UserNotificationDoc,
  type DeliveryRequestDoc,
  type DeliveryBroadcastDoc,
  type BroadcastResponseDoc,
  type DriverDoc,
  type UserDoc,
} from "@/services/firebase";
import {
  MapPin,
  Package,
  Wallet,
  User,
  LogOut,
  Power,
  Navigation,
  CheckCircle,
  X,
  Phone,
  Camera,
  Truck,
  Star,
  AlertCircle,
  History,
  Clock,
  ExternalLink,
  TrendingUp,
  Award,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  Zap,
  Bell,
  MessageSquare,
  MessageCircle,
  ShieldCheck,
  PhoneCall,
  ArrowRight,
  Search,
  BarChart3,
  ThumbsUp,
  MessageSquareDashed,
  Radio,
  DollarSign,
  PenLine,
} from "lucide-react";
import { useSessionState } from "@/hooks/useSessionState";

const LOC_KEY = "pilnak_loc_perm";
type TabType = "home" | "jobs" | "earnings" | "history" | "reviews" | "profile";

interface EnrichedAssignment extends AssignmentDoc {
  id: string;
  request: (DeliveryRequestDoc & { id: string }) | null;
  customer: (UserDoc & { id: string }) | null;
}
interface AppNotif {
  id: string;
  kind: "order" | "system" | "alert" | "message";
  title: string;
  body: string;
  at: Date;
  read: boolean;
}
interface ChatJob {
  requestId: string;
  customerId: string;
  customerName: string;
}

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

async function uploadProofPhoto(dataUrl: string): Promise<string> {
  const fd = new FormData();
  fd.append("file", dataUrl);
  fd.append("upload_preset", UPLOAD_PRESET);
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    { method: "POST", body: fd },
  );
  if (!res.ok) throw new Error("Upload failed");
  return ((await res.json()) as { secure_url: string }).secure_url;
}

function timeAgo(d: Date): string {
  const s = (Date.now() - d.getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return d.toLocaleDateString("en-NG", { day: "numeric", month: "short" });
}
function isSelf(req: any) {
  return req?.driverType === "self_driver";
}
function getJobPrice(req: any): number {
  return Number(
    (req as any)?.finalPrice ??
      (req as any)?.quotedPrice ??
      (req as any)?.estimatedPrice ??
      0,
  );
}

// ─── Small shared components ───────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    in_progress: "bg-violet-100 text-violet-700",
    arrived: "bg-green-100 text-green-700",
    completed: "bg-green-100 text-green-700",
    driver_accepted: "bg-blue-100 text-blue-700",
    driver_assigned: "bg-amber-100 text-amber-700",
    customer_confirmed: "bg-sky-100 text-sky-700",
    pending: "bg-amber-100 text-amber-700",
    negotiating_price: "bg-blue-100 text-blue-700",
  };
  const labels: Record<string, string> = {
    in_progress: "In Progress",
    arrived: "Arrived",
    completed: "Delivered",
    driver_accepted: "Accepted",
    driver_assigned: "Pending",
    customer_confirmed: "Confirmed",
    pending: "Pending",
    negotiating_price: "Negotiating",
  };
  return (
    <span
      className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${map[status] ?? "bg-gray-100 text-gray-500"}`}
    >
      {labels[status] ?? status.replace(/_/g, " ")}
    </span>
  );
}

function RouteTimeline({
  pickup,
  dropoff,
}: {
  pickup?: string;
  dropoff?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex flex-col items-center flex-shrink-0 mt-[3px]">
        <div className="w-2.5 h-2.5 rounded-full bg-[#028538] ring-[3px] ring-[#028538]/15" />
        <div className="w-px h-7 bg-gradient-to-b from-[#028538]/30 to-red-400/30 my-0.5" />
        <div className="w-2.5 h-2.5 rounded-full bg-red-500 ring-[3px] ring-red-400/15" />
      </div>
      <div className="flex-1 min-w-0 space-y-2">
        <div>
          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
            Pickup
          </p>
          <p className="text-sm font-semibold text-gray-800 leading-tight">
            {pickup ?? "—"}
          </p>
        </div>
        <div>
          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
            Drop-off
          </p>
          <p className="text-sm font-semibold text-gray-800 leading-tight">
            {dropoff ?? "—"}
          </p>
        </div>
      </div>
    </div>
  );
}

function StarRow({
  rating,
  size = "sm",
}: {
  rating: number;
  size?: "sm" | "md" | "lg";
}) {
  const sz =
    size === "lg" ? "w-5 h-5" : size === "md" ? "w-4 h-4" : "w-3.5 h-3.5";
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`${sz} ${s <= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-200"}`}
        />
      ))}
    </div>
  );
}

function PackagePhoto({ url }: { url: string }) {
  return (
    <div className="rounded-xl overflow-hidden border border-gray-100">
      <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-100 flex items-center gap-1.5">
        <Camera className="w-3 h-3 text-gray-400" />
        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
          Package Photo
        </p>
      </div>
      <img src={url} alt="Package" className="w-full h-40 object-cover" />
    </div>
  );
}

function BroadcastCard({
  broadcast,
  myResponse,
  onRespond,
  onAcceptSelected,
  onDeclineSelected,
}: {
  broadcast: DeliveryBroadcastDoc & { id: string };
  myResponse: BroadcastResponseDoc | null;
  onRespond: (responseType: "interested" | "counter_offer", price?: number) => void;
  onAcceptSelected: () => void;
  onDeclineSelected: () => void;
}) {
  const [showCounter, setShowCounter] = useState(false);
  const [counterVal, setCounterVal] = useState(
    broadcast.estimatedPrice ? String(broadcast.estimatedPrice) : ""
  );
  const [loadingAction, setLoadingAction] = useState<'interested' | 'counter' | 'accept' | 'decline' | null>(null);

  const isSelected = myResponse?.status === "selected";
  const alreadyResponded = !!myResponse && myResponse.status === "pending";
  const isCounter = myResponse?.responseType === "counter_offer";
  const counterAccepted = isSelected && isCounter;
  const displayPrice = counterAccepted && myResponse?.counterOfferPrice
    ? myResponse.counterOfferPrice
    : broadcast.estimatedPrice;

  return (
    <div className="bg-white rounded-2xl border border-indigo-200 overflow-hidden shadow-sm">
      <div className="bg-indigo-600 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio className="w-3.5 h-3.5 text-white animate-pulse" />
          <p className="text-xs font-bold text-white">Open Request</p>
        </div>
        <span className="text-[9px] font-bold bg-white text-indigo-600 px-2 py-0.5 rounded-full uppercase">
          {broadcast.transportType?.replace(/_/g, " ")}
        </span>
      </div>
      <div className="p-4 space-y-3">
        {/* Route */}
        <div className="space-y-1.5">
          <div className="flex items-start gap-2">
            <div className="w-2 h-2 rounded-full bg-[#028538] flex-shrink-0 mt-1" />
            <p className="text-sm text-gray-700 leading-tight">{broadcast.pickup.address}</p>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0 mt-1" />
            <p className="text-sm text-gray-700 leading-tight">{broadcast.dropoff.address}</p>
          </div>
        </div>

        {/* Price + distance */}
        <div className="flex items-center justify-between bg-green-50 rounded-xl px-3.5 py-2.5 border border-green-100">
          <div>
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
              {counterAccepted ? "Counter Price" : broadcast.allowNegotiation ? "Base Price (negotiable)" : "Fixed Price"}
            </p>
            <p className="text-lg font-bold text-[#028538]">
              ₦{displayPrice.toLocaleString()}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Distance</p>
            <p className="text-sm font-bold text-gray-700">
              {broadcast.distanceKm.toFixed(1)} km
            </p>
          </div>
        </div>

        {broadcast.packagePhotoUrl && (
          <PackagePhoto url={broadcast.packagePhotoUrl} />
        )}

        {/* State: customer selected this driver */}
        {isSelected ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2.5">
              <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
              <div>
                <p className="text-xs font-bold text-green-700">
                  {counterAccepted ? "Customer accepted your counter price" : "Customer Selected You!"}
                </p>
                <p className="text-[10px] text-green-600">Accept to start the delivery</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={async () => { setLoadingAction('decline'); try { await onDeclineSelected(); } finally { setLoadingAction(null); } }}
                disabled={!!loadingAction}
                className="flex-1 flex items-center justify-center gap-1.5 bg-red-50 border border-red-100 text-red-500 text-sm font-bold py-3 rounded-xl disabled:opacity-60"
              >
                {loadingAction === 'decline' ? (
                  <><div className="h-3.5 w-3.5 rounded-full border-2 border-red-400 border-t-transparent animate-spin flex-shrink-0" />Declining…</>
                ) : (
                  <><X className="w-4 h-4" />Decline</>
                )}
              </button>
              <button
                onClick={async () => { setLoadingAction('accept'); try { await onAcceptSelected(); } finally { setLoadingAction(null); } }}
                disabled={!!loadingAction}
                className="flex-1 flex items-center justify-center gap-1.5 bg-[#028538] text-white text-sm font-bold py-3 rounded-xl shadow-sm shadow-[#028538]/15 disabled:opacity-60"
              >
                {loadingAction === 'accept' ? (
                  <><div className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin flex-shrink-0" />Accepting…</>
                ) : (
                  <><CheckCircle className="w-4 h-4" />Accept Job</>
                )}
              </button>
            </div>
          </div>
        ) : alreadyResponded ? (
          /* Responded but not yet selected */
          <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2.5">
            <CheckCircle className="w-4 h-4 text-indigo-500 flex-shrink-0" />
            <p className="text-xs font-semibold text-indigo-700">
              {isCounter
                ? `Counter ₦${myResponse!.counterOfferPrice?.toLocaleString()} sent — waiting for customer`
                : "Interest sent — waiting for customer to select you"}
            </p>
          </div>
        ) : showCounter ? (
          /* Counter offer input */
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-2">
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
              Counter Offer
            </p>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-gray-400">₦</span>
              <input
                type="number"
                value={counterVal}
                onChange={(e) => setCounterVal(e.target.value)}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-base font-bold focus:outline-none focus:ring-2 focus:ring-indigo-300"
                placeholder="Enter amount"
                min={0}
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowCounter(false)}
                className="flex-1 text-xs font-bold py-2 rounded-lg border border-gray-200 text-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const n = Number(counterVal);
                  if (n > 0) {
                    setLoadingAction('counter');
                    try { await onRespond("counter_offer", n); setShowCounter(false); } finally { setLoadingAction(null); }
                  }
                }}
                disabled={!!loadingAction}
                className="flex-1 flex items-center justify-center gap-1.5 text-xs font-bold py-2 rounded-lg bg-indigo-600 text-white disabled:opacity-60"
              >
                {loadingAction === 'counter' ? (
                  <><div className="h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin flex-shrink-0" />Sending…</>
                ) : "Send Counter"}
              </button>
            </div>
          </div>
        ) : (
          /* Action buttons */
          <div className="flex gap-2">
            <button
              onClick={async () => { setLoadingAction('interested'); try { await onRespond("interested"); } finally { setLoadingAction(null); } }}
              disabled={!!loadingAction}
              className="flex-1 flex items-center justify-center gap-1.5 bg-[#028538] text-white text-sm font-bold py-3 rounded-xl shadow-sm shadow-[#028538]/15 disabled:opacity-60"
            >
              {loadingAction === 'interested' ? (
                <><div className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin flex-shrink-0" />Sending…</>
              ) : (
                <><Zap className="w-4 h-4" />I'm Interested</>
              )}
            </button>
            {broadcast.allowNegotiation && (
              <button
                onClick={() => setShowCounter(true)}
                disabled={!!loadingAction}
                className="flex items-center justify-center gap-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 text-sm font-bold py-3 px-3 rounded-xl disabled:opacity-60"
              >
                <DollarSign className="w-4 h-4" />
                Counter
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SelfDriverOfferCard({
  a,
  onAccept,
  onDecline,
  onCounterOffer,
}: {
  a: EnrichedAssignment;
  onAccept: () => void;
  onDecline: () => void;
  onCounterOffer: (p: number) => void;
}) {
  const req = a.request;
  const price = (req as any)?.estimatedPrice ?? (req as any)?.quotedPrice;
  const distKm = (req as any)?.distanceKm;
  const allowNeg = !!(req as any)?.allowNegotiation;
  const counterOfferAccepted = !!(req as any)?.counterOfferAccepted;
  const [showCounter, setShowCounter] = useState(false);
  const [counterVal, setCounterVal] = useState(price ? String(price) : "");
  const [loadingAction, setLoadingAction] = useState<'accept' | 'decline' | 'counter' | null>(null);
  return (
    <div className="bg-white rounded-2xl border-2 border-[#028538] overflow-hidden shadow-sm">
      <div className="bg-[#028538] px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-white" />
          <p className="text-xs font-bold text-white">
            {counterOfferAccepted ? "Counter Accepted!" : "Customer Chose You!"}
          </p>
        </div>
        <span className="text-[9px] font-bold bg-white text-[#028538] px-2 py-0.5 rounded-full">
          {counterOfferAccepted ? "COUNTER" : allowNeg ? "NEGOTIABLE" : "FIXED"}
        </span>
      </div>
      <div className="p-4 space-y-3">
        <RouteTimeline
          pickup={req?.pickup?.address}
          dropoff={req?.dropoff?.address}
        />
        {req?.packagePhotoUrl && <PackagePhoto url={req.packagePhotoUrl} />}
        {price && (
          <div className="flex items-center justify-between bg-green-50 rounded-xl px-3.5 py-2.5 border border-green-100">
            <div>
              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                {counterOfferAccepted ? "Counter Price" : allowNeg ? "Base Price" : "Fixed Price"}
              </p>
              <p className="text-lg font-bold text-[#028538]">
                ₦{Number(price).toLocaleString()}
              </p>
            </div>
            {distKm && (
              <div className="text-right">
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                  Distance
                </p>
                <p className="text-sm font-bold text-gray-700">
                  {Number(distKm).toFixed(1)} km
                </p>
              </div>
            )}
          </div>
        )}
        {counterOfferAccepted && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2.5">
            <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
            <p className="text-xs text-green-700 font-semibold">
              Customer accepted your counter price
            </p>
          </div>
        )}
        {allowNeg && !counterOfferAccepted && (
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2">
            <PhoneCall className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
            <p className="text-xs text-blue-600 font-semibold">
              Counter-offers allowed
            </p>
          </div>
        )}
        {a.customer && (
          <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
              Customer
            </p>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                <span className="text-sm font-bold text-[#028538]">
                  {a.customer.firstName.charAt(0)}
                </span>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-800">
                  {a.customer.firstName} {a.customer.lastName}
                </p>
                {a.customer.phone && (
                  <a
                    href={`tel:${a.customer.phone}`}
                    className="flex items-center gap-1 text-xs text-[#028538] font-semibold"
                  >
                    <Phone className="w-3 h-3" />
                    {a.customer.phone}
                  </a>
                )}
              </div>
            </div>
          </div>
        )}
        {allowNeg && showCounter && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-2">
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
              Counter Offer
            </p>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-gray-400">₦</span>
              <input
                type="number"
                value={counterVal}
                onChange={(e) => setCounterVal(e.target.value)}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-base font-bold focus:outline-none focus:ring-2 focus:ring-[#028538]/20"
                placeholder="Enter amount"
                min={0}
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowCounter(false)}
                className="flex-1 text-xs font-bold py-2 rounded-lg border border-gray-200 text-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const n = Number(counterVal);
                  if (n > 0) {
                    setLoadingAction('counter');
                    try { await onCounterOffer(n); setShowCounter(false); } finally { setLoadingAction(null); }
                  }
                }}
                disabled={!!loadingAction}
                className="flex-1 flex items-center justify-center gap-1.5 text-xs font-bold py-2 rounded-lg bg-[#028538] text-white disabled:opacity-60"
              >
                {loadingAction === 'counter' ? (
                  <><div className="h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin flex-shrink-0" />Sending…</>
                ) : "Send"}
              </button>
            </div>
          </div>
        )}
        <div className="flex gap-2 pt-1">
          <button
            onClick={async () => { setLoadingAction('decline'); try { await onDecline(); } finally { setLoadingAction(null); } }}
            disabled={!!loadingAction}
            className="flex-1 flex items-center justify-center gap-1.5 bg-red-50 border border-red-100 text-red-500 text-sm font-bold py-3 rounded-xl disabled:opacity-60"
          >
            {loadingAction === 'decline' ? (
              <><div className="h-3.5 w-3.5 rounded-full border-2 border-red-400 border-t-transparent animate-spin flex-shrink-0" />Declining…</>
            ) : (
              <><X className="w-4 h-4" />Decline</>
            )}
          </button>
          {allowNeg && !showCounter && (
            <button
              onClick={() => setShowCounter(true)}
              disabled={!!loadingAction}
              className="flex-1 flex items-center justify-center gap-1.5 bg-blue-50 border border-blue-100 text-blue-600 text-sm font-bold py-3 rounded-xl disabled:opacity-60"
            >
              <PhoneCall className="w-4 h-4" />
              Counter
            </button>
          )}
          <button
            onClick={async () => { setLoadingAction('accept'); try { await onAccept(); } finally { setLoadingAction(null); } }}
            disabled={!!loadingAction}
            className="flex-1 flex items-center justify-center gap-1.5 bg-[#028538] text-white text-sm font-bold py-3 rounded-xl shadow-md shadow-[#028538]/20 disabled:opacity-60"
          >
            {loadingAction === 'accept' ? (
              <><div className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin flex-shrink-0" />Accepting…</>
            ) : (
              <><CheckCircle className="w-4 h-4" />Accept</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function DriverDashboard() {
  const navigate = useNavigate();
  const { user, role, signOut, isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useSessionState<TabType>(
    "driver_activeTab",
    "home",
  );
  const [driver, setDriver] = useState<(DriverDoc & { id: string }) | null>(
    null,
  );
  const [rawAssignments, setRaw] = useState<
    Array<AssignmentDoc & { id: string }>
  >([]);
  const [enriched, setEnriched] = useState<EnrichedAssignment[]>([]);
  const [activeJobId, setActiveJobId] = useSessionState<string | null>(
    "driver_activeJobId",
    null,
  );
  // Controls which delivery is open in the full-screen tracking view on the Jobs tab
  const [trackingJobId, setTrackingJobId] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [pendingProof, setPendingProof] = useState<EnrichedAssignment | null>(
    null,
  );
  const [uploading, setUploading] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<EnrichedAssignment | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [driverCancelReason, setDriverCancelReason] = useState("");
  const [driverCancelCount, setDriverCancelCount] = useState(0);
  const [loadingByJob, setLoadingByJob] = useState<Record<string, string | null>>({});
  // requestIds of customer-cancelled jobs shown briefly before disappearing
  const [briefCancelledShows, setBriefCancelledShows] = useState<Set<string>>(new Set());
  const autoRemoveTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  // Tracks the last-seen status per requestId across effect re-runs
  const lastKnownStatusRef = useRef<Map<string, string>>(new Map());
  const [chatJob, setChatJob] = useSessionState<ChatJob | null>("driver_chatJob", null);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [showLocModal, setShowLocModal] = useState(false);
  const locChecked = useRef(false);
  const knownDriverNotifIds = useRef<Set<string> | null>(null);
  const mobileMainRef = useRef<HTMLElement>(null);

  // Fix #4: clear all brief-cancel timers when the component unmounts to prevent
  // stale setState calls and memory leaks.
  useEffect(() => {
    return () => {
      autoRemoveTimersRef.current.forEach(t => clearTimeout(t));
      autoRemoveTimersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
    mobileMainRef.current?.scrollTo(0, 0);
  }, [activeTab]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState<AppNotif[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [driverDocId, setDriverDocId] = useState<string | null>(null);
  const [isSuspended, setIsSuspended] = useState(false);
  const [driverVehicleType, setDriverVehicleType] = useState<string | null>(null);
  const [broadcasts, setBroadcasts] = useState<Array<DeliveryBroadcastDoc & { id: string }>>([]);
  // Track which broadcasts this driver already responded to: broadcastId → response
  const [broadcastResponded, setBroadcastResponded] = useState<Record<string, BroadcastResponseDoc>>({});

  const {
    latitude,
    longitude,
    isPermissionGranted,
    requestPermission,
    startWatching,
    stopWatching,
    isWatching,
  } = useGeolocation({ saveToDatabase: true, updateInterval: 5000 });

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/auth?role=driver");
      return;
    }
    if (role && role !== "driver") navigate("/");
  }, [authLoading, user, role, navigate]);

  useEffect(() => {
    if (authLoading || !user || locChecked.current) return;
    locChecked.current = true;
    const stored = localStorage.getItem(LOC_KEY);
    if (stored === "granted") {
      requestPermission().then((ok) => {
        if (ok) startWatching();
      });
      return;
    }
    if (stored === "denied") return;
    if (navigator?.permissions) {
      navigator.permissions.query({ name: "geolocation" }).then((result) => {
        if (result.state === "granted") {
          localStorage.setItem(LOC_KEY, "granted");
          startWatching();
        } else if (result.state === "denied") {
          localStorage.setItem(LOC_KEY, "denied");
        } else {
          setShowLocModal(true);
        }
      });
    } else if (isPermissionGranted === null) {
      setShowLocModal(true);
    }
  }, [authLoading, user]); // eslint-disable-line

  useEffect(() => {
    if (!user?.uid) {
      setDriverDocId(null);
      return;
    }

    let unsub: (() => void) | undefined;

    (async () => {
      const userSnap = await getDoc(doc(db, "users", user.uid));
      const userData = userSnap.data() as
        | { companyDriverId?: string; role?: string }
        | undefined;
      const resolvedDriverDocId = userData?.companyDriverId ?? user.uid;
      setDriverDocId(resolvedDriverDocId);

      unsub = onSnapshot(doc(db, "drivers", resolvedDriverDocId), (snap) => {
        if (!snap.exists()) {
          navigate("/driver-registration");
          return;
        }
        const driverData = snap.data() as DriverDoc;
        // Redirect self-registered drivers who are not yet approved
        if (driverData.status !== "approved" && resolvedDriverDocId === user.uid) {
          navigate("/driver-pending", { replace: true });
          return;
        }
        // Block company drivers who have been suspended by their company
        if (driverData.status === "suspended" && resolvedDriverDocId !== user.uid) {
          setIsSuspended(true);
          setDriver({ id: snap.id, ...driverData });
          return;
        }
        setIsSuspended(false);
        setDriver({ id: snap.id, ...driverData });
      });
    })();

    return () => unsub?.();
  }, [user?.uid, navigate]);

  useEffect(() => {
    if (!driverDocId) return;

    if (!user?.uid || driverDocId === user.uid) {
      return listenAssignmentsForDriver(driverDocId, setRaw);
    }

    let byDriverDoc: Array<AssignmentDoc & { id: string }> = [];
    let byAuthUid: Array<AssignmentDoc & { id: string }> = [];
    const mergeAndSet = () => {
      const merged = new Map<string, AssignmentDoc & { id: string }>();
      [...byDriverDoc, ...byAuthUid].forEach((item) =>
        merged.set(item.id, item),
      );
      setRaw(Array.from(merged.values()));
    };

    const unsubDoc = listenAssignmentsForDriver(driverDocId, (docs) => {
      byDriverDoc = docs;
      mergeAndSet();
    });
    const unsubUid = listenAssignmentsForDriver(user.uid, (docs) => {
      byAuthUid = docs;
      mergeAndSet();
    });

    return () => {
      unsubDoc();
      unsubUid();
    };
  }, [driverDocId, user?.uid]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const list = await Promise.all(
        rawAssignments.map(async (a) => {
          const rs = await getDoc(doc(db, "delivery_requests", a.requestId));
          const request = rs.exists()
            ? { id: rs.id, ...(rs.data() as DeliveryRequestDoc) }
            : null;
          let customer: (UserDoc & { id: string }) | null = null;
          if (request?.customerId) {
            const cs = await getDoc(doc(db, "users", request.customerId));
            if (cs.exists())
              customer = { id: cs.id, ...(cs.data() as UserDoc) };
          }
          return { ...a, request, customer } as EnrichedAssignment;
        }),
      );
      if (!cancelled) setEnriched(list);
    })();
    return () => {
      cancelled = true;
    };
  }, [rawAssignments]);

  // Subscribe to delivery request docs for accepted jobs so the driver's UI
  // reacts immediately when the customer cancels (request doc changes, not assignment doc).
  useEffect(() => {
    const accepted = rawAssignments.filter(a => a.driverAccepted === true && !a.completedAt);
    if (!accepted.length) return;
    const unsubs = accepted.map(a =>
      onSnapshot(doc(db, "delivery_requests", a.requestId), snap => {
        if (!snap.exists()) return;
        const data = snap.data() as Record<string, unknown>;
        const newStatus = data.status as string;

        // Record the previous status BEFORE updating the map
        const prevStatus = lastKnownStatusRef.current.get(a.requestId);
        lastKnownStatusRef.current.set(a.requestId, newStatus);

        setEnriched(prev => prev.map(e =>
          e.requestId === a.requestId && e.request
            ? { ...e, request: { ...e.request, ...(data as any) } }
            : e,
        ));

        // Only trigger the brief "Cancelled" show when the status actively
        // transitions to cancelled (prevStatus was a live status).
        // If prevStatus is undefined (first snapshot for this subscription run)
        // or was already "cancelled", the request was already cancelled before
        // the driver saw it — skip the brief show to avoid ghost cards.
        const justTransitioned =
          newStatus === "cancelled" &&
          data.cancelledBy === "customer" &&
          prevStatus !== undefined &&
          prevStatus !== "cancelled";

        if (justTransitioned && !autoRemoveTimersRef.current.has(a.requestId)) {
          setBriefCancelledShows(prev => new Set(prev).add(a.requestId));
          const t = setTimeout(() => {
            setBriefCancelledShows(prev => {
              const next = new Set(prev);
              next.delete(a.requestId);
              return next;
            });
            autoRemoveTimersRef.current.delete(a.requestId);
          }, 3000);
          autoRemoveTimersRef.current.set(a.requestId, t);
        }
      }),
    );
    return () => { unsubs.forEach(u => u()); };
  }, [rawAssignments]);

  // Track the last position that was written to Firestore so we can apply a
  // 50 m / 30 s threshold and avoid burning Spark quota on every GPS tick.
  const lastLocationWriteRef = useRef<{
    lat: number;
    lng: number;
    time: number;
  } | null>(null);

  useEffect(() => {
    if (!driverDocId || !driver?.isOnline || !isWatching || !latitude || !longitude) return;

    const now = Date.now();
    const last = lastLocationWriteRef.current;
    if (last) {
      const movedMeters = haversineKm(last.lat, last.lng, latitude, longitude) * 1000;
      const elapsedMs = now - last.time;
      if (movedMeters < 50 && elapsedMs < 30_000) return;
    }

    lastLocationWriteRef.current = { lat: latitude, lng: longitude, time: now };
    void updateDriverLocation(driverDocId, latitude, longitude);
  }, [driverDocId, driver?.isOnline, isWatching, latitude, longitude]);

  // Fetch driver's vehicle type once driverDocId is known
  useEffect(() => {
    if (!driverDocId) return;
    getDoc(doc(db, "vehicles", driverDocId))
      .then(async (snap) => {
        if (snap.exists()) {
          setDriverVehicleType((snap.data() as any).vehicleType ?? null);
        } else {
          // Fallback: query vehicles collection by driverId field
          const q = query(collection(db, "vehicles"), where("driverId", "==", driverDocId));
          const results = await getDocs(q);
          if (!results.empty) {
            setDriverVehicleType((results.docs[0].data() as any).vehicleType ?? null);
          }
        }
      })
      .catch(() => {});
  }, [driverDocId]);

  // Listen to active broadcasts for self-drivers (filter by vehicle type + proximity)
  useEffect(() => {
    if (!driver?.isOnline || driver?.isCompanyDriver || !driverVehicleType) return;
    const unsub = listenActiveBroadcasts((all) => {
      const driverLat = latitude ?? 0;
      const driverLng = longitude ?? 0;
      const nearby = all.filter((b) => {
        if (b.transportType !== driverVehicleType) return false;
        if (!b.pickup?.lat || !b.pickup?.lng) return false;
        const dist = haversineKm(driverLat, driverLng, b.pickup.lat, b.pickup.lng);
        return dist <= 10;
      });
      // Deduplicate by customerId — keep only the newest broadcast per customer.
      // Stale duplicates (from dropped expiry writes on page unload) can linger in
      // Firestore until their TTL passes; showing them would confuse drivers.
      const deduped = nearby
        .sort((a, b) => {
          const ta = (a.createdAt as any)?.toDate?.()?.getTime?.() ?? 0;
          const tb = (b.createdAt as any)?.toDate?.()?.getTime?.() ?? 0;
          return tb - ta; // newest first
        })
        .filter((b, _i, arr) => arr.findIndex((x) => x.customerId === b.customerId) === _i);
      setBroadcasts(deduped);
    });
    return () => {
      unsub();
      setBroadcasts([]);
    };
  }, [driver?.isOnline, driver?.isCompanyDriver, driverVehicleType, latitude, longitude]);

  // Listen to this driver's response doc for each active broadcast (real-time selected/pending state)
  useEffect(() => {
    if (!driverDocId) return;

    if (broadcasts.length === 0) {
      setBroadcastResponded({});
      return;
    }

    // Drop stale entries for broadcasts that are no longer active — if we don't do this,
    // an expired broadcast's "selected" entry would keep the assignment hidden from selfPending
    // with no BroadcastCard visible, leaving the driver unable to accept or decline.
    const activeIds = new Set(broadcasts.map((b) => b.id));
    setBroadcastResponded((prev) => {
      const pruned = Object.fromEntries(
        Object.entries(prev).filter(([k]) => activeIds.has(k))
      );
      return Object.keys(pruned).length === Object.keys(prev).length ? prev : pruned;
    });

    const unsubs = broadcasts.map((broadcast) => {
      const ref = doc(db, "delivery_broadcasts", broadcast.id, "responses", driverDocId);
      return onSnapshot(ref, (snap) => {
        setBroadcastResponded((prev) =>
          snap.exists()
            ? { ...prev, [broadcast.id]: snap.data() as BroadcastResponseDoc }
            : Object.fromEntries(Object.entries(prev).filter(([k]) => k !== broadcast.id))
        );
      });
    });

    return () => unsubs.forEach((u) => u());
  }, [driverDocId, broadcasts]);

  useEffect(() => {
    if (!driverDocId) return;
    const typeToKind = (type?: string): AppNotif["kind"] => {
      if (!type) return "system";
      if (["job_offer", "customer_selected", "job_accepted", "arrived", "in_progress", "completed"].includes(type)) return "order";
      if (type === "chat") return "message";
      if (type === "alert") return "alert";
      return "system";
    };
    const unsub = listenDriverNotifications(driverDocId, (docs) => {
      const mapped: AppNotif[] = docs.map((d) => {
        const rawAt = d.createdAt;
        const at = rawAt
          ? typeof rawAt === "object" && "toDate" in (rawAt as any)
            ? (rawAt as any).toDate()
            : new Date(rawAt as any)
          : new Date();
        return {
          id: d.id,
          kind: typeToKind(d.type),
          title: d.title,
          body: d.message,
          at,
          read: d.read,
        };
      });
      setNotifs(mapped);
    });
    return unsub;
  }, [driverDocId]);

  useEffect(() => {
    if (notifs.length === 0) return;
    if (knownDriverNotifIds.current === null) {
      knownDriverNotifIds.current = new Set(notifs.map((n) => n.id));
      return;
    }
    const incoming = notifs.filter((n) => !knownDriverNotifIds.current!.has(n.id));
    incoming.forEach((n) => {
      knownDriverNotifIds.current!.add(n.id);
      if (!n.read) {
        toast(n.title, { description: n.body, duration: 5000 });
      }
    });
  }, [notifs]);

  // Auto-dismiss tracking view if the tracked job completes, is cancelled, or disappears
  useEffect(() => {
    if (!trackingJobId) return;
    const still = enriched.find(
      (a) => a.id === trackingJobId && a.driverAccepted === true && !a.completedAt &&
        a.request?.status !== "completed" && a.request?.status !== "cancelled",
    );
    if (!still) setTrackingJobId(null);
  }, [enriched, trackingJobId]);

  const broadcastSelectedAssignmentIds = new Set(
    Object.values(broadcastResponded)
      .filter((r) => r.status === "selected" && r.assignmentId)
      .map((r) => r.assignmentId!)
  );

  const selfPending = enriched.filter(
    (a) =>
      isSelf(a.request) &&
      a.driverAccepted === null &&
      !a.completedAt &&
      !broadcastSelectedAssignmentIds.has(a.id),
  );
  const compPending = enriched.filter(
    (a) => !isSelf(a.request) && a.driverAccepted === null && !a.completedAt,
  );
  const pendingJobs = [...selfPending, ...compPending];

  // Active jobs: explicitly accepted, not yet completed, not cancelled —
  // except customer-cancelled jobs stay visible for 3 s (briefCancelledShows) so
  // the driver can see "Cancelled" on the card before it disappears.
  const activeJobs = enriched.filter(
    (a) =>
      a.driverAccepted === true &&
      !a.completedAt &&
      a.request?.status !== "completed" &&
      (a.request?.status !== "cancelled" || briefCancelledShows.has(a.requestId)),
  );

  // Completed jobs: accepted by driver AND (completedAt set OR request status is "completed")
  const completedJobs = enriched.filter(
    (a) =>
      a.driverAccepted === true &&
      (!!a.completedAt || a.request?.status === "completed"),
  );

  const totalEarnings = useMemo(
    () => completedJobs.reduce((sum, a) => sum + getJobPrice(a.request), 0),
    [completedJobs],
  );

  const workingJob = enriched.find((a) => a.id === activeJobId) ?? null;
  const unread = notifs.filter((n) => !n.read).length;
  const totalChatUnread = Object.values(unreadCounts).reduce(
    (s, n) => s + n,
    0,
  );

  // Reviews: completed jobs that have a rating on the request doc
  const reviews = completedJobs
    .filter((a) => !!(a.request as any)?.rating)
    .map((a) => ({
      id: a.id,
      requestId: a.requestId,
      customer: a.customer,
      rating: (a.request as any).rating as {
        rating: number;
        feedback?: string;
      },
      completedAt: a.completedAt,
      price: getJobPrice(a.request),
      pickup: a.request?.pickup?.address,
      dropoff: a.request?.dropoff?.address,
    }))
    .sort((a, b) => {
      const getTime = (v: any) =>
        v
          ? typeof v === "object" && "toDate" in v
            ? v.toDate().getTime()
            : new Date(v).getTime()
          : 0;
      return getTime(b.completedAt) - getTime(a.completedAt);
    });

  const avgRating = reviews.length
    ? reviews.reduce((s, r) => s + r.rating.rating, 0) / reviews.length
    : 0;

  const mapMarkers = useMemo(() => {
    const m: any[] = [];
    if (latitude && longitude)
      m.push({ id: "me", latitude, longitude, type: "user", label: "You" });
    if (workingJob?.request?.pickup?.lat)
      m.push({
        id: "pu",
        latitude: workingJob.request.pickup.lat,
        longitude: workingJob.request.pickup.lng,
        type: "pickup",
        label: "Pickup",
      });
    if (workingJob?.request?.dropoff?.lat)
      m.push({
        id: "do",
        latitude: workingJob.request.dropoff.lat,
        longitude: workingJob.request.dropoff.lng,
        type: "dropoff",
        label: "Drop-off",
      });
    return m;
  }, [latitude, longitude, workingJob]);

  const mapRouteTo = (() => {
    if (!workingJob) return undefined;
    const st = workingJob.request?.status;
    if (["in_progress", "arrived"].includes(st ?? "") && workingJob.request?.dropoff?.lat)
      return [
        workingJob.request.dropoff.lat,
        workingJob.request.dropoff.lng,
      ] as [number, number];
    if (workingJob.request?.pickup?.lat)
      return [workingJob.request.pickup.lat, workingJob.request.pickup.lng] as [
        number,
        number,
      ];
  })();
  const mapRouteFrom: [number, number] | undefined =
    workingJob && latitude && longitude ? [latitude, longitude] : undefined;

  const handleToggleOnline = async () => {
    if (!driverDocId || !driver) return;
    const next = !driver.isOnline;
    if (!next && activeJobs.length > 0) {
      const confirmed = window.confirm(
        "You have an active job in progress. Going offline won't cancel it, but you'll stop receiving new requests. Continue?",
      );
      if (!confirmed) return;
    }
    try {
      await updateDoc(doc(db, "drivers", driverDocId), { isOnline: next });
      if (next) {
        const ok = await requestPermission();
        if (ok) startWatching();
      } else stopWatching();
      toast.success(next ? "You're now online" : "You're now offline");
    } catch {
      toast.error("Failed to update status");
    }
  };
  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };
  const navUrl = (req: any, dest: "pickup" | "dropoff") => {
    const loc = dest === "pickup" ? req?.pickup : req?.dropoff;
    if (!loc?.lat) return null;
    return `https://www.google.com/maps/dir/?api=1&destination=${loc.lat},${loc.lng}&travelmode=driving`;
  };
  const withJobLoading = async (jobId: string, action: string, fn: () => Promise<void>) => {
    setLoadingByJob(prev => ({ ...prev, [jobId]: action }));
    try { await fn(); } finally { setLoadingByJob(prev => ({ ...prev, [jobId]: null })); }
  };

  const handleAccept = async (a: EnrichedAssignment) => {
    try {
      await setDriverAccepted(a.id, true, a.requestId);
      setActiveJobId(a.id);
      setActiveTab("jobs");
      toast.success("Job accepted!");
      const customerId = a.request?.customerId;
      if (customerId) {
        void addDoc(collection(db, "notifications"), {
          userId: customerId,
          title: "Driver Accepted! 🚗",
          message: "Your driver has accepted the job and is on the way.",
          type: "driver_accepted",
          read: false,
          requestId: a.requestId,
          createdAt: serverTimestamp(),
        } satisfies Omit<UserNotificationDoc, "id">);
      }
      if (a.request?.workflowOwner === "company") {
        void addDoc(collection(db, "admin_notifications"), {
          type: "driver_accepted" as AdminNotificationDoc["type"],
          requestId: a.requestId,
          customerId: customerId,
          message: "Driver has accepted the delivery job.",
          read: false,
          createdAt: serverTimestamp(),
        });
      }
    } catch {
      toast.error("Failed");
    }
  };
  const handleDecline = async (a: EnrichedAssignment) => {
    try {
      await setDriverAccepted(a.id, false);
      toast.info("Job declined");
    } catch {
      toast.error("Failed");
    }
  };
  const handleSelfDecline = async (a: EnrichedAssignment) => {
    try {
      await setDriverAccepted(a.id, false);
      await updateDeliveryStatus(a.requestId, "pending");
      toast.info("Declined.");
    } catch {
      toast.error("Failed");
    }
  };

  const handleDriverCancelJob = async () => {
    if (!cancelTarget?.request?.customerId || !cancelTarget.id) return;
    const target = cancelTarget;
    const reason = driverCancelReason || undefined;
    setCancelLoading(true);
    try {
      await cancelDeliveryByDriver(target.requestId, target.request.customerId, target.id, reason);
      setEnriched(prev =>
        prev.map(a =>
          a.id === target.id && a.request
            ? { ...a, request: { ...a.request, status: "cancelled" as const, cancelledBy: "driver" } }
            : a,
        ),
      );
      if (trackingJobId === target.id) setTrackingJobId(null);
      if (activeJobId === target.id) setActiveJobId(null);
      toast.info("Delivery cancelled.");
      setCancelTarget(null);
      setDriverCancelReason("");
    } catch (e: any) {
      toast.error(
        e?.message === "Delivery can no longer be cancelled"
          ? "This delivery has already started and cannot be cancelled."
          : "Failed to cancel. Please try again.",
      );
      setCancelTarget(null);
      setDriverCancelReason("");
    } finally {
      setCancelLoading(false);
    }
  };

  // Fix #7: load driver's cancellation count when the confirm dialog opens
  useEffect(() => {
    if (!cancelTarget || !user?.uid) return;
    getUserCancellationCount(user.uid).then(setDriverCancelCount).catch(() => {});
  }, [cancelTarget, user?.uid]);
  const handleCounterOffer = async (a: EnrichedAssignment, p: number) => {
    try {
      await updateDoc(doc(db, "delivery_requests", a.requestId), {
        status: "negotiating_price",
        counterOfferPrice: p,
        counterOfferDriverId: driverDocId,
        counterOfferAt: new Date(),
      });
      toast.success(`Counter ₦${p.toLocaleString()} sent!`);
    } catch {
      toast.error("Failed");
    }
  };
  const handleArrived = async (a: EnrichedAssignment) => {
    try {
      await markDriverArrived(a.id, a.requestId);
      toast.success("Marked arrived!");
      const customerId = a.request?.customerId;
      if (customerId) {
        void addDoc(collection(db, "notifications"), {
          userId: customerId,
          title: "Driver Arrived! 📍",
          message: "Your driver has arrived at the pickup location.",
          type: "driver_arrived",
          read: false,
          requestId: a.requestId,
          createdAt: serverTimestamp(),
        } satisfies Omit<UserNotificationDoc, "id">);
      }
      if (a.request?.workflowOwner === "company") {
        void addDoc(collection(db, "admin_notifications"), {
          type: "driver_arrived" as AdminNotificationDoc["type"],
          requestId: a.requestId,
          customerId: customerId,
          message: "Driver has arrived at the pickup location.",
          read: false,
          createdAt: serverTimestamp(),
        });
      }
    } catch {
      toast.error("Failed");
    }
  };
  const handleStart = async (a: EnrichedAssignment) => {
    try {
      await markAssignmentStarted(a.id);
      await updateDeliveryStatus(a.requestId, "in_progress");
      toast.success("Delivery started!");
      const customerId = a.request?.customerId;
      if (customerId) {
        void addDoc(collection(db, "notifications"), {
          userId: customerId,
          title: "Delivery Started! 🚚",
          message: "Your delivery is now in progress and on the way to you.",
          type: "delivery_started",
          read: false,
          requestId: a.requestId,
          createdAt: serverTimestamp(),
        } satisfies Omit<UserNotificationDoc, "id">);
      }
      if (a.request?.workflowOwner === "company") {
        void addDoc(collection(db, "admin_notifications"), {
          type: "delivery_started" as AdminNotificationDoc["type"],
          requestId: a.requestId,
          customerId: customerId,
          message: "Delivery is now in progress.",
          read: false,
          createdAt: serverTimestamp(),
        });
      }
    } catch {
      toast.error("Failed");
    }
  };
  const handleProofCapture = async (dataUrl: string) => {
    setShowCamera(false);
    if (!pendingProof) return;
    setUploading(true);
    const proofAssignment = pendingProof;
    try {
      const url = await uploadProofPhoto(dataUrl);
      await completeDeliveryWithProof(
        proofAssignment.requestId,
        proofAssignment.id,
        url,
      );
      // Optimistic update so the card flips immediately without waiting for Firestore
      setEnriched(prev => prev.map(a =>
        a.id === proofAssignment.id && a.request
          ? { ...a, request: { ...a.request, status: "awaiting_signature" as const } }
          : a
      ));
      setActiveJobId(proofAssignment.id);
      setPendingProof(null);
      toast.success("Proof submitted! Waiting for customer confirmation.");
    } catch {
      toast.error("Upload failed.");
    } finally {
      setUploading(false);
    }
  };
  const handleBroadcastResponse = async (
    broadcastId: string,
    responseType: "interested" | "counter_offer",
    counterOfferPrice?: number
  ) => {
    if (!driverDocId) return;
    try {
      await respondToBroadcast(broadcastId, driverDocId, responseType, counterOfferPrice);
      // broadcastResponded is now kept in sync by the Firestore listener
      toast.success(
        responseType === "counter_offer"
          ? `Counter ₦${counterOfferPrice?.toLocaleString()} sent!`
          : "Interest sent to customer!"
      );
    } catch {
      toast.error("Failed to respond");
    }
  };

  const handleBroadcastAcceptSelected = async (broadcastId: string) => {
    const myResponse = broadcastResponded[broadcastId];
    if (!myResponse?.assignmentId || !myResponse?.requestId) return;
    try {
      await setDriverAccepted(myResponse.assignmentId, true);
      await updateDeliveryStatus(myResponse.requestId, "driver_accepted");
      setActiveJobId(myResponse.assignmentId);
      setActiveTab("jobs");
      toast.success("Job accepted!");
      const assignmentDoc = enriched.find((a) => a.id === myResponse.assignmentId);
      const customerId = assignmentDoc?.request?.customerId;
      if (customerId) {
        void addDoc(collection(db, "notifications"), {
          userId: customerId,
          title: "Driver Accepted! 🚗",
          message: "Your driver has accepted the job and is on the way.",
          type: "driver_accepted",
          read: false,
          requestId: myResponse.requestId,
          createdAt: serverTimestamp(),
        } satisfies Omit<UserNotificationDoc, "id">);
      }
    } catch {
      toast.error("Failed to accept");
    }
  };

  const handleBroadcastDeclineSelected = async (broadcastId: string) => {
    const myResponse = broadcastResponded[broadcastId];
    if (!myResponse?.assignmentId) return;
    try {
      await setDriverAccepted(myResponse.assignmentId, false);
      if (driverDocId) {
        await dismissBroadcastResponse(broadcastId, driverDocId);
      }
      toast.info("Job declined.");
    } catch {
      toast.error("Failed to decline");
    }
  };

  const markRead = (id: string) => {
    void markNotificationRead(id);
    setNotifs((p) => p.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };
  const markAllRead = () => {
    const unreadNotifs = notifs.filter((n) => !n.read).map((n) => ({ id: n.id, read: n.read }));
    if (unreadNotifs.length > 0) void markAllNotificationsRead(unreadNotifs);
    setNotifs((p) => p.map((n) => ({ ...n, read: true })));
  };
  const openChat = (a: EnrichedAssignment) => {
    if (!a.request?.customerId) return;
    setChatJob({
      requestId: a.requestId,
      customerId: a.request.customerId,
      customerName: a.customer
        ? `${a.customer.firstName} ${a.customer.lastName}`.trim()
        : "Customer",
    });
  };

  const hour = new Date().getHours();
  const greeting =
    hour < 5
      ? "Good night"
      : hour < 12
        ? "Good morning"
        : hour < 17
          ? "Good afternoon"
          : hour < 21
            ? "Good evening"
            : "Good night";
  const greetIcon =
    hour < 5
      ? "🌙"
      : hour < 12
        ? "☀️"
        : hour < 17
          ? "🌤️"
          : hour < 21
            ? "🌅"
            : "🌙";
  const driverName =
    user?.displayName?.split(" ")[0] ?? user?.email?.split("@")[0] ?? "Driver";
  const initials   = driverName.charAt(0).toUpperCase();
  const selfieUrl  = driver?.selfieUrl ?? null;
  const today = new Date().toLocaleDateString("en-NG", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const tabTitles: Record<TabType, string> = {
    home: "Home",
    jobs: "My Jobs",
    earnings: "Earnings",
    history: "History",
    reviews: "Reviews",
    profile: "Profile",
  };

  if (authLoading || !user)
    return (
      <div className="min-h-screen bg-[#F5F7F5] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-green-100 flex items-center justify-center animate-pulse">
            <Truck className="w-6 h-6 text-[#028538]" />
          </div>
          <p className="text-sm text-gray-400 font-medium">Loading Pilnak…</p>
        </div>
      </div>
    );

  if (isSuspended)
    return (
      <div className="min-h-screen bg-[#F5F7F5] flex flex-col items-center justify-center px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center mb-5">
          <ShieldCheck className="w-8 h-8 text-amber-500" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Account suspended</h1>
        <p className="text-sm text-gray-500 max-w-xs leading-relaxed mb-8">
          Your driver account has been suspended by your company. Please contact your company administrator to resolve this.
        </p>
        <button
          onClick={() => signOut()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
          style={{ background: "linear-gradient(135deg, #009C41 0%, #007A32 100%)" }}
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    );
  if (showCamera)
    return (
      <CameraCapture
        title="Proof Photo"
        facingMode="environment"
        onCapture={handleProofCapture}
        onCancel={() => {
          setShowCamera(false);
          setPendingProof(null);
        }}
      />
    );

  const navItems: {
    id: TabType;
    label: string;
    icon: React.ElementType;
    badge?: number;
  }[] = [
    { id: "home", label: "Home", icon: LayoutDashboard },
    {
      id: "jobs",
      label: "Jobs",
      icon: Package,
      badge: pendingJobs.length + totalChatUnread,
    },
    { id: "earnings", label: "Earnings", icon: BarChart3 },
    { id: "history", label: "History", icon: History },
    {
      id: "reviews",
      label: "Reviews",
      icon: Star,
      badge:
        reviews.filter((r) => {
          const rawAt = (r as any).completedAt;
          if (!rawAt) return false;
          const at =
            typeof rawAt === "object" && "toDate" in rawAt
              ? rawAt.toDate()
              : new Date(rawAt);
          return Date.now() - at.getTime() < 86400_000 * 3; // new in last 3 days
        }).length || undefined,
    },
    { id: "profile", label: "Profile", icon: User },
  ];

  // ── Notif drawer ──────────────────────────────────────────────────────────
  const NotifKindIcon = ({ kind }: { kind: AppNotif["kind"] }) => {
    const cfg = {
      order: { Icon: Package, cls: "bg-green-100 text-[#028538]" },
      system: { Icon: ShieldCheck, cls: "bg-blue-100 text-blue-600" },
      alert: { Icon: AlertCircle, cls: "bg-amber-100 text-amber-600" },
      message: { Icon: MessageSquare, cls: "bg-violet-100 text-violet-600" },
    }[kind];
    return (
      <div
        className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.cls}`}
      >
        <cfg.Icon className="w-4 h-4" />
      </div>
    );
  };

  const NotifDrawer = () => (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]"
        onClick={() => setNotifOpen(false)}
      />
      <div className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-sm bg-white flex flex-col shadow-2xl" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-green-100 rounded-xl flex items-center justify-center">
              <Bell className="w-4 h-4 text-[#028538]" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">Notifications</p>
              {unread > 0 && (
                <p className="text-[10px] text-[#028538] font-semibold">
                  {unread} unread
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs font-semibold text-[#028538]"
              >
                Mark all read
              </button>
            )}
            <button
              onClick={() => setNotifOpen(false)}
              className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center"
            >
              <X className="w-3.5 h-3.5 text-gray-500" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {notifs.length === 0 ? (
            <div className="py-16 flex flex-col items-center gap-3">
              <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center">
                <Bell className="w-7 h-7 text-gray-300" />
              </div>
              <p className="text-sm text-gray-400 font-semibold">
                No notifications
              </p>
            </div>
          ) : (
            notifs.map((n) => (
              <button
                key={n.id}
                onClick={() => markRead(n.id)}
                className={`w-full text-left px-5 py-3.5 flex items-start gap-3 hover:bg-gray-50 relative ${!n.read ? "bg-green-50/50" : ""}`}
              >
                {!n.read && (
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-[#028538] rounded-full" />
                )}
                <NotifKindIcon kind={n.kind} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p
                      className={`text-sm leading-tight ${!n.read ? "font-bold text-gray-900" : "font-medium text-gray-600"}`}
                    >
                      {n.title}
                    </p>
                    <span className="text-[10px] text-gray-400 flex-shrink-0">
                      {timeAgo(n.at)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{n.body}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </>
  );

  // ── Collapsed job card (active deliveries list) ───────────────────────────
  const CollapsedJobCard = ({ a, index, onOpen }: { a: EnrichedAssignment; index: number; onOpen: () => void }) => {
    const req = a.request;
    const price = getJobPrice(req);
    const status = req?.status ?? "";
    const jobUnread = unreadCounts[a.requestId] ?? 0;
    const pickupShort = req?.pickup?.address?.split(",")[0]?.trim() ?? "Pickup";
    const dropoffShort = req?.dropoff?.address?.split(",")[0]?.trim() ?? "Drop-off";
    const customerName = [a.customer?.firstName, a.customer?.lastName].filter(Boolean).join(" ");
    const title = customerName ? `${customerName} Delivery` : "Delivery";
    const statusLabel =
      status === "in_progress" ? "In Progress" :
      status === "driver_accepted" ? "Accepted" :
      status === "arrived" ? "Arrived" :
      status === "customer_confirmed" ? "Confirmed" :
      status === "cancelled" ? "Cancelled" :
      status.replace(/_/g, " ");
    const statusColor =
      status === "in_progress" ? "bg-blue-100 text-blue-700 border-blue-200" :
      status === "driver_accepted" ? "bg-[#028538]/10 text-[#028538] border-[#028538]/20" :
      status === "arrived" ? "bg-amber-100 text-amber-700 border-amber-200" :
      status === "cancelled" ? "bg-red-100 text-red-700 border-red-200" :
      "bg-gray-100 text-gray-600 border-gray-200";
    const dotColor =
      status === "in_progress" ? "bg-blue-500" :
      status === "driver_accepted" ? "bg-[#028538]" :
      status === "arrived" ? "bg-amber-500" :
      status === "cancelled" ? "bg-red-500" :
      "bg-gray-400";
    return (
      <button
        onClick={onOpen}
        className="w-full text-left bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden active:scale-[0.98] transition-transform"
      >
        {/* Top row */}
        <div className="px-4 pt-3.5 pb-2.5 flex items-center gap-3">
          {/* Number badge */}
          <div className="w-8 h-8 rounded-full bg-[#028538] flex items-center justify-center flex-shrink-0 shadow-sm shadow-[#028538]/30">
            <span className="text-white text-xs font-bold">{index}</span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-gray-900 truncate">{title}</span>
              {/* Status badge */}
              <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0 ${statusColor}`}>
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor}`} />
                {statusLabel}
              </span>
              {/* Chat unread badge */}
              {jobUnread > 0 && (
                <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0">
                  {jobUnread}
                </span>
              )}
            </div>
          </div>

          {/* Price + chevron */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-sm font-bold text-[#028538]">₦{price.toLocaleString()}</span>
            <ChevronRight className="w-4 h-4 text-gray-300" />
          </div>
        </div>

        {/* Route strip */}
        <div className="mx-4 mb-3 bg-gray-50 rounded-xl px-3 py-2 flex items-center gap-2">
          <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
            <div className="w-2 h-2 rounded-full bg-[#028538]" />
            <div className="w-0.5 h-3 bg-gray-300" />
            <div className="w-2 h-2 rounded-full bg-red-500" />
          </div>
          <p className="text-xs text-gray-500 truncate leading-5">
            {pickupShort}
            <span className="text-gray-300 mx-1">→</span>
            {dropoffShort}
          </p>
        </div>
      </button>
    );
  };

  // ── Job card ──────────────────────────────────────────────────────────────
  const JobCard = ({ a, hideHeader = false, hideMap = false }: { a: EnrichedAssignment; hideHeader?: boolean; hideMap?: boolean }) => {
    const req = a.request;
    const customer = a.customer;
    const status = req?.status ?? "";
    const isActive = a.id === activeJobId;
    const isSelfReq = isSelf(req);
    const price = getJobPrice(req);
    const canChat =
      a.driverAccepted === true && status !== "completed" && !!req?.customerId;
    const jobUnread = unreadCounts[a.requestId] ?? 0;
    const routeFrom: [number, number] | undefined =
      latitude && longitude ? [latitude, longitude] : undefined;
    const routeTo: [number, number] | undefined = (() => {
      if (status === "in_progress" && req?.dropoff?.lat)
        return [req.dropoff.lat, req.dropoff.lng];
      if (
        ["driver_accepted", "customer_confirmed", "arrived"].includes(status) &&
        req?.pickup?.lat
      )
        return [req.pickup.lat, req.pickup.lng];
    })();
    const jobMarkers: any[] = [];
    if (latitude && longitude)
      jobMarkers.push({
        id: "me",
        latitude,
        longitude,
        type: "user" as const,
        label: "You",
      });
    if (req?.pickup?.lat)
      jobMarkers.push({
        id: "pu",
        latitude: req.pickup.lat,
        longitude: req.pickup.lng,
        type: "pickup" as const,
        label: "Pickup",
      });
    if (req?.dropoff?.lat && ["in_progress", "arrived"].includes(status))
      jobMarkers.push({
        id: "do",
        latitude: req.dropoff.lat,
        longitude: req.dropoff.lng,
        type: "dropoff" as const,
        label: "Drop-off",
      });
    const showMap =
      !!routeFrom &&
      !!routeTo &&
      [
        "driver_accepted",
        "customer_confirmed",
        "arrived",
        "in_progress",
      ].includes(status);
    const externalUrl =
      routeFrom && routeTo
        ? `https://www.google.com/maps/dir/?api=1&origin=${routeFrom[0]},${routeFrom[1]}&destination=${routeTo[0]},${routeTo[1]}&travelmode=driving`
        : null;
    return (
      <div
        className={`bg-white rounded-2xl border overflow-hidden shadow-sm ${isActive ? "border-[#028538]" : "border-gray-100"}`}
      >
        {!hideHeader && (
          <div className="px-4 py-3 flex items-center justify-between border-b border-gray-50">
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center ${isActive ? "bg-green-100" : "bg-gray-100"}`}
              >
                <Truck
                  className={`w-4 h-4 ${isActive ? "text-[#028538]" : "text-gray-400"}`}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-gray-800">
                  {shortDeliveryName(a.requestId)}
                </p>
                {price > 0 && (
                  <p className="text-[10px] font-bold text-[#028538]">
                    ₦{price.toLocaleString()}
                  </p>
                )}
              </div>
            </div>
            <StatusBadge status={status} />
          </div>
        )}
        {!hideMap && showMap && (
          <div className="relative h-52 overflow-hidden">
            <MapView
              className="h-full w-full"
              markers={jobMarkers}
              userLatitude={latitude}
              userLongitude={longitude}
              routeFrom={routeFrom}
              routeTo={routeTo}
              showUserLocation={false}
              hideExternalLink
            />
            {externalUrl && (
              <a
                href={externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute bottom-3 right-3 z-[1000] flex items-center gap-1 bg-white text-gray-700 text-[10px] font-bold px-2.5 py-1.5 rounded-full shadow border border-gray-100"
              >
                <svg width="10" height="10" viewBox="0 0 48 48" fill="none">
                  <path
                    d="M24 4C15.163 4 8 11.163 8 20c0 12 16 28 16 28s16-16 16-28c0-8.837-7.163-16-16-16z"
                    fill="#EA4335"
                  />
                  <circle cx="24" cy="20" r="6" fill="white" />
                </svg>
                Maps
              </a>
            )}
            <div className="absolute top-3 left-3 z-[1000] bg-white/90 rounded-full px-2.5 py-1 text-[10px] font-bold text-gray-700 shadow">
              {status === "in_progress" ? "→ Drop-off" : "→ Pickup"}
            </div>
          </div>
        )}
        <div className="p-4 space-y-3">
          <RouteTimeline
            pickup={req?.pickup?.address}
            dropoff={req?.dropoff?.address}
          />
          {req?.packagePhotoUrl && <PackagePhoto url={req.packagePhotoUrl} />}
          {customer && (
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
                Customer
              </p>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                  <span className="text-xs font-bold text-[#028538]">
                    {customer.firstName.charAt(0)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-800">
                    {customer.firstName} {customer.lastName}
                  </p>
                  <div className="flex gap-2 mt-0.5">
                    {customer.phone && (
                      <a
                        href={`tel:${customer.phone}`}
                        className="flex items-center gap-1 text-xs text-[#028538] font-semibold"
                      >
                        <Phone className="w-3 h-3" />
                        {customer.phone}
                      </a>
                    )}
                  </div>
                </div>
                {canChat && (
                  <button
                    onClick={() => openChat(a)}
                    className="relative w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center"
                  >
                    <MessageCircle className="w-4 h-4 text-[#028538]" />
                    {jobUnread > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[14px] h-3.5 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center px-0.5">
                        {jobUnread > 9 ? "9+" : jobUnread}
                      </span>
                    )}
                  </button>
                )}
              </div>
            </div>
          )}
          {(status === "driver_accepted" ||
            status === "customer_confirmed") && (
            <div className="space-y-2">
              {navUrl(req, "pickup") && (
                <a
                  href={externalUrl ?? navUrl(req, "pickup")!}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setActiveJobId(a.id)}
                  className="w-full flex items-center justify-center gap-2 bg-[#028538] text-white text-sm font-bold py-3.5 rounded-2xl shadow-md shadow-[#028538]/20"
                >
                  <Navigation className="w-4 h-4" />
                  Navigate to Pickup
                </a>
              )}
              <button
                onClick={() => withJobLoading(a.id, 'arrived', () => handleArrived(a))}
                disabled={!!loadingByJob[a.id]}
                className="w-full flex items-center justify-center gap-2 bg-white border-2 border-[#028538] text-[#028538] text-sm font-bold py-3 rounded-2xl disabled:opacity-60"
              >
                {loadingByJob[a.id] === 'arrived' ? (
                  <><div className="h-3.5 w-3.5 rounded-full border-2 border-[#028538] border-t-transparent animate-spin flex-shrink-0" />Updating…</>
                ) : (
                  <><MapPin className="w-4 h-4" />I've Arrived</>
                )}
              </button>
              {isSelfReq && !a.startedAt && (
                <button
                  onClick={() => setCancelTarget(a)}
                  disabled={!!loadingByJob[a.id]}
                  className="w-full flex items-center justify-center gap-2 border border-red-200 bg-red-50 text-red-600 text-sm font-semibold py-2.5 rounded-2xl disabled:opacity-60"
                >
                  <X className="w-4 h-4" />
                  Cancel Delivery
                </button>
              )}
            </div>
          )}
          {status === "arrived" && (
            <div className="space-y-2">
              <div className="flex items-start gap-2 bg-green-50 border border-green-100 rounded-xl p-3">
                <CheckCircle className="w-4 h-4 text-[#028538] flex-shrink-0 mt-0.5" />
                <p className="text-sm text-green-800 font-medium">
                  Arrived! Call customer and load package.
                </p>
              </div>
              {customer?.phone && (
                <a
                  href={`tel:${customer.phone}`}
                  className="w-full flex items-center justify-center gap-2 bg-gray-50 border border-gray-200 text-gray-700 text-sm font-bold py-3 rounded-2xl"
                >
                  <Phone className="w-4 h-4" />
                  Call {customer.phone}
                </a>
              )}
              <button
                onClick={() => withJobLoading(a.id, 'start', () => handleStart(a))}
                disabled={!!loadingByJob[a.id]}
                className="w-full flex items-center justify-center gap-2 bg-[#028538] text-white text-sm font-bold py-3.5 rounded-2xl shadow-md shadow-[#028538]/20 disabled:opacity-60"
              >
                {loadingByJob[a.id] === 'start' ? (
                  <><div className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin flex-shrink-0" />Starting…</>
                ) : (
                  <><Truck className="w-4 h-4" />Start Delivery</>
                )}
              </button>
            </div>
          )}
          {status === "in_progress" && (
            <div className="space-y-2">
              {navUrl(req, "dropoff") && (
                <a
                  href={externalUrl ?? navUrl(req, "dropoff")!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 bg-gray-50 border border-gray-200 text-gray-700 text-sm font-bold py-3 rounded-2xl"
                >
                  <Navigation className="w-4 h-4" />
                  Navigate to Drop-off
                </a>
              )}
              <button
                onClick={() => {
                  setPendingProof(a);
                  setShowCamera(true);
                }}
                disabled={uploading}
                className="w-full flex items-center justify-center gap-2 bg-[#028538] text-white text-sm font-bold py-3.5 rounded-2xl shadow-md shadow-[#028538]/20 disabled:opacity-50"
              >
                <Camera className="w-4 h-4" />
                {uploading ? "Uploading…" : "Proof Photo & Complete"}
              </button>
            </div>
          )}
          {status === "awaiting_signature" && (
            <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3.5">
              <div className="relative flex-shrink-0">
                <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center">
                  <PenLine className="w-4 h-4 text-amber-600" />
                </div>
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-amber-800">Waiting for Customer Signature</p>
                <p className="text-xs text-amber-600 mt-0.5">Proof submitted — customer needs to sign off on delivery</p>
              </div>
            </div>
          )}
          {status === "completed" && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-100 rounded-xl p-3">
              <CheckCircle className="w-4 h-4 text-[#028538]" />
              <p className="text-sm text-green-800 font-semibold flex-1">
                Completed!
              </p>
              {req?.deliveryProofUrl && (
                <a
                  href={req.deliveryProofUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-[#028538] font-bold underline"
                >
                  Proof
                </a>
              )}
            </div>
          )}
          {status === "cancelled" && (
            <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-3.5">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-red-800">Delivery Cancelled</p>
                <p className="text-xs text-red-600 mt-0.5">
                  The customer has cancelled this delivery.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const OfferCard = ({ a }: { a: EnrichedAssignment }) => (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <RouteTimeline
          pickup={a.request?.pickup?.address}
          dropoff={a.request?.dropoff?.address}
        />
        {getJobPrice(a.request) > 0 && (
          <p className="text-base font-bold text-[#028538] flex-shrink-0">
            ₦{getJobPrice(a.request).toLocaleString()}
          </p>
        )}
      </div>
      {a.request?.packagePhotoUrl && (
        <PackagePhoto url={a.request.packagePhotoUrl} />
      )}
      <div className="flex gap-2">
        <button
          onClick={() => withJobLoading(a.id, 'accept', () => handleAccept(a))}
          disabled={!!loadingByJob[a.id]}
          className="flex-1 flex items-center justify-center gap-1.5 bg-[#028538] text-white text-sm font-bold py-3 rounded-xl shadow-sm shadow-[#028538]/15 disabled:opacity-60"
        >
          {loadingByJob[a.id] === 'accept' ? (
            <><div className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin flex-shrink-0" />Accepting…</>
          ) : (
            <><CheckCircle className="w-4 h-4" />Accept</>
          )}
        </button>
        <button
          onClick={() => withJobLoading(a.id, 'decline', () => handleDecline(a))}
          disabled={!!loadingByJob[a.id]}
          className="flex-1 flex items-center justify-center gap-1.5 bg-red-50 border border-red-100 text-red-500 text-sm font-bold py-3 rounded-xl disabled:opacity-60"
        >
          {loadingByJob[a.id] === 'decline' ? (
            <><div className="h-3.5 w-3.5 rounded-full border-2 border-red-400 border-t-transparent animate-spin flex-shrink-0" />Declining…</>
          ) : (
            <><X className="w-4 h-4" />Decline</>
          )}
        </button>
      </div>
    </div>
  );

  const HistoryCard = ({ a }: { a: EnrichedAssignment }) => {
    const req = a.request;
    const customer = a.customer;
    const rawCd = a.completedAt;
    const cd = rawCd
      ? typeof rawCd === "object" && "toDate" in rawCd
        ? (rawCd as any).toDate()
        : new Date(rawCd as any)
      : null;
    const earn = getJobPrice(req);
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-green-100 rounded-xl flex items-center justify-center">
              <CheckCircle className="w-4 h-4 text-[#028538]" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-800">
                {shortDeliveryName(a.requestId)}
              </p>
              {cd && (
                <p className="text-[10px] text-gray-400 flex items-center gap-0.5">
                  <Clock className="w-2.5 h-2.5" />
                  {cd.toLocaleDateString("en-NG", {
                    day: "numeric",
                    month: "short",
                  })}
                </p>
              )}
            </div>
          </div>
          {earn > 0 && (
            <p className="text-sm font-bold text-[#028538]">
              +₦{earn.toLocaleString()}
            </p>
          )}
        </div>
        <div className="p-4 space-y-3">
          <RouteTimeline
            pickup={req?.pickup?.address}
            dropoff={req?.dropoff?.address}
          />
          {customer && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center">
                  <span className="text-xs font-bold text-[#028538]">
                    {customer.firstName.charAt(0)}
                  </span>
                </div>
                <p className="text-xs font-semibold text-gray-700">
                  {customer.firstName} {customer.lastName}
                </p>
              </div>
              {req?.deliveryProofUrl && (
                <a
                  href={req.deliveryProofUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-xs text-[#028538] font-semibold"
                >
                  <ExternalLink className="w-3 h-3" />
                  Proof
                </a>
              )}
            </div>
          )}
          {(req as any)?.rating && (
            <StarRow rating={(req as any).rating.rating} />
          )}
        </div>
      </div>
    );
  };

  // ── Reviews screen ────────────────────────────────────────────────────────
  const ReviewsScreen = () => {
    const ratingCounts = [5, 4, 3, 2, 1].map((star) => ({
      star,
      count: reviews.filter((r) => r.rating.rating === star).length,
      pct: reviews.length
        ? (reviews.filter((r) => r.rating.rating === star).length /
            reviews.length) *
          100
        : 0,
    }));

    return (
      <div className="px-4 pt-4 pb-6 space-y-4">
        {/* Summary card */}
        <div className="bg-[#028538] rounded-2xl p-5 relative overflow-hidden shadow-lg shadow-[#028538]/20">
          <div className="absolute -top-8 -right-8 w-36 h-36 rounded-full bg-white/[0.06]" />
          <div className="absolute bottom-0 right-6 opacity-[0.06]">
            <Star className="w-28 h-28" />
          </div>
          <div className="relative">
            <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest">
              Overall Rating
            </p>
            <div className="flex items-end gap-3 mt-1">
              <p className="text-5xl font-bold text-white">
                {reviews.length ? avgRating.toFixed(1) : "—"}
              </p>
              <div className="pb-1">
                <StarRow rating={Math.round(avgRating)} size="md" />
                <p className="text-[10px] text-white/40 mt-1 font-medium">
                  {reviews.length} review{reviews.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
            {/* Bar chart */}
            <div className="mt-4 pt-4 border-t border-white/10 space-y-1.5">
              {ratingCounts.map(({ star, count, pct }) => (
                <div key={star} className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-white/50 w-3">
                    {star}
                  </span>
                  <Star className="w-2.5 h-2.5 fill-yellow-300 text-yellow-300 flex-shrink-0" />
                  <div className="flex-1 h-1.5 bg-white/15 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-white/70 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-bold text-white/40 w-3 text-right">
                    {count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Review cards */}
        {reviews.length > 0 ? (
          <div className="space-y-3">
            <p className="text-sm font-bold text-gray-900">Customer Feedback</p>
            {reviews.map((r) => {
              const rawCd = r.completedAt;
              const cd = rawCd
                ? typeof rawCd === "object" && "toDate" in rawCd
                  ? (rawCd as any).toDate()
                  : new Date(rawCd as any)
                : null;
              const hasFeedback = !!r.rating.feedback?.trim();
              return (
                <div
                  key={r.id}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
                >
                  {/* Header */}
                  <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-bold text-[#028538]">
                          {r.customer ? r.customer.firstName.charAt(0) : "?"}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-800">
                          {r.customer
                            ? `${r.customer.firstName} ${r.customer.lastName}`
                            : "Anonymous"}
                        </p>
                        {cd && (
                          <p className="text-[10px] text-gray-400 flex items-center gap-0.5">
                            <Clock className="w-2.5 h-2.5" />
                            {cd.toLocaleDateString("en-NG", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <StarRow rating={r.rating.rating} size="sm" />
                      {r.price > 0 && (
                        <p className="text-[10px] font-bold text-[#028538]">
                          ₦{r.price.toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Body */}
                  <div className="p-4 space-y-3">
                    {/* Route */}
                    <RouteTimeline pickup={r.pickup} dropoff={r.dropoff} />

                    {/* Feedback text */}
                    {hasFeedback ? (
                      <div className="flex items-start gap-2.5 bg-gray-50 border border-gray-100 rounded-xl p-3">
                        <MessageSquareDashed className="w-4 h-4 text-gray-300 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-gray-600 leading-relaxed italic">
                          "{r.rating.feedback}"
                        </p>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
                        <ThumbsUp className="w-3.5 h-3.5 text-gray-300" />
                        <p className="text-xs text-gray-400 font-medium">
                          No written feedback
                        </p>
                      </div>
                    )}

                    {/* Rating badge */}
                    <div className="flex items-center justify-between">
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full ${
                          r.rating.rating >= 4
                            ? "bg-green-100 text-[#028538]"
                            : r.rating.rating === 3
                              ? "bg-amber-100 text-amber-600"
                              : "bg-red-100 text-red-500"
                        }`}
                      >
                        <Star className="w-2.5 h-2.5 fill-current" />
                        {r.rating.rating >= 4
                          ? "Positive"
                          : r.rating.rating === 3
                            ? "Neutral"
                            : "Needs Improvement"}
                      </span>
                      <p className="text-[10px] text-gray-400 font-medium">
                        {shortDeliveryName(r.requestId)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center shadow-sm">
            <div className="w-14 h-14 bg-yellow-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Star className="w-7 h-7 text-yellow-300" />
            </div>
            <p className="font-bold text-gray-700">No reviews yet</p>
            <p className="text-sm text-gray-400 mt-1">
              Complete deliveries to receive customer feedback.
            </p>
          </div>
        )}
      </div>
    );
  };

  // ══════════════════════════════════════════════════════════
  // SCREENS
  // ══════════════════════════════════════════════════════════

  const HomeScreen = () => (
    <div className="space-y-0">
      <div className="bg-white px-4 pt-4 pb-3">
        {/* Greeting */}
        <div className="mt-4 mb-3">
          <p className="text-xs text-gray-400 font-medium">{today}</p>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-xl">{greetIcon}</span>
            <h1 className="text-2xl font-bold text-gray-900">
              {greeting},{" "}
              <span className="text-[#028538]">{driverName.toUpperCase()}</span>
            </h1>
          </div>
          <p className="text-sm text-gray-400 mt-0.5">
            What would you like to do today?
          </p>
        </div>
        {/* Online toggle */}
        <button
          onClick={handleToggleOnline}
          className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl shadow-md mb-1 transition-all ${driver?.isOnline ? "bg-red-500 shadow-red-500/20" : "bg-[#028538] shadow-[#028538]/20"}`}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
              <Power className="w-4 h-4 text-white" />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-white">
                {driver?.isOnline ? "You're Online" : "Go Online"}
              </p>
              <p className="text-[10px] text-white/60">
                {driver?.isOnline
                  ? "Tap to go offline"
                  : "Start receiving deliveries"}
              </p>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-white/70" />
        </button>
      </div>

      {/* Stat tiles */}
      <div className="px-4 pt-4 pb-1">
        <div className="grid grid-cols-2 gap-3">
          {[
            {
              icon: CheckCircle,
              label: "DELIVERED",
              value: completedJobs.length,
              badge: completedJobs.length > 0 ? "+12%" : null,
              accent: "bg-green-50 text-[#028538]",
            },
            {
              icon: Wallet,
              label: "EARNED",
              value: `₦${totalEarnings >= 1000 ? (totalEarnings / 1000).toFixed(0) + "k" : totalEarnings}`,
              badge: null,
              accent: "bg-violet-50 text-violet-600",
            },
          ].map((s) => (
            <div
              key={s.label}
              className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm"
            >
              <div className="flex items-start justify-between mb-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center ${s.accent}`}
                >
                  <s.icon className="w-4 h-4" />
                </div>
                {s.badge && (
                  <div className="flex items-center gap-0.5 bg-green-50 px-1.5 py-0.5 rounded-full border border-green-100">
                    <TrendingUp className="w-2.5 h-2.5 text-[#028538]" />
                    <span className="text-[9px] font-bold text-[#028538]">
                      {s.badge}
                    </span>
                  </div>
                )}
              </div>
              <p className="text-2xl font-bold text-gray-900">{s.value}</p>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Rating tile */}
      {avgRating > 0 && (
        <div className="px-4 pt-3">
          <button
            onClick={() => setActiveTab("reviews")}
            className="w-full bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-yellow-50 flex items-center justify-center">
                <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">
                  {avgRating.toFixed(1)} avg rating
                </p>
                <p className="text-[10px] text-gray-400">
                  {reviews.length} customer review
                  {reviews.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-300" />
          </button>
        </div>
      )}

      {/* Job alerts */}
      <div className="px-4 pt-3 space-y-2">
        {selfPending.length > 0 && (
          <button
            onClick={() => setActiveTab("jobs")}
            className="w-full flex items-center gap-3 bg-[#028538] rounded-2xl px-4 py-3.5 shadow-md shadow-[#028538]/15"
          >
            <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-bold text-white">
                {selfPending.length} customer{selfPending.length > 1 ? "s" : ""}{" "}
                chose you!
              </p>
              <p className="text-[10px] text-white/60">Tap to respond</p>
            </div>
            <ArrowRight className="w-4 h-4 text-white/60" />
          </button>
        )}
        {compPending.length > 0 && (
          <button
            onClick={() => setActiveTab("jobs")}
            className="w-full flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3.5"
          >
            <div className="w-8 h-8 bg-amber-100 rounded-xl flex items-center justify-center">
              <Bell className="w-4 h-4 text-amber-600" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-bold text-amber-900">
                {compPending.length} new job offer
                {compPending.length > 1 ? "s" : ""}
              </p>
              <p className="text-[10px] text-amber-500">Tap to accept</p>
            </div>
            <ArrowRight className="w-4 h-4 text-amber-400" />
          </button>
        )}
        {broadcasts.length > 0 && (
          <button
            onClick={() => setActiveTab("jobs")}
            className="w-full flex items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-2xl px-4 py-3.5"
          >
            <div className="w-8 h-8 bg-indigo-100 rounded-xl flex items-center justify-center">
              <Radio className="w-4 h-4 text-indigo-600 animate-pulse" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-bold text-indigo-900">
                {broadcasts.length} open request{broadcasts.length > 1 ? "s" : ""} nearby
              </p>
              <p className="text-[10px] text-indigo-500">Tap to respond</p>
            </div>
            <ArrowRight className="w-4 h-4 text-indigo-400" />
          </button>
        )}
      </div>

      {/* Map overview */}
      <div className="px-4 pt-4 pb-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 flex items-center justify-between border-b border-gray-50">
            <div>
              <p className="text-sm font-bold text-gray-900">Map Overview</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div
                  className={`w-1.5 h-1.5 rounded-full ${latitude ? "bg-[#028538]" : "bg-gray-300"}`}
                />
                <p className="text-xs text-gray-400">
                  {latitude ? "GPS active" : "Acquiring GPS…"}
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveTab("jobs")}
              className="flex items-center gap-1 text-xs font-bold text-[#028538]"
            >
              View jobs <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="px-4 py-2.5 border-b border-gray-50">
            <div className="flex items-center gap-2.5 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
              <MapPin className="w-4 h-4 text-[#028538] flex-shrink-0" />
              <p className="flex-1 text-sm text-gray-400 truncate">
                {workingJob
                  ? workingJob.request?.status === "in_progress"
                    ? `→ ${workingJob.request.dropoff?.address}`
                    : `→ ${workingJob.request?.pickup?.address}`
                  : "No active delivery"}
              </p>
            </div>
          </div>
          <div className="h-52 relative">
            <MapView
              className="w-full h-full"
              userLatitude={latitude}
              userLongitude={longitude}
              markers={mapMarkers}
              routeFrom={mapRouteFrom}
              routeTo={mapRouteTo}
              hideExternalLink
            />
          </div>
        </div>
      </div>
    </div>
  );

  const JobsScreen = () => {


    return (
      <div>
        <div className="px-4 pt-4 pb-6 space-y-4">
          {/* Open Requests — broadcasts from customers not yet assigned */}
          {broadcasts.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-indigo-600 animate-pulse" />
                <p className="text-sm font-bold text-gray-900">Open Requests</p>
                <span className="text-[10px] font-bold bg-indigo-600 text-white px-2 py-0.5 rounded-full">
                  {broadcasts.length}
                </span>
              </div>
              {broadcasts
                .filter((b) => broadcastResponded[b.id]?.status !== "dismissed")
                .map((b) => (
                  <BroadcastCard
                    key={b.id}
                    broadcast={b}
                    myResponse={broadcastResponded[b.id] ?? null}
                    onRespond={(type, price) => handleBroadcastResponse(b.id, type, price)}
                    onAcceptSelected={() => handleBroadcastAcceptSelected(b.id)}
                    onDeclineSelected={() => handleBroadcastDeclineSelected(b.id)}
                  />
                ))}
            </div>
          )}

          {selfPending.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-[#028538]" />
                <p className="text-sm font-bold text-gray-900">
                  Customer-Selected
                </p>
                <span className="text-[10px] font-bold bg-[#028538] text-white px-2 py-0.5 rounded-full">
                  {selfPending.length}
                </span>
              </div>
              {selfPending.map((a) => (
                <SelfDriverOfferCard
                  key={a.id}
                  a={a}
                  onAccept={() => handleAccept(a)}
                  onDecline={() => handleSelfDecline(a)}
                  onCounterOffer={(p) => handleCounterOffer(a, p)}
                />
              ))}
            </div>
          )}
          {compPending.length > 0 && (
            <div className="bg-white rounded-2xl border border-amber-200 overflow-hidden shadow-sm">
              <div className="px-4 py-3 border-b border-amber-100 bg-amber-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-amber-600" />
                  <p className="text-sm font-bold text-amber-900">New Offers</p>
                </div>
                <span className="text-[10px] font-bold bg-amber-500 text-white px-2 py-0.5 rounded-full">
                  {compPending.length}
                </span>
              </div>
              <div className="p-4 space-y-3">
                {compPending.map((a) => (
                  <OfferCard key={a.id} a={a} />
                ))}
              </div>
            </div>
          )}
          {activeJobs.filter((a) => a.driverAccepted === true).length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-bold text-gray-900">Active</p>
              {activeJobs
                .filter((a) => a.driverAccepted === true)
                .map((a, i) => (
                  <CollapsedJobCard
                    key={a.id}
                    a={a}
                    index={i + 1}
                    onOpen={() => setTrackingJobId(a.id)}
                  />
                ))}
            </div>
          )}
          {activeJobs.length === 0 && pendingJobs.length === 0 && broadcasts.length === 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center shadow-sm">
              <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Package className="w-7 h-7 text-[#028538]" />
              </div>
              <p className="font-bold text-gray-700">No jobs right now</p>
              <p className="text-sm text-gray-400 mt-1">
                {driver?.isOnline
                  ? "Waiting for requests…"
                  : "Go online to receive jobs."}
              </p>
              {!driver?.isOnline && (
                <button
                  onClick={handleToggleOnline}
                  className="mt-4 bg-[#028538] text-white text-sm font-bold px-5 py-2.5 rounded-xl shadow shadow-[#028538]/20"
                >
                  Go Online
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const EarningsScreen = () => {
    const earningsPerJob = completedJobs.map((a) => ({
      id: a.id,
      requestId: a.requestId,
      price: getJobPrice(a.request),
      completedAt: a.completedAt,
      customer: a.customer,
      request: a.request,
    }));
    const avgPerJob =
      completedJobs.length > 0
        ? Math.round(totalEarnings / completedJobs.length)
        : 0;

    return (
      <div>
        <div className="px-4 pt-4 pb-6 space-y-4">
          <div className="bg-[#028538] rounded-2xl p-6 relative overflow-hidden shadow-lg shadow-[#028538]/20">
            <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/[0.06]" />
            <div className="absolute bottom-0 right-8 opacity-[0.06]">
              <Wallet className="w-32 h-32" />
            </div>
            <div className="relative">
              <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest">
                Total Earnings
              </p>
              <p className="text-4xl font-bold text-white mt-1 tracking-tight">
                ₦{totalEarnings.toLocaleString()}
              </p>
              <p className="text-xs text-white/40 mt-1 font-medium">
                From {completedJobs.length} completed{" "}
                {completedJobs.length === 1 ? "delivery" : "deliveries"}
              </p>
              <div className="flex gap-6 mt-4 pt-4 border-t border-white/10">
                <div>
                  <p className="text-[9px] text-white/40 font-bold uppercase tracking-widest">
                    Avg / Job
                  </p>
                  <p className="text-xl font-bold text-white">
                    ₦{avgPerJob.toLocaleString()}
                  </p>
                </div>
                <div className="w-px bg-white/15" />
                <div>
                  <p className="text-[9px] text-white/40 font-bold uppercase tracking-widest">
                    Rating
                  </p>
                  <p className="text-xl font-bold text-white flex items-center gap-1">
                    {avgRating > 0 ? avgRating.toFixed(1) : "—"}{" "}
                    <Star className="w-4 h-4 fill-yellow-300 text-yellow-300" />
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              {
                icon: CheckCircle,
                label: "Completed",
                value: completedJobs.length,
                accent: "bg-green-50 text-[#028538]",
              },
              {
                icon: Star,
                label: "Avg Rating",
                value: avgRating > 0 ? avgRating.toFixed(1) + " ★" : "—",
                accent: "bg-yellow-50 text-yellow-600",
              },
              {
                icon: TrendingUp,
                label: "Avg / Job",
                value: `₦${avgPerJob.toLocaleString()}`,
                accent: "bg-violet-50 text-violet-600",
              },
              {
                icon: Award,
                label: "Status",
                value: driver?.status ?? "Pending",
                accent: "bg-blue-50 text-blue-600",
              },
            ].map((s) => (
              <div
                key={s.label}
                className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm"
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${s.accent}`}
                >
                  <s.icon className="w-4 h-4" />
                </div>
                <p className="text-xl font-bold text-gray-900">{s.value}</p>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                  {s.label}
                </p>
              </div>
            ))}
          </div>

          {earningsPerJob.length > 0 && (
            <div>
              <p className="text-sm font-bold text-gray-900 mb-3">
                Earnings Breakdown
              </p>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-50">
                {earningsPerJob.slice(0, 10).map((j) => {
                  const rawCd = j.completedAt;
                  const cd = rawCd
                    ? typeof rawCd === "object" && "toDate" in rawCd
                      ? (rawCd as any).toDate()
                      : new Date(rawCd as any)
                    : null;
                  return (
                    <div
                      key={j.id}
                      className="flex items-center justify-between px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                          <CheckCircle className="w-4 h-4 text-[#028538]" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-gray-800">
                            {shortDeliveryName(j.requestId)}
                          </p>
                          {cd && (
                            <p className="text-[10px] text-gray-400">
                              {cd.toLocaleDateString("en-NG", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                            </p>
                          )}
                        </div>
                      </div>
                      <p className="text-sm font-bold text-[#028538]">
                        {j.price > 0 ? `+₦${j.price.toLocaleString()}` : "—"}
                      </p>
                    </div>
                  );
                })}
                {earningsPerJob.length > 10 && (
                  <div className="px-4 py-3 text-center">
                    <p className="text-xs text-gray-400 font-semibold">
                      + {earningsPerJob.length - 10} more — see History
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {completedJobs.length === 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center shadow-sm">
              <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Wallet className="w-7 h-7 text-[#028538]" />
              </div>
              <p className="font-bold text-gray-700">No earnings yet</p>
              <p className="text-sm text-gray-400 mt-1">
                Complete deliveries to see your earnings here.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const HistoryScreen = () => (
    <div>
      {reviews.length > 0 && (
        <div className="px-4 pt-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-gray-900">
                Customer Reviews
              </p>
              <button
                onClick={() => setActiveTab("reviews")}
                className="flex items-center gap-1 text-xs font-bold text-[#028538]"
              >
                See all <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-4xl font-bold text-gray-900">
                  {avgRating.toFixed(1)}
                </p>
                <StarRow rating={Math.round(avgRating)} size="md" />
                <p className="text-[10px] text-gray-400 mt-1">
                  {reviews.length} reviews
                </p>
              </div>
              <div className="flex-1 space-y-1">
                {[5, 4, 3, 2, 1].map((star) => {
                  const count = reviews.filter(
                    (r) => r.rating.rating === star,
                  ).length;
                  const pct = reviews.length
                    ? (count / reviews.length) * 100
                    : 0;
                  return (
                    <div key={star} className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-400 w-2">
                        {star}
                      </span>
                      <Star className="w-2.5 h-2.5 fill-yellow-400 text-yellow-400" />
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#028538] rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-gray-400 w-4 text-right">
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="px-4 pt-4 pb-6">
        {completedJobs.length > 0 ? (
          <div className="space-y-3">
            {completedJobs.map((a) => (
              <HistoryCard key={a.id} a={a} />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center shadow-sm">
            <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <History className="w-7 h-7 text-gray-300" />
            </div>
            <p className="font-bold text-gray-500">No history yet</p>
          </div>
        )}
      </div>
    </div>
  );

  const ProfileScreen = () => (
    <div>
      <div className="bg-[#028538] px-4 pt-6 pb-8 relative overflow-hidden">
        <div className="absolute -top-8 -right-8 w-36 h-36 rounded-full bg-white/[0.07]" />
        <div className="relative flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center shadow-xl shadow-black/10 overflow-hidden relative flex-shrink-0">
            <span className="text-2xl font-bold text-[#028538]">{initials}</span>
            {selfieUrl && (
              <img
                src={selfieUrl}
                alt={driverName}
                className="absolute inset-0 w-full h-full object-cover"
                onError={(e) => { e.currentTarget.style.display = "none"; }}
              />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-lg font-bold text-white">{driverName}</p>
            <p className="text-xs text-white/50 truncate">{user?.email}</p>
            <div className="flex items-center gap-2 mt-2">
              <span
                className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${driver?.status === "approved" ? "bg-white/20 text-white" : "bg-amber-500/30 text-amber-200"}`}
              >
                {driver?.status ?? "pending"}
              </span>
              <span
                className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${driver?.isOnline ? "bg-white/20 text-white" : "bg-white/10 text-white/40"}`}
              >
                {driver?.isOnline ? "● Online" : "○ Offline"}
              </span>
            </div>
          </div>
        </div>
        <div className="relative mt-5 flex items-center gap-0 bg-white/10 rounded-2xl overflow-hidden divide-x divide-white/15">
          {[
            { label: "Deliveries", value: completedJobs.length },
            {
              label: "Earnings",
              value: `₦${totalEarnings >= 1000 ? (totalEarnings / 1000).toFixed(0) + "k" : totalEarnings}`,
            },
            {
              label: "Rating",
              value: avgRating > 0 ? avgRating.toFixed(1) : "—",
            },
          ].map((s) => (
            <div key={s.label} className="flex-1 text-center py-3">
              <p className="text-base font-bold text-white leading-none">
                {s.value}
              </p>
              <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest mt-0.5">
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4 pb-6 space-y-4">
        <button
          onClick={handleToggleOnline}
          className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl shadow-md transition-all ${driver?.isOnline ? "bg-red-500 shadow-red-500/15" : "bg-[#028538] shadow-[#028538]/15"}`}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
              <Power className="w-4 h-4 text-white" />
            </div>
            <p className="text-sm font-bold text-white">
              {driver?.isOnline ? "Go Offline" : "Go Online"}
            </p>
          </div>
          <span
            className={`w-2 h-2 rounded-full ${driver?.isOnline ? "bg-white animate-pulse" : "bg-white/40"}`}
          />
        </button>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50">
            <p className="text-sm font-bold text-gray-800">Account Details</p>
          </div>
          {[
            { label: "Total Deliveries", value: completedJobs.length },
            {
              label: "Total Earnings",
              value: `₦${totalEarnings.toLocaleString()}`,
            },
            {
              label: "Avg Rating",
              value: avgRating > 0 ? `${avgRating.toFixed(1)} ★` : "No rating",
            },
            { label: "Reviews", value: reviews.length },
            { label: "Account Status", value: driver?.status ?? "Pending" },
          ].map((r) => (
            <div
              key={r.label}
              className="flex items-center justify-between px-4 py-3.5 border-b border-gray-50 last:border-0"
            >
              <span className="text-sm text-gray-500">{r.label}</span>
              <span className="text-sm font-bold text-gray-900">{r.value}</span>
            </div>
          ))}
        </div>

        {driver?.isCompanyDriver && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50">
              <p className="text-sm font-bold text-gray-800">Assigned Fleet</p>
            </div>
            <div className="divide-y divide-gray-50">
              {[
                {
                  label: "Vehicle",
                  value: driver.assignedVehicleBrand ?? "Not assigned",
                },
                {
                  label: "Plate Number",
                  value: driver.assignedVehiclePlate ?? "Not assigned",
                },
                {
                  label: "Fleet ID",
                  value: driver.assignedVehicleId ?? "Not assigned",
                },
              ].map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between px-4 py-3.5"
                >
                  <span className="text-sm text-gray-500">{row.label}</span>
                  <span className="text-sm font-bold text-gray-900">
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reviews shortcut */}
        <button
          onClick={() => setActiveTab("reviews")}
          className="w-full flex items-center justify-between bg-white border border-gray-100 rounded-2xl px-5 py-4 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-yellow-50 rounded-xl flex items-center justify-center">
              <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-gray-800">My Reviews</p>
              <p className="text-[10px] text-gray-400">
                {reviews.length} review{reviews.length !== 1 ? "s" : ""} ·{" "}
                {avgRating > 0
                  ? `${avgRating.toFixed(1)} avg`
                  : "No rating yet"}
              </p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-gray-300" />
        </button>

        {driver?.status === "pending_verification" && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">
              Account pending verification.
            </p>
          </div>
        )}

        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 bg-red-50 border border-red-100 text-red-500 text-sm font-bold py-3.5 rounded-2xl"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════
  // ROOT RENDER
  // ══════════════════════════════════════════════════════════════════════
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .dr { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      <div className="dr min-h-screen bg-[#F5F7F5] overflow-x-hidden w-full max-w-[100vw]">
        <LocationPermissionModal
          isOpen={showLocModal}
          onAllow={async () => {
            setShowLocModal(false);
            const ok = await requestPermission();
            localStorage.setItem(LOC_KEY, ok ? "granted" : "denied");
            if (ok) startWatching();
          }}
          onDeny={() => {
            setShowLocModal(false);
            localStorage.setItem(LOC_KEY, "denied");
          }}
        />
        {notifOpen && <NotifDrawer />}

        {chatJob && user?.uid && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]"
              onClick={() => setChatJob(null)}
            />
            <div
              className="fixed z-50 inset-x-0 bottom-0 lg:inset-x-auto lg:right-6 lg:bottom-6 lg:w-96 flex flex-col"
              style={{ maxHeight: "80dvh" }}
            >
              <ChatPanel
                requestId={chatJob.requestId}
                currentUserId={user.uid}
                currentUserRole="driver"
                senderName={user.displayName ?? driverName}
                otherUserId={chatJob.customerId}
                otherUserName={chatJob.customerName}
                otherUserRole="customer"
                deliveryName={shortDeliveryName(chatJob.requestId)}
                onClose={() => setChatJob(null)}
                onUnreadCountChange={(count) =>
                  setUnreadCounts((prev) => ({
                    ...prev,
                    [chatJob.requestId]: count,
                  }))
                }
              />
            </div>
          </>
        )}

        {/* ════ FULL-PAGE JOB DETAIL OVERLAY ════ */}
        {(() => {
          if (!trackingJobId) return null;
          const trackedJob = activeJobs.find((a) => a.id === trackingJobId);
          if (!trackedJob) return null;
          const req = trackedJob.request;
          const status = req?.status ?? "";
          const price = getJobPrice(req);
          const customerName = [trackedJob.customer?.firstName, trackedJob.customer?.lastName].filter(Boolean).join(" ");
          const statusLabel =
            status === "in_progress" ? "In Progress" :
            status === "driver_accepted" ? "Accepted" :
            status === "arrived" ? "Arrived" :
            status === "customer_confirmed" ? "Confirmed" :
            status.replace(/_/g, " ");
          const statusColor =
            status === "in_progress" ? "bg-blue-100 text-blue-700" :
            status === "driver_accepted" ? "bg-green-100 text-green-700" :
            status === "arrived" ? "bg-amber-100 text-amber-700" :
            "bg-gray-100 text-gray-600";
          const ovRouteFrom: [number, number] | undefined = latitude && longitude ? [latitude, longitude] : undefined;
          const ovRouteTo: [number, number] | undefined = (() => {
            if (status === "in_progress" && req?.dropoff?.lat) return [req.dropoff.lat, req.dropoff.lng];
            if (["driver_accepted", "customer_confirmed", "arrived"].includes(status) && req?.pickup?.lat)
              return [req.pickup.lat, req.pickup.lng];
          })();
          const ovMarkers: any[] = [];
          if (latitude && longitude) ovMarkers.push({ id: "me", latitude, longitude, type: "user" as const, label: "You" });
          if (req?.pickup?.lat) ovMarkers.push({ id: "pu", latitude: req.pickup.lat, longitude: req.pickup.lng, type: "pickup" as const, label: "Pickup" });
          if (req?.dropoff?.lat && ["in_progress", "arrived"].includes(status))
            ovMarkers.push({ id: "do", latitude: req.dropoff.lat, longitude: req.dropoff.lng, type: "dropoff" as const, label: "Drop-off" });
          const showOvMap = !!ovRouteFrom && !!ovRouteTo && ["driver_accepted", "customer_confirmed", "arrived", "in_progress"].includes(status);
          const ovExternalUrl = ovRouteFrom && ovRouteTo
            ? `https://www.google.com/maps/dir/?api=1&origin=${ovRouteFrom[0]},${ovRouteFrom[1]}&destination=${ovRouteTo[0]},${ovRouteTo[1]}&travelmode=driving`
            : null;

          return (
            <div className="fixed inset-0 z-[45] bg-white flex flex-col overflow-hidden">
              {/* ── Shared header ── */}
              <div
                className="flex-shrink-0 flex items-center gap-3 px-4 border-b border-gray-100 bg-white"
                style={{ paddingTop: "max(env(safe-area-inset-top), 12px)", paddingBottom: "12px" }}
              >
                <button
                  onClick={() => setTrackingJobId(null)}
                  className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 active:bg-gray-200 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4 text-gray-700" />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">
                    {customerName ? `${customerName} Delivery` : "Delivery"}
                  </p>
                  <p className="text-xs text-gray-400">₦{price.toLocaleString()}</p>
                </div>
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${statusColor}`}>
                  {statusLabel}
                </span>
              </div>

              {/* ── Mobile: single-column scrollable ── */}
              <div
                className="lg:hidden flex-1 overflow-y-auto bg-[#F5F7F5]"
                style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
              >
                <div className="px-4 pt-4 pb-8">
                  {JobCard({ a: trackedJob, hideHeader: true })}
                </div>
              </div>

              {/* ── Desktop: two-column layout ── */}
              <div className="hidden lg:grid lg:grid-cols-2 flex-1 min-h-0">
                {/* Left: full-height map */}
                <div className="relative overflow-hidden bg-gray-50">
                  {showOvMap ? (
                    <>
                      <div className="absolute inset-0">
                        <MapView
                          className="h-full w-full"
                          markers={ovMarkers}
                          userLatitude={latitude}
                          userLongitude={longitude}
                          routeFrom={ovRouteFrom}
                          routeTo={ovRouteTo}
                          showUserLocation={false}
                          hideExternalLink
                        />
                      </div>
                      {ovExternalUrl && (
                        <a
                          href={ovExternalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="absolute bottom-4 right-4 z-[1000] flex items-center gap-1.5 bg-white text-gray-700 text-xs font-bold px-3 py-2 rounded-full shadow-md border border-gray-100"
                        >
                          <svg width="12" height="12" viewBox="0 0 48 48" fill="none">
                            <path d="M24 4C15.163 4 8 11.163 8 20c0 12 16 28 16 28s16-16 16-28c0-8.837-7.163-16-16-16z" fill="#EA4335" />
                            <circle cx="24" cy="20" r="6" fill="white" />
                          </svg>
                          Open in Google Maps
                        </a>
                      )}
                      <div className="absolute top-4 left-4 z-[1000] bg-white/90 rounded-full px-3 py-1.5 text-xs font-bold text-gray-700 shadow">
                        {status === "in_progress" ? "→ Drop-off" : "→ Pickup"}
                      </div>
                    </>
                  ) : (
                    <div className="h-full flex items-center justify-center">
                      <div className="text-center">
                        <MapPin className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                        <p className="text-sm text-gray-400 font-medium">Map unavailable</p>
                        <p className="text-xs text-gray-300 mt-1">Enable location to see route</p>
                      </div>
                    </div>
                  )}
                </div>
                {/* Right: scrollable job details */}
                <div className="overflow-y-auto bg-[#F5F7F5]">
                  <div className="p-6 pb-10">
                    {JobCard({ a: trackedJob, hideHeader: true, hideMap: true })}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ════ DESKTOP lg+ ════ */}
        <div className="hidden lg:flex min-h-screen">
          <aside className="w-[240px] xl:w-[260px] flex-shrink-0 flex flex-col fixed top-0 left-0 bottom-0 z-40 bg-[#028538]" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
            <div className="px-5 py-5 border-b border-white/15">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center shadow shadow-black/10">
                  <Logo size="sm" className="text-white" showText={false} />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Pilnak</p>
                  <p className="text-[9px] text-white/50 font-bold uppercase tracking-widest">
                    Driver
                  </p>
                </div>
              </div>
            </div>
            <div className="mx-4 mt-4 bg-white/10 border border-white/15 rounded-2xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow shadow-black/10 overflow-hidden relative flex-shrink-0">
                  <span className="text-base font-bold text-[#028538]">{initials}</span>
                  {selfieUrl && (
                    <img
                      src={selfieUrl}
                      alt={driverName}
                      className="absolute inset-0 w-full h-full object-cover"
                      onError={(e) => { e.currentTarget.style.display = "none"; }}
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">
                    {driverName}
                  </p>
                  <p className="text-[10px] text-white/50 truncate">
                    {user?.email}
                  </p>
                </div>
              </div>
              <button
                onClick={handleToggleOnline}
                className={`mt-3 w-full flex items-center justify-center gap-2 text-xs font-bold py-2.5 rounded-xl border transition-all ${driver?.isOnline ? "bg-red-500/15 text-red-200 border-red-300/25" : "bg-white/15 text-white border-white/20 hover:bg-white/25"}`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${driver?.isOnline ? "bg-white animate-pulse" : "bg-white/40"}`}
                />
                {driver?.isOnline
                  ? "Online — Go Offline"
                  : "Offline — Go Online"}
              </button>
            </div>
            <nav className="flex-1 px-3 mt-4 space-y-0.5 overflow-y-auto scrollbar-hide">
              {navItems.map((item) => {
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-3 rounded-xl text-sm font-semibold transition-all ${active ? "bg-white text-[#028538] shadow shadow-black/10" : "text-white/55 hover:text-white hover:bg-white/10"}`}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className="w-4 h-4 flex-shrink-0" />
                      {item.label}
                    </div>
                    {item.badge && item.badge > 0 ? (
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center ${active ? "bg-[#028538] text-white" : "bg-white/20 text-white"}`}
                      >
                        {item.badge}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </nav>
            <div className="p-3 border-t border-white/10">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-white/40 hover:text-white hover:bg-white/10 transition-all"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </aside>

          <div className="ml-[240px] xl:ml-[260px] flex-1 flex flex-col min-w-0">
            <header className="h-14 bg-white border-b border-gray-100 flex items-center justify-between px-6 sticky top-0 z-30">
              <div>
                <p className="text-sm font-bold text-gray-900">
                  {greeting}, {driverName}!
                </p>
                <p className="text-xs text-gray-400">
                  {driver?.isOnline
                    ? pendingJobs.length > 0
                      ? `${pendingJobs.length} job${pendingJobs.length > 1 ? "s" : ""} waiting`
                      : "Ready for deliveries"
                    : "You're offline"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setNotifOpen(true)}
                  className="w-9 h-9 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-400 hover:text-[#028538] hover:bg-green-50 relative"
                >
                  <Bell className="w-4 h-4" />
                  {unread > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-3.5 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center px-0.5">
                      {unread}
                    </span>
                  )}
                </button>
                <div
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${driver?.isOnline ? "bg-green-50 text-[#028538] border-green-200" : "bg-gray-100 text-gray-400 border-gray-200"}`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${driver?.isOnline ? "bg-[#028538] animate-pulse" : "bg-gray-400"}`}
                  />
                  {driver?.isOnline ? "Online" : "Offline"}
                </div>
              </div>
            </header>
            <main className="flex-1 p-6 overflow-y-auto">
              {activeTab === "home" && (
                <div className="max-w-5xl">
                  {HomeScreen()}
                </div>
              )}
              {activeTab === "jobs" && (
                <div className="max-w-2xl">
                  {JobsScreen()}
                </div>
              )}
              {activeTab === "earnings" && (
                <div className="max-w-xl">
                  {EarningsScreen()}
                </div>
              )}
              {activeTab === "history" && (
                <div className="max-w-2xl">
                  {HistoryScreen()}
                </div>
              )}
              {activeTab === "reviews" && (
                <div className="max-w-xl">
                  {ReviewsScreen()}
                </div>
              )}
              {activeTab === "profile" && (
                <div className="max-w-md">
                  {ProfileScreen()}
                </div>
              )}
            </main>
          </div>
        </div>

        {/* ════ MOBILE < lg ════ */}
        <div className="lg:hidden flex flex-col h-[100dvh] overflow-hidden">
          {/* ── Fixed mobile header ── */}
          <header
            className="flex-shrink-0 bg-white border-b border-gray-100 shadow-sm z-30"
            style={{ paddingTop: "env(safe-area-inset-top)" }}
          >
            <div className="flex items-center justify-between px-4 h-14">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-[#028538] rounded-xl flex items-center justify-center shadow shadow-[#028538]/20 overflow-hidden relative flex-shrink-0">
                  <span className="text-sm font-bold text-white">{initials}</span>
                  {selfieUrl && (
                    <img
                      src={selfieUrl}
                      alt={driverName}
                      className="absolute inset-0 w-full h-full object-cover"
                      onError={(e) => { e.currentTarget.style.display = "none"; }}
                    />
                  )}
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900 leading-none">
                    {activeTab === "home" ? "Pilnak" : tabTitles[activeTab]}
                  </p>
                  {activeTab === "home" && (
                    <p className="text-[10px] text-gray-400 leading-none mt-0.5">
                      Driver
                    </p>
                  )}
                  {activeTab === "jobs" && (
                    <p className="text-[10px] text-gray-400 leading-none mt-0.5">
                      {activeJobs.length} active · {pendingJobs.length} pending
                    </p>
                  )}
                  {activeTab === "earnings" && (
                    <p className="text-[10px] text-[#028538] font-bold leading-none mt-0.5">
                      ₦{totalEarnings.toLocaleString()}
                    </p>
                  )}
                  {activeTab === "history" && (
                    <p className="text-[10px] text-gray-400 leading-none mt-0.5">
                      {completedJobs.length} deliveries
                    </p>
                  )}
                  {activeTab === "reviews" && (
                    <p className="text-[10px] text-gray-400 leading-none mt-0.5">
                      {reviews.length} review{reviews.length !== 1 ? "s" : ""} ·{" "}
                      {avgRating > 0
                        ? `${avgRating.toFixed(1)} avg`
                        : "No ratings yet"}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${driver?.isOnline ? "bg-green-50 text-[#028538] border-green-200" : "bg-gray-100 text-gray-400 border-gray-200"}`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${driver?.isOnline ? "bg-[#028538] animate-pulse" : "bg-gray-300"}`}
                  />
                  {driver?.isOnline ? "Online" : "Offline"}
                </div>
                <button
                  onClick={() => setNotifOpen(true)}
                  className="w-9 h-9 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center relative"
                >
                  <Bell className="w-4 h-4 text-gray-400" />
                  {unread > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-3.5 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center px-0.5">
                      {unread}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </header>

          {/* ── Scrollable content ── */}
          <main ref={mobileMainRef} className="flex-1 overflow-y-auto scrollbar-hide bg-[#F5F7F5]">
            {activeTab === "home" && HomeScreen()}
            {activeTab === "jobs" && JobsScreen()}
            {activeTab === "earnings" && EarningsScreen()}
            {activeTab === "history" && HistoryScreen()}
            {activeTab === "reviews" && ReviewsScreen()}
            {activeTab === "profile" && ProfileScreen()}
          </main>

          {/* ── Fixed bottom nav ── */}
          <nav
            className="flex-shrink-0 bg-white border-t border-gray-100 shadow-lg z-30"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            <div className="flex items-center">
              {navItems.map((item) => {
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 relative transition-colors ${active ? "text-[#028538]" : "text-gray-400"}`}
                  >
                    {item.badge && item.badge > 0 && (
                      <span className="absolute top-1.5 right-[calc(50%-18px)] min-w-[15px] h-3.5 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center px-1">
                        {item.badge > 9 ? "9+" : item.badge}
                      </span>
                    )}
                    <item.icon size={22} strokeWidth={active ? 2.5 : 1.8} />
                    <span className="text-[10px] font-bold">{item.label}</span>
                    {active && (
                      <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-[#028538] rounded-full" />
                    )}
                  </button>
                );
              })}
            </div>
          </nav>
        </div>
      </div>

      {/* ── Driver cancel confirmation ── */}
      {cancelTarget && (
        <div className="fixed inset-0 z-[300] flex items-end justify-center bg-black/40 backdrop-blur-[2px] p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="font-bold text-sm text-gray-900">Cancel Delivery?</p>
                <p className="text-xs text-gray-500 mt-0.5">The customer will be notified of your cancellation.</p>
              </div>
            </div>

            {/* Fix #7: warn repeat cancellers */}
            {driverCancelCount >= 2 && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 font-medium">
                  You've cancelled {driverCancelCount} {driverCancelCount === 1 ? "delivery" : "deliveries"} before.
                  Frequent cancellations may affect your account standing.
                </p>
              </div>
            )}

            {/* Fix #8: reason picker */}
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-gray-500">Reason (optional)</p>
              <div className="flex flex-wrap gap-1.5">
                {["Customer unreachable", "Safety concern", "Emergency", "Other"].map((r) => (
                  <button
                    key={r}
                    onClick={() => setDriverCancelReason(prev => prev === r ? "" : r)}
                    className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-all ${
                      driverCancelReason === r
                        ? "bg-red-600 text-white border-red-600"
                        : "bg-gray-50 border-gray-200 text-gray-600 hover:border-red-300 hover:text-red-700"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => { setCancelTarget(null); setDriverCancelReason(""); }}
                disabled={cancelLoading}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 font-semibold text-sm text-gray-700 bg-gray-50 hover:bg-gray-100 transition-all disabled:opacity-50"
              >
                Keep Delivery
              </button>
              <button
                onClick={handleDriverCancelJob}
                disabled={cancelLoading}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-sm transition-all disabled:opacity-50 active:scale-[0.98]"
              >
                {cancelLoading ? (
                  <><div className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />Cancelling…</>
                ) : "Yes, Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

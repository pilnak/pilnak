import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { auth, db, storage } from "@/integrations/firebase/client";
import { onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth";
import {
  ref as storageRef,
  uploadBytes,
  uploadString,
  getDownloadURL,
} from "firebase/storage";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  Timestamp,
  addDoc,
} from "firebase/firestore";
import { MapView } from "@/components/map/MapView";
import { DeliveryRequestForm } from "@/components/delivery/DeliveryRequestForm";
import { DeliveryTracking } from "@/components/delivery/DeliveryTracking";
import { DeliveryNegotiationSection } from "@/components/delivery/DeliveryNegotiationSection";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { VoiceCall } from "@/components/call/VoiceCall";
import { CameraCapture } from "@/components/camera/CameraCapture";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useSessionState } from "@/hooks/useSessionState";
import { useBookingOptional } from "@/contexts/BookingContext";
import { HERO_BOOKING_KEY } from "@/components/landing/HeroSection";
import {
  MapPin,
  Package,
  Clock,
  MessageCircle,
  User,
  LogOut,
  Plus,
  Search,
  Bell,
  Star,
  Truck,
  Edit2,
  X,
  ChevronRight,
  ArrowRight,
  ArrowLeft,
  Home,
  HelpCircle,
  Phone,
  CheckCircle,
  XCircle,
  UserCheck,
  History,
  Share2,
  Navigation,
  Copy,
  Mail,
  Link2,
  Send,
  MessageSquare,
  Twitter,
  Facebook,
  ExternalLink,
  TrendingUp,
  Settings,
  Camera,
  MapPinned,
  Sun,
  Sunrise,
  Sunset,
  Moon,
  Tag,
  Upload,
  Car,
  Shield,
  Hash,
  AlertTriangle,
  Gift,
  BellRing,
  FileText,
  Volume2,
  Vibrate,
  RotateCcw,
  PhoneCall,
  MapPinCheck,
  Timer,
} from "lucide-react";
import { toast } from "sonner";
import {
  markAllNotificationsRead,
  getOrCreateSupportChat,
  listenMessages,
} from "@/services/firebase";

// ── Font injection (Dancing Script for greeting) ──────────────────────────────
if (
  typeof document !== "undefined" &&
  !document.getElementById("customer-dash-fonts")
) {
  const link = document.createElement("link");
  link.id = "customer-dash-fonts";
  link.rel = "stylesheet";
  link.href =
    "https://fonts.googleapis.com/css2?family=Dancing+Script:wght@600&display=swap";
  document.head.appendChild(link);
}

// ── Types ─────────────────────────────────────────────────────────────────────

type TabType =
  | "home"
  | "deliveries"
  | "messages"
  | "profile"
  | "support"
  | "history";
type ViewMode =
  | "default"
  | "new-request"
  | "tracking"
  | "negotiation"
  | "schedule";

interface SavedAddress {
  id: string;
  label: string;
  address: string;
  lat: number;
  lng: number;
}
interface DeliveryRating {
  rating: number;
  feedback?: string;
  timestamp: Timestamp;
}

// ── Support Chat View ─────────────────────────────────────────────────────────
function SupportChatView({
  userId,
  customerName,
  onClose,
  flat,
  backButton,
}: {
  userId: string;
  customerName?: string;
  onClose: () => void;
  flat?: boolean;
  backButton?: boolean;
}) {
  const [chatId, setChatId] = useState<string | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    getOrCreateSupportChat(userId, customerName)
      .then(setChatId)
      .catch(() => setErr(true));
  }, [userId, customerName]);

  if (err)
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-16">
        <p className="font-semibold text-gray-600">
          Could not connect to support
        </p>
        <button
          onClick={onClose}
          className="text-sm text-primary font-semibold underline"
        >
          Go back
        </button>
      </div>
    );

  if (!chatId)
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );

  return (
    <ChatPanel
      chatId={chatId}
      requestId={`support_${userId}`}
      currentUserId={userId}
      senderName={customerName ?? "Customer"}
      otherUserId="support"
      otherUserName="Pilnak Support"
      otherUserRole="Support Team"
      onClose={onClose}
      flat={flat}
      backButton={backButton}
    />
  );
}

interface DeliveryRequest {
  id: string;
  customerId: string;
  driverId?: string;
  deliveryName?: string;
  pickup?: { address: string; lat: number; lng: number };
  dropoff?: { address: string; lat: number; lng: number };
  status:
    | "pending"
    | "admin_review"
    | "negotiating"
    | "negotiating_price"
    | "price_set"
    | "payment_pending"
    | "customer_confirmed"
    | "driver_assigned"
    | "driver_accepted"
    | "in_progress"
    | "arrived"
    | "awaiting_signature"
    | "completed"
    | "cancelled";
  estimatedPrice?: number;
  quotedPrice?: number;
  finalPrice?: number;
  workflowOwner?: "admin" | "company";
  createdAt?: Timestamp;
  completedAt?: Timestamp;
  rating?: DeliveryRating;
}

interface Driver {
  id: string;
  firstName?: string;
  lastName?: string;
  photoURL?: string;
  vehicleType?: string;
  plateNumber?: string;
  vehiclePhotoURL?: string;
  carModel?: string;
  rating?: number;
  averageRating?: number;
  completedDeliveries?: number;
  totalDeliveries?: number;
  currentLocation?: { lat: number; lng: number };
  isOnline: boolean;
  status: string;
  phone?: string;
}

interface UserProfile {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  address?: string;
  photoURL?: string;
  createdAt?: Timestamp;
  emergencyContact?: string;
  emergencyName?: string;
  preferredPickupAddress?: string;
  preferredPickupLat?: number;
  preferredPickupLng?: number;
  smsAlertNumber?: string;
  pushNotifications?: boolean;
  notificationSound?: boolean;
  notificationVibration?: boolean;
  referralCode?: string;
}

interface CustomerData {
  userId: string;
  savedAddresses: SavedAddress[];
  totalDeliveries: number;
  createdAt: Timestamp;
}

interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type?: string;
  read: boolean;
  requestId?: string;
  createdAt: Timestamp;
}

interface MapMarker {
  id: string;
  latitude: number;
  longitude: number;
  type: "driver" | "pickup" | "dropoff";
  label: string;
  data?: Driver;
}

// ── Hero booking type ─────────────────────────────────────────────────────────

interface HeroBooking {
  pickup: { address: string; lat: number; lon: number };
  dropoff: { address: string; lat: number; lon: number };
}

// ── Share utilities ───────────────────────────────────────────────────────────

function buildGoogleMapsUrl(
  delivery: DeliveryRequest,
  driverLoc?: { lat: number; lng: number } | null,
): string {
  const originCoords = driverLoc
    ? `${driverLoc.lat},${driverLoc.lng}`
    : delivery.pickup?.lat && delivery.pickup?.lng
      ? `${delivery.pickup.lat},${delivery.pickup.lng}`
      : "";
  const destCoords =
    delivery.dropoff?.lat && delivery.dropoff?.lng
      ? `${delivery.dropoff.lat},${delivery.dropoff.lng}`
      : "";
  if (!originCoords || !destCoords)
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(delivery.dropoff?.address ?? "delivery location")}`;
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(originCoords)}&destination=${encodeURIComponent(destCoords)}&travelmode=driving&dir_action=navigate`;
}

function buildAppLink(delivery: DeliveryRequest): string {
  const base = window.location.origin;
  const p = new URLSearchParams({ id: delivery.id });
  if (delivery.pickup?.lat) p.set("plat", String(delivery.pickup.lat));
  if (delivery.pickup?.lng) p.set("plng", String(delivery.pickup.lng));
  if (delivery.dropoff?.lat) p.set("dlat", String(delivery.dropoff.lat));
  if (delivery.dropoff?.lng) p.set("dlng", String(delivery.dropoff.lng));
  return `${base}/track?${p.toString()}`;
}

interface SharePayload {
  title: string;
  body: string;
  mapsUrl: string;
  appLink: string;
  shortId: string;
}

function buildSharePayload(
  delivery: DeliveryRequest,
  senderName: string,
  driverLoc?: { lat: number; lng: number } | null,
): SharePayload {
  const mapsUrl = buildGoogleMapsUrl(delivery, driverLoc);
  const appLink = buildAppLink(delivery);
  const shortId = delivery.id.slice(0, 8).toUpperCase();
  const label = delivery.deliveryName || `Delivery ${shortId}`;
  const title = `Pilnak: ${label} — shared by ${senderName}`;
  const body = `${senderName} shared a live Pilnak delivery with you!\n\nFrom: ${delivery.pickup?.address ?? "N/A"}\nTo:   ${delivery.dropoff?.address ?? "N/A"}\n\nTrack live on Google Maps:\n${mapsUrl}\n\nOpen in Pilnak app:\n${appLink}`;
  return { title, body, mapsUrl, appLink, shortId };
}

interface Platform {
  id: string;
  label: string;
  icon: React.ElementType;
  tile: string;
  iconCls: string;
  act: (p: SharePayload) => void;
}

function platforms(payload: SharePayload): Platform[] {
  return [
    {
      id: "whatsapp",
      label: "WhatsApp",
      icon: MessageSquare,
      tile: "border-[#25D366]/30 bg-[#25D366]/8 hover:bg-[#25D366]/15",
      iconCls: "text-[#25D366]",
      act: () =>
        window.open(
          `https://wa.me/?text=${encodeURIComponent(payload.body)}`,
          "_blank",
        ),
    },
    {
      id: "telegram",
      label: "Telegram",
      icon: Send,
      tile: "border-[#229ED9]/30 bg-[#229ED9]/8 hover:bg-[#229ED9]/15",
      iconCls: "text-[#229ED9]",
      act: () =>
        window.open(
          `https://t.me/share/url?url=${encodeURIComponent(payload.mapsUrl)}&text=${encodeURIComponent(payload.title)}`,
          "_blank",
        ),
    },
    {
      id: "sms",
      label: "SMS",
      icon: MessageCircle,
      tile: "border-blue-200 bg-blue-50 hover:bg-blue-100",
      iconCls: "text-blue-600",
      act: () =>
        window.open(`sms:?body=${encodeURIComponent(payload.body)}`, "_blank"),
    },
    {
      id: "email",
      label: "Email",
      icon: Mail,
      tile: "border-violet-200 bg-violet-50 hover:bg-violet-100",
      iconCls: "text-violet-600",
      act: () =>
        window.open(
          `mailto:?subject=${encodeURIComponent(payload.title)}&body=${encodeURIComponent(payload.body)}`,
          "_blank",
        ),
    },
    {
      id: "twitter",
      label: "X (Twitter)",
      icon: Twitter,
      tile: "border-gray-200 bg-gray-50 hover:bg-gray-100",
      iconCls: "text-gray-800",
      act: () =>
        window.open(
          `https://twitter.com/intent/tweet?text=${encodeURIComponent(payload.title)}&url=${encodeURIComponent(payload.mapsUrl)}`,
          "_blank",
        ),
    },
    {
      id: "facebook",
      label: "Facebook",
      icon: Facebook,
      tile: "border-[#1877F2]/20 bg-[#1877F2]/8 hover:bg-[#1877F2]/15",
      iconCls: "text-[#1877F2]",
      act: () =>
        window.open(
          `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(payload.mapsUrl)}`,
          "_blank",
        ),
    },
    {
      id: "maps",
      label: "Google Maps",
      icon: ExternalLink,
      tile: "border-red-200 bg-red-50 hover:bg-red-100",
      iconCls: "text-red-500",
      act: () => window.open(payload.mapsUrl, "_blank"),
    },
    {
      id: "native",
      label: "More…",
      icon: Share2,
      tile: "border-border bg-muted/50 hover:bg-muted",
      iconCls: "text-muted-foreground",
      act: async () => {
        if (navigator.share) {
          try {
            await navigator.share({
              title: payload.title,
              text: payload.body,
              url: payload.mapsUrl,
            });
          } catch {}
        } else {
          navigator.clipboard
            .writeText(payload.body)
            .then(() => toast.success("Copied!"));
        }
      },
    },
    {
      id: "copy",
      label: "Copy Link",
      icon: Copy,
      tile: "border-border bg-muted/40 hover:bg-muted",
      iconCls: "text-foreground",
      act: () =>
        navigator.clipboard
          .writeText(`${payload.title}\n\n${payload.mapsUrl}`)
          .then(() => toast.success("Link copied!")),
    },
  ];
}

// ── Status helpers ────────────────────────────────────────────────────────────

function statusIcon(s: string) {
  switch (s) {
    case "pending":
      return <Clock className="h-3 w-3" />;
    case "admin_review":
      return <Clock className="h-3 w-3" />;
    case "negotiating":
    case "negotiating_price":
      return <PhoneCall className="h-3 w-3" />;
    case "price_set":
      return <Tag className="h-3 w-3" />;
    case "payment_pending":
      return <Upload className="h-3 w-3" />;
    case "customer_confirmed":
      return <CheckCircle className="h-3 w-3" />;
    case "driver_assigned":
      return <UserCheck className="h-3 w-3" />;
    case "driver_accepted":
      return <Car className="h-3 w-3" />;
    case "in_progress":
      return <Truck className="h-3 w-3" />;
    case "arrived":
      return <MapPinCheck className="h-3 w-3" />;
    case "awaiting_signature":
      return <Timer className="h-3 w-3" />;
    case "completed":
      return <CheckCircle className="h-3 w-3" />;
    case "cancelled":
      return <XCircle className="h-3 w-3" />;
    default:
      return <Package className="h-3 w-3" />;
  }
}

function statusColor(s: string) {
  switch (s) {
    case "pending":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "admin_review":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "negotiating":
    case "negotiating_price":
      return "bg-sky-50 text-sky-700 border-sky-200";
    case "price_set":
      return "bg-orange-50 text-orange-700 border-orange-200";
    case "payment_pending":
      return "bg-indigo-50 text-indigo-700 border-indigo-200";
    case "customer_confirmed":
      return "bg-teal-50 text-teal-700 border-teal-200";
    case "driver_assigned":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "driver_accepted":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "in_progress":
      return "bg-violet-50 text-violet-700 border-violet-200";
    case "arrived":
      return "bg-green-50 text-green-700 border-green-200";
    case "awaiting_signature":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "completed":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "cancelled":
      return "bg-red-50 text-red-700 border-red-200";
    default:
      return "bg-gray-50 text-gray-700 border-gray-200";
  }
}

const canCancel = (s: string) =>
  [
    "pending",
    "admin_review",
    "negotiating",
    "negotiating_price",
    "price_set",
  ].includes(s);
const isShareable = (s: string) =>
  [
    "pending",
    "admin_review",
    "customer_confirmed",
    "driver_assigned",
    "driver_accepted",
    "in_progress",
    "arrived",
  ].includes(s);

// ── DashboardSkeleton ─────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="min-h-[100dvh] bg-[#f7f8fa]">
      <div className="hidden lg:flex h-screen">
        <aside className="w-64 bg-[#1b5e30] p-6 flex flex-col gap-2">
          <Skeleton className="h-8 w-32 mb-6 bg-white/10" />
          <Skeleton className="h-16 rounded-2xl mb-4 bg-white/10" />
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-10 rounded-xl bg-white/10" />
          ))}
        </aside>
        <main className="flex-1 p-8 space-y-6 overflow-auto">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}

// ── Share Dialog Content ──────────────────────────────────────────────────────

function ShareDialogContent({
  delivery,
  senderName,
  driverLoc,
  onClose,
}: {
  delivery: DeliveryRequest;
  senderName: string;
  driverLoc?: { lat: number; lng: number } | null;
  onClose: () => void;
}) {
  const payload = buildSharePayload(delivery, senderName, driverLoc);
  const list = platforms(payload);
  return (
    <div className="space-y-4">
      <div className="bg-gray-50 rounded-xl p-3.5 space-y-2 border border-gray-100">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="w-2.5 h-2.5 rounded-full bg-primary mt-1 flex-shrink-0" />
          <p className="text-sm text-muted-foreground truncate flex-1 min-w-0">
            {delivery.pickup?.address ?? "Pickup"}
          </p>
        </div>
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500 mt-1 flex-shrink-0" />
          <p className="text-sm text-muted-foreground truncate flex-1 min-w-0">
            {delivery.dropoff?.address ?? "Drop-off"}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2.5 bg-primary/5 border border-primary/20 rounded-xl px-3.5 py-2.5 min-w-0">
        <Link2 className="h-4 w-4 text-primary flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-primary truncate">
            Pilnak {delivery.deliveryName || `Delivery ${payload.shortId}`}
          </p>
          <p className="text-[11px] text-muted-foreground">
            Opens Google Maps with live route & driver location
          </p>
        </div>
        <button
          onClick={() =>
            navigator.clipboard
              .writeText(payload.mapsUrl)
              .then(() => toast.success("Maps link copied!"))
          }
          className="h-7 w-7 rounded-lg flex items-center justify-center text-primary hover:bg-primary/10 transition-colors flex-shrink-0"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
      </div>
      <p className="text-xs text-muted-foreground text-center">
        Recipients can track live on Google Maps — no app required.
      </p>
      <div className="grid grid-cols-3 gap-2">
        {list.map((p) => {
          const Icon = p.icon;
          return (
            <button
              key={p.id}
              onClick={() => {
                p.act(payload);
                onClose();
              }}
              className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border text-xs font-medium transition-all active:scale-95 ${p.tile}`}
            >
              <Icon className={`h-5 w-5 ${p.iconCls}`} />
              <span className="text-foreground/80 leading-tight text-center text-[11px]">
                {p.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
  trend,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  accent: string;
  trend?: string;
}) {
  return (
    <div className="bg-white rounded-xl p-3.5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-2.5">
        <div
          className={`h-8 w-8 rounded-lg flex items-center justify-center ${accent}`}
        >
          <Icon className="h-3.5 w-3.5" />
        </div>
        {trend && (
          <span className="flex items-center gap-0.5 text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">
            <TrendingUp className="h-2.5 w-2.5" />
            {trend}
          </span>
        )}
      </div>
      <p className="text-lg font-bold tracking-tight text-gray-900 leading-none mb-0.5">
        {value}
      </p>
      <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider leading-tight">
        {label}
      </p>
    </div>
  );
}

// ── Delivery Card ─────────────────────────────────────────────────────────────

function DeliveryCard({
  delivery,
  showTrack = true,
  cancellingId,
  onTrack,
  onRate,
  onCancel,
  onShare,
  onReport,
  onReceipt,
}: {
  delivery: DeliveryRequest;
  showTrack?: boolean;
  cancellingId: string | null;
  onTrack: (id: string) => void;
  onRate: (d: DeliveryRequest) => void;
  onCancel: (id: string) => void;
  onShare: (d: DeliveryRequest) => void;
  onReport?: (d: DeliveryRequest) => void;
  onReceipt?: (d: DeliveryRequest) => void;
}) {
  const active = !["completed", "cancelled"].includes(delivery.status);
  const isCompleted = delivery.status === "completed";
  const isCancelled = delivery.status === "cancelled";
  const isActionable = active;
  const displayName = delivery.deliveryName;
  const shortId = delivery.id.slice(0, 8).toUpperCase();

  const price = delivery.finalPrice || delivery.estimatedPrice;
  const showPrice = !active || !!price;

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-3.5 hover:border-primary/20 hover:shadow-sm transition-all duration-200">
      <div className="flex items-start gap-3">
        <div
          className={`h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${isCompleted ? "bg-emerald-50" : isCancelled ? "bg-red-50" : "bg-primary/10"}`}
        >
          <Package
            className={`h-4 w-4 ${isCompleted ? "text-emerald-600" : isCancelled ? "text-red-500" : "text-primary"}`}
          />
        </div>
        <div className="flex-1 min-w-0 overflow-hidden">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                {displayName ? (
                  <span className="font-semibold text-sm text-gray-900 truncate max-w-[160px]">
                    {displayName}
                  </span>
                ) : (
                  <span className="font-semibold text-sm text-gray-900 font-mono">
                    #{shortId}
                  </span>
                )}
                <Badge
                  className={`text-[10px] px-1.5 py-0 h-4.5 flex items-center gap-0.5 flex-shrink-0 border font-medium ${statusColor(delivery.status)}`}
                >
                  {statusIcon(delivery.status)}
                  <span className="capitalize">
                    {delivery.status?.replace(/_/g, " ")}
                  </span>
                </Badge>
              </div>
              {displayName && (
                <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                  #{shortId}
                </p>
              )}
              <p className="text-[11px] text-gray-400 mt-0.5">
                {delivery.createdAt?.toDate().toLocaleString([], {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
              {showPrice ? (
                <span className="font-bold text-primary text-sm whitespace-nowrap">
                  ₦{Number(price || 0).toLocaleString()}
                </span>
              ) : (
                <span className="text-[11px] font-medium text-gray-400">
                  Pending
                </span>
              )}
              {showTrack && isActionable && (
                <div className="flex items-center gap-1.5">
                  {isShareable(delivery.status) && (
                    <button
                      onClick={() => onShare(delivery)}
                      className="h-7 w-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-primary hover:bg-primary/5 border border-gray-100 transition-colors"
                      title="Share tracking link"
                    >
                      <Share2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => onTrack(delivery.id)}
                    className="text-[11px] font-bold bg-primary text-white rounded-lg px-3 py-1.5 transition-all hover:bg-primary/90 active:scale-95 shadow-sm shadow-primary/20 whitespace-nowrap"
                  >
                    Track
                  </button>
                </div>
              )}
              {canCancel(delivery.status) && (
                <button
                  disabled={cancellingId === delivery.id}
                  onClick={() => onCancel(delivery.id)}
                  className="text-[11px] font-semibold text-red-500 hover:bg-red-50 rounded-lg px-2 py-1 transition-colors"
                >
                  {cancellingId === delivery.id ? "…" : "Cancel"}
                </button>
              )}
              {isCompleted && delivery.rating && (
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: delivery.rating.rating }).map(
                    (_, i) => (
                      <Star
                        key={i}
                        className="h-3 w-3 fill-amber-400 text-amber-400"
                      />
                    ),
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="relative pl-3 space-y-1 mt-2">
            <div className="absolute left-0 top-1.5 bottom-1.5 w-px bg-gray-100" />
            <div className="flex items-center gap-2 min-w-0">
              <div className="absolute left-[-3px] w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
              <span className="text-xs text-gray-500 truncate">
                {delivery.pickup?.address || "Pickup"}
              </span>
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <div className="absolute left-[-3px] bottom-0 w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
              <span className="text-xs text-gray-500 truncate">
                {delivery.dropoff?.address || "Dropoff"}
              </span>
            </div>
          </div>

          {isCompleted && (
            <div className="flex items-center gap-1.5 mt-3 pt-2.5 border-t border-gray-50">
              {!delivery.rating && (
                <button
                  onClick={() => onRate(delivery)}
                  className="flex items-center gap-1 text-[11px] font-semibold border border-amber-200 bg-amber-50 text-amber-700 rounded-lg px-2.5 py-1.5 hover:bg-amber-100 transition-colors"
                >
                  <Star className="h-3 w-3" />
                  Review
                </button>
              )}
              {onReceipt && (
                <button
                  onClick={() => onReceipt(delivery)}
                  className="flex items-center gap-1 text-[11px] font-semibold border border-gray-200 bg-gray-50 text-gray-600 rounded-lg px-2.5 py-1.5 hover:bg-gray-100 transition-colors"
                >
                  <FileText className="h-3 w-3" />
                  Receipt
                </button>
              )}
              {onReport && (
                <button
                  onClick={() => onReport(delivery)}
                  className="flex items-center gap-1 text-[11px] font-semibold text-red-400 hover:bg-red-50 rounded-lg px-2.5 py-1.5 transition-colors ml-auto"
                >
                  <AlertTriangle className="h-3 w-3" />
                  Report
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sidebar Nav Item ──────────────────────────────────────────────────────────

function SideNavItem({
  icon: Icon,
  label,
  badge,
  active,
  onClick,
}: {
  id: string;
  icon: React.ElementType;
  label: string;
  badge?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 relative group ${active ? "bg-white text-[#1b5e30] shadow-md" : "text-white/75 hover:bg-white/10 hover:text-white"}`}
    >
      <Icon
        className={`h-5 w-5 flex-shrink-0 ${active ? "text-[#1b5e30]" : "text-white/60 group-hover:text-white"}`}
      />
      <span className="flex-1 text-left">{label}</span>
      {(badge ?? 0) > 0 && (
        <span
          className={`h-5 min-w-5 px-1 rounded-full text-[10px] font-bold flex items-center justify-center ${active ? "bg-[#1b5e30] text-white" : "bg-white/20 text-white"}`}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

// ── Profile Picture Upload ────────────────────────────────────────────────────

function ProfilePictureUpload({
  currentUrl,
  userId,
  onUploaded,
}: {
  currentUrl?: string;
  userId: string;
  onUploaded: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFile = async (file: File) => {
    setUploading(true);
    try {
      const fileRef = storageRef(
        storage,
        `profile-pictures/${userId}/${Date.now()}_${file.name}`,
      );
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);
      await updateDoc(doc(db, "users", userId), {
        photoURL: url,
        updatedAt: Timestamp.now(),
      });
      onUploaded(url);
      toast.success("Profile picture updated!");
    } catch (err: any) {
      toast.error(err?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const uploadBase64 = async (dataUrl: string) => {
    setUploading(true);
    setShowCamera(false);
    try {
      const fileRef = storageRef(
        storage,
        `profile-pictures/${userId}/${Date.now()}_selfie.jpg`,
      );
      await uploadString(fileRef, dataUrl, "data_url");
      const url = await getDownloadURL(fileRef);
      await updateDoc(doc(db, "users", userId), {
        photoURL: url,
        updatedAt: Timestamp.now(),
      });
      onUploaded(url);
      toast.success("Profile picture updated!");
    } catch (err: any) {
      toast.error(err?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }
    setShowOptions(false);
    await uploadFile(file);
  };

  if (showCamera) {
    return (
      <CameraCapture
        title="Take Selfie"
        facingMode="user"
        onCapture={uploadBase64}
        onCancel={() => setShowCamera(false)}
      />
    );
  }

  return (
    <>
      <div
        className="relative group cursor-pointer"
        onClick={() => setShowOptions(true)}
      >
        <Avatar className="h-20 w-20 rounded-2xl ring-2 ring-primary/15 ring-offset-2">
          <AvatarImage src={currentUrl} className="object-cover" />
          <AvatarFallback className="rounded-2xl bg-primary/10 text-primary text-2xl font-bold">
            <User className="h-8 w-8" />
          </AvatarFallback>
        </Avatar>
        <div
          className={`absolute inset-0 rounded-2xl flex items-center justify-center transition-all ${uploading ? "bg-black/40" : "bg-black/0 group-hover:bg-black/40"}`}
        >
          {uploading ? (
            <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Camera className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
        </div>
        <div className="absolute -bottom-1 -right-1 h-6 w-6 bg-primary rounded-full flex items-center justify-center border-2 border-white shadow-sm">
          <Camera className="h-3 w-3 text-white" />
        </div>
      </div>
      {showOptions && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 backdrop-blur-sm"
          onClick={() => setShowOptions(false)}
        >
          <div
            className="bg-white rounded-t-2xl w-full max-w-sm p-5 space-y-2 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-bold text-gray-900 mb-3 text-center">
              Update Profile Photo
            </p>
            <button
              onClick={() => {
                setShowOptions(false);
                setShowCamera(true);
              }}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-primary/5 border border-primary/20 hover:bg-primary/10 transition-colors text-left"
            >
              <div className="h-9 w-9 bg-primary rounded-xl flex items-center justify-center flex-shrink-0">
                <Camera className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="font-semibold text-sm text-gray-900">
                  Take a Selfie
                </p>
                <p className="text-xs text-gray-400">Use your camera</p>
              </div>
            </button>
            <button
              onClick={() => {
                setShowOptions(false);
                fileInputRef.current?.click();
              }}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-gray-50 border border-gray-200 hover:bg-gray-100 transition-colors text-left"
            >
              <div className="h-9 w-9 bg-gray-200 rounded-xl flex items-center justify-center flex-shrink-0">
                <Upload className="h-4 w-4 text-gray-600" />
              </div>
              <div>
                <p className="font-semibold text-sm text-gray-900">
                  Upload from Gallery
                </p>
                <p className="text-xs text-gray-400">
                  Choose an existing photo
                </p>
              </div>
            </button>
            <button
              onClick={() => setShowOptions(false)}
              className="w-full py-3 text-sm font-medium text-gray-400 hover:text-gray-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </>
  );
}

// ── Driver Detail Modal ───────────────────────────────────────────────────────

interface DriverFullProfile {
  profilePhoto: string | null;
  vehicleImages: string[];
  reviews: {
    id: string;
    rating: number;
    feedback?: string;
    customerName?: string;
  }[];
  totalReviews: number;
  isOnDelivery: boolean;
}

function StarRow({
  rating,
  size = "sm",
}: {
  rating: number;
  size?: "sm" | "md";
}) {
  const sz = size === "md" ? "h-4 w-4" : "h-3 w-3";
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`${sz} ${s <= Math.round(rating) ? "fill-amber-400 text-amber-400" : "text-gray-200"}`}
        />
      ))}
    </div>
  );
}

function DriverDetailModal({
  driver,
  onClose,
  onSendDelivery,
}: {
  driver: Driver | null;
  onClose: () => void;
  onSendDelivery: (driver: Driver) => void;
}) {
  const [extra, setExtra] = useState<DriverFullProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeImg, setActiveImg] = useState(0);

  useEffect(() => {
    if (!driver) return;
    setExtra(null);
    setActiveImg(0);
    setLoading(true);
    (async () => {
      try {
        const { getDocs: gdInit, collection: colInit } =
          await import("firebase/firestore");
        const [vSnap, dSnap, uSnap, vpSnap] = await Promise.all([
          getDoc(doc(db, "vehicles", driver.id)),
          getDoc(doc(db, "drivers", driver.id)),
          getDoc(doc(db, "users", driver.id)),
          gdInit(colInit(db, "vehicles", driver.id, "photos")).catch(
            () => null,
          ),
        ]);
        const vData = vSnap.exists() ? (vSnap.data() as any) : {};
        const dData = dSnap.exists() ? (dSnap.data() as any) : {};
        const uData = uSnap.exists() ? (uSnap.data() as any) : {};
        const profilePhoto =
          dData?.selfieUrl ?? uData?.photoURL ?? driver.photoURL ?? null;
        const rawVehicleImages: string[] = [];
        const extractFromObj = (obj: any) => {
          if (!obj || typeof obj !== "object") return;
          Object.values(obj).forEach((v) => {
            if (typeof v === "string" && v.startsWith("http"))
              rawVehicleImages.push(v);
          });
        };
        extractFromObj(vData?.photoUrls);
        extractFromObj(dData?.vehiclePhotoUrls);
        for (const src of [vData, dData]) {
          if (!src) continue;
          for (const field of [
            "images",
            "vehicleImages",
            "photos",
            "carImages",
            "photoURLs",
            "imageUrls",
          ]) {
            if (Array.isArray(src[field])) rawVehicleImages.push(...src[field]);
          }
          for (const field of [
            "photoURL",
            "vehiclePhotoURL",
            "imageUrl",
            "photo",
            "carPhotoURL",
          ]) {
            if (typeof src[field] === "string" && src[field].startsWith("http"))
              rawVehicleImages.push(src[field]);
          }
        }
        if (vpSnap) {
          vpSnap.docs.forEach((d) => {
            const pd = d.data() as any;
            for (const field of [
              "url",
              "photoURL",
              "imageUrl",
              "image",
              "photo",
            ]) {
              if (typeof pd[field] === "string" && pd[field].startsWith("http"))
                rawVehicleImages.push(pd[field]);
            }
          });
        }
        if (driver.vehiclePhotoURL)
          rawVehicleImages.push(driver.vehiclePhotoURL);
        const vehicleImages = rawVehicleImages
          .filter(
            (url): url is string =>
              typeof url === "string" && url.startsWith("http"),
          )
          .filter((v, i, a) => a.indexOf(v) === i);
        let isOnDelivery = false;
        try {
          const {
            getDocs: gd,
            query: q,
            collection: col,
            where: wh,
          } = await import("firebase/firestore");
          const [reqSnap, assignSnap] = await Promise.all([
            gd(
              q(
                col(db, "delivery_requests"),
                wh("driverId", "==", driver.id),
                wh("status", "in", [
                  "driver_assigned",
                  "in_progress",
                  "arrived",
                ]),
              ),
            ),
            gd(
              q(
                col(db, "assignments"),
                wh("driverId", "==", driver.id),
                wh("driverAccepted", "==", true),
              ),
            ),
          ]);
          isOnDelivery =
            !reqSnap.empty ||
            assignSnap.docs.some((d) => !(d.data() as any).completedAt);
        } catch {}
        let reviews: DriverFullProfile["reviews"] = [];
        try {
          const {
            getDocs: gd,
            query: q,
            collection: col,
            where: wh,
            limit: lm,
          } = await import("firebase/firestore");
          const reqSnap = await gd(
            q(
              col(db, "delivery_requests"),
              wh("driverId", "==", driver.id),
              wh("status", "==", "completed"),
              lm(30),
            ),
          );
          const enriched = await Promise.all(
            reqSnap.docs.map(async (r) => {
              const rd = r.data() as any;
              if (!rd.rating?.rating) return null;
              let customerName = "Customer";
              try {
                const cSnap = await getDoc(doc(db, "users", rd.customerId));
                if (cSnap.exists()) {
                  const cd = cSnap.data() as any;
                  customerName =
                    [cd.firstName, cd.lastName].filter(Boolean).join(" ") ||
                    "Customer";
                }
              } catch {}
              return {
                id: r.id,
                rating: rd.rating.rating as number,
                feedback: rd.rating.feedback as string | undefined,
                customerName,
                _ts: rd.updatedAt?.seconds ?? 0,
              };
            }),
          );
          reviews = enriched
            .filter(Boolean)
            .sort(
              (a: any, b: any) => b._ts - a._ts,
            ) as DriverFullProfile["reviews"];
          if (reviews.length === 0) {
            const assignSnap = await gd(
              q(
                col(db, "assignments"),
                wh("driverId", "==", driver.id),
                lm(30),
              ),
            );
            const fallback = await Promise.all(
              assignSnap.docs.map(async (a) => {
                const ad = a.data() as any;
                if (!ad.completedAt) return null;
                const reqDoc = await getDoc(
                  doc(db, "delivery_requests", ad.requestId),
                );
                if (!reqDoc.exists()) return null;
                const rd = reqDoc.data() as any;
                if (!rd.rating?.rating) return null;
                let customerName = "Customer";
                try {
                  const cSnap = await getDoc(doc(db, "users", rd.customerId));
                  if (cSnap.exists()) {
                    const cd = cSnap.data() as any;
                    customerName =
                      [cd.firstName, cd.lastName].filter(Boolean).join(" ") ||
                      "Customer";
                  }
                } catch {}
                return {
                  id: a.id,
                  rating: rd.rating.rating as number,
                  feedback: rd.rating.feedback as string | undefined,
                  customerName,
                  _ts: ad.completedAt?.seconds ?? 0,
                };
              }),
            );
            reviews = fallback
              .filter(Boolean)
              .sort(
                (a: any, b: any) => b._ts - a._ts,
              ) as DriverFullProfile["reviews"];
          }
        } catch (e) {
          console.error("Reviews fetch:", e);
        }
        setExtra({
          profilePhoto,
          vehicleImages,
          reviews,
          totalReviews: reviews.length,
          isOnDelivery,
        });
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [driver?.id]);

  if (!driver) return null;
  const name =
    [driver.firstName, driver.lastName].filter(Boolean).join(" ") || "Driver";
  const rating = driver.averageRating ?? driver.rating ?? 5.0;
  const deliveries = driver.totalDeliveries ?? driver.completedDeliveries ?? 0;
  const avgReview = extra?.reviews.length
    ? extra.reviews.reduce((s, r) => s + r.rating, 0) / extra.reviews.length
    : rating;
  const fetchedImages = extra?.vehicleImages ?? [];
  const allImages =
    fetchedImages.length > 0
      ? fetchedImages
      : driver.vehiclePhotoURL
        ? [driver.vehiclePhotoURL]
        : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[92dvh] flex flex-col">
        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 flex-shrink-0">
          <h2 className="font-bold text-base text-gray-900">Driver Profile</h2>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <p className="text-sm text-gray-400">Loading profile…</p>
            </div>
          ) : (
            <div className="p-5 space-y-5">
              <div className="flex items-start gap-4">
                <div className="relative flex-shrink-0">
                  <div className="h-24 w-24 rounded-2xl overflow-hidden ring-2 ring-primary/15 ring-offset-2 bg-gray-100">
                    {extra?.profilePhoto ? (
                      <img
                        src={extra.profilePhoto}
                        alt={name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-primary/10">
                        <span className="text-3xl font-bold text-primary">
                          {driver.firstName?.[0]}
                          {driver.lastName?.[0]}
                        </span>
                      </div>
                    )}
                  </div>
                  {(driver.isOnline || extra?.isOnDelivery) && (
                    <span className="absolute -bottom-1 -right-1 flex h-5 w-5">
                      <span
                        className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${extra?.isOnDelivery ? "bg-amber-400" : "bg-emerald-400"}`}
                      />
                      <span
                        className={`relative inline-flex rounded-full h-5 w-5 border-2 border-white ${extra?.isOnDelivery ? "bg-amber-500" : "bg-emerald-500"}`}
                      />
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0 pt-1">
                  <h3 className="font-bold text-lg text-gray-900 leading-tight truncate">
                    {name}
                  </h3>
                  <p className="text-xs text-gray-400 capitalize mt-0.5">
                    {driver.vehicleType?.replace(/_/g, " ") || "Driver"}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <StarRow rating={avgReview} size="sm" />
                    <span className="text-sm font-bold text-gray-800">
                      {avgReview.toFixed(1)}
                    </span>
                    {extra && extra.totalReviews > 0 && (
                      <span className="text-xs text-gray-400">
                        ({extra.totalReviews})
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${extra?.isOnDelivery ? "bg-amber-50 text-amber-700 border-amber-200" : driver.isOnline ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-gray-100 text-gray-400 border-gray-200"}`}
                    >
                      {extra?.isOnDelivery
                        ? "🚚 On a Delivery"
                        : driver.isOnline
                          ? "● Online"
                          : "○ Offline"}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-primary/5 text-primary border-primary/20">
                      {deliveries} deliveries
                    </span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  {
                    label: "Rating",
                    value: avgReview.toFixed(1),
                    bg: "bg-amber-50 border-amber-100",
                    val_cls: "text-amber-600",
                  },
                  {
                    label: "Deliveries",
                    value: deliveries,
                    bg: "bg-primary/5 border-primary/10",
                    val_cls: "text-primary",
                  },
                  {
                    label: "Reviews",
                    value: extra?.totalReviews ?? 0,
                    bg: "bg-emerald-50 border-emerald-100",
                    val_cls: "text-emerald-600",
                  },
                ].map((s) => (
                  <div
                    key={s.label}
                    className={`rounded-2xl border p-3 ${s.bg}`}
                  >
                    <p className={`text-lg font-bold ${s.val_cls}`}>
                      {s.value}
                    </p>
                    <p className="text-[10px] text-gray-400 font-medium mt-0.5">
                      {s.label}
                    </p>
                  </div>
                ))}
              </div>
              {(driver.carModel || driver.plateNumber) && (
                <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 space-y-2">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                    Vehicle
                  </p>
                  {driver.carModel && (
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Car className="h-4 w-4 text-primary" />
                      </div>
                      <span className="font-semibold text-sm text-gray-800">
                        {driver.carModel}
                      </span>
                    </div>
                  )}
                  {driver.plateNumber && (
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-xl bg-gray-200 flex items-center justify-center flex-shrink-0">
                        <Hash className="h-4 w-4 text-gray-500" />
                      </div>
                      <span className="font-mono font-bold text-sm text-gray-800">
                        {driver.plateNumber}
                      </span>
                    </div>
                  )}
                </div>
              )}
              {allImages.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    Vehicle Photos ({allImages.length})
                  </p>
                  <div className="relative h-52 bg-gray-100 rounded-2xl overflow-hidden">
                    <img
                      src={allImages[activeImg]}
                      alt="Vehicle"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                    {allImages.length > 1 && (
                      <>
                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                          {allImages.map((_, i) => (
                            <button
                              key={i}
                              onClick={() => setActiveImg(i)}
                              className={`h-1.5 rounded-full transition-all ${i === activeImg ? "bg-white w-4" : "bg-white/60 w-1.5"}`}
                            />
                          ))}
                        </div>
                        <button
                          onClick={() =>
                            setActiveImg(
                              (i) =>
                                (i - 1 + allImages.length) % allImages.length,
                            )
                          }
                          className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 bg-black/40 rounded-full flex items-center justify-center text-white hover:bg-black/60 transition-colors text-lg font-bold"
                        >
                          ‹
                        </button>
                        <button
                          onClick={() =>
                            setActiveImg((i) => (i + 1) % allImages.length)
                          }
                          className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 bg-black/40 rounded-full flex items-center justify-center text-white hover:bg-black/60 transition-colors text-lg font-bold"
                        >
                          ›
                        </button>
                      </>
                    )}
                  </div>
                  {allImages.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {allImages.map((img, i) => (
                        <button
                          key={i}
                          onClick={() => setActiveImg(i)}
                          className={`flex-shrink-0 h-14 w-14 rounded-xl overflow-hidden border-2 transition-all ${i === activeImg ? "border-primary" : "border-transparent opacity-60"}`}
                        >
                          <img
                            src={img}
                            alt={`Vehicle ${i + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-28 bg-gray-50 border border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center gap-1.5">
                  <Car className="h-7 w-7 text-gray-300" />
                  <p className="text-xs text-gray-400">
                    Driver hasn't added vehicle photos yet
                  </p>
                </div>
              )}
              {driver.phone && (
                <a
                  href={`tel:${driver.phone}`}
                  className="flex items-center gap-3 px-4 py-3 bg-primary/5 border border-primary/20 rounded-2xl hover:bg-primary/10 transition-colors"
                >
                  <div className="h-9 w-9 bg-primary rounded-xl flex items-center justify-center flex-shrink-0">
                    <Phone className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider">
                      Phone
                    </p>
                    <p className="font-semibold text-sm text-gray-900">
                      {driver.phone}
                    </p>
                  </div>
                </a>
              )}
              <div className="space-y-3">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Customer Reviews
                </p>
                {extra && extra.reviews.length > 0 ? (
                  <div className="space-y-2.5">
                    {extra.reviews.slice(0, 4).map((rv) => (
                      <div
                        key={rv.id}
                        className="bg-gray-50 border border-gray-100 rounded-2xl p-3.5"
                      >
                        <div className="flex items-center gap-2.5 mb-2">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-bold text-primary">
                              {rv.customerName?.[0] ?? "C"}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-800">
                              {rv.customerName}
                            </p>
                            <StarRow rating={rv.rating} size="sm" />
                          </div>
                        </div>
                        {rv.feedback ? (
                          <p className="text-sm text-gray-600 leading-relaxed">
                            {rv.feedback}
                          </p>
                        ) : (
                          <p className="text-xs text-gray-400 italic">
                            No written feedback
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-gray-50 border border-dashed border-gray-200 rounded-2xl p-6 text-center">
                    <Star className="h-7 w-7 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">No reviews yet</p>
                  </div>
                )}
              </div>
              <div className="h-2" />
            </div>
          )}
        </div>
        <div className="flex-shrink-0 px-5 py-4 border-t border-gray-100 bg-white space-y-2.5">
          {extra?.isOnDelivery && (
            <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
              <div className="h-8 w-8 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                <Truck className="h-4 w-4 text-amber-600" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-amber-900">
                  Currently on a delivery
                </p>
                <p className="text-xs text-amber-700 mt-0.5">
                  This driver is busy right now. Try again soon.
                </p>
              </div>
            </div>
          )}
          {!driver.isOnline && !extra?.isOnDelivery && (
            <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3">
              <div className="h-8 w-8 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                <User className="h-4 w-4 text-gray-400" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-600">
                  Driver is offline
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Not available for new deliveries at this time.
                </p>
              </div>
            </div>
          )}
          <button
            onClick={() => {
              onClose();
              onSendDelivery(driver);
            }}
            disabled={!driver.isOnline || !!extra?.isOnDelivery}
            className="w-full flex items-center justify-center gap-2.5 bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:pointer-events-none text-white font-bold text-sm py-3.5 rounded-2xl shadow-md shadow-primary/25 transition-all active:scale-[0.98]"
          >
            <Package className="h-5 w-5" />
            {!driver.isOnline
              ? "Driver is Offline"
              : extra?.isOnDelivery
                ? "Driver Unavailable"
                : "Send a Delivery with this Driver"}
          </button>
          {driver.phone && (
            <a
              href={`tel:${driver.phone}`}
              className="w-full flex items-center justify-center gap-2 border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700 font-semibold text-sm py-3 rounded-2xl transition-colors"
            >
              <Phone className="h-4 w-4" />
              Call {driver.firstName || "Driver"}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Review Dialog ─────────────────────────────────────────────────────────────

function ReviewDialog({
  delivery,
  driverInfo,
  onSubmit,
  onClose,
}: {
  delivery: DeliveryRequest | null;
  driverInfo: Driver | null;
  onSubmit: (deliveryId: string, rating: number, feedback: string) => void;
  onClose: () => void;
}) {
  const [ratingValue, setRatingValue] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [hoveredStar, setHoveredStar] = useState(0);
  const ratingLabels = ["", "Poor", "Fair", "Good", "Great", "Excellent"];
  const handleClose = () => {
    setRatingValue(0);
    setFeedback("");
    setHoveredStar(0);
    onClose();
  };
  return (
    <Dialog open={!!delivery} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg w-full rounded-2xl bg-white overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-gray-900">
            Rate Your Delivery
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            How was your experience?
          </DialogDescription>
        </DialogHeader>
        <div className="py-2 space-y-5">
          {driverInfo && (
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100 overflow-hidden min-w-0">
              <Avatar className="h-11 w-11 rounded-xl flex-shrink-0">
                <AvatarImage src={driverInfo.photoURL} />
                <AvatarFallback className="rounded-xl bg-primary/10 text-primary text-sm font-bold">
                  {driverInfo.firstName?.[0]}
                  {driverInfo.lastName?.[0]}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm text-gray-900 truncate">
                  {[driverInfo.firstName, driverInfo.lastName]
                    .filter(Boolean)
                    .join(" ") || "Your Driver"}
                </p>
                <p className="text-xs text-gray-400 capitalize truncate">
                  {driverInfo.vehicleType?.replace(/_/g, " ") || "Driver"}
                </p>
              </div>
            </div>
          )}
          {delivery && (
            <div className="space-y-1.5 px-1 overflow-hidden">
              <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                <span className="text-xs text-gray-500 truncate min-w-0 flex-1">
                  {delivery.pickup?.address}
                </span>
              </div>
              <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                <span className="text-xs text-gray-500 truncate min-w-0 flex-1">
                  {delivery.dropoff?.address}
                </span>
              </div>
            </div>
          )}
          <div className="flex flex-col items-center gap-2">
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  onClick={() => setRatingValue(s)}
                  onMouseEnter={() => setHoveredStar(s)}
                  onMouseLeave={() => setHoveredStar(0)}
                  className="p-1 transition-transform hover:scale-110 active:scale-95"
                >
                  <Star
                    className={`h-7 w-7 transition-colors ${s <= (hoveredStar || ratingValue) ? "fill-amber-400 text-amber-400" : "text-gray-200"}`}
                  />
                </button>
              ))}
            </div>
            {(hoveredStar || ratingValue) > 0 && (
              <p className="text-sm font-semibold text-amber-600">
                {ratingLabels[hoveredStar || ratingValue]}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-500">
              Leave a comment <span className="text-gray-300">(optional)</span>
            </Label>
            <Textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Tell us about your experience with the driver..."
              className="rounded-xl border-gray-200 resize-none min-h-[80px] focus-visible:ring-primary/30 w-full"
              maxLength={300}
            />
            <p className="text-[10px] text-gray-400 text-right pr-0.5">
              {feedback.length}/300
            </p>
          </div>
          <Button
            className="w-full rounded-xl h-11 font-semibold shadow-sm shadow-primary/20"
            disabled={!ratingValue}
            onClick={() =>
              delivery && onSubmit(delivery.id, ratingValue, feedback)
            }
          >
            Submit Review
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Report Driver Dialog ──────────────────────────────────────────────────────

function ReportDriverDialog({
  delivery,
  onClose,
}: {
  delivery: DeliveryRequest | null;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const reasons = [
    "Rude behaviour",
    "Late delivery",
    "Wrong route",
    "Item damaged",
    "No-show",
    "Other",
  ];
  const handleSubmit = async () => {
    if (!delivery || !reason) return;
    setSubmitting(true);
    try {
      await addDoc(collection(db, "driver_reports"), {
        deliveryId: delivery.id,
        driverId: delivery.driverId ?? null,
        customerId: delivery.customerId,
        reason,
        details: details.trim() || null,
        createdAt: Timestamp.now(),
        status: "pending",
      });
      await addDoc(collection(db, "admin_notifications"), {
        type: "driver_report",
        requestId: delivery.id,
        message: `Customer reported driver: ${reason}`,
        read: false,
        createdAt: Timestamp.now(),
      });
      toast.success("Report submitted. We'll review it shortly.");
      setReason("");
      setDetails("");
      onClose();
    } catch {
      toast.error("Failed to submit report");
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <Dialog open={!!delivery} onOpenChange={onClose}>
      <DialogContent className="max-w-sm rounded-2xl bg-white">
        <DialogHeader>
          <DialogTitle className="text-gray-900 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            Report Driver
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Help us keep the platform safe.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label className="text-xs font-medium text-gray-500 mb-2 block">
              Reason
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {reasons.map((r) => (
                <button
                  key={r}
                  onClick={() => setReason(r)}
                  className={`px-3 py-2.5 rounded-xl border text-xs font-semibold text-left transition-all ${reason === r ? "bg-red-50 border-red-300 text-red-700" : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"}`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs font-medium text-gray-500 mb-1.5 block">
              Additional details{" "}
              <span className="text-gray-300">(optional)</span>
            </Label>
            <Textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Tell us what happened..."
              className="rounded-xl border-gray-200 resize-none min-h-[80px] focus-visible:ring-primary/30"
              maxLength={400}
            />
          </div>
          <Button
            className="w-full rounded-xl h-11 bg-red-600 hover:bg-red-700 text-white font-semibold"
            disabled={!reason || submitting}
            onClick={handleSubmit}
          >
            {submitting ? "Submitting…" : "Submit Report"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Receipt Dialog ────────────────────────────────────────────────────────────

function ReceiptDialog({
  delivery,
  profile,
  onClose,
}: {
  delivery: DeliveryRequest | null;
  profile: UserProfile | null;
  onClose: () => void;
}) {
  if (!delivery) return null;
  const price = delivery.finalPrice ?? delivery.estimatedPrice ?? 0;
  const shortId = delivery.id.slice(0, 8).toUpperCase();
  const date = delivery.createdAt?.toDate().toLocaleString() ?? "–";
  const name =
    [profile?.firstName, profile?.lastName].filter(Boolean).join(" ") ||
    "Customer";
  const handlePrint = () => {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(
      `<html><head><title>Receipt – ${shortId}</title><style>body{font-family:'Helvetica Neue',Arial,sans-serif;max-width:420px;margin:40px auto;color:#1a1a1a}.logo{font-size:22px;font-weight:800;color:#1b5e30;margin-bottom:4px}.sub{font-size:11px;color:#888;margin-bottom:24px}h2{font-size:16px;margin-bottom:16px;border-bottom:1px solid #eee;padding-bottom:8px}.row{display:flex;justify-content:space-between;margin-bottom:8px;font-size:13px}.label{color:#666}.value{font-weight:600}.total{font-size:18px;font-weight:800;color:#1b5e30;border-top:2px solid #eee;padding-top:12px;margin-top:12px}.footer{margin-top:32px;font-size:11px;color:#aaa;text-align:center}.addr{background:#f9f9f9;border-radius:8px;padding:10px 12px;margin:8px 0;font-size:12px}.dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px}</style></head><body><div class="logo">Pilnak</div><div class="sub">Delivery Receipt</div><h2>Receipt #${shortId}</h2><div class="row"><span class="label">Customer</span><span class="value">${name}</span></div><div class="row"><span class="label">Date</span><span class="value">${date}</span></div><div class="row"><span class="label">Status</span><span class="value" style="text-transform:capitalize">${delivery.status.replace(/_/g, " ")}</span></div>${delivery.deliveryName ? `<div class="row"><span class="label">Delivery Name</span><span class="value">${delivery.deliveryName}</span></div>` : ""}<div class="addr"><span class="dot" style="background:#22c55e"></span><strong>Pickup:</strong> ${delivery.pickup?.address ?? "–"}</div><div class="addr"><span class="dot" style="background:#ef4444"></span><strong>Drop-off:</strong> ${delivery.dropoff?.address ?? "–"}</div><div class="row total"><span>Total Paid</span><span>₦${Number(price).toLocaleString()}</span></div><div class="footer">Thank you for using Pilnak · support@pilnak.com</div></body></html>`,
    );
    w.document.close();
    w.focus();
    setTimeout(() => {
      w.print();
    }, 300);
  };
  return (
    <Dialog open={!!delivery} onOpenChange={onClose}>
      <DialogContent className="max-w-lg w-full rounded-2xl bg-white overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-gray-900 flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Delivery Receipt
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Receipt for delivery #{shortId}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 space-y-2.5 text-sm">
            {[
              { label: "Customer", value: name, wrap: false },
              { label: "Date", value: date, wrap: false },
              {
                label: "Status",
                value: delivery.status.replace(/_/g, " "),
                wrap: false,
              },
              ...(delivery.deliveryName
                ? [{ label: "Name", value: delivery.deliveryName, wrap: true }]
                : []),
            ].map(({ label, value, wrap }) => (
              <div
                key={label}
                className={`flex items-baseline gap-4 ${wrap ? "flex-wrap" : "justify-between"}`}
              >
                <span className="text-gray-400 flex-shrink-0 text-xs uppercase tracking-wide">
                  {label}
                </span>
                <span
                  className={`font-semibold text-gray-900 capitalize text-right flex-1 min-w-0 ${wrap ? "break-words" : "truncate"}`}
                >
                  {value}
                </span>
              </div>
            ))}
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2.5 text-xs min-w-0">
              <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
              <span className="text-gray-600 truncate min-w-0 flex-1">
                {delivery.pickup?.address}
              </span>
            </div>
            <div className="flex items-center gap-2.5 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5 text-xs min-w-0">
              <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
              <span className="text-gray-600 truncate min-w-0 flex-1">
                {delivery.dropoff?.address}
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-xl px-4 py-3 gap-4">
            <span className="text-sm font-semibold text-gray-700 flex-shrink-0">
              Total Paid
            </span>
            <span className="text-lg font-bold text-primary">
              ₦{Number(price).toLocaleString()}
            </span>
          </div>
          <Button
            className="w-full rounded-xl h-11 font-semibold"
            onClick={handlePrint}
          >
            <FileText className="h-4 w-4 mr-2" />
            Print / Save PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Generate referral code ────────────────────────────────────────────────────

function makeReferralCode(uid: string): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "PIL";
  for (let i = 0; i < 5; i++) {
    const a = uid.charCodeAt(i * 4) || 0;
    const b = uid.charCodeAt(i * 4 + 1) || 0;
    code += chars[(a * 31 + b) % chars.length];
  }
  return code;
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export default function CustomerDashboard() {
  const navigate = useNavigate();
  const booking = useBookingOptional();

  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [customer, setCustomer] = useState<CustomerData | null>(null);

  // ── Persisted across refresh ──────────────────────────────────────────────
  const [activeTab, setActiveTab] = useSessionState<TabType>(
    "customer_activeTab",
    "home",
  );
  const [viewMode, setViewMode] = useSessionState<ViewMode>(
    "customer_viewMode",
    "default",
  );
  const [selectedDelivery, setSelectedDelivery] = useSessionState<
    string | null
  >("customer_selectedDelivery", null);

  // ── Hero booking pre-fill ─────────────────────────────────────────────────
  const [heroBooking, setHeroBooking] = useState<HeroBooking | null>(null);

  const [nearbyDrivers, setNearbyDrivers] = useState<Driver[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryRequest[]>([]);
  const [selectedForRating, setSelectedForRating] =
    useState<DeliveryRequest | null>(null);
  const [ratingDriverInfo, setRatingDriverInfo] = useState<Driver | null>(null);
  const handleShare = async (delivery: DeliveryRequest) => {
    const mapsUrl = buildGoogleMapsUrl(delivery, null);
    const label =
      delivery.deliveryName ||
      `Delivery #${delivery.id.slice(0, 8).toUpperCase()}`;
    const title = `Track ${label} on Pilnak`;

    const copyToClipboard = async () => {
      try {
        await navigator.clipboard.writeText(mapsUrl);
        toast.success("Tracking link copied to clipboard!");
      } catch {
        toast.info(mapsUrl, {
          description: "Copy the link above to share",
          duration: 10000,
        });
      }
    };

    // Use native share sheet only on touch devices (mobile/tablet).
    // Desktop native share (Windows Share) has no useful app targets.
    const isTouchDevice = window.matchMedia("(pointer: coarse)").matches;

    if (isTouchDevice && navigator.share) {
      try {
        await navigator.share({ title, url: mapsUrl });
      } catch (err: any) {
        if (err?.name !== "AbortError") await copyToClipboard();
      }
    } else {
      await copyToClipboard();
    }
  };
  const [selectedDriverDetail, setSelectedDriverDetail] =
    useState<Driver | null>(null);
  const [preselectedDriver, setPreselectedDriver] = useState<Driver | null>(
    null,
  );
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editForm, setEditForm] = useState<UserProfile>({});
  const [activeCall, setActiveCall] = useState<{
    userId: string;
    userName: string;
  } | null>(null);
  const [activeChat, setActiveChat] = useSessionState<{
    id: string;
    driverId: string;
  } | null>("customer_activeChat", null);
  const [activeSupportChat, setActiveSupportChat] = useState(false);
  // Maps requestId → { name, driverId } for the Messages tab.
  // Only populated for deliveries where a driver is already assigned.
  const [chatDriverInfo, setChatDriverInfo] = useState<
    Record<string, { name: string; driverId: string; photoUrl?: string }>
  >({});
  const [isLoadingDriverInfo, setIsLoadingDriverInfo] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const knownCustomerNotifIds = useRef<Set<string> | null>(null);
  const [showNotificationsDesktop, setShowNotificationsDesktop] =
    useState(false);
  const [showNotificationsMobile, setShowNotificationsMobile] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [chatOverlayH, setChatOverlayH] = useState(
    () => window.visualViewport?.height ?? window.innerHeight,
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredDeliveries, setFilteredDeliveries] = useState<
    DeliveryRequest[]
  >([]);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [deliveryStats, setDeliveryStats] = useState({
    total: 0,
    completed: 0,
    cancelled: 0,
    inProgress: 0,
    totalSpent: 0,
  });
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [selectedForReport, setSelectedForReport] =
    useState<DeliveryRequest | null>(null);
  const [selectedForReceipt, setSelectedForReceipt] =
    useState<DeliveryRequest | null>(null);
  const [emergencyContact, setEmergencyContact] = useState("");
  const [emergencyName, setEmergencyName] = useState("");
  const [smsAlertNumber, setSmsAlertNumber] = useState("");
  const [preferredPickup, setPreferredPickup] = useState("");
  const [pushNotifications, setPushNotifications] = useState(false);
  const [notificationSound, setNotificationSound] = useState(true);
  const [notificationVibration, setNotificationVibration] = useState(true);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const pushNotifEnabledRef = useRef(false);
  const desktopMainRef = useRef<HTMLElement>(null);

  const {
    latitude,
    longitude,
    isPermissionGranted,
    requestPermission,
    startWatching,
    stopWatching,
  } = useGeolocation({ saveToDatabase: true });

  useEffect(() => {
    setLocationEnabled(isPermissionGranted === true);
  }, [isPermissionGranted]);

  // Auth + hero booking detection
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fu) => {
      if (!fu) {
        navigate("/auth?role=customer");
        return;
      }
      setUser(fu);
      try {
        const [ps, cs] = await Promise.all([
          getDoc(doc(db, "users", fu.uid)),
          getDoc(doc(db, "customers", fu.uid)),
        ]);
        const pd = ps.exists() ? (ps.data() as UserProfile) : null;
        if (pd) {
          setProfile(pd);
          setEditForm(pd);
          setEmergencyContact(pd.emergencyContact ?? "");
          setEmergencyName(pd.emergencyName ?? "");
          setSmsAlertNumber(pd.smsAlertNumber ?? "");
          setPreferredPickup(pd.preferredPickupAddress ?? "");
          setPushNotifications(pd.pushNotifications ?? false);
          setNotificationSound(pd.notificationSound ?? true);
          setNotificationVibration(pd.notificationVibration ?? true);
        }
        if (cs.exists()) {
          const cd = cs.data() as CustomerData;
          setCustomer(cd);
          setSavedAddresses(cd.savedAddresses || []);
        } else {
          const nc: CustomerData = {
            userId: fu.uid,
            savedAddresses: [],
            totalDeliveries: 0,
            createdAt: Timestamp.now(),
          };
          await setDoc(doc(db, "customers", fu.uid), nc);
          setCustomer(nc);
        }
      } catch (e) {
        console.error(e);
      }
      setIsLoading(false);

      // ── Check for hero booking from landing page ──────────────────────────
      try {
        const raw = localStorage.getItem(HERO_BOOKING_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as HeroBooking;
          if (parsed.pickup?.lat && parsed.dropoff?.lat) {
            localStorage.removeItem(HERO_BOOKING_KEY);
            setHeroBooking(parsed);
            // Also push into BookingContext so the form can read it
            if (booking) {
              booking.setPickup(parsed.pickup);
              booking.setDropoff(parsed.dropoff);
            }
            setViewMode("new-request");
          }
        }
      } catch {}

      // Legacy pendingBooking key
      const pb = localStorage.getItem("pendingBooking");
      if (pb) {
        localStorage.removeItem("pendingBooking");
        setViewMode("new-request");
      }

      if (isPermissionGranted === null) {
        (async () => {
          const ok = await requestPermission();
          if (ok) {
            startWatching();
            setLocationEnabled(true);
          }
        })();
      }
    });
    return () => unsub();
  }, [navigate]); // eslint-disable-line

  // Deliveries
  useEffect(() => {
    if (!user?.uid) return;
    const q = query(
      collection(db, "delivery_requests"),
      where("customerId", "==", user.uid),
      orderBy("createdAt", "desc"),
    );
    return onSnapshot(q, (snap) => {
      const list = snap.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as DeliveryRequest,
      );
      setDeliveries(list);
      setFilteredDeliveries(
        searchQuery
          ? list.filter(
              (d) =>
                d.deliveryName
                  ?.toLowerCase()
                  .includes(searchQuery.toLowerCase()) ||
                d.pickup?.address
                  ?.toLowerCase()
                  .includes(searchQuery.toLowerCase()) ||
                d.dropoff?.address
                  ?.toLowerCase()
                  .includes(searchQuery.toLowerCase()),
            )
          : list,
      );
      setDeliveryStats({
        total: list.length,
        completed: list.filter((d) => d.status === "completed").length,
        cancelled: list.filter((d) => d.status === "cancelled").length,
        inProgress: list.filter(
          (d) => !["completed", "cancelled"].includes(d.status),
        ).length,
        totalSpent: list
          .filter((d) => d.status === "completed")
          .reduce(
            (s, d) =>
              s + (Number(d.finalPrice) || Number(d.estimatedPrice) || 0),
            0,
          ),
      });
    });
  }, [user?.uid, searchQuery]);

  // Fetch driver name + driverId for every active delivery so the Messages tab
  // can show the driver's name instead of the delivery name.
  // Runs whenever the deliveries list changes (i.e. on every Firestore snapshot).
  useEffect(() => {
    const active = deliveries.filter(
      (d) => !["completed", "cancelled"].includes(d.status),
    );
    if (active.length === 0) {
      setChatDriverInfo({});
      return;
    }

    let cancelled = false;
    setIsLoadingDriverInfo(true);

    (async () => {
      const results: Record<
        string,
        { name: string; driverId: string; photoUrl?: string }
      > = {};

      await Promise.all(
        active.map(async (d) => {
          try {
            let driverId = d.driverId;

            // driverId may not be written to the delivery doc directly —
            // fall back to the assignments subcollection.
            if (!driverId) {
              const assignSnap = await getDocs(
                query(
                  collection(db, "assignments"),
                  where("requestId", "==", d.id),
                  limit(1),
                ),
              );
              driverId = (assignSnap.docs[0]?.data() as any)?.driverId;
            }

            if (!driverId) return; // No driver assigned yet — exclude from list

            // Fetch user doc (name + photoURL) and driver doc (selfieUrl) in parallel
            const [userSnap, driverSnap] = await Promise.all([
              getDoc(doc(db, "users", driverId)),
              getDoc(doc(db, "drivers", driverId)),
            ]);
            if (!userSnap.exists()) return;

            const ud = userSnap.data() as any;
            const dd = driverSnap.exists() ? (driverSnap.data() as any) : null;
            const name =
              [ud.firstName, ud.lastName].filter(Boolean).join(" ") || "Driver";
            // Prefer the driver's selfie (uploaded during registration) over
            // the Google OAuth photo, which may be generic or missing.
            const photoUrl: string | undefined =
              dd?.selfieUrl || ud?.photoURL || undefined;
            results[d.id] = { name, driverId, photoUrl };
          } catch {
            // skip this delivery on error — it just won't appear in the list
          }
        }),
      );

      if (!cancelled) {
        setChatDriverInfo(results);
        setIsLoadingDriverInfo(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [deliveries]);

  // Nearby drivers
  useEffect(() => {
    if (!latitude || !longitude) return;
    const q = query(
      collection(db, "drivers"),
      where("isOnline", "==", true),
      where("status", "==", "approved"),
    );
    return onSnapshot(q, async (snap) => {
      const raw = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as Driver)
        .filter((dr) => {
          const lat = dr.currentLocation?.lat,
            lng = dr.currentLocation?.lng;
          if (!lat || !lng) return false;
          const dx = Math.abs(lat - latitude) * 111,
            dy =
              Math.abs(lng - longitude) *
              111 *
              Math.cos(latitude * (Math.PI / 180));
          return Math.sqrt(dx * dx + dy * dy) < 10;
        });
      const enriched = await Promise.all(
        raw.map(async (dr) => {
          let e = { ...dr };
          try {
            const us = await getDoc(doc(db, "users", dr.id));
            if (us.exists()) {
              const u = us.data() as any;
              e = {
                ...e,
                firstName: u.firstName,
                lastName: u.lastName,
                photoURL:
                  (e as any).selfieUrl || u.photoURL || (e as any).photoURL,
                phone: u.phone,
              };
            }
          } catch {}
          try {
            const vs = await getDoc(doc(db, "vehicles", dr.id));
            if (vs.exists()) {
              const v = vs.data() as any;
              e = {
                ...e,
                plateNumber: v.plateNumber,
                carModel:
                  [v.brand, v.model].filter(Boolean).join(" ") || v.vehicleType,
                vehiclePhotoURL: v.photoURL,
              };
            }
          } catch {}
          return e;
        }),
      );
      setNearbyDrivers(enriched);
    });
  }, [latitude, longitude]);

  // Notifications
  useEffect(() => {
    if (!user?.uid) return;
    const q = query(
      collection(db, "notifications"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc"),
      limit(20),
    );
    const customerNotifTypeLabel: Record<string, string> = {
      price_quote: "Price Quote Received",
      payment_details: "Payment Details Ready",
      payment_confirmed: "Payment Confirmed",
      signature_request: "Signature Required",
      driver_accepted: "Driver Accepted",
      driver_arrived: "Driver Arrived",
      delivery_started: "Delivery Started",
      chat: "New Message",
    };
    return onSnapshot(q, (snap) => {
      const docs = snap.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as Notification,
      );
      setNotifications(docs);
      if (knownCustomerNotifIds.current === null) {
        knownCustomerNotifIds.current = new Set(docs.map((d) => d.id));
        return;
      }
      const incoming = docs.filter(
        (d) => !knownCustomerNotifIds.current!.has(d.id),
      );
      incoming.forEach((n) => {
        knownCustomerNotifIds.current!.add(n.id);
        const title =
          customerNotifTypeLabel[n.type ?? ""] ?? n.title ?? "Notification";
        toast(title, {
          description: n.message,
          duration: 5000,
        });
        // Show browser notification when tab is hidden and permission is granted
        if (
          pushNotifEnabledRef.current &&
          "Notification" in window &&
          Notification.permission === "granted" &&
          document.visibilityState === "hidden"
        ) {
          try {
            new Notification(title, {
              body: n.message ?? "",
              icon: "/favicon.ico",
            });
          } catch {}
        }
      });
    });
  }, [user?.uid]);

  // Keep ref in sync so notification listener can read current value without re-subscribing
  useEffect(() => {
    pushNotifEnabledRef.current = pushNotifications;
  }, [pushNotifications]);

  // Fix: query chats the user participates in, then count unread messages per chat
  useEffect(() => {
    if (!user?.uid) return;
    const uid = user.uid;
    const msgUnsubs = new Map<string, () => void>();
    const unreadCounts = new Map<string, number>();

    const updateTotal = () =>
      setUnreadMessages(
        Array.from(unreadCounts.values()).reduce((a, b) => a + b, 0),
      );

    const chatsUnsub = onSnapshot(
      query(
        collection(db, "chats"),
        where("participantIds", "array-contains", uid),
      ),
      (snap) => {
        const incoming = new Set(snap.docs.map((d) => d.id));
        // Remove listeners for chats the user is no longer in
        for (const [chatId, unsub] of msgUnsubs) {
          if (!incoming.has(chatId)) {
            unsub();
            msgUnsubs.delete(chatId);
            unreadCounts.delete(chatId);
          }
        }
        // Add listeners for new chats
        for (const chatDoc of snap.docs) {
          const chatId = chatDoc.id;
          if (msgUnsubs.has(chatId)) continue;
          const msgsUnsub = onSnapshot(
            query(collection(db, "messages"), where("chatId", "==", chatId)),
            (msgsSnap) => {
              unreadCounts.set(
                chatId,
                msgsSnap.docs.filter((d) => {
                  const data = d.data();
                  return (
                    data.senderId !== uid && !(data.readBy ?? []).includes(uid)
                  );
                }).length,
              );
              updateTotal();
            },
          );
          msgUnsubs.set(chatId, msgsUnsub);
        }
        if (snap.empty) setUnreadMessages(0);
      },
    );

    return () => {
      chatsUnsub();
      msgUnsubs.forEach((u) => u());
    };
  }, [user?.uid]);

  // Shrink the mobile chat overlay when the on-screen keyboard opens
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setChatOverlayH(vv.height);
    vv.addEventListener("resize", update);
    return () => vv.removeEventListener("resize", update);
  }, []);

  // Handlers
  const handleLocationToggle = async (enabled: boolean) => {
    if (enabled) {
      const ok = await requestPermission();
      if (ok) {
        startWatching();
        setLocationEnabled(true);
        toast.success("Location access enabled");
      } else
        toast.error(
          "Location permission denied. Please allow in browser settings.",
        );
    } else {
      stopWatching();
      setLocationEnabled(false);
      toast.success("Location access disabled");
    }
  };

  const handleLogout = async () => {
    sessionStorage.removeItem("customer_activeTab");
    sessionStorage.removeItem("customer_viewMode");
    sessionStorage.removeItem("customer_selectedDelivery");
    await firebaseSignOut(auth);
    toast.success("Logged out");
    navigate("/");
  };

  const handleUpdateProfile = async () => {
    if (!user?.uid) return;
    try {
      await updateDoc(doc(db, "users", user.uid), {
        ...editForm,
        updatedAt: Timestamp.now(),
      });
      setProfile(editForm);
      setIsEditingProfile(false);
      toast.success("Profile updated");
    } catch (e: any) {
      toast.error(e.message || "Failed");
    }
  };

  const handlePushNotificationsToggle = async (enabled: boolean) => {
    if (enabled) {
      if (!("Notification" in window)) {
        toast.error("Browser notifications are not supported on this device.");
        return;
      }
      const current = Notification.permission;
      if (current === "denied") {
        toast.error(
          "Notifications are blocked. Please allow them in your browser settings, then try again.",
        );
        return;
      }
      if (current !== "granted") {
        const result = await Notification.requestPermission();
        if (result !== "granted") {
          toast.error("Notification permission denied.");
          return;
        }
      }
      toast.success("Browser notifications enabled");
    }
    setPushNotifications(enabled);
  };

  const handleSavePrefs = async () => {
    if (!user?.uid) return;
    setSavingPrefs(true);
    try {
      const referralCode = profile?.referralCode || makeReferralCode(user.uid);
      await updateDoc(doc(db, "users", user.uid), {
        emergencyContact: emergencyContact.trim(),
        emergencyName: emergencyName.trim(),
        smsAlertNumber: smsAlertNumber.trim(),
        preferredPickupAddress: preferredPickup.trim(),
        pushNotifications,
        notificationSound,
        notificationVibration,
        referralCode,
        updatedAt: Timestamp.now(),
      });
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              emergencyContact: emergencyContact.trim(),
              emergencyName: emergencyName.trim(),
              smsAlertNumber: smsAlertNumber.trim(),
              preferredPickupAddress: preferredPickup.trim(),
              pushNotifications,
              notificationSound,
              notificationVibration,
              referralCode,
            }
          : prev,
      );
      toast.success("Preferences saved!");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSavingPrefs(false);
    }
  };

  const handleProfilePictureUploaded = (url: string) => {
    setProfile((prev) => (prev ? { ...prev, photoURL: url } : prev));
    setEditForm((prev) => ({ ...prev, photoURL: url }));
  };

  const handleDeliverySuccess = (id: string) => {
    setHeroBooking(null);
    setSelectedDelivery(id);
    setViewMode("tracking");
    toast.success("Delivery request created!");
  };

  const handleOpenChat = useCallback(async (delivery: DeliveryRequest) => {
    const snap = await getDocs(
      query(
        collection(db, "assignments"),
        where("requestId", "==", delivery.id),
        limit(1),
      ),
    );
    const a = snap.docs[0]?.data() as { driverId?: string } | undefined;
    if (!a?.driverId) {
      toast.error("No driver assigned yet");
      return;
    }
    setActiveSupportChat(false);
    setActiveChat({ id: delivery.id, driverId: a.driverId });
    setActiveTab("messages");
    setViewMode("default");
  }, []);

  const handleCancel = async (id: string) => {
    setCancellingId(id);
    try {
      await updateDoc(doc(db, "delivery_requests", id), {
        status: "cancelled",
        updatedAt: Timestamp.now(),
      });
      toast.success("Cancelled");
    } catch {
      toast.error("Failed to cancel");
    } finally {
      setCancellingId(null);
    }
  };

  const handleOpenRating = async (delivery: DeliveryRequest) => {
    setSelectedForRating(delivery);
    setRatingDriverInfo(null);
    if (delivery.driverId) {
      try {
        const [ds, us] = await Promise.all([
          getDoc(doc(db, "drivers", delivery.driverId)),
          getDoc(doc(db, "users", delivery.driverId)),
        ]);
        const dd = ds.exists() ? ds.data() : {};
        const ud = us.exists() ? us.data() : {};
        setRatingDriverInfo({
          id: delivery.driverId,
          firstName: (ud as any).firstName,
          lastName: (ud as any).lastName,
          photoURL: (ud as any).photoURL,
          vehicleType: (dd as any).vehicleType,
          isOnline: (dd as any).isOnline ?? false,
          status: (dd as any).status ?? "",
        });
      } catch {}
    }
  };

  const handleSubmitReview = async (
    deliveryId: string,
    rating: number,
    feedback: string,
  ) => {
    try {
      await updateDoc(doc(db, "delivery_requests", deliveryId), {
        rating: {
          rating,
          feedback: feedback.trim() || null,
          timestamp: Timestamp.now(),
        },
      });
      if (ratingDriverInfo?.id)
        await addDoc(collection(db, "driver_reviews"), {
          driverId: ratingDriverInfo.id,
          customerId: user?.uid,
          deliveryId,
          rating,
          feedback: feedback.trim() || null,
          createdAt: Timestamp.now(),
        });
      toast.success("Thanks for your review!");
      setSelectedForRating(null);
      setRatingDriverInfo(null);
    } catch {
      toast.error("Failed to submit review");
    }
  };

  const handleDeleteAddress = async (id: string) => {
    const previous = savedAddresses;
    const updated = savedAddresses.filter((a) => a.id !== id);
    setSavedAddresses(updated);
    try {
      await updateDoc(doc(db, "customers", user.uid), {
        savedAddresses: updated,
      });
      toast.success("Address removed");
    } catch {
      setSavedAddresses(previous);
      toast.error("Failed to remove address");
    }
  };

  // Derived
  const unreadNotifs = notifications.filter((n) => !n.read).length;
  const activeDeliveries = deliveries.filter(
    (d) => !["completed", "cancelled"].includes(d.status),
  );
  const historyDeliveries = deliveries.filter((d) =>
    ["completed", "cancelled"].includes(d.status),
  );
  const senderName =
    [profile?.firstName, profile?.lastName].filter(Boolean).join(" ") ||
    "Someone";

  const driverMarkers: MapMarker[] = nearbyDrivers.map((dr) => ({
    id: dr.id,
    latitude: dr.currentLocation?.lat || 0,
    longitude: dr.currentLocation?.lng || 0,
    type: "driver" as const,
    label: [dr.firstName, dr.lastName].filter(Boolean).join(" ") || "Driver",
    data: dr,
  }));

  const switchTab = (tab: TabType) => {
    setActiveTab(tab);
    setViewMode("default");
    if (tab !== "messages") {
      setActiveChat(null);
      setActiveSupportChat(false);
    }
  };

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    desktopMainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [activeTab, viewMode]);

  const sideNavItems = [
    { id: "home", icon: Home, label: "Home" },
    {
      id: "deliveries",
      icon: Package,
      label: "Deliveries",
      badge: activeDeliveries.length,
    },
    { id: "history", icon: History, label: "History" },
    {
      id: "messages",
      icon: MessageCircle,
      label: "Messages",
      badge: unreadMessages,
    },
    { id: "profile", icon: User, label: "Profile" },
    { id: "support", icon: HelpCircle, label: "Support" },
  ];

  const bottomNav = [
    { id: "home", icon: Home, label: "Home" },
    {
      id: "deliveries",
      icon: Package,
      label: "Deliveries",
      badge: activeDeliveries.length,
    },
    { id: "history", icon: History, label: "History" },
    {
      id: "messages",
      icon: MessageCircle,
      label: "Chat",
      badge: unreadMessages,
    },
    { id: "profile", icon: User, label: "Profile" },
  ];

  if (isLoading) return <DashboardSkeleton />;

  // ── Tab content renderer ──────────────────────────────────────────────────

  const renderTabContent = () => {
    // ── new-request: pass heroBooking as initialPickup/initialDropoff if available ──
    if (viewMode === "new-request" && user?.uid)
      return (
        <DeliveryRequestForm
          fullPage
          customerId={user.uid}
          preselectedDriver={preselectedDriver}
          initialPickup={heroBooking?.pickup}
          initialDropoff={heroBooking?.dropoff}
          onSuccess={(id) => {
            setPreselectedDriver(null);
            handleDeliverySuccess(id);
          }}
          onCancel={() => {
            setPreselectedDriver(null);
            setHeroBooking(null);
            setViewMode("default");
          }}
        />
      );
    if (viewMode === "tracking" && selectedDelivery)
      return (
        <DeliveryTracking
          fullPage
          requestId={selectedDelivery}
          currentUserId={user?.uid ?? ""}
          userRole="customer"
          onClose={() => {
            setViewMode("default");
            setSelectedDelivery(null);
          }}
          onStartCall={(uid) =>
            setActiveCall({ userId: uid, userName: "Driver" })
          }
          onFindDriverAgain={(data) => {
            try {
              const resumeState = {
                step: 3,
                formData: {
                  pickupAddress: data.pickup.address,
                  dropoffAddress: data.dropoff.address,
                  pickupLatitude: data.pickup.lat,
                  pickupLongitude: data.pickup.lng,
                  dropoffLatitude: data.dropoff.lat,
                  dropoffLongitude: data.dropoff.lng,
                  vehicleType: data.transportType,
                  driverType: "self_driver",
                  itemDescription: data.itemDescription ?? "",
                  itemWeight: data.itemWeight ?? "",
                  itemSize: data.itemSize ?? "small",
                  isScheduled: false,
                  scheduledTime: "",
                },
                broadcastId: null,
                waitingRequestId: null,
                waitingAssignmentId: null,
                selectedDriverId: null,
                packagePhotoUrl: data.packagePhotoUrl ?? null,
                reusableRequestId: null,
                counterOfferPrice: null,
                acceptedBroadcastOffer: null,
              };
              sessionStorage.setItem(
                "pilnak_delivery_form_state",
                JSON.stringify(resumeState),
              );
            } catch {}
            setSelectedDelivery(null);
            setViewMode("new-request");
          }}
        />
      );
    if (viewMode === "negotiation" && selectedDelivery)
      return (
        <div className="w-full max-w-2xl mx-auto bg-white">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div>
              <h2 className="font-semibold text-base">Company Quote</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Review and respond to pricing
              </p>
            </div>
          </div>
          <div className="p-5">
            <DeliveryNegotiationSection
              requestId={selectedDelivery}
              onAccepted={() => {
                setViewMode("tracking");
              }}
              onCancelled={() => {
                setViewMode("default");
                setSelectedDelivery(null);
              }}
            />
          </div>
        </div>
      );
    if (viewMode === "schedule")
      return (
        <DeliveryRequestForm
          fullPage
          customerId={user?.uid}
          onSuccess={handleDeliverySuccess}
          onCancel={() => setViewMode("default")}
        />
      );

    // ── HOME ──────────────────────────────────────────────────────────────────
    if (activeTab === "home") {
      return (
        <div className="space-y-5 animate-fade-in">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs text-gray-400 font-medium mb-0.5">
                {new Date().toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </p>
              <h1 className="text-2xl lg:text-3xl font-light text-gray-700 tracking-tight leading-snug flex items-center gap-2">
                {(() => {
                  const hour = new Date().getHours();
                  const { greeting, Icon } =
                    hour >= 5 && hour < 12
                      ? { greeting: "Good morning", Icon: Sunrise }
                      : hour >= 12 && hour < 17
                        ? { greeting: "Good afternoon", Icon: Sun }
                        : hour >= 17 && hour < 21
                          ? { greeting: "Good evening", Icon: Sunset }
                          : { greeting: "Good night", Icon: Moon };
                  return (
                    <>
                      <Icon
                        className="w-6 h-6 text-amber-400 shrink-0"
                        strokeWidth={1.5}
                      />
                      <span>
                        <span
                          style={{
                            fontFamily: "'Dancing Script', cursive",
                            fontSize: "20px",
                          }}
                        >
                          {greeting},
                        </span>{" "}
                        <span className="font-semibold text-gray-900 text-[20px] lg:text-[26px]">
                          {profile?.firstName || "there"}
                        </span>
                      </span>
                    </>
                  );
                })()}
              </h1>
              <p className="text-xs lg:text-sm text-gray-400 mt-1">
                {activeDeliveries.length > 0
                  ? `${activeDeliveries.length} active ${activeDeliveries.length === 1 ? "delivery" : "deliveries"}`
                  : "What would you like to send today?"}
              </p>
            </div>
            <button
              onClick={() => setViewMode("new-request")}
              className="hidden lg:flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-md shadow-primary/25 hover:bg-primary/90 transition-all flex-shrink-0"
            >
              <Plus className="h-4 w-4" />
              New Delivery
            </button>
          </div>

          <button
            onClick={() => setViewMode("new-request")}
            className="lg:hidden w-full flex items-center gap-3 bg-primary text-white px-4 py-3.5 rounded-2xl font-semibold shadow-md shadow-primary/30 active:scale-[0.98] transition-all"
          >
            <div className="h-8 w-8 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <Plus className="h-4 w-4" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-bold">Send a Package</p>
              <p className="text-[11px] text-white/70 mt-0.5">
                Fast & reliable delivery
              </p>
            </div>
            <ArrowRight className="h-4 w-4 text-white/70 flex-shrink-0" />
          </button>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 lg:gap-4">
            <StatCard
              label="Shipments"
              value={deliveryStats.total}
              icon={Package}
              accent="bg-primary/10 text-primary"
            />
            <StatCard
              label="Delivered"
              value={deliveryStats.completed}
              icon={CheckCircle}
              accent="bg-emerald-50 text-emerald-600"
            />
            <StatCard
              label="In Transit"
              value={deliveryStats.inProgress}
              icon={Truck}
              accent="bg-blue-50 text-blue-600"
            />
            <StatCard
              label="Spent"
              value={`₦${(deliveryStats.totalSpent / 1000).toFixed(0)}k`}
              icon={Star}
              accent="bg-violet-50 text-violet-600"
            />
          </div>

          <div className="grid lg:grid-cols-3 gap-4 lg:gap-6">
            <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-gray-900 text-sm">
                    Map Overview
                  </h2>
                  {nearbyDrivers.length > 0 && (
                    <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                      {nearbyDrivers.length} drivers nearby
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setViewMode("new-request")}
                  className="text-xs font-semibold text-primary flex items-center gap-1"
                >
                  Send package <ArrowRight className="h-3 w-3" />
                </button>
              </div>
              <div className="relative">
                <MapView
                  className="h-44 lg:h-64"
                  userLatitude={latitude}
                  userLongitude={longitude}
                  markers={driverMarkers}
                  onMarkerClick={(m) => {
                    const mk = m as MapMarker;
                    if (mk.data) setSelectedDriverDetail(mk.data);
                  }}
                />
                <div className="absolute top-3 left-3 right-3">
                  <div className="bg-white/95 backdrop-blur-md rounded-xl border border-gray-100 flex items-center gap-2 px-3 shadow-lg">
                    <MapPin className="h-4 w-4 text-primary flex-shrink-0" />
                    <input
                      readOnly
                      placeholder="Where to send a package?"
                      onClick={() => setViewMode("new-request")}
                      className="flex-1 bg-transparent text-sm py-2.5 outline-none cursor-pointer placeholder:text-gray-400 min-w-0 truncate text-gray-700"
                    />
                    <button
                      onClick={() => setViewMode("new-request")}
                      className="h-7 px-3 bg-primary text-white text-xs font-bold rounded-lg flex-shrink-0"
                    >
                      Send
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
              <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between flex-shrink-0">
                <h2 className="font-semibold text-gray-900 text-sm">
                  Active Orders
                </h2>
                {activeDeliveries.length > 0 && (
                  <button
                    onClick={() => setActiveTab("deliveries")}
                    className="text-xs font-semibold text-primary"
                  >
                    View all
                  </button>
                )}
              </div>
              <div className="flex-1 overflow-y-auto">
                {activeDeliveries.length > 0 ? (
                  <div className="p-3 space-y-2">
                    {activeDeliveries.slice(0, 4).map((d) => (
                      <div
                        key={d.id}
                        className="bg-gray-50 rounded-xl p-3 cursor-pointer group hover:bg-gray-100/80 transition-colors"
                        onClick={() => {
                          setSelectedDelivery(d.id);
                          setViewMode("tracking");
                        }}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold text-xs text-gray-700 truncate max-w-[100px]">
                            {d.deliveryName ||
                              `#${d.id.slice(0, 8).toUpperCase()}`}
                          </span>
                          <Badge
                            className={`text-[9px] px-1.5 py-0 h-4 flex items-center gap-0.5 border font-medium ${statusColor(d.status)}`}
                          >
                            {statusIcon(d.status)}
                            <span className="capitalize">
                              {d.status?.replace(/_/g, " ")}
                            </span>
                          </Badge>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                            <span className="text-[11px] text-gray-500 truncate">
                              {d.pickup?.address}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 min-w-0">
                            <div className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                            <span className="text-[11px] text-gray-500 truncate">
                              {d.dropoff?.address}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200/60">
                          <span className="text-xs font-bold text-primary">
                            ₦{Number(d.estimatedPrice || 0).toLocaleString()}
                          </span>
                          <span className="text-[10px] text-primary font-semibold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                            Track <ArrowRight className="h-3 w-3" />
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                    <div className="h-12 w-12 bg-gray-50 rounded-2xl flex items-center justify-center mb-3">
                      <Package className="h-6 w-6 text-gray-300" />
                    </div>
                    <p className="text-sm font-medium text-gray-400">
                      No active deliveries
                    </p>
                    <button
                      onClick={() => setViewMode("new-request")}
                      className="mt-3 text-xs font-semibold text-primary"
                    >
                      Create one now
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div>
            <h2 className="font-semibold text-gray-900 text-sm mb-3">
              Quick Actions
            </h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 lg:gap-3">
              {[
                {
                  label: "New Delivery",
                  sub: "Send a package",
                  icon: Plus,
                  primary: true,
                  action: () => setViewMode("new-request"),
                },
                {
                  label: "Schedule",
                  sub: "Plan ahead",
                  icon: Clock,
                  primary: false,
                  action: () => setViewMode("schedule"),
                },
                {
                  label: "Track Order",
                  sub: "View active orders",
                  icon: Navigation,
                  primary: false,
                  action: () => setActiveTab("deliveries"),
                },
                {
                  label: "Support",
                  sub: "Get help",
                  icon: MessageCircle,
                  primary: false,
                  action: () => {
                    setActiveSupportChat(true);
                    setActiveChat(null);
                    setActiveTab("messages");
                    setViewMode("default");
                  },
                },
              ].map((it) => (
                <button
                  key={it.label}
                  onClick={it.action}
                  className={`p-3.5 lg:p-4 rounded-2xl flex items-center gap-2.5 transition-all hover:scale-[1.02] active:scale-95 min-w-0 text-left ${it.primary ? "bg-primary text-white shadow-md shadow-primary/25" : "bg-white border border-gray-100 shadow-sm hover:border-primary/20"}`}
                >
                  <div
                    className={`h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0 ${it.primary ? "bg-white/20" : "bg-gray-50"}`}
                  >
                    <it.icon
                      className={`h-4 w-4 lg:h-5 lg:w-5 ${it.primary ? "text-white" : "text-gray-500"}`}
                    />
                  </div>
                  <div className="min-w-0">
                    <p
                      className={`font-semibold text-xs lg:text-sm truncate ${it.primary ? "text-white" : "text-gray-800"}`}
                    >
                      {it.label}
                    </p>
                    <p
                      className={`text-[11px] truncate hidden sm:block ${it.primary ? "text-white/70" : "text-gray-400"}`}
                    >
                      {it.sub}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {savedAddresses.length > 0 && (
            <div>
              <h2 className="font-semibold text-gray-900 text-sm mb-3">
                Saved Addresses
              </h2>
              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {savedAddresses.map((addr) => (
                  <div
                    key={addr.id}
                    className="group bg-white border border-gray-100 rounded-2xl p-3.5 flex items-center gap-3 hover:border-primary/20 transition-all min-w-0"
                  >
                    <div className="h-9 w-9 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Home className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-gray-800 truncate">
                        {addr.label}
                      </p>
                      <p className="text-xs text-gray-400 truncate">
                        {addr.address}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteAddress(addr.id)}
                      className="h-7 w-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 text-gray-300 hover:text-red-500 flex-shrink-0"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {nearbyDrivers.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-gray-900 text-sm">
                  Nearby Drivers
                </h2>
                <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                  {nearbyDrivers.length} available
                </span>
              </div>
              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {nearbyDrivers.slice(0, 6).map((dr) => {
                  const name =
                    [dr.firstName, dr.lastName].filter(Boolean).join(" ") ||
                    "Driver";
                  const rating = dr.averageRating ?? dr.rating ?? 5.0;
                  return (
                    <button
                      key={dr.id}
                      onClick={() => setSelectedDriverDetail(dr)}
                      className="bg-white border border-gray-100 rounded-2xl p-3.5 flex items-center gap-3 min-w-0 hover:border-primary/30 hover:shadow-md transition-all text-left group"
                    >
                      <div className="relative flex-shrink-0">
                        <Avatar className="h-12 w-12 rounded-xl">
                          <AvatarImage
                            src={dr.photoURL}
                            className="object-cover"
                          />
                          <AvatarFallback className="rounded-xl bg-primary/10 text-primary text-sm font-bold">
                            {dr.firstName?.[0]}
                            {dr.lastName?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 bg-emerald-500 rounded-full border-2 border-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-gray-800 truncate group-hover:text-primary transition-colors">
                          {name}
                        </p>
                        <p className="text-xs text-gray-400 capitalize truncate">
                          {dr.vehicleType?.replace(/_/g, " ") || "Vehicle"}
                          {dr.carModel ? ` · ${dr.carModel}` : ""}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <div className="flex items-center gap-0.5">
                            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                            <span className="text-xs font-semibold text-gray-700">
                              {Number(rating).toFixed(1)}
                            </span>
                          </div>
                          {dr.plateNumber && (
                            <span className="text-[10px] font-mono text-gray-300">
                              {dr.plateNumber}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-full px-2 py-0.5">
                          Online
                        </span>
                        <ChevronRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-primary transition-colors" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      );
    }

    // ── DELIVERIES ────────────────────────────────────────────────────────────
    if (activeTab === "deliveries") {
      return (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-900">
              Active Deliveries
            </h1>
            <Button
              size="sm"
              className="rounded-xl shadow-sm shadow-primary/20"
              onClick={() => setViewMode("new-request")}
            >
              <Plus className="h-4 w-4 mr-1.5" />
              New
            </Button>
          </div>
          {filteredDeliveries.filter(
            (d) => !["completed", "cancelled"].includes(d.status),
          ).length > 0 ? (
            <div className="space-y-2.5">
              {filteredDeliveries
                .filter((d) => !["completed", "cancelled"].includes(d.status))
                .map((d) => (
                  <DeliveryCard
                    key={d.id}
                    delivery={d}
                    cancellingId={cancellingId}
                    onTrack={(id) => {
                      setSelectedDelivery(id);
                      const isCompanyNegotiating =
                        d.workflowOwner === "company" &&
                        [
                          "negotiating_price",
                          "price_set",
                          "payment_pending",
                          "customer_confirmed",
                        ].includes(d.status);
                      setViewMode(
                        isCompanyNegotiating ? "negotiation" : "tracking",
                      );
                    }}
                    onRate={handleOpenRating}
                    onCancel={handleCancel}
                    onShare={handleShare}
                    onReport={setSelectedForReport}
                    onReceipt={setSelectedForReceipt}
                  />
                ))}
            </div>
          ) : (
            <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
              <div className="h-16 w-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Package className="h-8 w-8 text-gray-300" />
              </div>
              <p className="font-semibold text-gray-400 mb-1">
                No active deliveries
              </p>
              <p className="text-sm text-gray-300 mb-4">
                Send your first package today
              </p>
              <Button
                onClick={() => setViewMode("new-request")}
                className="rounded-xl"
              >
                Create a Delivery
              </Button>
            </div>
          )}
        </div>
      );
    }

    // ── HISTORY ───────────────────────────────────────────────────────────────
    if (activeTab === "history") {
      return (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-900">
              Delivery History
            </h1>
            <span className="text-sm font-medium text-gray-400 bg-gray-50 px-3 py-1 rounded-full border border-gray-100">
              {historyDeliveries.length} records
            </span>
          </div>
          <div className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl px-4 py-3 shadow-sm">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="h-7 w-7 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
              </div>
              <div className="min-w-0">
                <p className="text-base font-bold text-gray-900 leading-none">
                  {deliveryStats.completed}
                </p>
                <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mt-0.5">
                  Completed
                </p>
              </div>
            </div>
            <div className="w-px h-8 bg-gray-100 flex-shrink-0" />
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="h-7 w-7 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
                <XCircle className="h-3.5 w-3.5 text-red-500" />
              </div>
              <div className="min-w-0">
                <p className="text-base font-bold text-gray-900 leading-none">
                  {deliveryStats.cancelled}
                </p>
                <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mt-0.5">
                  Cancelled
                </p>
              </div>
            </div>
          </div>
          {historyDeliveries.length > 0 ? (
            <div className="space-y-2.5">
              {historyDeliveries.map((d) => (
                <DeliveryCard
                  key={d.id}
                  delivery={d}
                  showTrack={false}
                  cancellingId={cancellingId}
                  onTrack={() => {}}
                  onRate={handleOpenRating}
                  onCancel={handleCancel}
                  onShare={handleShare}
                  onReport={setSelectedForReport}
                  onReceipt={setSelectedForReceipt}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
              <div className="h-16 w-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <History className="h-8 w-8 text-gray-300" />
              </div>
              <p className="font-semibold text-gray-400">No history yet</p>
            </div>
          )}
        </div>
      );
    }

    // ── MESSAGES ──────────────────────────────────────────────────────────────
    if (activeTab === "messages") {
      const assignedDeliveries = activeDeliveries.filter(
        (d) => chatDriverInfo[d.id],
      );
      const shortAddr = (addr?: string) =>
        addr ? (addr.split(",")[0]?.trim() ?? addr) : "";
      const customerDisplayName =
        (profile?.firstName
          ? `${profile.firstName}${profile.lastName ? " " + profile.lastName : ""}`
          : null) ?? user?.email?.split("@")[0];
      const closeChat = () => {
        setActiveChat(null);
        setActiveSupportChat(false);
      };

      // Resolve delivery route for the active driver chat
      const activeChatDelivery = activeChat
        ? deliveries.find((d) => d.id === activeChat.id)
        : null;
      const activeChatRoute =
        [
          activeChatDelivery?.pickup?.address?.split(",")[0]?.trim(),
          activeChatDelivery?.dropoff?.address?.split(",")[0]?.trim(),
        ]
          .filter(Boolean)
          .join(" → ") || undefined;

      return (
        <>
          {/* ── Desktop: WhatsApp Web two-column ──────────────────────── */}
          <div className="hidden lg:flex h-full animate-fade-in">
            {/* Left panel — conversation list */}
            <div className="w-72 xl:w-80 flex-shrink-0 border-r border-gray-100 flex flex-col overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex-shrink-0">
                <h2 className="text-base font-bold text-gray-900">Messages</h2>
              </div>
              <div className="flex-1 overflow-y-auto py-2">
                {isLoadingDriverInfo && assignedDeliveries.length === 0 ? (
                  <div className="px-2 space-y-0.5">
                    {[1, 2].map((i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 px-3 py-3 rounded-xl"
                      >
                        <Skeleton className="h-11 w-11 rounded-full flex-shrink-0" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-3.5 w-28 rounded" />
                          <Skeleton className="h-3 w-36 rounded" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="px-2 space-y-0.5">
                    {/* Support chat — always present */}
                    <button
                      onClick={() => {
                        setActiveSupportChat(true);
                        setActiveChat(null);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-colors text-left ${
                        activeSupportChat && !activeChat
                          ? "bg-primary/8 hover:bg-primary/10"
                          : "hover:bg-gray-50"
                      }`}
                    >
                      <div className="relative flex-shrink-0">
                        <div className="h-11 w-11 rounded-full bg-primary/10 ring-2 ring-primary/15 flex items-center justify-center">
                          <MessageCircle className="h-5 w-5 text-primary" />
                        </div>
                        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-primary rounded-full ring-2 ring-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-sm font-semibold truncate ${activeSupportChat && !activeChat ? "text-primary" : "text-gray-800"}`}
                        >
                          Pilnak Support
                        </p>
                        <p className="text-xs text-gray-400 truncate mt-0.5">
                          Support Team · Get help anytime
                        </p>
                      </div>
                      {activeSupportChat && !activeChat && (
                        <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                      )}
                    </button>
                    {/* Driver conversations */}
                    {assignedDeliveries.map((d) => {
                      const info = chatDriverInfo[d.id];
                      const route = [
                        shortAddr(d.pickup?.address),
                        shortAddr(d.dropoff?.address),
                      ]
                        .filter(Boolean)
                        .join(" → ");
                      const isSelected = activeChat?.id === d.id;
                      return (
                        <button
                          key={d.id}
                          onClick={() => handleOpenChat(d)}
                          className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-colors text-left ${
                            isSelected
                              ? "bg-primary/8 hover:bg-primary/10"
                              : "hover:bg-gray-50"
                          }`}
                        >
                          <div className="relative flex-shrink-0">
                            <div className="h-11 w-11 rounded-full bg-primary/10 ring-2 ring-gray-100 flex items-center justify-center overflow-hidden">
                              {info.photoUrl ? (
                                <img
                                  src={info.photoUrl}
                                  alt={info.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span className="text-sm font-bold text-primary">
                                  {info.name
                                    .split(" ")
                                    .map((w) => w[0])
                                    .join("")
                                    .slice(0, 2)
                                    .toUpperCase()}
                                </span>
                              )}
                            </div>
                            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-primary rounded-full ring-2 ring-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p
                              className={`text-sm font-semibold truncate ${isSelected ? "text-primary" : "text-gray-800"}`}
                            >
                              {info.name}
                            </p>
                            <p className="text-xs text-gray-400 truncate mt-0.5">
                              {route || "Chat with your driver"}
                            </p>
                          </div>
                          {isSelected && (
                            <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Right panel — chat or empty state */}
            <div className="flex-1 overflow-hidden">
              {activeChat ? (
                <ChatPanel
                  key={activeChat.id}
                  flat
                  requestId={activeChat.id}
                  currentUserId={user?.uid ?? ""}
                  senderName={senderName}
                  otherUserId={activeChat.driverId}
                  otherUserName={
                    chatDriverInfo[activeChat.id]?.name ?? "Driver"
                  }
                  otherUserPhoto={
                    chatDriverInfo[activeChat.id]?.photoUrl ?? null
                  }
                  deliveryName={activeChatRoute}
                  onClose={closeChat}
                />
              ) : activeSupportChat ? (
                <SupportChatView
                  flat
                  userId={user?.uid ?? ""}
                  customerName={customerDisplayName}
                  onClose={closeChat}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center gap-4">
                  <div className="h-20 w-20 bg-gray-50 rounded-2xl flex items-center justify-center">
                    <MessageCircle className="h-9 w-9 text-gray-200" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-500">
                      Select a conversation
                    </p>
                    <p className="text-xs text-gray-300 mt-1 max-w-[18rem]">
                      Choose a conversation from the list to start chatting
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Mobile: conversation list (chat opens as full-screen overlay) ── */}
          <div className="lg:hidden space-y-4 animate-fade-in">
            <h1 className="text-xl font-bold text-gray-900">Messages</h1>
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              {isLoadingDriverInfo && assignedDeliveries.length === 0 ? (
                <div className="p-3 space-y-0.5">
                  {[1, 2].map((i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 px-3 py-3.5"
                    >
                      <Skeleton className="h-11 w-11 rounded-full flex-shrink-0" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-3.5 w-28 rounded" />
                        <Skeleton className="h-3 w-36 rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {/* Support chat entry */}
                  <button
                    onClick={() => {
                      setActiveSupportChat(true);
                      setActiveChat(null);
                    }}
                    className="w-full flex items-center gap-3.5 px-4 py-4 hover:bg-gray-50/80 active:bg-gray-100 transition-colors text-left"
                  >
                    <div className="relative flex-shrink-0">
                      <div className="h-11 w-11 rounded-full bg-primary/10 ring-2 ring-primary/10 flex items-center justify-center">
                        <MessageCircle className="h-5 w-5 text-primary" />
                      </div>
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-primary rounded-full ring-2 ring-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-gray-800">
                        Pilnak Support
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Support Team · Get help anytime
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0" />
                  </button>
                  {/* Driver conversations */}
                  {assignedDeliveries.map((d) => {
                    const info = chatDriverInfo[d.id];
                    const route = [
                      shortAddr(d.pickup?.address),
                      shortAddr(d.dropoff?.address),
                    ]
                      .filter(Boolean)
                      .join(" → ");
                    return (
                      <button
                        key={d.id}
                        onClick={() => handleOpenChat(d)}
                        className="w-full flex items-center gap-3.5 px-4 py-4 hover:bg-gray-50/80 active:bg-gray-100 transition-colors text-left"
                      >
                        <div className="relative flex-shrink-0">
                          <div className="h-11 w-11 rounded-full bg-primary/10 ring-2 ring-gray-100 flex items-center justify-center overflow-hidden">
                            {info.photoUrl ? (
                              <img
                                src={info.photoUrl}
                                alt={info.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-sm font-bold text-primary">
                                {info.name
                                  .split(" ")
                                  .map((w) => w[0])
                                  .join("")
                                  .slice(0, 2)
                                  .toUpperCase()}
                              </span>
                            )}
                          </div>
                          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-primary rounded-full ring-2 ring-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-gray-800 truncate">
                            {info.name}
                          </p>
                          <p className="text-xs text-gray-400 truncate mt-0.5">
                            {route || "Chat with your driver"}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0" />
                      </button>
                    );
                  })}
                  {assignedDeliveries.length === 0 && (
                    <div className="py-10 text-center px-4">
                      <p className="text-sm text-gray-400 font-medium">
                        No driver conversations yet
                      </p>
                      <p className="text-xs text-gray-300 mt-1">
                        Conversations appear once a driver is assigned
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      );
    }

    // ── PROFILE ───────────────────────────────────────────────────────────────
    if (activeTab === "profile") {
      const referralCode =
        profile?.referralCode || (user?.uid ? makeReferralCode(user.uid) : "–");
      return (
        <div className="space-y-4 animate-fade-in">

          {/* ── Hero Identity Card ──────────────────────────────────── */}
          <div className="rounded-2xl overflow-hidden shadow-md">
            <div className="relative bg-gradient-to-br from-[#003D1A] via-[#005C25] to-[#008A39] px-5 pt-7 pb-6">
              {/* Decorative circles */}
              <div className="pointer-events-none absolute -top-12 -right-12 h-48 w-48 rounded-full bg-white/5" />
              <div className="pointer-events-none absolute -bottom-10 -left-10 h-36 w-36 rounded-full bg-white/5" />
              <div className="pointer-events-none absolute top-4 right-16 h-20 w-20 rounded-full bg-white/[0.03]" />

              {/* Avatar + name */}
              <div className="relative flex items-center gap-4">
                <div className="relative flex-shrink-0">
                  <div className="h-[76px] w-[76px] rounded-full p-[3px] bg-white/20">
                    <Avatar className="h-full w-full rounded-full">
                      <AvatarImage src={profile?.photoURL} className="object-cover rounded-full" />
                      <AvatarFallback className="rounded-full bg-white/25 text-white text-2xl font-bold">
                        {profile?.firstName?.[0]}{profile?.lastName?.[0]}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  <span className="absolute bottom-0.5 right-0.5 h-4 w-4 rounded-full bg-emerald-400 border-2 border-white shadow-sm" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-[20px] font-bold text-white leading-tight truncate tracking-tight">
                    {profile?.firstName} {profile?.lastName}
                  </h2>
                  <p className="text-xs text-white/50 truncate mt-0.5">{profile?.email}</p>
                  <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-[#003D1A] bg-emerald-300 px-2.5 py-0.5 rounded-full">
                      <span className="w-1 h-1 rounded-full bg-[#003D1A]" />
                      Active Customer
                    </span>
                    {profile?.createdAt && (
                      <span className="text-[10px] text-white/35 font-medium">
                        Since {profile.createdAt.toDate().toLocaleDateString("en-GB", { month: "short", year: "numeric" })}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Stats row */}
              <div className="relative grid grid-cols-3 gap-2 mt-6">
                {[
                  { label: "Total", value: deliveryStats.total },
                  { label: "Completed", value: deliveryStats.completed },
                  { label: "Spent", value: `₦${(deliveryStats.totalSpent / 1000).toFixed(0)}k` },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="bg-white/10 border border-white/10 rounded-xl py-3 px-2 text-center"
                  >
                    <p className="text-lg font-bold text-white leading-none">{s.value}</p>
                    <p className="text-[9px] text-white/45 font-semibold uppercase tracking-widest mt-1">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Contact details — same card, white section */}
            <div className="bg-white divide-y divide-gray-50">
              {[
                { icon: Phone, label: "Phone", value: profile?.phone || "Not set" },
                { icon: Mail, label: "Email", value: profile?.email || "—" },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-4 px-5 py-3.5">
                  <div className="h-8 w-8 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0">
                    <item.icon className="h-3.5 w-3.5 text-gray-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">{item.label}</p>
                    <p className="font-semibold text-sm text-gray-900 truncate mt-0.5">{item.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Notifications & Alerts ─────────────────────────────── */}
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                <BellRing className="h-3.5 w-3.5 text-blue-500" />
              </div>
              <h2 className="font-bold text-gray-900 text-sm">Notifications & Alerts</h2>
            </div>
            <div className="divide-y divide-gray-50">
              <div className="flex items-center gap-3.5 px-5 py-4">
                <div className="h-9 w-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <BellRing className="h-4 w-4 text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-800">Push Notifications</p>
                  <p className="text-xs text-gray-400 mt-0.5">Browser alerts when you receive updates</p>
                </div>
                <Switch
                  checked={pushNotifications}
                  onCheckedChange={async (v) => {
                    await handlePushNotificationsToggle(v);
                    setTimeout(handleSavePrefs, 0);
                  }}
                  className="flex-shrink-0"
                />
              </div>
              {[
                { label: "Sound Alerts", sub: "Play sound on status change", icon: Volume2, value: notificationSound, set: setNotificationSound },
                { label: "Vibration", sub: "Vibrate on status change", icon: Vibrate, value: notificationVibration, set: setNotificationVibration },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3.5 px-5 py-4">
                  <div className="h-9 w-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <item.icon className="h-4 w-4 text-blue-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-800">{item.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{item.sub}</p>
                  </div>
                  <Switch
                    checked={item.value}
                    onCheckedChange={(v) => { item.set(v); setTimeout(handleSavePrefs, 0); }}
                    className="flex-shrink-0"
                  />
                </div>
              ))}
              <div className="px-5 py-4 space-y-2.5">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <MessageSquare className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                  <Label className="text-xs font-semibold text-gray-700">SMS Alert Number</Label>
                </div>
                <p className="text-[10px] text-gray-400 leading-relaxed">
                  Send delivery updates to a different number (e.g. the recipient).
                </p>
                <div className="flex gap-2">
                  <Input
                    value={smsAlertNumber}
                    onChange={(e) => setSmsAlertNumber(e.target.value)}
                    placeholder="+234 recipient number…"
                    className="rounded-xl border-gray-200 h-10 flex-1"
                    type="tel"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl h-10 border-gray-200 flex-shrink-0"
                    onClick={handleSavePrefs}
                    disabled={savingPrefs}
                  >
                    Save
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-3.5 px-5 py-4">
                <div className={`h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0 ${locationEnabled ? "bg-emerald-50" : "bg-gray-50"}`}>
                  <MapPinned className={`h-4 w-4 ${locationEnabled ? "text-emerald-600" : "text-gray-400"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-800">Location Access</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {locationEnabled ? "Active — used for driver matching" : "Enable for faster driver matching"}
                  </p>
                </div>
                <Switch checked={locationEnabled} onCheckedChange={handleLocationToggle} className="flex-shrink-0" />
              </div>
            </div>
          </div>

          {/* ── Account ───────────────────────────────────────────────── */}
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                <User className="h-3.5 w-3.5 text-gray-500" />
              </div>
              <h2 className="font-bold text-gray-900 text-sm">Account</h2>
            </div>
            <div className="divide-y divide-gray-50">
              {[
                { label: "Help & Support", icon: HelpCircle, action: () => switchTab("support"), iconBg: "bg-violet-50", iconCls: "text-violet-500" },
                { label: "Delivery History", icon: History, action: () => switchTab("history"), iconBg: "bg-amber-50", iconCls: "text-amber-500" },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={item.action}
                  className="w-full flex items-center gap-3.5 px-5 py-4 hover:bg-gray-50/80 active:bg-gray-100 transition-colors text-left min-w-0"
                >
                  <div className={`h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0 ${item.iconBg}`}>
                    <item.icon className={`h-4 w-4 ${item.iconCls}`} />
                  </div>
                  <span className="flex-1 text-sm font-semibold text-gray-800">{item.label}</span>
                  <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>

          {/* ── Sign Out ──────────────────────────────────────────────── */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2.5 rounded-2xl border border-red-100 bg-white text-red-500 hover:bg-red-50 hover:border-red-200 active:scale-[0.98] h-12 font-semibold text-sm transition-all shadow-sm"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      );
    }

    // ── SUPPORT ───────────────────────────────────────────────────────────────
    if (activeTab === "support") {
      return (
        <div className="space-y-4 animate-fade-in">
          <h1 className="text-xl font-bold text-gray-900">Help & Support</h1>

          {/* Live chat with support team */}
          <button
            onClick={() => {
              setActiveSupportChat(true);
              setActiveChat(null);
              setActiveTab("messages");
              setViewMode("default");
            }}
            className="w-full bg-primary/5 border border-primary/20 rounded-2xl p-5 flex items-center gap-4 hover:bg-primary/10 transition-colors text-left"
          >
            <div className="h-12 w-12 bg-primary rounded-2xl flex items-center justify-center flex-shrink-0">
              <MessageCircle className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm text-gray-800">
                Chat with Support
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                Send us a message — we'll get back to you shortly
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0" />
          </button>

          <div className="grid grid-cols-2 gap-3">
            <a
              href="https://wa.me/2348000000000?text=Hi%2C%20I%20need%20help%20with%20my%20Pilnak%20delivery"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white border border-gray-100 rounded-2xl p-5 flex flex-col items-center gap-2.5 hover:border-[#25D366]/30 hover:shadow-md transition-all group"
            >
              <div className="h-12 w-12 bg-[#25D366]/10 rounded-2xl flex items-center justify-center group-hover:bg-[#25D366]/15 transition-colors">
                <MessageSquare className="h-6 w-6 text-[#25D366]" />
              </div>
              <p className="font-bold text-sm text-gray-800">WhatsApp</p>
              <p className="text-xs text-gray-400 text-center">
                Chat with support
              </p>
            </a>
            <div className="bg-white border border-gray-100 rounded-2xl p-5 flex flex-col items-center gap-2.5">
              <div className="h-12 w-12 bg-blue-50 rounded-2xl flex items-center justify-center">
                <Phone className="h-6 w-6 text-blue-600" />
              </div>
              <p className="font-bold text-sm text-gray-800">Call Us</p>
              <a
                href="tel:+2348000000000"
                className="text-xs text-primary font-semibold hover:underline"
              >
                +234 800 000 0000
              </a>
            </div>
          </div>
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-gray-50">
              <h2 className="font-semibold text-gray-900 text-sm">
                Frequently Asked Questions
              </h2>
            </div>
            <div className="divide-y divide-gray-50">
              {[
                {
                  q: "How do I track my delivery?",
                  a: "Go to the Deliveries tab and tap any active delivery to see real-time tracking.",
                },
                {
                  q: "How do I contact my driver?",
                  a: "Once a driver is assigned, you can chat or call through the tracking page.",
                },
                {
                  q: "Can I cancel a delivery?",
                  a: "Yes — cancel for free while it's pending or just assigned. Tap Cancel on the delivery card.",
                },
                {
                  q: "How do I give my delivery a custom name?",
                  a: "When creating a new delivery, enter a name in the 'Delivery Name' field on the first step.",
                },
                {
                  q: "How do I leave a review?",
                  a: "After a delivery is completed, tap the Review button on the delivery card to rate your driver and leave feedback.",
                },
                {
                  q: "How does delivery sharing work?",
                  a: "Tap the share icon on any active delivery. Recipients get a named Google Maps link — no app needed.",
                },
              ].map((faq, i) => (
                <div
                  key={i}
                  className="px-5 py-4 hover:bg-gray-50/50 transition-colors"
                >
                  <p className="font-semibold text-sm text-gray-800 mb-1.5">
                    {faq.q}
                  </p>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    {faq.a}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  // ── Render ────────────────────────────────────────────────────────────────

  // Computed values for the mobile full-screen chat overlay
  const isMobileChatOpen =
    (activeChat !== null || activeSupportChat) && activeTab === "messages";
  const mobileChatCustomerName =
    (profile?.firstName
      ? `${profile.firstName}${profile.lastName ? " " + profile.lastName : ""}`
      : null) ?? user?.email?.split("@")[0];
  const mobileChatDelivery = activeChat
    ? deliveries.find((d) => d.id === activeChat.id)
    : null;
  const mobileChatRoute =
    [
      mobileChatDelivery?.pickup?.address?.split(",")[0]?.trim(),
      mobileChatDelivery?.dropoff?.address?.split(",")[0]?.trim(),
    ]
      .filter(Boolean)
      .join(" → ") || undefined;

  return (
    <div className="min-h-[100dvh] bg-[#f7f8fa]">
      {activeCall && (
        <VoiceCall
          currentUserId={user?.uid}
          otherUserId={activeCall.userId}
          otherUserName={activeCall.userName}
          onEnd={() => setActiveCall(null)}
        />
      )}

      <DriverDetailModal
        driver={selectedDriverDetail}
        onClose={() => setSelectedDriverDetail(null)}
        onSendDelivery={(driver) => {
          setPreselectedDriver(driver);
          setActiveTab("home");
          setViewMode("new-request");
        }}
      />
      <ReviewDialog
        delivery={selectedForRating}
        driverInfo={ratingDriverInfo}
        onSubmit={handleSubmitReview}
        onClose={() => {
          setSelectedForRating(null);
          setRatingDriverInfo(null);
        }}
      />
      <ReportDriverDialog
        delivery={selectedForReport}
        onClose={() => setSelectedForReport(null)}
      />
      <ReceiptDialog
        delivery={selectedForReceipt}
        profile={profile}
        onClose={() => setSelectedForReceipt(null)}
      />

      {/* ── DESKTOP LAYOUT ── */}
      <div className="hidden lg:flex h-screen overflow-hidden">
        <aside className="w-64 bg-[#008A39] flex flex-col flex-shrink-0">
          <div className="px-5 py-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="flex flex-col leading-none gap-[5px]">
                <Logo size="md" className="text-white" />
                <span
                  className="text-[9px] font-semibold uppercase text-white/45 tracking-widest"
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    letterSpacing: "0.2em",
                  }}
                >
                  Customer Dashboard
                </span>
              </div>
            </div>
          </div>
          <div className="px-4 pt-4 pb-2">
            <div
              className="flex items-center gap-3 p-3 rounded-2xl bg-white/10 cursor-pointer hover:bg-white/15 transition-colors min-w-0"
              onClick={() => switchTab("profile")}
            >
              <Avatar className="h-10 w-10 rounded-xl flex-shrink-0 ring-2 ring-white/20">
                <AvatarImage src={profile?.photoURL} />
                <AvatarFallback className="rounded-xl bg-white/20 text-white text-sm font-bold">
                  {profile?.firstName?.[0]}
                  {profile?.lastName?.[0]}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-white truncate leading-tight">
                  {profile?.firstName} {profile?.lastName}
                </p>
                <p className="text-[11px] text-white/55 truncate">
                  {profile?.email}
                </p>
              </div>
            </div>
          </div>
          <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
            {sideNavItems.map((item) => (
              <SideNavItem
                key={item.id}
                {...item}
                active={activeTab === item.id && viewMode === "default"}
                onClick={() => switchTab(item.id as TabType)}
              />
            ))}
          </nav>
          <div className="p-4 border-t border-white/10">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-white/60 hover:bg-white/10 hover:text-white transition-all"
            >
              <LogOut className="h-5 w-5 flex-shrink-0" />
              <span>Sign Out</span>
            </button>
          </div>
        </aside>

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <header className="bg-white border-b border-gray-100 px-8 h-16 flex items-center justify-end gap-4 flex-shrink-0">
            <div className="flex items-center gap-2">
              <DropdownMenu
                open={showNotificationsDesktop}
                onOpenChange={setShowNotificationsDesktop}
              >
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="relative h-9 w-9 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-100"
                  >
                    <Bell className="h-4 w-4 text-gray-500" />
                    {unreadNotifs > 0 && (
                      <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-red-500 rounded-full ring-2 ring-white" />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-80 rounded-2xl border-gray-100 shadow-xl"
                >
                  <DropdownMenuLabel className="font-bold text-gray-900 flex items-center justify-between">
                    <span>Notifications</span>
                    {unreadNotifs > 0 && (
                      <button
                        className="text-xs font-normal text-primary hover:underline"
                        onClick={(e) => {
                          e.preventDefault();
                          void markAllNotificationsRead(notifications);
                        }}
                      >
                        Mark all as read
                      </button>
                    )}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-gray-50" />
                  {notifications.length > 0 ? (
                    notifications.slice(0, 8).map((n) => (
                      <DropdownMenuItem
                        key={n.id}
                        className={`flex flex-col items-start p-3 rounded-xl mx-1 cursor-pointer ${!n.read ? "bg-primary/5" : "hover:bg-gray-50"}`}
                        onClick={() =>
                          updateDoc(doc(db, "notifications", n.id), {
                            read: true,
                          }).catch(() => {})
                        }
                      >
                        <p className="font-semibold text-sm text-gray-800">
                          {n.title}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">
                          {n.message}
                        </p>
                      </DropdownMenuItem>
                    ))
                  ) : (
                    <div className="p-8 text-center text-sm text-gray-400">
                      No notifications yet
                    </div>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                onClick={() => setViewMode("new-request")}
                className="rounded-xl shadow-md shadow-primary/20 font-bold"
              >
                <Plus className="h-4 w-4 mr-1.5" />
                New Delivery
              </Button>
            </div>
          </header>
          <main
            ref={desktopMainRef}
            className="flex-1 min-h-0 overflow-hidden flex flex-col"
          >
            {activeTab === "messages" && viewMode === "default" ? (
              <div className="flex-1 min-h-0 overflow-hidden h-full">
                {renderTabContent()}
              </div>
            ) : viewMode !== "default" ? (
              <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                {/* Desktop full-page header */}
                <div className="flex-shrink-0 flex items-center gap-3 px-8 py-4 bg-white border-b border-gray-100">
                  <button
                    onClick={() => {
                      setPreselectedDriver(null);
                      setHeroBooking(null);
                      setViewMode("default");
                      setSelectedDelivery(null);
                    }}
                    className="h-9 w-9 rounded-xl flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors flex-shrink-0"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <h1 className="font-bold text-base text-gray-900">
                    {viewMode === "new-request" || viewMode === "schedule"
                      ? "New Delivery"
                      : viewMode === "tracking"
                        ? "Track Delivery"
                        : "Company Quote"}
                  </h1>
                </div>
                {/* Content */}
                <div className="flex-1 overflow-y-auto bg-[#f7f8fa]">
                  <div className="py-8 px-8">{renderTabContent()}</div>
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto">
                <div className="px-8 py-6 max-w-6xl">{renderTabContent()}</div>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* ── MOBILE LAYOUT ── */}
      <div className="lg:hidden">
        <header
          className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          <div className="px-4 h-14 flex items-center justify-between gap-2 min-w-0">
            <Logo
              size="sm"
              iconWrapperClassName="bg-black rounded-full"
              iconClassName="text-[#008A39]" // ✅ square brackets
              textClassName="text-[#008A39]" // ✅ square brackets
              accentClassName="text-red-400 not-italic" // ✅ now works, inline style removed
              className="opacity-80 hover:opacity-100 transition-opacity"
            />
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <DropdownMenu
                open={showNotificationsMobile}
                onOpenChange={setShowNotificationsMobile}
              >
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="relative h-9 w-9 rounded-xl bg-gray-50 border border-gray-100 flex-shrink-0"
                  >
                    <Bell className="h-4 w-4 text-gray-500" />
                    {unreadNotifs > 0 && (
                      <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-red-500 rounded-full ring-2 ring-white" />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-[calc(100vw-2rem)] max-w-sm rounded-2xl border-gray-100 shadow-xl mx-4"
                >
                  <DropdownMenuLabel className="font-bold text-gray-900 flex items-center justify-between px-3 py-2">
                    <span>Notifications</span>
                    {unreadNotifs > 0 && (
                      <button
                        className="text-xs bg-primary text-white px-2 py-0.5 rounded-full font-bold hover:bg-primary/90"
                        onClick={(e) => {
                          e.preventDefault();
                          void markAllNotificationsRead(notifications);
                        }}
                      >
                        Mark all read
                      </button>
                    )}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <div className="max-h-72 overflow-y-auto">
                    {notifications.length > 0 ? (
                      notifications.slice(0, 8).map((n) => (
                        <DropdownMenuItem
                          key={n.id}
                          className={`flex flex-col items-start p-3 rounded-xl mx-1 my-0.5 cursor-pointer ${!n.read ? "bg-primary/5" : ""}`}
                          onClick={() =>
                            updateDoc(doc(db, "notifications", n.id), {
                              read: true,
                            }).catch(() => {})
                          }
                        >
                          {!n.read && (
                            <div className="w-1.5 h-1.5 rounded-full bg-primary mb-1 flex-shrink-0" />
                          )}
                          <p className="font-semibold text-sm text-gray-800 leading-snug">
                            {n.title}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5 line-clamp-2 leading-relaxed">
                            {n.message}
                          </p>
                        </DropdownMenuItem>
                      ))
                    ) : (
                      <div className="p-8 text-center text-sm text-gray-400">
                        No notifications yet
                      </div>
                    )}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-full p-0 flex-shrink-0"
                  >
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={profile?.photoURL} />
                      <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">
                        {profile?.firstName?.[0]}
                        {profile?.lastName?.[0]}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-52 rounded-2xl border-gray-100 shadow-xl"
                >
                  <DropdownMenuLabel>
                    <p className="font-bold text-sm truncate">
                      {profile?.firstName} {profile?.lastName}
                    </p>
                    <p className="text-xs text-gray-400 font-normal truncate">
                      {profile?.email}
                    </p>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {[
                    { label: "Profile", icon: User, tab: "profile" },
                    { label: "History", icon: History, tab: "history" },
                    { label: "Support", icon: HelpCircle, tab: "support" },
                  ].map((it) => (
                    <DropdownMenuItem
                      key={it.tab}
                      onClick={() => switchTab(it.tab as TabType)}
                      className="rounded-xl mx-1"
                    >
                      <it.icon className="mr-2 h-4 w-4 text-gray-400" />
                      {it.label}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="text-red-500 rounded-xl mx-1"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <main
          className="px-4 py-4 min-h-[calc(100dvh-112px)]"
          style={{
            paddingBottom: "calc(5rem + env(safe-area-inset-bottom, 0px))",
          }}
        >
          {renderTabContent()}
        </main>

        <nav
          className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-100"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          <div className="flex items-center justify-around h-[60px] px-1">
            {bottomNav.map((tab) => {
              const isActive = activeTab === tab.id && viewMode === "default";
              return (
                <button
                  key={tab.id}
                  onClick={() => switchTab(tab.id as TabType)}
                  className={`relative flex flex-col items-center justify-center gap-0.5 py-1.5 px-3 rounded-xl transition-all min-w-0 flex-1 max-w-[72px] ${isActive ? "text-primary" : "text-gray-400 active:scale-90"}`}
                >
                  {isActive && (
                    <span className="absolute inset-0 bg-primary/8 rounded-xl" />
                  )}
                  <tab.icon
                    className={`h-[22px] w-[22px] flex-shrink-0 transition-all ${isActive ? "scale-110" : ""}`}
                  />
                  <span
                    className={`text-[9px] leading-tight whitespace-nowrap tracking-wide ${isActive ? "font-bold" : "font-medium"}`}
                  >
                    {tab.label}
                  </span>
                  {(tab.badge ?? 0) > 0 && (
                    <span className="absolute top-0.5 right-1.5 h-4 min-w-4 px-1 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
                      {(tab.badge ?? 0) > 9 ? "9+" : tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        {/* ── Mobile full-screen delivery overlay ──────────────────────── */}
        {viewMode !== "default" && (
          <div
            className="fixed inset-0 z-[60] flex flex-col bg-[#f7f8fa] overscroll-none"
            style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
          >
            {/* Page header */}
            <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-100 shadow-sm">
              <button
                onClick={() => {
                  setPreselectedDriver(null);
                  setHeroBooking(null);
                  setViewMode("default");
                  setSelectedDelivery(null);
                }}
                className="h-9 w-9 rounded-xl flex items-center justify-center text-gray-500 hover:bg-gray-100 active:bg-gray-200 transition-colors flex-shrink-0"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <h1 className="font-bold text-base text-gray-900 truncate">
                {viewMode === "new-request" || viewMode === "schedule"
                  ? "New Delivery"
                  : viewMode === "tracking"
                    ? "Track Delivery"
                    : "Company Quote"}
              </h1>
            </div>
            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              <div className="py-4 px-4">{renderTabContent()}</div>
            </div>
          </div>
        )}

        {/* ── Mobile full-screen chat overlay ──────────────────────────── */}
        {isMobileChatOpen && (
          <div
            className="fixed inset-x-0 top-0 z-[60] bg-[#f2f6f3] overscroll-none"
            style={{
              height: `${chatOverlayH}px`,
              paddingTop: "env(safe-area-inset-top, 0px)",
            }}
          >
            {activeChat ? (
              <ChatPanel
                key={activeChat.id}
                flat
                backButton
                requestId={activeChat.id}
                currentUserId={user?.uid ?? ""}
                senderName={senderName}
                otherUserId={activeChat.driverId}
                otherUserName={chatDriverInfo[activeChat.id]?.name ?? "Driver"}
                otherUserPhoto={chatDriverInfo[activeChat.id]?.photoUrl ?? null}
                deliveryName={mobileChatRoute}
                onClose={() => {
                  setActiveChat(null);
                  setActiveSupportChat(false);
                }}
              />
            ) : (
              <SupportChatView
                flat
                backButton
                userId={user?.uid ?? ""}
                customerName={mobileChatCustomerName}
                onClose={() => {
                  setActiveChat(null);
                  setActiveSupportChat(false);
                }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

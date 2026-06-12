import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { MapView } from "@/components/map/MapView";
import { ChatPanel } from "@/components/chat/ChatPanel";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  deleteDoc,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/integrations/firebase/client";
import {
  createAssignment,
  updateDeliveryStatus,
  setPriceQuote,
  setPaymentDetails,
  confirmPayment,
  listenAdminNotifications,
  markAdminNotificationRead,
  markAllAdminNotificationsRead,
  geocodeAddress,
  haversineKm,
  listenSupportChats,
  listenMessages,
  sendMessage as firebaseSendMessage,
  type AdminNotificationDoc,
  type DeliveryRequestDoc,
  type DriverDoc,
  type UserDoc,
  type DeliveryStatus,
  type AssignmentDoc,
  type VehicleDoc,
  type PaymentDetails,
  type GeocodedResult,
  type ChatDoc,
  migrateVehicleTypes,
  type MigrateVehicleTypesResult,
} from "@/services/firebase";
import type { SearchPin } from "@/components/map/MapView";
import {
  Users,
  Truck,
  Package,
  MapPin,
  LogOut,
  LayoutDashboard,
  Settings,
  Bell,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Star,
  Phone,
  Mail,
  Calendar,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Activity,
  BarChart3,
  Download,
  RefreshCw,
  Eye,
  Edit,
  Trash2,
  MessageCircle,
  Navigation,
  Briefcase,
  Wifi,
  WifiOff,
  Circle,
  CircleDot,
  CheckCheck,
  X,
  ArrowUp,
  ArrowDown,
  MoreHorizontal,
  SendHorizonal,
  Send,
  User,
  Banknote,
  PhoneCall,
  Copy,
  ImageIcon,
  Locate,
  Target,
  Loader2,
  BellRing,
  Plus,
  ChevronRight,
  TrendingUp as Trend,
  Zap,
  Shield,
  Globe,
  Building2,
} from "lucide-react";
import { useBlockBack } from "@/hooks/useBlockBack";
import { useSessionState } from "@/hooks/useSessionState";

type TabType =
  | "dashboard"
  | "users"
  | "companies"
  | "drivers"
  | "deliveries"
  | "map"
  | "analytics"
  | "settings"
  | "support";

function safeDate(value: unknown): Date | null {
  if (!value) return null;
  if (
    typeof value === "object" &&
    "toDate" in (value as object) &&
    typeof (value as Timestamp).toDate === "function"
  ) {
    return (value as Timestamp).toDate();
  }
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

interface UserWithId extends UserDoc {
  id: string;
  createdAt?: Timestamp;
}
interface DriverWithId extends DriverDoc {
  id: string;
  createdAt?: Timestamp;
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  vehicleType?: string;
  plateNumber?: string;
  lastLocationUpdate?: Timestamp;
}
interface RequestWithId extends DeliveryRequestDoc {
  id: string;
  createdAt?: Timestamp;
  completedAt?: Timestamp;
  driverId?: string;
}
interface CompanyWithId {
  id: string;
  userId?: string;
  companyName?: string;
  companyPhone?: string;
  companyAddress?: string;
  companyRegNumber?: string;
  companyWebsite?: string | null;
  contactPersonName?: string;
  contactPersonPhone?: string;
  email?: string;
  approvalStatus?: "pending" | "approved" | "rejected";
  totalDeliveries?: number;
  walletBalance?: number;
  createdAt?: Timestamp;
}

// ── Status Badge ──────────────────────────────────────────────────────────────

const StatusBadge = ({ status }: { status: string }) => {
  const variants: Record<string, { color: string; icon: React.ElementType }> = {
    active: {
      color: "bg-emerald-50 text-emerald-700 border-emerald-200",
      icon: CheckCircle,
    },
    inactive: {
      color: "bg-gray-100 text-gray-600 border-gray-200",
      icon: XCircle,
    },
    pending: {
      color: "bg-amber-50 text-amber-700 border-amber-200",
      icon: Clock,
    },
    pending_verification: {
      color: "bg-amber-50 text-amber-700 border-amber-200",
      icon: Clock,
    },
    admin_review: {
      color: "bg-amber-50 text-amber-700 border-amber-200",
      icon: Clock,
    },
    suspended: {
      color: "bg-red-50 text-red-700 border-red-200",
      icon: AlertCircle,
    },
    approved: {
      color: "bg-emerald-50 text-emerald-700 border-emerald-200",
      icon: CheckCircle,
    },
    rejected: { color: "bg-red-50 text-red-700 border-red-200", icon: XCircle },
    completed: {
      color: "bg-blue-50 text-blue-700 border-blue-200",
      icon: CheckCheck,
    },
    cancelled: { color: "bg-gray-100 text-gray-600 border-gray-200", icon: X },
    in_progress: {
      color: "bg-violet-50 text-violet-700 border-violet-200",
      icon: Activity,
    },
    driver_assigned: {
      color: "bg-indigo-50 text-indigo-700 border-indigo-200",
      icon: Truck,
    },
    driver_accepted: {
      color: "bg-indigo-50 text-indigo-700 border-indigo-200",
      icon: Truck,
    },
    price_set: {
      color: "bg-orange-50 text-orange-700 border-orange-200",
      icon: DollarSign,
    },
    negotiating: {
      color: "bg-sky-50 text-sky-700 border-sky-200",
      icon: PhoneCall,
    },
    payment_pending: {
      color: "bg-indigo-50 text-indigo-700 border-indigo-200",
      icon: Banknote,
    },
    customer_confirmed: {
      color: "bg-teal-50 text-teal-700 border-teal-200",
      icon: CheckCircle,
    },
    pickup: {
      color: "bg-orange-50 text-orange-700 border-orange-200",
      icon: MapPin,
    },
    delivery: {
      color: "bg-teal-50 text-teal-700 border-teal-200",
      icon: Package,
    },
  };
  const variant = variants[status] ?? variants.pending;
  const Icon = variant.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${variant.color}`}
    >
      <Icon className="h-3 w-3" />
      <span className="capitalize">{status.replace(/_/g, " ")}</span>
    </span>
  );
};

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
  trend,
  sub,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  accent: string;
  trend?: number;
  sub?: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-4 lg:p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div
          className={`h-9 w-9 lg:h-11 lg:w-11 rounded-xl flex items-center justify-center ${accent}`}
        >
          <Icon className="h-4 w-4 lg:h-5 lg:w-5" />
        </div>
        {trend !== undefined && (
          <span
            className={`flex items-center gap-0.5 text-[10px] lg:text-[11px] font-bold px-1.5 py-0.5 rounded-full ${
              trend >= 0
                ? "text-emerald-700 bg-emerald-50"
                : "text-red-600 bg-red-50"
            }`}
          >
            {trend >= 0 ? (
              <ArrowUp className="h-2.5 w-2.5" />
            ) : (
              <ArrowDown className="h-2.5 w-2.5" />
            )}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className="text-xl lg:text-2xl font-bold text-gray-900 tracking-tight leading-none mb-1 truncate">
        {value}
      </p>
      <p className="text-[10px] lg:text-xs font-semibold text-gray-400 uppercase tracking-wider leading-tight">
        {label}
      </p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

// ── Online Indicator ──────────────────────────────────────────────────────────

const OnlineIndicator = ({ isOnline }: { isOnline: boolean }) => (
  <div className="flex items-center gap-1.5">
    <div
      className={`w-2 h-2 rounded-full ${isOnline ? "bg-emerald-500" : "bg-gray-300"}`}
    />
    <span
      className={`text-xs font-medium ${isOnline ? "text-emerald-600" : "text-gray-400"}`}
    >
      {isOnline ? "Online" : "Offline"}
    </span>
  </div>
);

// ── User Avatar ───────────────────────────────────────────────────────────────

const UserAvatar = ({ name, email }: { name: string; email: string }) => {
  const initials = name
    ? name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : (email?.[0]?.toUpperCase() ?? "U");
  return (
    <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
      <span className="text-xs font-bold text-primary">{initials}</span>
    </div>
  );
};

// ── Sidebar Nav Item ──────────────────────────────────────────────────────────

function NavItem({
  id,
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
      className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group ${
        active
          ? "bg-primary text-white shadow-md shadow-primary/25"
          : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
      }`}
    >
      <Icon
        className={`h-4.5 w-4.5 flex-shrink-0 h-[18px] w-[18px] ${active ? "text-white" : "text-gray-400 group-hover:text-gray-700"}`}
      />
      <span className="flex-1 text-left">{label}</span>
      {(badge ?? 0) > 0 && (
        <span
          className={`h-5 min-w-5 px-1 rounded-full text-[10px] font-bold flex items-center justify-center ${
            active ? "bg-white/25 text-white" : "bg-primary text-white"
          }`}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

// ── Notification Panel (slide-in drawer) ─────────────────────────────────────

function NotificationPanel({
  notifications,
  open,
  onClose,
  onMarkRead,
  onMarkAllRead,
  onNavigate,
}: {
  notifications: Array<AdminNotificationDoc & { id: string }>;
  open: boolean;
  onClose: () => void;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onNavigate: (requestId: string) => void;
}) {
  const [activeFilter, setActiveFilter] = useState<"All" | "Unread">("All");
  const unreadCount = notifications.filter((n) => !n.read).length;
  const displayed =
    activeFilter === "Unread" ? notifications.filter((n) => !n.read) : notifications;

  const iconForType = (type: AdminNotificationDoc["type"]) => {
    switch (type) {
      case "negotiation_request":
        return {
          icon: PhoneCall,
          bg: "bg-sky-50",
          color: "text-sky-600",
          label: "Negotiation",
        };
      case "payment_sent":
        return {
          icon: Banknote,
          bg: "bg-emerald-50",
          color: "text-emerald-600",
          label: "Payment",
        };
      case "delivery_proof":
        return {
          icon: ImageIcon,
          bg: "bg-violet-50",
          color: "text-violet-600",
          label: "Proof",
        };
      case "driver_completed":
        return {
          icon: CheckCircle,
          bg: "bg-teal-50",
          color: "text-teal-600",
          label: "Completed",
        };
      case "driver_accepted":
        return {
          icon: CheckCircle,
          bg: "bg-green-50",
          color: "text-green-600",
          label: "Accepted",
        };
      case "driver_arrived":
        return {
          icon: MapPin,
          bg: "bg-blue-50",
          color: "text-blue-600",
          label: "Arrived",
        };
      case "delivery_started":
        return {
          icon: Truck,
          bg: "bg-violet-50",
          color: "text-violet-600",
          label: "In Progress",
        };
      case "driver_report":
        return {
          icon: AlertCircle,
          bg: "bg-red-50",
          color: "text-red-600",
          label: "Driver Report",
        };
      default:
        return {
          icon: Bell,
          bg: "bg-gray-100",
          color: "text-gray-500",
          label: "Alert",
        };
    }
  };

  const typeLabel: Record<string, string> = {
    negotiation_request: "Negotiation Request",
    payment_sent: "Payment Received",
    delivery_proof: "Delivery Proof",
    driver_completed: "Delivery Completed",
    driver_accepted: "Driver Accepted",
    driver_arrived: "Driver Arrived",
    delivery_started: "Delivery In Progress",
    driver_report: "Driver Report",
  };

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 z-50 h-full w-full sm:w-[400px] bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-out ${open ? "translate-x-0" : "translate-x-full"}`}
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <BellRing className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 text-sm">Notifications</h2>
              <p className="text-xs text-gray-400">
                {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={onMarkAllRead}
                className="text-xs font-semibold text-primary bg-primary/8 hover:bg-primary/15 px-3 py-1.5 rounded-lg transition-colors"
              >
                Mark all read
              </button>
            )}
            <button
              onClick={onClose}
              className="h-8 w-8 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
            >
              <X className="h-4 w-4 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 px-4 py-3 border-b border-gray-50">
          {(["All", "Unread"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveFilter(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${activeFilter === tab ? "bg-primary text-white" : "text-gray-500 hover:bg-gray-100"}`}
            >
              {tab}
              {tab === "Unread" && unreadCount > 0 && (
                <span className="ml-1.5 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                  {unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Notification list */}
        <div className="flex-1 overflow-y-auto">
          {displayed.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
              <div className="h-16 w-16 rounded-2xl bg-gray-100 flex items-center justify-center">
                <Bell className="h-7 w-7 text-gray-300" />
              </div>
              <p className="font-semibold text-gray-500 text-sm">
                {activeFilter === "Unread" ? "No unread notifications" : "No notifications yet"}
              </p>
              <p className="text-xs text-gray-400">
                {activeFilter === "Unread"
                  ? "You're all caught up!"
                  : "You'll see driver applications, payments, and delivery updates here"}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {displayed.map((n) => {
                const { icon: Icon, bg, color } = iconForType(n.type);
                return (
                  <div
                    key={n.id}
                    className={`flex gap-3.5 px-4 py-4 cursor-pointer hover:bg-gray-50/80 transition-colors relative ${!n.read ? "bg-primary/[0.03]" : ""}`}
                    onClick={() => {
                      if (!n.read) onMarkRead(n.id);
                      onNavigate(n.requestId);
                      onClose();
                    }}
                  >
                    {/* Unread stripe */}
                    {!n.read && (
                      <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary rounded-r-full" />
                    )}

                    {/* Icon */}
                    <div
                      className={`h-10 w-10 rounded-xl ${bg} flex items-center justify-center flex-shrink-0 mt-0.5`}
                    >
                      <Icon className={`h-5 w-5 ${color}`} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={`text-sm leading-snug ${!n.read ? "font-semibold text-gray-900" : "font-medium text-gray-700"}`}
                        >
                          {n.message}
                        </p>
                        {!n.read && (
                          <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${bg} ${color}`}
                        >
                          {typeLabel[n.type] ?? "Alert"}
                        </span>
                        <span className="text-xs text-gray-400 font-mono">
                          #{n.requestId?.slice(0, 8)}
                        </span>
                      </div>
                      {n.proofImageUrl && (
                        <img
                          src={n.proofImageUrl}
                          alt="Delivery proof"
                          className="mt-2.5 rounded-xl w-full max-h-36 object-cover border border-gray-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(n.proofImageUrl!, "_blank");
                          }}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/50">
          <p className="text-xs text-center text-gray-400">
            Tap any notification to jump to the delivery
          </p>
        </div>
      </div>
    </>
  );
}

// ── Notification Bell Button ──────────────────────────────────────────────────

function NotificationBellButton({
  unreadCount,
  onClick,
}: {
  unreadCount: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="relative h-9 w-9 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center hover:bg-gray-100 transition-colors"
    >
      <Bell className="h-4 w-4 text-gray-500" />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-[9px] font-bold text-white flex items-center justify-center">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </button>
  );
}

// ── Price Quote Dialog ────────────────────────────────────────────────────────

function PriceQuoteDialog({
  request,
  adminUid,
  users,
  onClose,
}: {
  request: RequestWithId | null;
  adminUid: string;
  users: UserWithId[];
  onClose: () => void;
}) {
  const [price, setPrice] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const customer = request
    ? users.find((u) => u.id === request.customerId)
    : null;

  const handleSend = async () => {
    const amount = parseFloat(price);
    if (!request || isNaN(amount) || amount <= 0) {
      toast.error("Enter a valid price");
      return;
    }
    setLoading(true);
    try {
      await setPriceQuote(
        request.id,
        amount,
        adminUid,
        note.trim() || undefined,
      );
      toast.success(`Price quote of ₦${amount.toLocaleString()} sent`);
      onClose();
    } catch {
      toast.error("Failed to send price quote");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={!!request} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-gray-900">Send Price Quote</DialogTitle>
          <DialogDescription>
            Delivery #{request?.id.slice(0, 8)} — Quote a price for the customer
            to review.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {customer && (
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Customer
              </p>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm">
                    {customer.firstName} {customer.lastName}
                  </p>
                  <div className="flex gap-3 mt-0.5">
                    {customer.email && (
                      <a
                        href={`mailto:${customer.email}`}
                        className="flex items-center gap-1 text-xs text-gray-400 hover:text-primary"
                      >
                        <Mail className="h-3 w-3" />
                        {customer.email}
                      </a>
                    )}
                    {customer.phone && (
                      <a
                        href={`tel:${customer.phone}`}
                        className="flex items-center gap-1 text-xs text-gray-400 hover:text-primary"
                      >
                        <Phone className="h-3 w-3" />
                        {customer.phone}
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-2 text-sm">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Route
            </p>
            <div className="flex gap-2">
              <CircleDot className="h-4 w-4 text-emerald-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-gray-400">Pickup</p>
                <p className="font-medium text-sm">
                  {request?.pickup?.address ?? "—"}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Circle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-gray-400">Drop-off</p>
                <p className="font-medium text-sm">
                  {request?.dropoff?.address ?? "—"}
                </p>
              </div>
            </div>
          </div>
          <div>
            <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Quote Price (₦)
            </Label>
            <div className="relative mt-1.5">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-400">
                ₦
              </span>
              <Input
                type="number"
                min="0"
                placeholder="e.g. 5000"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="pl-8 rounded-xl border-gray-200 h-11"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Note{" "}
              <span className="font-normal normal-case text-gray-400">
                (optional)
              </span>
            </Label>
            <Textarea
              placeholder="Add any details..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1.5 rounded-xl border-gray-200 min-h-[80px] resize-none"
            />
          </div>
          <div className="flex gap-3 pt-1">
            <Button
              variant="outline"
              className="flex-1 rounded-xl border-gray-200"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 rounded-xl shadow-sm shadow-primary/20"
              onClick={handleSend}
              disabled={loading || !price}
            >
              {loading ? (
                "Sending..."
              ) : (
                <>
                  <SendHorizonal className="h-4 w-4 mr-2" />
                  Send Quote
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Payment Details Dialog ────────────────────────────────────────────────────

function PaymentDetailsDialog({
  request,
  adminUid,
  users,
  onClose,
}: {
  request: RequestWithId | null;
  adminUid: string;
  users: UserWithId[];
  onClose: () => void;
}) {
  const [price, setPrice] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [loading, setLoading] = useState(false);
  const customer = request
    ? users.find((u) => u.id === request.customerId)
    : null;

  useEffect(() => {
    if (request?.negotiatedPrice) setPrice(String(request.negotiatedPrice));
    else if (request?.quotedPrice) setPrice(String(request.quotedPrice));
  }, [request]);

  const handleSend = async () => {
    const amount = parseFloat(price);
    if (!request || isNaN(amount) || amount <= 0) {
      toast.error("Enter a valid price");
      return;
    }
    if (!bankName.trim() || !accountNumber.trim() || !accountName.trim()) {
      toast.error("Fill in all payment details");
      return;
    }
    setLoading(true);
    try {
      await setPaymentDetails(
        request.id,
        amount,
        {
          bankName: bankName.trim(),
          accountNumber: accountNumber.trim(),
          accountName: accountName.trim(),
        },
        adminUid,
      );
      toast.success("Payment details sent");
      onClose();
    } catch {
      toast.error("Failed to send payment details");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={!!request} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-gray-900">
            Set Payment Details
          </DialogTitle>
          <DialogDescription>
            Delivery #{request?.id.slice(0, 8)}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {customer && (
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3.5 flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <User className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm">
                  {customer.firstName} {customer.lastName}
                </p>
                {customer.phone && (
                  <a
                    href={`tel:${customer.phone}`}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-primary"
                  >
                    <Phone className="h-3 w-3" />
                    {customer.phone}
                  </a>
                )}
              </div>
            </div>
          )}
          <div>
            <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Agreed Price (₦)
            </Label>
            <div className="relative mt-1.5">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-400">
                ₦
              </span>
              <Input
                type="number"
                min="0"
                placeholder="e.g. 7500"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="pl-8 rounded-xl border-gray-200 h-11"
              />
            </div>
          </div>
          <div className="space-y-2.5">
            <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Bank Account Details
            </Label>
            <Input
              placeholder="Bank name"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              className="rounded-xl border-gray-200 h-11"
            />
            <Input
              placeholder="Account number"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              className="rounded-xl border-gray-200 h-11"
            />
            <Input
              placeholder="Account name"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              className="rounded-xl border-gray-200 h-11"
            />
          </div>
          <div className="flex gap-3 pt-1">
            <Button
              variant="outline"
              className="flex-1 rounded-xl border-gray-200"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 rounded-xl shadow-sm shadow-primary/20"
              onClick={handleSend}
              disabled={
                loading || !price || !bankName || !accountNumber || !accountName
              }
            >
              {loading ? (
                "Sending..."
              ) : (
                <>
                  <Banknote className="h-4 w-4 mr-2" />
                  Send Payment Details
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Admin Live Map ────────────────────────────────────────────────────────────

function AdminLiveMap({
  drivers,
  requests,
  users,
  vehicles,
  onAssignDriver,
}: {
  drivers: DriverWithId[];
  requests: RequestWithId[];
  users: UserWithId[];
  vehicles: (VehicleDoc & { id: string })[];
  onAssignDriver: (requestId: string, driverId: string) => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GeocodedResult[]>([]);
  const [searchPin, setSearchPin] = useState<SearchPin | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [nearbyDrivers, setNearbyDrivers] = useState<
    Array<DriverWithId & { distanceKm: number }>
  >([]);
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<string>("");
  const [routeDeliveryId, setRouteDeliveryId] = useState<string>("");

  const pendingDeliveries = requests.filter(
    (r) => r.status === "customer_confirmed" && !r.driverId,
  );
  const onlineDrivers = drivers.filter(
    (d) =>
      d.isOnline &&
      d.status === "approved" &&
      d.currentLocation?.lat &&
      d.currentLocation?.lng,
  );

  const mapMarkers = useMemo(() => {
    const dMarkers = onlineDrivers.map((d) => {
      const dist = searchPin
        ? haversineKm(
            searchPin.lat,
            searchPin.lng,
            d.currentLocation!.lat,
            d.currentLocation!.lng,
          )
        : null;
      const vehicle = vehicles.find((v) => v.driverId === d.id);
      return {
        id: d.id,
        latitude: d.currentLocation!.lat,
        longitude: d.currentLocation!.lng,
        type: "driver" as const,
        label: `${d.firstName ?? ""} ${d.lastName ?? "Driver"}`.trim(),
        meta: [
          vehicle
            ? `${vehicle.vehicleType.replace(/_/g, " ")}${vehicle.plateNumber ? " · " + vehicle.plateNumber : ""}`
            : null,
          dist !== null ? `<strong>${dist.toFixed(1)} km away</strong>` : null,
        ]
          .filter(Boolean)
          .join("<br/>"),
      };
    });
    const pMarkers = requests
      .filter(
        (r) =>
          r.pickup?.lat &&
          r.pickup?.lng &&
          !["completed", "cancelled"].includes(r.status),
      )
      .map((r) => ({
        id: `req-${r.id}`,
        latitude: r.pickup.lat,
        longitude: r.pickup.lng,
        type: "pickup" as const,
        label: `#${r.id.slice(0, 8)}`,
        meta: `${r.status.replace(/_/g, " ")}${r.quotedPrice ? " · ₦" + r.quotedPrice.toLocaleString() : ""}`,
      }));
    return [...dMarkers, ...pMarkers];
  }, [onlineDrivers, requests, vehicles, searchPin]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setSearchResults([]);
    try {
      const results = await geocodeAddress(searchQuery);
      setSearchResults(results);
      if (results.length > 0) {
        const first = results[0];
        setSearchPin({
          lat: first.lat,
          lng: first.lng,
          label: first.displayName,
        });
        updateNearby(first.lat, first.lng);
      }
    } catch {
    } finally {
      setIsSearching(false);
    }
  };

  const updateNearby = (lat: number, lng: number) => {
    const withDist = onlineDrivers
      .filter((d) => d.currentLocation?.lat && d.currentLocation?.lng)
      .map((d) => ({
        ...d,
        distanceKm: haversineKm(
          lat,
          lng,
          d.currentLocation!.lat,
          d.currentLocation!.lng,
        ),
      }))
      .sort((a, b) => a.distanceKm - b.distanceKm);
    setNearbyDrivers(withDist);
  };

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 lg:gap-3">
        {[
          {
            label: "Online Drivers",
            value: onlineDrivers.length,
            accent: "bg-emerald-50 text-emerald-600",
            icon: Truck,
          },
          {
            label: "Active Deliveries",
            value: requests.filter((r) =>
              ["in_progress", "driver_accepted", "arrived"].includes(r.status),
            ).length,
            accent: "bg-blue-50 text-blue-600",
            icon: Package,
          },
          {
            label: "Awaiting Driver",
            value: pendingDeliveries.length,
            accent: "bg-amber-50 text-amber-600",
            icon: Clock,
          },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-white rounded-2xl p-3 lg:p-4 border border-gray-100 shadow-sm"
          >
            <div
              className={`h-8 w-8 lg:h-10 lg:w-10 rounded-xl flex items-center justify-center mb-2 ${s.accent}`}
            >
              <s.icon className="h-4 w-4 lg:h-5 lg:w-5" />
            </div>
            <p className="text-xl lg:text-2xl font-bold text-gray-900 leading-none">
              {s.value}
            </p>
            <p className="text-[10px] lg:text-xs text-gray-400 mt-1 leading-tight">
              {s.label}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* Map card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50">
            <div className="flex items-start justify-between gap-2 mb-1">
              <h3 className="font-bold text-sm text-gray-900">
                Live Driver Map
              </h3>
              <div className="flex gap-1.5 flex-wrap justify-end">
                {[
                  { label: "Drivers", color: "bg-[#1e3a5f]" },
                  { label: "Pickups", color: "bg-emerald-500" },
                  { label: "Pin", color: "bg-amber-400" },
                ].map((b) => (
                  <span
                    key={b.label}
                    className="flex items-center gap-1 text-[10px] font-semibold text-gray-500 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-100"
                  >
                    <div
                      className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${b.color}`}
                    />
                    {b.label}
                  </span>
                ))}
              </div>
            </div>
            <p className="text-xs text-gray-400">
              {onlineDrivers.length} driver
              {onlineDrivers.length !== 1 ? "s" : ""} online · Click map to find
              nearby
            </p>
          </div>
          {(() => {
            const routeReq = routeDeliveryId
              ? requests.find((r) => r.id === routeDeliveryId)
              : null;
            const routeFrom =
              routeReq?.pickup?.lat && routeReq?.pickup?.lng
                ? ([routeReq.pickup.lat, routeReq.pickup.lng] as [number, number])
                : undefined;
            const routeTo =
              routeReq?.dropoff?.lat && routeReq?.dropoff?.lng
                ? ([routeReq.dropoff.lat, routeReq.dropoff.lng] as [number, number])
                : undefined;
            return (
              <div className="h-64 sm:h-80 lg:h-[500px]">
                <MapView
                  markers={mapMarkers}
                  className="w-full h-full"
                  searchPin={searchPin}
                  routeFrom={routeFrom}
                  routeTo={routeTo}
                  onMapClick={(lat, lng) => {
                    setSearchPin({
                      lat,
                      lng,
                      label: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
                    });
                    updateNearby(lat, lng);
                  }}
                />
              </div>
            );
          })()}
        </div>
        <div className="space-y-3">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <h3 className="font-semibold text-sm text-gray-900 flex items-center gap-2 mb-3">
              <Target className="h-4 w-4 text-amber-500" />
              Search Location
            </h3>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <Input
                  placeholder="Enter area..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="pl-8 h-9 text-sm rounded-xl border-gray-200"
                />
              </div>
              <Button
                size="sm"
                onClick={handleSearch}
                disabled={isSearching}
                className="h-9 px-3 rounded-xl"
              >
                {isSearching ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Locate className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
            {searchResults.length > 0 && (
              <div className="mt-2 border border-gray-100 rounded-xl divide-y divide-gray-50 overflow-hidden">
                {searchResults.slice(0, 4).map((r, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setSearchPin({
                        lat: r.lat,
                        lng: r.lng,
                        label: r.displayName,
                      });
                      updateNearby(r.lat, r.lng);
                      setSearchResults([]);
                      setSearchQuery(r.displayName.split(",")[0]);
                    }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 transition-colors"
                  >
                    <p className="font-medium truncate">
                      {r.displayName.split(",").slice(0, 2).join(",")}
                    </p>
                  </button>
                ))}
              </div>
            )}
            {searchPin && (
              <div className="mt-2 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                <p className="truncate flex-1">{searchPin.label}</p>
                <button
                  onClick={() => {
                    setSearchPin(null);
                    setNearbyDrivers([]);
                  }}
                >
                  <X className="h-3 w-3 text-gray-400 hover:text-gray-600" />
                </button>
              </div>
            )}
          </div>
          {/* Route viewer */}
          {(() => {
            const activeDeliveries = requests.filter(
              (r) =>
                ["in_progress", "driver_accepted", "arrived"].includes(
                  r.status,
                ) &&
                r.pickup?.lat &&
                r.dropoff?.lat,
            );
            if (activeDeliveries.length === 0) return null;
            return (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <h3 className="font-semibold text-sm text-gray-900 flex items-center gap-2 mb-3">
                  <Navigation className="h-4 w-4 text-primary" />
                  View Route
                </h3>
                <Select
                  value={routeDeliveryId}
                  onValueChange={setRouteDeliveryId}
                >
                  <SelectTrigger className="h-9 text-xs rounded-xl border-gray-200">
                    <SelectValue placeholder="Select active delivery…" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="" className="text-xs">
                      None
                    </SelectItem>
                    {activeDeliveries.map((r) => (
                      <SelectItem key={r.id} value={r.id} className="text-xs">
                        #{r.id.slice(0, 8)} — {r.status.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {routeDeliveryId && (
                  <p className="text-[10px] text-gray-400 mt-2">
                    Route line shown on map. Click a different delivery to
                    switch.
                  </p>
                )}
              </div>
            );
          })()}

          {nearbyDrivers.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <h3 className="font-semibold text-sm text-gray-900 flex items-center gap-2 mb-3">
                <Truck className="h-4 w-4 text-primary" />
                Nearby Drivers ({nearbyDrivers.length})
              </h3>
              {pendingDeliveries.length > 0 && (
                <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                  <p className="text-xs font-semibold text-amber-800">
                    Assign closest driver to:
                  </p>
                  <Select
                    value={selectedDeliveryId}
                    onValueChange={setSelectedDeliveryId}
                  >
                    <SelectTrigger className="h-8 text-xs rounded-lg">
                      <SelectValue placeholder="Select delivery..." />
                    </SelectTrigger>
                    <SelectContent>
                      {pendingDeliveries.map((r) => {
                        const c = users.find((u) => u.id === r.customerId);
                        return (
                          <SelectItem
                            key={r.id}
                            value={r.id}
                            className="text-xs"
                          >
                            #{r.id.slice(0, 8)} —{" "}
                            {c ? `${c.firstName} ${c.lastName}` : "Customer"}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    className="w-full h-8 text-xs bg-amber-600 hover:bg-amber-700 rounded-lg"
                    disabled={!selectedDeliveryId}
                    onClick={() => {
                      if (selectedDeliveryId && nearbyDrivers.length > 0) {
                        onAssignDriver(selectedDeliveryId, nearbyDrivers[0].id);
                        setSelectedDeliveryId("");
                      }
                    }}
                  >
                    <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                    Assign Closest ({nearbyDrivers[0]?.distanceKm.toFixed(
                      1,
                    )}{" "}
                    km)
                  </Button>
                </div>
              )}
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {nearbyDrivers.map((d, i) => {
                  const vehicle = vehicles.find((v) => v.driverId === d.id);
                  return (
                    <div
                      key={d.id}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 border ${i === 0 ? "border-primary/30 bg-primary/5" : "border-gray-100"}`}
                    >
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${i === 0 ? "bg-primary text-white" : "bg-gray-100 text-gray-500"}`}
                      >
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">
                          {d.firstName ?? ""}{" "}
                          {d.lastName ?? `Driver ${d.id.slice(0, 6)}`}
                        </p>
                        {vehicle && (
                          <p className="text-xs text-gray-400 capitalize truncate">
                            {vehicle.vehicleType.replace(/_/g, " ")} ·{" "}
                            {vehicle.plateNumber}
                          </p>
                        )}
                      </div>
                      <p className="text-sm font-bold text-primary flex-shrink-0">
                        {d.distanceKm.toFixed(1)}
                        <span className="text-xs font-normal text-gray-400">
                          {" "}
                          km
                        </span>
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Support Inbox ─────────────────────────────────────────────────────────────
function SupportInbox({ adminUid }: { adminUid: string }) {
  const [chats, setChats] = useState<Array<ChatDoc & { id: string }>>([]);
  const [selected, setSelected] = useState<(ChatDoc & { id: string }) | null>(null);
  const [messages, setMessages] = useState<Array<{ id: string; senderId: string; content: string; createdAt?: any; readBy: string[] }>>([]);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return listenSupportChats(setChats);
  }, []);

  useEffect(() => {
    if (!selected) { setMessages([]); return; }
    return listenMessages(selected.id, (msgs) => {
      setMessages(msgs.map(m => ({ id: m.id, senderId: m.senderId, content: m.content, createdAt: m.createdAt, readBy: m.readBy ?? [] })));
    });
  }, [selected?.id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!reply.trim() || !selected || sending) return;
    const text = reply.trim();
    setSending(true);
    setReply("");
    try {
      await firebaseSendMessage(selected.id, adminUid, text);
    } catch {
      toast.error("Failed to send");
      setReply(text);
    } finally {
      setSending(false);
    }
  };

  const toDate = (ts: any): string => {
    if (!ts) return "";
    const d: Date = ts?.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  if (selected) {
    return (
      <div className="animate-fade-in flex flex-col h-[calc(100dvh-140px)] bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 flex-shrink-0">
          <button onClick={() => setSelected(null)} className="h-8 w-8 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors flex-shrink-0">
            <X className="h-4 w-4 text-gray-500" />
          </button>
          <div>
            <p className="font-bold text-sm text-gray-900">{selected.customerName ?? selected.customerId?.slice(0, 8)}</p>
            <p className="text-[10px] text-gray-400">Support conversation</p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 bg-gray-50">
          {messages.length === 0 && (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-gray-400">No messages yet</p>
            </div>
          )}
          {messages.map((m) => {
            const isAdmin = m.senderId === adminUid;
            return (
              <div key={m.id} className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${isAdmin ? "bg-primary text-white rounded-br-md" : "bg-white text-gray-800 border border-gray-100 rounded-bl-md shadow-sm"}`}>
                  {m.content}
                  <p className={`text-[10px] mt-1 ${isAdmin ? "text-white/60 text-right" : "text-gray-400"}`}>{toDate(m.createdAt)}</p>
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>
        <div className="px-3 py-3 border-t border-gray-100 bg-white flex-shrink-0 flex gap-2">
          <Input
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Reply to customer…"
            className="flex-1 rounded-xl border-gray-200 bg-gray-50 text-sm"
          />
          <Button onClick={handleSend} disabled={!reply.trim() || sending} size="sm" className="rounded-xl h-10 w-10 p-0 flex-shrink-0">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-4 py-2">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Support Inbox</h2>
        <p className="text-sm text-gray-400 mt-0.5">Customer support conversations</p>
      </div>
      {chats.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center py-20">
          <MessageCircle className="h-10 w-10 text-gray-200 mb-3" />
          <p className="font-semibold text-gray-400 text-sm">No support conversations yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {chats.map((chat) => {
            const lastMsg = messages.length > 0 && selected?.id === chat.id ? messages[messages.length - 1] : null;
            return (
              <button
                key={chat.id}
                onClick={() => setSelected(chat)}
                className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3 text-left hover:border-primary/20 hover:shadow-md transition-all"
              >
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-primary">
                    {(chat.customerName ?? chat.customerId ?? "?")[0].toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-800 truncate">
                    {chat.customerName ?? `Customer ${chat.customerId?.slice(0, 8)}`}
                  </p>
                  <p className="text-xs text-gray-400 truncate mt-0.5">
                    {lastMsg ? lastMsg.content : "Tap to view messages"}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user, role, signOut, isLoading } = useAuth();
  useBlockBack();

  const [activeTab, setActiveTab] = useSessionState<TabType>("admin_activeTab", "dashboard");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>({
    start: new Date(new Date().setDate(new Date().getDate() - 30)),
    end: new Date(),
  });
  const [selectedRequest, setSelectedRequest] = useSessionState<string | null>("admin_selectedRequest", null);  const [isRefreshing, setIsRefreshing] = useState(false);
  const [notifPanelOpen, setNotifPanelOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [quoteRequest, setQuoteRequest] = useState<RequestWithId | null>(null);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [editPickup, setEditPickup] = useState("");
  const [editDropoff, setEditDropoff] = useState("");
  const [savingAddress, setSavingAddress] = useState(false);
  const [paymentRequest, setPaymentRequest] = useState<RequestWithId | null>(
    null,
  );
  const [adminNotifications, setAdminNotifications] = useState<
    Array<AdminNotificationDoc & { id: string }>
  >([]);
  const knownAdminNotifIds = useRef<Set<string> | null>(null);
  const [users, setUsers] = useState<UserWithId[]>([]);
  const [companies, setCompanies] = useState<CompanyWithId[]>([]);
  const [rawDrivers, setRawDrivers] = useState<DriverWithId[]>([]);
  const [rawRequests, setRawRequests] = useState<RequestWithId[]>([]);
  const [assignments, setAssignments] = useState<
    (AssignmentDoc & { id: string })[]
  >([]);
  const [vehicles, setVehicles] = useState<(VehicleDoc & { id: string })[]>([]);
  const [migrationState, setMigrationState] = useState<
    "idle" | "running" | "done" | "error"
  >("idle");
  const [migrationResult, setMigrationResult] = useState<MigrateVehicleTypesResult | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      navigate("/auth", { replace: true });
      return;
    }
    if (role !== null && role !== "admin") navigate("/", { replace: true });
  }, [isLoading, user, role, navigate]);

  useEffect(() => {
    const u1 = onSnapshot(
      query(collection(db, "users"), orderBy("createdAt", "desc")),
      (s) =>
        setUsers(s.docs.map((d) => ({ id: d.id, ...d.data() }) as UserWithId)),
    );
    const u2 = onSnapshot(
      query(collection(db, "drivers"), orderBy("createdAt", "desc")),
      (s) =>
        setRawDrivers(
          s.docs.map((d) => ({ id: d.id, ...d.data() }) as DriverWithId),
        ),
    );
    const u3 = onSnapshot(
      query(collection(db, "delivery_requests"), orderBy("createdAt", "desc")),
      (s) =>
        setRawRequests(
          s.docs.map((d) => ({ id: d.id, ...d.data() }) as RequestWithId),
        ),
    );
    const u4 = onSnapshot(collection(db, "assignments"), (s) =>
      setAssignments(
        s.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as AssignmentDoc & { id: string },
        ),
      ),
    );
    const u5 = onSnapshot(collection(db, "vehicles"), (s) =>
      setVehicles(
        s.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as VehicleDoc & { id: string },
        ),
      ),
    );
    const adminNotifTypeLabel: Record<string, string> = {
      negotiation_request: "Negotiation Request",
      payment_sent: "Payment Sent",
      delivery_proof: "Delivery Proof Uploaded",
      driver_completed: "Delivery Completed",
      company_registration: "New Company Registration",
      signature_request: "Signature Required",
      driver_accepted: "Driver Accepted",
      driver_arrived: "Driver Arrived",
      delivery_started: "Delivery In Progress",
    };
    const u6 = listenAdminNotifications((docs) => {
      setAdminNotifications(docs);
      if (knownAdminNotifIds.current === null) {
        knownAdminNotifIds.current = new Set(docs.map((d) => d.id));
        return;
      }
      const incoming = docs.filter((d) => !knownAdminNotifIds.current!.has(d.id));
      incoming.forEach((n) => {
        knownAdminNotifIds.current!.add(n.id);
        toast(adminNotifTypeLabel[n.type] ?? "Notification", {
          description: n.message,
          duration: 5000,
        });
      });
    });
    const u7 = onSnapshot(
      query(collection(db, "companies"), orderBy("createdAt", "desc")),
      (s) =>
        setCompanies(
          s.docs.map((d) => ({ id: d.id, ...d.data() }) as CompanyWithId),
        ),
    );
    return () => {
      u1();
      u2();
      u3();
      u4();
      u5();
      u6();
      u7();
    };
  }, []);

  const drivers = useMemo<DriverWithId[]>(
    () =>
      rawDrivers.map((driver) => {
        const up = users.find((u) => u.id === driver.userId);
        const v = vehicles.find((v) => v.driverId === driver.userId);
        const loc = driver.currentLocation as any;
        return {
          ...driver,
          email: up?.email,
          phone: up?.phone,
          firstName: up?.firstName,
          lastName: up?.lastName,
          vehicleType: v?.vehicleType,
          plateNumber: v?.plateNumber,
          lastLocationUpdate: loc?.updatedAt,
        };
      }),
    [rawDrivers, users, vehicles],
  );

  const requests = useMemo<RequestWithId[]>(
    () =>
      rawRequests.map((req) => {
        const a = assignments.find(
          (a) => a.requestId === req.id && a.driverAccepted !== false,
        );
        return { ...req, driverId: a?.driverId };
      }),
    [rawRequests, assignments],
  );

  const stats = useMemo(() => {
    const totalUsers = users.length;
    const totalDrivers = drivers.length;
    const activeDrivers = drivers.filter(
      (d) => d.isOnline && d.status === "approved",
    ).length;
    const pendingDrivers = drivers.filter(
      (d) => d.status === "pending_verification",
    ).length;
    const suspendedDrivers = drivers.filter(
      (d) => d.status === "suspended",
    ).length;
    const totalRequests = requests.length;
    const activeRequests = requests.filter(
      (r) => !["completed", "cancelled"].includes(r.status),
    ).length;
    const completedRequests = requests.filter(
      (r) => r.status === "completed",
    ).length;
    const cancelledRequests = requests.filter(
      (r) => r.status === "cancelled",
    ).length;
    const totalRevenue = requests
      .filter((r) => r.status === "completed")
      .reduce(
        (s, r) => s + (Number(r.finalPrice) || Number(r.estimatedPrice) || 0),
        0,
      );
    const completedWithTime = requests.filter(
      (r) => r.status === "completed" && r.completedAt && r.createdAt,
    );
    const avgDeliveryTime = completedWithTime.length
      ? completedWithTime.reduce((acc, r) => {
          const e = safeDate(r.completedAt),
            s2 = safeDate(r.createdAt);
          if (!e || !s2) return acc;
          return acc + (e.getTime() - s2.getTime()) / 60000;
        }, 0) / completedWithTime.length
      : 0;
    const now = Date.now();
    const ms30 = 30 * 24 * 60 * 60 * 1000;
    const cutLast = new Date(now - ms30);
    const cutPrev = new Date(now - 2 * ms30);

    const usersLast30 = users.filter((u) => {
      const d = safeDate(u.createdAt);
      return d && d >= cutLast;
    }).length;
    const usersPrev30 = users.filter((u) => {
      const d = safeDate(u.createdAt);
      return d && d >= cutPrev && d < cutLast;
    }).length;
    const usersTrend =
      usersPrev30 > 0
        ? Math.round(((usersLast30 - usersPrev30) / usersPrev30) * 100)
        : null;

    const revLast30 = requests
      .filter((r) => {
        if (r.status !== "completed") return false;
        const d = safeDate(r.completedAt ?? r.createdAt);
        return d && d >= cutLast;
      })
      .reduce((s, r) => s + (Number(r.finalPrice) || Number(r.estimatedPrice) || 0), 0);
    const revPrev30 = requests
      .filter((r) => {
        if (r.status !== "completed") return false;
        const d = safeDate(r.completedAt ?? r.createdAt);
        return d && d >= cutPrev && d < cutLast;
      })
      .reduce((s, r) => s + (Number(r.finalPrice) || Number(r.estimatedPrice) || 0), 0);
    const revenueTrend =
      revPrev30 > 0
        ? Math.round(((revLast30 - revPrev30) / revPrev30) * 100)
        : null;

    return {
      totalUsers,
      totalDrivers,
      activeDrivers,
      pendingDrivers,
      suspendedDrivers,
      totalRequests,
      activeRequests,
      completedRequests,
      cancelledRequests,
      totalRevenue,
      avgDeliveryTime: Math.round(avgDeliveryTime),
      completionRate: totalRequests
        ? Math.round((completedRequests / totalRequests) * 100)
        : 0,
      usersTrend,
      revenueTrend,
    };
  }, [users, drivers, requests]);

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return users.filter((u) => {
      const m =
        !q ||
        u.firstName?.toLowerCase().includes(q) ||
        u.lastName?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.id.toLowerCase().includes(q);
      return m && (filterStatus === "all" || u.role === filterStatus);
    });
  }, [users, searchQuery, filterStatus]);

  const filteredCompanies = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return companies.filter((c) => {
      const m =
        !q ||
        c.companyName?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.companyRegNumber?.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q);
      const st = c.approvalStatus ?? "pending";
      return m && (filterStatus === "all" || st === filterStatus);
    });
  }, [companies, searchQuery, filterStatus]);

  const filteredDrivers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return drivers.filter((d) => {
      const m =
        !q ||
        d.id.toLowerCase().includes(q) ||
        d.email?.toLowerCase().includes(q) ||
        d.firstName?.toLowerCase().includes(q) ||
        d.lastName?.toLowerCase().includes(q);
      return m && (filterStatus === "all" || d.status === filterStatus);
    });
  }, [drivers, searchQuery, filterStatus]);

  const filteredRequests = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return requests.filter((r) => {
      const m =
        !q ||
        r.id.toLowerCase().includes(q) ||
        r.pickup?.address?.toLowerCase().includes(q) ||
        r.dropoff?.address?.toLowerCase().includes(q) ||
        r.status?.toLowerCase().includes(q);
      const mf = filterStatus === "all" || r.status === filterStatus;
      const md = (() => {
        const d = safeDate(r.createdAt);
        if (!d) return true;
        return d >= dateRange.start && d <= dateRange.end;
      })();
      return m && mf && md;
    });
  }, [requests, searchQuery, filterStatus, dateRange]);

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };
  const handleApproveDriver = async (id: string) => {
    try {
      await updateDoc(doc(db, "drivers", id), {
        status: "approved",
        approvedAt: Timestamp.now(),
        approvedBy: user?.uid,
      });
      const driver = rawDrivers.find((d) => d.id === id);
      if (driver?.userId) {
        void addDoc(collection(db, "notifications"), {
          userId: driver.userId,
          title: "Application Approved! 🎉",
          message:
            "Your driver application has been approved. Go online to start receiving delivery jobs.",
          type: "driver_approved",
          read: false,
          createdAt: serverTimestamp(),
        });
      }
      toast.success("Driver approved");
    } catch {
      toast.error("Failed");
    }
  };
  const handleRejectDriver = async (id: string) => {
    if (
      !confirm(
        "Reject this driver? Their application will be permanently declined.",
      )
    )
      return;
    try {
      await updateDoc(doc(db, "drivers", id), {
        status: "rejected",
        rejectedAt: Timestamp.now(),
        rejectedBy: user?.uid,
      });
      toast.success("Driver rejected");
    } catch {
      toast.error("Failed");
    }
  };
  const handleApproveCompany = async (companyId: string) => {
    try {
      const company = companies.find((c) => c.id === companyId);
      await Promise.all([
        updateDoc(doc(db, "companies", companyId), {
          approvalStatus: "approved",
          approvedAt: Timestamp.now(),
          approvedBy: user?.uid,
        }),
        updateDoc(doc(db, "users", companyId), {
          approvalStatus: "approved",
        }),
      ]);
      const notifyId = company?.userId ?? companyId;
      void addDoc(collection(db, "notifications"), {
        userId: notifyId,
        title: "Company Approved! 🎉",
        message:
          "Your company registration has been approved. You can now manage your fleet and assign deliveries.",
        type: "company_approved",
        read: false,
        createdAt: serverTimestamp(),
      });
      toast.success("Company approved");
    } catch {
      toast.error("Failed");
    }
  };
  const handleRejectCompany = async (companyId: string) => {
    if (!confirm("Reject this company registration?")) return;
    try {
      const company = companies.find((c) => c.id === companyId);
      await Promise.all([
        updateDoc(doc(db, "companies", companyId), {
          approvalStatus: "rejected",
          rejectedAt: Timestamp.now(),
          rejectedBy: user?.uid,
        }),
        updateDoc(doc(db, "users", companyId), {
          approvalStatus: "rejected",
        }),
      ]);
      const notifyId = company?.userId ?? companyId;
      void addDoc(collection(db, "notifications"), {
        userId: notifyId,
        title: "Company Application Declined",
        message:
          "Your company registration could not be approved. Please contact support for more information.",
        type: "company_rejected",
        read: false,
        createdAt: serverTimestamp(),
      });
      toast.success("Company rejected");
    } catch {
      toast.error("Failed");
    }
  };
  const handleSuspendDriver = async (id: string) => {
    if (
      !confirm(
        "Suspend this driver? They will be taken offline and cannot accept new jobs.",
      )
    )
      return;
    try {
      await updateDoc(doc(db, "drivers", id), {
        status: "suspended",
        isOnline: false,
        suspendedAt: Timestamp.now(),
        suspendedBy: user?.uid,
      });
      toast.success("Driver suspended");
    } catch {
      toast.error("Failed");
    }
  };
  const handleUnsuspendDriver = async (id: string) => {
    try {
      await updateDoc(doc(db, "drivers", id), {
        status: "approved",
        suspendedAt: null,
        suspendedBy: null,
      });
      toast.success("Driver unsuspended");
    } catch {
      toast.error("Failed");
    }
  };
  const handleAssignDriver = async (requestId: string, driverId: string) => {
    try {
      await createAssignment(requestId, driverId, user?.uid ?? null);
      await updateDeliveryStatus(requestId, "driver_assigned");
      toast.success("Driver assigned");
      setSelectedRequest(null);
    } catch {
      toast.error("Failed to assign driver");
    }
  };
  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Delete this user?")) return;
    try {
      await deleteDoc(doc(db, "users", userId));
      toast.success("User deleted");
    } catch {
      toast.error("Failed");
    }
  };
  const handleConfirmPayment = async (requestId: string) => {
    try {
      await confirmPayment(requestId, user?.uid ?? "");
      toast.success("Payment confirmed!");
    } catch {
      toast.error("Failed");
    }
  };
  const handleSaveAddresses = async (request: RequestWithId) => {
    const pickupText = editPickup.trim();
    const dropoffText = editDropoff.trim();
    if (!pickupText && !dropoffText) return;
    setSavingAddress(true);
    try {
      const updates: Record<string, unknown> = {};
      if (pickupText && pickupText !== request.pickup?.address) {
        const results = await geocodeAddress(pickupText);
        if (results.length > 0) {
          updates["pickup"] = {
            address: results[0].displayName,
            lat: results[0].lat,
            lng: results[0].lng,
          };
        } else {
          updates["pickup"] = { ...request.pickup, address: pickupText };
        }
      }
      if (dropoffText && dropoffText !== request.dropoff?.address) {
        const results = await geocodeAddress(dropoffText);
        if (results.length > 0) {
          updates["dropoff"] = {
            address: results[0].displayName,
            lat: results[0].lat,
            lng: results[0].lng,
          };
        } else {
          updates["dropoff"] = { ...request.dropoff, address: dropoffText };
        }
      }
      if (Object.keys(updates).length > 0) {
        await updateDoc(doc(db, "delivery_requests", request.id), updates);
        toast.success("Addresses updated");
      }
      setEditingAddressId(null);
    } catch {
      toast.error("Failed to update addresses");
    } finally {
      setSavingAddress(false);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 1000);
  };
  const handleExportData = (type: string) => {
    const data =
      type === "users" ? users : type === "drivers" ? drivers : requests;
    if (!data.length) {
      toast.error("No data");
      return;
    }
    const csv = [
      Object.keys(data[0]).join(","),
      ...data.map((item) => Object.values(item).map(String).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${type}-${new Date().toISOString()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const unreadNotifs = adminNotifications.filter((n) => !n.read).length;

  const navItems: {
    id: TabType;
    label: string;
    icon: React.ElementType;
    badge?: number;
  }[] = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "users", label: "Users", icon: Users },
    { id: "companies", label: "Companies", icon: Building2 },
    { id: "drivers", label: "Drivers", icon: Truck },
    { id: "deliveries", label: "Deliveries", icon: Package },
    { id: "map", label: "Live Map", icon: MapPin },
    { id: "analytics", label: "Analytics", icon: BarChart3 },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  const switchTab = (tab: TabType) => {
    setActiveTab(tab);
    setSearchQuery("");
    setFilterStatus("all");
    setMobileSidebarOpen(false);
  };

  // Bottom nav items (5 most important for mobile)
  const bottomNavItems: {
    id: TabType;
    label: string;
    icon: React.ElementType;
  }[] = [
    { id: "dashboard", label: "Home", icon: LayoutDashboard },
    { id: "deliveries", label: "Deliveries", icon: Package },
    { id: "drivers", label: "Drivers", icon: Truck },
    { id: "map", label: "Map", icon: MapPin },
    { id: "support", label: "Support", icon: MessageCircle },
    { id: "settings", label: "More", icon: Settings },
  ];

  return (
    <div className="min-h-[100dvh] bg-[#f7f8fa] flex overflow-x-hidden w-full max-w-[100vw]">
      <PriceQuoteDialog
        request={quoteRequest}
        adminUid={user?.uid ?? ""}
        users={users}
        onClose={() => setQuoteRequest(null)}
      />
      <PaymentDetailsDialog
        request={paymentRequest}
        adminUid={user?.uid ?? ""}
        users={users}
        onClose={() => setPaymentRequest(null)}
      />

      {/* ── Notification Panel ── */}
      <NotificationPanel
        notifications={adminNotifications}
        open={notifPanelOpen}
        onClose={() => setNotifPanelOpen(false)}
        onMarkRead={async (id) => {
          try {
            await markAdminNotificationRead(id);
          } catch {}
        }}
        onMarkAllRead={async () => {
          try {
            await markAllAdminNotificationsRead(adminNotifications);
          } catch {}
        }}
        onNavigate={(requestId) => {
          setSelectedRequest(requestId);
          switchTab("deliveries");
        }}
      />

      {/* ── Mobile Sidebar Overlay ── */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
        </div>
      )}

      {/* ── Sidebar (desktop fixed + mobile slide-in) ── */}
      <aside
        className={`fixed top-0 left-0 h-full w-72 lg:w-64 flex flex-col bg-white border-r border-gray-100 shadow-xl lg:shadow-sm flex-shrink-0 z-50 transition-transform duration-300 ease-out ${mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        {/* Logo */}
        <div className="px-6 py-5 border-b border-gray-50 flex items-center justify-between">
          <div>
            <Logo size="sm" />
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mt-1 ml-0.5">
              Admin Panel
            </p>
          </div>
          <button
            onClick={() => setMobileSidebarOpen(false)}
            className="lg:hidden h-8 w-8 rounded-xl bg-gray-100 flex items-center justify-center"
          >
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => (
            <NavItem
              key={item.id}
              {...item}
              active={activeTab === item.id}
              onClick={() => switchTab(item.id)}
            />
          ))}
        </nav>

        {/* User card */}
        <div className="p-4 border-t border-gray-50">
          <div
            className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
            onClick={() => switchTab("settings")}
          >
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-bold text-primary">
                {user?.email?.[0]?.toUpperCase() ?? "A"}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-gray-800 truncate">
                Admin
              </p>
              <p className="text-xs text-gray-400 truncate">{user?.email}</p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleLogout();
              }}
              className="h-7 w-7 rounded-lg bg-gray-100 hover:bg-red-50 flex items-center justify-center transition-colors flex-shrink-0"
              title="Logout"
            >
              <LogOut className="h-3.5 w-3.5 text-gray-400 hover:text-red-500" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 lg:ml-64 flex flex-col min-h-[100dvh] min-w-0">
        {/* Header — fixed */}
        <header
          className="fixed top-0 left-0 right-0 lg:left-64 z-30 bg-white border-b border-gray-100 shadow-sm"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          <div className="px-3 lg:px-8 h-14 lg:h-16 flex items-center justify-between gap-2">
            {/* Left: hamburger + logo (mobile) / page title (desktop) */}
            <div className="flex items-center gap-2 lg:gap-3 min-w-0 flex-1">
              {/* Hamburger — mobile only */}
              <button
                onClick={() => setMobileSidebarOpen(true)}
                className="lg:hidden h-8 w-8 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center hover:bg-gray-100 transition-colors flex-shrink-0"
              >
                <svg
                  className="h-4 w-4 text-gray-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5"
                  />
                </svg>
              </button>

              {/* Logo — mobile only (always visible) */}
              <div className="lg:hidden flex-shrink-0">
                <Logo size="sm" />
              </div>

              {/* Page title — desktop only */}
              <div className="hidden lg:block min-w-0">
                <h1 className="text-lg font-bold text-gray-900 capitalize truncate leading-tight">
                  {activeTab === "dashboard"
                    ? "Welcome Back 👋"
                    : activeTab === "map"
                      ? "Live Map"
                      : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
                </h1>
                <p className="text-[11px] text-gray-400">
                  {new Date().toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>

            {/* Right actions */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {/* Search — desktop */}
              <div className="hidden md:block relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search..."
                  className="pl-9 w-48 lg:w-60 rounded-xl bg-gray-50 border-gray-100 h-9 focus-visible:ring-primary/30"
                />
              </div>

              {/* Search icon — mobile */}
              <button
                onClick={() => setMobileSearchOpen((p) => !p)}
                className="md:hidden h-8 w-8 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center hover:bg-gray-100 transition-colors"
              >
                <Search className="h-4 w-4 text-gray-500" />
              </button>

              {/* Refresh */}
              <button
                onClick={handleRefresh}
                className="h-8 w-8 lg:h-9 lg:w-9 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center hover:bg-gray-100 transition-colors"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 lg:h-4 lg:w-4 text-gray-500 ${isRefreshing ? "animate-spin" : ""}`}
                />
              </button>

              {/* Notifications */}
              <NotificationBellButton
                unreadCount={adminNotifications.filter((n) => !n.read).length}
                onClick={() => setNotifPanelOpen(true)}
              />

              {/* Avatar menu — desktop only */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="hidden lg:flex h-9 w-9 rounded-xl bg-primary/10 items-center justify-center hover:bg-primary/20 transition-colors">
                    <span className="text-sm font-bold text-primary">
                      {user?.email?.[0]?.toUpperCase() ?? "A"}
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-52 rounded-2xl border-gray-100 shadow-xl"
                >
                  <DropdownMenuLabel>
                    <p className="font-bold text-sm">Admin</p>
                    <p className="text-xs text-gray-400 font-normal truncate">
                      {user?.email}
                    </p>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => switchTab("settings")}
                    className="rounded-xl mx-1"
                  >
                    <Settings className="mr-2 h-4 w-4 text-gray-400" />
                    Settings
                  </DropdownMenuItem>
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

          {/* Mobile search bar — slides down */}
          {mobileSearchOpen && (
            <div className="md:hidden px-4 pb-3 border-t border-gray-50 pt-2.5">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <Input
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={`Search ${activeTab}...`}
                  className="pl-9 pr-9 w-full rounded-xl bg-gray-50 border-gray-100 h-9 focus-visible:ring-primary/30"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                  >
                    <X className="h-3.5 w-3.5 text-gray-400" />
                  </button>
                )}
              </div>
            </div>
          )}
        </header>

        {/* Content — offset for fixed header (14 = h-14 mobile, 16 = h-16 desktop) */}
        <main
          className="flex-1 pt-14 lg:pt-16 px-4 lg:px-8 space-y-5 min-w-0 w-full"
          style={{
            paddingBottom: "calc(5rem + env(safe-area-inset-bottom, 0px))",
          }}
        >
          {/* ── DASHBOARD ── */}
          {activeTab === "dashboard" && (
            <div className="space-y-5 animate-fade-in py-2">
              {/* Stat cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  label="Total Users"
                  value={stats.totalUsers}
                  icon={Users}
                  accent="bg-primary/10 text-primary"
                  trend={stats.usersTrend ?? undefined}
                />
                <StatCard
                  label="Active Drivers"
                  value={stats.activeDrivers}
                  icon={Truck}
                  accent="bg-emerald-50 text-emerald-600"
                />
                <StatCard
                  label="Active Deliveries"
                  value={stats.activeRequests}
                  icon={Package}
                  accent="bg-blue-50 text-blue-600"
                />
                <StatCard
                  label="Total Revenue"
                  value={
                    stats.totalRevenue >= 1000
                      ? `₦${(stats.totalRevenue / 1000).toFixed(1)}k`
                      : `₦${stats.totalRevenue.toLocaleString()}`
                  }
                  icon={DollarSign}
                  accent="bg-violet-50 text-violet-600"
                  trend={stats.revenueTrend ?? undefined}
                />
              </div>

              {/* Bento grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Pending Approvals */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-sm text-gray-900">
                        Pending Approvals
                      </h3>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {stats.pendingDrivers} drivers awaiting review
                      </p>
                    </div>
                    {stats.pendingDrivers > 0 && (
                      <span className="h-6 min-w-6 px-1.5 bg-amber-500 text-white text-[11px] font-bold rounded-full flex items-center justify-center">
                        {stats.pendingDrivers}
                      </span>
                    )}
                  </div>
                  <div className="divide-y divide-gray-50">
                    {drivers
                      .filter((d) => d.status === "pending_verification")
                      .slice(0, 5)
                      .map((driver) => (
                        <div
                          key={driver.id}
                          className="flex items-center gap-3 px-5 py-3"
                        >
                          <div className="h-9 w-9 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                            <Clock className="h-4 w-4 text-amber-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-800 truncate">
                              {driver.firstName && driver.lastName
                                ? `${driver.firstName} ${driver.lastName}`
                                : `Driver ${driver.id.slice(0, 8)}`}
                            </p>
                            <p className="text-xs text-gray-400 truncate">
                              {driver.email ?? "No email"}
                            </p>
                          </div>
                          <div className="flex gap-1.5 flex-shrink-0">
                            <button
                              onClick={() => handleApproveDriver(driver.id)}
                              className="h-7 w-7 rounded-lg bg-emerald-50 flex items-center justify-center hover:bg-emerald-100 transition-colors"
                            >
                              <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                            </button>
                            <button
                              onClick={() => handleRejectDriver(driver.id)}
                              className="h-7 w-7 rounded-lg bg-red-50 flex items-center justify-center hover:bg-red-100 transition-colors"
                            >
                              <XCircle className="h-3.5 w-3.5 text-red-500" />
                            </button>
                          </div>
                        </div>
                      ))}
                    {stats.pendingDrivers === 0 && (
                      <div className="py-8 text-center">
                        <CheckCircle className="h-8 w-8 text-gray-200 mx-auto mb-2" />
                        <p className="text-sm text-gray-400">All caught up!</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Recent Deliveries */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-sm text-gray-900">
                        Recent Deliveries
                      </h3>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Latest activity
                      </p>
                    </div>
                    <button
                      onClick={() => switchTab("deliveries")}
                      className="text-xs font-semibold text-primary hover:underline"
                    >
                      View all
                    </button>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {requests.slice(0, 5).map((r) => (
                      <div
                        key={r.id}
                        className="flex items-center gap-2.5 px-4 py-3"
                      >
                        <div
                          className={`h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0 ${r.status === "completed" ? "bg-emerald-50" : r.status === "cancelled" ? "bg-red-50" : "bg-blue-50"}`}
                        >
                          <Package
                            className={`h-3.5 w-3.5 ${r.status === "completed" ? "text-emerald-600" : r.status === "cancelled" ? "text-red-500" : "text-blue-600"}`}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-xs font-bold font-mono text-gray-700 flex-shrink-0">
                              #{r.id.slice(0, 8).toUpperCase()}
                            </p>
                            <StatusBadge status={r.status} />
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5 truncate">
                            {r.pickup?.address ?? "—"}
                          </p>
                        </div>
                        <div className="flex-shrink-0 text-right ml-1">
                          <p className="text-xs font-bold text-primary whitespace-nowrap">
                            ₦{Number(r.estimatedPrice ?? 0).toLocaleString()}
                          </p>
                          <button
                            onClick={() => {
                              switchTab("deliveries");
                              setSelectedRequest(r.id);
                            }}
                            className="text-[10px] text-gray-400 hover:text-primary"
                          >
                            View →
                          </button>
                        </div>
                      </div>
                    ))}
                    {requests.length === 0 && (
                      <div className="py-8 text-center text-sm text-gray-400">
                        No deliveries yet
                      </div>
                    )}
                  </div>
                </div>

                {/* Quick stats */}
                <div className="space-y-3">
                  {/* Driver status breakdown */}
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <h3 className="font-bold text-sm text-gray-900 mb-4">
                      Driver Overview
                    </h3>
                    <div className="space-y-3">
                      {[
                        {
                          label: "Approved",
                          value: drivers.filter((d) => d.status === "approved")
                            .length,
                          total: stats.totalDrivers,
                          color: "bg-emerald-500",
                        },
                        {
                          label: "Pending",
                          value: stats.pendingDrivers,
                          total: stats.totalDrivers,
                          color: "bg-amber-500",
                        },
                        {
                          label: "Suspended",
                          value: stats.suspendedDrivers,
                          total: stats.totalDrivers,
                          color: "bg-red-500",
                        },
                      ].map((item) => (
                        <div key={item.label}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-gray-600">
                              {item.label}
                            </span>
                            <span className="text-xs font-bold text-gray-800">
                              {item.value}
                            </span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${item.color} transition-all`}
                              style={{
                                width: `${item.total > 0 ? (item.value / item.total) * 100 : 0}%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Delivery completion */}
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <h3 className="font-bold text-sm text-gray-900 mb-1">
                      Completion Rate
                    </h3>
                    <div className="flex items-end gap-2 mb-3">
                      <p className="text-3xl font-bold text-gray-900">
                        {stats.completionRate}%
                      </p>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${stats.completionRate}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-2 text-[11px] text-gray-400">
                      <span>{stats.completedRequests} completed</span>
                      <span>{stats.cancelledRequests} cancelled</span>
                    </div>
                  </div>

                  {/* Revenue */}
                  <div className="bg-gradient-to-br from-primary to-emerald-600 rounded-2xl p-5 text-white relative overflow-hidden">
                    <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/10" />
                    <div className="absolute -bottom-3 -left-3 w-16 h-16 rounded-full bg-white/10" />
                    <div className="relative">
                      <p className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-1">
                        Total Revenue
                      </p>
                      <p className="text-2xl font-bold">
                        ₦{stats.totalRevenue.toLocaleString()}
                      </p>
                      {stats.revenueTrend !== null && (
                        <div className="flex items-center gap-1 mt-2">
                          {(stats.revenueTrend ?? 0) >= 0 ? (
                            <TrendingUp className="h-3.5 w-3.5 text-white/80" />
                          ) : (
                            <TrendingDown className="h-3.5 w-3.5 text-white/80" />
                          )}
                          <span className="text-xs font-semibold text-white/80">
                            {(stats.revenueTrend ?? 0) >= 0 ? "+" : ""}{stats.revenueTrend}% vs prev 30 days
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── USERS ── */}
          {activeTab === "users" && (
            <div className="space-y-4 animate-fade-in py-2">
              <div>
                <h2 className="text-lg lg:text-xl font-bold text-gray-900">
                  User Management
                </h2>
                <p className="text-sm text-gray-400 mt-0.5">
                  {filteredUsers.length} users found
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="flex-1 min-w-0 h-9 rounded-xl border-gray-200 text-sm">
                    <SelectValue placeholder="All roles" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="all">All roles</SelectItem>
                    <SelectItem value="customer">Customer</SelectItem>
                    <SelectItem value="driver">Driver</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl border-gray-200 h-9 flex-shrink-0 px-3"
                  onClick={() => handleExportData("users")}
                >
                  <Download className="h-4 w-4 mr-1.5" />
                  Export
                </Button>
              </div>
              {/* Desktop table */}
              <div className="hidden md:block bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50/50 border-gray-100">
                      <TableHead className="font-semibold text-gray-500 text-xs uppercase tracking-wider">
                        User
                      </TableHead>
                      <TableHead className="font-semibold text-gray-500 text-xs uppercase tracking-wider">
                        Contact
                      </TableHead>
                      <TableHead className="font-semibold text-gray-500 text-xs uppercase tracking-wider">
                        Role
                      </TableHead>
                      <TableHead className="font-semibold text-gray-500 text-xs uppercase tracking-wider">
                        Joined
                      </TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((u) => (
                      <TableRow
                        key={u.id}
                        className="border-gray-50 hover:bg-gray-50/50 transition-colors"
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <UserAvatar
                              name={`${u.firstName ?? ""} ${u.lastName ?? ""}`}
                              email={u.email ?? ""}
                            />
                            <div>
                              <p className="font-semibold text-sm text-gray-800">
                                {u.firstName} {u.lastName}
                              </p>
                              <p className="text-xs text-gray-400 font-mono">
                                #{u.id.slice(0, 8)}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-0.5">
                            {u.email && (
                              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                <Mail className="h-3 w-3 text-gray-400 flex-shrink-0" />
                                <span className="truncate max-w-[160px]">
                                  {u.email}
                                </span>
                              </div>
                            )}
                            {u.phone && (
                              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                <Phone className="h-3 w-3 text-gray-400 flex-shrink-0" />
                                {u.phone}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border border-gray-200 bg-gray-50 text-gray-700 capitalize">
                            {u.role ?? "customer"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-gray-500">
                            {safeDate(u.createdAt)?.toLocaleDateString() ??
                              "N/A"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="h-7 w-7 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors">
                                <MoreHorizontal className="h-4 w-4 text-gray-400" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="rounded-xl"
                            >
                              <DropdownMenuItem className="rounded-lg">
                                <Eye className="mr-2 h-4 w-4" />
                                View
                              </DropdownMenuItem>
                              <DropdownMenuItem className="rounded-lg">
                                <Edit className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-red-600 rounded-lg"
                                onClick={() => handleDeleteUser(u.id)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredUsers.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="py-16 text-center">
                          <Users className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                          <p className="text-sm text-gray-400">
                            No users found
                          </p>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile card list */}
              <div className="md:hidden space-y-2.5">
                {filteredUsers.map((u) => (
                  <div
                    key={u.id}
                    className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4"
                  >
                    <div className="flex items-start gap-3">
                      <UserAvatar
                        name={`${u.firstName ?? ""} ${u.lastName ?? ""}`}
                        email={u.email ?? ""}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-sm text-gray-900 truncate">
                              {u.firstName} {u.lastName}
                            </p>
                            <p className="text-xs text-gray-400 font-mono mt-0.5">
                              #{u.id.slice(0, 8)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border border-gray-200 bg-gray-50 text-gray-600 capitalize">
                              {u.role ?? "customer"}
                            </span>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className="h-7 w-7 rounded-lg hover:bg-gray-100 flex items-center justify-center">
                                  <MoreHorizontal className="h-4 w-4 text-gray-400" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align="end"
                                className="rounded-xl"
                              >
                                <DropdownMenuItem className="rounded-lg">
                                  <Eye className="mr-2 h-4 w-4" />
                                  View
                                </DropdownMenuItem>
                                <DropdownMenuItem className="rounded-lg">
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-red-600 rounded-lg"
                                  onClick={() => handleDeleteUser(u.id)}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                        <div className="mt-2 space-y-1">
                          {u.email && (
                            <div className="flex items-center gap-1.5 text-xs text-gray-500">
                              <Mail className="h-3 w-3 text-gray-400 flex-shrink-0" />
                              <span className="truncate">{u.email}</span>
                            </div>
                          )}
                          {u.phone && (
                            <div className="flex items-center gap-1.5 text-xs text-gray-500">
                              <Phone className="h-3 w-3 text-gray-400 flex-shrink-0" />
                              {u.phone}
                            </div>
                          )}
                          {u.createdAt && (
                            <div className="flex items-center gap-1.5 text-xs text-gray-400">
                              <Calendar className="h-3 w-3 flex-shrink-0" />
                              Joined{" "}
                              {safeDate(u.createdAt)?.toLocaleDateString() ??
                                "N/A"}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {filteredUsers.length === 0 && (
                  <div className="bg-white rounded-2xl border border-gray-100 py-16 text-center">
                    <Users className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                    <p className="text-sm text-gray-400">No users found</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── COMPANIES ── */}
          {activeTab === "companies" && (
            <div className="space-y-4 animate-fade-in py-2">
              <div>
                <h2 className="text-lg lg:text-xl font-bold text-gray-900">
                  Company registrations
                </h2>
                <p className="text-sm text-gray-400 mt-0.5">
                  {filteredCompanies.length} companies found
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="flex-1 min-w-0 h-9 rounded-xl border-gray-200 text-sm">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3">
                {filteredCompanies.map((c) => {
                  const st = c.approvalStatus ?? "pending";
                  return (
                    <div
                      key={c.id}
                      className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:border-primary/20 hover:shadow-md transition-all"
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="flex items-start gap-4">
                          <div
                            className={`h-12 w-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${st === "approved" ? "bg-emerald-50" : st === "pending" ? "bg-amber-50" : "bg-gray-100"}`}
                          >
                            <Building2
                              className={`h-6 w-6 ${st === "approved" ? "text-emerald-600" : st === "pending" ? "text-amber-600" : "text-gray-400"}`}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-2">
                              <h3 className="font-bold text-gray-900">
                                {c.companyName ?? `Company ${c.id.slice(0, 8)}`}
                              </h3>
                              <StatusBadge status={st} />
                            </div>
                            <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                              {c.email && (
                                <span className="flex items-center gap-1.5 text-xs text-gray-500">
                                  <Mail className="h-3 w-3 text-gray-400" />
                                  {c.email}
                                </span>
                              )}
                              {c.companyPhone && (
                                <span className="flex items-center gap-1.5 text-xs text-gray-500">
                                  <Phone className="h-3 w-3 text-gray-400" />
                                  {c.companyPhone}
                                </span>
                              )}
                              {c.companyRegNumber && (
                                <span className="flex items-center gap-1.5 text-xs text-gray-500">
                                  <Briefcase className="h-3 w-3 text-gray-400" />
                                  Reg. {c.companyRegNumber}
                                </span>
                              )}
                              {c.contactPersonName && (
                                <span className="flex items-center gap-1.5 text-xs text-gray-500">
                                  <User className="h-3 w-3 text-gray-400" />
                                  {c.contactPersonName}
                                  {c.contactPersonPhone
                                    ? ` · ${c.contactPersonPhone}`
                                    : ""}
                                </span>
                              )}
                            </div>
                            {c.companyAddress && (
                              <p className="mt-2 text-xs text-gray-400 line-clamp-2">
                                {c.companyAddress}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 flex-shrink-0">
                          {st === "pending" && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => handleApproveCompany(c.id)}
                                className="rounded-xl bg-emerald-600 hover:bg-emerald-700 shadow-sm h-9"
                              >
                                <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRejectCompany(c.id)}
                                className="rounded-xl border-red-200 text-red-600 hover:bg-red-50 h-9"
                              >
                                <XCircle className="h-3.5 w-3.5 mr-1.5" />
                                Reject
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {filteredCompanies.length === 0 && (
                  <div className="bg-white rounded-2xl border border-gray-100 py-16 text-center">
                    <Building2 className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                    <p className="text-sm text-gray-400">No companies found</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── DRIVERS ── */}
          {activeTab === "drivers" && (
            <div className="space-y-4 animate-fade-in py-2">
              <div>
                <h2 className="text-lg lg:text-xl font-bold text-gray-900">
                  Driver Management
                </h2>
                <p className="text-sm text-gray-400 mt-0.5">
                  {filteredDrivers.length} drivers found
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="flex-1 min-w-0 h-9 rounded-xl border-gray-200 text-sm">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="pending_verification">
                      Pending
                    </SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl border-gray-200 h-9 flex-shrink-0 px-3"
                  onClick={() => handleExportData("drivers")}
                >
                  <Download className="h-4 w-4 mr-1.5" />
                  Export
                </Button>
              </div>
              <div className="space-y-3">
                {filteredDrivers.map((driver) => (
                  <div
                    key={driver.id}
                    className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:border-primary/20 hover:shadow-md transition-all"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div
                          className={`h-12 w-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${driver.status === "approved" ? "bg-emerald-50" : driver.status === "pending_verification" ? "bg-amber-50" : "bg-gray-100"}`}
                        >
                          <Truck
                            className={`h-6 w-6 ${driver.status === "approved" ? "text-emerald-600" : driver.status === "pending_verification" ? "text-amber-600" : "text-gray-400"}`}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-2">
                            <h3 className="font-bold text-gray-900">
                              {driver.firstName && driver.lastName
                                ? `${driver.firstName} ${driver.lastName}`
                                : `Driver ${driver.id.slice(0, 8)}`}
                            </h3>
                            <StatusBadge status={driver.status} />
                            <OnlineIndicator
                              isOnline={driver.isOnline ?? false}
                            />
                          </div>
                          <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                            {driver.email && (
                              <span className="flex items-center gap-1.5 text-xs text-gray-500">
                                <Mail className="h-3 w-3 text-gray-400" />
                                {driver.email}
                              </span>
                            )}
                            {driver.phone && (
                              <span className="flex items-center gap-1.5 text-xs text-gray-500">
                                <Phone className="h-3 w-3 text-gray-400" />
                                {driver.phone}
                              </span>
                            )}
                            {driver.vehicleType && (
                              <span className="flex items-center gap-1.5 text-xs text-gray-500">
                                <Truck className="h-3 w-3 text-gray-400" />
                                <span className="capitalize">
                                  {driver.vehicleType.replace(/_/g, " ")}
                                </span>
                              </span>
                            )}
                            {driver.plateNumber && (
                              <span className="flex items-center gap-1.5 text-xs text-gray-500">
                                <Briefcase className="h-3 w-3 text-gray-400" />
                                {driver.plateNumber}
                              </span>
                            )}
                            {driver.averageRating !== undefined && (
                              <span className="flex items-center gap-1.5 text-xs text-gray-500">
                                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                                {driver.averageRating.toFixed(1)}
                              </span>
                            )}
                          </div>
                          {driver.isOnline && driver.currentLocation && (
                            <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-400">
                              <Navigation className="h-3 w-3" />
                              <span className="font-mono">
                                {driver.currentLocation.lat.toFixed(5)},{" "}
                                {driver.currentLocation.lng.toFixed(5)}
                              </span>
                              {driver.lastLocationUpdate && (
                                <span className="text-gray-300">
                                  ·{" "}
                                  {safeDate(
                                    driver.lastLocationUpdate,
                                  )?.toLocaleTimeString()}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 flex-shrink-0">
                        {driver.status === "pending_verification" && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => handleApproveDriver(driver.id)}
                              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 shadow-sm h-9"
                            >
                              <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRejectDriver(driver.id)}
                              className="rounded-xl border-red-200 text-red-600 hover:bg-red-50 h-9"
                            >
                              <XCircle className="h-3.5 w-3.5 mr-1.5" />
                              Reject
                            </Button>
                          </>
                        )}
                        {driver.status === "approved" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSuspendDriver(driver.id)}
                            className="rounded-xl border-amber-200 text-amber-700 hover:bg-amber-50 h-9"
                          >
                            <AlertCircle className="h-3.5 w-3.5 mr-1.5" />
                            Suspend
                          </Button>
                        )}
                        {driver.status === "suspended" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleUnsuspendDriver(driver.id)}
                            className="rounded-xl border-emerald-200 text-emerald-700 hover:bg-emerald-50 h-9"
                          >
                            <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                            Unsuspend
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-xl border-gray-200 h-9"
                        >
                          <MessageCircle className="h-3.5 w-3.5 mr-1.5" />
                          Contact
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                {filteredDrivers.length === 0 && (
                  <div className="bg-white rounded-2xl border border-gray-100 py-16 text-center">
                    <Truck className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                    <p className="text-sm text-gray-400">No drivers found</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── DELIVERIES ── */}
          {activeTab === "deliveries" && (
            <div className="space-y-4 animate-fade-in py-2">
              {/* Page title */}
              <div>
                <h2 className="text-lg lg:text-xl font-bold text-gray-900">
                  Delivery Management
                </h2>
                <p className="text-sm text-gray-400 mt-0.5">
                  {filteredRequests.length} deliveries found
                </p>
              </div>

              {/* Filter bar — stacks on mobile */}
              <div className="flex flex-col gap-2">
                {/* Row 1: status filter + export */}
                <div className="flex items-center gap-2">
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="flex-1 min-w-0 h-9 rounded-xl border-gray-200 text-sm">
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="all">All statuses</SelectItem>
                      {[
                        "pending",
                        "admin_review",
                        "negotiating",
                        "price_set",
                        "payment_pending",
                        "customer_confirmed",
                        "driver_assigned",
                        "driver_accepted",
                        "in_progress",
                        "completed",
                        "cancelled",
                      ].map((s) => (
                        <SelectItem key={s} value={s} className="capitalize">
                          {s.replace(/_/g, " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl border-gray-200 h-9 flex-shrink-0 px-3"
                    onClick={() => handleExportData("deliveries")}
                  >
                    <Download className="h-4 w-4 mr-1.5" />
                    <span>Export</span>
                  </Button>
                </div>
                {/* Row 2: date range */}
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={dateRange.start.toISOString().split("T")[0]}
                    onChange={(e) =>
                      setDateRange((p) => ({
                        ...p,
                        start: new Date(e.target.value),
                      }))
                    }
                    className="flex-1 h-9 text-sm rounded-xl border-gray-200 min-w-0"
                  />
                  <span className="text-gray-400 text-xs flex-shrink-0">
                    to
                  </span>
                  <Input
                    type="date"
                    value={dateRange.end.toISOString().split("T")[0]}
                    onChange={(e) =>
                      setDateRange((p) => ({
                        ...p,
                        end: new Date(e.target.value),
                      }))
                    }
                    className="flex-1 h-9 text-sm rounded-xl border-gray-200 min-w-0"
                  />
                </div>
              </div>

              <div className="space-y-3">
                {filteredRequests.map((request) => {
                  const customer = users.find(
                    (u) => u.id === request.customerId,
                  );
                  const isCompanyManaged = (request as any).workflowOwner === "company";
                  const canQuote = ["pending", "admin_review"].includes(
                    request.status,
                  ) && !isCompanyManaged;
                  const canSetPayment = (request.status as any) === "negotiating" && !isCompanyManaged;
                  const canConfirmPayment =
                    request.status === "payment_pending" &&
                    !!(request as any).paymentSentAt &&
                    !isCompanyManaged;
                  const canAssign =
                    request.status === "customer_confirmed" &&
                    !request.driverId &&
                    !isCompanyManaged;
                  const isHighlighted = selectedRequest === request.id;

                  return (
                    <div
                      key={request.id}
                      className={`bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all ${isHighlighted ? "border-primary ring-2 ring-primary/20" : "border-gray-100 hover:border-primary/20"}`}
                    >
                      <div className="p-4 lg:p-5 space-y-3">
                        {/* Header */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${request.status === "completed" ? "bg-emerald-50" : request.status === "cancelled" ? "bg-red-50" : "bg-blue-50"}`}
                            >
                              <Package
                                className={`h-5 w-5 ${request.status === "completed" ? "text-emerald-600" : request.status === "cancelled" ? "text-red-500" : "text-blue-600"}`}
                              />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-sm font-mono text-gray-900 flex-shrink-0">
                                  #{request.id.slice(0, 8).toUpperCase()}
                                </span>
                                <StatusBadge status={request.status} />
                              </div>
                              <p className="text-xs text-gray-400 mt-0.5 truncate">
                                {safeDate(
                                  request.createdAt,
                                )?.toLocaleString() ?? "N/A"}
                              </p>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0 ml-1">
                            <p className="text-base lg:text-xl font-bold text-primary whitespace-nowrap">
                              ₦
                              {Number(
                                request.finalPrice ??
                                  request.quotedPrice ??
                                  request.estimatedPrice ??
                                  0,
                              ).toLocaleString()}
                            </p>
                            {request.status === "price_set" && (
                              <p className="text-[10px] text-amber-600 font-semibold">
                                Awaiting customer
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Customer */}
                        {customer && (
                          <div className="flex items-center gap-2.5 bg-gray-50 rounded-xl px-3 py-2.5">
                            <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <User className="h-4 w-4 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-800 truncate">
                                {customer.firstName} {customer.lastName}
                              </p>
                              {customer.phone && (
                                <a
                                  href={`tel:${customer.phone}`}
                                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-primary transition-colors mt-0.5"
                                >
                                  <Phone className="h-3 w-3 flex-shrink-0" />
                                  <span className="truncate">
                                    {customer.phone}
                                  </span>
                                </a>
                              )}
                            </div>
                            {customer.email && (
                              <a
                                href={`mailto:${customer.email}`}
                                className="hidden sm:flex items-center gap-1 text-xs text-gray-400 hover:text-primary transition-colors flex-shrink-0"
                              >
                                <Mail className="h-3.5 w-3.5" />
                              </a>
                            )}
                          </div>
                        )}

                        {/* Route */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-3 flex gap-2.5">
                            <CircleDot className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                            <div className="min-w-0">
                              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-0.5">
                                Pickup
                              </p>
                              <p className="text-sm font-semibold text-gray-800 leading-snug break-words">
                                {request.pickup?.address ?? "—"}
                              </p>
                            </div>
                          </div>
                          <div className="bg-red-50/60 border border-red-100 rounded-xl p-3 flex gap-2.5">
                            <Circle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                            <div className="min-w-0">
                              <p className="text-[10px] font-bold text-red-500 uppercase tracking-wider mb-0.5">
                                Drop-off
                              </p>
                              <p className="text-sm font-semibold text-gray-800 leading-snug break-words">
                                {request.dropoff?.address ?? "—"}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Edit Address */}
                        {editingAddressId === request.id ? (
                          <div className="border border-primary/30 bg-primary/5 rounded-xl p-3.5 space-y-2.5">
                            <p className="text-xs font-semibold text-primary uppercase tracking-wider">
                              Edit Addresses
                            </p>
                            <div>
                              <Label className="text-xs text-gray-500">
                                Pickup address
                              </Label>
                              <Input
                                value={editPickup}
                                onChange={(e) => setEditPickup(e.target.value)}
                                placeholder={request.pickup?.address ?? "Pickup"}
                                className="mt-1 h-9 text-sm rounded-xl border-gray-200"
                              />
                            </div>
                            <div>
                              <Label className="text-xs text-gray-500">
                                Drop-off address
                              </Label>
                              <Input
                                value={editDropoff}
                                onChange={(e) => setEditDropoff(e.target.value)}
                                placeholder={
                                  request.dropoff?.address ?? "Drop-off"
                                }
                                className="mt-1 h-9 text-sm rounded-xl border-gray-200"
                              />
                            </div>
                            <p className="text-[10px] text-gray-400">
                              Addresses will be geocoded to update coordinates.
                            </p>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                className="flex-1 rounded-xl h-9"
                                disabled={savingAddress}
                                onClick={() => handleSaveAddresses(request)}
                              >
                                {savingAddress ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  "Save"
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1 rounded-xl border-gray-200 h-9"
                                onClick={() => setEditingAddressId(null)}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setEditingAddressId(request.id);
                              setEditPickup(request.pickup?.address ?? "");
                              setEditDropoff(request.dropoff?.address ?? "");
                            }}
                            className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-primary transition-colors"
                          >
                            <Edit className="h-3 w-3" />
                            Edit addresses
                          </button>
                        )}

                        {/* Negotiation alert */}
                        {(request.status as string) === "negotiating" && (
                          <div className="flex items-center gap-3 bg-sky-50 border border-sky-200 rounded-xl p-3">
                            <PhoneCall className="h-4 w-4 text-sky-600 flex-shrink-0 animate-pulse" />
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-sky-800">
                                Customer requesting negotiation call
                              </p>
                              {customer?.phone && (
                                <a
                                  href={`tel:${customer.phone}`}
                                  className="text-xs text-sky-600 hover:underline mt-0.5 flex items-center gap-1"
                                >
                                  <Phone className="h-3 w-3" />
                                  Call {customer.firstName}: {customer.phone}
                                </a>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Payment sent alert */}
                        {(request as any).paymentSentAt &&
                          request.status === "payment_pending" && (
                            <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                              <Banknote className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                              <div>
                                <p className="text-sm font-semibold text-emerald-800">
                                  Customer has marked payment as sent
                                </p>
                                <p className="text-xs text-emerald-600 mt-0.5">
                                  Check your account and confirm.
                                </p>
                              </div>
                            </div>
                          )}

                        {/* Actions */}
                        <div className="flex flex-wrap gap-2 pt-1">
                          {isCompanyManaged && (
                            <div className="text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-xl px-3 py-2">
                              Managed by company dashboard
                            </div>
                          )}
                          {canQuote && (
                            <Button
                              size="sm"
                              onClick={() => setQuoteRequest(request)}
                              className="rounded-xl bg-amber-500 hover:bg-amber-600 text-white shadow-sm h-9"
                            >
                              <DollarSign className="h-3.5 w-3.5 mr-1.5" />
                              Send Price Quote
                            </Button>
                          )}
                          {canSetPayment && (
                            <Button
                              size="sm"
                              onClick={() => setPaymentRequest(request)}
                              className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm h-9"
                            >
                              <Banknote className="h-3.5 w-3.5 mr-1.5" />
                              Set Payment Details
                            </Button>
                          )}
                          {canConfirmPayment && (
                            <Button
                              size="sm"
                              onClick={() => handleConfirmPayment(request.id)}
                              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm h-9"
                            >
                              <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                              Confirm Payment
                            </Button>
                          )}
                          {request.status === "price_set" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setQuoteRequest(request)}
                              className="rounded-xl border-gray-200 h-9"
                            >
                              <Edit className="h-3.5 w-3.5 mr-1.5" />
                              Update Quote
                            </Button>
                          )}
                          {canAssign && (
                            <Select
                              onValueChange={(driverId) => {
                                if (driverId)
                                  handleAssignDriver(request.id, driverId);
                              }}
                            >
                              <SelectTrigger className="w-full sm:w-52 h-9 text-sm rounded-xl border-gray-200">
                                <SelectValue placeholder="Assign a driver" />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl">
                                {drivers
                                  .filter(
                                    (d) =>
                                      d.status === "approved" && d.isOnline,
                                  )
                                  .map((d) => (
                                    <SelectItem key={d.id} value={d.id}>
                                      {d.firstName && d.lastName
                                        ? `${d.firstName} ${d.lastName}`
                                        : `Driver ${d.id.slice(0, 8)}`}
                                      {d.vehicleType &&
                                        ` — ${d.vehicleType.replace(/_/g, " ")}`}
                                    </SelectItem>
                                  ))}
                                {drivers.filter(
                                  (d) => d.status === "approved" && d.isOnline,
                                ).length === 0 && (
                                  <SelectItem value="none" disabled>
                                    No drivers online
                                  </SelectItem>
                                )}
                              </SelectContent>
                            </Select>
                          )}
                          {request.driverId &&
                            (() => {
                              const d = drivers.find(
                                (dr) => dr.id === request.driverId,
                              );
                              return (
                                <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-xl px-3 py-1.5">
                                  <Truck className="h-4 w-4 text-primary" />
                                  <span className="text-sm font-semibold text-gray-800">
                                    {d?.firstName && d?.lastName
                                      ? `${d.firstName} ${d.lastName}`
                                      : `Driver ${request.driverId.slice(0, 8)}`}
                                  </span>
                                  <span className="text-xs text-primary font-semibold bg-primary/10 px-2 py-0.5 rounded-full">
                                    Assigned
                                  </span>
                                </div>
                              );
                            })()}
                        </div>

                        {/* Delivery proof */}
                        {request.deliveryProofUrl && (
                          <div className="rounded-xl overflow-hidden border border-gray-100 mt-1">
                            <div className="flex items-center justify-between px-3 py-2 bg-gray-50">
                              <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                                <ImageIcon className="h-4 w-4 text-violet-500" />
                                Delivery Proof
                              </div>
                              <a
                                href={request.deliveryProofUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs text-primary hover:underline"
                              >
                                Open full size
                              </a>
                            </div>
                            <img
                              src={request.deliveryProofUrl}
                              alt="Delivery proof"
                              className="w-full max-h-52 object-cover"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {filteredRequests.length === 0 && (
                  <div className="bg-white rounded-2xl border border-gray-100 py-16 text-center">
                    <Package className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                    <p className="text-sm text-gray-400">No deliveries found</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── MAP ── */}
          {activeTab === "map" && (
            <div className="animate-fade-in">
              <div className="mb-4">
                <h2 className="text-xl font-bold text-gray-900">Live Map</h2>
                <p className="text-sm text-gray-400 mt-0.5">
                  Real-time driver and delivery tracking
                </p>
              </div>
              <AdminLiveMap
                drivers={drivers}
                requests={requests}
                users={users}
                vehicles={vehicles}
                onAssignDriver={handleAssignDriver}
              />
            </div>
          )}

          {/* ── ANALYTICS ── */}
          {activeTab === "analytics" && (
            <div className="space-y-5 animate-fade-in py-2">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Analytics</h2>
                <p className="text-sm text-gray-400 mt-0.5">
                  Platform performance overview
                </p>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  label="Completion Rate"
                  value={`${stats.completionRate}%`}
                  icon={CheckCircle}
                  accent="bg-emerald-50 text-emerald-600"
                />
                <StatCard
                  label="Avg Delivery Time"
                  value={stats.avgDeliveryTime > 0 ? `${stats.avgDeliveryTime}m` : "—"}
                  icon={Clock}
                  accent="bg-blue-50 text-blue-600"
                />
                <StatCard
                  label="Avg per Order"
                  value={`₦${Math.round(stats.totalRevenue / Math.max(stats.completedRequests, 1)).toLocaleString()}`}
                  icon={TrendingUp}
                  accent="bg-violet-50 text-violet-600"
                />
                <StatCard
                  label="Cancellation Rate"
                  value={`${stats.totalRequests ? Math.round((stats.cancelledRequests / stats.totalRequests) * 100) : 0}%`}
                  icon={TrendingDown}
                  accent="bg-red-50 text-red-500"
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Order breakdown */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <h3 className="font-bold text-sm text-gray-900 mb-4">
                    Order Breakdown
                  </h3>
                  <div className="space-y-3">
                    {[
                      {
                        label: "Total Orders",
                        value: stats.totalRequests,
                        color: "bg-gray-800",
                        pct: 100,
                      },
                      {
                        label: "Completed",
                        value: stats.completedRequests,
                        color: "bg-emerald-500",
                        pct: stats.totalRequests
                          ? (stats.completedRequests / stats.totalRequests) *
                            100
                          : 0,
                      },
                      {
                        label: "In Progress",
                        value: stats.activeRequests,
                        color: "bg-blue-500",
                        pct: stats.totalRequests
                          ? (stats.activeRequests / stats.totalRequests) * 100
                          : 0,
                      },
                      {
                        label: "Cancelled",
                        value: stats.cancelledRequests,
                        color: "bg-red-400",
                        pct: stats.totalRequests
                          ? (stats.cancelledRequests / stats.totalRequests) *
                            100
                          : 0,
                      },
                    ].map((item) => (
                      <div key={item.label}>
                        <div className="flex justify-between mb-1.5">
                          <span className="text-xs font-medium text-gray-600">
                            {item.label}
                          </span>
                          <span className="text-xs font-bold text-gray-800">
                            {item.value}
                          </span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${item.color} transition-all duration-500`}
                            style={{ width: `${item.pct}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Driver stats */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <h3 className="font-bold text-sm text-gray-900 mb-4">
                    Driver Stats
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      {
                        label: "Total Drivers",
                        value: stats.totalDrivers,
                        bg: "bg-gray-50",
                        cls: "text-gray-900",
                      },
                      {
                        label: "Online Now",
                        value: stats.activeDrivers,
                        bg: "bg-emerald-50",
                        cls: "text-emerald-700",
                      },
                      {
                        label: "Pending",
                        value: stats.pendingDrivers,
                        bg: "bg-amber-50",
                        cls: "text-amber-700",
                      },
                      {
                        label: "Suspended",
                        value: stats.suspendedDrivers,
                        bg: "bg-red-50",
                        cls: "text-red-600",
                      },
                    ].map((s) => (
                      <div
                        key={s.label}
                        className={`${s.bg} rounded-xl p-4 text-center border border-gray-100`}
                      >
                        <p className={`text-2xl font-bold ${s.cls}`}>
                          {s.value}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {s.label}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 7-day deliveries bar chart */}
                {(() => {
                  const days = Array.from({ length: 7 }, (_, i) => {
                    const d = new Date();
                    d.setDate(d.getDate() - (6 - i));
                    d.setHours(0, 0, 0, 0);
                    return d;
                  });
                  const counts = days.map((dayStart) => {
                    const dayEnd = new Date(dayStart.getTime() + 86400000);
                    return requests.filter((r) => {
                      const cd = safeDate(r.createdAt);
                      return cd && cd >= dayStart && cd < dayEnd;
                    }).length;
                  });
                  const maxCount = Math.max(...counts, 1);
                  const labels = days.map((d) =>
                    d.toLocaleDateString("en-NG", { weekday: "short" }),
                  );
                  return (
                    <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                      <h3 className="font-bold text-sm text-gray-900 mb-4">
                        Deliveries — Last 7 Days
                      </h3>
                      <div className="flex items-end gap-2 h-28">
                        {counts.map((count, i) => (
                          <div
                            key={i}
                            className="flex-1 flex flex-col items-center gap-1.5"
                          >
                            <span className="text-[10px] font-bold text-gray-600">
                              {count > 0 ? count : ""}
                            </span>
                            <div className="w-full flex flex-col justify-end" style={{ height: "80px" }}>
                              <div
                                className="w-full rounded-t-lg bg-primary transition-all duration-500"
                                style={{
                                  height: `${Math.round((count / maxCount) * 80)}px`,
                                  minHeight: count > 0 ? "4px" : "0",
                                }}
                              />
                            </div>
                            <span className="text-[10px] text-gray-400 font-medium">
                              {labels[i]}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-50">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-sm bg-primary" />
                          <span className="text-xs text-gray-500">
                            {counts.reduce((a, b) => a + b, 0)} this week
                          </span>
                        </div>
                        <span className="text-xs text-gray-300">·</span>
                        <span className="text-xs text-gray-500">
                          Peak: {Math.max(...counts)} in a day
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {/* Revenue card */}
                <div className="lg:col-span-2 bg-gradient-to-br from-primary via-primary to-emerald-600 rounded-2xl p-5 text-white relative overflow-hidden">
                  <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/8" />
                  <div className="absolute -bottom-6 -left-6 w-28 h-28 rounded-full bg-white/8" />
                  <div className="relative space-y-4">
                    <div>
                      <p className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-1">
                        Total Revenue Generated
                      </p>
                      <p className="text-2xl lg:text-4xl font-bold tracking-tight break-all">
                        ₦{stats.totalRevenue.toLocaleString()}
                      </p>
                      <p className="text-xs text-white/70 mt-1">
                        From {stats.completedRequests} completed deliveries
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        {
                          label: "Avg/Order",
                          value: `₦${Math.round(stats.totalRevenue / Math.max(stats.completedRequests, 1)).toLocaleString()}`,
                        },
                        {
                          label: "Last 30 Days",
                          value:
                            "₦" +
                            requests
                              .filter((r) => {
                                if (r.status !== "completed") return false;
                                const d = safeDate(r.completedAt ?? r.createdAt);
                                return d && d >= new Date(Date.now() - 30 * 86400000);
                              })
                              .reduce(
                                (s, r) =>
                                  s + (Number(r.finalPrice) || Number(r.estimatedPrice) || 0),
                                0,
                              )
                              .toLocaleString(),
                        },
                      ].map((s) => (
                        <div
                          key={s.label}
                          className="bg-white/15 rounded-xl px-3 py-2.5 border border-white/20 min-w-0"
                        >
                          <p className="text-base lg:text-lg font-bold truncate">
                            {s.value}
                          </p>
                          <p className="text-[11px] text-white/60">{s.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── SETTINGS ── */}
          {activeTab === "settings" && (
            <div className="space-y-4 animate-fade-in max-w-2xl py-2">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Settings</h2>
                <p className="text-sm text-gray-400 mt-0.5">
                  Admin account &amp; data management
                </p>
              </div>

              {/* Account */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-50">
                  <h3 className="font-bold text-sm text-gray-900">Account</h3>
                </div>
                <div className="flex items-center gap-4 px-5 py-4">
                  <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-lg font-bold text-primary">
                      {user?.email?.[0]?.toUpperCase() ?? "A"}
                    </span>
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">Admin</p>
                    <p className="text-sm text-gray-400">{user?.email}</p>
                  </div>
                </div>
              </div>

              {/* Data export */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-50">
                  <h3 className="font-bold text-sm text-gray-900">
                    Data Export
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Download CSV snapshots of platform data
                  </p>
                </div>
                <div className="divide-y divide-gray-50">
                  {[
                    {
                      label: "Export Users",
                      sub: `${users.length} records`,
                      icon: Users,
                      key: "users",
                    },
                    {
                      label: "Export Drivers",
                      sub: `${drivers.length} records`,
                      icon: Truck,
                      key: "drivers",
                    },
                    {
                      label: "Export Deliveries",
                      sub: `${requests.length} records`,
                      icon: Package,
                      key: "deliveries",
                    },
                  ].map((item) => (
                    <div
                      key={item.key}
                      className="flex items-center justify-between px-5 py-3.5"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-gray-50 flex items-center justify-center">
                          <item.icon className="h-4 w-4 text-gray-500" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-gray-800">
                            {item.label}
                          </p>
                          <p className="text-xs text-gray-400">{item.sub}</p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl border-gray-200 h-9"
                        onClick={() => handleExportData(item.key)}
                      >
                        <Download className="h-3.5 w-3.5 mr-1.5" />
                        Export
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Data Migration */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-50">
                  <h3 className="font-bold text-sm text-gray-900">Data Migration</h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    One-time migration of legacy vehicle types to the current freight type system
                  </p>
                </div>
                <div className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                      <Truck className="h-4 w-4 text-amber-500" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-gray-800">Migrate Vehicle Types</p>
                      <p className="text-xs text-gray-400">
                        {migrationState === "idle" && "Updates bike_rider, car_driver, van_driver, truck_driver → new types"}
                        {migrationState === "running" && "Running migration…"}
                        {migrationState === "done" && migrationResult && (
                          `Done — ${migrationResult.updated} updated, ${migrationResult.skipped} already current`
                        )}
                        {migrationState === "error" && "Migration failed — check console for details"}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant={migrationState === "done" ? "outline" : "default"}
                    size="sm"
                    className="rounded-xl h-9 min-w-[90px]"
                    disabled={migrationState === "running" || migrationState === "done"}
                    onClick={async () => {
                      setMigrationState("running");
                      try {
                        const result = await migrateVehicleTypes();
                        setMigrationResult(result);
                        setMigrationState("done");
                      } catch {
                        setMigrationState("error");
                      }
                    }}
                  >
                    {migrationState === "running" ? (
                      <span className="flex items-center gap-1.5">
                        <span className="h-3.5 w-3.5 rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground animate-spin" />
                        Running
                      </span>
                    ) : migrationState === "done" ? "Done ✓" : "Run Migration"}
                  </Button>
                </div>
              </div>

              {/* Notifications */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-50">
                  <h3 className="font-bold text-sm text-gray-900">
                    Notifications
                  </h3>
                </div>
                <div className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-gray-50 flex items-center justify-center">
                      <Bell className="h-4 w-4 text-gray-500" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-gray-800">
                        Clear All Notifications
                      </p>
                      <p className="text-xs text-gray-400">
                        {adminNotifications.filter((n) => !n.read).length} unread
                        · {adminNotifications.length} total
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl border-gray-200 h-9"
                    onClick={async () => {
                      try {
                        await markAllAdminNotificationsRead(adminNotifications);
                        toast.success("All notifications marked as read");
                      } catch {
                        toast.error("Failed");
                      }
                    }}
                    disabled={adminNotifications.filter((n) => !n.read).length === 0}
                  >
                    <CheckCheck className="h-3.5 w-3.5 mr-1.5" />
                    Mark all read
                  </Button>
                </div>
              </div>

              {/* System status */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-50">
                  <h3 className="font-bold text-sm text-gray-900">
                    System Status
                  </h3>
                </div>
                <div className="divide-y divide-gray-50">
                  {[
                    { name: "Database", icon: Globe },
                    { name: "Maps API", icon: MapPin },
                    { name: "Payment Gateway", icon: Banknote },
                  ].map((item) => (
                    <div
                      key={item.name}
                      className="flex items-center justify-between px-5 py-4"
                    >
                      <div className="flex items-center gap-3">
                        <item.icon className="h-4 w-4 text-gray-400" />
                        <span className="text-sm font-medium text-gray-700">
                          {item.name}
                        </span>
                      </div>
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Operational
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <Button
                variant="outline"
                className="rounded-xl border-red-100 text-red-500 hover:bg-red-50 hover:border-red-200 h-11 px-6 font-semibold"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          )}

          {/* ── SUPPORT ── */}
          {activeTab === "support" && (
            <SupportInbox adminUid={user?.uid ?? ""} />
          )}
        </main>

        {/* ── Mobile Bottom Nav ── */}
        <nav
          className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-100 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className="flex items-stretch h-16">
            {bottomNavItems.map((item) => {
              const isActive = activeTab === item.id;
              const showBadge =
                item.id === "deliveries" &&
                adminNotifications.filter((n) => !n.read).length > 0;
              return (
                <button
                  key={item.id}
                  onClick={() => switchTab(item.id)}
                  className={`flex-1 flex flex-col items-center justify-center gap-0.5 relative transition-all duration-150 active:scale-95 ${isActive ? "text-primary" : "text-gray-400"}`}
                >
                  {/* Active indicator dot */}
                  {isActive && (
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-primary rounded-full" />
                  )}
                  <div
                    className={`relative flex items-center justify-center h-8 w-8 rounded-xl transition-colors ${isActive ? "bg-primary/10" : "hover:bg-gray-50"}`}
                  >
                    <item.icon
                      className={`h-[18px] w-[18px] ${isActive ? "text-primary" : "text-gray-400"}`}
                    />
                    {showBadge && (
                      <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-red-500 text-[8px] font-bold text-white flex items-center justify-center">
                        {adminNotifications.filter((n) => !n.read).length > 9
                          ? "9+"
                          : adminNotifications.filter((n) => !n.read).length}
                      </span>
                    )}
                  </div>
                  <span
                    className={`text-[10px] font-semibold leading-none ${isActive ? "text-primary" : "text-gray-400"}`}
                  >
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}

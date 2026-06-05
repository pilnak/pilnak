import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSessionState } from "@/hooks/useSessionState";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
  LayoutDashboard,
  Package,
  Truck,
  MapPin,
  LogOut,
  MoreHorizontal,
  CheckCircle,
  XCircle,
  Clock,
  Activity,
  ArrowUp,
  ArrowDown,
  TrendingUp,
  Edit,
  Trash2,
  Star,
  X,
  DollarSign,
  Building2,
  Plus,
  History,
  Navigation2,
  Car,
  UserCheck,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Search,
  Link2,
  Link2Off,
  Upload,
  Camera,
  Eye,
  User,
  Phone,
  Mail,
  Calendar,
  FileText,
  Shield,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Globe,
  MapIcon,
  Download,
  Menu,
  Zap,
  BarChart2,
  Bell,
  BellRing,
  Banknote,
  ImageIcon,
  Ban,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { useCompanyAuth } from "@/hooks/useCompanyAuth";
import {
  listenCompanyDrivers,
  listenCompanyFleet,
  listenCompanyDeliveries,
  listenCompanyHistory,
  createCompanyDriver,
  updateCompanyDriver,
  deleteCompanyDriver,
  createFleetVehicle,
  updateFleetVehicle,
  deleteFleetVehicle,
  assignDriverToVehicle,
  unassignDriverFromVehicle,
  updateCompanyProfile,
  createDelivery,
  updateDelivery,
  deleteDelivery,
  uploadToCloudinary,
  type CompanyDriver,
  type FleetVehicle,
  type CompanyDelivery,
} from "@/services/companyService";
import {
  MapView,
  type MapMarker,
  type SearchPin,
} from "@/components/map/MapView";
import { CameraCapture } from "@/components/camera/CameraCapture";
import { toast } from "sonner";
import {
  checkDriverEmailConflict,
  confirmPayment,
  createAssignment,
  getAssignmentsByRequestIds,
  getDeliveryRequestStatus,
  setPriceQuote,
  getUsersByIds,
  haversineKm,
  listenCompanyWorkflowRequests,
  listenOpenCompanyRequests,
  listenAdminNotifications,
  listenActiveQuotesForCompany,
  markAdminNotificationRead,
  markAllAdminNotificationsRead,
  submitCompanyQuote,
  companyRespondToCounter,
  claimCompanyDeliveryRequest,
  type AdminNotificationDoc,
  type DeliveryQuoteDoc,
  type DeliveryRequestDoc,
  type UserDoc,
} from "@/services/firebase";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

// ─── CSS vars injected once ───────────────────────────────────────────────────
// DM Sans + Syne are loaded globally from index.html — no runtime injection needed.
if (typeof document !== "undefined" && !document.getElementById("dash-css")) {
  const style = document.createElement("style");
  style.id = "dash-css";
  style.textContent = `
    :root {
      --brand: #009C41;
      --brand-dark: #007A32;
      --brand-light: #e6f7ed;
      --brand-mid: #00b84d;
      --surface: #f4f6f8;
      --card: #ffffff;
      --border: #e8eaed;
      --text-primary: #0f1117;
      --text-secondary: #5a6070;
      --text-muted: #9ba3af;
      --sidebar-bg: #008136;
      --sidebar-darker: #006b2b;
      --radius-card: 14px;
      --radius-btn: 10px;
      --shadow-card: 0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04);
      --shadow-card-hover: 0 4px 16px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06);
    }

    /* Prevent input zoom on iOS */
    input, select, textarea {
      font-size: 16px !important;
    }
    @media (min-width: 768px) {
      input, select, textarea {
        font-size: 14px !important;
      }
    }

    .dash-font { font-family: 'DM Sans', system-ui, sans-serif; }
    .dash-display { font-family: 'Syne', system-ui, sans-serif; }

    /* Sidebar nav hover */
    .snav-item:hover { background: rgba(255,255,255,0.12) !important; color: #fff !important; }
    .snav-item.active { background: rgba(255,255,255,0.20) !important; color: #fff !important; }

    /* Stat card shimmer on hover */
    .stat-card { transition: transform 0.18s ease, box-shadow 0.18s ease; }
    .stat-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-card-hover); }

    /* Table rows */
    .dash-table tr:hover td { background: #f9fafb; }

    /* Badge pulse */
    @keyframes badge-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.6; }
    }

    /* Bottom nav active bar */
    .bnav-bar { background: var(--brand); border-radius: 0 0 3px 3px; }

    /* Scrollbar styling */
    .dash-scroll::-webkit-scrollbar { width: 4px; }
    .dash-scroll::-webkit-scrollbar-track { background: transparent; }
    .dash-scroll::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.12); border-radius: 4px; }

    /* Safe area support */
    .safe-bottom { padding-bottom: env(safe-area-inset-bottom, 0px); }
    .safe-top { padding-top: env(safe-area-inset-top, 0px); }

    /* Card entry animation */
    @keyframes card-in {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .card-in { animation: card-in 0.22s ease both; }
    .card-in-1 { animation-delay: 0.04s; }
    .card-in-2 { animation-delay: 0.08s; }
    .card-in-3 { animation-delay: 0.12s; }
    .card-in-4 { animation-delay: 0.16s; }

    /* Input focus ring */
    .dash-input:focus { outline: none; box-shadow: 0 0 0 3px rgba(0,156,65,0.15); border-color: var(--brand) !important; }

    /* Gradient text */
    .grad-text {
      background: linear-gradient(135deg, #009C41 0%, #00c853 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    /* Skeleton shimmer */
    @keyframes shimmer {
      from { background-position: -200% 0; }
      to   { background-position:  200% 0; }
    }
    .skeleton {
      background: linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s ease-in-out infinite;
    }

    /* Tab content entrance */
    @keyframes tab-fade {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .tab-content { animation: tab-fade 0.22s ease both; }

    /* Segmented pill transition */
    .seg-pill { transition: background 0.18s cubic-bezier(0.4, 0, 0.2, 1), color 0.18s ease, box-shadow 0.18s ease; }

    /* Cancelled ghost fade: full opacity → ghost opacity */
    @keyframes ghost-fade {
      from { opacity: 1; }
      to   { opacity: 0.62; }
    }

    /* More bottom sheet slide-up */
    @keyframes sheet-slide-up {
      from { transform: translateY(100%); opacity: 0.6; }
      to   { transform: translateY(0);    opacity: 1; }
    }
  `;
  document.head.appendChild(style);
}

// ─── Types ────────────────────────────────────────────────────────────────────
type Tab =
  | "dashboard"
  | "analytics"
  | "drivers"
  | "fleet"
  | "deliveries"
  | "requests"
  | "history"
  | "reports"
  | "map"
  | "profile";
type CompanyWorkflowRequest = DeliveryRequestDoc & { id: string };

// ─── Status helpers ───────────────────────────────────────────────────────────
const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  inactive: "bg-gray-100 text-gray-500 border-gray-200",
  suspended: "bg-red-50 text-red-600 border-red-200",
  available: "bg-emerald-50 text-emerald-700 border-emerald-200",
  in_use: "bg-blue-50 text-blue-700 border-blue-200",
  maintenance: "bg-amber-50 text-amber-700 border-amber-200",
  retired: "bg-gray-100 text-gray-400 border-gray-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  admin_review: "bg-indigo-50 text-indigo-700 border-indigo-200",
  negotiating: "bg-sky-50 text-sky-700 border-sky-200",
  price_set: "bg-amber-50 text-amber-700 border-amber-200",
  payment_pending: "bg-violet-50 text-violet-700 border-violet-200",
  customer_confirmed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  driver_assigned: "bg-blue-50 text-blue-700 border-blue-200",
  driver_accepted: "bg-blue-50 text-blue-700 border-blue-200",
  assigned: "bg-blue-50 text-blue-700 border-blue-200",
  in_progress: "bg-violet-50 text-violet-700 border-violet-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelled: "bg-gray-100 text-gray-500 border-gray-200",
};

const STATUS_ICONS: Record<string, React.ElementType> = {
  active: CheckCircle,
  available: CheckCircle,
  completed: CheckCircle,
  in_use: Activity,
  assigned: Activity,
  in_progress: Activity,
  pending: Clock,
  maintenance: Clock,
  inactive: XCircle,
  admin_review: Clock,
  negotiating: Phone,
  price_set: DollarSign,
  payment_pending: Clock,
  customer_confirmed: CheckCircle,
  driver_assigned: Truck,
  driver_accepted: CheckCircle,
  suspended: XCircle,
  retired: XCircle,
  cancelled: XCircle,
};

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.pending;
  const Icon = STATUS_ICONS[status] ?? Clock;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${style}`}
      style={{ fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.01em" }}
    >
      <Icon className="h-3 w-3 flex-shrink-0" />
      <span className="capitalize">{status.replace(/_/g, " ")}</span>
    </span>
  );
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatTs(ts: unknown): string {
  if (!ts) return "—";
  const date =
    (ts as any)?.toDate?.() ?? (typeof ts === "string" ? new Date(ts) : null);
  if (!date) return "—";
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
  trend,
  sub,
  delay = 0,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  accent: string;
  trend?: number;
  sub?: string;
  delay?: number;
}) {
  return (
    <div
      className={`stat-card card-in card-in-${delay} bg-white rounded-[14px] p-5 border border-[#e8eaed] relative overflow-hidden`}
      style={{
        boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)",
      }}
    >
      {/* Subtle background decoration */}
      <div
        className="absolute -right-4 -top-4 w-20 h-20 rounded-full opacity-[0.04]"
        style={{
          background:
            accent.includes("primary") || accent.includes("emerald")
              ? "#009C41"
              : "#6366f1",
        }}
      />
      <div className="flex items-start justify-between mb-4">
        <div
          className={`h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0 ${accent}`}
        >
          <Icon className="h-5 w-5" />
        </div>
        {trend !== undefined && (
          <span
            className={`flex items-center gap-0.5 text-[11px] font-bold px-2 py-0.5 rounded-full ${trend >= 0 ? "text-emerald-700 bg-emerald-50" : "text-red-600 bg-red-50"}`}
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
      <p
        className="text-[26px] font-bold tracking-tight leading-none mb-1"
        style={{ fontFamily: "'Syne', sans-serif", color: "#0f1117" }}
      >
        {value}
      </p>
      <p
        className="text-[11px] font-semibold uppercase tracking-wider"
        style={{ color: "#9ba3af" }}
      >
        {label}
      </p>
      {sub && (
        <p className="text-[11px] mt-1" style={{ color: "#9ba3af" }}>
          {sub}
        </p>
      )}
    </div>
  );
}

function NavItem({
  icon: Icon,
  label,
  active,
  onClick,
  badge,
}: {
  icon: React.ElementType;
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`snav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150 relative ${active ? "active" : ""}`}
      style={{
        color: active ? "#fff" : "rgba(255,255,255,0.65)",
        background: active ? "rgba(255,255,255,0.20)" : "transparent",
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-white" />
      )}
      <Icon
        className="h-[17px] w-[17px] flex-shrink-0"
        style={{ color: active ? "#fff" : "rgba(255,255,255,0.6)" }}
      />
      <span className="flex-1 text-left">{label}</span>
      {(badge ?? 0) > 0 && (
        <span className="h-5 min-w-[20px] px-1.5 rounded-full bg-white/20 text-[10px] font-bold text-white flex items-center justify-center">
          {badge}
        </span>
      )}
    </button>
  );
}

function EmptyState({
  icon: Icon,
  title,
  sub,
}: {
  icon: React.ElementType;
  title: string;
  sub?: string;
}) {
  return (
    <div className="py-16 text-center">
      <div className="h-16 w-16 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4 border border-gray-100">
        <Icon className="h-7 w-7 text-gray-300" />
      </div>
      <p
        className="text-sm font-semibold"
        style={{ color: "#5a6070", fontFamily: "'DM Sans', sans-serif" }}
      >
        {title}
      </p>
      {sub && (
        <p className="text-xs mt-1" style={{ color: "#9ba3af" }}>
          {sub}
        </p>
      )}
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="relative">
        <Loader2
          className="h-8 w-8 animate-spin"
          style={{ color: "#009C41" }}
        />
      </div>
    </div>
  );
}

// Shared card container
function Card({
  children,
  className = "",
  style = {},
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`bg-white rounded-[14px] border border-[#e8eaed] ${className}`}
      style={{
        boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// Shared section header inside card
function CardHeader({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="px-5 py-4 border-b border-[#f0f0f0] flex items-center justify-between">
      <h3
        className="font-semibold text-sm"
        style={{ color: "#0f1117", fontFamily: "'Syne', sans-serif" }}
      >
        {title}
      </h3>
      {action}
    </div>
  );
}

// Shared dash input — always 16px on mobile to prevent zoom
function DashInput(
  props: React.InputHTMLAttributes<HTMLInputElement> & { className?: string },
) {
  const { className = "", ...rest } = props;
  return (
    <input
      {...rest}
      className={`dash-input w-full h-10 px-3 rounded-[10px] border border-[#e8eaed] bg-[#f9fafb] text-[#0f1117] placeholder:text-[#9ba3af] transition-all outline-none ${className}`}
      style={{
        fontFamily: "'DM Sans', sans-serif",
        fontSize: 16,
        ...((props as any).style || {}),
      }}
    />
  );
}

// ─── Image Upload + Camera Box (Fleet) ────────────────────────────────────────
function FleetImageBox({
  label,
  value,
  onChange,
  uploading,
}: {
  label: string;
  value: string | null | undefined;
  onChange: (file: File) => void;
  uploading?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [showCamera, setShowCamera] = useState(false);

  async function handleCameraCapture(dataUrl: string) {
    setShowCamera(false);
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const file = new File([blob], "capture.jpg", { type: "image/jpeg" });
    onChange(file);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span
        className="text-[11px] font-semibold uppercase tracking-wider"
        style={{ color: "#9ba3af" }}
      >
        {label}
      </span>
      <div
        className={`relative h-24 w-full rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1.5 overflow-hidden transition-colors ${value ? "border-[#009C41]/30 bg-[#009C41]/5" : "border-[#e8eaed] bg-gray-50"}`}
      >
        {uploading ? (
          <Loader2
            className="h-5 w-5 animate-spin"
            style={{ color: "#009C41" }}
          />
        ) : value ? (
          <img
            src={value}
            alt={label}
            className="absolute inset-0 w-full h-full object-cover rounded-xl"
          />
        ) : (
          <Car className="h-5 w-5 text-gray-300" />
        )}
        {value && !uploading && (
          <div className="absolute inset-0 bg-black/30 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
            <span className="text-white text-xs font-semibold">Change</span>
          </div>
        )}
      </div>
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={() => setShowCamera(true)}
          className="flex-1 flex items-center justify-center gap-1 h-7 rounded-lg text-[11px] font-semibold transition-colors"
          style={{ background: "rgba(0,156,65,0.1)", color: "#009C41" }}
        >
          <Camera className="h-3 w-3" /> Camera
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex-1 flex items-center justify-center gap-1 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 text-[11px] font-semibold transition-colors"
        >
          <Upload className="h-3 w-3" /> Upload
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onChange(f);
        }}
      />
      {showCamera && (
        <CameraCapture
          title={`Capture ${label}`}
          facingMode="environment"
          onCapture={handleCameraCapture}
          onCancel={() => setShowCamera(false)}
        />
      )}
    </div>
  );
}

// ─── Camera-only Photo Box (Drivers) ─────────────────────────────────────────
function DriverPhotoBox({
  value,
  uploading,
  onCapture,
}: {
  value: string | null | undefined;
  uploading?: boolean;
  onCapture: (dataUrl: string) => void;
}) {
  const [showCamera, setShowCamera] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <Label className="text-xs font-semibold" style={{ color: "#5a6070" }}>
        Passport Photo
      </Label>
      <div className="relative h-24 w-24 rounded-2xl border-2 border-dashed border-[#e8eaed] overflow-hidden">
        {uploading ? (
          <div className="h-full flex items-center justify-center">
            <Loader2
              className="h-6 w-6 animate-spin"
              style={{ color: "#009C41" }}
            />
          </div>
        ) : value ? (
          <img
            src={value}
            alt="Passport"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center gap-1">
            <User className="h-8 w-8 text-gray-200" />
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={() => setShowCamera(true)}
        className="flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-semibold transition-colors w-fit"
        style={{ background: "rgba(0,156,65,0.1)", color: "#009C41" }}
      >
        <Camera className="h-3.5 w-3.5" /> Take Photo
      </button>
      {showCamera && (
        <CameraCapture
          title="Take Passport Photo"
          facingMode="user"
          onCapture={(dataUrl) => {
            setShowCamera(false);
            onCapture(dataUrl);
          }}
          onCancel={() => setShowCamera(false)}
        />
      )}
    </div>
  );
}

// ─── Tab: Overview ────────────────────────────────────────────────────────────
function OverviewTab({
  companyName,
  company,
  drivers,
  fleet,
  deliveries,
  history,
  openRequests,
  ownedRequests,
  companyId,
  onNavigate,
  onViewRequest,
}: {
  companyName: string;
  company: import("@/services/companyService").CompanyDoc | null;
  drivers: Array<CompanyDriver & { id: string }>;
  fleet: Array<FleetVehicle & { id: string }>;
  deliveries: Array<CompanyDelivery & { id: string }>;
  history: Array<CompanyDelivery & { id: string }>;
  openRequests: CompanyWorkflowRequest[];
  ownedRequests: CompanyWorkflowRequest[];
  companyId: string;
  onNavigate: (tab: Tab) => void;
  onViewRequest: (requestId: string) => void;
}) {
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const onlineDrivers = drivers.filter((d) => d.isOnline).length;
  const activeDeliveries = deliveries.filter(
    (d) => d.status === "in_progress" || d.status === "assigned",
  ).length;
  const ownedIds = useMemo(
    () => new Set(ownedRequests.map((r) => r.id)),
    [ownedRequests],
  );
  const recentRequests = useMemo(
    () =>
      openRequests
        .filter((r) => !ownedIds.has(r.id) && r.status !== "cancelled")
        .slice(0, 5),
    [openRequests, ownedIds],
  );

  const totalRevenue = history.reduce(
    (s, h) =>
      s +
      ((h as any).finalPrice ??
        (h as any).quotedPrice ??
        (h as any).estimatedPrice ??
        0),
    0,
  );

  const quickStats = [
    {
      label: "Total Drivers",
      value: drivers.length,
      icon: Truck,
      color: "#009C41",
      bg: "rgba(0,156,65,0.09)",
    },
    {
      label: "Online Now",
      value: onlineDrivers,
      icon: UserCheck,
      color: "#10b981",
      bg: "rgba(16,185,129,0.09)",
    },
    {
      label: "Active Deliveries",
      value: activeDeliveries,
      icon: Package,
      color: "#3b82f6",
      bg: "rgba(59,130,246,0.09)",
    },
    {
      label: "Total Revenue",
      value: `₦${totalRevenue.toLocaleString()}`,
      icon: Banknote,
      color: "#8b5cf6",
      bg: "rgba(139,92,246,0.09)",
    },
  ];

  return (
    <div className="space-y-4 dash-font">
      {/* ── Hero card ────────────────────────────────────────────────────────── */}
      <div
        className="rounded-[20px] p-5 relative overflow-hidden card-in"
        style={{
          background: "linear-gradient(140deg, #009C41 0%, #004d20 100%)",
          boxShadow: "0 10px 40px rgba(0,156,65,0.32)",
        }}
      >
        <div
          className="absolute -top-14 -right-14 w-44 h-44 rounded-full"
          style={{ background: "rgba(255,255,255,0.05)" }}
        />
        <div
          className="absolute -bottom-8 left-8 w-28 h-28 rounded-full"
          style={{ background: "rgba(255,255,255,0.04)" }}
        />
        <div
          className="absolute top-8 right-8 w-10 h-10 rounded-full"
          style={{ background: "rgba(255,255,255,0.06)" }}
        />

        <div className="relative">
          {/* Top row: greeting + status pill */}
          <div className="flex items-start justify-between mb-3">
            <span
              className="text-[11px] font-bold uppercase tracking-widest"
              style={{ color: "rgba(255,255,255,0.50)" }}
            >
              {greeting}
            </span>
            {company?.approvalStatus === "approved" ? (
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                style={{ background: "rgba(255,255,255,0.14)" }}
              >
                <span className="relative flex h-1.5 w-1.5">
                  <span
                    className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                    style={{ background: "#86efac" }}
                  />
                  <span
                    className="relative inline-flex h-1.5 w-1.5 rounded-full"
                    style={{ background: "#4ade80" }}
                  />
                </span>
                <span className="text-[11px] font-semibold text-white">
                  {onlineDrivers > 0
                    ? `${onlineDrivers} driver${onlineDrivers !== 1 ? "s" : ""} online`
                    : "Live"}
                </span>
              </div>
            ) : (
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                style={{ background: "rgba(251,191,36,0.18)" }}
              >
                <AlertCircle className="h-3 w-3" style={{ color: "#fbbf24" }} />
                <span
                  className="text-[11px] font-semibold"
                  style={{ color: "#fef08a" }}
                >
                  {company?.approvalStatus === "pending"
                    ? "Pending approval"
                    : "Suspended"}
                </span>
              </div>
            )}
          </div>

          {/* Company name */}
          <h2
            className="text-[27px] font-bold text-white leading-tight"
            style={{ fontFamily: "'Syne', sans-serif" }}
          >
            {companyName}
          </h2>
          <p
            className="text-[12px] mt-0.5"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            {new Date().toLocaleDateString("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>

          {/* Mini metric strip */}
          <div
            className="flex items-center gap-0 mt-5 pt-4"
            style={{ borderTop: "1px solid rgba(255,255,255,0.12)" }}
          >
            {[
              { label: "Drivers", val: drivers.length },
              { label: "Vehicles", val: fleet.length },
              { label: "Active", val: activeDeliveries },
            ].map((m, i) => (
              <div key={m.label} className="flex items-center">
                {i > 0 && (
                  <div
                    className="mx-4"
                    style={{
                      width: 1,
                      height: 28,
                      background: "rgba(255,255,255,0.15)",
                    }}
                  />
                )}
                <div>
                  <p
                    className="text-[22px] font-bold text-white leading-none"
                    style={{ fontFamily: "'Syne', sans-serif" }}
                  >
                    {m.val}
                  </p>
                  <p
                    className="text-[11px] mt-0.5"
                    style={{ color: "rgba(255,255,255,0.50)" }}
                  >
                    {m.label}
                  </p>
                </div>
              </div>
            ))}
            <div
              className="mx-4"
              style={{
                width: 1,
                height: 28,
                background: "rgba(255,255,255,0.15)",
              }}
            />
            <div>
              <p
                className="text-[15px] font-bold text-white leading-none tabular-nums"
                style={{ fontFamily: "'Syne', sans-serif" }}
              >
                ₦{totalRevenue.toLocaleString()}
              </p>
              <p
                className="text-[11px] mt-0.5"
                style={{ color: "rgba(255,255,255,0.50)" }}
              >
                Revenue
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Quick stats 2×2 ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        {quickStats.map((s, i) => {
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              className={`bg-white rounded-[16px] p-4 card-in card-in-${i + 1}`}
              style={{
                border: "1px solid rgba(0,0,0,0.06)",
                boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
              }}
            >
              <div
                className="h-9 w-9 rounded-[10px] flex items-center justify-center mb-3"
                style={{ background: s.bg }}
              >
                <Icon className="h-4 w-4" style={{ color: s.color }} />
              </div>
              <p
                className="text-[26px] font-bold leading-none tabular-nums"
                style={{ fontFamily: "'Syne', sans-serif", color: "#1d1d1f" }}
              >
                {s.value}
              </p>
              <p
                className="text-[10px] font-bold uppercase tracking-widest mt-1.5"
                style={{ color: "#aeaeb2" }}
              >
                {s.label}
              </p>
            </div>
          );
        })}
      </div>

      {/* ── Delivery requests list ────────────────────────────────────────────── */}
      <div
        className="bg-white rounded-[18px] overflow-hidden card-in"
        style={{
          border: "1px solid rgba(0,0,0,0.06)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
        }}
      >
        <div
          className="flex items-center justify-between px-4 pt-4 pb-3.5"
          style={{ borderBottom: "1px solid rgba(0,0,0,0.05)" }}
        >
          <h3
            className="font-bold text-[15px]"
            style={{ fontFamily: "'Syne', sans-serif", color: "#1d1d1f" }}
          >
            Delivery Requests
          </h3>
          <button
            onClick={() => onNavigate("requests")}
            className="text-[12px] font-bold transition-opacity hover:opacity-60"
            style={{ color: "#009C41" }}
          >
            View all →
          </button>
        </div>

        {recentRequests.length === 0 ? (
          <div className="py-14 text-center">
            <div
              className="h-12 w-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
              style={{ background: "rgba(0,156,65,0.06)" }}
            >
              <Package className="h-5 w-5" style={{ color: "#009C41" }} />
            </div>
            <p
              className="text-[13px] font-semibold"
              style={{ color: "#6e6e73" }}
            >
              No open requests
            </p>
            <p className="text-[12px] mt-0.5" style={{ color: "#aeaeb2" }}>
              New requests appear here in real time.
            </p>
          </div>
        ) : (
          recentRequests.map((r, i) => {
            const ra = r as any;
            return (
              <div
                key={r.id}
                className="px-4 py-3.5 flex items-center gap-3 transition-colors hover:bg-black/[0.015]"
                style={{
                  borderBottom:
                    i < recentRequests.length - 1
                      ? "1px solid rgba(0,0,0,0.05)"
                      : "none",
                }}
              >
                {/* Route connector dots */}
                <div
                  className="flex flex-col items-center flex-shrink-0"
                  style={{ gap: 3 }}
                >
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ background: "#009C41" }}
                  />
                  <div
                    className="w-px"
                    style={{ height: 12, background: "rgba(0,0,0,0.14)" }}
                  />
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ background: "#ef4444" }}
                  />
                </div>
                {/* Addresses */}
                <div className="flex-1 min-w-0">
                  <p
                    className="text-[13px] font-semibold truncate"
                    style={{ color: "#1d1d1f" }}
                  >
                    {r.pickup.address}
                  </p>
                  <p
                    className="text-[12px] truncate mt-0.5"
                    style={{ color: "#aeaeb2" }}
                  >
                    {r.dropoff.address}
                  </p>
                </div>
                {/* Vehicle badge + CTA */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span
                    className="hidden sm:inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide"
                    style={{
                      background: "rgba(0,156,65,0.08)",
                      color: "#007a32",
                    }}
                  >
                    {getVehicleLabel(ra.transportType)}
                  </span>
                  <button
                    onClick={() => onViewRequest(r.id)}
                    className="h-7 px-3 rounded-[8px] text-[11px] font-bold transition-all active:scale-95"
                    style={{
                      border: "1.5px solid #009C41",
                      color: "#009C41",
                      background: "transparent",
                    }}
                  >
                    View
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── Driver status + Fleet ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Driver status bars */}
        <div
          className="bg-white rounded-[18px] p-4 card-in card-in-2"
          style={{
            border: "1px solid rgba(0,0,0,0.06)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
          }}
        >
          <h3
            className="font-bold text-[14px] mb-4"
            style={{ fontFamily: "'Syne', sans-serif", color: "#1d1d1f" }}
          >
            Driver Status
          </h3>
          <div className="space-y-3.5">
            {[
              {
                label: "Online",
                value: drivers.filter((d) => d.isOnline).length,
                color: "#009C41",
              },
              {
                label: "Offline",
                value: drivers.filter((d) => !d.isOnline).length,
                color: "#d1d5db",
              },
              {
                label: "Active",
                value: drivers.filter((d) => d.status === "active").length,
                color: "#6366f1",
              },
            ].map((item) => (
              <div key={item.label}>
                <div className="flex justify-between mb-1.5">
                  <span
                    className="text-[12px] font-medium"
                    style={{ color: "#6e6e73" }}
                  >
                    {item.label}
                  </span>
                  <span
                    className="text-[12px] font-bold tabular-nums"
                    style={{ color: "#1d1d1f" }}
                  >
                    {item.value}
                  </span>
                </div>
                <div
                  className="h-1.5 rounded-full overflow-hidden"
                  style={{ background: "rgba(0,0,0,0.06)" }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${drivers.length ? (item.value / drivers.length) * 100 : 0}%`,
                      background: item.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Fleet card — dark premium */}
        <div
          className="rounded-[18px] p-5 relative overflow-hidden card-in card-in-3"
          style={{
            background: "linear-gradient(140deg, #1c1c1e 0%, #2c2c2e 100%)",
            boxShadow: "0 4px 24px rgba(0,0,0,0.22)",
          }}
        >
          <div
            className="absolute -top-8 -right-8 w-28 h-28 rounded-full"
            style={{ background: "rgba(255,255,255,0.03)" }}
          />
          <div
            className="absolute -bottom-6 -left-6 w-20 h-20 rounded-full"
            style={{ background: "rgba(255,255,255,0.02)" }}
          />
          <div className="relative">
            <p
              className="text-[10px] font-bold uppercase tracking-widest mb-1"
              style={{ color: "rgba(255,255,255,0.35)" }}
            >
              Fleet
            </p>
            <p
              className="text-[36px] font-bold text-white leading-none"
              style={{ fontFamily: "'Syne', sans-serif" }}
            >
              {fleet.length}
            </p>
            <p
              className="text-[13px] font-medium mb-5"
              style={{ color: "rgba(255,255,255,0.40)" }}
            >
              Vehicles registered
            </p>
            <div className="flex items-center gap-2">
              <div
                className="h-6 w-6 rounded-lg flex items-center justify-center"
                style={{ background: "rgba(0,156,65,0.28)" }}
              >
                <CheckCircle
                  className="h-3.5 w-3.5"
                  style={{ color: "#4ade80" }}
                />
              </div>
              <span
                className="text-[12px] font-semibold"
                style={{ color: "rgba(255,255,255,0.65)" }}
              >
                {fleet.filter((f) => f.status === "available").length} available
                now
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Drivers ─────────────────────────────────────────────────────────────
function DriversTab({
  companyId,
  drivers,
  fleet,
  deliveries,
  loading,
}: {
  companyId: string;
  drivers: Array<CompanyDriver & { id: string }>;
  fleet: Array<FleetVehicle & { id: string }>;
  deliveries: Array<CompanyDelivery & { id: string }>;
  loading: boolean;
}) {
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<
    (CompanyDriver & { id: string }) | null
  >(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<CompanyDriver>>({});
  const [photoUploading, setPhotoUploading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<
    (CompanyDriver & { id: string }) | null
  >(null);
  const [suspendConfirmOpen, setSuspendConfirmOpen] = useState(false);
  const [suspendLoading, setSuspendLoading] = useState(false);

  function openSuspendDialog(driver: CompanyDriver & { id: string }) {
    setSuspendTarget(driver);
    setSuspendConfirmOpen(true);
  }

  async function confirmSuspendAction() {
    if (!suspendTarget) return;
    setSuspendLoading(true);
    try {
      const nextStatus =
        suspendTarget.status === "suspended" ? "active" : "suspended";
      await updateCompanyDriver(suspendTarget.id, { status: nextStatus });
      toast.success(
        nextStatus === "suspended"
          ? `${suspendTarget.name} has been suspended.`
          : `${suspendTarget.name} has been reinstated.`,
      );
      setSuspendConfirmOpen(false);
      setSuspendTarget(null);
    } catch {
      toast.error("Failed to update driver status.");
    } finally {
      setSuspendLoading(false);
    }
  }

  const filtered = drivers.filter((d) => {
    const matchStatus = filterStatus === "all" || d.status === filterStatus;
    const matchSearch =
      !search ||
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.email.toLowerCase().includes(search.toLowerCase()) ||
      d.phone.includes(search);
    return matchStatus && matchSearch;
  });

  function openCreate() {
    setEditing(null);
    setForm({
      status: "active",
      isOnline: false,
      totalDeliveries: 0,
      rating: 5.0,
    });
    setShowModal(true);
  }
  function openEdit(driver: CompanyDriver & { id: string }) {
    setEditing(driver);
    setForm({ ...driver });
    setShowModal(true);
  }

  async function handlePhotoCapture(dataUrl: string) {
    setPhotoUploading(true);
    try {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], "passport.jpg", { type: "image/jpeg" });
      const url = await uploadToCloudinary(file, "drivers/passport");
      setForm((p) => ({ ...p, passportPhotoUrl: url }));
    } catch {
      alert("Photo upload failed.");
    } finally {
      setPhotoUploading(false);
    }
  }

  async function handleSave() {
    if (!form.name || !form.email || !form.phone || !form.licenseNumber) return;
    setSaving(true);
    try {
      if (editing) {
        await updateCompanyDriver(editing.id, form);
        toast.success("Driver updated");
      } else {
        const emailConflict = await checkDriverEmailConflict(form.email!);
        if (emailConflict) {
          const proceed = window.confirm(
            `A platform account already exists with the email "${form.email}". This driver may be able to link their account later. Continue adding them as a company driver?`,
          );
          if (!proceed) {
            setSaving(false);
            return;
          }
        }
        await createCompanyDriver({
          companyId,
          name: form.name!,
          email: form.email!.trim().toLowerCase(),
          phone: form.phone!,
          alternatePhone: form.alternatePhone,
          dateOfBirth: form.dateOfBirth,
          gender: form.gender,
          homeAddress: form.homeAddress,
          stateOfOrigin: form.stateOfOrigin,
          nationality: form.nationality ?? "Nigerian",
          licenseNumber: form.licenseNumber!,
          licenseExpiry: form.licenseExpiry,
          yearsOfExperience: form.yearsOfExperience,
          vehicleTypeExpertise: form.vehicleTypeExpertise,
          governmentIdType: form.governmentIdType,
          governmentIdNumber: form.governmentIdNumber,
          passportPhotoUrl: form.passportPhotoUrl ?? null,
          status: form.status ?? "active",
          isOnline: false,
          totalDeliveries: 0,
          rating: 5.0,
        });
        toast.success("Driver added successfully");
      }
      setShowModal(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save driver",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this driver?")) return;
    await deleteCompanyDriver(id);
  }

  function getDriverVehicle(driver: CompanyDriver & { id: string }) {
    if (!driver.assignedVehicleId) return null;
    return fleet.find((v) => v.id === driver.assignedVehicleId) ?? null;
  }

  return (
    <div className="space-y-5 dash-font">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2
            className="text-xl font-bold"
            style={{ fontFamily: "'Syne', sans-serif", color: "#0f1117" }}
          >
            Drivers
          </h2>
          <p className="text-sm mt-0.5" style={{ color: "#9ba3af" }}>
            {filtered.length} driver{filtered.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 h-10 px-4 rounded-[10px] text-sm font-semibold text-white transition-all active:scale-95"
          style={{
            background: "linear-gradient(135deg, #009C41 0%, #007A32 100%)",
            boxShadow: "0 2px 8px rgba(0,156,65,0.30)",
          }}
        >
          <Plus className="h-4 w-4" /> Add Driver
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-0 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search drivers…"
            className="dash-input w-full pl-9 h-10 rounded-[10px] border border-[#e8eaed] bg-[#f9fafb] outline-none"
            style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 16 }}
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36 h-10 rounded-[10px] border-[#e8eaed] text-sm bg-[#f9fafb]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <Card>
              <EmptyState
                icon={Truck}
                title="No drivers found"
                sub="Add your first driver to get started"
              />
            </Card>
          ) : (
            filtered.map((driver) => {
              const vehicle = getDriverVehicle(driver);
              const isExpanded = expandedId === driver.id;
              return (
                <Card
                  key={driver.id}
                  className="overflow-hidden hover:border-[#009C41]/20 transition-all duration-200 card-in"
                >
                  <div className="flex items-start gap-4 p-4 lg:p-5">
                    <div className="flex-shrink-0">
                      {driver.passportPhotoUrl ? (
                        <img
                          src={driver.passportPhotoUrl}
                          alt={driver.name}
                          className="h-14 w-14 rounded-2xl object-cover border-2"
                          style={{ borderColor: "rgba(0,156,65,0.2)" }}
                        />
                      ) : (
                        <div
                          className={`h-14 w-14 rounded-2xl flex items-center justify-center text-base font-bold ${driver.status === "active" ? "" : "bg-gray-100 text-gray-400"}`}
                          style={
                            driver.status === "active"
                              ? {
                                  background: "rgba(0,156,65,0.1)",
                                  color: "#009C41",
                                }
                              : {}
                          }
                        >
                          {getInitials(driver.name)}
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3
                          className="font-bold text-[15px]"
                          style={{ color: "#0f1117" }}
                        >
                          {driver.name}
                        </h3>
                        <StatusBadge status={driver.status} />
                        <span
                          className={`flex items-center gap-1 text-xs font-semibold ${driver.isOnline ? "text-emerald-600" : "text-gray-400"}`}
                        >
                          <div
                            className={`w-1.5 h-1.5 rounded-full ${driver.isOnline ? "bg-emerald-500 animate-pulse" : "bg-gray-300"}`}
                          />
                          {driver.isOnline ? "Online" : "Offline"}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        <span
                          className="flex items-center gap-1 text-xs"
                          style={{ color: "#9ba3af" }}
                        >
                          <Mail className="h-3 w-3" />
                          {driver.email}
                        </span>
                        <span
                          className="flex items-center gap-1 text-xs"
                          style={{ color: "#9ba3af" }}
                        >
                          <Phone className="h-3 w-3" />
                          {driver.phone}
                        </span>
                        <span
                          className="flex items-center gap-1 text-xs"
                          style={{ color: "#9ba3af" }}
                        >
                          <FileText className="h-3 w-3" />
                          {driver.licenseNumber}
                        </span>
                        <span
                          className="flex items-center gap-1 text-xs"
                          style={{ color: "#9ba3af" }}
                        >
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                          {driver.rating?.toFixed(1) ?? "N/A"} ·{" "}
                          {driver.totalDeliveries ?? 0} deliveries
                        </span>
                      </div>
                      {vehicle && (
                        <div
                          className="mt-2 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 border"
                          style={{
                            background: "#eff6ff",
                            borderColor: "#bfdbfe",
                          }}
                        >
                          <Car className="h-3 w-3 text-blue-600" />
                          <span className="text-xs font-semibold text-blue-700">
                            {vehicle.brand} {vehicle.model} ·{" "}
                            {vehicle.plateNumber}
                          </span>
                          <StatusBadge status={vehicle.status} />
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() =>
                          setExpandedId(isExpanded ? null : driver.id)
                        }
                        className="h-8 w-8 rounded-xl hover:bg-gray-100 flex items-center justify-center transition-colors"
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-gray-400" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-gray-400" />
                        )}
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="h-8 w-8 rounded-xl hover:bg-gray-100 flex items-center justify-center transition-colors">
                            <MoreHorizontal className="h-4 w-4 text-gray-400" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl">
                          <DropdownMenuItem
                            onClick={() => openEdit(driver)}
                            className="rounded-lg"
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {driver.status === "suspended" ? (
                            <DropdownMenuItem
                              onClick={() => openSuspendDialog(driver)}
                              className="text-green-700 rounded-lg"
                            >
                              <UserCheck className="mr-2 h-4 w-4" />
                              Unsuspend
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => openSuspendDialog(driver)}
                              className="text-amber-600 rounded-lg"
                            >
                              <Ban className="mr-2 h-4 w-4" />
                              Suspend
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDelete(driver.id)}
                            className="text-red-600 rounded-lg"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-5 pb-5 border-t border-[#f0f0f0] pt-4">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-1">
                        {[
                          {
                            icon: Calendar,
                            label: "Date of Birth",
                            value: driver.dateOfBirth,
                          },
                          { icon: User, label: "Gender", value: driver.gender },
                          {
                            icon: MapPin,
                            label: "Home Address",
                            value: driver.homeAddress,
                          },
                          {
                            icon: MapPin,
                            label: "State of Origin",
                            value: driver.stateOfOrigin,
                          },
                          {
                            icon: Shield,
                            label: "Nationality",
                            value: driver.nationality,
                          },
                          {
                            icon: Phone,
                            label: "Alternate Phone",
                            value: driver.alternatePhone,
                          },
                          {
                            icon: FileText,
                            label: "License Expiry",
                            value: driver.licenseExpiry,
                          },
                          {
                            icon: Car,
                            label: "Vehicle Expertise",
                            value: driver.vehicleTypeExpertise,
                          },
                          {
                            icon: Star,
                            label: "Yrs Experience",
                            value: driver.yearsOfExperience
                              ? `${driver.yearsOfExperience} yrs`
                              : undefined,
                          },
                          {
                            icon: Shield,
                            label: "Gov ID Type",
                            value: driver.governmentIdType?.replace(/_/g, " "),
                          },
                          {
                            icon: FileText,
                            label: "Gov ID Number",
                            value: driver.governmentIdNumber,
                          },
                        ]
                          .filter((r) => !!r.value)
                          .map((row) => (
                            <div
                              key={row.label}
                              className="rounded-xl p-3"
                              style={{ background: "#f9fafb" }}
                            >
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <row.icon
                                  className="h-3 w-3"
                                  style={{ color: "#9ba3af" }}
                                />
                                <span
                                  className="text-[10px] font-semibold uppercase tracking-wider"
                                  style={{ color: "#9ba3af" }}
                                >
                                  {row.label}
                                </span>
                              </div>
                              <p
                                className="text-sm font-semibold capitalize"
                                style={{ color: "#0f1117" }}
                              >
                                {row.value}
                              </p>
                            </div>
                          ))}
                      </div>
                      {vehicle && (
                        <div
                          className="mt-4 rounded-xl p-4 border"
                          style={{
                            background: "#eff6ff",
                            borderColor: "#bfdbfe",
                          }}
                        >
                          <p className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                            <Car className="h-3.5 w-3.5" /> Assigned Vehicle
                          </p>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {[
                              vehicle.imageFront,
                              vehicle.imageLeft,
                              vehicle.imageRight,
                              vehicle.imageBack,
                            ]
                              .filter(Boolean)
                              .map((img, i) => (
                                <img
                                  key={i}
                                  src={img!}
                                  alt=""
                                  className="h-20 w-full object-cover rounded-lg"
                                />
                              ))}
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-3">
                            {[
                              [
                                "Brand/Model",
                                `${vehicle.brand} ${vehicle.model}`,
                              ],
                              ["Plate", vehicle.plateNumber],
                              ["Type", vehicle.vehicleType],
                              ["Color", vehicle.color],
                              ["Year", vehicle.year],
                              ["Fuel", vehicle.fuelType],
                            ]
                              .filter(([, v]) => !!v)
                              .map(([k, v]) => (
                                <div
                                  key={k as string}
                                  className="bg-white rounded-lg p-2"
                                >
                                  <p className="text-[10px] text-gray-400 font-semibold uppercase">
                                    {k}
                                  </p>
                                  <p className="text-xs font-bold text-gray-800 capitalize">
                                    {String(v)}
                                  </p>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* Driver Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="rounded-2xl max-w-2xl max-h-[90vh] overflow-y-auto dash-font">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'Syne', sans-serif" }}>
              {editing ? "Edit Driver" : "Add Driver"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <DriverPhotoBox
                  value={form.passportPhotoUrl}
                  uploading={photoUploading}
                  onCapture={handlePhotoCapture}
                />
              </div>
              <div className="flex-1 grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <p
                    className="text-[10px] font-bold uppercase tracking-widest mb-2"
                    style={{ color: "#9ba3af" }}
                  >
                    Personal Information
                  </p>
                </div>
                {[
                  {
                    label: "Full Name *",
                    key: "name",
                    placeholder: "John Doe",
                  },
                  {
                    label: "Email *",
                    key: "email",
                    placeholder: "john@example.com",
                    type: "email",
                  },
                  {
                    label: "Phone *",
                    key: "phone",
                    placeholder: "+234 800 000 0000",
                  },
                  {
                    label: "Alternate Phone",
                    key: "alternatePhone",
                    placeholder: "+234 801 000 0000",
                  },
                ].map(({ label, key, placeholder, type }) => (
                  <div key={key}>
                    <Label
                      className="text-xs font-semibold mb-1.5 block"
                      style={{ color: "#5a6070" }}
                    >
                      {label}
                    </Label>
                    <input
                      type={type ?? "text"}
                      placeholder={placeholder}
                      value={(form as any)[key] ?? ""}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, [key]: e.target.value }))
                      }
                      className="dash-input w-full h-10 px-3 rounded-[10px] border border-[#e8eaed] bg-[#f9fafb] outline-none"
                      style={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: 16,
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label
                  className="text-xs font-semibold mb-1.5 block"
                  style={{ color: "#5a6070" }}
                >
                  Date of Birth
                </Label>
                <input
                  type="date"
                  value={form.dateOfBirth ?? ""}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, dateOfBirth: e.target.value }))
                  }
                  className="dash-input w-full h-10 px-3 rounded-[10px] border border-[#e8eaed] bg-[#f9fafb] outline-none"
                  style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 16 }}
                />
              </div>
              <div>
                <Label
                  className="text-xs font-semibold mb-1.5 block"
                  style={{ color: "#5a6070" }}
                >
                  Gender
                </Label>
                <Select
                  value={form.gender ?? ""}
                  onValueChange={(v) =>
                    setForm((p) => ({ ...p, gender: v as any }))
                  }
                >
                  <SelectTrigger className="h-10 rounded-[10px] border-[#e8eaed] text-sm">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label
                  className="text-xs font-semibold mb-1.5 block"
                  style={{ color: "#5a6070" }}
                >
                  Home Address
                </Label>
                <input
                  placeholder="123 Main Street, Lagos"
                  value={form.homeAddress ?? ""}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, homeAddress: e.target.value }))
                  }
                  className="dash-input w-full h-10 px-3 rounded-[10px] border border-[#e8eaed] bg-[#f9fafb] outline-none"
                  style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 16 }}
                />
              </div>
              <div>
                <Label
                  className="text-xs font-semibold mb-1.5 block"
                  style={{ color: "#5a6070" }}
                >
                  State of Origin
                </Label>
                <input
                  placeholder="Lagos"
                  value={form.stateOfOrigin ?? ""}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, stateOfOrigin: e.target.value }))
                  }
                  className="dash-input w-full h-10 px-3 rounded-[10px] border border-[#e8eaed] bg-[#f9fafb] outline-none"
                  style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 16 }}
                />
              </div>
              <div>
                <Label
                  className="text-xs font-semibold mb-1.5 block"
                  style={{ color: "#5a6070" }}
                >
                  Nationality
                </Label>
                <input
                  placeholder="Nigerian"
                  value={form.nationality ?? ""}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, nationality: e.target.value }))
                  }
                  className="dash-input w-full h-10 px-3 rounded-[10px] border border-[#e8eaed] bg-[#f9fafb] outline-none"
                  style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 16 }}
                />
              </div>
            </div>

            <div>
              <p
                className="text-[10px] font-bold uppercase tracking-widest mb-3"
                style={{ color: "#9ba3af" }}
              >
                Professional Details
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label
                    className="text-xs font-semibold mb-1.5 block"
                    style={{ color: "#5a6070" }}
                  >
                    License Number *
                  </Label>
                  <input
                    placeholder="DL-123456"
                    value={form.licenseNumber ?? ""}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, licenseNumber: e.target.value }))
                    }
                    className="dash-input w-full h-10 px-3 rounded-[10px] border border-[#e8eaed] bg-[#f9fafb] outline-none"
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 16,
                    }}
                  />
                </div>
                <div>
                  <Label
                    className="text-xs font-semibold mb-1.5 block"
                    style={{ color: "#5a6070" }}
                  >
                    License Expiry
                  </Label>
                  <input
                    type="date"
                    value={form.licenseExpiry ?? ""}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, licenseExpiry: e.target.value }))
                    }
                    className="dash-input w-full h-10 px-3 rounded-[10px] border border-[#e8eaed] bg-[#f9fafb] outline-none"
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 16,
                    }}
                  />
                </div>
                <div>
                  <Label
                    className="text-xs font-semibold mb-1.5 block"
                    style={{ color: "#5a6070" }}
                  >
                    Years of Experience
                  </Label>
                  <input
                    type="number"
                    placeholder="3"
                    value={form.yearsOfExperience ?? ""}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        yearsOfExperience: Number(e.target.value),
                      }))
                    }
                    className="dash-input w-full h-10 px-3 rounded-[10px] border border-[#e8eaed] bg-[#f9fafb] outline-none"
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 16,
                    }}
                  />
                </div>
                <div>
                  <Label
                    className="text-xs font-semibold mb-1.5 block"
                    style={{ color: "#5a6070" }}
                  >
                    Vehicle Type Expertise
                  </Label>
                  <Select
                    value={form.vehicleTypeExpertise ?? ""}
                    onValueChange={(v) =>
                      setForm((p) => ({ ...p, vehicleTypeExpertise: v }))
                    }
                  >
                    <SelectTrigger className="h-10 rounded-[10px] border-[#e8eaed] text-sm">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {["Bike", "Car", "Van", "Truck", "Pickup"].map((t) => (
                        <SelectItem key={t} value={t.toLowerCase()}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div>
              <p
                className="text-[10px] font-bold uppercase tracking-widest mb-3"
                style={{ color: "#9ba3af" }}
              >
                Government ID
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label
                    className="text-xs font-semibold mb-1.5 block"
                    style={{ color: "#5a6070" }}
                  >
                    ID Type
                  </Label>
                  <Select
                    value={form.governmentIdType ?? ""}
                    onValueChange={(v) =>
                      setForm((p) => ({ ...p, governmentIdType: v as any }))
                    }
                  >
                    <SelectTrigger className="h-10 rounded-[10px] border-[#e8eaed] text-sm">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="drivers_license">
                        Driver's License
                      </SelectItem>
                      <SelectItem value="national_id">National ID</SelectItem>
                      <SelectItem value="passport">Passport</SelectItem>
                      <SelectItem value="voters_card">Voter's Card</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label
                    className="text-xs font-semibold mb-1.5 block"
                    style={{ color: "#5a6070" }}
                  >
                    ID Number
                  </Label>
                  <input
                    placeholder="ID-000000"
                    value={form.governmentIdNumber ?? ""}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        governmentIdNumber: e.target.value,
                      }))
                    }
                    className="dash-input w-full h-10 px-3 rounded-[10px] border border-[#e8eaed] bg-[#f9fafb] outline-none"
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 16,
                    }}
                  />
                </div>
              </div>
            </div>

            <div>
              <Label
                className="text-xs font-semibold mb-1.5 block"
                style={{ color: "#5a6070" }}
              >
                Status
              </Label>
              <Select
                value={form.status ?? "active"}
                onValueChange={(v) =>
                  setForm((p) => ({ ...p, status: v as any }))
                }
              >
                <SelectTrigger className="h-10 rounded-[10px] border-[#e8eaed] text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowModal(false)}
              className="rounded-[10px]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={
                saving ||
                !form.name ||
                !form.email ||
                !form.phone ||
                !form.licenseNumber
              }
              className="rounded-[10px] gap-1.5"
              style={{
                background: "linear-gradient(135deg, #009C41 0%, #007A32 100%)",
              }}
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {editing ? "Save Changes" : "Add Driver"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Suspend / Unsuspend confirmation dialog */}
      <Dialog
        open={suspendConfirmOpen}
        onOpenChange={(open) => {
          if (!suspendLoading) {
            setSuspendConfirmOpen(open);
            if (!open) setSuspendTarget(null);
          }
        }}
      >
        <DialogContent className="rounded-2xl max-w-sm dash-font">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {suspendTarget?.status === "suspended" ? (
                <UserCheck className="h-5 w-5 text-green-600" />
              ) : (
                <Ban className="h-5 w-5 text-amber-500" />
              )}
              {suspendTarget?.status === "suspended"
                ? "Unsuspend driver?"
                : "Suspend driver?"}
            </DialogTitle>
          </DialogHeader>

          <div className="py-1 space-y-3">
            <p className="text-sm text-[var(--text-secondary)]">
              {suspendTarget?.status === "suspended" ? (
                <>
                  <span className="font-semibold text-[var(--text-primary)]">
                    {suspendTarget?.name}
                  </span>{" "}
                  will regain access to their driver dashboard immediately.
                </>
              ) : (
                <>
                  <span className="font-semibold text-[var(--text-primary)]">
                    {suspendTarget?.name}
                  </span>{" "}
                  will be blocked from accessing their driver dashboard until
                  unsuspended.
                </>
              )}
            </p>

            {/* Active delivery warning */}
            {suspendTarget &&
              suspendTarget.status !== "suspended" &&
              (() => {
                const active = deliveries.filter(
                  (d) =>
                    d.driverId === suspendTarget.id &&
                    (d.status === "assigned" || d.status === "in_progress"),
                );
                return active.length > 0 ? (
                  <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-3">
                    <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-amber-700 leading-relaxed">
                      This driver has{" "}
                      <span className="font-semibold">
                        {active.length} active{" "}
                        {active.length === 1 ? "delivery" : "deliveries"}
                      </span>
                      . Suspending now will leave{" "}
                      {active.length === 1 ? "it" : "them"} in progress without
                      a driver.
                    </p>
                  </div>
                ) : null;
              })()}
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setSuspendConfirmOpen(false);
                setSuspendTarget(null);
              }}
              disabled={suspendLoading}
              className="rounded-[10px]"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmSuspendAction}
              disabled={suspendLoading}
              className="rounded-[10px] gap-1.5"
              style={
                suspendTarget?.status === "suspended"
                  ? {
                      background:
                        "linear-gradient(135deg, #009C41 0%, #007A32 100%)",
                    }
                  : {
                      background:
                        "linear-gradient(135deg, #d97706 0%, #b45309 100%)",
                    }
              }
            >
              {suspendLoading && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              )}
              {suspendTarget?.status === "suspended"
                ? "Yes, unsuspend"
                : "Yes, suspend"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Tab: Driver Reports ──────────────────────────────────────────────────────
function DriverReportTab({
  drivers,
  history,
  workflowHistory,
  fleet,
  loading,
}: {
  drivers: Array<CompanyDriver & { id: string }>;
  history: Array<CompanyDelivery & { id: string }>;
  workflowHistory: CompanyWorkflowRequest[];
  fleet: Array<FleetVehicle & { id: string }>;
  loading: boolean;
}) {
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // requestId → driverId, fetched once from assignments collection
  const [assignmentMap, setAssignmentMap] = useState<Record<string, string>>(
    {},
  );

  const completedRequests = workflowHistory.filter(
    (r) => r.status === "completed",
  );
  const completedIds = completedRequests.map((r) => r.id);

  useEffect(() => {
    if (!completedIds.length) return;
    getAssignmentsByRequestIds(completedIds).then((assignments) => {
      const map: Record<string, string> = {};
      for (const a of assignments) {
        if (!map[a.requestId]) map[a.requestId] = a.driverId;
      }
      setAssignmentMap(map);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completedIds.join(",")]);

  // Pre-compute driverId → sorted delivery list
  const driverDeliveryMap = useMemo(() => {
    const tsToMs = (ts: unknown): number => {
      if (!ts) return 0;
      if ((ts as any)?.toDate) return (ts as any).toDate().getTime();
      if (typeof ts === "string" || ts instanceof Date)
        return new Date(ts as any).getTime();
      return 0;
    };

    const result: Record<string, Array<CompanyDelivery & { id: string }>> = {};

    for (const driver of drivers) {
      const legacy = history.filter(
        (h) =>
          h.driverId === driver.id || (driver.uid && h.driverId === driver.uid),
      );

      const workflow = completedRequests
        .filter((r) => {
          const aid = assignmentMap[r.id];
          return aid === driver.id || (driver.uid && aid === driver.uid);
        })
        .map((r) => ({
          id: `workflow_${r.id}`,
          companyId: (r as any).assignedCompanyId ?? "",
          bookingId: r.id,
          customerName:
            (r as any).deliveryName ??
            `Customer ${r.customerId?.slice(0, 6)?.toUpperCase?.() ?? ""}`,
          customerPhone: undefined,
          driverId: driver.id,
          driverName: driver.name,
          vehicleId: null,
          pickup: r.pickup?.address ?? "—",
          dropoff: r.dropoff?.address ?? "—",
          status: "completed" as const,
          itemDescription: r.itemDescription ?? undefined,
          itemWeight: r.itemWeight ?? undefined,
          finalPrice: ((r as any).finalPrice ??
            (r as any).negotiatedPrice ??
            (r as any).quotedPrice ??
            r.estimatedPrice ??
            null) as number | null,
          proofUrl:
            (r as any).proof?.url ?? (r as any).deliveryProofUrl ?? null,
          completedAt:
            (r as any).customerConfirmedDeliveryAt ??
            r.updatedAt ??
            r.createdAt,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        })) as Array<CompanyDelivery & { id: string }>;

      result[driver.id] = [...workflow, ...legacy].sort(
        (a, b) =>
          tsToMs(b.completedAt ?? b.createdAt) -
          tsToMs(a.completedAt ?? a.createdAt),
      );
    }

    return result;
  }, [drivers, history, completedRequests, assignmentMap]);

  const filtered = drivers.filter((d) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      d.name.toLowerCase().includes(q) ||
      d.email.toLowerCase().includes(q) ||
      d.phone.includes(q)
    );
  });

  return (
    <div className="space-y-5 dash-font">
      {/* Header */}
      <div>
        <h2
          className="text-xl font-bold"
          style={{ fontFamily: "'Syne', sans-serif", color: "#0f1117" }}
        >
          Driver Reports
        </h2>
        <p className="text-sm mt-0.5" style={{ color: "#9ba3af" }}>
          Delivery history per driver
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search drivers…"
          className="w-full pl-9 h-10 rounded-[10px] border border-[#e8eaed] bg-[#f9fafb] outline-none"
          style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 16 }}
        />
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={Truck}
            title="No drivers found"
            sub="Add drivers to see reports"
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((driver) => {
            const isExpanded = expandedId === driver.id;
            const deliveries = driverDeliveryMap[driver.id] ?? [];
            const totalRevenue = deliveries.reduce(
              (s, d) => s + (d.finalPrice ?? 0),
              0,
            );
            const vehicle =
              fleet.find((v) => v.id === driver.assignedVehicleId) ?? null;

            return (
              <Card
                key={driver.id}
                className="overflow-hidden transition-all duration-200"
              >
                {/* ── Driver info row ── */}
                <div className="flex items-start gap-4 p-4 lg:p-5">
                  {/* Avatar */}
                  <div className="flex-shrink-0">
                    {driver.passportPhotoUrl ? (
                      <img
                        src={driver.passportPhotoUrl}
                        alt={driver.name}
                        className="h-14 w-14 rounded-2xl object-cover border-2"
                        style={{ borderColor: "rgba(0,156,65,0.2)" }}
                      />
                    ) : (
                      <div
                        className="h-14 w-14 rounded-2xl flex items-center justify-center text-base font-bold"
                        style={{
                          background: "rgba(0,156,65,0.1)",
                          color: "#009C41",
                        }}
                      >
                        {getInitials(driver.name)}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3
                        className="font-bold text-[15px]"
                        style={{ color: "#0f1117" }}
                      >
                        {driver.name}
                      </h3>
                      <StatusBadge status={driver.status} />
                      <span
                        className={`flex items-center gap-1 text-xs font-semibold ${driver.isOnline ? "text-emerald-600" : "text-gray-400"}`}
                      >
                        <div
                          className={`w-1.5 h-1.5 rounded-full ${driver.isOnline ? "bg-emerald-500 animate-pulse" : "bg-gray-300"}`}
                        />
                        {driver.isOnline ? "Online" : "Offline"}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3">
                      <span
                        className="flex items-center gap-1 text-xs"
                        style={{ color: "#9ba3af" }}
                      >
                        <Mail className="h-3 w-3" />
                        {driver.email}
                      </span>
                      <span
                        className="flex items-center gap-1 text-xs"
                        style={{ color: "#9ba3af" }}
                      >
                        <Phone className="h-3 w-3" />
                        {driver.phone}
                      </span>
                      <span
                        className="flex items-center gap-1 text-xs"
                        style={{ color: "#9ba3af" }}
                      >
                        <FileText className="h-3 w-3" />
                        {driver.licenseNumber}
                      </span>
                      <span
                        className="flex items-center gap-1 text-xs"
                        style={{ color: "#9ba3af" }}
                      >
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                        {driver.rating?.toFixed(1) ?? "N/A"}
                      </span>
                    </div>

                    {/* Stats pills */}
                    <div className="flex flex-wrap gap-2">
                      <div
                        className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5"
                        style={{ background: "rgba(0,156,65,0.08)" }}
                      >
                        <Package className="h-3 w-3 text-emerald-700" />
                        <span className="text-xs font-bold text-emerald-700">
                          {deliveries.length} deliveries
                        </span>
                      </div>
                      <div
                        className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5"
                        style={{ background: "rgba(0,156,65,0.08)" }}
                      >
                        <DollarSign className="h-3 w-3 text-emerald-700" />
                        <span className="text-xs font-bold text-emerald-700">
                          ₦{totalRevenue.toLocaleString()}
                        </span>
                      </div>
                      {vehicle && (
                        <div
                          className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 border"
                          style={{
                            background: "#eff6ff",
                            borderColor: "#bfdbfe",
                          }}
                        >
                          <Car className="h-3 w-3 text-blue-600" />
                          <span className="text-xs font-semibold text-blue-700">
                            {vehicle.brand} {vehicle.model} ·{" "}
                            {vehicle.plateNumber}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Expand / collapse button */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : driver.id)}
                    className="flex-shrink-0 flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-semibold border border-[#e8eaed] bg-[#f9fafb] hover:bg-gray-100 transition-colors"
                    style={{ color: "#5a6070" }}
                  >
                    {isExpanded ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                    <span className="hidden sm:inline">
                      {isExpanded ? "Hide" : "Deliveries"}
                    </span>
                  </button>
                </div>

                {/* ── Expanded: delivery list ── */}
                {isExpanded && <DriverDeliveryPanel deliveries={deliveries} />}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Driver delivery panel (expanded section with filters) ────────────────────
function DriverDeliveryPanel({
  deliveries,
}: {
  deliveries: Array<CompanyDelivery & { id: string }>;
}) {
  const [filterSearch, setFilterSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [preset, setPreset] = useState("all");

  const PRESETS: {
    value: string;
    label: string;
    getDates: () => { from: string; to: string };
  }[] = [
    { value: "all", label: "All time", getDates: () => ({ from: "", to: "" }) },
    {
      value: "today",
      label: "Today",
      getDates: () => {
        const d = new Date();
        const s = d.toISOString().split("T")[0];
        return { from: s, to: s };
      },
    },
    {
      value: "yesterday",
      label: "Yesterday",
      getDates: () => {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        const s = d.toISOString().split("T")[0];
        return { from: s, to: s };
      },
    },
    {
      value: "week",
      label: "This week",
      getDates: () => {
        const d = new Date();
        const day = d.getDay();
        const mon = new Date(d);
        mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
        return {
          from: mon.toISOString().split("T")[0],
          to: d.toISOString().split("T")[0],
        };
      },
    },
    {
      value: "7days",
      label: "Last 7 days",
      getDates: () => {
        const to = new Date();
        const from = new Date();
        from.setDate(from.getDate() - 6);
        return {
          from: from.toISOString().split("T")[0],
          to: to.toISOString().split("T")[0],
        };
      },
    },
    {
      value: "month",
      label: "This month",
      getDates: () => {
        const d = new Date();
        const from = new Date(d.getFullYear(), d.getMonth(), 1);
        return {
          from: from.toISOString().split("T")[0],
          to: d.toISOString().split("T")[0],
        };
      },
    },
    {
      value: "30days",
      label: "Last 30 days",
      getDates: () => {
        const to = new Date();
        const from = new Date();
        from.setDate(from.getDate() - 29);
        return {
          from: from.toISOString().split("T")[0],
          to: to.toISOString().split("T")[0],
        };
      },
    },
    {
      value: "3months",
      label: "Last 3 months",
      getDates: () => {
        const to = new Date();
        const from = new Date();
        from.setMonth(from.getMonth() - 3);
        return {
          from: from.toISOString().split("T")[0],
          to: to.toISOString().split("T")[0],
        };
      },
    },
    {
      value: "6months",
      label: "Last 6 months",
      getDates: () => {
        const to = new Date();
        const from = new Date();
        from.setMonth(from.getMonth() - 6);
        return {
          from: from.toISOString().split("T")[0],
          to: to.toISOString().split("T")[0],
        };
      },
    },
    {
      value: "year",
      label: "This year",
      getDates: () => {
        const d = new Date();
        const from = new Date(d.getFullYear(), 0, 1);
        return {
          from: from.toISOString().split("T")[0],
          to: d.toISOString().split("T")[0],
        };
      },
    },
    {
      value: "custom",
      label: "Custom range",
      getDates: () => ({ from: dateFrom, to: dateTo }),
    },
  ];

  function handlePresetChange(value: string) {
    setPreset(value);
    if (value !== "custom") {
      const p = PRESETS.find((p) => p.value === value);
      if (p) {
        const { from, to } = p.getDates();
        setDateFrom(from);
        setDateTo(to);
      }
    }
  }

  function handleDateChange(field: "from" | "to", value: string) {
    if (field === "from") setDateFrom(value);
    else setDateTo(value);
    setPreset("custom");
  }

  const tsToMs = (ts: unknown): number => {
    if (!ts) return 0;
    if ((ts as any)?.toDate) return (ts as any).toDate().getTime();
    if (typeof ts === "string" || ts instanceof Date)
      return new Date(ts as any).getTime();
    return 0;
  };

  const visible = useMemo(() => {
    return deliveries.filter((d) => {
      if (filterSearch) {
        const q = filterSearch.toLowerCase();
        const orderId = d.id.replace("workflow_", "").slice(0, 8).toLowerCase();
        const matchesSearch =
          (d.customerName ?? "").toLowerCase().includes(q) ||
          orderId.includes(q) ||
          (d.pickup ?? "").toLowerCase().includes(q) ||
          (d.dropoff ?? "").toLowerCase().includes(q);
        if (!matchesSearch) return false;
      }
      const ts = tsToMs(d.completedAt ?? d.createdAt);
      if (dateFrom) {
        if (ts < new Date(dateFrom).getTime()) return false;
      }
      if (dateTo) {
        if (ts > new Date(dateTo).getTime() + 86_399_999) return false;
      }
      return true;
    });
  }, [deliveries, filterSearch, dateFrom, dateTo]);

  const filteredRevenue = visible.reduce((s, d) => s + (d.finalPrice ?? 0), 0);
  const isFiltered = preset !== "all" || !!filterSearch;
  const presetLabel =
    PRESETS.find((p) => p.value === preset)?.label ?? "All time";

  function clearFilters() {
    setFilterSearch("");
    setDateFrom("");
    setDateTo("");
    setPreset("all");
  }

  return (
    <div className="border-t border-[#f0f0f0]">
      {deliveries.length === 0 ? (
        <div className="py-10 text-center">
          <Package className="h-9 w-9 text-gray-200 mx-auto mb-2" />
          <p className="text-sm" style={{ color: "#9ba3af" }}>
            No deliveries recorded for this driver
          </p>
        </div>
      ) : (
        <div className="p-4 space-y-3">
          {/* ── Filter bar ── */}
          <div className="space-y-2">
            {/* Row 1: search + preset dropdown */}
            <div className="flex gap-2">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <input
                  value={filterSearch}
                  onChange={(e) => setFilterSearch(e.target.value)}
                  placeholder="Search by customer, order ID, or address…"
                  className="w-full pl-9 pr-3 h-9 rounded-[10px] border border-[#e8eaed] bg-[#f9fafb] outline-none text-sm"
                  style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14 }}
                />
              </div>
              <Select value={preset} onValueChange={handlePresetChange}>
                <SelectTrigger
                  className="w-36 h-9 rounded-[10px] border-[#e8eaed] text-xs bg-[#f9fafb] flex-shrink-0"
                  style={{ fontFamily: "'DM Sans', sans-serif" }}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {PRESETS.filter((p) => p.value !== "custom").map((p) => (
                    <SelectItem
                      key={p.value}
                      value={p.value}
                      className="text-xs"
                    >
                      {p.label}
                    </SelectItem>
                  ))}
                  {preset === "custom" && (
                    <SelectItem value="custom" className="text-xs">
                      Custom range
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Row 2: custom date range (shown when preset is custom or manually editing) */}
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => handleDateChange("from", e.target.value)}
                className="flex-1 h-9 px-2.5 rounded-[10px] border border-[#e8eaed] bg-[#f9fafb] outline-none min-w-0 text-sm"
                style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14 }}
              />
              <span
                className="text-xs flex-shrink-0"
                style={{ color: "#9ba3af" }}
              >
                to
              </span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => handleDateChange("to", e.target.value)}
                className="flex-1 h-9 px-2.5 rounded-[10px] border border-[#e8eaed] bg-[#f9fafb] outline-none min-w-0 text-sm"
                style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14 }}
              />
              {isFiltered && (
                <button
                  onClick={clearFilters}
                  className="flex-shrink-0 flex items-center gap-1 h-9 px-2.5 rounded-[10px] border border-[#e8eaed] bg-[#f9fafb] hover:bg-gray-100 transition-colors text-xs font-semibold"
                  style={{ color: "#5a6070" }}
                >
                  <X className="h-3 w-3" /> Clear
                </button>
              )}
            </div>
          </div>

          {/* ── Filtered summary bar ── */}
          <div
            className="flex items-center justify-between rounded-[10px] px-3 py-2.5"
            style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}
          >
            <span className="text-xs font-semibold text-emerald-700">
              {visible.length} deliver{visible.length === 1 ? "y" : "ies"}
              {isFiltered && (
                <span className="font-normal text-emerald-600">
                  {" "}
                  · {presetLabel}
                </span>
              )}
            </span>
            <span
              className="text-sm font-bold text-emerald-700"
              style={{ fontFamily: "'Syne', sans-serif" }}
            >
              ₦{filteredRevenue.toLocaleString()}
            </span>
          </div>

          {/* ── Delivery cards ── */}
          {visible.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-sm" style={{ color: "#9ba3af" }}>
                No deliveries match the current filters
              </p>
            </div>
          ) : (
            visible.map((delivery) => {
              const orderId = delivery.id.replace("workflow_", "");
              const isWorkflow = delivery.id.startsWith("workflow_");

              return (
                <div
                  key={delivery.id}
                  className="rounded-[12px] border border-[#e8eaed] overflow-hidden"
                  style={{ background: "#fafafa" }}
                >
                  <div className="p-3 space-y-2.5">
                    {/* Order header */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className="font-bold text-xs font-mono"
                            style={{ color: "#5a6070" }}
                          >
                            #{orderId.slice(0, 8).toUpperCase()}
                          </span>
                          <StatusBadge status={delivery.status} />
                          {isWorkflow && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              Platform
                            </span>
                          )}
                        </div>
                        <p
                          className="text-[11px] mt-0.5"
                          style={{ color: "#9ba3af" }}
                        >
                          {formatTs(delivery.completedAt ?? delivery.createdAt)}
                        </p>
                      </div>
                      <p
                        className="text-base font-bold text-emerald-600 whitespace-nowrap"
                        style={{ fontFamily: "'Syne', sans-serif" }}
                      >
                        ₦{Number(delivery.finalPrice ?? 0).toLocaleString()}
                      </p>
                    </div>

                    {/* Customer */}
                    {delivery.customerName && (
                      <div
                        className="flex items-center gap-2 rounded-lg px-2.5 py-2"
                        style={{ background: "#f0fdf4" }}
                      >
                        <User className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
                        <div className="min-w-0">
                          <p
                            className="text-xs font-semibold truncate"
                            style={{ color: "#0f1117" }}
                          >
                            {delivery.customerName}
                          </p>
                          {delivery.customerPhone && (
                            <p
                              className="text-[11px] truncate"
                              style={{ color: "#9ba3af" }}
                            >
                              {delivery.customerPhone}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Route */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      <div
                        className="rounded-lg px-2.5 py-2"
                        style={{
                          background: "#f0fdf4",
                          border: "1px solid #bbf7d0",
                        }}
                      >
                        <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider mb-0.5">
                          Pickup
                        </p>
                        <p
                          className="text-xs font-semibold leading-snug break-words"
                          style={{ color: "#0f1117" }}
                        >
                          {delivery.pickup}
                        </p>
                      </div>
                      <div
                        className="rounded-lg px-2.5 py-2"
                        style={{
                          background: "#fff5f5",
                          border: "1px solid #fecaca",
                        }}
                      >
                        <p className="text-[9px] font-bold text-red-500 uppercase tracking-wider mb-0.5">
                          Drop-off
                        </p>
                        <p
                          className="text-xs font-semibold leading-snug break-words"
                          style={{ color: "#0f1117" }}
                        >
                          {delivery.dropoff}
                        </p>
                      </div>
                    </div>

                    {/* Item details */}
                    {(delivery.itemDescription || delivery.itemWeight) && (
                      <div className="flex gap-2 flex-wrap">
                        {delivery.itemDescription && (
                          <span
                            className="inline-flex items-center gap-1 text-[11px] rounded-lg px-2 py-1"
                            style={{ background: "#f9fafb", color: "#5a6070" }}
                          >
                            <Package className="h-3 w-3" />
                            {delivery.itemDescription}
                          </span>
                        )}
                        {delivery.itemWeight && (
                          <span
                            className="inline-flex items-center gap-1 text-[11px] rounded-lg px-2 py-1"
                            style={{ background: "#f9fafb", color: "#5a6070" }}
                          >
                            {delivery.itemWeight}kg
                          </span>
                        )}
                      </div>
                    )}

                    {/* Proof image */}
                    {delivery.proofUrl && (
                      <div className="rounded-lg overflow-hidden border border-[#e8eaed]">
                        <div
                          className="flex items-center justify-between px-2.5 py-1.5"
                          style={{ background: "#f9fafb" }}
                        >
                          <p
                            className="text-[11px] font-semibold"
                            style={{ color: "#5a6070" }}
                          >
                            Delivery Proof
                          </p>
                          <a
                            href={delivery.proofUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[11px] font-semibold"
                            style={{ color: "#009C41" }}
                          >
                            View full size
                          </a>
                        </div>
                        <img
                          src={delivery.proofUrl}
                          alt="Delivery proof"
                          className="w-full max-h-48 object-cover"
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Fleet ───────────────────────────────────────────────────────────────
function FleetTab({
  companyId,
  fleet,
  drivers,
  loading,
}: {
  companyId: string;
  fleet: Array<FleetVehicle & { id: string }>;
  drivers: Array<CompanyDriver & { id: string }>;
  loading: boolean;
}) {
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<
    (FleetVehicle & { id: string }) | null
  >(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<FleetVehicle>>({});
  const [assignModal, setAssignModal] = useState<
    (FleetVehicle & { id: string }) | null
  >(null);
  const [selectedDriver, setSelectedDriver] = useState<string>("");
  const [assigning, setAssigning] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [imgUploading, setImgUploading] = useState<Record<string, boolean>>({});
  const [proximitySearch, setProximitySearch] = useState("");
  const [proximityResult, setProximityResult] = useState<{
    driver: CompanyDriver & { id: string };
    km: number;
  } | null>(null);
  const [proximityLoading, setProximityLoading] = useState(false);

  function openCreate() {
    setEditing(null);
    setForm({ status: "available", companyId });
    setShowModal(true);
  }
  function openEdit(v: FleetVehicle & { id: string }) {
    setEditing(v);
    setForm({ ...v });
    setShowModal(true);
  }

  async function handleImageUpload(key: keyof FleetVehicle, file: File) {
    setImgUploading((p) => ({ ...p, [key]: true }));
    try {
      const url = await uploadToCloudinary(file, "fleet/vehicles");
      setForm((p) => ({ ...p, [key]: url }));
    } catch {
      alert("Image upload failed.");
    } finally {
      setImgUploading((p) => ({ ...p, [key]: false }));
    }
  }

  async function handleSave() {
    if (
      !form.brand ||
      !form.plateNumber ||
      !form.vehicleType ||
      !form.color ||
      !form.year
    )
      return;
    setSaving(true);
    try {
      if (editing) {
        await updateFleetVehicle(editing.id, form);
      } else {
        await createFleetVehicle({
          companyId,
          brand: form.brand!,
          model: form.model ?? "",
          plateNumber: form.plateNumber!,
          vehicleType: form.vehicleType!,
          color: form.color!,
          year: form.year!,
          engineNumber: form.engineNumber,
          chassisNumber: form.chassisNumber,
          fuelType: form.fuelType,
          transmission: form.transmission,
          seatingCapacity: form.seatingCapacity,
          maxLoadKg: form.maxLoadKg,
          insuranceNumber: form.insuranceNumber,
          insuranceExpiry: form.insuranceExpiry,
          roadWorthinessExpiry: form.roadWorthinessExpiry,
          imageFront: form.imageFront ?? null,
          imageLeft: form.imageLeft ?? null,
          imageRight: form.imageRight ?? null,
          imageBack: form.imageBack ?? null,
          status: "available",
          assignedDriverId: null,
          assignedDriverName: null,
        });
      }
      setShowModal(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this vehicle?")) return;
    await deleteFleetVehicle(id);
  }

  async function handleAssign() {
    if (!assignModal) return;
    setAssigning(true);
    try {
      if (selectedDriver === "__unassign__") {
        await unassignDriverFromVehicle(
          assignModal.id,
          assignModal.assignedDriverId ?? null,
        );
      } else {
        const driver = drivers.find((d) => d.id === selectedDriver);
        if (driver)
          await assignDriverToVehicle(
            assignModal.id,
            driver.id,
            driver.name,
            assignModal,
          );
      }
      setAssignModal(null);
      setSelectedDriver("");
    } finally {
      setAssigning(false);
    }
  }

  async function handleProximitySearch() {
    if (!proximitySearch.trim()) return;
    setProximityLoading(true);
    setProximityResult(null);
    try {
      const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(proximitySearch)}&key=${apiKey}`,
      );
      const data = await res.json();
      const loc = data.results?.[0]?.geometry?.location;
      if (!loc) {
        alert("Address not found.");
        return;
      }
      const online = drivers.filter(
        (d) =>
          d.isOnline && d.currentLatitude != null && d.currentLongitude != null,
      );
      if (online.length === 0) {
        alert("No online drivers with GPS location.");
        return;
      }
      let closest: (typeof online)[0] | null = null;
      let minKm = Infinity;
      for (const d of online) {
        const km = haversineKm(
          loc.lat,
          loc.lng,
          d.currentLatitude!,
          d.currentLongitude!,
        );
        if (km < minKm) {
          minKm = km;
          closest = d;
        }
      }
      if (closest) setProximityResult({ driver: closest, km: minKm });
    } finally {
      setProximityLoading(false);
    }
  }

  return (
    <div className="space-y-5 dash-font">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2
            className="text-xl font-bold"
            style={{ fontFamily: "'Syne', sans-serif", color: "#0f1117" }}
          >
            Fleet
          </h2>
          <p className="text-sm mt-0.5" style={{ color: "#9ba3af" }}>
            {fleet.length} vehicles
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 h-10 px-4 rounded-[10px] text-sm font-semibold text-white transition-all active:scale-95"
          style={{
            background: "linear-gradient(135deg, #009C41 0%, #007A32 100%)",
            boxShadow: "0 2px 8px rgba(0,156,65,0.30)",
          }}
        >
          <Plus className="h-4 w-4" /> Add Vehicle
        </button>
      </div>

      {/* Proximity search */}
      <Card className="p-4">
        <p
          className="text-[10px] font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5"
          style={{ color: "#9ba3af" }}
        >
          <Search className="h-3.5 w-3.5" /> Find Closest Driver
        </p>
        <div className="flex gap-2">
          <input
            value={proximitySearch}
            onChange={(e) => setProximitySearch(e.target.value)}
            placeholder="Enter any address…"
            onKeyDown={(e) => e.key === "Enter" && handleProximitySearch()}
            className="dash-input flex-1 h-10 px-3 rounded-[10px] border border-[#e8eaed] bg-[#f9fafb] outline-none"
            style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 16 }}
          />
          <button
            onClick={handleProximitySearch}
            disabled={proximityLoading}
            className="flex items-center gap-1.5 h-10 px-4 rounded-[10px] text-sm font-semibold text-white transition-all active:scale-95"
            style={{ background: "#009C41" }}
          >
            {proximityLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            Search
          </button>
        </div>
        {proximityResult && (
          <div
            className="mt-3 flex items-center gap-3 rounded-xl p-3 border"
            style={{ background: "#f0fdf4", borderColor: "#86efac" }}
          >
            {proximityResult.driver.passportPhotoUrl ? (
              <img
                src={proximityResult.driver.passportPhotoUrl}
                alt=""
                className="h-10 w-10 rounded-xl object-cover flex-shrink-0"
              />
            ) : (
              <div
                className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-sm"
                style={{ background: "rgba(0,156,65,0.1)", color: "#009C41" }}
              >
                {getInitials(proximityResult.driver.name)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm" style={{ color: "#0f1117" }}>
                {proximityResult.driver.name}
              </p>
              <p className="text-xs" style={{ color: "#9ba3af" }}>
                {proximityResult.driver.phone}
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-sm font-bold text-emerald-700">
                {proximityResult.km.toFixed(1)} km
              </p>
              <p className="text-[10px] text-emerald-600">Closest</p>
            </div>
          </div>
        )}
      </Card>

      {loading ? (
        <LoadingSpinner />
      ) : fleet.length === 0 ? (
        <Card>
          <EmptyState
            icon={Car}
            title="No vehicles yet"
            sub="Add your first vehicle to get started"
          />
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {fleet.map((v) => {
            const isExpanded = expandedId === v.id;
            const assignedDriver = v.assignedDriverId
              ? drivers.find((d) => d.id === v.assignedDriverId)
              : null;
            const images = [
              v.imageFront,
              v.imageLeft,
              v.imageRight,
              v.imageBack,
            ].filter(Boolean) as string[];
            return (
              <Card
                key={v.id}
                className="overflow-hidden hover:border-[#009C41]/20 transition-all duration-200 card-in"
              >
                <div className="flex items-start gap-3 p-4 lg:p-5">
                  {/* Thumbnail */}
                  <div className="flex-shrink-0">
                    {images.length > 0 ? (
                      <img
                        src={images[0]}
                        alt="vehicle"
                        className="h-12 w-16 rounded-xl object-cover border border-[#e8eaed]"
                      />
                    ) : (
                      <div
                        className="h-12 w-16 rounded-xl flex items-center justify-center"
                        style={{ background: "rgba(0,156,65,0.08)" }}
                      >
                        <Car className="h-5 w-5" style={{ color: "#009C41" }} />
                      </div>
                    )}
                  </div>

                  {/* Info column — takes all remaining width */}
                  <div className="flex-1 min-w-0">
                    {/* Row 1: name + action buttons */}
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3
                        className="font-bold leading-snug truncate"
                        style={{ color: "#0f1117" }}
                      >
                        {v.brand} {v.model}
                      </h3>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() =>
                            setExpandedId(isExpanded ? null : v.id)
                          }
                          className="h-7 w-7 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors"
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-gray-400" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-gray-400" />
                          )}
                        </button>
                        <button
                          onClick={() => {
                            setAssignModal(v);
                            setSelectedDriver(v.assignedDriverId ?? "");
                          }}
                          className="h-7 px-2.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                          style={{
                            color: "#009C41",
                            background: "rgba(0,156,65,0.08)",
                          }}
                        >
                          <Link2 className="h-3 w-3" /> Assign
                        </button>
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
                            <DropdownMenuItem
                              onClick={() => openEdit(v)}
                              className="rounded-lg"
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDelete(v.id!)}
                              className="text-red-600 rounded-lg"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    {/* Row 2: plate + status */}
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span
                        className="font-mono text-xs font-bold bg-gray-100 px-2 py-0.5 rounded-lg whitespace-nowrap"
                        style={{ color: "#5a6070" }}
                      >
                        {v.plateNumber}
                      </span>
                      <StatusBadge status={v.status} />
                    </div>

                    {/* Row 3: meta */}
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mb-2">
                      <span
                        className="text-xs capitalize"
                        style={{ color: "#9ba3af" }}
                      >
                        {v.vehicleType}
                      </span>
                      {v.color && (
                        <span className="text-xs" style={{ color: "#9ba3af" }}>
                          {v.color}
                        </span>
                      )}
                      {v.year && (
                        <span className="text-xs" style={{ color: "#9ba3af" }}>
                          {v.year}
                        </span>
                      )}
                      {v.fuelType && (
                        <span
                          className="text-xs capitalize"
                          style={{ color: "#9ba3af" }}
                        >
                          {v.fuelType}
                        </span>
                      )}
                    </div>

                    {/* Row 4: assigned driver */}
                    {assignedDriver ? (
                      <div
                        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 border"
                        style={{
                          background: "#eff6ff",
                          borderColor: "#bfdbfe",
                        }}
                      >
                        {assignedDriver.passportPhotoUrl ? (
                          <img
                            src={assignedDriver.passportPhotoUrl}
                            alt=""
                            className="h-5 w-5 rounded-full object-cover flex-shrink-0"
                          />
                        ) : (
                          <div
                            className="h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0"
                            style={{
                              background: "rgba(0,156,65,0.2)",
                              color: "#009C41",
                            }}
                          >
                            {getInitials(assignedDriver.name)}
                          </div>
                        )}
                        <span className="text-xs font-semibold text-blue-700 truncate max-w-[100px]">
                          {assignedDriver.name}
                        </span>
                        <span
                          className={`flex items-center gap-1 text-[10px] font-semibold flex-shrink-0 ${assignedDriver.isOnline ? "text-emerald-600" : "text-gray-400"}`}
                        >
                          <div
                            className={`w-1.5 h-1.5 rounded-full ${assignedDriver.isOnline ? "bg-emerald-500" : "bg-gray-300"}`}
                          />
                          {assignedDriver.isOnline ? "Online" : "Offline"}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs" style={{ color: "#9ba3af" }}>
                        No driver assigned
                      </span>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-5 pb-5 border-t border-[#f0f0f0] pt-4">
                    {images.length > 0 && (
                      <div className="grid grid-cols-4 gap-2 mb-4">
                        {[
                          v.imageFront,
                          v.imageLeft,
                          v.imageRight,
                          v.imageBack,
                        ].map((img, i) =>
                          img ? (
                            <div key={i} className="relative">
                              <img
                                src={img}
                                alt={["Front", "Left", "Right", "Back"][i]}
                                className="h-20 w-full object-cover rounded-xl border border-[#e8eaed]"
                              />
                              <span className="absolute bottom-1 left-1 bg-black/50 text-white text-[9px] rounded px-1">
                                {["Front", "Left", "Right", "Back"][i]}
                              </span>
                            </div>
                          ) : null,
                        )}
                      </div>
                    )}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {[
                        ["Engine No.", v.engineNumber],
                        ["Chassis No.", v.chassisNumber],
                        ["Transmission", v.transmission],
                        [
                          "Seating Cap.",
                          v.seatingCapacity
                            ? `${v.seatingCapacity} Seats`
                            : null,
                        ],
                        ["Max Load", v.maxLoadKg ? `${v.maxLoadKg} Kg` : null],
                        ["Insurance No.", v.insuranceNumber],
                        ["Ins. Expiry", v.insuranceExpiry],
                        ["Roadworthy", v.roadWorthinessExpiry],
                      ]
                        .filter(([, val]) => !!val)
                        .map(([k, val]) => (
                          <div
                            key={k as string}
                            className="rounded-xl p-3 border-l-[3px] flex flex-col gap-0.5"
                            style={{
                              background: "#f9fafb",
                              borderColor: "rgba(0,156,65,0.25)",
                            }}
                          >
                            <p
                              className="text-[10px] font-bold uppercase tracking-wider"
                              style={{ color: "#9ba3af" }}
                            >
                              {k}
                            </p>
                            <p
                              className="text-sm font-semibold"
                              style={{ color: "#0f1117" }}
                            >
                              {String(val)}
                            </p>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Vehicle Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="rounded-2xl max-w-2xl max-h-[90vh] overflow-y-auto dash-font">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'Syne', sans-serif" }}>
              {editing ? "Edit Vehicle" : "Add Vehicle"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div>
              <p
                className="text-[10px] font-bold uppercase tracking-widest mb-3"
                style={{ color: "#9ba3af" }}
              >
                Vehicle Details
              </p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Brand *", key: "brand", placeholder: "Toyota" },
                  { label: "Model *", key: "model", placeholder: "Hilux" },
                  {
                    label: "Plate Number *",
                    key: "plateNumber",
                    placeholder: "ABC-123-XY",
                  },
                  { label: "Color *", key: "color", placeholder: "White" },
                  {
                    label: "Engine Number",
                    key: "engineNumber",
                    placeholder: "ENG-0000000",
                  },
                  {
                    label: "Chassis Number",
                    key: "chassisNumber",
                    placeholder: "CHA-0000000",
                  },
                ].map(({ label, key, placeholder }) => (
                  <div key={key}>
                    <Label
                      className="text-xs font-semibold mb-1.5 block"
                      style={{ color: "#5a6070" }}
                    >
                      {label}
                    </Label>
                    <input
                      placeholder={placeholder}
                      value={(form as any)[key] ?? ""}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, [key]: e.target.value }))
                      }
                      className="dash-input w-full h-10 px-3 rounded-[10px] border border-[#e8eaed] bg-[#f9fafb] outline-none"
                      style={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: 16,
                      }}
                    />
                  </div>
                ))}
                <div>
                  <Label
                    className="text-xs font-semibold mb-1.5 block"
                    style={{ color: "#5a6070" }}
                  >
                    Vehicle Type *
                  </Label>
                  <Select
                    value={form.vehicleType ?? ""}
                    onValueChange={(v) =>
                      setForm((p) => ({ ...p, vehicleType: v }))
                    }
                  >
                    <SelectTrigger className="h-10 rounded-[10px] border-[#e8eaed] text-sm">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {["Bike", "Car", "Van", "Truck", "Pickup"].map((t) => (
                        <SelectItem key={t} value={t.toLowerCase()}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label
                    className="text-xs font-semibold mb-1.5 block"
                    style={{ color: "#5a6070" }}
                  >
                    Year *
                  </Label>
                  <input
                    type="number"
                    placeholder="2024"
                    value={form.year ?? ""}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, year: Number(e.target.value) }))
                    }
                    className="dash-input w-full h-10 px-3 rounded-[10px] border border-[#e8eaed] bg-[#f9fafb] outline-none"
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 16,
                    }}
                  />
                </div>
                <div>
                  <Label
                    className="text-xs font-semibold mb-1.5 block"
                    style={{ color: "#5a6070" }}
                  >
                    Fuel Type
                  </Label>
                  <Select
                    value={form.fuelType ?? ""}
                    onValueChange={(v) =>
                      setForm((p) => ({ ...p, fuelType: v as any }))
                    }
                  >
                    <SelectTrigger className="h-10 rounded-[10px] border-[#e8eaed] text-sm">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {["Petrol", "Diesel", "Electric", "Hybrid", "Gas"].map(
                        (t) => (
                          <SelectItem key={t} value={t.toLowerCase()}>
                            {t}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label
                    className="text-xs font-semibold mb-1.5 block"
                    style={{ color: "#5a6070" }}
                  >
                    Transmission
                  </Label>
                  <Select
                    value={form.transmission ?? ""}
                    onValueChange={(v) =>
                      setForm((p) => ({ ...p, transmission: v as any }))
                    }
                  >
                    <SelectTrigger className="h-10 rounded-[10px] border-[#e8eaed] text-sm">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="manual">Manual</SelectItem>
                      <SelectItem value="automatic">Automatic</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label
                    className="text-xs font-semibold mb-1.5 block"
                    style={{ color: "#5a6070" }}
                  >
                    Seating Capacity
                  </Label>
                  <input
                    type="number"
                    placeholder="5"
                    value={form.seatingCapacity ?? ""}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        seatingCapacity: Number(e.target.value),
                      }))
                    }
                    className="dash-input w-full h-10 px-3 rounded-[10px] border border-[#e8eaed] bg-[#f9fafb] outline-none"
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 16,
                    }}
                  />
                </div>
                <div>
                  <Label
                    className="text-xs font-semibold mb-1.5 block"
                    style={{ color: "#5a6070" }}
                  >
                    Max Load (kg)
                  </Label>
                  <input
                    type="number"
                    placeholder="500"
                    value={form.maxLoadKg ?? ""}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        maxLoadKg: Number(e.target.value),
                      }))
                    }
                    className="dash-input w-full h-10 px-3 rounded-[10px] border border-[#e8eaed] bg-[#f9fafb] outline-none"
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 16,
                    }}
                  />
                </div>
              </div>
            </div>
            <div>
              <p
                className="text-[10px] font-bold uppercase tracking-widest mb-3"
                style={{ color: "#9ba3af" }}
              >
                Documents
              </p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    label: "Insurance No.",
                    key: "insuranceNumber",
                    placeholder: "INS-0000",
                  },
                  {
                    label: "Insurance Expiry",
                    key: "insuranceExpiry",
                    placeholder: "",
                    type: "date",
                  },
                  {
                    label: "Roadworthiness Expiry",
                    key: "roadWorthinessExpiry",
                    placeholder: "",
                    type: "date",
                  },
                ].map(({ label, key, placeholder, type }) => (
                  <div key={key}>
                    <Label
                      className="text-xs font-semibold mb-1.5 block"
                      style={{ color: "#5a6070" }}
                    >
                      {label}
                    </Label>
                    <input
                      type={type ?? "text"}
                      placeholder={placeholder}
                      value={(form as any)[key] ?? ""}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, [key]: e.target.value }))
                      }
                      className="dash-input w-full h-10 px-3 rounded-[10px] border border-[#e8eaed] bg-[#f9fafb] outline-none"
                      style={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: 16,
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p
                className="text-[10px] font-bold uppercase tracking-widest mb-3"
                style={{ color: "#9ba3af" }}
              >
                Vehicle Photos
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {(
                  [
                    { label: "Front", key: "imageFront" },
                    { label: "Left", key: "imageLeft" },
                    { label: "Right", key: "imageRight" },
                    { label: "Back", key: "imageBack" },
                  ] as { label: string; key: keyof FleetVehicle }[]
                ).map(({ label, key }) => (
                  <FleetImageBox
                    key={key}
                    label={label}
                    value={(form as any)[key]}
                    uploading={imgUploading[key]}
                    onChange={(file) => handleImageUpload(key, file)}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowModal(false)}
              className="rounded-[10px]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={
                saving ||
                !form.brand ||
                !form.plateNumber ||
                !form.vehicleType ||
                !form.color ||
                !form.year
              }
              className="rounded-[10px] gap-1.5"
              style={{
                background: "linear-gradient(135deg, #009C41 0%, #007A32 100%)",
              }}
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {editing ? "Save Changes" : "Add Vehicle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Driver Modal */}
      <Dialog
        open={!!assignModal}
        onOpenChange={() => {
          setAssignModal(null);
          setSelectedDriver("");
        }}
      >
        <DialogContent className="rounded-2xl max-w-sm dash-font">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'Syne', sans-serif" }}>
              Assign Driver
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <p className="text-sm mb-3" style={{ color: "#9ba3af" }}>
              {assignModal?.brand} {assignModal?.model} ·{" "}
              {assignModal?.plateNumber}
            </p>
            <Select value={selectedDriver} onValueChange={setSelectedDriver}>
              <SelectTrigger className="h-10 rounded-[10px] border-[#e8eaed] text-sm">
                <SelectValue placeholder="Select a driver" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="__unassign__">
                  <span className="flex items-center gap-2 text-gray-400">
                    <Link2Off className="h-3.5 w-3.5" />
                    Unassign driver
                  </span>
                </SelectItem>
                {drivers
                  .filter((d) => d.status === "active")
                  .map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      <span className="flex items-center gap-2">
                        <span
                          className={`w-1.5 h-1.5 rounded-full inline-block ${d.isOnline ? "bg-emerald-500" : "bg-gray-300"}`}
                        />
                        {d.name}
                        {d.assignedVehicleId &&
                        d.assignedVehicleId !== assignModal?.id ? (
                          <span className="text-xs text-amber-600 ml-1">
                            (has vehicle)
                          </span>
                        ) : null}
                      </span>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAssignModal(null)}
              className="rounded-[10px]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAssign}
              disabled={assigning || !selectedDriver}
              className="rounded-[10px] gap-1.5"
              style={{
                background: "linear-gradient(135deg, #009C41 0%, #007A32 100%)",
              }}
            >
              {assigning && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Tab: Deliveries ──────────────────────────────────────────────────────────
function DeliveriesTab({
  companyId,
  deliveries,
  drivers,
  fleet,
  loading,
  workflowRequests = [],
}: {
  companyId: string;
  deliveries: Array<CompanyDelivery & { id: string }>;
  drivers: Array<CompanyDriver & { id: string }>;
  fleet: Array<FleetVehicle & { id: string }>;
  loading: boolean;
  workflowRequests?: CompanyWorkflowRequest[];
}) {
  const [filterStatus, setFilterStatus] = useState("all");
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setDate(new Date().getDate() - 30)),
    end: new Date(),
  });
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<
    (CompanyDelivery & { id: string }) | null
  >(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<CompanyDelivery>>({});
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const toggleExpand = (id: string) =>
    setExpandedCards((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const workflowMap = useMemo(() => {
    const m = new Map<string, CompanyWorkflowRequest>();
    workflowRequests.forEach((r) => m.set(`workflow_${r.id}`, r));
    return m;
  }, [workflowRequests]);

  // requestId → driver record for active workflow deliveries
  const [workflowAssignmentMap, setWorkflowAssignmentMap] = useState<
    Record<string, (CompanyDriver & { id: string }) | null>
  >({});
  const activeWorkflowIds = workflowRequests.map((r) => r.id);
  useEffect(() => {
    if (!activeWorkflowIds.length || !drivers.length) return;
    getAssignmentsByRequestIds(activeWorkflowIds).then((assignments) => {
      const map: Record<string, (CompanyDriver & { id: string }) | null> = {};
      for (const a of assignments) {
        if (map[a.requestId] !== undefined) continue;
        const driver =
          drivers.find((d) => d.id === a.driverId || d.uid === a.driverId) ??
          null;
        map[a.requestId] = driver;
      }
      setWorkflowAssignmentMap(map);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWorkflowIds.join(","), drivers]);

  const trackedWorkflow = workflowRequests
    .filter((r) =>
      [
        "driver_assigned",
        "driver_accepted",
        "in_progress",
        "arrived",
        "awaiting_signature",
      ].includes(r.status),
    )
    .map((r) => ({
      id: `workflow_${r.id}`,
      companyId,
      bookingId: r.id,
      customerName:
        (r as any).deliveryName ??
        `Customer ${r.customerId?.slice(0, 6)?.toUpperCase?.() ?? ""}`,
      customerPhone: undefined,
      driverId: null,
      driverName: undefined,
      vehicleId: null,
      pickup: r.pickup?.address ?? "—",
      dropoff: r.dropoff?.address ?? "—",
      status: r.status as CompanyDelivery["status"],
      itemDescription: r.itemDescription ?? undefined,
      itemWeight: r.itemWeight ?? undefined,
      finalPrice: ((r as any).finalPrice ??
        (r as any).negotiatedPrice ??
        (r as any).quotedPrice ??
        r.estimatedPrice ??
        null) as number | null,
      proofUrl: (r as any).proof?.url ?? (r as any).deliveryProofUrl ?? null,
      completedAt: undefined,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })) as Array<CompanyDelivery & { id: string }>;

  const allRows = [...trackedWorkflow, ...deliveries];
  const inDateRange = (value: unknown) => {
    const date =
      (value as any)?.toDate?.() ??
      (typeof value === "string" || value instanceof Date
        ? new Date(value)
        : null);
    if (!date || Number.isNaN(date.getTime())) return true;
    return (
      date >= dateRange.start &&
      date <= new Date(dateRange.end.getTime() + 86_399_999)
    );
  };
  const filtered = allRows
    .filter((d) => (filterStatus === "all" ? true : d.status === filterStatus))
    .filter((d) => inDateRange(d.createdAt));

  const handleExport = () => {
    const rows = filtered.map((d) => ({
      id: d.id,
      customer: d.customerName ?? "",
      pickup: d.pickup ?? "",
      dropoff: d.dropoff ?? "",
      status: d.status ?? "",
      driver: d.driverName ?? "",
      price: d.finalPrice ?? "",
      createdAt: formatTs(d.createdAt),
    }));
    const header = [
      "ID",
      "Customer",
      "Pickup",
      "Dropoff",
      "Status",
      "Driver",
      "Price",
      "Created At",
    ];
    const body = rows.map((r) =>
      [
        r.id,
        r.customer,
        r.pickup,
        r.dropoff,
        r.status,
        r.driver,
        r.price,
        r.createdAt,
      ]
        .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
        .join(","),
    );
    const csv = [header.join(","), ...body].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `deliveries-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported");
  };

  function openCreate() {
    setEditing(null);
    setForm({ status: "pending", companyId });
    setShowModal(true);
  }
  function openEdit(d: CompanyDelivery & { id: string }) {
    setEditing(d);
    setForm({ ...d });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.customerName || !form.pickup || !form.dropoff) return;
    setSaving(true);
    try {
      if (editing) {
        const isCompleting =
          form.status === "completed" && editing.status !== "completed";
        await updateDelivery(editing.id!, {
          ...form,
          ...(isCompleting ? { completedAt: new Date() } : {}),
        });
      } else {
        await createDelivery({
          companyId,
          customerName: form.customerName!,
          customerPhone: form.customerPhone,
          customerEmail: form.customerEmail,
          driverId: form.driverId ?? null,
          driverName: form.driverName ?? null,
          vehicleId: null,
          pickup: form.pickup!,
          dropoff: form.dropoff!,
          status: "pending",
          itemDescription: form.itemDescription,
          itemWeight: form.itemWeight,
          finalPrice: form.finalPrice ?? null,
          paymentProofUrl: form.paymentProofUrl ?? null,
          bookingId: null,
        });
      }
      setShowModal(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete?")) return;
    await deleteDelivery(id);
  }
  async function quickStatus(id: string, status: CompanyDelivery["status"]) {
    await updateDelivery(id, {
      status,
      ...(status === "completed" ? { completedAt: new Date() } : {}),
    });
  }

  return (
    <div className="space-y-5 dash-font">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <h2
            className="text-xl font-bold"
            style={{ fontFamily: "'Syne', sans-serif", color: "#0f1117" }}
          >
            Deliveries
          </h2>
          <p className="text-sm mt-0.5" style={{ color: "#9ba3af" }}>
            {filtered.length} deliveries
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 h-10 px-4 rounded-[10px] text-sm font-semibold text-white transition-all active:scale-95"
          style={{
            background: "linear-gradient(135deg, #009C41 0%, #007A32 100%)",
            boxShadow: "0 2px 8px rgba(0,156,65,0.30)",
          }}
        >
          <Plus className="h-4 w-4" /> New Delivery
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="flex-1 min-w-[160px] h-10 rounded-[10px] border-[#e8eaed] text-sm bg-[#f9fafb]">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">All statuses</SelectItem>
              {[
                "pending",
                "assigned",
                "driver_assigned",
                "driver_accepted",
                "in_progress",
                "arrived",
                "awaiting_signature",
                "completed",
                "cancelled",
              ].map((s) => (
                <SelectItem key={s} value={s} className="capitalize">
                  {s.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 h-10 px-3 rounded-[10px] text-sm font-semibold border border-[#e8eaed] bg-[#f9fafb] transition-colors hover:bg-gray-100"
            style={{ color: "#5a6070" }}
          >
            <Download className="h-4 w-4" /> Export
          </button>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dateRange.start.toISOString().split("T")[0]}
            onChange={(e) =>
              setDateRange((p) => ({ ...p, start: new Date(e.target.value) }))
            }
            className="dash-input flex-1 h-10 px-3 rounded-[10px] border border-[#e8eaed] bg-[#f9fafb] outline-none min-w-0"
            style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 16 }}
          />
          <span className="text-xs flex-shrink-0" style={{ color: "#9ba3af" }}>
            to
          </span>
          <input
            type="date"
            value={dateRange.end.toISOString().split("T")[0]}
            onChange={(e) =>
              setDateRange((p) => ({ ...p, end: new Date(e.target.value) }))
            }
            className="dash-input flex-1 h-10 px-3 rounded-[10px] border border-[#e8eaed] bg-[#f9fafb] outline-none min-w-0"
            style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 16 }}
          />
        </div>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <Card className="py-16 text-center">
              <Package className="h-10 w-10 text-gray-200 mx-auto mb-3" />
              <p className="text-sm" style={{ color: "#9ba3af" }}>
                No deliveries found
              </p>
            </Card>
          ) : (
            filtered.map((d) => {
              const isWorkflowRow = d.id.startsWith("workflow_");
              const isExpanded = expandedCards.has(d.id);
              const wReq = isWorkflowRow ? workflowMap.get(d.id) : undefined;
              const assignedDriver = d.driverId
                ? (drivers.find((dr) => dr.id === d.driverId) ?? null)
                : isWorkflowRow && wReq
                ? (workflowAssignmentMap[wReq.id] ?? null)
                : null;
              const assignedVehicle =
                assignedDriver?.assignedVehicleId
                  ? fleet.find((v) => v.id === assignedDriver.assignedVehicleId) ?? null
                  : null;
              const driverPhone = assignedDriver?.phone ?? null;
              const vehicleLabel =
                assignedVehicle
                  ? `${assignedVehicle.brand} ${assignedVehicle.model} · ${assignedVehicle.plateNumber}`
                  : assignedDriver?.assignedVehicleBrand && assignedDriver?.assignedVehiclePlate
                  ? `${assignedDriver.assignedVehicleBrand} · ${assignedDriver.assignedVehiclePlate}`
                  : null;

              const hasItemInfo = !!(
                d.itemDescription ||
                d.itemWeight ||
                wReq?.itemSize ||
                wReq?.packagePhotoUrl
              );
              const hasDriverInfo = !!(
                d.driverName ||
                assignedDriver
              );
              const hasCustomerPhone = !!(
                d.customerPhone ||
                (wReq as any)?.customerPhone
              );
              const customerPhone =
                d.customerPhone ?? (wReq as any)?.customerPhone ?? null;
              const customerEmail = d.customerEmail ?? null;
              const paymentProofUrl =
                d.paymentProofUrl ??
                (isWorkflowRow ? (wReq?.paymentProofUrl ?? null) : null);

              return (
                <Card
                  key={d.id}
                  className={`overflow-hidden transition-all card-in hover:border-[#009C41]/20 ${isWorkflowRow ? "border-indigo-100" : ""}`}
                >
                  <div className="p-4 lg:p-5 space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${d.status === "completed" ? "bg-emerald-50" : d.status === "cancelled" ? "bg-red-50" : "bg-blue-50"}`}
                        >
                          <Package
                            className={`h-5 w-5 ${d.status === "completed" ? "text-emerald-600" : d.status === "cancelled" ? "text-red-500" : "text-blue-600"}`}
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className="font-bold text-sm font-mono"
                              style={{ color: "#0f1117" }}
                            >
                              #{d.id.replace("workflow_", "").slice(0, 8).toUpperCase()}
                            </span>
                            <StatusBadge status={d.status} />
                          </div>
                          <p className="text-xs mt-0.5" style={{ color: "#9ba3af" }}>
                            {formatTs(d.createdAt)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-lg font-bold" style={{ color: "#009C41" }}>
                          ₦{Number(d.finalPrice ?? 0).toLocaleString()}
                        </p>
                        {isWorkflowRow && (
                          <p className="text-[10px] text-indigo-600 font-semibold">
                            Company workflow
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Addresses */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div
                        className="rounded-xl p-3"
                        style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}
                      >
                        <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-0.5">
                          Pickup
                        </p>
                        <p className="text-sm font-semibold leading-snug break-words" style={{ color: "#0f1117" }}>
                          {d.pickup}
                        </p>
                      </div>
                      <div
                        className="rounded-xl p-3"
                        style={{ background: "#fff5f5", border: "1px solid #fecaca" }}
                      >
                        <p className="text-[10px] font-bold text-red-500 uppercase tracking-wider mb-0.5">
                          Drop-off
                        </p>
                        <p className="text-sm font-semibold leading-snug break-words" style={{ color: "#0f1117" }}>
                          {d.dropoff}
                        </p>
                      </div>
                    </div>

                    {/* Details toggle */}
                    <button
                      onClick={() => toggleExpand(d.id)}
                      className="flex items-center gap-1.5 text-xs font-semibold transition-colors"
                      style={{ color: isExpanded ? "#009C41" : "#5a6070" }}
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )}
                      {isExpanded ? "Hide details" : "Show details"}
                    </button>

                    {/* Collapsible details */}
                    {isExpanded && (
                      <div
                        className="space-y-3 pt-3"
                        style={{ borderTop: "1px solid #f0f0f0" }}
                      >
                        {/* Customer */}
                        <div className="rounded-xl p-3 space-y-1.5" style={{ background: "#f9fafb", border: "1px solid #e8eaed" }}>
                          <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#5a6070" }}>
                            Customer
                          </p>
                          <div className="flex items-center gap-2">
                            <User className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "#9ba3af" }} />
                            <span className="text-sm font-semibold" style={{ color: "#0f1117" }}>
                              {d.customerName || "—"}
                            </span>
                          </div>
                          {hasCustomerPhone && (
                            <div className="flex items-center gap-2">
                              <Phone className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "#9ba3af" }} />
                              <span className="text-sm" style={{ color: "#5a6070" }}>
                                {customerPhone}
                              </span>
                            </div>
                          )}
                          {customerEmail && (
                            <div className="flex items-center gap-2">
                              <Mail className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "#9ba3af" }} />
                              <span className="text-sm" style={{ color: "#5a6070" }}>
                                {customerEmail}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Package / Item */}
                        {hasItemInfo && (
                          <div className="rounded-xl p-3 space-y-1.5" style={{ background: "#f9fafb", border: "1px solid #e8eaed" }}>
                            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#5a6070" }}>
                              Package
                            </p>
                            {d.itemDescription && (
                              <div className="flex items-start gap-2">
                                <FileText className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" style={{ color: "#9ba3af" }} />
                                <span className="text-sm" style={{ color: "#0f1117" }}>
                                  {d.itemDescription}
                                </span>
                              </div>
                            )}
                            {d.itemWeight && (
                              <div className="flex items-center gap-2">
                                <Package className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "#9ba3af" }} />
                                <span className="text-sm" style={{ color: "#5a6070" }}>
                                  Weight: {d.itemWeight}
                                </span>
                              </div>
                            )}
                            {wReq?.itemSize && (
                              <div className="flex items-center gap-2">
                                <Package className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "#9ba3af" }} />
                                <span className="text-sm" style={{ color: "#5a6070" }}>
                                  Size: {wReq.itemSize}
                                </span>
                              </div>
                            )}
                            {wReq?.packagePhotoUrl && (
                              <div className="rounded-lg overflow-hidden border border-[#e8eaed] mt-1">
                                <div className="px-3 py-1.5 bg-gray-50 flex items-center justify-between">
                                  <p className="text-xs font-semibold" style={{ color: "#5a6070" }}>Package Photo</p>
                                  <a href={wReq.packagePhotoUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold" style={{ color: "#009C41" }}>
                                    Open full size
                                  </a>
                                </div>
                                <img src={wReq.packagePhotoUrl} alt="Package" className="w-full max-h-40 object-cover" />
                              </div>
                            )}
                          </div>
                        )}

                        {/* Driver */}
                        {hasDriverInfo && (
                          <div className="rounded-xl p-3 space-y-1.5" style={{ background: "#f9fafb", border: "1px solid #e8eaed" }}>
                            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#5a6070" }}>
                              Driver
                            </p>
                            <div className="flex items-center gap-2">
                              <User className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "#9ba3af" }} />
                              <span className="text-sm font-semibold" style={{ color: "#0f1117" }}>
                                {assignedDriver?.name ?? d.driverName ?? "—"}
                              </span>
                              {assignedDriver && (
                                <span
                                  className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${assignedDriver.isOnline ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}
                                >
                                  {assignedDriver.isOnline ? "Online" : "Offline"}
                                </span>
                              )}
                            </div>
                            {driverPhone && (
                              <div className="flex items-center gap-2">
                                <Phone className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "#9ba3af" }} />
                                <span className="text-sm" style={{ color: "#5a6070" }}>
                                  {driverPhone}
                                </span>
                              </div>
                            )}
                            {assignedDriver?.email && (
                              <div className="flex items-center gap-2">
                                <Mail className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "#9ba3af" }} />
                                <span className="text-sm" style={{ color: "#5a6070" }}>
                                  {assignedDriver.email}
                                </span>
                              </div>
                            )}
                            {!!assignedDriver?.rating && (
                              <div className="flex items-center gap-2">
                                <Star className="h-3.5 w-3.5 flex-shrink-0 text-amber-400" />
                                <span className="text-sm" style={{ color: "#5a6070" }}>
                                  {Number(assignedDriver.rating).toFixed(1)} rating
                                </span>
                              </div>
                            )}
                            {assignedDriver?.licenseNumber && (
                              <div className="flex items-center gap-2">
                                <Shield className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "#9ba3af" }} />
                                <span className="text-sm" style={{ color: "#5a6070" }}>
                                  License: {assignedDriver.licenseNumber}
                                </span>
                              </div>
                            )}
                            {!!assignedDriver?.yearsOfExperience && (
                              <div className="flex items-center gap-2">
                                <Clock className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "#9ba3af" }} />
                                <span className="text-sm" style={{ color: "#5a6070" }}>
                                  {assignedDriver.yearsOfExperience} yr{assignedDriver.yearsOfExperience !== 1 ? "s" : ""} experience
                                </span>
                              </div>
                            )}
                            {assignedVehicle ? (
                              <>
                                <div className="flex items-center gap-2">
                                  <Car className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "#9ba3af" }} />
                                  <span className="text-sm font-medium" style={{ color: "#0f1117" }}>
                                    {assignedVehicle.brand} {assignedVehicle.model} · {assignedVehicle.plateNumber}
                                  </span>
                                </div>
                                {assignedVehicle.vehicleType && (
                                  <div className="flex items-center gap-2 pl-5">
                                    <span className="text-sm capitalize" style={{ color: "#5a6070" }}>
                                      {assignedVehicle.vehicleType.replace(/_/g, " ")}
                                    </span>
                                  </div>
                                )}
                                {(assignedVehicle.color || assignedVehicle.year) && (
                                  <div className="flex items-center gap-2 pl-5">
                                    <span className="text-sm" style={{ color: "#5a6070" }}>
                                      {[assignedVehicle.color, assignedVehicle.year].filter(Boolean).join(" · ")}
                                    </span>
                                  </div>
                                )}
                              </>
                            ) : vehicleLabel ? (
                              <div className="flex items-center gap-2">
                                <Car className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "#9ba3af" }} />
                                <span className="text-sm" style={{ color: "#5a6070" }}>
                                  {vehicleLabel}
                                </span>
                              </div>
                            ) : null}
                          </div>
                        )}

                        {/* Workflow extras */}
                        {isWorkflowRow && wReq && (
                          <div className="rounded-xl p-3 space-y-1.5" style={{ background: "#eef2ff", border: "1px solid #c7d2fe" }}>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                              Delivery Info
                            </p>
                            {wReq.transportType && (
                              <div className="flex items-center gap-2">
                                <Truck className="h-3.5 w-3.5 flex-shrink-0 text-indigo-400" />
                                <span className="text-sm capitalize" style={{ color: "#0f1117" }}>
                                  {wReq.transportType.replace(/_/g, " ")}
                                </span>
                              </div>
                            )}
                            {wReq.distanceKm != null && (
                              <div className="flex items-center gap-2">
                                <Navigation2 className="h-3.5 w-3.5 flex-shrink-0 text-indigo-400" />
                                <span className="text-sm" style={{ color: "#5a6070" }}>
                                  {Number(wReq.distanceKm).toFixed(1)} km
                                </span>
                              </div>
                            )}
                            <div className="flex items-center gap-2">
                              <DollarSign className="h-3.5 w-3.5 flex-shrink-0 text-indigo-400" />
                              <span className="text-sm" style={{ color: "#5a6070" }}>
                                Negotiation {wReq.allowNegotiation ? "allowed" : "not allowed"}
                              </span>
                            </div>
                            {wReq.isScheduled && wReq.scheduledTime && (
                              <div className="flex items-center gap-2">
                                <Calendar className="h-3.5 w-3.5 flex-shrink-0 text-indigo-400" />
                                <span className="text-sm" style={{ color: "#5a6070" }}>
                                  Scheduled: {new Date(wReq.scheduledTime).toLocaleString()}
                                </span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Payment proof */}
                        {paymentProofUrl && (
                          <div className="rounded-xl overflow-hidden border border-amber-200">
                            <div className="px-3 py-2 bg-amber-50 flex items-center justify-between">
                              <p className="text-xs font-semibold text-amber-700">
                                Payment Proof
                              </p>
                              <a
                                href={paymentProofUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs font-semibold"
                                style={{ color: "#009C41" }}
                              >
                                Open full size
                              </a>
                            </div>
                            <img
                              src={paymentProofUrl}
                              alt="Payment proof"
                              className="w-full max-h-40 object-cover"
                            />
                          </div>
                        )}

                        {/* Delivery proof */}
                        {d.proofUrl && (
                          <div className="rounded-xl overflow-hidden border border-[#e8eaed]">
                            <div className="px-3 py-2 bg-gray-50 flex items-center justify-between">
                              <p className="text-xs font-semibold" style={{ color: "#5a6070" }}>
                                Delivery Proof
                              </p>
                              <a
                                href={d.proofUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs font-semibold"
                                style={{ color: "#009C41" }}
                              >
                                Open full size
                              </a>
                            </div>
                            <img
                              src={d.proofUrl}
                              alt="Delivery proof"
                              className="w-full max-h-52 object-cover"
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {!isWorkflowRow && d.status === "pending" && (
                        <button
                          onClick={() => quickStatus(d.id!, "in_progress")}
                          className="flex items-center gap-1.5 h-9 px-4 rounded-[10px] text-sm font-semibold text-white transition-all active:scale-95"
                          style={{ background: "#2563eb" }}
                        >
                          Start Delivery
                        </button>
                      )}
                      {!isWorkflowRow && d.status === "in_progress" && (
                        <button
                          onClick={() => quickStatus(d.id!, "completed")}
                          className="flex items-center gap-1.5 h-9 px-4 rounded-[10px] text-sm font-semibold text-white transition-all active:scale-95"
                          style={{ background: "#009C41" }}
                        >
                          Mark Completed
                        </button>
                      )}
                      {!isWorkflowRow && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="h-9 w-9 rounded-[10px] border border-[#e8eaed] hover:bg-gray-50 flex items-center justify-center">
                              <MoreHorizontal className="h-4 w-4 text-gray-400" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-xl">
                            <DropdownMenuItem onClick={() => openEdit(d)} className="rounded-lg">
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDelete(d.id!)}
                              className="text-red-600 rounded-lg"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      )}

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="rounded-2xl max-w-md dash-font">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'Syne', sans-serif" }}>
              {editing ? "Edit Delivery" : "New Delivery"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 max-h-[60vh] overflow-y-auto pr-1">
            {[
              {
                label: "Customer Name *",
                key: "customerName",
                placeholder: "John Doe",
              },
              {
                label: "Customer Phone",
                key: "customerPhone",
                placeholder: "+234 800 000 0000",
              },
              {
                label: "Customer Email",
                key: "customerEmail",
                placeholder: "customer@email.com",
              },
              {
                label: "Pickup Address *",
                key: "pickup",
                placeholder: "123 Main St",
              },
              {
                label: "Dropoff Address *",
                key: "dropoff",
                placeholder: "456 High St",
              },
              {
                label: "Item Description",
                key: "itemDescription",
                placeholder: "Electronics",
              },
              { label: "Item Weight", key: "itemWeight", placeholder: "50kg" },
              {
                label: "Payment Proof URL",
                key: "paymentProofUrl",
                placeholder: "https://...",
              },
            ].map(({ label, key, placeholder }) => (
              <div key={key}>
                <Label
                  className="text-xs font-semibold mb-1.5 block"
                  style={{ color: "#5a6070" }}
                >
                  {label}
                </Label>
                <input
                  placeholder={placeholder}
                  value={(form as any)[key] ?? ""}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, [key]: e.target.value }))
                  }
                  className="dash-input w-full h-10 px-3 rounded-[10px] border border-[#e8eaed] bg-[#f9fafb] outline-none"
                  style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 16 }}
                />
              </div>
            ))}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label
                  className="text-xs font-semibold mb-1.5 block"
                  style={{ color: "#5a6070" }}
                >
                  Final Price (₦)
                </Label>
                <input
                  type="number"
                  placeholder="0"
                  value={form.finalPrice ?? ""}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      finalPrice: Number(e.target.value),
                    }))
                  }
                  className="dash-input w-full h-10 px-3 rounded-[10px] border border-[#e8eaed] bg-[#f9fafb] outline-none"
                  style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 16 }}
                />
              </div>
              <div>
                <Label
                  className="text-xs font-semibold mb-1.5 block"
                  style={{ color: "#5a6070" }}
                >
                  Status
                </Label>
                <Select
                  value={form.status ?? "pending"}
                  onValueChange={(v) =>
                    setForm((p) => ({ ...p, status: v as any }))
                  }
                >
                  <SelectTrigger className="h-10 rounded-[10px] border-[#e8eaed] text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {[
                      "pending",
                      "assigned",
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
              </div>
            </div>
            <div>
              <Label
                className="text-xs font-semibold mb-1.5 block"
                style={{ color: "#5a6070" }}
              >
                Assign Driver
              </Label>
              <Select
                value={form.driverId ?? ""}
                onValueChange={(v) => {
                  const dr = drivers.find((d) => d.id === v);
                  setForm((p) => ({
                    ...p,
                    driverId: v || null,
                    driverName: dr?.name ?? null,
                  }));
                }}
              >
                <SelectTrigger className="h-10 rounded-[10px] border-[#e8eaed] text-sm">
                  <SelectValue placeholder="Select driver (optional)" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="">No driver</SelectItem>
                  {drivers.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowModal(false)}
              className="rounded-[10px]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={
                saving || !form.customerName || !form.pickup || !form.dropoff
              }
              className="rounded-[10px] gap-1.5"
              style={{
                background: "linear-gradient(135deg, #009C41 0%, #007A32 100%)",
              }}
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {editing ? "Save Changes" : "Create Delivery"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Tab: History ─────────────────────────────────────────────────────────────
function HistoryTab({
  history,
  loading,
  workflowHistory = [],
  drivers = [],
  fleet = [],
}: {
  history: Array<CompanyDelivery & { id: string }>;
  loading: boolean;
  workflowHistory?: CompanyWorkflowRequest[];
  drivers?: Array<CompanyDriver & { id: string }>;
  fleet?: Array<FleetVehicle & { id: string }>;
}) {
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setDate(new Date().getDate() - 30)),
    end: new Date(),
  });

  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const toggleExpand = (id: string) =>
    setExpandedCards((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  // h.id (workflow_xxx) → original workflow request, for paymentProofUrl / itemSize etc.
  const workflowHistoryMap = useMemo(() => {
    const m = new Map<string, CompanyWorkflowRequest>();
    workflowHistory.forEach((r) => m.set(`workflow_${r.id}`, r));
    return m;
  }, [workflowHistory]);

  // requestId → driver record for workflow deliveries
  const [workflowDriverMap, setWorkflowDriverMap] = useState<
    Record<string, (CompanyDriver & { id: string }) | null>
  >({});

  // customerId → UserDoc for workflow deliveries
  const [workflowCustomerMap, setWorkflowCustomerMap] = useState<
    Record<string, UserDoc>
  >({});

  const completedWorkflowRequests = workflowHistory.filter(
    (r) => r.status === "completed",
  );
  const completedWorkflowIds = completedWorkflowRequests.map((r) => r.id);

  useEffect(() => {
    if (!completedWorkflowIds.length || !drivers.length) return;
    getAssignmentsByRequestIds(completedWorkflowIds).then((assignments) => {
      const map: Record<string, (CompanyDriver & { id: string }) | null> = {};
      for (const a of assignments) {
        if (map[a.requestId] !== undefined) continue;
        const driver =
          drivers.find((d) => d.id === a.driverId || d.uid === a.driverId) ??
          null;
        map[a.requestId] = driver;
      }
      setWorkflowDriverMap(map);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completedWorkflowIds.join(","), drivers]);

  useEffect(() => {
    const customerIds = [
      ...new Set(
        completedWorkflowRequests
          .map((r) => r.customerId)
          .filter(Boolean) as string[],
      ),
    ];
    if (!customerIds.length) return;
    getUsersByIds(customerIds).then(setWorkflowCustomerMap);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completedWorkflowIds.join(",")]);

  const workflowCompleted = workflowHistory
    .filter((r) => r.status === "completed")
    .map((r) => ({
      id: `workflow_${r.id}`,
      companyId: (r as any).assignedCompanyId ?? "",
      bookingId: r.id,
      customerName:
        (r as any).deliveryName ??
        `Customer ${r.customerId?.slice(0, 6)?.toUpperCase?.() ?? ""}`,
      customerPhone: undefined,
      driverId: null,
      driverName: undefined,
      vehicleId: null,
      pickup: r.pickup?.address ?? "—",
      dropoff: r.dropoff?.address ?? "—",
      status: "completed" as const,
      itemDescription: r.itemDescription ?? undefined,
      itemWeight: r.itemWeight ?? undefined,
      finalPrice: ((r as any).finalPrice ??
        (r as any).negotiatedPrice ??
        (r as any).quotedPrice ??
        r.estimatedPrice ??
        null) as number | null,
      proofUrl: (r as any).proof?.url ?? (r as any).deliveryProofUrl ?? null,
      completedAt:
        (r as any).customerConfirmedDeliveryAt ?? r.updatedAt ?? r.createdAt,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })) as Array<CompanyDelivery & { id: string }>;

  const allHistory = [...workflowCompleted, ...history];
  const inDateRange = (value: unknown) => {
    const date =
      (value as any)?.toDate?.() ??
      (typeof value === "string" || value instanceof Date
        ? new Date(value)
        : null);
    if (!date || Number.isNaN(date.getTime())) return true;
    return (
      date >= dateRange.start &&
      date <= new Date(dateRange.end.getTime() + 86_399_999)
    );
  };
  const filteredHistory = allHistory.filter((h) =>
    inDateRange(h.completedAt ?? h.createdAt),
  );
  const totalRevenue = filteredHistory.reduce(
    (s, h) => s + (h.finalPrice ?? 0),
    0,
  );

  const handleExport = () => {
    const header = [
      "ID",
      "Customer",
      "Pickup",
      "Dropoff",
      "Driver",
      "Price",
      "Completed",
    ];
    const rows = filteredHistory.map((h) =>
      [
        h.id,
        h.customerName ?? "",
        h.pickup ?? "",
        h.dropoff ?? "",
        h.driverName ?? "",
        h.finalPrice ?? "",
        formatTs(h.completedAt),
      ]
        .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
        .join(","),
    );
    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `history-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported");
  };

  return (
    <div className="space-y-5 dash-font">
      <div>
        <h2
          className="text-xl font-bold"
          style={{ fontFamily: "'Syne', sans-serif", color: "#0f1117" }}
        >
          Delivery History
        </h2>
        <p className="text-sm mt-0.5" style={{ color: "#9ba3af" }}>
          {filteredHistory.length} completed deliveries
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex justify-end">
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 h-10 px-3 rounded-[10px] text-sm font-semibold border border-[#e8eaed] bg-[#f9fafb] transition-colors hover:bg-gray-100"
            style={{ color: "#5a6070" }}
          >
            <Download className="h-4 w-4" /> Export
          </button>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dateRange.start.toISOString().split("T")[0]}
            onChange={(e) =>
              setDateRange((p) => ({ ...p, start: new Date(e.target.value) }))
            }
            className="dash-input flex-1 h-10 px-3 rounded-[10px] border border-[#e8eaed] bg-[#f9fafb] outline-none min-w-0"
            style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 16 }}
          />
          <span className="text-xs flex-shrink-0" style={{ color: "#9ba3af" }}>
            to
          </span>
          <input
            type="date"
            value={dateRange.end.toISOString().split("T")[0]}
            onChange={(e) =>
              setDateRange((p) => ({ ...p, end: new Date(e.target.value) }))
            }
            className="dash-input flex-1 h-10 px-3 rounded-[10px] border border-[#e8eaed] bg-[#f9fafb] outline-none min-w-0"
            style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 16 }}
          />
        </div>
      </div>

      {/* Revenue summary */}
      <div
        className="rounded-[14px] p-4 flex items-center gap-4"
        style={{ background: "#f0fdf4", border: "1px solid #86efac" }}
      >
        <div
          className="h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "#009C41" }}
        >
          <DollarSign className="h-6 w-6 text-white" />
        </div>
        <div>
          <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">
            Period Revenue
          </p>
          <p
            className="text-2xl font-bold text-emerald-700"
            style={{ fontFamily: "'Syne', sans-serif" }}
          >
            ₦{totalRevenue.toLocaleString()}
          </p>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="space-y-3">
          {filteredHistory.length === 0 ? (
            <Card className="py-16 text-center">
              <History className="h-10 w-10 text-gray-200 mx-auto mb-3" />
              <p className="text-sm" style={{ color: "#9ba3af" }}>
                No completed deliveries in this period
              </p>
            </Card>
          ) : (
            filteredHistory.map((h) => {
              const orderId = h.id.replace("workflow_", "");
              const isWorkflow = h.id.startsWith("workflow_");
              const isExpanded = expandedCards.has(h.id);
              const wReq = isWorkflow ? workflowHistoryMap.get(h.id) : undefined;

              const driverRecord = h.driverId
                ? (drivers.find((d) => d.id === h.driverId) ?? null)
                : isWorkflow && h.bookingId
                  ? (workflowDriverMap[h.bookingId] ?? null)
                  : null;
              const driverName = driverRecord?.name ?? h.driverName ?? null;

              const customerProfile =
                isWorkflow && h.bookingId
                  ? (workflowCustomerMap[
                      completedWorkflowRequests.find(
                        (r) => r.id === h.bookingId,
                      )?.customerId ?? ""
                    ] ?? null)
                  : null;
              const customerName = customerProfile
                ? [customerProfile.firstName, customerProfile.lastName]
                    .filter(Boolean)
                    .join(" ") || h.customerName
                : h.customerName;
              const customerPhone = customerProfile?.phone ?? h.customerPhone ?? null;
              const customerEmail = customerProfile?.email ?? h.customerEmail ?? null;
              const driverPhone = driverRecord?.phone ?? null;
              const driverEmail = driverRecord?.email ?? null;
              const paymentProofUrl =
                h.paymentProofUrl ??
                (isWorkflow ? (wReq?.paymentProofUrl ?? null) : null);
              const assignedVehicle = driverRecord?.assignedVehicleId
                ? (fleet.find((v) => v.id === driverRecord.assignedVehicleId) ?? null)
                : null;
              const vehicleLabel = assignedVehicle
                ? `${assignedVehicle.brand} ${assignedVehicle.model} · ${assignedVehicle.plateNumber}`
                : driverRecord?.assignedVehicleBrand && driverRecord?.assignedVehiclePlate
                ? `${driverRecord.assignedVehicleBrand} · ${driverRecord.assignedVehiclePlate}`
                : null;
              const hasItemInfo = !!(
                h.itemDescription || h.itemWeight || wReq?.itemSize || wReq?.packagePhotoUrl
              );

              return (
                <Card key={h.id} className="overflow-hidden card-in">
                  <div className="p-4 lg:p-5 space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-xs font-mono" style={{ color: "#5a6070" }}>
                            #{orderId.slice(0, 8).toUpperCase()}
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle className="h-3 w-3" /> Completed
                          </span>
                          {isWorkflow && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              Company dashboard
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] mt-1" style={{ color: "#9ba3af" }}>
                          {formatTs(h.completedAt ?? h.createdAt)}
                        </p>
                      </div>
                      <p className="text-xl font-bold text-emerald-600 whitespace-nowrap" style={{ fontFamily: "'Syne', sans-serif" }}>
                        ₦{Number(h.finalPrice ?? 0).toLocaleString()}
                      </p>
                    </div>

                    {/* Customer / Driver summary — always visible */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider mb-1 px-1" style={{ color: "#9ba3af" }}>Customer</p>
                        <div className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 h-full" style={{ background: "#f9fafb" }}>
                          <div className="h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(0,156,65,0.08)" }}>
                            <User className="h-4 w-4" style={{ color: "#009C41" }} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold truncate" style={{ color: "#0f1117" }}>{customerName}</p>
                            {customerPhone ? (
                              <p className="text-xs truncate" style={{ color: "#9ba3af" }}>{customerPhone}</p>
                            ) : (
                              <p className="text-xs" style={{ color: "#c4c9d4" }}>No phone on record</p>
                            )}
                          </div>
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider mb-1 px-1" style={{ color: "#9ba3af" }}>Driver</p>
                        <div className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 h-full" style={{ background: "#f9fafb" }}>
                          <div className="h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(0,156,65,0.08)" }}>
                            <Truck className="h-4 w-4" style={{ color: "#009C41" }} />
                          </div>
                          <div className="min-w-0 flex-1">
                            {driverName ? (
                              <>
                                <p className="text-sm font-semibold truncate" style={{ color: "#0f1117" }}>{driverName}</p>
                                {driverPhone && (
                                  <p className="text-xs truncate" style={{ color: "#9ba3af" }}>{driverPhone}</p>
                                )}
                              </>
                            ) : (
                              <p className="text-sm" style={{ color: "#c4c9d4" }}>No driver assigned</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Addresses — always visible */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <div className="rounded-xl p-3" style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                        <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-0.5">Pickup</p>
                        <p className="text-sm font-semibold leading-snug break-words" style={{ color: "#0f1117" }}>{h.pickup}</p>
                      </div>
                      <div className="rounded-xl p-3" style={{ background: "#fff5f5", border: "1px solid #fecaca" }}>
                        <p className="text-[10px] font-bold text-red-500 uppercase tracking-wider mb-0.5">Drop-off</p>
                        <p className="text-sm font-semibold leading-snug break-words" style={{ color: "#0f1117" }}>{h.dropoff}</p>
                      </div>
                    </div>

                    {/* Details toggle */}
                    <button
                      onClick={() => toggleExpand(h.id)}
                      className="flex items-center gap-1.5 text-xs font-semibold transition-colors"
                      style={{ color: isExpanded ? "#009C41" : "#5a6070" }}
                    >
                      {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      {isExpanded ? "Hide details" : "Show details"}
                    </button>

                    {/* Collapsible details */}
                    {isExpanded && (
                      <div className="space-y-3 pt-3" style={{ borderTop: "1px solid #f0f0f0" }}>
                        {/* Customer full */}
                        <div className="rounded-xl p-3 space-y-1.5" style={{ background: "#f9fafb", border: "1px solid #e8eaed" }}>
                          <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#5a6070" }}>Customer</p>
                          <div className="flex items-center gap-2">
                            <User className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "#9ba3af" }} />
                            <span className="text-sm font-semibold" style={{ color: "#0f1117" }}>{customerName || "—"}</span>
                          </div>
                          {customerPhone && (
                            <div className="flex items-center gap-2">
                              <Phone className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "#9ba3af" }} />
                              <span className="text-sm" style={{ color: "#5a6070" }}>{customerPhone}</span>
                            </div>
                          )}
                          {customerEmail && (
                            <div className="flex items-center gap-2">
                              <Mail className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "#9ba3af" }} />
                              <span className="text-sm" style={{ color: "#5a6070" }}>{customerEmail}</span>
                            </div>
                          )}
                        </div>

                        {/* Package */}
                        {hasItemInfo && (
                          <div className="rounded-xl p-3 space-y-1.5" style={{ background: "#f9fafb", border: "1px solid #e8eaed" }}>
                            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#5a6070" }}>Package</p>
                            {h.itemDescription && (
                              <div className="flex items-start gap-2">
                                <FileText className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" style={{ color: "#9ba3af" }} />
                                <span className="text-sm" style={{ color: "#0f1117" }}>{h.itemDescription}</span>
                              </div>
                            )}
                            {h.itemWeight && (
                              <div className="flex items-center gap-2">
                                <Package className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "#9ba3af" }} />
                                <span className="text-sm" style={{ color: "#5a6070" }}>Weight: {h.itemWeight}</span>
                              </div>
                            )}
                            {wReq?.itemSize && (
                              <div className="flex items-center gap-2">
                                <Package className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "#9ba3af" }} />
                                <span className="text-sm" style={{ color: "#5a6070" }}>Size: {wReq.itemSize}</span>
                              </div>
                            )}
                            {wReq?.packagePhotoUrl && (
                              <div className="rounded-lg overflow-hidden border border-[#e8eaed] mt-1">
                                <div className="px-3 py-1.5 bg-gray-50 flex items-center justify-between">
                                  <p className="text-xs font-semibold" style={{ color: "#5a6070" }}>Package Photo</p>
                                  <a href={wReq.packagePhotoUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold" style={{ color: "#009C41" }}>Open full size</a>
                                </div>
                                <img src={wReq.packagePhotoUrl} alt="Package" className="w-full max-h-40 object-cover" />
                              </div>
                            )}
                          </div>
                        )}

                        {/* Driver full */}
                        {(driverName || driverRecord) && (
                          <div className="rounded-xl p-3 space-y-1.5" style={{ background: "#f9fafb", border: "1px solid #e8eaed" }}>
                            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#5a6070" }}>Driver</p>
                            <div className="flex items-center gap-2">
                              <User className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "#9ba3af" }} />
                              <span className="text-sm font-semibold" style={{ color: "#0f1117" }}>{driverName ?? "—"}</span>
                              {driverRecord && (
                                <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${driverRecord.isOnline ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                                  {driverRecord.isOnline ? "Online" : "Offline"}
                                </span>
                              )}
                            </div>
                            {driverPhone && (
                              <div className="flex items-center gap-2">
                                <Phone className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "#9ba3af" }} />
                                <span className="text-sm" style={{ color: "#5a6070" }}>{driverPhone}</span>
                              </div>
                            )}
                            {driverEmail && (
                              <div className="flex items-center gap-2">
                                <Mail className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "#9ba3af" }} />
                                <span className="text-sm" style={{ color: "#5a6070" }}>{driverEmail}</span>
                              </div>
                            )}
                            {!!driverRecord?.rating && (
                              <div className="flex items-center gap-2">
                                <Star className="h-3.5 w-3.5 flex-shrink-0 text-amber-400" />
                                <span className="text-sm" style={{ color: "#5a6070" }}>{Number(driverRecord.rating).toFixed(1)} rating</span>
                              </div>
                            )}
                            {driverRecord?.licenseNumber && (
                              <div className="flex items-center gap-2">
                                <Shield className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "#9ba3af" }} />
                                <span className="text-sm" style={{ color: "#5a6070" }}>License: {driverRecord.licenseNumber}</span>
                              </div>
                            )}
                            {!!driverRecord?.yearsOfExperience && (
                              <div className="flex items-center gap-2">
                                <Clock className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "#9ba3af" }} />
                                <span className="text-sm" style={{ color: "#5a6070" }}>
                                  {driverRecord.yearsOfExperience} yr{driverRecord.yearsOfExperience !== 1 ? "s" : ""} experience
                                </span>
                              </div>
                            )}
                            {assignedVehicle ? (
                              <>
                                <div className="flex items-center gap-2">
                                  <Car className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "#9ba3af" }} />
                                  <span className="text-sm font-medium" style={{ color: "#0f1117" }}>
                                    {assignedVehicle.brand} {assignedVehicle.model} · {assignedVehicle.plateNumber}
                                  </span>
                                </div>
                                {assignedVehicle.vehicleType && (
                                  <div className="flex items-center gap-2 pl-5">
                                    <span className="text-sm capitalize" style={{ color: "#5a6070" }}>
                                      {assignedVehicle.vehicleType.replace(/_/g, " ")}
                                    </span>
                                  </div>
                                )}
                                {(assignedVehicle.color || assignedVehicle.year) && (
                                  <div className="flex items-center gap-2 pl-5">
                                    <span className="text-sm" style={{ color: "#5a6070" }}>
                                      {[assignedVehicle.color, assignedVehicle.year].filter(Boolean).join(" · ")}
                                    </span>
                                  </div>
                                )}
                              </>
                            ) : vehicleLabel ? (
                              <div className="flex items-center gap-2">
                                <Car className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "#9ba3af" }} />
                                <span className="text-sm" style={{ color: "#5a6070" }}>{vehicleLabel}</span>
                              </div>
                            ) : null}
                          </div>
                        )}

                        {/* Payment proof */}
                        {paymentProofUrl && (
                          <div className="rounded-xl overflow-hidden border border-amber-200">
                            <div className="px-3 py-2 bg-amber-50 flex items-center justify-between">
                              <p className="text-xs font-semibold text-amber-700">Payment Proof</p>
                              <a href={paymentProofUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold" style={{ color: "#009C41" }}>Open full size</a>
                            </div>
                            <img src={paymentProofUrl} alt="Payment proof" className="w-full max-h-40 object-cover" />
                          </div>
                        )}

                        {/* Delivery proof */}
                        {h.proofUrl && (
                          <div className="rounded-xl overflow-hidden border border-[#e8eaed]">
                            <div className="flex items-center justify-between px-3 py-2" style={{ background: "#f9fafb" }}>
                              <p className="text-xs font-semibold" style={{ color: "#5a6070" }}>Delivery Proof</p>
                              <a href={h.proofUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold" style={{ color: "#009C41" }}>Open full size</a>
                            </div>
                            <img src={h.proofUrl} alt="Delivery proof" className="w-full max-h-52 object-cover" />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </Card>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Map ─────────────────────────────────────────────────────────────────
function MapTab({
  drivers,
  companyName,
}: {
  drivers: Array<CompanyDriver & { id: string }>;
  companyName: string;
}) {
  const [selectedDriver, setSelectedDriver] = useState<
    (CompanyDriver & { id: string }) | null
  >(null);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [locationSearch, setLocationSearch] = useState("");
  const [searchPin, setSearchPin] = useState<SearchPin | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [nearbyDrivers, setNearbyDrivers] = useState<
    Array<CompanyDriver & { id: string }>
  >([]);
  const [mapCenter, setMapCenter] = useState<[number, number]>([
    6.5244, 3.3792,
  ]);

  useEffect(() => {
    const t = setInterval(() => setLastUpdated(new Date()), 10_000);
    return () => clearInterval(t);
  }, []);

  async function handleLocationSearch() {
    if (!locationSearch.trim()) return;
    setSearchLoading(true);
    setNearbyDrivers([]);
    setSearchPin(null);
    try {
      const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(locationSearch)}&key=${apiKey}`,
      );
      const data = await res.json();
      const loc = data.results?.[0]?.geometry?.location;
      if (!loc) {
        alert("Location not found.");
        return;
      }
      setSearchPin({
        lat: loc.lat,
        lng: loc.lng,
        label: data.results[0].formatted_address,
      });
      setMapCenter([loc.lat, loc.lng]);
      const withGps = drivers.filter(
        (d) => d.currentLatitude != null && d.currentLongitude != null,
      );
      const nearby = withGps
        .map((d) => ({
          driver: d,
          km: haversineKm(
            loc.lat,
            loc.lng,
            d.currentLatitude!,
            d.currentLongitude!,
          ),
        }))
        .filter(({ km }) => km <= 10)
        .sort((a, b) => a.km - b.km)
        .map(({ driver }) => driver);
      setNearbyDrivers(nearby);
    } finally {
      setSearchLoading(false);
    }
  }

  function clearSearch() {
    setLocationSearch("");
    setSearchPin(null);
    setNearbyDrivers([]);
    setMapCenter([6.5244, 3.3792]);
  }

  const markers: MapMarker[] = drivers
    .filter((d) => d.currentLatitude != null && d.currentLongitude != null)
    .map((d) => ({
      id: d.id,
      latitude: d.currentLatitude as number,
      longitude: d.currentLongitude as number,
      type: "driver" as const,
      label: d.name,
      meta: `${d.isOnline ? "🟢 Online" : "⚫ Offline"} · ${d.status}`,
      data: d,
    }));

  const driversWithLocation = drivers.filter(
    (d) => d.currentLatitude != null && d.currentLongitude != null,
  );
  const driversWithout = drivers.filter(
    (d) => d.currentLatitude == null || d.currentLongitude == null,
  );
  const displayedDrivers = searchPin ? nearbyDrivers : drivers;

  return (
    <div className="space-y-5 dash-font">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2
            className="text-xl font-bold"
            style={{ fontFamily: "'Syne', sans-serif", color: "#0f1117" }}
          >
            Live Driver Map
          </h2>
          <p className="text-sm mt-0.5" style={{ color: "#9ba3af" }}>
            Real-time positions · auto-updates via Firebase
          </p>
        </div>
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span className="text-xs font-semibold text-emerald-700">
            Live · {lastUpdated.toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* Location search */}
      <Card className="p-4">
        <p
          className="text-[10px] font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5"
          style={{ color: "#9ba3af" }}
        >
          <Search className="h-3.5 w-3.5" /> Search Location
        </p>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input
              value={locationSearch}
              onChange={(e) => setLocationSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLocationSearch()}
              placeholder="Search any location…"
              className="dash-input w-full pl-9 h-10 rounded-[10px] border border-[#e8eaed] bg-[#f9fafb] outline-none"
              style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 16 }}
            />
            {locationSearch && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <X className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600" />
              </button>
            )}
          </div>
          <button
            onClick={handleLocationSearch}
            disabled={searchLoading}
            className="flex items-center gap-1.5 h-10 px-4 rounded-[10px] text-sm font-semibold text-white transition-all"
            style={{ background: "#009C41" }}
          >
            {searchLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            Search
          </button>
        </div>
        {searchPin && (
          <div
            className="mt-3 flex items-start gap-2 rounded-xl p-3"
            style={{ background: "#fffbeb", border: "1px solid #fde68a" }}
          >
            <MapPin className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-amber-800 truncate">
                {searchPin.label}
              </p>
              <p className="text-xs text-amber-600 mt-0.5">
                {nearbyDrivers.length > 0
                  ? `${nearbyDrivers.length} driver${nearbyDrivers.length !== 1 ? "s" : ""} within 10 km`
                  : "No drivers within 10 km"}
              </p>
            </div>
            <button
              onClick={clearSearch}
              className="flex-shrink-0 text-amber-500 hover:text-amber-700"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          {
            label: "Online",
            value: drivers.filter((d) => d.isOnline).length,
            accent: "bg-emerald-50 text-emerald-600",
            icon: UserCheck,
          },
          {
            label: "On Map",
            value: driversWithLocation.length,
            accent: "bg-blue-50 text-blue-600",
            icon: MapPin,
          },
          {
            label: "No GPS",
            value: driversWithout.length,
            accent: "bg-gray-100 text-gray-500",
            icon: XCircle,
          },
        ].map((s) => (
          <Card key={s.label} className="p-4">
            <div
              className={`h-10 w-10 rounded-xl flex items-center justify-center mb-2 ${s.accent}`}
            >
              <s.icon className="h-5 w-5" />
            </div>
            <p
              className="text-2xl font-bold"
              style={{ fontFamily: "'Syne', sans-serif", color: "#0f1117" }}
            >
              {s.value}
            </p>
            <p className="text-xs mt-1" style={{ color: "#9ba3af" }}>
              {s.label}
            </p>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden">
        <CardHeader
          title={searchPin ? "Drivers Near Location" : "Driver Locations"}
          action={
            <div className="flex gap-3">
              {[
                { label: "Online", color: "bg-emerald-500" },
                { label: "Offline", color: "bg-gray-300" },
              ].map((b) => (
                <span
                  key={b.label}
                  className="flex items-center gap-1.5 text-[11px] font-semibold"
                  style={{ color: "#9ba3af" }}
                >
                  <div className={`w-2 h-2 rounded-full ${b.color}`} />{" "}
                  {b.label}
                </span>
              ))}
            </div>
          }
        />

        <MapView
          className="h-[440px] lg:h-[520px] w-full"
          zoom={12}
          center={mapCenter}
          markers={markers}
          searchPin={searchPin}
          onMarkerClick={(m) =>
            setSelectedDriver(drivers.find((d) => d.id === m.id) ?? null)
          }
          showUserLocation={false}
        />

        {selectedDriver && (
          <div
            className="px-5 py-4 border-t border-[#f0f0f0]"
            style={{ background: "#f9fafb" }}
          >
            <div className="flex items-start gap-4">
              {selectedDriver.passportPhotoUrl ? (
                <img
                  src={selectedDriver.passportPhotoUrl}
                  alt=""
                  className="h-14 w-14 rounded-2xl object-cover border-2 flex-shrink-0"
                  style={{ borderColor: "rgba(0,156,65,0.2)" }}
                />
              ) : (
                <div
                  className="h-14 w-14 rounded-2xl flex items-center justify-center text-lg font-bold flex-shrink-0"
                  style={{ background: "rgba(0,156,65,0.1)", color: "#009C41" }}
                >
                  {getInitials(selectedDriver.name)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <p className="font-bold" style={{ color: "#0f1117" }}>
                    {selectedDriver.name}
                  </p>
                  <StatusBadge status={selectedDriver.status} />
                  <span
                    className={`flex items-center gap-1 text-xs font-semibold ${selectedDriver.isOnline ? "text-emerald-600" : "text-gray-400"}`}
                  >
                    <div
                      className={`w-1.5 h-1.5 rounded-full ${selectedDriver.isOnline ? "bg-emerald-500 animate-pulse" : "bg-gray-300"}`}
                    />
                    {selectedDriver.isOnline ? "Online" : "Offline"}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <span className="text-xs" style={{ color: "#9ba3af" }}>
                    {selectedDriver.phone}
                  </span>
                  <span className="text-xs" style={{ color: "#9ba3af" }}>
                    {selectedDriver.email}
                  </span>
                  {selectedDriver.assignedVehicleBrand && (
                    <span className="flex items-center gap-1 text-xs text-blue-600">
                      <Car className="h-3 w-3" />
                      {selectedDriver.assignedVehicleBrand} ·{" "}
                      {selectedDriver.assignedVehiclePlate}
                    </span>
                  )}
                  {selectedDriver.currentLatitude && (
                    <span className="text-xs" style={{ color: "#9ba3af" }}>
                      {selectedDriver.currentLatitude.toFixed(4)},{" "}
                      {selectedDriver.currentLongitude?.toFixed(4)}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setSelectedDriver(null)}
                className="h-7 w-7 rounded-lg hover:bg-gray-200 flex items-center justify-center transition-colors flex-shrink-0"
              >
                <X className="h-4 w-4 text-gray-400" />
              </button>
            </div>
          </div>
        )}

        <div className="px-5 py-4 border-t border-[#f0f0f0]">
          {displayedDrivers.length === 0 ? (
            <p
              className="text-sm text-center py-4"
              style={{ color: "#9ba3af" }}
            >
              {searchPin ? "No drivers within 10 km" : "No drivers added yet"}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {displayedDrivers.map((d) => {
                const hasGps =
                  d.currentLatitude != null && d.currentLongitude != null;
                const isSelected = selectedDriver?.id === d.id;
                return (
                  <button
                    key={d.id}
                    onClick={() => setSelectedDriver(d)}
                    className="flex items-center gap-2 rounded-xl px-3 py-2 border transition-all"
                    style={{
                      background: isSelected
                        ? "rgba(0,156,65,0.08)"
                        : "#f9fafb",
                      borderColor: isSelected
                        ? "rgba(0,156,65,0.3)"
                        : "#e8eaed",
                    }}
                  >
                    {d.passportPhotoUrl ? (
                      <img
                        src={d.passportPhotoUrl}
                        alt=""
                        className="h-7 w-7 rounded-lg object-cover flex-shrink-0"
                      />
                    ) : (
                      <div
                        className="h-7 w-7 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                        style={{
                          background:
                            d.status === "active"
                              ? "rgba(0,156,65,0.1)"
                              : "#f3f4f6",
                          color: d.status === "active" ? "#009C41" : "#9ca3af",
                        }}
                      >
                        {getInitials(d.name)}
                      </div>
                    )}
                    <div className="text-left">
                      <p
                        className="text-xs font-semibold"
                        style={{ color: "#0f1117" }}
                      >
                        {d.name}
                      </p>
                      <div
                        className={`flex items-center gap-1 text-[10px] font-medium ${d.isOnline ? "text-emerald-600" : "text-gray-400"}`}
                      >
                        <div
                          className={`w-1.5 h-1.5 rounded-full ${d.isOnline ? "bg-emerald-500" : "bg-gray-300"}`}
                        />
                        {d.isOnline ? "Online" : "Offline"}
                        {!hasGps && (
                          <span className="text-gray-300 ml-1">· no GPS</span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </Card>

      {driversWithout.length > 0 && (
        <div
          className="rounded-[14px] p-4"
          style={{ background: "#fffbeb", border: "1px solid #fde68a" }}
        >
          <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-2">
            {driversWithout.length} driver{driversWithout.length > 1 ? "s" : ""}{" "}
            not sharing GPS
          </p>
          <div className="flex flex-wrap gap-2">
            {driversWithout.map((d) => (
              <div
                key={d.id}
                className="flex items-center gap-2 bg-white rounded-xl px-3 py-1.5 border border-amber-200"
              >
                <span
                  className="text-xs font-semibold"
                  style={{ color: "#5a6070" }}
                >
                  {d.name}
                </span>
                <span className="text-[10px] text-amber-600">No location</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Profile ─────────────────────────────────────────────────────────────
function ProfileTab({
  company,
  companyId,
}: {
  company: import("@/services/companyService").CompanyDoc | null;
  companyId: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    companyPhone: "",
    companyAddress: "",
    companyWebsite: "",
    contactPersonName: "",
    contactPersonPhone: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (company) {
      setEditForm({
        companyPhone: company.companyPhone ?? "",
        companyAddress: company.companyAddress ?? "",
        companyWebsite: company.companyWebsite ?? "",
        contactPersonName: company.contactPersonName ?? "",
        contactPersonPhone: company.contactPersonPhone ?? "",
      });
    }
  }, [company]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (
      editForm.companyPhone &&
      !/^\+?[\d\s\-()]{7,15}$/.test(editForm.companyPhone)
    )
      e.companyPhone = "Invalid phone number format";
    if (
      editForm.contactPersonPhone &&
      !/^\+?[\d\s\-()]{7,15}$/.test(editForm.contactPersonPhone)
    )
      e.contactPersonPhone = "Invalid phone number format";
    if (
      editForm.companyWebsite &&
      editForm.companyWebsite.trim() &&
      !/^https?:\/\/.+/.test(editForm.companyWebsite.trim())
    )
      e.companyWebsite = "Website must start with http:// or https://";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!companyId || !validate()) return;
    setSaving(true);
    try {
      await updateCompanyProfile(companyId, {
        companyPhone: editForm.companyPhone || undefined,
        companyAddress: editForm.companyAddress || undefined,
        companyWebsite: editForm.companyWebsite || undefined,
        contactPersonName: editForm.contactPersonName || undefined,
        contactPersonPhone: editForm.contactPersonPhone || undefined,
      });
      toast.success("Profile updated");
      setEditing(false);
    } catch {
      toast.error("Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  if (!company)
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2
          className="h-8 w-8 animate-spin"
          style={{ color: "#009C41" }}
        />
      </div>
    );

  const readOnlyFields = [
    { icon: Building2, label: "Company Name", value: company.companyName },
    { icon: Mail, label: "Email Address", value: company.email },
    {
      icon: FileText,
      label: "Registration Number",
      value: company.companyRegNumber,
    },
  ];

  return (
    <div className="space-y-5 max-w-2xl dash-font">
      <div className="flex items-center justify-between">
        <div>
          <h2
            className="text-xl font-bold"
            style={{ fontFamily: "'Syne', sans-serif", color: "#0f1117" }}
          >
            Company Profile
          </h2>
          <p className="text-sm mt-0.5" style={{ color: "#9ba3af" }}>
            {editing
              ? "Edit your company contact details."
              : "Your company information."}
          </p>
        </div>
        {!editing ? (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-xl border border-[#e8eaed] hover:border-[#009C41] hover:text-[#009C41] transition-colors"
            style={{ color: "#5a6070" }}
          >
            <Edit className="h-3.5 w-3.5" />
            Edit
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setEditing(false);
                setErrors({});
              }}
              className="text-sm font-semibold px-3 py-1.5 rounded-xl border border-[#e8eaed] text-gray-500 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="text-sm font-semibold px-3 py-1.5 rounded-xl text-white disabled:opacity-50 transition-colors"
              style={{ background: "#009C41" }}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        )}
      </div>

      {/* Avatar header */}
      <Card className="p-6 flex items-center gap-5">
        <div
          className="h-20 w-20 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{
            background: "linear-gradient(135deg, #009C41 0%, #007A32 100%)",
          }}
        >
          <span
            className="text-3xl font-bold text-white"
            style={{ fontFamily: "'Syne', sans-serif" }}
          >
            {getInitials(company.companyName)}
          </span>
        </div>
        <div>
          <h3
            className="text-lg font-bold"
            style={{ fontFamily: "'Syne', sans-serif", color: "#0f1117" }}
          >
            {company.companyName}
          </h3>
          <p className="text-sm mt-0.5" style={{ color: "#9ba3af" }}>
            {company.email}
          </p>
          <div className="mt-2">
            <StatusBadge status={company.approvalStatus} />
          </div>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-5">
          <p
            className="text-[10px] font-semibold uppercase tracking-wider mb-1"
            style={{ color: "#9ba3af" }}
          >
            Wallet Balance
          </p>
          <p
            className="text-2xl font-bold"
            style={{ fontFamily: "'Syne', sans-serif", color: "#009C41" }}
          >
            ₦{(company.walletBalance ?? 0).toLocaleString()}
          </p>
        </Card>
        <Card className="p-5">
          <p
            className="text-[10px] font-semibold uppercase tracking-wider mb-1"
            style={{ color: "#9ba3af" }}
          >
            Total Deliveries
          </p>
          <p
            className="text-2xl font-bold"
            style={{ fontFamily: "'Syne', sans-serif", color: "#0f1117" }}
          >
            {company.totalDeliveries ?? 0}
          </p>
        </Card>
      </div>

      {/* Info fields */}
      <Card className="overflow-hidden">
        <CardHeader title="Company Details" />
        <div>
          {readOnlyFields.map(({ icon: Icon, label, value }, i) => (
            <div
              key={label}
              className="flex items-start gap-4 px-5 py-4"
              style={{ borderBottom: "1px solid #f0f0f0" }}
            >
              <div
                className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "#f9fafb" }}
              >
                <Icon className="h-4 w-4" style={{ color: "#9ba3af" }} />
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className="text-[10px] font-semibold uppercase tracking-wider mb-0.5"
                  style={{ color: "#9ba3af" }}
                >
                  {label}
                </p>
                {value ? (
                  <p
                    className="text-sm font-semibold break-words"
                    style={{ color: "#0f1117" }}
                  >
                    {value}
                  </p>
                ) : (
                  <p className="text-sm italic" style={{ color: "#d1d5db" }}>
                    Not provided
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Editable contact fields */}
      <Card className="overflow-hidden">
        <CardHeader title="Contact Details" />
        {editing ? (
          <div className="p-5 space-y-4">
            {[
              {
                key: "companyPhone",
                label: "Company Phone",
                icon: Phone,
                placeholder: "+234 800 000 0000",
              },
              {
                key: "companyAddress",
                label: "Company Address",
                icon: MapPin,
                placeholder: "123 Main St, Lagos",
              },
              {
                key: "companyWebsite",
                label: "Website",
                icon: Globe,
                placeholder: "https://yourcompany.com",
              },
              {
                key: "contactPersonName",
                label: "Contact Person",
                icon: User,
                placeholder: "Full name",
              },
              {
                key: "contactPersonPhone",
                label: "Contact Phone",
                icon: Phone,
                placeholder: "+234 800 000 0000",
              },
            ].map(({ key, label, icon: Icon, placeholder }) => (
              <div key={key}>
                <Label
                  className="text-xs font-semibold mb-1.5 block"
                  style={{ color: "#5a6070" }}
                >
                  {label}
                </Label>
                <div className="relative">
                  <Icon
                    className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5"
                    style={{ color: "#9ba3af" }}
                  />
                  <input
                    type="text"
                    placeholder={placeholder}
                    value={(editForm as any)[key]}
                    onChange={(e) =>
                      setEditForm((p) => ({ ...p, [key]: e.target.value }))
                    }
                    className="dash-input w-full h-10 pl-9 pr-3 rounded-[10px] border border-[#e8eaed] bg-[#f9fafb] outline-none"
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 16,
                    }}
                  />
                </div>
                {errors[key] && (
                  <p className="text-xs text-red-500 mt-1">{errors[key]}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div>
            {[
              {
                icon: Phone,
                label: "Company Phone",
                value: company.companyPhone,
              },
              {
                icon: MapPin,
                label: "Company Address",
                value: company.companyAddress,
              },
              { icon: Globe, label: "Website", value: company.companyWebsite },
              {
                icon: User,
                label: "Contact Person",
                value: company.contactPersonName,
              },
              {
                icon: Phone,
                label: "Contact Phone",
                value: company.contactPersonPhone,
              },
            ].map(({ icon: Icon, label, value }, i, arr) => (
              <div
                key={label}
                className="flex items-start gap-4 px-5 py-4"
                style={{
                  borderBottom:
                    i < arr.length - 1 ? "1px solid #f0f0f0" : "none",
                }}
              >
                <div
                  className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "#f9fafb" }}
                >
                  <Icon className="h-4 w-4" style={{ color: "#9ba3af" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className="text-[10px] font-semibold uppercase tracking-wider mb-0.5"
                    style={{ color: "#9ba3af" }}
                  >
                    {label}
                  </p>
                  {value ? (
                    <p
                      className="text-sm font-semibold break-words"
                      style={{ color: "#0f1117" }}
                    >
                      {value}
                    </p>
                  ) : (
                    <p className="text-sm italic" style={{ color: "#d1d5db" }}>
                      Not provided
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Account */}
      <Card className="overflow-hidden">
        <CardHeader title="Account" />
        <div>
          <div
            className="flex items-start gap-4 px-5 py-4"
            style={{ borderBottom: "1px solid #f0f0f0" }}
          >
            <div
              className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "#f9fafb" }}
            >
              <Shield className="h-4 w-4" style={{ color: "#9ba3af" }} />
            </div>
            <div>
              <p
                className="text-[10px] font-semibold uppercase tracking-wider mb-0.5"
                style={{ color: "#9ba3af" }}
              >
                Account ID
              </p>
              <p
                className="text-sm font-mono break-all"
                style={{ color: "#5a6070" }}
              >
                {companyId}
              </p>
            </div>
          </div>
          <div
            className="flex items-start gap-4 px-5 py-4"
            style={{
              borderBottom: company.approvedAt ? "1px solid #f0f0f0" : "none",
            }}
          >
            <div
              className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "#f9fafb" }}
            >
              <Calendar className="h-4 w-4" style={{ color: "#9ba3af" }} />
            </div>
            <div>
              <p
                className="text-[10px] font-semibold uppercase tracking-wider mb-0.5"
                style={{ color: "#9ba3af" }}
              >
                Member Since
              </p>
              <p className="text-sm font-semibold" style={{ color: "#0f1117" }}>
                {formatTs(company.createdAt)}
              </p>
            </div>
          </div>
          {company.approvedAt && (
            <div className="flex items-start gap-4 px-5 py-4">
              <div
                className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "#f0fdf4" }}
              >
                <CheckCircle className="h-4 w-4 text-emerald-500" />
              </div>
              <div>
                <p
                  className="text-[10px] font-semibold uppercase tracking-wider mb-0.5"
                  style={{ color: "#9ba3af" }}
                >
                  Approved On
                </p>
                <p
                  className="text-sm font-semibold"
                  style={{ color: "#0f1117" }}
                >
                  {formatTs(company.approvedAt)}
                </p>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

// ── Driver Assignment Panel ────────────────────────────────────────────────────

function DriverAssignPanel({
  requestId,
  pickupLat,
  pickupLng,
  drivers,
  driversLoading,
  driverDeclined,
  onAssign,
}: {
  requestId: string;
  pickupLat: number | null;
  pickupLng: number | null;
  drivers: Array<CompanyDriver & { id: string }>;
  driversLoading: boolean;
  driverDeclined: boolean;
  onAssign: (requestId: string, driverId: string) => Promise<void>;
}) {
  const [isOpen, setIsOpen] = useState(driverDeclined);
  const [filter, setFilter] = useState<"closest" | "rated" | "eta">("closest");
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);

  useEffect(() => {
    if (driverDeclined) setIsOpen(true);
  }, [driverDeclined]);

  const assignableDrivers = useMemo(
    () => drivers.filter((d) => d.status === "active" && (!!d.id || !!d.uid)),
    [drivers],
  );

  const scoredDrivers = useMemo(() => {
    return assignableDrivers.map((d) => {
      let score = 0;
      let distKm: number | null = null;
      let etaMin: number | null = null;
      const _id = d.id ?? d.uid ?? "";

      if (d.isOnline) score += 1000;
      if (d.uid) score += 100;

      if (
        pickupLat != null &&
        pickupLng != null &&
        d.currentLatitude != null &&
        d.currentLongitude != null
      ) {
        distKm = haversineKm(
          pickupLat,
          pickupLng,
          d.currentLatitude!,
          d.currentLongitude!,
        );
        score += Math.max(0, 200 - distKm * 4);
        etaMin = Math.round((distKm / 25) * 60);
      }

      score += (d.rating ?? 0) * 40;
      score += Math.min(d.totalDeliveries ?? 0, 50);

      return { ...d, _id, score, distKm, etaMin };
    });
  }, [assignableDrivers, pickupLat, pickupLng]);

  const sortedDrivers = useMemo(() => {
    const arr = [...scoredDrivers];
    if (filter === "closest") {
      arr.sort((a, b) => {
        if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
        if (a.distKm == null && b.distKm == null) return b.score - a.score;
        if (a.distKm == null) return 1;
        if (b.distKm == null) return -1;
        return a.distKm - b.distKm;
      });
    } else if (filter === "rated") {
      arr.sort((a, b) => {
        if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
        return (b.rating ?? 0) - (a.rating ?? 0);
      });
    } else {
      arr.sort((a, b) => {
        if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
        if (a.etaMin == null && b.etaMin == null) return b.score - a.score;
        if (a.etaMin == null) return 1;
        if (b.etaMin == null) return -1;
        return a.etaMin - b.etaMin;
      });
    }
    return arr;
  }, [scoredDrivers, filter]);

  const onlineCount = scoredDrivers.filter((d) => d.isOnline).length;
  const bestMatchId = sortedDrivers.find((d) => d.isOnline)?._id ?? null;

  const handleAssign = async (driverId: string) => {
    setAssigningId(driverId);
    try {
      await onAssign(requestId, driverId);
      setSuccessId(driverId);
      setTimeout(() => {
        setSuccessId(null);
        setIsOpen(false);
      }, 1400);
    } catch {
      // parent already showed error toast
    } finally {
      setAssigningId(null);
    }
  };

  return (
    <div className="rounded-[12px] border border-[#e8eaed] overflow-hidden">
      {/* Panel header — always visible, click to expand */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-[#f9fafb] hover:bg-[#f3f4f6] transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#009C41]/10 flex items-center justify-center flex-shrink-0">
            <Car className="h-4 w-4 text-[#009C41]" />
          </div>
          <span className="text-sm font-semibold text-[#0f1117]">
            Assign Driver
          </span>
          {driverDeclined && (
            <span className="text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
              Reassign needed
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full flex-shrink-0 ${onlineCount > 0 ? "bg-emerald-500" : "bg-gray-300"}`}
            />
            <span className="text-xs font-medium text-muted-foreground">
              {onlineCount} online
            </span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground">
              {assignableDrivers.length} active
            </span>
          </div>
          {isOpen ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          )}
        </div>
      </button>

      {/* Expandable body */}
      {isOpen && (
        <div className="p-3 space-y-3 bg-white border-t border-[#f0f1f3]">
          {/* Quick filter chips */}
          {assignableDrivers.length > 1 && (
            <div className="flex gap-2 flex-wrap">
              {(["closest", "rated", "eta"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`h-7 px-3 rounded-full text-xs font-semibold transition-all ${
                    filter === f
                      ? "bg-[#009C41] text-white"
                      : "bg-[#f3f4f6] text-muted-foreground hover:bg-[#e9eaec]"
                  }`}
                >
                  {f === "closest"
                    ? "Closest"
                    : f === "rated"
                      ? "Top Rated"
                      : "Fastest ETA"}
                </button>
              ))}
            </div>
          )}

          {/* Skeleton loader */}
          {driversLoading && (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-3 rounded-xl border border-[#f0f1f3] animate-pulse"
                >
                  <div className="w-10 h-10 rounded-full bg-gray-200 flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-gray-200 rounded w-28" />
                    <div className="h-2.5 bg-gray-200 rounded w-20" />
                    <div className="h-2.5 bg-gray-200 rounded w-16" />
                  </div>
                  <div className="h-8 w-16 bg-gray-200 rounded-lg" />
                </div>
              ))}
            </div>
          )}

          {/* No active drivers empty state */}
          {!driversLoading && assignableDrivers.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                <User className="h-5 w-5 text-gray-400" />
              </div>
              <p className="text-sm font-semibold text-[#0f1117]">
                No active drivers
              </p>
              <p className="text-xs text-muted-foreground max-w-[200px]">
                Add or activate a driver in the Drivers tab first.
              </p>
            </div>
          )}

          {/* All offline warning */}
          {!driversLoading &&
            assignableDrivers.length > 0 &&
            onlineCount === 0 && (
              <div className="flex items-center gap-2 rounded-[8px] bg-amber-50 border border-amber-100 px-3 py-2">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" />
                <p className="text-xs text-amber-700">
                  No drivers online. You can still assign an offline driver.
                </p>
              </div>
            )}

          {/* Driver cards */}
          {!driversLoading && sortedDrivers.length > 0 && (
            <div className="space-y-2">
              {sortedDrivers.map((d, idx) => {
                const isAssigning = assigningId === d._id;
                const isSuccess = successId === d._id;
                const isBestMatch =
                  d._id === bestMatchId && idx === 0 && d.isOnline;
                const onlineGroup = sortedDrivers.filter((x) => x.isOnline);
                const isTopRated =
                  !isBestMatch &&
                  d.isOnline &&
                  onlineGroup.length > 1 &&
                  (d.rating ?? 0) > 0 &&
                  onlineGroup.every(
                    (x) =>
                      x._id === d._id || (x.rating ?? 0) <= (d.rating ?? 0),
                  ) &&
                  onlineGroup.filter((x) => x.rating === d.rating).length === 1;
                const isClosest =
                  !isBestMatch &&
                  d.isOnline &&
                  d.distKm != null &&
                  onlineGroup.length > 1 &&
                  onlineGroup
                    .filter((x) => x.distKm != null)
                    .every(
                      (x) =>
                        x._id === d._id || (x.distKm ?? Infinity) >= d.distKm!,
                    ) &&
                  onlineGroup.filter((x) => x.distKm === d.distKm).length === 1;
                const etaColor =
                  d.etaMin == null
                    ? "text-muted-foreground"
                    : d.etaMin <= 10
                      ? "text-emerald-600"
                      : d.etaMin <= 25
                        ? "text-amber-500"
                        : "text-red-500";

                return (
                  <div
                    key={d._id}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 ${
                      isSuccess
                        ? "border-emerald-300 bg-emerald-50"
                        : d.isOnline
                          ? "border-[#e8eaed] bg-white hover:border-[#009C41]/40 hover:shadow-sm"
                          : "border-[#f0f1f3] bg-[#fafafa] opacity-65"
                    }`}
                  >
                    {/* Avatar + online pulse dot */}
                    <div className="relative flex-shrink-0">
                      {d.passportPhotoUrl ? (
                        <img
                          src={d.passportPhotoUrl}
                          alt={d.name}
                          className="w-10 h-10 rounded-full object-cover ring-2 ring-white shadow-sm"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-sm font-bold text-gray-500 ring-2 ring-white shadow-sm">
                          {d.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>
                      )}
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                          d.isOnline ? "bg-emerald-500" : "bg-gray-300"
                        }`}
                      >
                        {d.isOnline && (
                          <span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-60" />
                        )}
                      </span>
                    </div>

                    {/* Driver info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                        <span className="text-sm font-semibold text-[#0f1117] truncate">
                          {d.name}
                        </span>
                        {isBestMatch && (
                          <span className="text-[10px] font-bold bg-[#009C41]/10 text-[#009C41] border border-[#009C41]/20 px-1.5 py-0.5 rounded-full flex-shrink-0">
                            Best Match
                          </span>
                        )}
                        {isTopRated && (
                          <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full flex-shrink-0">
                            Top Rated
                          </span>
                        )}
                        {isClosest && (
                          <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full flex-shrink-0">
                            Closest
                          </span>
                        )}
                        {!d.uid && (
                          <span className="text-[10px] font-medium bg-red-50 text-red-500 border border-red-100 px-1.5 py-0.5 rounded-full flex-shrink-0">
                            Not linked
                          </span>
                        )}
                      </div>
                      {(d.assignedVehicleBrand || d.assignedVehiclePlate) && (
                        <div className="flex items-center gap-1 mb-1">
                          <Car className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          <span className="text-xs text-muted-foreground truncate">
                            {[d.assignedVehicleBrand, d.assignedVehiclePlate]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-2.5">
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              className={`h-2.5 w-2.5 flex-shrink-0 ${
                                s <= Math.round(d.rating ?? 0)
                                  ? "text-amber-400 fill-amber-400"
                                  : "text-gray-200 fill-gray-200"
                              }`}
                            />
                          ))}
                          <span className="text-[10px] text-muted-foreground ml-0.5">
                            {(d.rating ?? 0) > 0
                              ? (d.rating as number).toFixed(1)
                              : "No rating"}
                          </span>
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {d.totalDeliveries ?? 0} deliveries
                        </span>
                      </div>
                    </div>

                    {/* ETA + Assign button */}
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      {d.distKm != null ? (
                        <div className="text-right">
                          <p className={`text-xs font-bold ${etaColor}`}>
                            ~{d.etaMin}min
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {d.distKm.toFixed(1)} km
                          </p>
                        </div>
                      ) : (
                        <p className="text-[10px] text-muted-foreground text-right">
                          {d.isOnline ? "No GPS" : "Offline"}
                        </p>
                      )}
                      <button
                        onClick={() =>
                          !isSuccess && !isAssigning && handleAssign(d._id)
                        }
                        disabled={!!assigningId || !d.uid || isSuccess}
                        className={`h-8 px-3.5 rounded-lg text-xs font-bold text-white transition-all active:scale-95 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 min-w-[64px] ${
                          isSuccess
                            ? "bg-emerald-500 disabled:opacity-100"
                            : d.isOnline
                              ? "bg-gradient-to-r from-[#009C41] to-[#007A32] shadow-sm hover:shadow disabled:opacity-50"
                              : "bg-gray-400 disabled:opacity-50"
                        }`}
                      >
                        {isSuccess ? (
                          <>
                            <CheckCircle className="h-3.5 w-3.5" />
                            <span>Done!</span>
                          </>
                        ) : isAssigning ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          "Assign"
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Requests tab helpers ─────────────────────────────────────────────────────

function getVehicleLabel(transportType: string | null | undefined): string {
  const t = (transportType ?? "").toLowerCase();
  if (t === "bike" || t === "motorcycle") return "Bike";
  if (t === "car" || t === "economy" || t === "premium") return "Car";
  if (t === "van" || t === "xl") return "Van";
  if (t === "truck") return "Truck";
  if (t === "company_driver") return "Company Driver";
  return transportType ?? "—";
}

function RequestCardSkeleton({
  variant = "marketplace",
}: {
  variant?: "marketplace" | "assigned";
}) {
  if (variant === "assigned") {
    return (
      <div
        className="bg-white rounded-[18px] p-5 space-y-3.5"
        style={{
          border: "1px solid rgba(0,0,0,0.06)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2 flex-1">
            <div className="skeleton h-2.5 w-16 rounded-full" />
            <div className="skeleton h-4 w-44 rounded-lg" />
          </div>
          <div className="skeleton h-5 w-20 rounded-full" />
        </div>
        <div
          className="rounded-[12px] p-3 space-y-2"
          style={{ background: "rgba(0,0,0,0.025)" }}
        >
          <div className="skeleton h-3 w-full rounded-lg" />
          <div
            className="skeleton h-px w-full"
            style={{ background: "#e8e8e8", animationName: "none" }}
          />
          <div className="skeleton h-3 w-4/5 rounded-lg" />
        </div>
        <div className="skeleton h-10 w-full rounded-[12px]" />
      </div>
    );
  }
  return (
    <div
      className="bg-white rounded-[18px] p-4 space-y-3.5"
      style={{
        border: "1px solid rgba(0,0,0,0.06)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2 flex-1">
          <div className="skeleton h-2.5 w-16 rounded-full" />
          <div className="skeleton h-4 w-48 rounded-lg" />
          <div className="skeleton h-3 w-28 rounded-full" />
        </div>
        <div className="skeleton h-5 w-20 rounded-full" />
      </div>
      <div className="space-y-2.5 py-1">
        <div className="flex gap-2.5 items-start">
          <div className="skeleton w-2 h-2 rounded-full flex-shrink-0 mt-0.5" />
          <div className="skeleton h-3 w-full rounded-lg" />
        </div>
        <div className="flex gap-2.5 items-start">
          <div className="skeleton w-2 h-2 rounded-full flex-shrink-0 mt-0.5" />
          <div className="skeleton h-3 w-3/4 rounded-lg" />
        </div>
      </div>
      <div className="flex gap-2">
        <div className="skeleton h-7 w-20 rounded-full" />
        <div className="skeleton h-7 w-16 rounded-full" />
      </div>
      <div className="skeleton h-10 w-full rounded-[12px]" />
    </div>
  );
}

function CompanyRequestsTab({
  companyId,
  companyName,
  company,
  openRequests,
  cancelledGhosts,
  ownedRequests,
  activeQuotes,
  drivers,
  driversLoading,
  loading,
  onDeliveryComplete,
  highlightedRequestId,
}: {
  companyId: string;
  companyName: string;
  company: import("@/services/companyService").CompanyDoc | null;
  openRequests: CompanyWorkflowRequest[];
  cancelledGhosts: CompanyWorkflowRequest[];
  ownedRequests: CompanyWorkflowRequest[];
  activeQuotes: Array<DeliveryQuoteDoc & { id: string }>;
  drivers: Array<CompanyDriver & { id: string }>;
  driversLoading: boolean;
  loading: boolean;
  onDeliveryComplete: () => void;
  highlightedRequestId?: string | null;
}) {
  const [section, setSection] = useState<"marketplace" | "quotes" | "assigned">(
    "marketplace",
  );
  const [flashId, setFlashId] = useState<string | null>(null);

  useEffect(() => {
    if (!highlightedRequestId) return;
    setSection("marketplace");
    setFlashId(highlightedRequestId);
    const timer = setTimeout(() => {
      const el = document.getElementById(`request-${highlightedRequestId}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
    const clearTimer = setTimeout(() => setFlashId(null), 2000);
    return () => {
      clearTimeout(timer);
      clearTimeout(clearTimer);
    };
  }, [highlightedRequestId]); // eslint-disable-line react-hooks/exhaustive-deps

  const [actioningId, setActioningId] = useState<string | null>(null);
  const [quoteInputs, setQuoteInputs] = useState<Record<string, string>>({});
  const [expandedQuoteInput, setExpandedQuoteInput] = useState<string | null>(
    null,
  );
  const [counterInputs, setCounterInputs] = useState<Record<string, string>>(
    {},
  );

  const handleSubmitQuote = async (requestId: string) => {
    const price = Number(quoteInputs[requestId] ?? 0);
    if (!price || price <= 0) {
      toast.error("Enter a valid quote amount");
      return;
    }
    setActioningId(requestId);
    try {
      await submitCompanyQuote(requestId, companyId, price, companyName, {
        phone: company?.companyPhone ?? null,
        email: company?.email ?? null,
        address: company?.companyAddress ?? null,
      });
      toast.success("Quote sent to customer!");
      setExpandedQuoteInput(null);
      setQuoteInputs((p) => {
        const n = { ...p };
        delete n[requestId];
        return n;
      });
      setSection("quotes");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not send quote");
    } finally {
      setActioningId(null);
    }
  };

  const handleSubmitOwnedQuote = async (requestId: string) => {
    const price = Number(quoteInputs[requestId] ?? 0);
    if (!price || price <= 0) {
      toast.error("Enter a valid quote amount");
      return;
    }
    setActioningId(requestId);
    try {
      await setPriceQuote(requestId, price, companyId);
      toast.success("Quote sent to customer!");
      setQuoteInputs((p) => {
        const n = { ...p };
        delete n[requestId];
        return n;
      });
    } catch (e: any) {
      toast.error(e?.message ?? "Could not send quote");
    } finally {
      setActioningId(null);
    }
  };

  const handleRespondToCounter = async (
    quoteId: string,
    action: "accept" | "decline" | "counter",
  ) => {
    setActioningId(quoteId);
    try {
      const counterPrice =
        action === "counter" ? Number(counterInputs[quoteId] ?? 0) : undefined;
      if (action === "counter" && (!counterPrice || counterPrice <= 0)) {
        toast.error("Enter a valid counter amount");
        setActioningId(null);
        return;
      }
      await companyRespondToCounter(quoteId, action, counterPrice);
      if (action === "accept") toast.success("Customer's counter accepted!");
      else if (action === "decline") toast.info("Counter declined.");
      else toast.success("Counter offer sent!");
      setCounterInputs((p) => {
        const n = { ...p };
        delete n[quoteId];
        return n;
      });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setActioningId(null);
    }
  };

  const confirmCustomerPayment = async (requestId: string) => {
    setActioningId(requestId);
    try {
      await confirmPayment(requestId, companyId);
      toast.success("Payment confirmed");
    } catch {
      toast.error("Failed to confirm payment");
    } finally {
      setActioningId(null);
    }
  };

  const assignDriver = async (
    requestId: string,
    driverId: string,
  ): Promise<void> => {
    try {
      await createAssignment(requestId, driverId, companyId);
      toast.success("Driver assigned!");
    } catch {
      toast.error("Failed to assign driver");
      throw new Error("assign_failed");
    }
  };

  // Requests this company actively quoted (open marketplace) — excludes from Open tab
  const alreadyQuotedIds = useMemo(
    () => new Set(activeQuotes.map((q) => q.requestId)),
    [activeQuotes],
  );

  // Lookup map for request details used in the Quotes tab
  const requestById = useMemo(() => {
    const map = new Map<string, CompanyWorkflowRequest>();
    [...openRequests, ...ownedRequests, ...cancelledGhosts].forEach((r) =>
      map.set(r.id, r),
    );
    return map;
  }, [openRequests, ownedRequests, cancelledGhosts]);

  // Split owned requests: active workflow vs terminal (completed/cancelled)
  const assignedRequests = useMemo(
    () =>
      ownedRequests.filter(
        (r) => r.status !== "completed" && r.status !== "cancelled",
      ),
    [ownedRequests],
  );
  const deliveredRequests = useMemo(
    () =>
      ownedRequests.filter(
        (r) => r.status === "completed" || r.status === "cancelled",
      ),
    [ownedRequests],
  );

  // Live refs so effects can read current section/callback without them
  // being deps (an inline callback changes reference every render, which
  // would reset the baseline on each re-render and break detection).
  const sectionRef = useRef(section);
  sectionRef.current = section;
  const onDeliveryCompleteRef = useRef(onDeliveryComplete);
  onDeliveryCompleteRef.current = onDeliveryComplete;

  // Quotes → Assigned: fires when a customer accepts this company's quote.
  const prevAssignedLenRef = useRef<number | null>(null);
  useEffect(() => {
    if (prevAssignedLenRef.current === null) {
      prevAssignedLenRef.current = assignedRequests.length;
      return;
    }
    const prev = prevAssignedLenRef.current;
    prevAssignedLenRef.current = assignedRequests.length;
    if (assignedRequests.length > prev && sectionRef.current === "quotes") {
      setSection("assigned");
    }
  }, [assignedRequests.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Assigned → Deliveries sidebar: fires when a card reaches a terminal status.
  const prevDeliveredLenRef = useRef<number | null>(null);
  useEffect(() => {
    if (prevDeliveredLenRef.current === null) {
      prevDeliveredLenRef.current = deliveredRequests.length;
      return;
    }
    const prev = prevDeliveredLenRef.current;
    prevDeliveredLenRef.current = deliveredRequests.length;
    if (deliveredRequests.length > prev && sectionRef.current === "assigned") {
      onDeliveryCompleteRef.current();
    }
  }, [deliveredRequests.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Open tab: exclude requests this company already quoted and cancelled requests
  const marketplaceItems = useMemo(
    () =>
      openRequests.filter(
        (r) => !alreadyQuotedIds.has(r.id) && r.status !== "cancelled",
      ),
    [openRequests, alreadyQuotedIds],
  );

  const liveOpenCount = marketplaceItems.length;

  const tabs = [
    { id: "marketplace" as const, label: "Open", count: liveOpenCount },
    { id: "quotes" as const, label: "Quotes", count: activeQuotes.length },
    {
      id: "assigned" as const,
      label: "Assigned",
      count: assignedRequests.length,
    },
  ];

  return (
    <div className="dash-font space-y-0">
      {/* Hero banner */}
      <div
        className="rounded-[18px] p-5 lg:p-6 relative overflow-hidden mb-5"
        style={{
          background: "linear-gradient(135deg, #009C41 0%, #006d2c 100%)",
          boxShadow: "0 8px 32px rgba(0,156,65,0.28)",
        }}
      >
        <div className="absolute -top-10 -right-10 w-36 h-36 rounded-full bg-white/[0.06]" />
        <div className="absolute -bottom-6 -left-6 w-24 h-24 rounded-full bg-white/[0.04]" />
        <div className="relative">
          <p
            className="text-[10px] font-bold uppercase tracking-widest mb-1.5"
            style={{ color: "rgba(255,255,255,0.6)" }}
          >
            Premium Company Exchange
          </p>
          <h2
            className="text-xl font-bold text-white leading-tight"
            style={{ fontFamily: "'Syne', sans-serif" }}
          >
            Company Requests
          </h2>
          <p
            className="text-[13px] mt-1.5 leading-relaxed"
            style={{ color: "rgba(255,255,255,0.72)" }}
          >
            First company to accept owns the full workflow: quote, payment,
            assignment, and delivery.
          </p>
        </div>
      </div>

      {/* Segmented control */}
      <div
        className="sticky top-0 z-20 pb-4"
        style={{ background: "var(--surface)" }}
      >
        <div className="flex bg-black/[0.06] rounded-full p-1 gap-0.5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSection(tab.id)}
              className="seg-pill flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-full text-[13px] font-semibold"
              style={
                section === tab.id
                  ? {
                      background: "#fff",
                      color: "#0f1117",
                      boxShadow: "0 1px 6px rgba(0,0,0,0.12)",
                    }
                  : { color: "#6e6e73" }
              }
            >
              <span>{tab.label}</span>
              {tab.count > 0 && (
                <span
                  className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full text-[10px] font-bold"
                  style={
                    section === tab.id
                      ? { background: "#009C41", color: "#fff" }
                      : { background: "rgba(0,0,0,0.10)", color: "#6e6e73" }
                  }
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Open Marketplace tab ─────────────────────────────────────────────── */}
      {section === "marketplace" && (
        <div key="marketplace" className="tab-content">
          {loading ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <RequestCardSkeleton />
              <RequestCardSkeleton />
            </div>
          ) : marketplaceItems.length === 0 ? (
            <div className="py-20 text-center">
              <div
                className="h-16 w-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: "rgba(0,156,65,0.07)" }}
              >
                <Package className="h-7 w-7" style={{ color: "#009C41" }} />
              </div>
              <p
                className="text-sm font-semibold"
                style={{ color: "#1d1d1f", fontFamily: "'Syne', sans-serif" }}
              >
                No open requests
              </p>
              <p className="text-xs mt-1" style={{ color: "#aeaeb2" }}>
                New company requests appear here in real time.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {marketplaceItems.map((r) => {
                const ra = r as any;
                const isCancelled = r.status === "cancelled";
                const distKm = ra.distanceKm
                  ? `${Number(ra.distanceKm).toFixed(1)} km`
                  : null;
                return (
                  <div
                    key={r.id}
                    id={`request-${r.id}`}
                    className={`card-in bg-white rounded-[18px] overflow-hidden transition-all duration-200${flashId === r.id && !isCancelled ? " request-highlight" : ""}`}
                    style={{
                      border: `1px solid ${isCancelled ? "rgba(0,0,0,0.04)" : "rgba(0,0,0,0.07)"}`,
                      boxShadow: isCancelled
                        ? "0 1px 4px rgba(0,0,0,0.04)"
                        : "0 2px 8px rgba(0,0,0,0.06), 0 0 0 0.5px rgba(0,0,0,0.03)",
                      animation: isCancelled
                        ? "ghost-fade 1.5s ease forwards"
                        : undefined,
                    }}
                  >
                    {/* Header */}
                    <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p
                          className="text-[10px] font-mono tracking-wider"
                          style={{ color: "#aeaeb2" }}
                        >
                          #{r.id.slice(0, 8).toUpperCase()}
                        </p>
                        <p
                          className="font-semibold text-[15px] truncate mt-0.5 leading-snug"
                          style={{
                            color: "#1d1d1f",
                            fontFamily: "'Syne', sans-serif",
                          }}
                        >
                          {ra.deliveryName ??
                            r.pickup?.address?.split(",")[0]?.trim() ??
                            "Delivery Request"}
                        </p>
                        {(ra.customerName || ra.customerPhone) && (
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {ra.customerName && (
                              <span
                                className="text-[12px] font-medium"
                                style={{ color: "#3a3a3c" }}
                              >
                                {ra.customerName}
                              </span>
                            )}
                            {ra.customerPhone && (
                              <a
                                href={`tel:${ra.customerPhone}`}
                                className="text-[12px] font-semibold hover:underline"
                                style={{ color: "#009C41" }}
                              >
                                {ra.customerPhone}
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                      <StatusBadge status={r.status} />
                    </div>

                    <div
                      style={{
                        height: 1,
                        background: "rgba(0,0,0,0.05)",
                        margin: "0 16px",
                      }}
                    />

                    {/* Route with vertical connector */}
                    <div className="px-4 py-3">
                      <div className="flex gap-3">
                        <div
                          className="flex flex-col items-center flex-shrink-0"
                          style={{ width: 10, paddingTop: 3 }}
                        >
                          <div
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ background: "#009C41" }}
                          />
                          <div
                            className="w-px my-1"
                            style={{
                              background: "rgba(0,0,0,0.14)",
                              minHeight: 14,
                              flex: 1,
                            }}
                          />
                          <div
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ background: "#ef4444" }}
                          />
                        </div>
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <p
                            className="text-[12px] leading-snug"
                            style={{ color: "#3a3a3c" }}
                          >
                            <span
                              className="font-semibold"
                              style={{ color: "#1d1d1f" }}
                            >
                              Pickup{" "}
                            </span>
                            {r.pickup?.address ?? "—"}
                          </p>
                          <p
                            className="text-[12px] leading-snug"
                            style={{ color: "#3a3a3c" }}
                          >
                            <span
                              className="font-semibold"
                              style={{ color: "#1d1d1f" }}
                            >
                              Drop-off{" "}
                            </span>
                            {r.dropoff?.address ?? "—"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Meta chips */}
                    <div className="px-4 pb-3 flex flex-wrap gap-1.5">
                      <span
                        className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full"
                        style={{
                          background: "rgba(0,156,65,0.08)",
                          color: "#007a32",
                        }}
                      >
                        <Truck className="w-3 h-3" />{" "}
                        {getVehicleLabel(ra.transportType)}
                      </span>
                      {distKm && (
                        <span
                          className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full"
                          style={{
                            background: "rgba(0,0,0,0.05)",
                            color: "#6e6e73",
                          }}
                        >
                          <MapPin className="w-3 h-3" /> {distKm}
                        </span>
                      )}
                      {ra.itemWeight && (
                        <span
                          className="inline-flex items-center text-[11px] font-semibold px-2.5 py-1 rounded-full"
                          style={{
                            background: "rgba(0,0,0,0.05)",
                            color: "#6e6e73",
                          }}
                        >
                          ⚖ {ra.itemWeight}
                        </span>
                      )}
                      {ra.itemSize && (
                        <span
                          className="inline-flex items-center text-[11px] font-semibold px-2.5 py-1 rounded-full"
                          style={{
                            background: "rgba(0,0,0,0.05)",
                            color: "#6e6e73",
                          }}
                        >
                          📦 {ra.itemSize}
                        </span>
                      )}
                      {ra.isScheduled && ra.scheduledTime && (
                        <span
                          className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full"
                          style={{
                            background: "rgba(245,158,11,0.10)",
                            color: "#92400e",
                            border: "1px solid rgba(245,158,11,0.20)",
                          }}
                        >
                          <Clock className="w-3 h-3" />{" "}
                          {new Date(ra.scheduledTime).toLocaleString(
                            undefined,
                            { dateStyle: "short", timeStyle: "short" },
                          )}
                        </span>
                      )}
                    </div>

                    {/* Item description */}
                    {ra.itemDescription && (
                      <div className="px-4 pb-3">
                        <p
                          className="text-[12px] leading-relaxed rounded-[10px] px-3 py-2 line-clamp-2"
                          style={{
                            color: "#6e6e73",
                            background: "rgba(0,0,0,0.03)",
                          }}
                        >
                          {ra.itemDescription}
                        </p>
                      </div>
                    )}

                    {/* Package photo */}
                    {ra.packagePhotoUrl && (
                      <div className="px-4 pb-3">
                        <a
                          href={ra.packagePhotoUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <img
                            src={ra.packagePhotoUrl}
                            alt="Package"
                            className="w-full h-32 object-cover rounded-[12px]"
                            style={{ border: "1px solid rgba(0,0,0,0.07)" }}
                          />
                        </a>
                      </div>
                    )}

                    {/* CTA — hidden for cancelled ghosts */}
                    {!isCancelled && (
                      <div className="px-4 pb-4">
                        {alreadyQuotedIds.has(r.id) ? (
                          <div
                            className="w-full h-10 rounded-[12px] flex items-center justify-center gap-2 text-[13px] font-semibold"
                            style={{
                              background: "rgba(0,156,65,0.07)",
                              color: "#007a32",
                            }}
                          >
                            <CheckCircle className="h-4 w-4" />
                            Quote submitted — see Quotes tab
                          </div>
                        ) : expandedQuoteInput === r.id ? (
                          <div className="space-y-2">
                            <div className="flex gap-2">
                              <div className="relative flex-1">
                                <span
                                  className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold"
                                  style={{ color: "#aeaeb2" }}
                                >
                                  ₦
                                </span>
                                <input
                                  type="number"
                                  placeholder="Your price"
                                  value={quoteInputs[r.id] ?? ""}
                                  onChange={(e) =>
                                    setQuoteInputs((p) => ({
                                      ...p,
                                      [r.id]: e.target.value,
                                    }))
                                  }
                                  className="w-full h-10 pl-7 pr-3 rounded-[12px] text-sm outline-none"
                                  style={{
                                    border: "1.5px solid #009C41",
                                    background: "rgba(0,156,65,0.04)",
                                    fontFamily: "'DM Sans', sans-serif",
                                    fontSize: 16,
                                  }}
                                  autoFocus
                                />
                              </div>
                              <button
                                onClick={() => handleSubmitQuote(r.id)}
                                disabled={actioningId === r.id}
                                className="h-10 px-4 rounded-[12px] text-sm font-semibold text-white disabled:opacity-50 whitespace-nowrap transition-all active:scale-[0.97]"
                                style={{
                                  background:
                                    "linear-gradient(135deg, #009C41 0%, #007A32 100%)",
                                }}
                              >
                                {actioningId === r.id
                                  ? "Sending…"
                                  : "Send Quote"}
                              </button>
                            </div>
                            <button
                              onClick={() => setExpandedQuoteInput(null)}
                              className="w-full text-xs font-medium transition-colors"
                              style={{ color: "#aeaeb2" }}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setExpandedQuoteInput(r.id)}
                            className="w-full h-10 rounded-[12px] text-[13px] font-semibold text-white transition-all active:scale-[0.98]"
                            style={{
                              background:
                                "linear-gradient(135deg, #009C41 0%, #007A32 100%)",
                            }}
                          >
                            Submit Quote
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Active Quotes tab ────────────────────────────────────────────────── */}
      {section === "quotes" && (
        <div key="quotes" className="tab-content space-y-4">
          {activeQuotes.length === 0 ? (
            <div className="py-20 text-center">
              <div
                className="h-16 w-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: "rgba(99,102,241,0.07)" }}
              >
                <DollarSign className="h-7 w-7" style={{ color: "#6366f1" }} />
              </div>
              <p
                className="text-sm font-semibold"
                style={{ color: "#1d1d1f", fontFamily: "'Syne', sans-serif" }}
              >
                No active quotes
              </p>
              <p className="text-xs mt-1" style={{ color: "#aeaeb2" }}>
                Quotes you've submitted will appear here while awaiting customer
                response.
              </p>
            </div>
          ) : (
            activeQuotes.map((q) => {
              const isCustomerCountered = q.status === "customer_countered";
              const req = requestById.get(q.requestId);
              const reqTitle =
                (req as any)?.deliveryName ??
                req?.pickup?.address?.split(",")[0]?.trim() ??
                null;
              return (
                <div
                  key={q.id}
                  className="card-in bg-white rounded-[18px] overflow-hidden"
                  style={{
                    border: `1px solid ${isCustomerCountered ? "rgba(245,158,11,0.20)" : "rgba(0,0,0,0.07)"}`,
                    boxShadow: isCustomerCountered
                      ? "0 2px 12px rgba(245,158,11,0.10)"
                      : "0 2px 8px rgba(0,0,0,0.06)",
                  }}
                >
                  <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p
                        className="text-[10px] font-mono tracking-wider"
                        style={{ color: "#aeaeb2" }}
                      >
                        #{q.requestId.slice(0, 8).toUpperCase()}
                      </p>
                      {reqTitle && (
                        <p
                          className="font-semibold text-[15px] mt-0.5 truncate leading-snug"
                          style={{
                            color: "#1d1d1f",
                            fontFamily: "'Syne', sans-serif",
                          }}
                        >
                          {reqTitle}
                        </p>
                      )}
                      <p
                        className="text-[12px] mt-0.5"
                        style={{
                          color: isCustomerCountered ? "#92400e" : "#6e6e73",
                          fontWeight: reqTitle ? 400 : 600,
                        }}
                      >
                        {isCustomerCountered
                          ? "Customer countered your quote"
                          : "Awaiting customer response"}
                      </p>
                      {req && (
                        <div className="flex gap-2 mt-1.5 flex-wrap">
                          {req.pickup?.address && (
                            <span
                              className="text-[11px]"
                              style={{ color: "#aeaeb2" }}
                            >
                              {req.pickup.address
                                .split(",")
                                .slice(0, 2)
                                .join(",")}
                            </span>
                          )}
                          {(req as any).customerName && (
                            <span
                              className="text-[11px] font-medium"
                              style={{ color: "#3a3a3c" }}
                            >
                              · {(req as any).customerName}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <span
                      className="text-[11px] font-bold px-2.5 py-1 rounded-full flex-shrink-0"
                      style={
                        isCustomerCountered
                          ? {
                              background: "rgba(245,158,11,0.10)",
                              color: "#92400e",
                            }
                          : {
                              background: "rgba(99,102,241,0.08)",
                              color: "#4338ca",
                            }
                      }
                    >
                      {isCustomerCountered ? "Counter received" : "Pending"}
                    </span>
                  </div>

                  <div
                    style={{
                      height: 1,
                      background: "rgba(0,0,0,0.05)",
                      margin: "0 16px",
                    }}
                  />

                  {/* Negotiation history */}
                  {(q.negotiationHistory ?? []).length > 0 && (
                    <div className="px-4 py-3 space-y-2">
                      {(q.negotiationHistory ?? []).map((entry, i) => (
                        <div
                          key={i}
                          className={`flex ${entry.by === "company" ? "" : "justify-end"}`}
                        >
                          <div
                            className="text-[12px] font-semibold px-3 py-1.5 rounded-full"
                            style={
                              entry.by === "company"
                                ? {
                                    background: "rgba(0,156,65,0.09)",
                                    color: "#007a32",
                                  }
                                : {
                                    background: "rgba(99,102,241,0.10)",
                                    color: "#4338ca",
                                  }
                            }
                          >
                            {entry.by === "company" ? "You" : "Customer"}: ₦
                            {entry.price.toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Current price */}
                  <div className="px-4 pb-3">
                    <p
                      className="text-2xl font-bold tabular-nums"
                      style={{
                        color: "#1d1d1f",
                        fontFamily: "'Syne', sans-serif",
                      }}
                    >
                      ₦{q.currentPrice.toLocaleString()}
                    </p>
                  </div>

                  {/* Respond to counter */}
                  {isCustomerCountered && (
                    <div className="px-4 pb-4 space-y-2">
                      <p
                        className="text-[11px] font-semibold uppercase tracking-wider"
                        style={{ color: "#aeaeb2" }}
                      >
                        Respond to customer's counter
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleRespondToCounter(q.id, "accept")}
                          disabled={actioningId === q.id}
                          className="flex-1 h-10 rounded-[12px] text-[13px] font-semibold text-white disabled:opacity-50 transition-all active:scale-[0.97]"
                          style={{
                            background:
                              "linear-gradient(135deg, #009C41 0%, #007A32 100%)",
                          }}
                        >
                          Accept
                        </button>
                        <button
                          onClick={() =>
                            handleRespondToCounter(q.id, "decline")
                          }
                          disabled={actioningId === q.id}
                          className="flex-1 h-10 rounded-[12px] text-[13px] font-semibold transition-all active:scale-[0.97]"
                          style={{
                            border: "1.5px solid rgba(239,68,68,0.25)",
                            color: "#dc2626",
                            background: "rgba(239,68,68,0.04)",
                          }}
                        >
                          Decline
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <span
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold"
                            style={{ color: "#aeaeb2" }}
                          >
                            ₦
                          </span>
                          <input
                            type="number"
                            placeholder="Your counter"
                            value={counterInputs[q.id] ?? ""}
                            onChange={(e) =>
                              setCounterInputs((p) => ({
                                ...p,
                                [q.id]: e.target.value,
                              }))
                            }
                            className="w-full h-10 pl-7 pr-3 rounded-[12px] text-sm outline-none"
                            style={{
                              border: "1.5px solid rgba(0,0,0,0.10)",
                              background: "rgba(0,0,0,0.03)",
                              fontFamily: "'DM Sans', sans-serif",
                              fontSize: 16,
                            }}
                          />
                        </div>
                        <button
                          onClick={() =>
                            handleRespondToCounter(q.id, "counter")
                          }
                          disabled={actioningId === q.id}
                          className="h-10 px-4 rounded-[12px] text-[13px] font-semibold text-white disabled:opacity-50 whitespace-nowrap transition-all active:scale-[0.97]"
                          style={{ background: "#6366f1" }}
                        >
                          Counter
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── Assigned tab ─────────────────────────────────────────────────────── */}
      {section === "assigned" && (
        <div key="assigned" className="tab-content space-y-4">
          {loading ? (
            <>
              <RequestCardSkeleton variant="assigned" />
              <RequestCardSkeleton variant="assigned" />
            </>
          ) : assignedRequests.length === 0 ? (
            <div className="py-20 text-center">
              <div
                className="h-16 w-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: "rgba(59,130,246,0.07)" }}
              >
                <Building2 className="h-7 w-7" style={{ color: "#3b82f6" }} />
              </div>
              <p
                className="text-sm font-semibold"
                style={{ color: "#1d1d1f", fontFamily: "'Syne', sans-serif" }}
              >
                No active workflows
              </p>
              <p className="text-xs mt-1" style={{ color: "#aeaeb2" }}>
                Win a quote on an open request to start managing a delivery.
              </p>
            </div>
          ) : (
            assignedRequests.map((r) => {
              const canQuote = ["pending", "admin_review"].includes(r.status);
              const canSetPayment =
                (r.status as string) === "negotiating_price";
              const paymentProofUrl = (r as any).paymentProofUrl ?? null;
              const paymentSentAt = (r as any).paymentSentAt ?? null;
              const canConfirmPayment =
                r.status === "payment_pending" && !!paymentSentAt;
              const canAssign = r.status === "customer_confirmed";
              const driverDeclined = !!(r as any).driverDeclinedAt;
              return (
                <div
                  key={r.id}
                  className="card-in bg-white rounded-[18px] overflow-hidden"
                  style={{
                    border: "1px solid rgba(0,0,0,0.07)",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                  }}
                >
                  {/* Header */}
                  <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p
                        className="text-[10px] font-mono tracking-wider"
                        style={{ color: "#aeaeb2" }}
                      >
                        #{r.id.slice(0, 8).toUpperCase()}
                      </p>
                      <p
                        className="font-semibold text-[15px] truncate mt-0.5 leading-snug"
                        style={{
                          color: "#1d1d1f",
                          fontFamily: "'Syne', sans-serif",
                        }}
                      >
                        {(r as any).deliveryName ??
                          r.pickup?.address?.split(",")[0]?.trim() ??
                          "Delivery Request"}
                      </p>
                    </div>
                    <StatusBadge status={r.status} />
                  </div>

                  <div
                    style={{
                      height: 1,
                      background: "rgba(0,0,0,0.05)",
                      margin: "0 16px",
                    }}
                  />

                  {/* Route */}
                  <div className="px-4 py-3">
                    <div
                      className="rounded-[12px] p-3"
                      style={{ background: "rgba(0,0,0,0.025)" }}
                    >
                      <div className="flex gap-3">
                        <div
                          className="flex flex-col items-center flex-shrink-0"
                          style={{ width: 10, paddingTop: 3 }}
                        >
                          <div
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ background: "#009C41" }}
                          />
                          <div
                            className="w-px my-1"
                            style={{
                              background: "rgba(0,0,0,0.12)",
                              minHeight: 12,
                              flex: 1,
                            }}
                          />
                          <div
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ background: "#ef4444" }}
                          />
                        </div>
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <p
                            className="text-[12px] leading-snug"
                            style={{ color: "#3a3a3c" }}
                          >
                            <span
                              className="font-semibold"
                              style={{ color: "#1d1d1f" }}
                            >
                              Pickup{" "}
                            </span>
                            {r.pickup?.address ?? "—"}
                          </p>
                          <p
                            className="text-[12px] leading-snug"
                            style={{ color: "#3a3a3c" }}
                          >
                            <span
                              className="font-semibold"
                              style={{ color: "#1d1d1f" }}
                            >
                              Drop-off{" "}
                            </span>
                            {r.dropoff?.address ?? "—"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Quote input for pending / negotiating statuses */}
                  {(canQuote || canSetPayment) && (
                    <div className="px-4 pb-3">
                      <div className="flex gap-2">
                        <input
                          type="number"
                          placeholder="Quote amount (₦)"
                          value={quoteInputs[r.id] ?? ""}
                          onChange={(e) =>
                            setQuoteInputs((prev) => ({
                              ...prev,
                              [r.id]: e.target.value,
                            }))
                          }
                          className="flex-1 h-10 px-3 rounded-[12px] outline-none text-sm"
                          style={{
                            border: "1.5px solid rgba(0,0,0,0.10)",
                            background: "rgba(0,0,0,0.03)",
                            fontFamily: "'DM Sans', sans-serif",
                            fontSize: 16,
                          }}
                        />
                        <button
                          onClick={() => handleSubmitOwnedQuote(r.id)}
                          disabled={actioningId === r.id}
                          className="h-10 px-4 rounded-[12px] text-[13px] font-semibold text-white disabled:opacity-50 transition-all active:scale-[0.97] whitespace-nowrap"
                          style={{
                            background:
                              "linear-gradient(135deg, #009C41 0%, #007A32 100%)",
                          }}
                        >
                          Send Quote
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Payment proof sent by customer */}
                  {paymentSentAt && r.status === "payment_pending" && (
                    <div className="px-4 pb-3">
                      <div
                        className="rounded-[12px] overflow-hidden"
                        style={{
                          border: "1px solid rgba(0,156,65,0.20)",
                          background: "rgba(0,156,65,0.04)",
                        }}
                      >
                        <div
                          className="flex items-center gap-2 px-3 py-2.5"
                          style={{
                            borderBottom: "1px solid rgba(0,156,65,0.12)",
                          }}
                        >
                          <DollarSign
                            className="h-4 w-4 flex-shrink-0"
                            style={{ color: "#009C41" }}
                          />
                          <p
                            className="text-[12px] font-bold"
                            style={{ color: "#064e3b" }}
                          >
                            Customer marked payment as sent
                          </p>
                        </div>
                        {paymentProofUrl ? (
                          <>
                            <div
                              className="px-3 py-2 flex items-center justify-between"
                              style={{ background: "rgba(255,255,255,0.6)" }}
                            >
                              <p
                                className="text-[10px] font-bold uppercase tracking-wider"
                                style={{ color: "#009C41" }}
                              >
                                Transfer receipt
                              </p>
                              <a
                                href={paymentProofUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[10px] font-bold underline"
                                style={{ color: "#009C41" }}
                              >
                                Open full
                              </a>
                            </div>
                            <img
                              src={paymentProofUrl}
                              alt="Payment proof"
                              className="w-full object-cover max-h-48"
                            />
                          </>
                        ) : (
                          <p
                            className="text-[12px] px-3 py-2"
                            style={{ color: "#065f46" }}
                          >
                            No receipt uploaded yet.
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Confirm payment */}
                  {canConfirmPayment && (
                    <div className="px-4 pb-3">
                      <button
                        onClick={() => confirmCustomerPayment(r.id)}
                        disabled={actioningId === r.id}
                        className="w-full h-10 rounded-[12px] text-[13px] font-semibold text-white transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                        style={{
                          background:
                            "linear-gradient(135deg, #009C41 0%, #007A32 100%)",
                        }}
                      >
                        <CheckCircle className="h-4 w-4" />
                        {actioningId === r.id
                          ? "Confirming…"
                          : "Confirm Payment Received"}
                      </button>
                    </div>
                  )}

                  {/* Driver assignment panel */}
                  {canAssign && (
                    <div className="px-4 pb-4">
                      <DriverAssignPanel
                        requestId={r.id}
                        pickupLat={(r.pickup as any)?.lat ?? null}
                        pickupLng={(r.pickup as any)?.lng ?? null}
                        drivers={drivers}
                        driversLoading={driversLoading}
                        driverDeclined={driverDeclined}
                        onAssign={assignDriver}
                      />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ─── Company Notification Panel ───────────────────────────────────────────────
function CompanyNotifPanel({
  notifications,
  open,
  onClose,
  onMarkRead,
  onMarkAllRead,
}: {
  notifications: Array<AdminNotificationDoc & { id: string }>;
  open: boolean;
  onClose: () => void;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
}) {
  const [activeFilter, setActiveFilter] = useState<"All" | "Unread">("All");
  const unreadCount = notifications.filter((n) => !n.read).length;
  const displayed =
    activeFilter === "Unread"
      ? notifications.filter((n) => !n.read)
      : notifications;

  function formatTs(ts: unknown): string {
    if (!ts) return "";
    const d =
      (ts as any)?.toDate?.() ?? (typeof ts === "string" ? new Date(ts) : null);
    if (!d) return "";
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return d.toLocaleDateString("en-NG", { day: "numeric", month: "short" });
  }

  const iconForType = (type: AdminNotificationDoc["type"]) => {
    switch (type) {
      case "negotiation_request":
        return {
          Icon: Phone,
          bg: "bg-sky-50",
          color: "text-sky-600",
          label: "Negotiation",
        };
      case "payment_sent":
        return {
          Icon: Banknote,
          bg: "bg-emerald-50",
          color: "text-emerald-600",
          label: "Payment",
        };
      case "delivery_proof":
        return {
          Icon: ImageIcon,
          bg: "bg-violet-50",
          color: "text-violet-600",
          label: "Proof",
        };
      case "driver_completed":
        return {
          Icon: CheckCircle,
          bg: "bg-teal-50",
          color: "text-teal-600",
          label: "Completed",
        };
      default:
        return {
          Icon: Bell,
          bg: "bg-gray-100",
          color: "text-gray-500",
          label: "Alert",
        };
    }
  };

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
          onClick={onClose}
        />
      )}
      <div
        className={`fixed top-0 right-0 z-50 h-full w-full sm:w-[400px] bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-out dash-font ${open ? "translate-x-0" : "translate-x-full"}`}
        style={{
          boxShadow: "0 0 40px rgba(0,0,0,0.18)",
          paddingTop: "env(safe-area-inset-top, 0px)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div
              className="h-9 w-9 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(0,156,65,0.10)" }}
            >
              <BellRing className="h-5 w-5" style={{ color: "#009C41" }} />
            </div>
            <div>
              <h2
                className="font-bold text-gray-900 text-sm"
                style={{ fontFamily: "'Syne', sans-serif" }}
              >
                Notifications
              </h2>
              <p className="text-xs text-gray-400">
                {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={onMarkAllRead}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                style={{ color: "#009C41", background: "rgba(0,156,65,0.08)" }}
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
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${activeFilter === tab ? "text-white" : "text-gray-500 hover:bg-gray-100"}`}
              style={activeFilter === tab ? { background: "#009C41" } : {}}
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

        {/* List */}
        <div className="flex-1 overflow-y-auto dash-scroll">
          {displayed.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
              <div className="h-16 w-16 rounded-2xl bg-gray-100 flex items-center justify-center">
                <Bell className="h-7 w-7 text-gray-300" />
              </div>
              <p className="font-semibold text-gray-500 text-sm">
                {activeFilter === "Unread"
                  ? "No unread notifications"
                  : "No notifications yet"}
              </p>
              <p className="text-xs text-gray-400">
                {activeFilter === "Unread"
                  ? "You're all caught up!"
                  : "Payment confirmations and delivery updates will appear here"}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {displayed.map((n) => {
                const { Icon, bg, color, label } = iconForType(n.type);
                return (
                  <div
                    key={n.id}
                    className={`flex gap-3.5 px-4 py-4 cursor-pointer hover:bg-gray-50 transition-colors relative ${!n.read ? "bg-green-50/40" : ""}`}
                    onClick={() => {
                      if (!n.read) onMarkRead(n.id);
                    }}
                  >
                    {!n.read && (
                      <div
                        className="absolute left-0 top-0 bottom-0 w-0.5 rounded-r-full"
                        style={{ background: "#009C41" }}
                      />
                    )}
                    <div
                      className={`h-10 w-10 rounded-xl ${bg} flex items-center justify-center flex-shrink-0 mt-0.5`}
                    >
                      <Icon className={`h-5 w-5 ${color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={`text-sm leading-snug ${!n.read ? "font-semibold text-gray-900" : "font-medium text-gray-700"}`}
                        >
                          {n.message}
                        </p>
                        {!n.read && (
                          <div
                            className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                            style={{ background: "#009C41" }}
                          />
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${bg} ${color}`}
                        >
                          {label}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {formatTs(n.createdAt)}
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

        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/50">
          <p className="text-xs text-center text-gray-400">
            Showing notifications for your company's deliveries
          </p>
        </div>
      </div>
    </>
  );
}

// ─── Notification toast deduplication helpers ──────────────────────────────────
// Persists seen notification IDs in localStorage so dismissed toasts never
// re-appear across page refreshes. Keyed by companyId to avoid cross-account leaks.
function _seenKey(companyId: string) {
  return `pilnak_notif_seen_${companyId}`;
}
function getSeenNotifIds(companyId: string): Set<string> {
  try {
    const raw = localStorage.getItem(_seenKey(companyId));
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}
function persistSeenNotifId(companyId: string, id: string): void {
  try {
    const existing = getSeenNotifIds(companyId);
    existing.add(id);
    localStorage.setItem(_seenKey(companyId), JSON.stringify([...existing]));
  } catch {}
}

// ─── Tab: Analytics ───────────────────────────────────────────────────────────
type RangeKey = "7d" | "30d" | "90d" | "all";

const RANGE_OPTS: Array<{ key: RangeKey; label: string }> = [
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "90d", label: "3 months" },
  { key: "all", label: "All time" },
];

function tsToMs(ts: unknown): number {
  if (!ts) return 0;
  const fsTs = ts as { toDate?: () => Date };
  if (fsTs?.toDate) return fsTs.toDate().getTime();
  const d = new Date(ts as string | number);
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

function dayFloor(d: Date): number {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c.getTime();
}

function fmtNgn(n: number): string {
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `₦${(n / 1_000).toFixed(1)}K`;
  return `₦${n.toLocaleString()}`;
}

interface NormDelivery {
  id: string;
  ms: number;
  price: number;
  driverId: string | null;
  driverName: string | null;
  hasPrice: boolean;
}

// ── Donut chart (defined outside AnalyticsTab to avoid remount on every render)
function AnalyticsDonut({
  data,
  label,
}: {
  data: Array<{ name: string; value: number; color: string }>;
  label: string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (!total)
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-2">
        <div
          className="h-10 w-10 rounded-full flex items-center justify-center"
          style={{ background: "#f2f4f7" }}
        >
          <AlertCircle className="h-5 w-5" style={{ color: "#9ba3af" }} />
        </div>
        <p className="text-xs font-medium" style={{ color: "#9ba3af" }}>
          No data
        </p>
      </div>
    );
  return (
    <div>
      <div className="relative">
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              innerRadius={56}
              outerRadius={78}
              paddingAngle={2}
              startAngle={90}
              endAngle={-270}
              strokeWidth={0}
            >
              {data.map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Pie>
            <RechartsTooltip
              contentStyle={{
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: "10px",
                boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 12,
                padding: "8px 12px",
              }}
              formatter={(v: number, name: string) => [
                `${v} (${((v / total) * 100).toFixed(0)}%)`,
                name,
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span
            className="text-[24px] font-bold leading-none"
            style={{
              fontFamily: "'Syne', sans-serif",
              color: "#0f1117",
            }}
          >
            {total}
          </span>
          <span
            className="text-[10px] font-semibold mt-1 uppercase tracking-wider"
            style={{ color: "#9ba3af", fontFamily: "'DM Sans', sans-serif" }}
          >
            {label}
          </span>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 justify-center px-2">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-full flex-shrink-0"
              style={{ background: d.color }}
            />
            <span
              className="text-[11px] font-medium"
              style={{ color: "#5a6070", fontFamily: "'DM Sans', sans-serif" }}
            >
              {d.name}
            </span>
            <span
              className="text-[11px] font-bold"
              style={{ color: "#0f1117", fontFamily: "'DM Sans', sans-serif" }}
            >
              {d.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Custom tooltip for area / bar charts
interface TipEntry {
  name: string;
  value: number;
  color?: string;
  fill?: string;
}
function AnalyticsTip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TipEntry[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: "12px",
        boxShadow: "0 8px 24px rgba(0,0,0,0.10)",
        padding: "10px 14px",
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      <p
        className="text-[11px] font-semibold mb-1.5"
        style={{ color: "#9ba3af" }}
      >
        {label}
      </p>
      {payload.map((p, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: p.color ?? p.fill }}
          />
          <span
            className="text-[12px] font-semibold"
            style={{ color: "#0f1117" }}
          >
            {p.name === "revenue" ? fmtNgn(p.value) : p.value}
          </span>
          <span className="text-[11px]" style={{ color: "#9ba3af" }}>
            {p.name === "revenue" ? "revenue" : "deliveries"}
          </span>
        </div>
      ))}
    </div>
  );
}

function AnalyticsTab({
  drivers,
  fleet,
  deliveries,
  history,
  ownedRequests,
  loading,
}: {
  drivers: Array<CompanyDriver & { id: string }>;
  fleet: Array<FleetVehicle & { id: string }>;
  deliveries: Array<CompanyDelivery & { id: string }>;
  history: Array<CompanyDelivery & { id: string }>;
  ownedRequests: CompanyWorkflowRequest[];
  loading: boolean;
}) {
  const [range, setRange] = useState<RangeKey>("30d");

  // ── Normalise completed deliveries from both data sources ──────────────────
  const allCompleted = useMemo<NormDelivery[]>(() => {
    const out: NormDelivery[] = [];
    for (const d of history) {
      const ms = tsToMs(d.completedAt) || tsToMs(d.createdAt);
      const price = d.finalPrice ?? 0;
      out.push({
        id: d.id!,
        ms,
        price,
        driverId: d.driverId ?? null,
        driverName: d.driverName ?? null,
        hasPrice: price > 0,
      });
    }
    for (const r of ownedRequests) {
      if (r.status !== "completed") continue;
      const ms = tsToMs(r.updatedAt) || tsToMs(r.createdAt);
      const price = r.finalPrice ?? r.quotedPrice ?? r.estimatedPrice ?? 0;
      out.push({
        id: r.id,
        ms,
        price,
        driverId: null,
        driverName: null,
        hasPrice: price > 0,
      });
    }
    return out;
  }, [history, ownedRequests]);

  // ── Time-range cutoff ──────────────────────────────────────────────────────
  const cutoffMs = useMemo(() => {
    if (range === "all") return 0;
    const d = new Date();
    if (range === "7d") d.setDate(d.getDate() - 7);
    else if (range === "30d") d.setDate(d.getDate() - 30);
    else d.setDate(d.getDate() - 90);
    return d.getTime();
  }, [range]);

  const filtered = useMemo(
    () =>
      cutoffMs ? allCompleted.filter((d) => d.ms >= cutoffMs) : allCompleted,
    [allCompleted, cutoffMs],
  );

  // ── Missing price count ────────────────────────────────────────────────────
  const missingPriceCount = filtered.filter((d) => !d.hasPrice).length;

  // ── KPI metrics ───────────────────────────────────────────────────────────
  const totalRevenue = filtered.reduce((s, d) => s + d.price, 0);
  const totalCompleted = filtered.length;
  const avgValue = totalCompleted > 0 ? totalRevenue / totalCompleted : 0;

  const cancelledCount = useMemo(() => {
    let n = 0;
    for (const d of deliveries) {
      if (d.status !== "cancelled") continue;
      const ms = tsToMs(d.updatedAt) || tsToMs(d.createdAt);
      if (!cutoffMs || ms >= cutoffMs) n++;
    }
    for (const r of ownedRequests) {
      if (r.status !== "cancelled") continue;
      const ms = tsToMs(r.updatedAt) || tsToMs(r.createdAt);
      if (!cutoffMs || ms >= cutoffMs) n++;
    }
    return n;
  }, [deliveries, ownedRequests, cutoffMs]);

  const completionRate =
    totalCompleted + cancelledCount > 0
      ? (totalCompleted / (totalCompleted + cancelledCount)) * 100
      : 0;

  // ── Revenue + volume trend data ────────────────────────────────────────────
  const trendData = useMemo(() => {
    const todayStart = dayFloor(new Date());

    if (range === "7d") {
      return Array.from({ length: 7 }, (_, i) => {
        const dayStart = todayStart - (6 - i) * 86_400_000;
        const items = filtered.filter(
          (d) => d.ms >= dayStart && d.ms < dayStart + 86_400_000,
        );
        return {
          label: new Date(dayStart).toLocaleDateString("en-GB", {
            weekday: "short",
          }),
          revenue: items.reduce((s, d) => s + d.price, 0),
          deliveries: items.length,
        };
      });
    }

    if (range === "30d") {
      return Array.from({ length: 30 }, (_, i) => {
        const dayStart = todayStart - (29 - i) * 86_400_000;
        const items = filtered.filter(
          (d) => d.ms >= dayStart && d.ms < dayStart + 86_400_000,
        );
        return {
          label: new Date(dayStart).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
          }),
          revenue: items.reduce((s, d) => s + d.price, 0),
          deliveries: items.length,
        };
      });
    }

    if (range === "90d") {
      return Array.from({ length: 13 }, (_, i) => {
        const weekStart = todayStart - (12 - i) * 7 * 86_400_000;
        const weekEnd = weekStart + 7 * 86_400_000;
        const items = filtered.filter(
          (d) => d.ms >= weekStart && d.ms < weekEnd,
        );
        return {
          label: new Date(weekStart).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
          }),
          revenue: items.reduce((s, d) => s + d.price, 0),
          deliveries: items.length,
        };
      });
    }

    // "all" — monthly buckets
    if (!filtered.length) return [];
    const validMs = filtered.map((d) => d.ms).filter((m) => m > 0);
    if (!validMs.length) return [];
    const minDate = new Date(Math.min(...validMs));
    minDate.setDate(1);
    minDate.setHours(0, 0, 0, 0);
    const endDate = new Date();
    endDate.setDate(1);
    endDate.setHours(0, 0, 0, 0);
    const buckets: Array<{
      label: string;
      revenue: number;
      deliveries: number;
    }> = [];
    const cursor = new Date(minDate);
    while (cursor <= endDate) {
      const mStart = cursor.getTime();
      cursor.setMonth(cursor.getMonth() + 1);
      const mEnd = cursor.getTime();
      const items = filtered.filter((d) => d.ms >= mStart && d.ms < mEnd);
      buckets.push({
        label: new Date(mStart).toLocaleDateString("en-GB", {
          month: "short",
          year: "2-digit",
        }),
        revenue: items.reduce((s, d) => s + d.price, 0),
        deliveries: items.length,
      });
    }
    return buckets;
  }, [range, filtered]);

  // ── Per-driver leaderboard ─────────────────────────────────────────────────
  const topDrivers = useMemo(() => {
    const map: Record<
      string,
      { name: string; deliveries: number; revenue: number }
    > = {};
    for (const d of filtered) {
      if (!d.driverId) continue;
      if (!map[d.driverId])
        map[d.driverId] = {
          name: d.driverName ?? "Unknown Driver",
          deliveries: 0,
          revenue: 0,
        };
      map[d.driverId].deliveries++;
      map[d.driverId].revenue += d.price;
    }
    return Object.entries(map)
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.deliveries - a.deliveries)
      .slice(0, 5);
  }, [filtered]);

  // ── Delivery status breakdown (all sources, not time-filtered) ─────────────
  const statusBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    // deliveries already includes history items (same collection), so don't double-count
    for (const d of deliveries) counts[d.status] = (counts[d.status] ?? 0) + 1;
    for (const r of ownedRequests)
      counts[r.status] = (counts[r.status] ?? 0) + 1;

    const colorMap: Record<string, string> = {
      completed: "#009C41",
      in_progress: "#3b82f6",
      assigned: "#60a5fa",
      driver_assigned: "#60a5fa",
      driver_accepted: "#34d399",
      pending: "#f59e0b",
      admin_review: "#8b5cf6",
      negotiating: "#06b6d4",
      price_set: "#f97316",
      payment_pending: "#a78bfa",
      customer_confirmed: "#10b981",
      cancelled: "#ef4444",
      arrived: "#14b8a6",
      awaiting_signature: "#fbbf24",
    };
    const displayNames: Record<string, string> = {
      completed: "Completed",
      in_progress: "In Progress",
      assigned: "Assigned",
      driver_assigned: "Driver Assigned",
      driver_accepted: "Driver Accepted",
      pending: "Pending",
      admin_review: "Admin Review",
      negotiating: "Negotiating",
      price_set: "Price Set",
      payment_pending: "Payment Pending",
      customer_confirmed: "Confirmed",
      cancelled: "Cancelled",
      arrived: "Arrived",
      awaiting_signature: "Awaiting Sign",
    };
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([status, value]) => ({
        name: displayNames[status] ?? status,
        value,
        color: colorMap[status] ?? "#9ca3af",
      }))
      .sort((a, b) => b.value - a.value);
  }, [deliveries, ownedRequests]);

  // ── Fleet utilization (current snapshot) ──────────────────────────────────
  const fleetBreakdown = useMemo(() => {
    const c = { available: 0, in_use: 0, maintenance: 0, retired: 0 };
    for (const v of fleet) c[v.status as keyof typeof c]++;
    return [
      { name: "Available", value: c.available, color: "#009C41" },
      { name: "In Use", value: c.in_use, color: "#3b82f6" },
      { name: "Maintenance", value: c.maintenance, color: "#f59e0b" },
      { name: "Retired", value: c.retired, color: "#9ca3af" },
    ].filter((d) => d.value > 0);
  }, [fleet]);

  // ── Driver availability (current snapshot) ────────────────────────────────
  const driverBreakdown = useMemo(() => {
    let online = 0,
      offline = 0,
      inactive = 0,
      suspended = 0;
    for (const d of drivers) {
      if (d.status === "suspended") {
        suspended++;
        continue;
      }
      if (d.status === "inactive") {
        inactive++;
        continue;
      }
      if (d.isOnline) online++;
      else offline++;
    }
    return [
      { name: "Online", value: online, color: "#009C41" },
      { name: "Offline", value: offline, color: "#9ca3af" },
      { name: "Inactive", value: inactive, color: "#f59e0b" },
      { name: "Suspended", value: suspended, color: "#ef4444" },
    ].filter((d) => d.value > 0);
  }, [drivers]);

  // ── X-axis tick density ────────────────────────────────────────────────────
  const xTickInterval =
    range === "7d" ? 0 : range === "30d" ? 4 : range === "90d" ? 1 : 0;

  const hasAnyData =
    allCompleted.length > 0 ||
    deliveries.length > 0 ||
    fleet.length > 0 ||
    drivers.length > 0;

  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2
          className="h-8 w-8 animate-spin"
          style={{ color: "#009C41" }}
        />
      </div>
    );

  // ── KPI card config ────────────────────────────────────────────────────────
  const rateColor =
    completionRate >= 80
      ? "#009C41"
      : completionRate >= 60
        ? "#f59e0b"
        : "#ef4444";
  const rateBg =
    completionRate >= 80
      ? "rgba(0,156,65,0.08)"
      : completionRate >= 60
        ? "rgba(245,158,11,0.08)"
        : "rgba(239,68,68,0.08)";

  const kpis = [
    {
      label: "Total Revenue",
      value: fmtNgn(totalRevenue),
      sub: range === "all" ? "all time" : `last ${range}`,
      icon: Banknote,
      color: "#009C41",
      bg: "rgba(0,156,65,0.08)",
    },
    {
      label: "Completed",
      value: totalCompleted.toString(),
      sub: "deliveries",
      icon: CheckCircle,
      color: "#3b82f6",
      bg: "rgba(59,130,246,0.08)",
    },
    {
      label: "Avg. Value",
      value: fmtNgn(avgValue),
      sub: "per delivery",
      icon: TrendingUp,
      color: "#8b5cf6",
      bg: "rgba(139,92,246,0.08)",
    },
    {
      label: "Completion Rate",
      value: `${completionRate.toFixed(0)}%`,
      sub:
        cancelledCount > 0 ? `${cancelledCount} cancelled` : "no cancellations",
      icon: Activity,
      color: rateColor,
      bg: rateBg,
    },
  ] as const;

  const noTrendRevenue =
    !trendData.length || trendData.every((d) => d.revenue === 0);
  const noTrendVol =
    !trendData.length || trendData.every((d) => d.deliveries === 0);
  const MEDALS = ["🥇", "🥈", "🥉"];

  return (
    <div className="space-y-5 dash-font">
      {/* ── Page header + period selector ──────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2
            className="text-[19px] font-bold leading-tight"
            style={{ fontFamily: "'Syne', sans-serif", color: "#0f1117" }}
          >
            Analytics
          </h2>
          <p
            className="text-[12px] mt-0.5"
            style={{ color: "#9ba3af", fontFamily: "'DM Sans', sans-serif" }}
          >
            Performance overview for your fleet
          </p>
        </div>
        <div
          className="flex items-center gap-0.5 p-1 rounded-xl self-start sm:self-auto"
          style={{ background: "#edf0f4" }}
        >
          {RANGE_OPTS.map((o) => (
            <button
              key={o.key}
              onClick={() => setRange(o.key)}
              className="px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all"
              style={{
                fontFamily: "'DM Sans', sans-serif",
                background: range === o.key ? "#fff" : "transparent",
                color: range === o.key ? "#009C41" : "#9ba3af",
                boxShadow:
                  range === o.key ? "0 1px 4px rgba(0,0,0,0.10)" : "none",
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Missing price warning ───────────────────────────────────────────── */}
      {missingPriceCount > 0 && (
        <div
          className="flex items-start gap-3 px-4 py-3.5 rounded-2xl"
          style={{ background: "#fffbeb", border: "1px solid #fde68a" }}
        >
          <AlertTriangle
            className="h-4 w-4 mt-0.5 flex-shrink-0"
            style={{ color: "#d97706" }}
          />
          <div>
            <p
              className="text-[13px] font-semibold"
              style={{
                color: "#92400e",
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              {missingPriceCount}{" "}
              {missingPriceCount === 1 ? "delivery is" : "deliveries are"}{" "}
              missing price data
            </p>
            <p
              className="text-[12px] mt-0.5 leading-relaxed"
              style={{
                color: "#b45309",
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              Revenue figures are understated — these completed deliveries have
              no recorded final price.
            </p>
          </div>
        </div>
      )}

      {/* ── KPI cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((kpi, i) => (
          <div
            key={i}
            className="rounded-[18px] p-4 card-in"
            style={{
              background: "#fff",
              boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
              border: "1px solid rgba(0,0,0,0.04)",
            }}
          >
            <div className="flex items-start justify-between gap-2 mb-3">
              <div
                className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: kpi.bg }}
              >
                <kpi.icon
                  className="h-[18px] w-[18px]"
                  style={{ color: kpi.color }}
                />
              </div>
              <span
                className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full truncate max-w-[90px]"
                style={{
                  background: kpi.bg,
                  color: kpi.color,
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                {kpi.sub}
              </span>
            </div>
            <p
              className="text-[22px] font-bold leading-none"
              style={{
                fontFamily: "'Syne', sans-serif",
                color: "#0f1117",
              }}
            >
              {kpi.value}
            </p>
            <p
              className="text-[12px] mt-1.5 font-medium"
              style={{ color: "#9ba3af", fontFamily: "'DM Sans', sans-serif" }}
            >
              {kpi.label}
            </p>
          </div>
        ))}
      </div>

      {/* ── Revenue trend (area chart) ──────────────────────────────────────── */}
      <div
        className="rounded-[20px] p-5 card-in"
        style={{
          background: "#fff",
          boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
          border: "1px solid rgba(0,0,0,0.04)",
        }}
      >
        <div className="flex items-start justify-between mb-5">
          <div>
            <p
              className="text-[14px] font-bold"
              style={{ fontFamily: "'Syne', sans-serif", color: "#0f1117" }}
            >
              Revenue
            </p>
            <p
              className="text-[11px] mt-0.5"
              style={{ color: "#9ba3af", fontFamily: "'DM Sans', sans-serif" }}
            >
              {noTrendRevenue
                ? "No revenue recorded in this period"
                : `${fmtNgn(totalRevenue)} earned`}
            </p>
          </div>
          <div
            className="h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(0,156,65,0.08)" }}
          >
            <TrendingUp className="h-4 w-4" style={{ color: "#009C41" }} />
          </div>
        </div>
        {noTrendRevenue ? (
          <div
            className="flex flex-col items-center justify-center gap-2 rounded-2xl"
            style={{ height: 180, background: "#fafbfc" }}
          >
            <BarChart2 className="h-7 w-7" style={{ color: "#d1d5db" }} />
            <p className="text-[13px] font-medium" style={{ color: "#9ba3af" }}>
              No revenue data for this period
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart
              data={trendData}
              margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="anlRevGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#009C41" stopOpacity={0.16} />
                  <stop offset="95%" stopColor="#009C41" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#f0f2f5"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{
                  fontSize: 10,
                  fontFamily: "'DM Sans', sans-serif",
                  fill: "#9ba3af",
                }}
                axisLine={false}
                tickLine={false}
                interval={xTickInterval}
              />
              <YAxis
                tick={{
                  fontSize: 10,
                  fontFamily: "'DM Sans', sans-serif",
                  fill: "#9ba3af",
                }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => fmtNgn(v)}
                width={54}
              />
              <RechartsTooltip content={<AnalyticsTip />} />
              <Area
                type="monotone"
                dataKey="revenue"
                name="revenue"
                stroke="#009C41"
                strokeWidth={2}
                fill="url(#anlRevGrad)"
                dot={false}
                activeDot={{ r: 4, fill: "#009C41", strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Delivery volume (bar) + Status breakdown (donut) ───────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Delivery volume */}
        <div
          className="rounded-[20px] p-5 card-in"
          style={{
            background: "#fff",
            boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
            border: "1px solid rgba(0,0,0,0.04)",
          }}
        >
          <div className="flex items-start justify-between mb-5">
            <div>
              <p
                className="text-[14px] font-bold"
                style={{
                  fontFamily: "'Syne', sans-serif",
                  color: "#0f1117",
                }}
              >
                Delivery Volume
              </p>
              <p
                className="text-[11px] mt-0.5"
                style={{
                  color: "#9ba3af",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                Completed deliveries over time
              </p>
            </div>
            <div
              className="h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(59,130,246,0.08)" }}
            >
              <Package className="h-4 w-4" style={{ color: "#3b82f6" }} />
            </div>
          </div>
          {noTrendVol ? (
            <div
              className="flex flex-col items-center justify-center gap-2 rounded-2xl"
              style={{ height: 160, background: "#fafbfc" }}
            >
              <Package className="h-7 w-7" style={{ color: "#d1d5db" }} />
              <p
                className="text-[13px] font-medium"
                style={{ color: "#9ba3af" }}
              >
                No deliveries in this period
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart
                data={trendData}
                margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
                barSize={range === "30d" ? 7 : range === "7d" ? 22 : 12}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#f0f2f5"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tick={{
                    fontSize: 10,
                    fontFamily: "'DM Sans', sans-serif",
                    fill: "#9ba3af",
                  }}
                  axisLine={false}
                  tickLine={false}
                  interval={xTickInterval}
                />
                <YAxis
                  tick={{
                    fontSize: 10,
                    fontFamily: "'DM Sans', sans-serif",
                    fill: "#9ba3af",
                  }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                  width={28}
                />
                <RechartsTooltip content={<AnalyticsTip />} />
                <Bar
                  dataKey="deliveries"
                  name="deliveries"
                  fill="#3b82f6"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Status breakdown */}
        <div
          className="rounded-[20px] p-5 card-in"
          style={{
            background: "#fff",
            boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
            border: "1px solid rgba(0,0,0,0.04)",
          }}
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <p
                className="text-[14px] font-bold"
                style={{
                  fontFamily: "'Syne', sans-serif",
                  color: "#0f1117",
                }}
              >
                Delivery Status
              </p>
              <p
                className="text-[11px] mt-0.5"
                style={{
                  color: "#9ba3af",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                Current pipeline breakdown
              </p>
            </div>
            <div
              className="h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(139,92,246,0.08)" }}
            >
              <Activity className="h-4 w-4" style={{ color: "#8b5cf6" }} />
            </div>
          </div>
          <AnalyticsDonut data={statusBreakdown} label="total" />
        </div>
      </div>

      {/* ── Fleet utilization + Driver availability ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Fleet */}
        <div
          className="rounded-[20px] p-5 card-in"
          style={{
            background: "#fff",
            boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
            border: "1px solid rgba(0,0,0,0.04)",
          }}
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <p
                className="text-[14px] font-bold"
                style={{
                  fontFamily: "'Syne', sans-serif",
                  color: "#0f1117",
                }}
              >
                Fleet Utilization
              </p>
              <p
                className="text-[11px] mt-0.5"
                style={{
                  color: "#9ba3af",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                {fleet.length} vehicle{fleet.length !== 1 ? "s" : ""} registered
              </p>
            </div>
            <div
              className="h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(0,156,65,0.08)" }}
            >
              <Car className="h-4 w-4" style={{ color: "#009C41" }} />
            </div>
          </div>
          <AnalyticsDonut data={fleetBreakdown} label="vehicles" />
        </div>

        {/* Drivers */}
        <div
          className="rounded-[20px] p-5 card-in"
          style={{
            background: "#fff",
            boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
            border: "1px solid rgba(0,0,0,0.04)",
          }}
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <p
                className="text-[14px] font-bold"
                style={{
                  fontFamily: "'Syne', sans-serif",
                  color: "#0f1117",
                }}
              >
                Driver Availability
              </p>
              <p
                className="text-[11px] mt-0.5"
                style={{
                  color: "#9ba3af",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                {drivers.length} driver{drivers.length !== 1 ? "s" : ""}{" "}
                registered
              </p>
            </div>
            <div
              className="h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(16,185,129,0.08)" }}
            >
              <UserCheck className="h-4 w-4" style={{ color: "#10b981" }} />
            </div>
          </div>
          <AnalyticsDonut data={driverBreakdown} label="drivers" />
        </div>
      </div>

      {/* ── Top drivers leaderboard ─────────────────────────────────────────── */}
      <div
        className="rounded-[20px] p-5 card-in"
        style={{
          background: "#fff",
          boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
          border: "1px solid rgba(0,0,0,0.04)",
        }}
      >
        <div className="flex items-start justify-between mb-5">
          <div>
            <p
              className="text-[14px] font-bold"
              style={{ fontFamily: "'Syne', sans-serif", color: "#0f1117" }}
            >
              Top Drivers
            </p>
            <p
              className="text-[11px] mt-0.5"
              style={{ color: "#9ba3af", fontFamily: "'DM Sans', sans-serif" }}
            >
              Ranked by deliveries completed in period
            </p>
          </div>
          <div
            className="h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(251,191,36,0.12)" }}
          >
            <Star className="h-4 w-4" style={{ color: "#d97706" }} />
          </div>
        </div>
        {topDrivers.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center gap-2 rounded-2xl"
            style={{ height: 120, background: "#fafbfc" }}
          >
            <Truck className="h-7 w-7" style={{ color: "#d1d5db" }} />
            <p className="text-[13px] font-medium" style={{ color: "#9ba3af" }}>
              {allCompleted.length === 0
                ? "No completed deliveries yet"
                : "No driver attribution data in this period"}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {topDrivers.map((d, i) => {
              const pct =
                (d.deliveries / (topDrivers[0]?.deliveries ?? 1)) * 100;
              const barColor =
                i === 0
                  ? "#009C41"
                  : i === 1
                    ? "#3b82f6"
                    : i === 2
                      ? "#8b5cf6"
                      : "#9ca3af";
              return (
                <div key={d.id} className="flex items-center gap-3">
                  {/* Rank */}
                  <div className="w-7 flex-shrink-0 text-center">
                    {i < 3 ? (
                      <span className="text-[15px]">{MEDALS[i]}</span>
                    ) : (
                      <span
                        className="text-[12px] font-bold"
                        style={{
                          color: "#9ba3af",
                          fontFamily: "'DM Sans', sans-serif",
                        }}
                      >
                        #{i + 1}
                      </span>
                    )}
                  </div>
                  {/* Avatar */}
                  <div
                    className="h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0 text-[11px] font-bold text-white"
                    style={{
                      background:
                        "linear-gradient(135deg, #009C41 0%, #007A32 100%)",
                    }}
                  >
                    {getInitials(d.name)}
                  </div>
                  {/* Bar + info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <p
                        className="text-[13px] font-semibold truncate mr-2"
                        style={{
                          color: "#0f1117",
                          fontFamily: "'DM Sans', sans-serif",
                        }}
                      >
                        {d.name}
                      </p>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span
                          className="text-[11px] font-semibold"
                          style={{
                            color: "#009C41",
                            fontFamily: "'DM Sans', sans-serif",
                          }}
                        >
                          {fmtNgn(d.revenue)}
                        </span>
                        <span
                          className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                          style={{
                            background: "#f0fdf4",
                            color: "#009C41",
                            fontFamily: "'DM Sans', sans-serif",
                          }}
                        >
                          {d.deliveries} {d.deliveries === 1 ? "trip" : "trips"}
                        </span>
                      </div>
                    </div>
                    <div
                      className="h-1.5 rounded-full overflow-hidden"
                      style={{ background: "#f0f2f5" }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${pct}%`,
                          background: barColor,
                          transition: "width 600ms ease",
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Truly empty state ──────────────────────────────────────────────── */}
      {!hasAnyData && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div
            className="h-16 w-16 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(0,156,65,0.08)" }}
          >
            <BarChart2 className="h-8 w-8" style={{ color: "#009C41" }} />
          </div>
          <p
            className="text-[15px] font-bold"
            style={{ fontFamily: "'Syne', sans-serif", color: "#0f1117" }}
          >
            No analytics data yet
          </p>
          <p
            className="text-[13px] text-center max-w-xs"
            style={{ color: "#9ba3af", fontFamily: "'DM Sans', sans-serif" }}
          >
            Analytics will populate as your drivers complete deliveries and
            manage your fleet.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function CompanyDashboard() {
  const navigate = useNavigate();
  const { user, company, companyId, isLoading, isApproved, signOut } =
    useCompanyAuth();

  const [activeTab, setActiveTab] = useSessionState<Tab>(
    "company_activeTab",
    "dashboard",
  );
  const [highlightedRequestId, setHighlightedRequestId] = useState<string | null>(null);
  const [mobileSidebarOpen, setMobile] = useState(false);
  const [moreSheetOpen, setMoreSheetOpen] = useState(false);
  const [adminNotifications, setAdminNotifications] = useState<
    Array<AdminNotificationDoc & { id: string }>
  >([]);
  const [notifPanelOpen, setNotifPanelOpen] = useState(false);
  const knownCompanyNotifIds = useRef<Set<string> | null>(null);

  const [drivers, setDrivers] = useState<Array<CompanyDriver & { id: string }>>(
    [],
  );
  const [fleet, setFleet] = useState<Array<FleetVehicle & { id: string }>>([]);
  const [deliveries, setDeliveries] = useState<
    Array<CompanyDelivery & { id: string }>
  >([]);
  const [history, setHistory] = useState<
    Array<CompanyDelivery & { id: string }>
  >([]);
  const [openCompanyRequests, setOpenCompanyRequests] = useState<
    CompanyWorkflowRequest[]
  >([]);
  const [ownedCompanyRequests, setOwnedCompanyRequests] = useState<
    CompanyWorkflowRequest[]
  >([]);
  const [activeQuotes, setActiveQuotes] = useState<
    Array<DeliveryQuoteDoc & { id: string }>
  >([]);
  const [cancelledGhosts, setCancelledGhosts] = useState<
    CompanyWorkflowRequest[]
  >([]);
  const prevOpenRequestsRef = useRef<CompanyWorkflowRequest[]>([]);

  const [driversLoading, setDriversLoading] = useState(true);
  const [fleetLoading, setFleetLoading] = useState(true);
  const [deliveriesLoading, setDeliveriesLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [companyRequestsLoading, setCompanyRequestsLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && !user) navigate("/auth");
  }, [isLoading, user, navigate]);

  useEffect(() => {
    if (!companyId) return;
    const unsubs = [
      listenCompanyDrivers(companyId, (d) => {
        setDrivers(d);
        setDriversLoading(false);
      }),
      listenCompanyFleet(companyId, (f) => {
        setFleet(f);
        setFleetLoading(false);
      }),
      listenCompanyDeliveries(companyId, (d) => {
        setDeliveries(d);
        setDeliveriesLoading(false);
      }),
      listenCompanyHistory(companyId, (h) => {
        setHistory(h);
        setHistoryLoading(false);
      }),
      listenOpenCompanyRequests((docs) => {
        const prev = prevOpenRequestsRef.current;
        prevOpenRequestsRef.current = docs;
        const incomingIds = new Set(docs.map((d) => d.id));
        const removed = prev.filter((r) => !incomingIds.has(r.id));
        removed.forEach(async (r) => {
          const status = await getDeliveryRequestStatus(r.id);
          if (status === "cancelled") {
            setCancelledGhosts((g) =>
              g.some((x) => x.id === r.id)
                ? g
                : [
                    ...g,
                    { ...r, status: "cancelled" } as CompanyWorkflowRequest,
                  ],
            );
            setTimeout(() => {
              setCancelledGhosts((g) => g.filter((x) => x.id !== r.id));
            }, 1_800_000);
          }
        });
        setOpenCompanyRequests(docs);
        setCompanyRequestsLoading(false);
      }),
      listenCompanyWorkflowRequests(companyId, (docs) => {
        setOwnedCompanyRequests(docs);
        setCompanyRequestsLoading(false);
      }),
      listenActiveQuotesForCompany(companyId, setActiveQuotes),
      listenAdminNotifications(setAdminNotifications),
    ];
    return () => unsubs.forEach((u) => u());
  }, [companyId]);

  const companyName = company?.companyName ?? "Your Company";

  const ownedRequestIds = useMemo(
    () => new Set(ownedCompanyRequests.map((r) => r.id)),
    [ownedCompanyRequests],
  );
  const companyNotifications = useMemo(
    () =>
      adminNotifications.filter(
        (n) =>
          n.type !== "company_registration" && ownedRequestIds.has(n.requestId),
      ),
    [adminNotifications, ownedRequestIds],
  );
  const companyUnreadCount = companyNotifications.filter((n) => !n.read).length;

  const companyNotifTypeLabel: Record<
    string,
    { title: string; level: "success" | "warning" | "info" }
  > = {
    payment_sent: { title: "Payment Received", level: "success" },
    driver_completed: { title: "Delivery Completed", level: "success" },
    driver_accepted: { title: "Driver Accepted Job", level: "success" },
    quote_accepted: { title: "Quote Accepted", level: "success" },
    signature_request: { title: "Delivery Confirmed", level: "success" },
    driver_declined: { title: "Driver Declined Job", level: "warning" },
    quote_declined: { title: "Quote Declined", level: "warning" },
    driver_report: { title: "Driver Report", level: "warning" },
    negotiation_request: { title: "Negotiation Request", level: "info" },
    new_delivery: { title: "New Delivery Request", level: "info" },
    delivery_proof: { title: "Delivery Proof Uploaded", level: "info" },
    driver_arrived: { title: "Driver Arrived", level: "info" },
    delivery_started: { title: "Delivery In Progress", level: "info" },
  };
  useEffect(() => {
    // Step 1: Initialize from localStorage as soon as companyId is known.
    // Keeps previously-seen IDs across page refreshes without a Firestore round-trip.
    if (knownCompanyNotifIds.current === null) {
      if (!companyId) return; // companyId not yet available — try again next render
      knownCompanyNotifIds.current = getSeenNotifIds(companyId);
    }

    // Step 2: Wait for company requests to finish loading so companyNotifications
    // is populated from real data, not an empty filtered result.
    if (companyRequestsLoading) return;

    // Step 3: Only toast notifications that are both new AND still unread.
    // The !n.read check is defense-in-depth: if a notification was read in the
    // panel on another device it must never pop up as a toast here.
    const incoming = companyNotifications.filter(
      (n) => !knownCompanyNotifIds.current!.has(n.id) && !n.read,
    );

    incoming.forEach((n) => {
      // Mark as seen immediately — before the toast is dismissed — so any
      // subsequent render or page refresh won't re-fire the same notification.
      knownCompanyNotifIds.current!.add(n.id);
      persistSeenNotifId(companyId!, n.id);

      const { title, level } = companyNotifTypeLabel[n.type] ?? {
        title: "Notification",
        level: "info",
      };
      const opts = { description: n.message, duration: 5000 };
      if (level === "success") toast.success(title, opts);
      else if (level === "warning") toast.warning(title, opts);
      else toast.info(title, opts);
    });
  }, [companyId, companyNotifications, companyRequestsLoading]); // eslint-disable-line

  const workflowDeliveries = ownedCompanyRequests.filter((r) =>
    [
      "driver_assigned",
      "driver_accepted",
      "in_progress",
      "arrived",
      "awaiting_signature",
    ].includes(r.status),
  );
  const workflowHistory = ownedCompanyRequests.filter(
    (r) => r.status === "completed",
  );

  const NAV: {
    id: Tab;
    label: string;
    icon: React.ElementType;
    badge?: number;
  }[] = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "analytics", label: "Analytics", icon: BarChart2 },
    {
      id: "drivers",
      label: "Drivers",
      icon: Truck,
      badge: drivers.filter((d) => d.isOnline).length,
    },
    { id: "reports", label: "Driver Reports", icon: BarChart2 },
    { id: "fleet", label: "Fleet", icon: Car },
    {
      id: "deliveries",
      label: "Deliveries",
      icon: Navigation2,
      badge: deliveries.length + workflowDeliveries.length,
    },
    {
      id: "requests",
      label: "Requests",
      icon: Building2,
      badge:
        openCompanyRequests.length +
        ownedCompanyRequests.filter((r) =>
          [
            "pending",
            "admin_review",
            "negotiating",
            "payment_pending",
            "customer_confirmed",
          ].includes(r.status),
        ).length,
    },
    {
      id: "history",
      label: "History",
      icon: History,
      badge: history.length + workflowHistory.length,
    },
    { id: "map", label: "Live Map", icon: MapPin },
    { id: "profile", label: "Profile", icon: User },
  ];

  const BOTTOM_NAV: Array<
    | { id: Tab; icon: React.ElementType; isMore?: false }
    | { id: "__more__"; icon: React.ElementType; isMore: true }
  > = [
    { id: "dashboard" as Tab, icon: LayoutDashboard },
    { id: "analytics" as Tab, icon: BarChart2 },
    { id: "drivers" as Tab, icon: Truck },
    { id: "requests" as Tab, icon: Building2 },
    { id: "deliveries" as Tab, icon: Navigation2 },
    { id: "__more__", icon: MoreHorizontal, isMore: true },
  ];

  function switchTab(tab: Tab) {
    if (tab !== "requests") setHighlightedRequestId(null);
    setActiveTab(tab);
    setMobile(false);
  }

  function handleViewRequest(requestId: string) {
    setHighlightedRequestId(requestId);
    setActiveTab("requests");
    setMobile(false);
  }

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [activeTab]);
  async function handleSignOut() {
    await signOut();
    navigate("/auth");
  }

  // ── Loading screen
  if (isLoading)
    return (
      <div
        className="min-h-[100dvh] flex items-center justify-center dash-font"
        style={{ background: "#f4f6f8" }}
      >
        <div className="text-center">
          <div
            className="h-14 w-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{
              background: "linear-gradient(135deg, #009C41 0%, #007A32 100%)",
            }}
          >
            <Loader2 className="h-7 w-7 text-white animate-spin" />
          </div>
          <p
            className="text-sm font-semibold"
            style={{ color: "#9ba3af", fontFamily: "'DM Sans', sans-serif" }}
          >
            Loading your dashboard…
          </p>
        </div>
      </div>
    );

  // ── Pending approval screen
  if (!isApproved)
    return (
      <div
        className="min-h-[100dvh] flex items-center justify-center px-4 dash-font"
        style={{ background: "#f4f6f8" }}
      >
        <Card className="p-8 max-w-md w-full text-center">
          <div className="h-16 w-16 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-8 w-8 text-amber-500" />
          </div>
          <h2
            className="text-lg font-bold mb-2"
            style={{ fontFamily: "'Syne', sans-serif", color: "#0f1117" }}
          >
            Pending Approval
          </h2>
          <p className="text-sm mb-6" style={{ color: "#9ba3af" }}>
            Your company account is pending admin approval. We'll notify you
            once reviewed.
          </p>
          <button
            onClick={handleSignOut}
            className="h-10 px-6 rounded-[10px] text-sm font-semibold border border-[#e8eaed] bg-[#f9fafb] transition-colors hover:bg-gray-100"
            style={{ color: "#5a6070" }}
          >
            Sign Out
          </button>
        </Card>
      </div>
    );

  const handleMarkNotifRead = async (id: string) => {
    try {
      await markAdminNotificationRead(id);
    } catch {
      // optimistic update still showed read state via listener
    }
  };
  const handleMarkAllNotifsRead = async () => {
    try {
      await markAllAdminNotificationsRead(companyNotifications);
    } catch {}
  };

  return (
    <div
      className="min-h-[100dvh] flex overflow-x-hidden w-full max-w-[100vw] dash-font"
      style={{ background: "#f4f6f8" }}
    >
      {/* Notification panel */}
      <CompanyNotifPanel
        notifications={companyNotifications}
        open={notifPanelOpen}
        onClose={() => setNotifPanelOpen(false)}
        onMarkRead={handleMarkNotifRead}
        onMarkAllRead={handleMarkAllNotifsRead}
      />

      {/* Mobile overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          onClick={() => setMobile(false)}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
        </div>
      )}

      {/* ── Sidebar ────────────────────────────────────────────────────────── */}
      <aside
        className={`fixed top-0 left-0 h-full w-72 lg:w-64 flex flex-col flex-shrink-0 z-50 transition-transform duration-300 ease-out
          ${mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 dash-scroll overflow-y-auto`}
        style={{
          background: "linear-gradient(180deg, #009C41 0%, #007A32 100%)",
          boxShadow: "4px 0 24px rgba(0,0,0,0.15)",
          paddingTop: "env(safe-area-inset-top, 0px)",
        }}
      >
        {/* Sidebar header */}
        <div
          className="px-5 py-5 flex items-center justify-between flex-shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.12)" }}
        >
          <div>
            <Logo size="sm" className="text-white" />
            <p
              className="text-[10px] font-semibold uppercase tracking-[0.15em] mt-1.5"
              style={{ color: "rgba(255,255,255,0.5)" }}
            >
              {companyName.length > 20
                ? companyName.slice(0, 20) + "…"
                : companyName}
            </p>
          </div>
          <button
            onClick={() => setMobile(false)}
            className="lg:hidden h-8 w-8 rounded-xl flex items-center justify-center transition-colors"
            style={{ background: "rgba(255,255,255,0.15)" }}
          >
            <X className="h-4 w-4 text-white" />
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV.map((item) => (
            <NavItem
              key={item.id}
              {...item}
              active={activeTab === item.id}
              onClick={() => switchTab(item.id)}
            />
          ))}
        </nav>

        {/* User footer */}
        <div
          className="p-3 flex-shrink-0"
          style={{ borderTop: "1px solid rgba(255,255,255,0.12)" }}
        >
          <div
            className="flex items-center gap-3 p-3 rounded-xl"
            style={{ background: "rgba(255,255,255,0.10)" }}
          >
            <div
              className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(255,255,255,0.18)" }}
            >
              <span
                className="text-sm font-bold text-white"
                style={{ fontFamily: "'Syne', sans-serif" }}
              >
                {getInitials(companyName)}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-white truncate">
                {companyName}
              </p>
              <p
                className="text-[11px] truncate"
                style={{ color: "rgba(255,255,255,0.5)" }}
              >
                {company?.email}
              </p>
            </div>
            <button
              onClick={handleSignOut}
              className="h-7 w-7 rounded-lg flex items-center justify-center transition-colors flex-shrink-0"
              style={{ background: "rgba(255,255,255,0.12)" }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "rgba(239,68,68,0.35)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "rgba(255,255,255,0.12)")
              }
            >
              <LogOut className="h-3.5 w-3.5 text-white" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main area ──────────────────────────────────────────────────────── */}
      <div className="flex-1 lg:ml-64 flex flex-col min-h-[100dvh] min-w-0">
        {/* Fixed header */}
        <header
          className="fixed top-0 left-0 right-0 lg:left-64 z-30"
          style={{
            paddingTop: "env(safe-area-inset-top, 0px)",
          }}
        >
          <div
            style={{
              background: "rgba(255,255,255,0.92)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              borderBottom: "1px solid rgba(0,0,0,0.07)",
              boxShadow: "0 1px 12px rgba(0,0,0,0.06)",
            }}
          >
            <div className="px-4 lg:px-7 h-14 lg:h-[60px] flex items-center justify-between gap-3">
              {/* ── LEFT ── */}
              <div className="flex items-center min-w-0 flex-1">
                {/* Mobile: icon + company name */}
                <div className="flex lg:hidden items-center gap-2.5 min-w-0">
                  <div
                    className="h-[34px] w-[34px] rounded-[10px] flex items-center justify-center flex-shrink-0"
                    style={{
                      background:
                        "linear-gradient(135deg, #009C41 0%, #007A32 100%)",
                      boxShadow: "0 2px 8px rgba(0,156,65,0.28)",
                    }}
                  >
                    <Truck className="h-4 w-4 text-white" />
                  </div>
                  <div
                    className="flex flex-col justify-center min-w-0"
                    style={{ gap: 1 }}
                  >
                    <p
                      className="text-[14px] font-bold leading-tight truncate"
                      style={{
                        color: "#0f1117",
                        fontFamily: "'Syne', sans-serif",
                        letterSpacing: "-0.01em",
                      }}
                    >
                      {companyName.length > 18
                        ? companyName.slice(0, 18) + "…"
                        : companyName}
                    </p>
                    <p
                      className="text-[10px] font-semibold leading-none"
                      style={{
                        color: "#009C41",
                        fontFamily: "'DM Sans', sans-serif",
                        letterSpacing: "0.04em",
                      }}
                    >
                      Pilnak Fleet
                    </p>
                  </div>
                </div>

                {/* Desktop: page title */}
                <div className="hidden lg:block min-w-0">
                  <h1
                    className="text-[15px] font-bold truncate"
                    style={{
                      fontFamily: "'Syne', sans-serif",
                      color: "#0f1117",
                    }}
                  >
                    {activeTab === "dashboard"
                      ? `Welcome back, ${companyName}`
                      : NAV.find((n) => n.id === activeTab)?.label}
                  </h1>
                  <p
                    className="text-[11px] uppercase tracking-wide"
                    style={{ color: "#9ba3af" }}
                  >
                    {new Date().toLocaleDateString("en-GB", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </div>

              {/* ── RIGHT ── */}
              <div className="flex items-center gap-2 lg:gap-2.5 flex-shrink-0">
                {/* Desktop: Live pill */}
                <div
                  className="hidden lg:flex items-center gap-1.5 rounded-full px-2.5 py-1"
                  style={{ background: "#f0fdf4", border: "1px solid #86efac" }}
                >
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  </span>
                  <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
                    Live
                  </span>
                </div>

                {/* Mobile: live dot only */}
                <span className="relative flex lg:hidden h-[7px] w-[7px] flex-shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-70" />
                  <span className="relative inline-flex h-[7px] w-[7px] rounded-full bg-emerald-500" />
                </span>

                {/* Desktop divider */}
                <div className="hidden lg:block h-5 w-px bg-gray-200" />

                {/* Notification bell */}
                <button
                  onClick={() => setNotifPanelOpen(true)}
                  title="Notifications"
                  className="relative h-9 w-9 rounded-full flex items-center justify-center transition-all active:scale-95 flex-shrink-0"
                  style={{ background: "#f2f4f7" }}
                >
                  <Bell
                    className="h-[17px] w-[17px]"
                    style={{ color: "#3d4451" }}
                  />
                  {companyUnreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-red-500 text-[9px] font-bold text-white flex items-center justify-center leading-none">
                      {companyUnreadCount > 9 ? "9+" : companyUnreadCount}
                    </span>
                  )}
                </button>

                {/* Avatar */}
                <button
                  onClick={() => switchTab("profile")}
                  title="Profile"
                  className="h-9 w-9 rounded-full flex items-center justify-center transition-all active:scale-95 flex-shrink-0"
                  style={{
                    background:
                      "linear-gradient(135deg, #009C41 0%, #007A32 100%)",
                    boxShadow: "0 2px 8px rgba(0,156,65,0.28)",
                  }}
                >
                  <span
                    className="text-[12px] font-bold text-white"
                    style={{ fontFamily: "'Syne', sans-serif" }}
                  >
                    {getInitials(companyName)}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Page content — offset for fixed header + safe area */}
        <main
          className="flex-1 min-w-0 w-full"
          style={{
            paddingTop: "calc(56px + env(safe-area-inset-top, 0px))",
            paddingBottom: "calc(80px + env(safe-area-inset-bottom, 0px))",
          }}
        >
          <div className="px-4 lg:px-7 py-5">
            {activeTab === "dashboard" && (
              <OverviewTab
                companyName={companyName}
                company={company}
                drivers={drivers}
                fleet={fleet}
                deliveries={deliveries}
                history={history}
                openRequests={openCompanyRequests}
                ownedRequests={ownedCompanyRequests}
                companyId={companyId!}
                onNavigate={switchTab}
                onViewRequest={handleViewRequest}
              />
            )}
            {activeTab === "analytics" && (
              <AnalyticsTab
                drivers={drivers}
                fleet={fleet}
                deliveries={deliveries}
                history={history}
                ownedRequests={ownedCompanyRequests}
                loading={
                  driversLoading || historyLoading || companyRequestsLoading
                }
              />
            )}
            {activeTab === "drivers" && (
              <DriversTab
                companyId={companyId!}
                drivers={drivers}
                fleet={fleet}
                deliveries={deliveries}
                loading={driversLoading}
              />
            )}
            {activeTab === "fleet" && (
              <FleetTab
                companyId={companyId!}
                fleet={fleet}
                drivers={drivers}
                loading={fleetLoading}
              />
            )}
            {activeTab === "deliveries" && (
              <DeliveriesTab
                companyId={companyId!}
                deliveries={deliveries}
                workflowRequests={ownedCompanyRequests}
                drivers={drivers}
                fleet={fleet}
                loading={deliveriesLoading || companyRequestsLoading}
              />
            )}
            {activeTab === "requests" && (
              <CompanyRequestsTab
                companyId={companyId!}
                companyName={companyName}
                company={company}
                openRequests={openCompanyRequests}
                cancelledGhosts={cancelledGhosts}
                ownedRequests={ownedCompanyRequests}
                activeQuotes={activeQuotes}
                drivers={drivers}
                driversLoading={driversLoading}
                loading={companyRequestsLoading}
                onDeliveryComplete={() => switchTab("deliveries")}
                highlightedRequestId={highlightedRequestId}
              />
            )}
            {activeTab === "history" && (
              <HistoryTab
                history={history}
                workflowHistory={ownedCompanyRequests}
                loading={historyLoading || companyRequestsLoading}
                drivers={drivers}
                fleet={fleet}
              />
            )}
            {activeTab === "reports" && (
              <DriverReportTab
                drivers={drivers}
                history={history}
                workflowHistory={ownedCompanyRequests}
                fleet={fleet}
                loading={
                  driversLoading || historyLoading || companyRequestsLoading
                }
              />
            )}
            {activeTab === "map" && (
              <MapTab drivers={drivers} companyName={companyName} />
            )}
            {activeTab === "profile" && (
              <ProfileTab company={company} companyId={companyId} />
            )}
          </div>
        </main>

        {/* Mobile bottom nav */}
        <nav
          className="lg:hidden fixed bottom-0 left-0 right-0 z-30"
          style={{
            background: "rgba(255,255,255,0.97)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            borderTop: "1px solid rgba(0,0,0,0.07)",
            boxShadow: "0 -4px 20px rgba(0,0,0,0.06)",
            paddingBottom: "env(safe-area-inset-bottom, 0px)",
          }}
        >
          <div className="flex items-stretch h-[60px]">
            {BOTTOM_NAV.map((item) => {
              if (item.isMore) {
                return (
                  <button
                    key="__more__"
                    onClick={() => setMoreSheetOpen(true)}
                    className="flex-1 flex flex-col items-center justify-center gap-0.5 relative transition-all active:scale-95"
                    style={{ color: "#9ba3af" }}
                  >
                    <div className="flex items-center justify-center h-8 w-8 rounded-xl">
                      <MoreHorizontal
                        className="h-[18px] w-[18px]"
                        style={{ color: "#9ba3af" }}
                      />
                    </div>
                    <span
                      className="text-[10px] font-semibold leading-none"
                      style={{
                        color: "#9ba3af",
                        fontFamily: "'DM Sans', sans-serif",
                      }}
                    >
                      More
                    </span>
                  </button>
                );
              }
              const isActive = activeTab === item.id;
              const navItem = NAV.find((n) => n.id === item.id);
              return (
                <button
                  key={item.id}
                  onClick={() => switchTab(item.id as Tab)}
                  className="flex-1 flex flex-col items-center justify-center gap-0.5 relative transition-all active:scale-95"
                  style={{ color: isActive ? "#009C41" : "#9ba3af" }}
                >
                  {/* Active top bar */}
                  {isActive && (
                    <div
                      className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] rounded-b-full"
                      style={{ background: "#009C41" }}
                    />
                  )}
                  <div
                    className="relative flex items-center justify-center h-8 w-8 rounded-xl transition-colors"
                    style={{
                      background: isActive
                        ? "rgba(0,156,65,0.10)"
                        : "transparent",
                    }}
                  >
                    <item.icon
                      className="h-[18px] w-[18px]"
                      style={{ color: isActive ? "#009C41" : "#9ba3af" }}
                    />
                    {(navItem?.badge ?? 0) > 0 && (
                      <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-[9px] font-bold text-white flex items-center justify-center">
                        {navItem?.badge}
                      </span>
                    )}
                  </div>
                  <span
                    className="text-[10px] font-semibold leading-none"
                    style={{
                      color: isActive ? "#009C41" : "#9ba3af",
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    {navItem?.label}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* More bottom sheet — mobile only */}
        {moreSheetOpen && (
          <div className="lg:hidden fixed inset-0 z-50">
            {/* Blur backdrop */}
            <div
              className="absolute inset-0"
              style={{
                background: "rgba(0,0,0,0.45)",
                backdropFilter: "blur(6px)",
                WebkitBackdropFilter: "blur(6px)",
              }}
              onClick={() => setMoreSheetOpen(false)}
            />

            {/* Sheet */}
            <div
              className="absolute bottom-0 left-0 right-0"
              style={{
                background: "#ffffff",
                borderRadius: "24px 24px 0 0",
                boxShadow: "0 -8px 40px rgba(0,0,0,0.18)",
                animation:
                  "sheet-slide-up 0.28s cubic-bezier(0.32,0.72,0,1) both",
                paddingBottom: "env(safe-area-inset-bottom, 16px)",
              }}
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div
                  className="h-1 w-10 rounded-full"
                  style={{ background: "#e0e3e8" }}
                />
              </div>

              {/* Sheet header */}
              <div
                className="flex items-center justify-between px-5 py-3"
                style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}
              >
                <p
                  className="text-[15px] font-bold"
                  style={{ fontFamily: "'Syne', sans-serif", color: "#0f1117" }}
                >
                  Menu
                </p>
                <button
                  onClick={() => setMoreSheetOpen(false)}
                  className="h-8 w-8 rounded-full flex items-center justify-center transition-colors active:scale-95"
                  style={{ background: "#f2f4f7" }}
                >
                  <X className="h-4 w-4" style={{ color: "#5a6070" }} />
                </button>
              </div>

              {/* Nav items list */}
              <div className="px-4 py-3 space-y-0.5">
                {NAV.map((item) => {
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        switchTab(item.id);
                        setMoreSheetOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl transition-all active:scale-[0.98] text-left"
                      style={{
                        background: isActive
                          ? "rgba(0,156,65,0.08)"
                          : "transparent",
                        border: isActive
                          ? "1px solid rgba(0,156,65,0.14)"
                          : "1px solid transparent",
                      }}
                    >
                      <div
                        className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{
                          background: isActive
                            ? "rgba(0,156,65,0.12)"
                            : "#f2f4f7",
                        }}
                      >
                        <item.icon
                          className="h-4.5 w-4.5"
                          style={{ color: isActive ? "#009C41" : "#5a6070" }}
                        />
                      </div>
                      <span
                        className="flex-1 text-[14px] font-semibold"
                        style={{
                          color: isActive ? "#009C41" : "#0f1117",
                          fontFamily: "'DM Sans', sans-serif",
                        }}
                      >
                        {item.label}
                      </span>
                      {(item.badge ?? 0) > 0 && (
                        <span className="h-5 min-w-[20px] px-1.5 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center">
                          {item.badge}
                        </span>
                      )}
                      {isActive && (
                        <div
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ background: "#009C41" }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Divider + Sign out */}
              <div
                className="mx-4 mb-2"
                style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}
              />
              <div className="px-4 pb-3">
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl transition-all active:scale-[0.98]"
                  style={{
                    background: "rgba(239,68,68,0.07)",
                    border: "1px solid rgba(239,68,68,0.12)",
                  }}
                >
                  <div
                    className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(239,68,68,0.1)" }}
                  >
                    <LogOut className="h-4 w-4" style={{ color: "#ef4444" }} />
                  </div>
                  <span
                    className="flex-1 text-[14px] font-semibold"
                    style={{
                      color: "#ef4444",
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    Sign Out
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

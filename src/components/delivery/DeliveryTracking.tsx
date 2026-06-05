import { useState, useEffect, useRef, useCallback } from "react";
import { MapView } from "@/components/map/MapView";
import { DriverProfileModal } from "@/components/driver/DriverProfileModal";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { CameraCapture } from "@/components/camera/CameraCapture";
import { toast } from "sonner";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { db } from "@/integrations/firebase/client";
import { shortDeliveryName } from "@/lib/deliveryName";
import { haversineKm, getOrCreateChat, listenMessages } from "@/services/firebase";
import {
  listenAssignmentsForRequest,
  listenDeliveryRequest,
  markAssignmentStarted,
  updateDeliveryStatus,
  acceptPriceQuote,
  rejectPriceQuote,
  requestNegotiationCall,
  markPaymentSentWithProof,
  markPaymentSent,
  setDriverAccepted,
  submitDeliveryProofAndRequestSignature,
  sendSignatureRequestToCustomer,
  submitCustomerSignature,
  confirmDeliveryWithoutSignature,
  cancelDeliveryByCustomer,
  cancelDeliveryByDriver,
  getUserCancellationCount,
  type AssignmentDoc,
  type DeliveryRequestDoc,
  type DriverDoc,
  type VehicleDoc,
  type UserDoc,
} from "@/services/firebase";
import {
  Package, User, Phone, MessageCircle, CheckCircle, Clock,
  Truck, Navigation, Star, X, DollarSign, AlertCircle,
  PhoneCall, Banknote, Copy, SendHorizonal, Share2, Link2,
  Mail, MessageSquare, Send, ExternalLink, ChevronRight,
  UserCheck, Zap, Car, Timer, RotateCcw, MapPin, ChevronDown,
  PenLine, Fingerprint, UserX, ShieldCheck, Camera, ImagePlus,
  Upload, Check, RefreshCw, ChevronUp, Lock, Clock3,
  Building2, AlertTriangle, ArrowLeft,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DeliveryTrackingProps {
  requestId: string;
  currentUserId: string;
  userRole: "customer" | "driver";
  onClose?: () => void;
  onStartCall?: (userId: string) => void;
  onOpenChat?: (chatId: string) => void;
  hideMarkAsDelivered?: boolean;
  fullPage?: boolean;
  onFindDriverAgain?: (data: {
    pickup: { address: string; lat: number; lng: number };
    dropoff: { address: string; lat: number; lng: number };
    transportType: string;
    driverType: string;
    itemDescription?: string | null;
    itemSize?: string | null;
    itemWeight?: string | null;
    packagePhotoUrl?: string | null;
  }) => void;
}

type DeliveryRequest = DeliveryRequestDoc & { id: string };
type Assignment = AssignmentDoc & { id: string };

// ── Status steps ──────────────────────────────────────────────────────────────

const STATUS_STEPS_SELF_DRIVER = [
  { key: "pending",            label: "Submitted",  icon: Package },
  { key: "driver_assigned",    label: "Driver",     icon: UserCheck },
  { key: "negotiating_price",  label: "Negotiating",icon: PhoneCall },
  { key: "driver_accepted",    label: "Accepted",   icon: CheckCircle },
  { key: "in_progress",        label: "In Transit", icon: Truck },
  { key: "arrived",            label: "Arrived",    icon: Navigation },
  { key: "awaiting_signature", label: "Signing",    icon: PenLine },
  { key: "completed",          label: "Delivered",  icon: CheckCircle },
];

const STATUS_STEPS_COMPANY_DRIVER = [
  { key: "pending",            label: "Submitted",      icon: Package },
  { key: "admin_review",       label: "Company Review", icon: Clock },
  { key: "negotiating_price",   label: "Negotiating",    icon: PhoneCall },
  { key: "price_set",          label: "Quoted",         icon: DollarSign },
  { key: "payment_pending",    label: "Payment",        icon: Banknote },
  { key: "customer_confirmed", label: "Confirmed",      icon: CheckCircle },
  { key: "driver_assigned",    label: "Driver",         icon: User },
  { key: "driver_accepted",    label: "Accepted",       icon: CheckCircle },
  { key: "in_progress",        label: "In Transit",     icon: Truck },
  { key: "arrived",            label: "Arrived",        icon: Navigation },
  { key: "awaiting_signature", label: "Signing",        icon: PenLine },
  { key: "completed",          label: "Delivered",      icon: CheckCircle },
];

const CHAT_ENABLED_STATUSES = [
  "driver_accepted", "customer_confirmed", "arrived", "in_progress",
  "awaiting_signature", "completed",
];

// ── Cloudinary upload ─────────────────────────────────────────────────────────

async function uploadToCloudinary(dataUrl: string): Promise<string> {
  const cloudName    = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
  if (!cloudName || !uploadPreset)
    throw new Error("Cloudinary env vars not set");
  const fd = new FormData();
  fd.append("file", dataUrl);
  fd.append("upload_preset", uploadPreset);
  fd.append("folder", "pilnak_deliveries");
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    { method: "POST", body: fd }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any)?.error?.message ?? `Upload failed (${res.status})`);
  }
  const data = await res.json();
  return data.secure_url as string;
}

async function uploadFileToCloudinary(file: File): Promise<string> {
  const cloudName    = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
  if (!cloudName || !uploadPreset)
    throw new Error("Cloudinary env vars not set");
  const fd = new FormData();
  fd.append("file", file);
  fd.append("upload_preset", uploadPreset);
  fd.append("folder", "pilnak_payment_proofs");
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    { method: "POST", body: fd }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any)?.error?.message ?? `Upload failed (${res.status})`);
  }
  const data = await res.json();
  return data.secure_url as string;
}

// ── Signature Canvas ──────────────────────────────────────────────────────────

function SignatureCanvas({ onReady }: { onReady: (getDataUrl: () => string | null) => void }) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const drawing    = useRef(false);
  const hasStrokes = useRef(false);

  useEffect(() => {
    onReady(() => {
      if (!hasStrokes.current) return null;
      return canvasRef.current?.toDataURL("image/png") ?? null;
    });
  }, [onReady]);

  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width;
    const sy = canvas.height / rect.height;
    if ("touches" in e) return { x: (e.touches[0].clientX - rect.left) * sx, y: (e.touches[0].clientY - rect.top) * sy };
    return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    drawing.current = true; hasStrokes.current = true;
    const pos = getPos(e, canvas);
    ctx.beginPath(); ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!drawing.current) return;
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const pos = getPos(e, canvas);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = "#0f172a"; ctx.lineWidth = 2.5; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.stroke();
  };

  const endDraw = () => { drawing.current = false; };

  const clear = () => {
    const canvas = canvasRef.current; if (!canvas) return;
    canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    hasStrokes.current = false;
  };

  return (
    <div className="space-y-2">
      <div className="relative rounded-xl overflow-hidden border-2 border-dashed border-border bg-white">
        <canvas
          ref={canvasRef} width={600} height={150}
          className="w-full touch-none cursor-crosshair block"
          onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
          onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw}
        />
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 pointer-events-none flex flex-col items-center gap-0.5">
          <div className="w-24 h-px bg-muted-foreground/20" />
          <p className="text-[10px] text-muted-foreground/40">Sign above</p>
        </div>
      </div>
      <button onClick={clear} className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
        <RefreshCw className="h-3 w-3" /> Clear
      </button>
    </div>
  );
}

// ── Helper components ─────────────────────────────────────────────────────────

function StepBadge({ n, active, done }: { n: number; active: boolean; done: boolean }) {
  return (
    <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all ${done ? "bg-emerald-500 text-white" : active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
      {done ? <Check className="h-3.5 w-3.5" /> : n}
    </div>
  );
}

function ExpiryCountdown({ expiresAt }: { expiresAt: Date }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, expiresAt.getTime() - Date.now()));
  useEffect(() => {
    const id = setInterval(() => {
      const r = Math.max(0, expiresAt.getTime() - Date.now());
      setRemaining(r);
      if (r === 0) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  const h = Math.floor(remaining / 3_600_000);
  const m = Math.floor((remaining % 3_600_000) / 60_000);
  const s = Math.floor((remaining % 60_000) / 1000);
  const isUrgent = remaining < 3_600_000;
  if (remaining === 0) return (
    <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
      <Clock3 className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
      <p className="text-xs font-bold text-red-700">Signature window expired — delivery will be auto-confirmed.</p>
    </div>
  );
  return (
    <div className={`flex items-center gap-2.5 rounded-xl px-3 py-2 border ${isUrgent ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"}`}>
      <Clock3 className={`h-3.5 w-3.5 flex-shrink-0 ${isUrgent ? "text-red-500 animate-pulse" : "text-amber-600"}`} />
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-bold ${isUrgent ? "text-red-800" : "text-amber-900"}`}>Customer must respond within</p>
        <p className={`text-[11px] ${isUrgent ? "text-red-600" : "text-amber-700"}`}>Auto-confirmed if no response</p>
      </div>
      <span className={`text-sm font-bold tabular-nums ${isUrgent ? "text-red-700" : "text-amber-800"}`}>
        {`${h}h ${m.toString().padStart(2,"0")}m ${s.toString().padStart(2,"0")}s`}
      </span>
    </div>
  );
}

function ETACountdown({ distanceKm }: { distanceKm: number }) {
  const initial = Math.round((distanceKm / 30) * 3600);
  const [secsLeft, setSecsLeft] = useState(initial);
  useEffect(() => {
    if (secsLeft <= 0) return;
    const id = setInterval(() => setSecsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, []);
  const mins = Math.floor(secsLeft / 60);
  const secs = secsLeft % 60;
  const pct  = Math.max(0, Math.min(100, (1 - secsLeft / initial) * 100));
  return (
    <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Timer className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-xs font-bold text-primary">ETA to destination</p>
            <p className="text-[10px] text-primary/60">{distanceKm.toFixed(1)} km total</p>
          </div>
        </div>
        <span className="text-2xl font-bold text-primary tabular-nums">
          {secsLeft === 0 ? "Here!" : `${mins}:${secs.toString().padStart(2, "0")}`}
        </span>
      </div>
      <div className="h-1.5 bg-primary/15 rounded-full overflow-hidden">
        <div className="h-full bg-primary rounded-full transition-all duration-1000" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function RouteReplayPanel({ request, onClose }: { request: DeliveryRequest; onClose: () => void }) {
  const pickup  = request.pickup  ? { lat: request.pickup.lat,  lng: request.pickup.lng }  : null;
  const dropoff = request.dropoff ? { lat: request.dropoff.lat, lng: request.dropoff.lng } : null;
  const markers: any[] = [];
  if (pickup)  markers.push({ id:"pickup",  latitude:pickup.lat,  longitude:pickup.lng,  type:"pickup"  as const, label:"Pickup" });
  if (dropoff) markers.push({ id:"dropoff", latitude:dropoff.lat, longitude:dropoff.lng, type:"dropoff" as const, label:"Drop-off" });
  const deliveredAt = (request as any).updatedAt
    ? new Date((request as any).updatedAt?.toDate?.() ?? (request as any).updatedAt).toLocaleString() : "–";
  return (
    <div className="bg-muted/40 border border-border rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2"><RotateCcw className="h-4 w-4 text-primary" /><p className="font-semibold text-sm">Route Replay</p></div>
        <button onClick={onClose} className="h-7 w-7 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-muted"><X className="h-3.5 w-3.5" /></button>
      </div>
      <div className="h-48 relative">
        <MapView className="h-full" markers={markers} userLatitude={pickup?.lat} userLongitude={pickup?.lng}
          routeFrom={pickup ? [pickup.lat, pickup.lng] : undefined}
          routeTo={dropoff ? [dropoff.lat, dropoff.lng] : undefined} />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="bg-black/50 text-white text-[10px] font-semibold px-2.5 py-1 rounded-full backdrop-blur-sm">Completed route</span>
        </div>
      </div>
      <div className="px-4 py-3 space-y-1.5 text-xs text-muted-foreground">
        <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" /><span className="truncate">{request.pickup?.address}</span></div>
        <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-destructive flex-shrink-0" /><span className="truncate">{request.dropoff?.address}</span></div>
        <p className="text-[10px] text-muted-foreground/60 pt-1">Delivered {deliveredAt}</p>
      </div>
    </div>
  );
}

function SharePanel({ request, senderName, driverLoc, onClose }: {
  request: DeliveryRequest; senderName: string; driverLoc?: { lat: number; lng: number } | null; onClose: () => void;
}) {
  const origin  = driverLoc ? `${driverLoc.lat},${driverLoc.lng}` : request.pickup?.lat ? `${request.pickup.lat},${request.pickup.lng}` : encodeURIComponent(request.pickup?.address ?? "");
  const dest    = request.dropoff?.lat ? `${request.dropoff.lat},${request.dropoff.lng}` : encodeURIComponent(request.dropoff?.address ?? "");
  const mapsUrl = origin ? `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(dest)}&travelmode=driving&dir_action=navigate` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(request.dropoff?.address ?? "")}`;
  const shortId = request.id.slice(0, 8).toUpperCase();
  const title   = `Pilnak Delivery ${shortId} — shared by ${senderName}`;
  const body    = `${senderName} shared a live Pilnak delivery!\n\nFrom: ${request.pickup?.address ?? "N/A"}\nTo:   ${request.dropoff?.address ?? "N/A"}\n\nTrack: ${mapsUrl}`;
  const list = [
    { id:"whatsapp", label:"WhatsApp", icon:MessageSquare, tile:"border-[#25D366]/30 bg-[#25D366]/[0.08]", ic:"text-[#25D366]", act:()=>window.open(`https://wa.me/?text=${encodeURIComponent(body)}`,"_blank") },
    { id:"telegram", label:"Telegram", icon:Send,          tile:"border-[#229ED9]/30 bg-[#229ED9]/[0.08]", ic:"text-[#229ED9]", act:()=>window.open(`https://t.me/share/url?url=${encodeURIComponent(mapsUrl)}&text=${encodeURIComponent(title)}`,"_blank") },
    { id:"sms",      label:"SMS",      icon:MessageCircle, tile:"border-blue-200 bg-blue-50",              ic:"text-blue-600",   act:()=>window.open(`sms:?body=${encodeURIComponent(body)}`,"_blank") },
    { id:"email",    label:"Email",    icon:Mail,          tile:"border-violet-200 bg-violet-50",          ic:"text-violet-600", act:()=>window.open(`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`,"_blank") },
    { id:"maps",     label:"Maps",     icon:ExternalLink,  tile:"border-red-200 bg-red-50",                ic:"text-red-500",    act:()=>window.open(mapsUrl,"_blank") },
    { id:"copy",     label:"Copy",     icon:Copy,          tile:"border-border bg-muted/40",               ic:"text-foreground", act:()=>navigator.clipboard.writeText(mapsUrl).then(()=>toast.success("Copied!")) },
  ];
  return (
    <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-bold text-sm">Share Tracking</p>
        <button onClick={onClose} className="h-7 w-7 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-muted"><X className="h-3.5 w-3.5" /></button>
      </div>
      <div className="flex items-center gap-2.5 bg-primary/5 border border-primary/20 rounded-xl px-3 py-2.5">
        <Link2 className="h-4 w-4 text-primary flex-shrink-0" />
        <div className="flex-1 min-w-0"><p className="text-xs font-semibold text-primary truncate">Delivery {shortId}</p><p className="text-[11px] text-muted-foreground">Google Maps route</p></div>
        <button onClick={() => navigator.clipboard.writeText(mapsUrl).then(() => toast.success("Copied!"))} className="h-7 w-7 rounded-lg flex items-center justify-center text-primary hover:bg-primary/10 flex-shrink-0"><Copy className="h-3.5 w-3.5" /></button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {list.map(p => { const Icon = p.icon; return (
          <button key={p.id} onClick={() => { p.act(); onClose(); }}
            className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border text-[11px] font-medium transition-all active:scale-95 ${p.tile}`}>
            <Icon className={`h-5 w-5 ${p.ic}`} />
            <span className="text-foreground/80">{p.label}</span>
          </button>
        );})}
      </div>
    </div>
  );
}

function Btn({ onClick, disabled, variant = "default", children, className = "" }: {
  onClick: () => void | Promise<void>; disabled?: boolean; children: React.ReactNode;
  variant?: "default" | "outline" | "destructive" | "green" | "blue"; className?: string;
}) {
  const base = "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]";
  const v = { default:"bg-primary text-primary-foreground hover:bg-primary/90", outline:"border border-border bg-card hover:bg-muted text-foreground", destructive:"border border-red-200 bg-red-50 text-red-600 hover:bg-red-100", green:"bg-emerald-600 text-white hover:bg-emerald-700", blue:"border border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100" };
  return <button onClick={onClick} disabled={disabled} className={`${base} ${v[variant]} ${className}`}>{children}</button>;
}

// ── Company Info Card ─────────────────────────────────────────────────────────

function CompanyInfoCard({ info }: {
  info: { name: string; phone?: string | null; email?: string | null; address?: string | null };
}) {
  return (
    <div className="rounded-2xl border-2 border-indigo-200 bg-indigo-50/60 overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3.5 border-b border-indigo-200">
        <div className="h-10 w-10 rounded-xl bg-indigo-600 flex items-center justify-center flex-shrink-0">
          <Building2 className="h-5 w-5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">Assigned Company</p>
          <p className="font-bold text-sm text-indigo-900 truncate">{info.name}</p>
        </div>
        <span className="flex items-center gap-1 text-[10px] font-bold bg-indigo-600 text-white px-2 py-0.5 rounded-full flex-shrink-0">
          <Check className="h-3 w-3" /> Accepted
        </span>
      </div>
      <div className="px-4 py-3 space-y-2.5">
        {info.phone && (
          <a href={`tel:${info.phone}`}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 bg-white border border-indigo-200 hover:bg-indigo-50 transition-colors">
            <div className="h-8 w-8 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
              <Phone className="h-3.5 w-3.5 text-indigo-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold text-indigo-500 uppercase tracking-wider">Phone</p>
              <p className="font-bold text-sm text-gray-900">{info.phone}</p>
            </div>
            <ChevronRight className="h-3.5 w-3.5 text-indigo-400 flex-shrink-0" />
          </a>
        )}
        {info.email && (
          <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 bg-white border border-indigo-200">
            <div className="h-8 w-8 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
              <Mail className="h-3.5 w-3.5 text-indigo-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold text-indigo-500 uppercase tracking-wider">Email</p>
              <p className="font-semibold text-sm text-gray-900 truncate">{info.email}</p>
            </div>
          </div>
        )}
        {info.address && (
          <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 bg-white border border-indigo-200">
            <div className="h-8 w-8 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
              <MapPin className="h-3.5 w-3.5 text-indigo-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold text-indigo-500 uppercase tracking-wider">Address</p>
              <p className="font-semibold text-sm text-gray-900 truncate">{info.address}</p>
            </div>
          </div>
        )}
        {!info.phone && !info.email && !info.address && (
          <p className="text-xs text-indigo-600 text-center py-2">Company will contact you shortly.</p>
        )}
      </div>
    </div>
  );
}

// ── Payment Proof Upload ──────────────────────────────────────────────────────

function PaymentProofUpload({ requestId, amount, paymentDetails, onDone }: {
  requestId: string;
  amount: number;
  /** May be null while company is still preparing details */
  paymentDetails: { bankName: string; accountNumber: string; accountName: string } | null | undefined;
  onDone: () => void;
}) {
  const [proofPreview, setProofPreview]   = useState<string | null>(null);
  const [uploading, setUploading]         = useState(false);
  const [submitting, setSubmitting]       = useState(false);
  const [showCamera, setShowCamera]       = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const copyToClipboard = (text: string, label: string) =>
    navigator.clipboard.writeText(text).then(() => toast.success(`${label} copied`));

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadFileToCloudinary(file);
      setProofPreview(url);
    } catch {
      toast.error("Upload failed. Try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleCameraCapture = async (dataUrl: string) => {
    setShowCamera(false);
    setUploading(true);
    try {
      const url = await uploadToCloudinary(dataUrl);
      setProofPreview(url);
    } catch {
      toast.error("Upload failed. Try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!proofPreview) {
      toast.error("Please upload your payment proof first.");
      return;
    }
    setSubmitting(true);
    try {
      await markPaymentSentWithProof(requestId, proofPreview);
      toast.success("Payment marked as sent! The company will confirm shortly.");
      onDone();
    } catch {
      toast.error("Failed to submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (showCamera) {
    return (
      <CameraCapture
        title="Payment Proof"
        facingMode="environment"
        onCapture={handleCameraCapture}
        onCancel={() => setShowCamera(false)}
      />
    );
  }

  return (
    <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 overflow-hidden">
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

      <div className="px-4 py-4 border-b border-emerald-200">
        <div className="flex items-center gap-2 mb-1">
          <Banknote className="h-5 w-5 text-emerald-700" />
          <p className="font-bold text-emerald-900">Make Payment</p>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-emerald-700">Transfer amount</span>
          <span className="text-2xl font-bold text-emerald-700">₦{amount.toLocaleString()}</span>
        </div>
      </div>

      {/* Bank details — shown once company has set them */}
      {paymentDetails ? (
        <div className="px-4 py-3 bg-white/70 divide-y divide-emerald-100">
          {[
            { label: "Bank",           value: paymentDetails.bankName },
            { label: "Account Number", value: paymentDetails.accountNumber },
            { label: "Account Name",   value: paymentDetails.accountName },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between py-2.5">
              <div className="min-w-0 mr-2">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="font-bold text-sm truncate">{value}</p>
              </div>
              <button
                onClick={() => copyToClipboard(value, label)}
                className="h-7 w-7 rounded-lg flex items-center justify-center text-emerald-600 hover:bg-emerald-100 flex-shrink-0"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="px-4 py-3 flex items-center gap-2.5 bg-amber-50/80 border-b border-emerald-200">
          <Clock className="h-4 w-4 text-amber-500 flex-shrink-0 animate-pulse" />
          <p className="text-xs text-amber-800 font-medium">Bank details are being prepared. You can still upload your proof now.</p>
        </div>
      )}

      {/* Proof upload section */}
      <div className="px-4 py-4 space-y-3">
        <div>
          <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <ImagePlus className="h-3.5 w-3.5" /> Upload Payment Proof
          </p>
          <p className="text-xs text-emerald-700 mb-3">
            Take a screenshot of your bank transfer receipt and upload it below. The company will verify and confirm.
          </p>

          {proofPreview ? (
            <div className="relative rounded-xl overflow-hidden border-2 border-emerald-300">
              <img src={proofPreview} alt="Payment proof" className="w-full object-cover max-h-44" />
              <div className="absolute top-2 right-2 flex gap-2">
                <button
                  onClick={() => setShowCamera(true)}
                  className="bg-black/50 text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 backdrop-blur-sm"
                >
                  <Camera className="h-3 w-3" /> Retake
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-black/50 text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 backdrop-blur-sm"
                >
                  <Upload className="h-3 w-3" /> Change
                </button>
              </div>
              <div className="absolute bottom-2 left-2 bg-emerald-600 text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1">
                <CheckCircle className="h-3 w-3" /> Proof ready
              </div>
            </div>
          ) : (
            <div className="flex gap-2.5">
              {uploading ? (
                <div className="flex-1 flex items-center justify-center gap-3 py-8 bg-white rounded-xl border-2 border-dashed border-emerald-300">
                  <div className="h-5 w-5 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin" />
                  <p className="text-sm text-emerald-700 font-medium">Uploading…</p>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => setShowCamera(true)}
                    className="flex-1 flex flex-col items-center gap-2.5 py-5 rounded-xl border-2 border-dashed border-emerald-400 bg-white hover:bg-emerald-50 transition-colors active:scale-[0.98]"
                  >
                    <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                      <Camera className="h-5 w-5 text-emerald-600" />
                    </div>
                    <span className="text-xs font-bold text-emerald-700">Take Photo</span>
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 flex flex-col items-center gap-2.5 py-5 rounded-xl border-2 border-dashed border-emerald-300 bg-white hover:bg-emerald-50 transition-colors active:scale-[0.98]"
                  >
                    <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                      <Upload className="h-5 w-5 text-emerald-600" />
                    </div>
                    <span className="text-xs font-bold text-emerald-700">Upload</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        <button
          onClick={handleSubmit}
          disabled={submitting || uploading || !proofPreview}
          className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm py-3.5 rounded-xl disabled:opacity-50 transition-all active:scale-[0.98]"
        >
          <SendHorizonal className="h-4 w-4" />
          {submitting ? "Submitting…" : "Mark Payment Done"}
        </button>

        {!proofPreview && (
          <p className="text-[11px] text-emerald-600 text-center">
            You must upload proof before marking payment as done.
          </p>
        )}
      </div>
    </div>
  );
}

// ── Delivery Completion Flow (driver) ─────────────────────────────────────────

function DeliveryCompletionFlow({ requestId, assignmentId, customerId, onComplete, onProofSubmitted, existingProofUrl, signatureRequestAlreadySent, driverLat, driverLng }: {
  requestId: string; assignmentId: string; customerId: string;
  onComplete: () => void; onProofSubmitted?: (url: string) => void;
  existingProofUrl?: string | null;
  signatureRequestAlreadySent: boolean;
  driverLat?: number | null; driverLng?: number | null;
}) {
  const [step,         setStep]         = useState<"proof" | "signature">(existingProofUrl ? "signature" : "proof");
  const [showCamera,   setShowCamera]   = useState(false);
  const [proofPreview, setProofPreview] = useState<string | null>(existingProofUrl ?? null);
  const [uploading,    setUploading]    = useState(false);
  const [submitting,   setSubmitting]   = useState(false);
  const [sentRequest,  setSentRequest]  = useState(signatureRequestAlreadySent);
  const getSigRef    = useRef<(() => string | null) | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadAndAdvance = async (dataUrl: string) => {
    setUploading(true);
    try {
      const url = await uploadToCloudinary(dataUrl);
      setProofPreview(url);
      await submitDeliveryProofAndRequestSignature(requestId, assignmentId, url, driverLat, driverLng);
      setStep("signature");
      onProofSubmitted?.(url);
      toast.success("Proof submitted! Waiting for customer confirmation.");
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const handleCameraCapture = async (dataUrl: string) => { setShowCamera(false); await uploadAndAdvance(dataUrl); };
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => { await uploadAndAdvance(ev.target?.result as string); };
    reader.readAsDataURL(file);
  };

  const handleConfirmSignature = async () => {
    const dataUrl = getSigRef.current?.();
    if (!dataUrl) { toast.error("Please sign before confirming."); return; }
    setSubmitting(true);
    try {
      const url = await uploadToCloudinary(dataUrl);
      await submitCustomerSignature(requestId, assignmentId, url);
      toast.success("Delivery confirmed! 🎉");
      onComplete();
    } catch { toast.error("Failed to save signature."); }
    finally { setSubmitting(false); }
  };

  const handleDone = async () => {
    setSubmitting(true);
    try {
      await confirmDeliveryWithoutSignature(requestId, assignmentId);
      toast.success("Delivery confirmed!");
      onComplete();
    } catch { toast.error("Something went wrong."); }
    finally { setSubmitting(false); }
  };

  const handleSendToCustomer = async () => {
    setSubmitting(true);
    try {
      await sendSignatureRequestToCustomer(requestId, customerId);
      setSentRequest(true);
      toast.success("Signature request sent to customer.");
    } catch { toast.error("Failed to send request."); }
    finally { setSubmitting(false); }
  };

  if (showCamera) {
    return <CameraCapture title="Proof of Delivery" facingMode="environment" onCapture={handleCameraCapture} onCancel={() => setShowCamera(false)} />;
  }

  const proofDone = !!proofPreview;

  return (
    <div className="space-y-3">
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />

      {/* Step 1 — Proof */}
      <div className={`rounded-2xl border overflow-hidden transition-all ${proofDone ? "border-emerald-200 bg-emerald-50/40" : "border-primary/30 bg-primary/5"}`}>
        <div className="flex items-center gap-3 px-4 py-3.5">
          <StepBadge n={1} active={!proofDone} done={proofDone} />
          <div className="flex-1 min-w-0">
            <p className={`font-bold text-sm ${proofDone ? "text-emerald-800" : "text-foreground"}`}>Proof of Delivery</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {proofDone ? "Photo uploaded & locked" : "Capture or upload a photo of the delivered package"}
            </p>
          </div>
          {proofDone && (
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-1 rounded-full flex-shrink-0">
              <Lock className="h-3 w-3" /> Locked
            </div>
          )}
        </div>

        {!proofDone && (
          <div className="px-4 pb-4">
            {uploading ? (
              <div className="flex items-center justify-center gap-3 py-6">
                <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                <p className="text-sm text-muted-foreground font-medium">Uploading to Cloudinary…</p>
              </div>
            ) : (
              <div className="flex gap-2.5">
                <button onClick={() => setShowCamera(true)}
                  className="flex-1 flex flex-col items-center gap-2.5 py-5 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 transition-colors active:scale-[0.98]">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center"><Camera className="h-5 w-5 text-primary" /></div>
                  <span className="text-xs font-bold text-primary">Take Photo</span>
                </button>
                <button onClick={() => fileInputRef.current?.click()}
                  className="flex-1 flex flex-col items-center gap-2.5 py-5 rounded-xl border-2 border-dashed border-border bg-muted/30 hover:bg-muted/60 transition-colors active:scale-[0.98]">
                  <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center"><Upload className="h-5 w-5 text-muted-foreground" /></div>
                  <span className="text-xs font-bold text-muted-foreground">Upload</span>
                </button>
              </div>
            )}
          </div>
        )}

        {proofDone && proofPreview && (
          <div className="px-4 pb-4">
            <div className="rounded-xl overflow-hidden border border-emerald-200 relative">
              <img src={proofPreview} alt="Proof" className="w-full object-cover max-h-36" />
              <div className="absolute top-2 right-2 bg-emerald-600 text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1">
                <CheckCircle className="h-3 w-3" /> Uploaded
              </div>
              {driverLat && driverLng && (
                <div className="absolute bottom-2 left-2 bg-black/60 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 backdrop-blur-sm">
                  <MapPin className="h-3 w-3 text-emerald-400" />{driverLat.toFixed(4)}, {driverLng.toFixed(4)}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Step 2 — Signature */}
      <div className={`rounded-2xl border overflow-hidden transition-all ${!proofDone ? "border-border bg-muted/20 opacity-50 pointer-events-none" : "border-amber-200 bg-amber-50/40"}`}>
        <div className="flex items-center gap-3 px-4 py-3.5">
          <StepBadge n={2} active={proofDone} done={false} />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm">Customer Signature</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {!proofDone ? "Complete proof of delivery first"
                : sentRequest ? "Awaiting customer confirmation on their dashboard"
                : "Hand device to customer or send remote request"}
            </p>
          </div>
        </div>

        {proofDone && (
          <div className="px-4 pb-4 space-y-3">
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <PenLine className="h-3.5 w-3.5" /> Customer signs here
              </p>
              <SignatureCanvas onReady={(fn) => { getSigRef.current = fn; }} />
            </div>

            <button onClick={handleConfirmSignature} disabled={submitting}
              className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-3 rounded-xl font-bold text-sm transition-all hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50">
              <ShieldCheck className="h-4 w-4" />
              {submitting ? "Saving…" : "Confirm Signature & Complete Delivery"}
            </button>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-border" />
              <span className="text-[11px] text-muted-foreground font-medium">customer not present?</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {sentRequest ? (
              <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl p-3.5">
                <div className="h-8 w-8 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <ShieldCheck className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="font-bold text-sm text-blue-900">Request sent</p>
                  <p className="text-xs text-blue-700 mt-0.5">Customer will confirm on their dashboard. Auto-completes in 24 h.</p>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <button onClick={handleSendToCustomer} disabled={submitting}
                  className="flex-1 flex items-center justify-center gap-2 border-2 border-primary/25 bg-primary/5 hover:bg-primary/10 text-primary px-4 py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-[0.98] disabled:opacity-50">
                  <UserX className="h-4 w-4" />{submitting ? "Sending…" : "Send to Customer"}
                </button>
                <button onClick={handleDone} disabled={submitting}
                  className="flex-1 flex items-center justify-center gap-2 border border-border bg-muted/40 hover:bg-muted text-foreground px-4 py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-[0.98] disabled:opacity-50">
                  <CheckCircle className="h-4 w-4" /> Done
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Driver awaiting customer confirmation ─────────────────────────────────────

function DriverAwaitingConfirmation({ requestId, assignmentId, customerId, proofUrl, signatureRequestAlreadySent }: {
  requestId: string; assignmentId: string; customerId: string;
  proofUrl?: string | null; signatureRequestAlreadySent: boolean;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [sentRequest, setSentRequest] = useState(signatureRequestAlreadySent);

  const handleNotifyCustomer = async () => {
    setSubmitting(true);
    try {
      await sendSignatureRequestToCustomer(requestId, customerId);
      setSentRequest(true);
      toast.success("Confirmation request sent to customer.");
    } catch { toast.error("Failed to send request."); }
    finally { setSubmitting(false); }
  };

  const handleDone = async () => {
    setSubmitting(true);
    try {
      await confirmDeliveryWithoutSignature(requestId, assignmentId);
      toast.success("Delivery marked as complete.");
    } catch { toast.error("Something went wrong."); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="rounded-2xl border-2 border-amber-200 bg-amber-50/50 overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-4 border-b border-amber-200">
        <div className="relative flex-shrink-0">
          <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center">
            <Clock className="h-5 w-5 text-amber-700" />
          </div>
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
        </div>
        <div>
          <p className="font-bold text-sm text-amber-900">Waiting for Customer Confirmation</p>
          <p className="text-xs text-amber-700 mt-0.5">Proof submitted — customer needs to sign or confirm receipt</p>
        </div>
      </div>

      {proofUrl && (
        <div className="px-4 pt-3">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1">
            <ImagePlus className="h-3.5 w-3.5" /> Proof submitted
          </p>
          <div className="rounded-xl overflow-hidden border border-amber-200 relative">
            <img src={proofUrl} alt="Proof" className="w-full object-cover max-h-28" />
            <div className="absolute top-2 right-2 bg-emerald-600 text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1">
              <CheckCircle className="h-3 w-3" /> Uploaded
            </div>
          </div>
        </div>
      )}

      <div className="p-4 space-y-3">
        {sentRequest ? (
          <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl p-3.5">
            <div className="h-8 w-8 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="font-bold text-sm text-blue-900">Request sent to customer</p>
              <p className="text-xs text-blue-700 mt-0.5">They'll confirm on their dashboard. Auto-completes in 24 h.</p>
            </div>
          </div>
        ) : (
          <button onClick={handleNotifyCustomer} disabled={submitting}
            className="w-full flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-4 py-3 rounded-xl font-bold text-sm transition-all active:scale-[0.98] disabled:opacity-50">
            <UserX className="h-4 w-4" />{submitting ? "Sending…" : "Notify Customer"}
          </button>
        )}

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-amber-200" />
          <span className="text-[11px] text-amber-700 font-medium">or</span>
          <div className="flex-1 h-px bg-amber-200" />
        </div>

        <button onClick={handleDone} disabled={submitting}
          className="w-full flex items-center justify-center gap-2 border border-amber-300 bg-white hover:bg-amber-50 text-amber-800 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-[0.98] disabled:opacity-50">
          <CheckCircle className="h-4 w-4" />{submitting ? "Confirming…" : "Mark as Delivered Without Confirmation"}
        </button>
      </div>
    </div>
  );
}

// ── Customer signature confirmation ───────────────────────────────────────────

function CustomerSignatureConfirmation({ requestId, assignmentId, proofUrl, expiresAt, onComplete }: {
  requestId: string; assignmentId: string; proofUrl?: string | null;
  expiresAt?: Date | null; onComplete: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const getSigRef = useRef<(() => string | null) | null>(null);

  const handleSign = async () => {
    const dataUrl = getSigRef.current?.();
    if (!dataUrl) { toast.error("Please sign before confirming."); return; }
    setSubmitting(true);
    try {
      const url = await uploadToCloudinary(dataUrl);
      await submitCustomerSignature(requestId, assignmentId, url);
      toast.success("Delivery confirmed! Thank you. 🎉");
      onComplete();
    } catch { toast.error("Failed to save signature."); }
    finally { setSubmitting(false); }
  };

  const handleDone = async () => {
    setSubmitting(true);
    try {
      await confirmDeliveryWithoutSignature(requestId, assignmentId);
      toast.success("Delivery confirmed!");
      onComplete();
    } catch { toast.error("Something went wrong."); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="rounded-2xl border-2 border-amber-200 bg-amber-50/50 overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-4 border-b border-amber-200">
        <div className="h-10 w-10 rounded-xl bg-amber-200 flex items-center justify-center flex-shrink-0">
          <Fingerprint className="h-5 w-5 text-amber-700" />
        </div>
        <div>
          <p className="font-bold text-sm text-amber-900">Confirm Receipt</p>
          <p className="text-xs text-amber-700 mt-0.5">Your delivery has arrived — sign below or tap Done.</p>
        </div>
      </div>

      {proofUrl && (
        <div className="px-4 pt-3">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1">
            <ImagePlus className="h-3.5 w-3.5" /> Driver's proof photo
          </p>
          <div className="rounded-xl overflow-hidden border border-amber-200">
            <img src={proofUrl} alt="Delivery proof" className="w-full object-cover max-h-32" />
          </div>
        </div>
      )}

      {expiresAt && (
        <div className="px-4 pt-3">
          <ExpiryCountdown expiresAt={expiresAt} />
        </div>
      )}

      <div className="p-4 space-y-3">
        <SignatureCanvas onReady={(fn) => { getSigRef.current = fn; }} />
        <button onClick={handleSign} disabled={submitting}
          className="w-full flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-4 py-3 rounded-xl font-bold text-sm transition-all active:scale-[0.98] disabled:opacity-50">
          <PenLine className="h-4 w-4" />{submitting ? "Saving…" : "Submit Signature"}
        </button>
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-amber-200" />
          <span className="text-[11px] text-amber-700 font-medium">or</span>
          <div className="flex-1 h-px bg-amber-200" />
        </div>
        <button onClick={handleDone} disabled={submitting}
          className="w-full flex items-center justify-center gap-2 border-2 border-amber-300 bg-white hover:bg-amber-50 text-amber-800 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-[0.98] disabled:opacity-50">
          <CheckCircle className="h-4 w-4" />{submitting ? "Confirming…" : "Done — I received my delivery"}
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function DeliveryTracking({ requestId, currentUserId, userRole, onClose, hideMarkAsDelivered = false, fullPage = false, onFindDriverAgain }: DeliveryTrackingProps) {
  const [request,           setRequest]           = useState<DeliveryRequest | null>(null);
  const [assignment,        setAssignment]        = useState<Assignment | null>(null);
  const [driverProfile,     setDriverProfile]     = useState<{ driverId: string; user?: UserDoc | null; driver?: DriverDoc | null; vehicle?: VehicleDoc | null } | null>(null);
  const [isLoading,         setIsLoading]         = useState(true);
  const [actionLoading,     setActionLoading]     = useState(false);
  const [showShare,         setShowShare]         = useState(false);
  const [showDriverProfile, setShowDriverProfile] = useState(false);
  const [showRouteReplay,   setShowRouteReplay]   = useState(false);
  const [showChat,          setShowChat]          = useState(false);
  const [chatUnread,        setChatUnread]        = useState(0);
  const [showCompletion,    setShowCompletion]    = useState(false);
  const [showLiveTracking,  setShowLiveTracking]  = useState(false);
  const [paymentDone,       setPaymentDone]       = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelLoading,     setCancelLoading]     = useState(false);
  const [cancelReason,      setCancelReason]      = useState("");
  const [cancelCount,       setCancelCount]       = useState(0);
  const [optimisticProofUrl, setOptimisticProofUrl] = useState<string | null>(null);
  const [optimisticAwaitingSig, setOptimisticAwaitingSig] = useState(false);
  const chatInitRef = useRef(false);
  const driverUnsubRef = useRef<(() => void) | null>(null);

  const driverLoc   = driverProfile?.driver?.currentLocation
    ? { lat: driverProfile.driver.currentLocation.lat, lng: driverProfile.driver.currentLocation.lng } : null;
  const driverName  = [driverProfile?.user?.firstName, driverProfile?.user?.lastName].filter(Boolean).join(" ") || "Driver";
  const driverPhoto = (driverProfile?.driver as any)?.selfieUrl ?? null;

  const isSelfDriver  = (request as any)?.driverType === "self_driver";
  const STATUS_STEPS  = isSelfDriver ? STATUS_STEPS_SELF_DRIVER : STATUS_STEPS_COMPANY_DRIVER;
  const isInTransit   = request?.status === "in_progress" && !optimisticAwaitingSig;
  const isCompleted   = request?.status === "completed";
  const cancelledBy   = (request as any)?.cancelledBy as "customer" | "driver" | undefined;
  // Fix #2: customer cancel requires driverProfile loaded (needed for notification target).
  // Fix #3: driver cancel only available after they've accepted (driverAccepted===true),
  //         and only at driver_accepted status — at driver_assigned they should Decline, not Cancel.
  const canCustomerCancel = userRole === "customer" && !!request && isSelfDriver &&
    !assignment?.startedAt && !!driverProfile?.driverId &&
    ["driver_assigned", "driver_accepted"].includes(request.status);
  const canDriverCancel = userRole === "driver" && !!request && isSelfDriver &&
    !assignment?.startedAt && assignment?.driverAccepted === true &&
    request.status === "driver_accepted" && !!request.customerId;
  const canCancel = canCustomerCancel || canDriverCancel;
  const isAwaitingSig = request?.status === "awaiting_signature" || optimisticAwaitingSig;

  const chatEnabled = !!driverProfile?.driverId && !!request && CHAT_ENABLED_STATUSES.includes(request.status);
  const otherUserId = userRole === "customer" ? (driverProfile?.driverId ?? "") : (request?.customerId ?? "");

  const etaDistanceKm: number | null = (() => {
    if (!isInTransit || !driverLoc || !request?.dropoff?.lat || !request?.dropoff?.lng) return null;
    return haversineKm(driverLoc.lat, driverLoc.lng, request.dropoff.lat, request.dropoff.lng);
  })();

  const displayPrice   = (request as any)?.finalPrice ?? (request as any)?.negotiatedPrice ?? (request as any)?.quotedPrice ?? request?.estimatedPrice;
  const paymentDetails = (request as any)?.paymentDetails;
  const paymentSent    = !!(request as any)?.paymentSentAt;
  const paymentProofUrl = (request as any)?.paymentProofUrl ?? null;
  const sigReqSent     = !!(request as any)?.signatureRequestSentAt;
  const proofUrl       = optimisticProofUrl ?? (request as any)?.proof?.url ?? (request as any)?.deliveryProofUrl ?? null;
  const expiresAtRaw   = (request as any)?.signatureExpiresAt;
  const expiresAt: Date | null = expiresAtRaw
    ? (typeof expiresAtRaw === "object" && "toDate" in expiresAtRaw ? expiresAtRaw.toDate() : new Date(expiresAtRaw))
    : null;
  const companyInfo    = (request as any)?.companyInfo ?? null;
  const paymentAmount  = (request as any)?.negotiatedPrice ?? (request as any)?.quotedPrice ?? request?.estimatedPrice ?? 0;

  // Sync paymentDone from live request
  useEffect(() => {
    if (paymentSent) setPaymentDone(true);
  }, [paymentSent]);

  // Fix #7: load cancellation count when the dialog opens so we can warn repeat cancellers
  useEffect(() => {
    if (!showCancelConfirm) return;
    getUserCancellationCount(currentUserId).then(setCancelCount).catch(() => {});
  }, [showCancelConfirm, currentUserId]);

  // Auto-expand completion flow for driver when status hits awaiting_signature
  useEffect(() => {
    if (userRole === "driver" && isAwaitingSig) setShowCompletion(true);
  }, [isAwaitingSig, userRole]);

  // Firestore listeners
  useEffect(() => {
    setIsLoading(true);
    const unsubReq = listenDeliveryRequest(requestId, (d) => { setRequest(d as DeliveryRequest | null); setIsLoading(false); });
    const unsubAssign = listenAssignmentsForRequest(requestId, async (docs) => {
      const first = docs[0] ?? null;
      setAssignment(first as any);
      if (!first) {
        driverUnsubRef.current?.();
        driverUnsubRef.current = null;
        setDriverProfile(null);
        return;
      }
      const dId = first.driverId;
      // User and vehicle docs are static — fetch once
      const [userSnap, vehicleSnap] = await Promise.all([
        getDoc(doc(db, "users",    dId)),
        getDoc(doc(db, "vehicles", dId)),
      ]);
      const userDoc    = userSnap.exists()    ? (userSnap.data()    as UserDoc)    : null;
      const vehicleDoc = vehicleSnap.exists() ? (vehicleSnap.data() as VehicleDoc) : null;
      // Driver doc has currentLocation — subscribe for real-time updates
      driverUnsubRef.current?.();
      driverUnsubRef.current = onSnapshot(doc(db, "drivers", dId), (snap) => {
        setDriverProfile({
          driverId: dId,
          driver:  snap.exists() ? (snap.data() as DriverDoc) : null,
          user:    userDoc,
          vehicle: vehicleDoc,
        });
      });
    });
    return () => { unsubReq(); unsubAssign(); driverUnsubRef.current?.(); };
  }, [requestId]);

  // Chat unread
  useEffect(() => {
    if (!chatEnabled || !currentUserId || !otherUserId || chatInitRef.current) return;
    chatInitRef.current = true;
    (async () => {
      try {
        const cId = await getOrCreateChat(requestId, [currentUserId, otherUserId]);
        listenMessages(cId, (msgs) => {
          setChatUnread(msgs.filter(m => m.senderId !== currentUserId && !(m.readBy ?? []).includes(currentUserId)).length);
        });
      } catch {}
    })();
  }, [chatEnabled, currentUserId, otherUserId, requestId]);

  useEffect(() => { if (showChat) setChatUnread(0); }, [showChat]);

  const withLoading = async (fn: () => Promise<void>) => {
    setActionLoading(true);
    try { await fn(); } finally { setActionLoading(false); }
  };

  const handleAcceptQuote  = () => withLoading(async () => { await acceptPriceQuote(requestId); toast.success("Price accepted!"); });
  const handleRejectQuote  = () => withLoading(async () => { await rejectPriceQuote(requestId); toast.info("Delivery cancelled."); onClose?.(); });
  const handleRequestNego  = () => withLoading(async () => { if (!request) return; await requestNegotiationCall(requestId, request.customerId); toast.success("Call request sent!"); });
  const handleStartDeliv   = () => withLoading(async () => { if (!assignment) return; await markAssignmentStarted(assignment.id); await updateDeliveryStatus(requestId, "in_progress"); toast.success("Delivery started!"); });
  const handleDriverAccept = () => withLoading(async () => { if (!assignment) return; await setDriverAccepted(assignment.id, true,  requestId); toast.success("Accepted!"); });
  const handleDriverReject = () => withLoading(async () => { if (!assignment) return; await setDriverAccepted(assignment.id, false, requestId); toast.info("Declined."); });

  const handleCustomerCancel = async () => {
    if (!driverProfile?.driverId || !assignment?.id) return;
    setCancelLoading(true);
    try {
      await cancelDeliveryByCustomer(requestId, driverProfile.driverId, assignment.id, cancelReason || undefined);
      setShowCancelConfirm(false);
      setCancelReason("");
      // Fix #11: don't close immediately — let the "Delivery Cancelled" banner appear.
      // The Firestore listener will update request.status to "cancelled" and show the
      // "You cancelled this delivery." message. Customer closes the card manually.
    } catch (e: any) {
      toast.error(e?.message === "Delivery can no longer be cancelled"
        ? "This delivery has already started and cannot be cancelled."
        : "Failed to cancel. Please try again.");
      setShowCancelConfirm(false);
      setCancelReason("");
    } finally {
      setCancelLoading(false);
    }
  };

  const handleDriverCancel = async () => {
    if (!request?.customerId || !assignment?.id) return;
    setCancelLoading(true);
    try {
      await cancelDeliveryByDriver(requestId, request.customerId, assignment.id, cancelReason || undefined);
      toast.info("Delivery cancelled.");
      setShowCancelConfirm(false);
      setCancelReason("");
    } catch (e: any) {
      toast.error(e?.message === "Delivery can no longer be cancelled"
        ? "This delivery has already started and cannot be cancelled."
        : "Failed to cancel. Please try again.");
      setShowCancelConfirm(false);
      setCancelReason("");
    } finally {
      setCancelLoading(false);
    }
  };

  const copyToClipboard = (text: string, label: string) =>
    navigator.clipboard.writeText(text).then(() => toast.success(`${label} copied`));

  const stepIdx     = (() => { if (!request) return 0; const i = STATUS_STEPS.findIndex(s => s.key === request.status); return i === -1 ? 0 : i; })();
  const isShareable = request && ["pending","driver_assigned","in_progress","arrived"].includes(request.status);

  const mapMarkers: any[] = [];
  if (request?.pickup?.lat  && request?.pickup?.lng)  mapMarkers.push({ id:"pickup",  latitude:request.pickup.lat,  longitude:request.pickup.lng,  type:"pickup"  as const, label:"Pickup" });
  if (request?.dropoff?.lat && request?.dropoff?.lng) mapMarkers.push({ id:"dropoff", latitude:request.dropoff.lat, longitude:request.dropoff.lng, type:"dropoff" as const, label:"Drop-off" });
  if (driverLoc) mapMarkers.push({ id:"driver", latitude:driverLoc.lat, longitude:driverLoc.lng, type:"driver" as const, label:driverName });

  if (isLoading) return (
    <div className={fullPage ? "flex-1 flex items-center justify-center py-20" : "bg-card rounded-2xl border border-border p-12 text-center"}>
      <div>
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    </div>
  );

  if (!request) return (
    <div className={fullPage ? "flex-1 flex items-center justify-center py-20" : "bg-card rounded-2xl border border-border p-12 text-center"}>
      <div>
        <Package className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
        <p className="text-muted-foreground text-sm">Request not found</p>
      </div>
    </div>
  );

  const liveInitials = driverName && driverName !== "Driver"
    ? driverName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()
    : "";
  const liveVehicleLabel = [
    (driverProfile?.vehicle as any)?.color as string | undefined,
    (driverProfile?.vehicle as any)?.vehicleType as string | undefined,
  ].filter(Boolean).join(" ") || undefined;
  const livePlateNumber = (driverProfile?.vehicle as any)?.plateNumber as string | undefined;
  const liveDistKm = driverLoc && request.dropoff?.lat && request.dropoff?.lng
    ? haversineKm(driverLoc.lat, driverLoc.lng, request.dropoff.lat, request.dropoff.lng)
    : null;
  const liveEtaMinutes = liveDistKm !== null ? Math.max(1, Math.round((liveDistKm / 30) * 60)) : null;

  return (
    <>
    <div className={fullPage ? "w-full max-w-4xl mx-auto bg-white" : "bg-card rounded-2xl border border-border overflow-hidden"}>
      {showDriverProfile && driverProfile?.driverId && (
        <DriverProfileModal driverId={driverProfile.driverId} onClose={() => setShowDriverProfile(false)} />
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-border">
        <div className="flex-1 min-w-0 mr-2">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-bold text-sm truncate">{shortDeliveryName(request.id)}</h2>
            {isSelfDriver && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground flex items-center gap-0.5 flex-shrink-0">
                <Zap className="h-2.5 w-2.5" /> Self Driver
              </span>
            )}
            {isAwaitingSig && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500 text-white flex items-center gap-0.5 flex-shrink-0 animate-pulse">
                <PenLine className="h-2.5 w-2.5" /> Signing
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">#{requestId.slice(0, 8).toUpperCase()}</p>
        </div>
        <div className="flex items-center gap-1">
          {isCompleted && (
            <button onClick={() => setShowRouteReplay(!showRouteReplay)}
              className={`h-8 w-8 rounded-xl flex items-center justify-center transition-colors ${showRouteReplay ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"}`}>
              <RotateCcw className="h-4 w-4" />
            </button>
          )}
          {isShareable && (
            <button onClick={() => setShowShare(!showShare)}
              className={`h-8 w-8 rounded-xl flex items-center justify-center transition-colors ${showShare ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"}`}>
              <Share2 className="h-4 w-4" />
            </button>
          )}
          {onClose && (
            <button onClick={onClose} className="h-8 w-8 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-muted">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {showShare && <div className="px-4 pt-3"><SharePanel request={request} senderName={userRole === "customer" ? "Customer" : "Driver"} driverLoc={driverLoc} onClose={() => setShowShare(false)} /></div>}
      {showRouteReplay && isCompleted && <div className="px-4 pt-3"><RouteReplayPanel request={request} onClose={() => setShowRouteReplay(false)} /></div>}

      {/* Map — isolate confines the map's z-[1000] overlays to this stacking context so they don't float above the sticky page header */}
      <div className={`${fullPage ? "h-72 lg:h-[420px]" : "h-52"} relative isolate overflow-hidden`}>
        <MapView className="h-full" markers={mapMarkers}
          userLatitude={driverLoc?.lat ?? request.pickup?.lat}
          userLongitude={driverLoc?.lng ?? request.pickup?.lng}
          routeFrom={request.pickup?.lat  ? [request.pickup.lat,  request.pickup.lng]  : undefined}
          routeTo={request.dropoff?.lat   ? [request.dropoff.lat, request.dropoff.lng] : undefined}
          hideExternalLink />
        {driverLoc && !isCompleted && (
          <div className="absolute bottom-2 left-2 bg-black/60 text-white text-[10px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5 backdrop-blur-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />Driver live
          </div>
        )}
        {isCompleted && (
          <div className="absolute bottom-2 left-2 bg-black/60 text-white text-[10px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5 backdrop-blur-sm">
            <CheckCircle className="h-3 w-3 text-emerald-400" />Delivered
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">

        {/* Timeline */}
        <div className="space-y-2">
          <div className="flex items-center overflow-x-auto gap-0 pb-1 scrollbar-hide">
            {STATUS_STEPS.map((step, idx) => {
              const isActive  = idx <= stepIdx;
              const isCurrent = idx === stepIdx;
              const Icon = step.icon;
              return (
                <div key={step.key} className="flex items-center flex-shrink-0">
                  <div className="flex flex-col items-center gap-1">
                    <div className={`h-8 w-8 rounded-xl flex items-center justify-center transition-all ${isCurrent ? "bg-primary text-primary-foreground shadow-sm shadow-primary/30 scale-110" : isActive ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground/40"}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    {isCurrent && <span className="text-[9px] font-bold text-primary whitespace-nowrap">{step.label}</span>}
                  </div>
                  {idx < STATUS_STEPS.length - 1 && (
                    <div className={`w-5 h-0.5 mx-0.5 rounded-full ${idx < stepIdx ? "bg-primary" : "bg-muted"}`} />
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isCompleted ? "bg-emerald-500" : isAwaitingSig ? "bg-amber-500 animate-pulse" : "bg-primary animate-pulse"}`} />
            <p className="text-sm font-bold">{STATUS_STEPS[stepIdx]?.label ?? "Processing"}</p>
          </div>
        </div>

        {/* Track Live — only for customers once a driver is assigned */}
        {userRole === "customer" && driverProfile?.driverId && (
          <button
            onClick={() => setShowLiveTracking(true)}
            className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-[0.98] shadow-sm shadow-primary/25"
          >
            <span className="w-2 h-2 rounded-full bg-white/80 animate-pulse flex-shrink-0" />
            Track Live
          </button>
        )}

        {/* ETA */}
        {userRole === "customer" && isInTransit && etaDistanceKm !== null && etaDistanceKm > 0 && (
          <ETACountdown distanceKm={etaDistanceKm} />
        )}

        {/* Addresses */}
        <div className="bg-muted/40 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <div className="flex flex-col items-center gap-0 mt-1.5 flex-shrink-0">
              <div className="w-2.5 h-2.5 rounded-full bg-primary" />
              <div className="w-px h-6 bg-border mx-auto my-0.5" />
              <div className="w-2.5 h-2.5 rounded-full bg-destructive" />
            </div>
            <div className="flex-1 min-w-0 space-y-2.5">
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Pickup</p>
                <p className="font-semibold text-sm truncate">{request.pickup.address}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Drop-off</p>
                <p className="font-semibold text-sm truncate">{request.dropoff.address}</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── CUSTOMER: Company info — shown immediately after acceptance ── */}
        {userRole === "customer" && !isSelfDriver && companyInfo && (
          <CompanyInfoCard info={companyInfo} />
        )}

        {/* ── DRIVER: Start Delivery ── */}
        {userRole === "driver" && (request.status === "driver_accepted" || (!isSelfDriver && request.status === "customer_confirmed")) && !assignment?.startedAt && (
          <Btn variant="default" onClick={handleStartDeliv} disabled={actionLoading} className="w-full">
            <Navigation className="h-4 w-4" />Start Delivery
          </Btn>
        )}

        {/* ── DRIVER: Awaiting customer confirmation after proof submitted ── */}
        {userRole === "driver" && isAwaitingSig && (
          <DriverAwaitingConfirmation
            requestId={requestId}
            assignmentId={assignment?.id ?? ""}
            customerId={request.customerId}
            proofUrl={proofUrl}
            signatureRequestAlreadySent={sigReqSent}
          />
        )}

        {/* ── DRIVER: Mark as Delivered + proof upload flow ── */}
        {userRole === "driver" && !hideMarkAsDelivered && isInTransit && (
          <div className="space-y-3">
            {!showCompletion && (
              <button onClick={() => setShowCompletion(true)}
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3 rounded-xl font-bold text-sm transition-all active:scale-[0.98]">
                <CheckCircle className="h-4 w-4" /> Mark as Delivered
              </button>
            )}
            {showCompletion && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-sm">Complete Delivery</p>
                  <button onClick={() => setShowCompletion(false)} className="h-7 w-7 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-muted">
                    <ChevronUp className="h-4 w-4" />
                  </button>
                </div>
                <DeliveryCompletionFlow
                  requestId={requestId}
                  assignmentId={assignment?.id ?? ""}
                  customerId={request.customerId}
                  existingProofUrl={proofUrl}
                  signatureRequestAlreadySent={sigReqSent}
                  driverLat={driverLoc?.lat}
                  driverLng={driverLoc?.lng}
                  onComplete={() => setShowCompletion(false)}
                  onProofSubmitted={(url) => { setOptimisticProofUrl(url); setOptimisticAwaitingSig(true); }}
                />
              </div>
            )}
          </div>
        )}

        {/* ── CUSTOMER: signature request ── */}
        {userRole === "customer" && isAwaitingSig && assignment && (
          <CustomerSignatureConfirmation
            requestId={requestId}
            assignmentId={assignment.id}
            proofUrl={proofUrl}
            expiresAt={expiresAt}
            onComplete={() => {}}
          />
        )}

        {userRole === "customer" && isAwaitingSig && !assignment && (
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <PenLine className="h-5 w-5 text-amber-600 flex-shrink-0 animate-pulse" />
            <div>
              <p className="font-bold text-sm text-amber-900">Signature required</p>
              <p className="text-xs text-amber-700 mt-0.5">Your driver has delivered your package. Please confirm receipt.</p>
            </div>
          </div>
        )}

        {/* Self driver banners */}
        {userRole === "customer" && isSelfDriver && request.status === "driver_assigned" && (
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <Clock className="h-5 w-5 text-amber-600 flex-shrink-0 animate-pulse" />
            <div><p className="font-bold text-sm text-amber-900">Waiting for driver</p><p className="text-xs text-amber-700 mt-0.5">Driver hasn't accepted yet.</p></div>
          </div>
        )}
        {userRole === "customer" && isSelfDriver && (request.status as any) === "negotiating_price" && (
          <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-2xl p-4">
            <PhoneCall className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5 animate-pulse" />
            <div>
              <p className="font-bold text-sm text-blue-900">Driver counter-offer pending</p>
              <p className="text-xs text-blue-700 mt-0.5">Open your pending delivery request to review and respond to the driver's price.</p>
            </div>
          </div>
        )}
        {userRole === "driver" && isSelfDriver && (request.status as any) === "negotiating_price" && (
          <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-2xl p-4">
            <PhoneCall className="h-5 w-5 text-blue-600 flex-shrink-0 animate-pulse" />
            <div><p className="font-bold text-sm text-blue-900">Counter offer sent</p><p className="text-xs text-blue-700 mt-0.5">₦{((request as any).counterOfferPrice ?? 0).toLocaleString()} — waiting for customer.</p></div>
          </div>
        )}
        {userRole === "driver" && isSelfDriver && request.status === "driver_assigned" && assignment?.driverAccepted === null && (
          <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-4 space-y-3">
            <div className="flex items-center gap-2"><Package className="h-5 w-5 text-primary" /><p className="font-bold text-sm text-primary">New Delivery Request</p></div>
            {displayPrice && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{(request as any).allowNegotiation ? "Base Price (negotiable)" : "Fixed Price"}</span>
                <span className="text-2xl font-bold text-primary">₦{displayPrice.toLocaleString()}</span>
              </div>
            )}
            <div className="flex gap-2">
              <Btn variant="destructive" onClick={handleDriverReject} disabled={actionLoading}><X className="h-4 w-4" />Decline</Btn>
              <Btn variant="green"       onClick={handleDriverAccept} disabled={actionLoading}><CheckCircle className="h-4 w-4" />{actionLoading ? "…" : "Accept"}</Btn>
            </div>
          </div>
        )}
        {userRole === "customer" && isSelfDriver && request.status === "driver_accepted" && (
          <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
            <CheckCircle className="h-5 w-5 text-emerald-600 flex-shrink-0" />
            <div><p className="font-bold text-sm text-emerald-900">Driver accepted! 🎉</p><p className="text-xs text-emerald-700 mt-0.5">Your driver is on the way.</p></div>
          </div>
        )}

        {/* Company driver quote */}
        {userRole === "customer" && !isSelfDriver && request.status === "price_set" && (request as any).quotedPrice && (
          <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-4 space-y-3">
            <div className="flex items-center gap-2"><DollarSign className="h-5 w-5 text-amber-600" /><p className="font-bold text-amber-900">Price Quote Received</p></div>
            <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Quoted price</span><span className="text-3xl font-bold text-amber-700">₦{(request as any).quotedPrice.toLocaleString()}</span></div>
            {(request as any).quoteNote && <div className="flex items-start gap-2 bg-white/60 rounded-xl p-3 text-sm text-amber-800"><AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" /><p>{(request as any).quoteNote}</p></div>}
            <div className="flex gap-2">
              <Btn variant="destructive" onClick={handleRejectQuote} disabled={actionLoading}><X className="h-4 w-4" />Decline</Btn>
              <Btn variant="blue"        onClick={handleRequestNego} disabled={actionLoading}><PhoneCall className="h-4 w-4" />Negotiate</Btn>
              <Btn variant="green"       onClick={handleAcceptQuote} disabled={actionLoading}><CheckCircle className="h-4 w-4" />{actionLoading ? "..." : "Accept"}</Btn>
            </div>
          </div>
        )}
        {userRole === "customer" && !isSelfDriver && request.status === "negotiating" && (
          <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-2xl p-4">
            <PhoneCall className="h-5 w-5 text-blue-600 flex-shrink-0 animate-pulse" />
            <div><p className="font-bold text-sm text-blue-900">Call Requested</p><p className="text-xs text-blue-700 mt-0.5">The assigned company will call you shortly.</p></div>
          </div>
        )}

        {/* ── CUSTOMER: Payment — full proof upload flow ── */}
        {userRole === "customer" && !isSelfDriver && request.status === "payment_pending" && !paymentDone && (
          <PaymentProofUpload
            requestId={requestId}
            amount={paymentAmount}
            paymentDetails={paymentDetails}
            onDone={() => setPaymentDone(true)}
          />
        )}

        {/* ── CUSTOMER: Payment sent confirmation banner ── */}
        {userRole === "customer" && !isSelfDriver && request.status === "payment_pending" && (paymentSent || paymentDone) && (
          <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-600 flex items-center justify-center flex-shrink-0">
                <CheckCircle className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="font-bold text-sm text-emerald-900">Payment Sent</p>
                <p className="text-xs text-emerald-700 mt-0.5">The company is verifying your transfer. You'll be notified once confirmed.</p>
              </div>
            </div>
            {paymentProofUrl && (
              <div className="rounded-xl overflow-hidden border border-emerald-200">
                <div className="flex items-center justify-between px-3 py-2 bg-white/60">
                  <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide flex items-center gap-1">
                    <ImagePlus className="h-3 w-3" /> Your Payment Proof
                  </p>
                  <a href={paymentProofUrl} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-emerald-700 underline">View full</a>
                </div>
                <img src={paymentProofUrl} alt="Payment proof" className="w-full object-cover max-h-36" />
              </div>
            )}
          </div>
        )}



        {/* Price */}
        {displayPrice && !["price_set","payment_pending","negotiating_price"].includes(request.status) && (
          <div className="bg-muted/40 rounded-2xl p-4 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{isSelfDriver ? "Agreed Price" : (request.finalPrice ? "Final Price" : "Agreed Price")}</span>
            <span className="text-2xl font-bold text-primary">₦{displayPrice.toLocaleString()}</span>
          </div>
        )}

        {/* Delivery proof */}
        {proofUrl && isCompleted && (
          <div className="rounded-2xl overflow-hidden border border-border">
            <div className="flex items-center gap-2 px-3.5 py-3 border-b border-border">
              <ImagePlus className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs font-bold text-muted-foreground">Proof of Delivery</p>
              <div className="ml-auto flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                <Lock className="h-3 w-3" /> Locked
              </div>
            </div>
            <img src={proofUrl} alt="Delivery proof" className="w-full object-cover max-h-48" />
          </div>
        )}

        {/* Payment proof on completed (for customer record) */}
        {paymentProofUrl && isCompleted && (
          <div className="rounded-2xl overflow-hidden border border-border">
            <div className="flex items-center gap-2 px-3.5 py-3 border-b border-border">
              <Banknote className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs font-bold text-muted-foreground">Payment Proof</p>
            </div>
            <img src={paymentProofUrl} alt="Payment proof" className="w-full object-cover max-h-36" />
          </div>
        )}

        {/* Signature */}
        {(request as any).customerSignatureUrl && isCompleted && (
          <div className="rounded-2xl overflow-hidden border border-emerald-200 bg-emerald-50/40">
            <div className="flex items-center gap-2 px-3.5 py-3 border-b border-emerald-200">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <p className="text-xs font-bold text-emerald-800">Customer Signature</p>
            </div>
            <div className="p-3 bg-white">
              <img src={(request as any).customerSignatureUrl} alt="Signature" className="w-full object-contain max-h-20" />
            </div>
          </div>
        )}

        {/* Customer status banners */}
        {userRole === "customer" && !isSelfDriver && request.status === "pending" && !companyInfo && (
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <Clock className="h-5 w-5 text-amber-600 flex-shrink-0" />
            <p className="text-sm text-amber-800">Your request is open to companies. One will accept and contact you shortly.</p>
          </div>
        )}
        {userRole === "customer" && request.status === "customer_confirmed" && (
          <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-2xl p-4">
            <Truck className="h-5 w-5 text-blue-600 flex-shrink-0" />
            <p className="text-sm text-blue-800">Payment confirmed! Assigning a driver now.</p>
          </div>
        )}
        {userRole === "customer" && request.status === "arrived" && (
          <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
            <Navigation className="h-5 w-5 text-emerald-600 flex-shrink-0" />
            <p className="text-sm text-emerald-800">Your driver has arrived at the pickup location!</p>
          </div>
        )}
        {userRole === "customer" && isCompleted && (
          <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
            <CheckCircle className="h-5 w-5 text-emerald-600 flex-shrink-0" />
            <div>
              <p className="font-bold text-sm text-emerald-900">Delivery completed! 🎉</p>
              {(request as any).customerConfirmedDelivery && <p className="text-xs text-emerald-700 mt-0.5">Receipt confirmed.</p>}
            </div>
          </div>
        )}

        {/* ── Cancelled delivery state ── */}
        {request.status === "cancelled" && (
          <div className="rounded-2xl border-2 border-red-200 bg-red-50/50 overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-4">
              <div className="h-10 w-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="font-bold text-sm text-red-900">Delivery Cancelled</p>
                <p className="text-xs text-red-700 mt-0.5">
                  {cancelledBy === "driver" && userRole === "customer"
                    ? "Your driver cancelled this delivery."
                    : cancelledBy === "customer" && userRole === "driver"
                    ? "The customer cancelled this delivery."
                    : cancelledBy === "driver" && userRole === "driver"
                    ? "You cancelled this delivery."
                    : cancelledBy === "customer" && userRole === "customer"
                    ? "You cancelled this delivery."
                    : "This delivery was cancelled."}
                </p>
              </div>
            </div>
            {cancelledBy === "driver" && userRole === "customer" && onFindDriverAgain && (
              <div className="px-4 pb-4">
                <button
                  onClick={() => onFindDriverAgain({
                    pickup: request.pickup,
                    dropoff: request.dropoff,
                    transportType: request.transportType,
                    driverType: (request as any).driverType ?? "self_driver",
                    itemDescription: (request as any).itemDescription,
                    itemSize: (request as any).itemSize,
                    itemWeight: (request as any).itemWeight,
                    packagePhotoUrl: (request as any).packagePhotoUrl ?? null,
                  })}
                  className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 rounded-xl font-bold text-sm transition-all active:scale-[0.98] hover:bg-primary/90"
                >
                  <RefreshCw className="h-4 w-4" />
                  Find Another Driver
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Cancel Delivery button ── */}
        {canCancel && (
          <button
            onClick={() => setShowCancelConfirm(true)}
            className="w-full flex items-center justify-center gap-2 border border-red-200 bg-red-50/50 hover:bg-red-50 text-red-600 py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-[0.98]"
          >
            <X className="h-4 w-4" />
            Cancel Delivery
          </button>
        )}

        {/* Driver card + Chat */}
        {driverProfile?.driverId && (
          <div className="bg-muted/40 rounded-2xl overflow-hidden border border-border/50">
            <button onClick={() => setShowDriverProfile(true)}
              className="w-full flex items-center gap-3.5 p-4 hover:bg-muted/60 transition-colors text-left group">
              <div className="h-12 w-12 bg-muted rounded-2xl flex items-center justify-center flex-shrink-0 overflow-hidden ring-2 ring-primary/10">
                {driverPhoto ? <img src={driverPhoto} className="h-full w-full object-cover" alt={driverName} /> : <User className="h-6 w-6 text-muted-foreground" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate">{driverName}</p>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5 flex-wrap">
                  <Star className="h-3 w-3 text-amber-400 fill-amber-400 flex-shrink-0" />
                  <span>{driverProfile.driver?.averageRating?.toFixed(1) ?? "5.0"}</span>
                  {driverProfile.vehicle && (<><span className="text-border">·</span><Car className="h-3 w-3 flex-shrink-0" /><span className="capitalize truncate">{[driverProfile.vehicle.color, driverProfile.vehicle.vehicleType].filter(Boolean).join(" ")}</span></>)}
                </div>
                {driverProfile.vehicle && <p className="text-xs font-mono text-muted-foreground mt-0.5">{driverProfile.vehicle.plateNumber}</p>}
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary flex-shrink-0" />
            </button>

            <div className="flex gap-2 px-4 pb-4 pt-0">
              {driverProfile?.user?.phone && (
                <a href={`tel:${driverProfile.user.phone}`}
                  className="flex-1 flex items-center justify-center gap-2 border border-border bg-card hover:bg-muted text-foreground px-4 py-2.5 rounded-xl font-semibold text-sm transition-all">
                  <Phone className="h-4 w-4" />Call
                </a>
              )}
              {chatEnabled ? (
                <button onClick={() => setShowChat(v => !v)}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all relative ${showChat ? "bg-primary text-white" : "border border-border bg-card hover:bg-muted text-foreground"}`}>
                  <MessageCircle className="h-4 w-4" />Chat
                  {chatUnread > 0 && !showChat && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1">
                      {chatUnread > 9 ? "9+" : chatUnread}
                    </span>
                  )}
                  <ChevronDown className={`h-3 w-3 transition-transform ${showChat ? "rotate-180" : ""}`} />
                </button>
              ) : (
                <div className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-border/50 text-muted-foreground/50 cursor-not-allowed bg-muted/20">
                  <MessageCircle className="h-4 w-4" />Chat
                  <span className="text-[9px] font-bold bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full ml-0.5">Unlocks on accept</span>
                </div>
              )}
            </div>

            {showChat && chatEnabled && (
              <div className="border-t border-border/50">
                <div className="h-[420px]">
                  <ChatPanel
                    requestId={requestId} currentUserId={currentUserId} otherUserId={otherUserId}
                    otherUserName={userRole === "customer" ? driverName : (request?.customerId ?? "Customer")}
                    otherUserPhoto={userRole === "customer" ? driverPhoto : null}
                    otherUserRole={userRole === "customer" ? "Driver" : "Customer"}
                    onClose={() => setShowChat(false)}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>

    {/* ── Cancel confirmation dialog ───────────────────────────────────────────── */}
    {showCancelConfirm && (
      <div className="fixed inset-0 z-[300] flex items-end justify-center bg-black/40 backdrop-blur-[2px] p-4">
        <div className="bg-card rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="font-bold text-sm">Cancel Delivery?</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {userRole === "customer"
                  ? "The driver will be notified of your cancellation."
                  : "The customer will be notified of your cancellation."}
              </p>
            </div>
          </div>

          {/* Fix #7: warn repeat cancellers */}
          {cancelCount >= 2 && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
              <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 font-medium">
                You've cancelled {cancelCount} {cancelCount === 1 ? "delivery" : "deliveries"} before.
                Frequent cancellations may affect your account standing.
              </p>
            </div>
          )}

          {/* Fix #8: reason picker */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground">Reason (optional)</p>
            <div className="flex flex-wrap gap-1.5">
              {(userRole === "customer"
                ? ["Driver took too long", "Changed my mind", "Incorrect details", "Found another option"]
                : ["Customer unreachable", "Safety concern", "Emergency", "Other"]
              ).map((r) => (
                <button
                  key={r}
                  onClick={() => setCancelReason(prev => prev === r ? "" : r)}
                  className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-all ${
                    cancelReason === r
                      ? "bg-red-600 text-white border-red-600"
                      : "bg-muted/40 border-border text-muted-foreground hover:border-red-300 hover:text-red-700"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => { setShowCancelConfirm(false); setCancelReason(""); }}
              disabled={cancelLoading}
              className="flex-1 py-2.5 rounded-xl border border-border font-semibold text-sm bg-muted/30 hover:bg-muted transition-all disabled:opacity-50"
            >
              Keep Delivery
            </button>
            <button
              onClick={userRole === "customer" ? handleCustomerCancel : handleDriverCancel}
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

    {/* ── Inline live tracking overlay ────────────────────────────────────────── */}
    {showLiveTracking && (
      <div className="fixed inset-0 z-[200] flex flex-col bg-background">

        {/* Header */}
        <div
          className="flex-shrink-0 flex items-center gap-2 px-4 pb-3 bg-card border-b border-border"
          style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top, 0px))" }}
        >
          <button
            onClick={() => setShowLiveTracking(false)}
            aria-label="Back to delivery tracking"
            className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted active:scale-95 transition-all flex-shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Truck className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm text-foreground leading-tight">Pilnak Live Tracking</p>
            <p className="text-[11px] text-muted-foreground leading-tight">
              Delivery #{requestId.slice(0, 8).toUpperCase()}
            </p>
          </div>
          <div className="flex-shrink-0">
            {isCompleted ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full">
                <CheckCircle className="h-3 w-3" />Delivered
              </span>
            ) : ["in_progress", "arrived", "awaiting_signature"].includes(request.status) ? (
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

        {/* Map */}
        <div className="flex-1 min-h-0 relative isolate overflow-hidden">
          <MapView
            className="w-full h-full"
            markers={mapMarkers}
            showUserLocation={false}
            userLatitude={driverLoc?.lat ?? request.pickup?.lat}
            userLongitude={driverLoc?.lng ?? request.pickup?.lng}
            routeFrom={driverLoc && !isCompleted ? [driverLoc.lat, driverLoc.lng] : undefined}
            routeTo={request.dropoff?.lat && request.dropoff?.lng ? [request.dropoff.lat, request.dropoff.lng] : undefined}
            hideExternalLink
          />
          {driverLoc && !isCompleted && (
            <div className="absolute bottom-3 left-3 z-[1000] bg-black/60 text-white text-[10px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5 backdrop-blur-sm pointer-events-none">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Driver live
            </div>
          )}
          {isCompleted && (
            <div className="absolute bottom-3 left-3 z-[1000] bg-black/60 text-white text-[10px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5 backdrop-blur-sm pointer-events-none">
              <CheckCircle className="h-3 w-3 text-emerald-400" />Delivered
            </div>
          )}
        </div>

        {/* Bottom info card */}
        <div
          className="flex-shrink-0 bg-card border-t border-border"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          <div className="px-4 pt-4 pb-4 space-y-3 max-w-lg mx-auto">

            {/* Driver row + ETA */}
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center overflow-hidden relative flex-shrink-0">
                <span className="text-sm font-bold text-primary">{liveInitials}</span>
                {driverPhoto && (
                  <img
                    src={driverPhoto}
                    alt={driverName}
                    className="absolute inset-0 w-full h-full object-cover"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                  />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-foreground truncate">{driverName}</p>
                <p className="text-xs text-muted-foreground truncate capitalize">
                  {liveVehicleLabel ?? "Driver"}
                  {livePlateNumber ? ` · ${livePlateNumber}` : ""}
                </p>
              </div>
              {isCompleted ? (
                <div className="flex items-center gap-1.5 text-emerald-600 flex-shrink-0">
                  <CheckCircle className="h-5 w-5" />
                  <span className="text-sm font-bold">Done</span>
                </div>
              ) : liveEtaMinutes !== null ? (
                <div className="text-right flex-shrink-0">
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide leading-tight">ETA</p>
                  <p className="font-bold text-xl text-primary leading-tight">{liveEtaMinutes} min</p>
                </div>
              ) : null}
            </div>

            <div className="h-px bg-border" />

            {/* Addresses */}
            <div className="space-y-2">
              <div className="flex items-start gap-2.5">
                <div className="w-2 h-2 rounded-full bg-primary mt-[5px] flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide leading-tight">Pickup</p>
                  <p className="text-xs text-foreground leading-snug">{request.pickup?.address ?? "—"}</p>
                </div>
              </div>
              <div className="ml-[3px] w-px h-3 bg-border" />
              <div className="flex items-start gap-2.5">
                <div className="w-2 h-2 rounded-full bg-destructive mt-[5px] flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide leading-tight">Drop-off</p>
                  <p className="text-xs text-foreground leading-snug">{request.dropoff?.address ?? "—"}</p>
                </div>
              </div>
            </div>

            <p className="text-center text-[10px] text-muted-foreground/40 pt-1">
              Powered by Pilnak · Real-time delivery tracking
            </p>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
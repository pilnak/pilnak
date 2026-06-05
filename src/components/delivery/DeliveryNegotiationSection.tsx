import { useEffect, useRef, useState } from "react";
import { Clock, Building2, CheckCircle2, XCircle, ArrowLeftRight, ChevronDown, ChevronUp, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { onSnapshot, doc } from "firebase/firestore";
import { db } from "@/integrations/firebase/client";
import {
  listenQuotesForRequest,
  customerAcceptQuote,
  customerCounterQuote,
  customerDeclineQuote,
  cancelDeliveryRequestWithQuotes,
  extendDeliveryQuoteExpiry,
  type DeliveryQuoteDoc,
  type DeliveryRequestDoc,
} from "@/services/firebase";
import { toast } from "sonner";

interface Props {
  requestId: string;
  onAccepted: (requestId: string) => void;
  onCancelled: () => void;
}

const EXTENSION_OPTIONS: Array<{ label: string; value: 5 | 15 | 30 }> = [
  { label: "5 min", value: 5 },
  { label: "15 min", value: 15 },
  { label: "30 min", value: 30 },
];

type QuoteAction = { quoteId: string; type: "accept" | "decline" | "counter" };

export function DeliveryNegotiationSection({ requestId, onAccepted, onCancelled }: Props) {
  const [quotes, setQuotes] = useState<Array<DeliveryQuoteDoc & { id: string }>>([]);
  const [expiresAtMs, setExpiresAtMs] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [expired, setExpired] = useState(false);
  const [showExtendDialog, setShowExtendDialog] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [expandedHistory, setExpandedHistory] = useState<Record<string, boolean>>({});
  const [pendingAction, setPendingAction] = useState<QuoteAction | null>(null);
  const [counterPrice, setCounterPrice] = useState("");
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [extending, setExtending] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Listen to delivery_request for quoteExpiresAt and status changes
  useEffect(() => {
    return onSnapshot(doc(db, "delivery_requests", requestId), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data() as DeliveryRequestDoc & { quoteExpiresAt?: any };
      const expiry = data.quoteExpiresAt;
      if (expiry?.toMillis) setExpiresAtMs(expiry.toMillis());
      // If a quote was accepted and request moved to payment_pending, call onAccepted
      if (data.status === "payment_pending" || data.status === "customer_confirmed") {
        onAccepted(requestId);
      }
      if (data.status === "cancelled") onCancelled();
    });
  }, [requestId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Listen to quotes
  useEffect(() => {
    return listenQuotesForRequest(requestId, setQuotes);
  }, [requestId]);

  // Countdown timer
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!expiresAtMs) return;

    const tick = () => {
      const remaining = Math.max(0, Math.floor((expiresAtMs - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining === 0) {
        clearInterval(timerRef.current!);
        setExpired(true);
        setShowExtendDialog(true);
      }
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [expiresAtMs]);

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const setLoad = (key: string, val: boolean) =>
    setLoading((p) => ({ ...p, [key]: val }));

  const handleAccept = async (quoteId: string) => {
    setLoad(quoteId, true);
    try {
      await customerAcceptQuote(requestId, quoteId);
      toast.success("Quote accepted! Proceeding to payment.");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not accept quote");
    } finally {
      setLoad(quoteId, false);
    }
  };

  const handleDecline = async (quoteId: string) => {
    setLoad(`decline-${quoteId}`, true);
    try {
      await customerDeclineQuote(quoteId);
      toast.info("Quote declined.");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not decline quote");
    } finally {
      setLoad(`decline-${quoteId}`, false);
    }
  };

  const openCounter = (quoteId: string) => {
    setCounterPrice("");
    setPendingAction({ quoteId, type: "counter" });
  };

  const handleSendCounter = async () => {
    if (!pendingAction) return;
    const price = Number(counterPrice);
    if (!price || price <= 0) { toast.error("Enter a valid amount"); return; }
    setLoad(`counter-${pendingAction.quoteId}`, true);
    try {
      await customerCounterQuote(pendingAction.quoteId, price);
      toast.success("Counter offer sent!");
      setPendingAction(null);
      setCounterPrice("");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not send counter offer");
    } finally {
      setLoad(`counter-${pendingAction.quoteId}`, false);
    }
  };

  const handleExtend = async (mins: 5 | 15 | 30) => {
    setExtending(true);
    try {
      await extendDeliveryQuoteExpiry(requestId, mins);
      setExpired(false);
      setShowExtendDialog(false);
      toast.success(`Request extended by ${mins} minutes.`);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not extend request");
    } finally {
      setExtending(false);
    }
  };

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await cancelDeliveryRequestWithQuotes(requestId);
      toast.info("Delivery request cancelled.");
      onCancelled();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not cancel request");
    } finally {
      setCancelling(false);
    }
  };

  const activeQuotes = quotes.filter((q) =>
    ["pending", "customer_countered", "company_countered"].includes(q.status)
  );
  const resolvedQuotes = quotes.filter((q) =>
    ["accepted", "declined"].includes(q.status)
  );

  const timerColor =
    timeLeft > 300 ? "text-emerald-600" : timeLeft > 60 ? "text-amber-500" : "text-red-500";
  const timerBg =
    timeLeft > 300 ? "bg-emerald-50 border-emerald-200" : timeLeft > 60 ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200";

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header + timer */}
      <div className={`flex items-center justify-between rounded-2xl border px-4 py-3 ${timerBg}`}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-white/70 flex items-center justify-center">
            <Clock className={`w-4 h-4 ${timerColor}`} />
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Request open for
            </p>
            <p className={`text-xl font-bold tabular-nums ${timerColor}`}>
              {expired ? "Expired" : fmt(timeLeft)}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowCancelConfirm(true)}
          className="text-xs font-semibold text-red-600 border border-red-200 rounded-xl px-3 py-1.5 hover:bg-red-50 transition-colors"
        >
          Cancel Request
        </button>
      </div>

      {/* Waiting empty state */}
      {quotes.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <Building2 className="w-7 h-7 text-primary animate-pulse" />
          </div>
          <p className="font-semibold text-base">Broadcasting to companies…</p>
          <p className="text-sm text-muted-foreground max-w-xs">
            Nearby companies are reviewing your request. Quotes will appear here in real time.
          </p>
          <div className="flex items-center gap-1.5 mt-1">
            {[0, 120, 240].map((delay) => (
              <div
                key={delay}
                className="w-2 h-2 rounded-full bg-primary animate-pulse"
                style={{ animationDelay: `${delay}ms` }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Active quotes */}
      {activeQuotes.length > 0 && (
        <section className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Quotes received · {activeQuotes.length}
          </p>
          <div className="space-y-3">
            {activeQuotes.map((q) => (
              <QuoteCard
                key={q.id}
                quote={q}
                expanded={!!expandedHistory[q.id]}
                onToggleHistory={() =>
                  setExpandedHistory((p) => ({ ...p, [q.id]: !p[q.id] }))
                }
                onAccept={() => handleAccept(q.id)}
                onDecline={() => handleDecline(q.id)}
                onCounter={() => openCounter(q.id)}
                loadingAccept={!!loading[q.id]}
                loadingDecline={!!loading[`decline-${q.id}`]}
              />
            ))}
          </div>
        </section>
      )}

      {/* Resolved quotes */}
      {resolvedQuotes.length > 0 && (
        <section className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Previous quotes
          </p>
          {resolvedQuotes.map((q) => (
            <div
              key={q.id}
              className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-4 py-3"
            >
              <div className="flex items-center gap-2.5">
                <CompanyAvatar name={q.companyName} size="sm" />
                <div>
                  <p className="text-sm font-semibold">{q.companyName || "Company"}</p>
                  <p className="text-xs text-muted-foreground">
                    ₦{q.currentPrice.toLocaleString()}
                  </p>
                </div>
              </div>
              {q.status === "accepted" ? (
                <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Accepted
                </span>
              ) : (
                <span className="text-xs font-semibold text-muted-foreground bg-muted border border-border px-2.5 py-1 rounded-full">
                  Declined
                </span>
              )}
            </div>
          ))}
        </section>
      )}

      {/* Counter-offer dialog */}
      {pendingAction?.type === "counter" && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-5 space-y-4 animate-fade-in">
            <div>
              <p className="font-bold text-base">Send Counter Offer</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                Enter your preferred price
              </p>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
                ₦
              </span>
              <Input
                type="number"
                placeholder="0.00"
                value={counterPrice}
                onChange={(e) => setCounterPrice(e.target.value)}
                className="pl-7 h-12 rounded-xl text-base"
                autoFocus
              />
            </div>
            <div className="flex gap-2.5">
              <Button
                variant="outline"
                className="flex-1 rounded-xl h-11"
                onClick={() => { setPendingAction(null); setCounterPrice(""); }}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 rounded-xl h-11"
                onClick={handleSendCounter}
                disabled={loading[`counter-${pendingAction.quoteId}`]}
              >
                {loading[`counter-${pendingAction.quoteId}`] ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Send Counter"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Expiry / extend dialog */}
      {showExtendDialog && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-5 space-y-4 animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="font-bold">Time's up!</p>
                <p className="text-sm text-muted-foreground">
                  Extend to keep receiving quotes, or cancel the request.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {EXTENSION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleExtend(opt.value)}
                  disabled={extending}
                  className="h-11 rounded-xl border border-border font-semibold text-sm hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
                >
                  +{opt.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => { setShowExtendDialog(false); setShowCancelConfirm(true); }}
              className="w-full text-sm font-semibold text-red-600 hover:underline"
            >
              Cancel request instead
            </button>
          </div>
        </div>
      )}

      {/* Cancel confirmation */}
      {showCancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-5 space-y-4 animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <XCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="font-bold">Cancel delivery request?</p>
                <p className="text-sm text-muted-foreground">
                  All pending quotes will be declined and companies notified.
                </p>
              </div>
            </div>
            <div className="flex gap-2.5">
              <Button
                variant="outline"
                className="flex-1 rounded-xl h-11"
                onClick={() => setShowCancelConfirm(false)}
              >
                Keep request
              </Button>
              <Button
                variant="destructive"
                className="flex-1 rounded-xl h-11"
                onClick={handleCancel}
                disabled={cancelling}
              >
                {cancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : "Yes, cancel"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function CompanyAvatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  const sz = size === "sm" ? "w-8 h-8 text-xs" : "w-10 h-10 text-sm";
  return (
    <div className={`${sz} rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary flex-shrink-0`}>
      {initials || <Building2 className="w-4 h-4" />}
    </div>
  );
}

interface QuoteCardProps {
  quote: DeliveryQuoteDoc & { id: string };
  expanded: boolean;
  onToggleHistory: () => void;
  onAccept: () => void;
  onDecline: () => void;
  onCounter: () => void;
  loadingAccept: boolean;
  loadingDecline: boolean;
}

function QuoteCard({
  quote,
  expanded,
  onToggleHistory,
  onAccept,
  onDecline,
  onCounter,
  loadingAccept,
  loadingDecline,
}: QuoteCardProps) {
  const isWaiting = quote.status === "customer_countered";
  const history = quote.negotiationHistory ?? [];
  const hasHistory = history.length > 1;

  return (
    <div className="rounded-2xl border border-border bg-white shadow-sm overflow-hidden">
      {/* Company header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <CompanyAvatar name={quote.companyName} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate">{quote.companyName || "Company"}</p>
          {quote.companyInfo?.phone && (
            <p className="text-xs text-muted-foreground">{quote.companyInfo.phone}</p>
          )}
        </div>
        {isWaiting ? (
          <span className="flex items-center gap-1 text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full whitespace-nowrap">
            <Loader2 className="w-3 h-3 animate-spin" />
            Awaiting reply
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs font-semibold text-primary bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-full whitespace-nowrap">
            <ArrowLeftRight className="w-3 h-3" />
            Negotiating
          </span>
        )}
      </div>

      {/* Price */}
      <div className="px-4 pb-3">
        <p className="text-3xl font-bold tabular-nums">
          ₦{quote.currentPrice.toLocaleString()}
        </p>
        {history.length > 0 && (
          <p className="text-xs text-muted-foreground mt-0.5">
            {history[history.length - 1].by === "company"
              ? "Company's latest offer"
              : "Your counter offer · waiting for company"}
          </p>
        )}
      </div>

      {/* Negotiation history toggle */}
      {hasHistory && (
        <button
          onClick={onToggleHistory}
          className="w-full flex items-center justify-between px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted/40 border-t border-border transition-colors"
        >
          <span>Negotiation history ({history.length} rounds)</span>
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      )}

      {/* History */}
      {expanded && hasHistory && (
        <div className="px-4 py-3 space-y-2 border-t border-border bg-muted/20">
          {history.map((entry, i) => (
            <div key={i} className={`flex items-center gap-2 ${entry.by === "customer" ? "flex-row-reverse" : ""}`}>
              <div className={`text-xs font-semibold px-3 py-1.5 rounded-full ${
                entry.by === "company"
                  ? "bg-primary/10 text-primary"
                  : "bg-emerald-100 text-emerald-700"
              }`}>
                {entry.by === "company" ? "Company" : "You"}: ₦{entry.price.toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      {!isWaiting && (
        <div className="flex gap-2 px-4 pb-4 pt-3 border-t border-border">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 rounded-xl h-10 border-red-200 text-red-600 hover:bg-red-50"
            onClick={onDecline}
            disabled={loadingDecline}
          >
            {loadingDecline ? <Loader2 className="w-4 h-4 animate-spin" /> : "Decline"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 rounded-xl h-10"
            onClick={onCounter}
          >
            Counter
          </Button>
          <Button
            size="sm"
            className="flex-1 rounded-xl h-10"
            onClick={onAccept}
            disabled={loadingAccept}
          >
            {loadingAccept ? <Loader2 className="w-4 h-4 animate-spin" /> : "Accept"}
          </Button>
        </div>
      )}

      {isWaiting && (
        <div className="px-4 pb-4 pt-2">
          <p className="text-xs text-center text-muted-foreground italic">
            Waiting for the company to respond to your counter offer…
          </p>
        </div>
      )}
    </div>
  );
}

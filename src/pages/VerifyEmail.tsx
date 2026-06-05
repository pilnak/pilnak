import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { sendEmailVerification, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/integrations/firebase/client";
import { Logo } from "@/components/Logo";
import { MailCheck, RefreshCw, LogOut, CheckCircle, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";

const RESEND_COOLDOWN_S = 60;
const POLL_INTERVAL_MS = 3000;

async function getPostVerificationRedirect(uid: string): Promise<string> {
  try {
    const userSnap = await getDoc(doc(db, "users", uid));
    if (!userSnap.exists()) return "/auth";
    const data = userSnap.data() as { role?: string; driverType?: string };

    if (data.role === "customer") return "/customer";
    if (data.role === "admin") return "/admin";
    if (data.role === "company") return "/company-pending";
    if (data.role === "driver") {
      if (data.driverType === "company") return "/driver";
      // Self driver: check whether they've completed registration (selfie = done)
      const driverSnap = await getDoc(doc(db, "drivers", uid));
      if (driverSnap.exists() && driverSnap.data()?.selfieUrl) return "/driver-pending";
      return "/driver-registration";
    }
    return "/customer";
  } catch {
    return "/auth";
  }
}

export default function VerifyEmail() {
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);
  const [checking, setChecking] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentUser = auth.currentUser;
  const email = currentUser?.email ?? "";

  async function redirectAfterVerification() {
    const u = auth.currentUser;
    if (!u) { navigate("/auth", { replace: true }); return; }
    const path = await getPostVerificationRedirect(u.uid);
    navigate(path, { replace: true });
  }

  useEffect(() => {
    setMounted(true);

    if (!auth.currentUser) {
      navigate("/auth", { replace: true });
      return;
    }

    // Already verified — no need to wait
    if (auth.currentUser.emailVerified) {
      redirectAfterVerification();
      return;
    }

    pollRef.current = setInterval(async () => {
      try {
        const u = auth.currentUser;
        if (!u) return;
        await u.reload();
        if (auth.currentUser?.emailVerified) {
          clearInterval(pollRef.current!);
          redirectAfterVerification();
        }
      } catch {
        // Network hiccup — retry next interval
      }
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleManualCheck() {
    const u = auth.currentUser;
    if (!u) { navigate("/auth", { replace: true }); return; }
    setChecking(true);
    try {
      await u.reload();
      if (auth.currentUser?.emailVerified) {
        if (pollRef.current) clearInterval(pollRef.current);
        redirectAfterVerification();
      } else {
        toast.error("Email not verified yet — please click the link in your inbox.");
      }
    } catch {
      toast.error("Could not reach the server. Please try again.");
    } finally {
      setChecking(false);
    }
  }

  async function handleResend() {
    if (resendCooldown > 0) return;
    const u = auth.currentUser;
    if (!u) return;
    try {
      await sendEmailVerification(u);
      toast.success("Verification email sent — check your inbox (and spam folder).");
      setResendCooldown(RESEND_COOLDOWN_S);
      cooldownRef.current = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) { clearInterval(cooldownRef.current!); return 0; }
          return prev - 1;
        });
      }, 1000);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === "auth/too-many-requests") {
        toast.error("Too many requests — wait a moment before resending.");
      } else {
        toast.error("Failed to send email. Please try again.");
      }
    }
  }

  async function handleLogout() {
    if (pollRef.current) clearInterval(pollRef.current);
    await signOut(auth);
    navigate("/auth", { replace: true });
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=Syne:wght@600;700;800&display=swap');

        .ve-root {
          font-family: 'DM Sans', sans-serif;
          min-height: 100dvh;
          background: linear-gradient(150deg, #f5fdf8 0%, #eaf7f0 60%, #f0faf4 100%);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: max(env(safe-area-inset-top, 16px), 16px) max(env(safe-area-inset-right, 16px), 16px) max(env(safe-area-inset-bottom, 16px), 16px) max(env(safe-area-inset-left, 16px), 16px);
          position: relative;
          overflow: hidden;
        }

        .ve-root::before {
          content: '';
          position: fixed;
          inset: 0;
          background:
            radial-gradient(ellipse 60% 50% at 20% 10%, rgba(0,179,71,.08) 0%, transparent 60%),
            radial-gradient(ellipse 50% 40% at 80% 90%, rgba(0,179,71,.06) 0%, transparent 60%);
          pointer-events: none;
          z-index: 0;
        }

        .ve-noise {
          position: fixed;
          inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E");
          pointer-events: none;
          z-index: 0;
          opacity: 0.4;
        }

        .ve-logo-wrap {
          text-align: center;
          margin-bottom: 28px;
          position: relative;
          z-index: 1;
          opacity: 0;
          transform: translateY(-12px);
          transition: opacity 0.4s ease 0.1s, transform 0.4s ease 0.1s;
        }
        .ve-logo-wrap.visible { opacity: 1; transform: translateY(0); }

        .ve-card-wrap {
          width: 100%;
          max-width: 420px;
          position: relative;
          z-index: 1;
          opacity: 0;
          transform: translateY(24px);
          transition: opacity 0.55s cubic-bezier(0.22, 1, 0.36, 1), transform 0.55s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .ve-card-wrap.visible { opacity: 1; transform: translateY(0); }

        .ve-glass-card {
          background: rgba(255, 255, 255, 0.8);
          backdrop-filter: blur(28px) saturate(1.8);
          -webkit-backdrop-filter: blur(28px) saturate(1.8);
          border-radius: 28px;
          border: 1px solid rgba(255, 255, 255, 0.95);
          box-shadow:
            0 4px 6px -1px rgba(0, 100, 40, 0.04),
            0 12px 40px -8px rgba(0, 100, 40, 0.1),
            0 0 0 1px rgba(255,255,255,0.7) inset;
          overflow: hidden;
        }

        .ve-header {
          padding: 36px 28px 28px;
          position: relative;
          overflow: hidden;
          text-align: center;
        }

        .ve-orb {
          position: absolute;
          border-radius: 50%;
          pointer-events: none;
        }

        .ve-icon-ring {
          width: 80px;
          height: 80px;
          border-radius: 22px;
          background: rgba(0,179,71,0.1);
          border: 1px solid rgba(0,179,71,0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 20px;
          position: relative;
          backdrop-filter: blur(8px);
          box-shadow: 0 8px 32px rgba(0,0,0,0.07), 0 0 0 1px rgba(255,255,255,0.6) inset;
          transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .ve-icon-ring:hover { transform: scale(1.05) rotate(-2deg); }
        .ve-icon-ring::after {
          content: '';
          position: absolute;
          inset: -6px;
          border-radius: 28px;
          border: 2px solid #00B347;
          opacity: 0.15;
          animation: ve-pulse 2.5s ease-in-out infinite;
        }
        @keyframes ve-pulse {
          0%, 100% { transform: scale(1); opacity: 0.15; }
          50% { transform: scale(1.08); opacity: 0.06; }
        }

        .ve-title {
          font-family: 'Syne', sans-serif;
          font-size: clamp(20px, 5vw, 24px);
          font-weight: 700;
          color: #0a2e17;
          margin: 0 0 6px;
        }

        .ve-subtitle {
          font-size: 14px;
          color: #4a8060;
          margin: 0;
          line-height: 1.5;
        }

        .ve-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 12px;
          border-radius: 100px;
          font-size: 13px;
          font-weight: 600;
          border: 1px solid rgba(0,179,71,0.25);
          background: rgba(0,179,71,0.1);
          color: #007A30;
          margin-top: 10px;
        }
        .ve-badge-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: currentColor;
          animation: ve-blink 1.4s ease-in-out infinite;
        }
        @keyframes ve-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.2; } }

        .ve-divider { height: 1px; background: linear-gradient(90deg, transparent, rgba(0,100,40,0.1), transparent); margin: 0 -4px; }

        .ve-body { padding: 24px 28px 28px; display: flex; flex-direction: column; gap: 16px; }

        .ve-email-row {
          display: flex;
          align-items: center;
          gap: 14px;
          background: rgba(240, 250, 244, 0.95);
          border-radius: 18px;
          padding: 14px 16px;
          border: 1px solid rgba(0,179,71,0.1);
        }

        .ve-email-icon {
          width: 44px; height: 44px; border-radius: 12px;
          background: linear-gradient(135deg, rgba(0,179,71,0.14), rgba(0,179,71,0.06));
          border: 1px solid rgba(0,179,71,0.15);
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }

        .ve-email-label { font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #6b9e7a; margin-bottom: 2px; }
        .ve-email-addr { font-family: 'Syne', sans-serif; font-size: 14px; font-weight: 700; color: #0a2e17; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        .ve-steps-row { display: flex; align-items: flex-start; gap: 0; }
        .ve-step { flex: 1; display: flex; flex-direction: column; align-items: center; position: relative; }
        .ve-step:not(:last-child)::after {
          content: ''; position: absolute; top: 16px;
          left: calc(50% + 16px); right: calc(-50% + 16px);
          height: 1.5px;
        }
        .ve-step.done:not(:last-child)::after { background: linear-gradient(90deg, #00B347, #4dd882); }
        .ve-step.pending-step:not(:last-child)::after { background: #d1ead9; }

        .ve-step-circle {
          width: 34px; height: 34px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 13px; font-weight: 700; margin-bottom: 8px;
          position: relative; z-index: 1;
        }
        .ve-step-circle.done { background: linear-gradient(135deg, #00B347, #00d45a); color: white; box-shadow: 0 4px 12px rgba(0,179,71,0.3); }
        .ve-step-circle.pending-step { background: #f0faf4; color: #6b9e7a; border: 1.5px dashed #b2d9bf; }
        .ve-step-label { font-size: 11px; font-weight: 500; color: #6b9e7a; text-align: center; line-height: 1.3; }

        .ve-info-box {
          border-radius: 18px; padding: 14px 16px;
          background: rgba(0,179,71,0.05);
          border: 1px solid rgba(0,179,71,0.16);
          font-size: 13px; color: #1a8c4a; line-height: 1.5;
        }

        .ve-btn-primary {
          width: 100%; height: 52px; border-radius: 16px;
          background: linear-gradient(135deg, #00B347, #00d45a);
          color: white;
          font-family: 'DM Sans', sans-serif; font-size: 15px; font-weight: 600;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          cursor: pointer; border: none;
          box-shadow: 0 4px 16px rgba(0,179,71,0.3);
          transition: all 0.2s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .ve-btn-primary:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(0,179,71,0.38); }
        .ve-btn-primary:active:not(:disabled) { transform: translateY(0); box-shadow: 0 2px 10px rgba(0,179,71,0.25); }
        .ve-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

        .ve-btn-secondary {
          width: 100%; height: 48px; border-radius: 14px;
          border: 1.5px solid rgba(0,179,71,0.22);
          background: rgba(240,250,244,0.9);
          color: #1a5c32;
          font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 600;
          display: flex; align-items: center; justify-content: center; gap: 7px;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .ve-btn-secondary:hover:not(:disabled) { background: #fff; border-color: rgba(0,179,71,0.35); box-shadow: 0 3px 12px rgba(0,179,71,0.1); transform: translateY(-1px); }
        .ve-btn-secondary:active:not(:disabled) { transform: translateY(0); }
        .ve-btn-secondary:disabled { opacity: 0.55; cursor: not-allowed; }

        .ve-btn-ghost {
          width: 100%; height: 48px; border-radius: 14px;
          border: 1.5px solid rgba(0,179,71,0.14);
          background: transparent;
          color: #6b9e7a;
          font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 500;
          display: flex; align-items: center; justify-content: center; gap: 7px;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .ve-btn-ghost:hover { color: #0a2e17; border-color: rgba(0,179,71,0.25); background: rgba(240,250,244,0.6); }

        .ve-spam-note { font-size: 12px; color: #6b9e7a; text-align: center; }

        @media (max-width: 480px) {
          .ve-header { padding: 28px 20px 22px; }
          .ve-body { padding: 20px 20px 24px; }
        }
      `}</style>

      <div className="ve-root">
        <div className="ve-noise" />

        <div className={`ve-logo-wrap ${mounted ? "visible" : ""}`}>
          <Logo size="lg" className="justify-center" />
        </div>

        <div className={`ve-card-wrap ${mounted ? "visible" : ""}`}>
          <div className="ve-glass-card">
            {/* Header */}
            <div className="ve-header">
              <div className="ve-orb" style={{ width: 180, height: 180, background: "rgba(0,179,71,.22)", filter: "blur(60px)", top: -60, right: -40 }} />
              <div className="ve-orb" style={{ width: 120, height: 120, background: "rgba(0,179,71,.18)", filter: "blur(40px)", bottom: -40, left: -20, opacity: 0.5 }} />

              <div className="ve-icon-ring">
                <MailCheck className="h-9 w-9 text-[#00B347]" />
              </div>

              <h1 className="ve-title">Verify your email</h1>
              <p className="ve-subtitle">
                We've sent a verification link to your inbox.
              </p>

              <div className="flex justify-center">
                <span className="ve-badge">
                  <span className="ve-badge-dot" />
                  Waiting for verification
                </span>
              </div>
            </div>

            <div className="ve-divider" />

            {/* Body */}
            <div className="ve-body">
              {/* Email address display */}
              <div className="ve-email-row">
                <div className="ve-email-icon">
                  <MailCheck className="h-5 w-5 text-[#00B347]" />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p className="ve-email-label">Sent to</p>
                  <p className="ve-email-addr">{email || "your email address"}</p>
                </div>
              </div>

              {/* Steps */}
              <div className="ve-steps-row">
                {[
                  { label: "Account created", done: true },
                  { label: "Email verified", done: false },
                  { label: "Access granted", done: false },
                ].map((item, i) => (
                  <div key={i} className={`ve-step ${item.done ? "done" : "pending-step"}`}>
                    <div className={`ve-step-circle ${item.done ? "done" : "pending-step"}`}>
                      {item.done ? <CheckCircle className="h-4 w-4" /> : i + 1}
                    </div>
                    <p className="ve-step-label">{item.label}</p>
                  </div>
                ))}
              </div>

              {/* Info */}
              <div className="ve-info-box">
                <Clock className="inline h-3.5 w-3.5 mr-1.5 opacity-70" style={{ verticalAlign: "text-bottom" }} />
                This page checks automatically every few seconds. Once you click the link in your email, you'll be redirected.
              </div>

              {/* Primary action */}
              <button
                className="ve-btn-primary"
                onClick={handleManualCheck}
                disabled={checking}
              >
                {checking ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4" />
                )}
                {checking ? "Checking…" : "I've verified my email"}
              </button>

              {/* Resend */}
              <button
                className="ve-btn-secondary"
                onClick={handleResend}
                disabled={resendCooldown > 0}
              >
                <RefreshCw className="h-4 w-4" />
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Re-send verification email"}
              </button>

              <p className="ve-spam-note">
                Can't find it? Check your spam or junk folder.
              </p>

              {/* Sign out */}
              <button className="ve-btn-ghost" onClick={handleLogout}>
                <LogOut className="h-4 w-4" />
                Sign out and use a different account
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

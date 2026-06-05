import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { doc, onSnapshot, getDoc } from "firebase/firestore";
import { db, auth } from "@/integrations/firebase/client";
import { Logo } from "@/components/Logo";
import { Clock, CheckCircle, XCircle, LogOut, User, Sparkles, Mail } from "lucide-react";
import { signOut } from "firebase/auth";

type DriverStatus = "pending_verification" | "approved" | "rejected";

export default function DriverPendingApproval() {
  const navigate = useNavigate();
  const [driverName, setDriverName] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<DriverStatus>("pending_verification");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const user = auth.currentUser;
    if (!user) {
      navigate("/auth?role=driver", { replace: true });
      return;
    }
    setEmail(user.email ?? "");

    getDoc(doc(db, "users", user.uid))
      .then((snap) => {
        if (snap.exists()) {
          const d = snap.data() as Record<string, string>;
          const name = [d.firstName, d.lastName].filter(Boolean).join(" ");
          setDriverName(name);
        }
      })
      .catch(() => {});

    const unsub = onSnapshot(doc(db, "drivers", user.uid), (snap) => {
      if (!snap.exists()) {
        navigate("/driver-registration", { replace: true });
        return;
      }
      const data = snap.data() as { status?: DriverStatus };
      const s: DriverStatus = data.status ?? "pending_verification";
      setStatus(s);
      if (s === "approved") {
        setTimeout(() => navigate("/driver", { replace: true }), 2000);
      }
    });

    return () => unsub();
  }, [navigate]);

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/auth", { replace: true });
  };

  const statusConfig = {
    approved: {
      orb: "rgba(0,179,71,.25)",
      iconBg: "bg-[rgba(0,179,71,0.1)] border border-[rgba(0,179,71,0.2)]",
      icon: <CheckCircle className="h-9 w-9 text-[#00B347]" />,
      label: "Account Approved!",
      badge: "bg-[rgba(0,179,71,0.1)] text-[#007A30] border-[rgba(0,179,71,0.25)]",
      badgeText: "Active",
      dotAnimate: false,
      infoType: "green" as const,
    },
    rejected: {
      orb: "rgba(220,38,38,.2)",
      iconBg: "bg-[rgba(220,38,38,0.1)] border border-[rgba(220,38,38,0.18)]",
      icon: <XCircle className="h-9 w-9 text-red-600" />,
      label: "Application Rejected",
      badge: "bg-red-50 text-red-800 border-red-200",
      badgeText: "Rejected",
      dotAnimate: false,
      infoType: "red" as const,
    },
    pending_verification: {
      orb: "rgba(0,179,71,.22)",
      iconBg: "bg-[rgba(0,179,71,0.1)] border border-[rgba(0,179,71,0.18)]",
      icon: <Clock className="h-9 w-9 text-[#00B347]" />,
      label: "Pending Approval",
      badge: "bg-[rgba(0,179,71,0.1)] text-[#007A30] border-[rgba(0,179,71,0.22)]",
      badgeText: "Under Review",
      dotAnimate: true,
      infoType: "green" as const,
    },
  };

  const cfg = statusConfig[status];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=Syne:wght@600;700;800&display=swap');

        .drv-pending-root {
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

        .drv-pending-root::before {
          content: '';
          position: fixed;
          inset: 0;
          background:
            radial-gradient(ellipse 60% 50% at 20% 10%, rgba(0,179,71,.08) 0%, transparent 60%),
            radial-gradient(ellipse 50% 40% at 80% 90%, rgba(0,179,71,.06) 0%, transparent 60%);
          pointer-events: none;
          z-index: 0;
        }

        .drv-noise {
          position: fixed;
          inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E");
          pointer-events: none;
          z-index: 0;
          opacity: 0.4;
        }

        .drv-card-wrap {
          width: 100%;
          max-width: 420px;
          position: relative;
          z-index: 1;
          opacity: 0;
          transform: translateY(24px);
          transition: opacity 0.55s cubic-bezier(0.22, 1, 0.36, 1), transform 0.55s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .drv-card-wrap.visible { opacity: 1; transform: translateY(0); }

        .drv-logo-wrap {
          text-align: center;
          margin-bottom: 28px;
          opacity: 0;
          transform: translateY(-12px);
          transition: opacity 0.4s ease 0.1s, transform 0.4s ease 0.1s;
        }
        .drv-logo-wrap.visible { opacity: 1; transform: translateY(0); }

        .drv-glass-card {
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

        .drv-status-header {
          padding: 36px 28px 28px;
          position: relative;
          overflow: hidden;
        }

        .drv-orb {
          position: absolute;
          border-radius: 50%;
          pointer-events: none;
        }

        .drv-icon-ring {
          width: 80px;
          height: 80px;
          border-radius: 22px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 20px;
          position: relative;
          backdrop-filter: blur(8px);
          box-shadow: 0 8px 32px rgba(0,0,0,0.07), 0 0 0 1px rgba(255,255,255,0.6) inset;
          transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .drv-icon-ring:hover { transform: scale(1.05) rotate(-2deg); }

        .drv-icon-ring.pulse-ring::after {
          content: '';
          position: absolute;
          inset: -6px;
          border-radius: 28px;
          border: 2px solid #00B347;
          opacity: 0.15;
          animation: drv-pulse 2.5s ease-in-out infinite;
        }

        @keyframes drv-pulse {
          0%, 100% { transform: scale(1); opacity: 0.15; }
          50% { transform: scale(1.08); opacity: 0.06; }
        }

        .drv-title {
          font-family: 'Syne', sans-serif;
          font-size: clamp(20px, 5vw, 24px);
          font-weight: 700;
          color: #0a2e17;
          margin: 0 0 6px;
          text-align: center;
        }

        .drv-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 12px;
          border-radius: 100px;
          font-size: 13px;
          font-weight: 600;
          border: 1px solid;
          margin: 0 auto;
        }

        .drv-badge-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
        .drv-badge-dot.animate { animation: drv-blink 1.4s ease-in-out infinite; }
        @keyframes drv-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.2; } }

        .drv-card-body { padding: 24px 28px 28px; display: flex; flex-direction: column; gap: 18px; }

        .drv-divider { height: 1px; background: linear-gradient(90deg, transparent, rgba(0,100,40,0.1), transparent); margin: 0 -4px; }

        .drv-driver-row {
          display: flex;
          align-items: center;
          gap: 14px;
          background: rgba(240, 250, 244, 0.95);
          border-radius: 18px;
          padding: 14px 16px;
          border: 1px solid rgba(0,179,71,0.1);
          transition: box-shadow 0.2s ease, background 0.2s ease;
        }
        .drv-driver-row:hover { background: rgba(255,255,255,0.98); box-shadow: 0 2px 14px rgba(0,179,71,0.1); }

        .drv-icon-wrap {
          width: 48px; height: 48px; border-radius: 14px;
          background: linear-gradient(135deg, rgba(0,179,71,0.14), rgba(0,179,71,0.06));
          border: 1px solid rgba(0,179,71,0.15);
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }

        .drv-label { font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #6b9e7a; margin-bottom: 2px; }
        .drv-name { font-family: 'Syne', sans-serif; font-size: 16px; font-weight: 700; color: #0a2e17; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .drv-email { font-size: 13px; color: #6b9e7a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        .drv-steps-row { display: flex; align-items: flex-start; gap: 0; position: relative; }
        .drv-step-item { flex: 1; display: flex; flex-direction: column; align-items: center; position: relative; }
        .drv-step-item:not(:last-child)::after {
          content: ''; position: absolute; top: 16px;
          left: calc(50% + 16px); right: calc(-50% + 16px);
          height: 1.5px; background: #d1ead9;
        }
        .drv-step-item.done:not(:last-child)::after { background: linear-gradient(90deg, #00B347, #4dd882); }

        .drv-step-circle {
          width: 34px; height: 34px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 13px; font-weight: 700; margin-bottom: 8px;
          position: relative; z-index: 1;
          transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease;
        }
        .drv-step-circle.done { background: linear-gradient(135deg, #00B347, #00d45a); color: white; box-shadow: 0 4px 12px rgba(0,179,71,0.3); }
        .drv-step-circle.done:hover { transform: scale(1.1); }
        .drv-step-circle.pending { background: #f0faf4; color: #6b9e7a; border: 1.5px dashed #b2d9bf; }
        .drv-step-label { font-size: 11px; font-weight: 500; color: #6b9e7a; text-align: center; line-height: 1.3; }

        .drv-info-box { border-radius: 18px; padding: 16px; display: flex; gap: 12px; border: 1px solid; }
        .drv-info-box.green { background: rgba(0,179,71,0.05); border-color: rgba(0,179,71,0.16); }
        .drv-info-box.red { background: rgba(220,38,38,0.05); border-color: rgba(220,38,38,0.14); }

        .drv-info-icon { width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .drv-info-box.green .drv-info-icon { background: rgba(0,179,71,0.1); }
        .drv-info-box.red .drv-info-icon { background: rgba(220,38,38,0.1); }

        .drv-info-title { font-size: 14px; font-weight: 600; margin-bottom: 3px; }
        .drv-info-box.green .drv-info-title { color: #007A30; }
        .drv-info-box.red .drv-info-title { color: #b91c1c; }
        .drv-info-desc { font-size: 13px; line-height: 1.5; }
        .drv-info-box.green .drv-info-desc { color: #1a8c4a; }
        .drv-info-box.red .drv-info-desc { color: #dc2626; }

        .drv-time-note { font-size: 12px; color: #6b9e7a; text-align: center; font-style: italic; }

        .drv-logout-btn {
          width: 100%; height: 52px; border-radius: 16px;
          border: 1.5px solid rgba(0,179,71,0.18);
          background: rgba(240,250,244,0.9);
          color: #1a5c32;
          font-family: 'DM Sans', sans-serif; font-size: 16px; font-weight: 600;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .drv-logout-btn:hover { background: #fff; border-color: rgba(0,179,71,0.3); box-shadow: 0 4px 16px rgba(0,179,71,0.12); transform: translateY(-1px); color: #0a2e17; }
        .drv-logout-btn:active { transform: translateY(0); box-shadow: none; }

        @media (max-width: 480px) {
          .drv-status-header { padding: 28px 20px 22px; }
          .drv-card-body { padding: 20px 20px 24px; gap: 16px; }
        }
      `}</style>

      <div className="drv-pending-root">
        <div className="drv-noise" />

        <div className={`drv-logo-wrap ${mounted ? "visible" : ""}`}>
          <Logo size="lg" className="justify-center" />
        </div>

        <div className={`drv-card-wrap ${mounted ? "visible" : ""}`}>
          <div className="drv-glass-card">
            {/* Status header */}
            <div className="drv-status-header">
              <div className="drv-orb" style={{ width: 180, height: 180, background: cfg.orb, filter: "blur(60px)", top: -60, right: -40 }} />
              <div className="drv-orb" style={{ width: 120, height: 120, background: cfg.orb, filter: "blur(40px)", bottom: -40, left: -20, opacity: 0.5 }} />

              <div className={`drv-icon-ring ${cfg.iconBg} ${status === "pending_verification" ? "pulse-ring" : ""}`}>
                {cfg.icon}
              </div>

              <h1 className="drv-title">{cfg.label}</h1>

              <div className="flex justify-center mt-2">
                <span className={`drv-badge ${cfg.badge}`}>
                  <span className={`drv-badge-dot ${cfg.dotAnimate ? "animate" : ""}`} />
                  {cfg.badgeText}
                </span>
              </div>
            </div>

            <div className="drv-divider" />

            {/* Card body */}
            <div className="drv-card-body">
              <div className="drv-driver-row">
                <div className="drv-icon-wrap">
                  <User className="h-5 w-5 text-[#00B347]" />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p className="drv-label">Driver</p>
                  <p className="drv-name">{driverName || "Loading…"}</p>
                  <p className="drv-email">{email}</p>
                </div>
              </div>

              {status === "pending_verification" && (
                <>
                  <div className="drv-steps-row">
                    {[
                      { label: "Registration submitted", done: true },
                      { label: "Admin review", done: false },
                      { label: "Account activated", done: false },
                    ].map((item, i) => (
                      <div key={i} className={`drv-step-item ${item.done ? "done" : ""}`}>
                        <div className={`drv-step-circle ${item.done ? "done" : "pending"}`}>
                          {item.done ? <CheckCircle className="h-4 w-4" /> : i + 1}
                        </div>
                        <p className="drv-step-label">{item.label}</p>
                      </div>
                    ))}
                  </div>

                  <div className="drv-info-box green">
                    <div className="drv-info-icon">
                      <Mail className="h-4 w-4 text-[#00B347]" />
                    </div>
                    <div>
                      <p className="drv-info-title">You'll be notified once approved</p>
                      <p className="drv-info-desc">
                        Once an admin approves your account, you'll be redirected to your driver dashboard automatically.
                      </p>
                    </div>
                  </div>

                  <p className="drv-time-note">Review typically takes 24–48 hours</p>
                </>
              )}

              {status === "rejected" && (
                <div className="drv-info-box red">
                  <div className="drv-info-icon">
                    <XCircle className="h-4 w-4 text-red-500" />
                  </div>
                  <div>
                    <p className="drv-info-title">Application Not Approved</p>
                    <p className="drv-info-desc">
                      Please contact our support team for more information or to re-apply.
                    </p>
                  </div>
                </div>
              )}

              {status === "approved" && (
                <div className="drv-info-box green">
                  <div className="drv-info-icon">
                    <Sparkles className="h-4 w-4 text-[#00B347]" />
                  </div>
                  <div>
                    <p className="drv-info-title">Account is now active</p>
                    <p className="drv-info-desc">
                      You'll be redirected to your driver dashboard automatically.
                    </p>
                  </div>
                </div>
              )}

              <button className="drv-logout-btn" onClick={handleLogout}>
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

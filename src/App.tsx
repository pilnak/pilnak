import { useEffect, lazy, Suspense, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
} from "react-router-dom";
import { BookingProvider } from "@/contexts/BookingContext";
import { BookingBottomSheet } from "@/components/booking/BookingBottomSheet";
import { useAuth } from "@/hooks/useAuth";
import { Truck } from "lucide-react";

const Landing = lazy(() => import("./pages/Landing"));
const Auth = lazy(() => import("./pages/Auth"));
const AdminRegister = lazy(() => import("./pages/AdminRegister"));
const CustomerDashboard = lazy(() => import("./pages/CustomerDashboard"));
const DriverDashboard = lazy(() => import("./pages/DriverDashboard"));
const DriverRegistration = lazy(() => import("./pages/DriverRegistration"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const CompanyDashboard = lazy(() => import("./pages/CompanyDashboard"));
const CompanyPendingApproval = lazy(
  () => import("./pages/CompanyPendingApproval"),
);
const DriverPendingApproval = lazy(
  () => import("./pages/DriverPendingApproval"),
);
const NotFound = lazy(() => import("./pages/NotFound"));
const LiveTrackingPage = lazy(() => import("./pages/LiveTrackingPage"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 1000 * 60 * 10,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const ROLE_ROUTES: Record<string, string> = {
  customer: "/customer",
  driver: "/driver",
  admin: "/admin",
  company: "/company",
};

const SplashScreen = ({ visible }: { visible: boolean }) => (
  <div
    className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center transition-opacity duration-500 ${
      visible
        ? "opacity-100 pointer-events-auto"
        : "opacity-0 pointer-events-none"
    }`}
    style={{ background: "#0d1f13" }}
  >
    <style>{`
      @keyframes splashRise {
        from { opacity: 0; transform: translateY(16px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @keyframes splashLoad {
        0%   { width: 0%; }
        60%  { width: 72%; }
        85%  { width: 88%; }
        100% { width: 100%; }
      }
 
      .pilnak-wordmark {
        font-family: 'DM Serif Display', serif;
        font-size: 48px;
        color: #f0f4f1;
        letter-spacing: -1.5px;
        line-height: 1;
      }
      .pilnak-wordmark em {
        font-style: italic;
        color: #4db464;
      }
      .pilnak-center {
        animation: splashRise 0.9s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        opacity: 0;
      }
      .pilnak-footer {
        animation: splashRise 0.9s cubic-bezier(0.22, 1, 0.36, 1) 0.3s forwards;
        opacity: 0;
      }
      .pilnak-fill {
        animation: splashLoad 2.4s cubic-bezier(0.4, 0, 0.2, 1) 0.5s forwards;
        width: 0%;
      }
    `}</style>

    {/* Logo + wordmark */}
    <div
      className="pilnak-center"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 20,
      }}
    >
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: 20,
          background: "rgba(77,180,100,0.12)",
          border: "1px solid rgba(77,180,100,0.25)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Truck color="#4db464" size={32} strokeWidth={1.5} />
      </div>

      <div style={{ textAlign: "center" }}>
        <div className="pilnak-wordmark">
          Piln<em>ak</em>
        </div>
        <div
          style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 10,
            letterSpacing: "0.2em",
            color: "rgba(255,255,255,0.25)",
            textTransform: "uppercase",
            marginTop: 8,
          }}
        >
          Fluid Logistics
        </div>
      </div>
    </div>

    {/* Progress bar */}
    <div
      className="pilnak-footer"
      style={{
        position: "absolute",
        bottom: 52,
        width: 100,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
      }}
    >
      <div
        style={{
          width: "100%",
          height: 1,
          background: "rgba(255,255,255,0.08)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          className="pilnak-fill"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            height: "100%",
            background: "#4db464",
          }}
        />
      </div>
      <span
        style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: 9,
          color: "rgba(255,255,255,0.2)",
          letterSpacing: "0.15em",
          textTransform: "uppercase",
        }}
      >
        Syncing routes
      </span>
    </div>
  </div>
);

const Spinner = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
  </div>
);

function ProtectedRoute({
  children,
  allowedRole,
}: {
  children: JSX.Element;
  allowedRole: string;
}) {
  const { user, role, isLoading, isEmailVerified } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!user) return;
    const path = location.pathname;
    window.history.pushState(null, "", path);
    const handlePopState = () => {
      navigate(path, { replace: true });
      window.history.pushState(null, "", path);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [user, location.pathname, navigate]);

  if (isLoading) return <Spinner />;
  if (!user) return <Navigate to="/auth" replace />;
  if (!isEmailVerified) return <Navigate to="/verify-email" replace />;
  if (role !== allowedRole) return <Navigate to="/auth" replace />;

  return children;
}

// Redirects authenticated users away from public routes to their dashboard.
// Unverified users are sent to /verify-email instead of their dashboard.
function PublicRoute({ children }: { children: JSX.Element }) {
  const { user, role, isLoading, isEmailVerified } = useAuth();

  if (isLoading) return <Spinner />;

  if (user && role) {
    if (!isEmailVerified) return <Navigate to="/verify-email" replace />;
    if (ROLE_ROUTES[role]) return <Navigate to={ROLE_ROUTES[role]} replace />;
  }

  return children;
}

const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);
  return null;
};

function AppShell() {
  const { isLoading } = useAuth();
  const isNewSession = !sessionStorage.getItem("splashShown");
  const [splashVisible, setSplashVisible] = useState(isNewSession);
  const [minTimeDone, setMinTimeDone] = useState(!isNewSession);

  useEffect(() => {
    if (!isNewSession) return;
    const t = setTimeout(() => setMinTimeDone(true), 2000);
    return () => clearTimeout(t);
  }, [isNewSession]);

  useEffect(() => {
    if (!isLoading && minTimeDone && splashVisible) {
      setSplashVisible(false);
      sessionStorage.setItem("splashShown", "1");
    }
  }, [isLoading, minTimeDone, splashVisible]);

  return (
    <>
      <SplashScreen visible={splashVisible} />
      <BookingProvider>
        <ScrollToTop />
        <Suspense fallback={<Spinner />}>
          <Routes>
            <Route
              path="/"
              element={
                <PublicRoute>
                  <Landing />
                </PublicRoute>
              }
            />
            <Route
              path="/auth"
              element={
                <PublicRoute>
                  <Auth />
                </PublicRoute>
              }
            />
            <Route path="/admin-register" element={<AdminRegister />} />
            <Route
              path="/company-pending"
              element={<CompanyPendingApproval />}
            />
            <Route
              path="/driver-pending"
              element={
                <ProtectedRoute allowedRole="driver">
                  <DriverPendingApproval />
                </ProtectedRoute>
              }
            />
            <Route
              path="/customer"
              element={
                <ProtectedRoute allowedRole="customer">
                  <CustomerDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/driver"
              element={
                <ProtectedRoute allowedRole="driver">
                  <DriverDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/driver-registration"
              element={
                <ProtectedRoute allowedRole="driver">
                  <DriverRegistration />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRole="admin">
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/company"
              element={
                <ProtectedRoute allowedRole="company">
                  <CompanyDashboard />
                </ProtectedRoute>
              }
            />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/live-track/:requestId" element={<LiveTrackingPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
        <BookingBottomSheet />
      </BookingProvider>
    </>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

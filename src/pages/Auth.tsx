import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createUserWithEmailAndPassword,
  deleteUser,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  linkWithCredential,
  GoogleAuthProvider,
  onAuthStateChanged,
  type AuthError,
  type OAuthCredential,
  type User as FirebaseUser,
} from "firebase/auth";
import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  limit,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "@/integrations/firebase/client";
import {
  ArrowLeft,
  Mail,
  Lock,
  User,
  Phone,
  Eye,
  EyeOff,
  Loader2,
  X,
  Building2,
  MapPin,
  FileText,
  Globe,
  Truck,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  Upload,
  Shield,
  CheckCircle2,
  Calendar,
  Briefcase,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { BOOKING_STORAGE_KEY } from "@/types/booking";

type AuthMode = "login" | "register";
type UserRole = "customer" | "driver" | "company";
type DriverType = "self" | "company" | null;

// ── Cloudinary ──────────────────────────────────────────────────────────────
const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

async function uploadFileToCloudinary(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`,
    { method: "POST", body: formData },
  );
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message ?? "Upload failed");
  }
  const data = await res.json();
  return data.secure_url as string;
}

// ── Constants ───────────────────────────────────────────────────────────────
const STEP_LABELS = [
  "Company Profile",
  "Operations",
  "Company Contact",
  "Team & Compliance",
  "Documents",
  "Account",
];

const LEGAL_STRUCTURES = [
  "LLC (Limited Liability Company)",
  "Sole Trader / Sole Proprietor",
  "Partnership",
  "Corporation",
  "Non-Profit Organization",
  "Other",
];

const FLEET_SIZES = ["1–5", "6–20", "21–50", "51–200", "200+"];

const VEHICLE_TYPE_OPTIONS = [
  "Dry Van",
  "Reefer",
  "Flatbed",
  "Box Truck",
  "Cargo Van",
  "Power Only",
  "Auto Transport",
];

const SERVICE_COVERAGE_OPTIONS = [
  "Local (City)",
  "Regional (State / Province)",
  "National",
  "International",
];

const CARGO_TYPE_OPTIONS = [
  "Documents",
  "Electronics",
  "Food & Beverages",
  "Clothing & Fashion",
  "Fragile Items",
  "Bulk / Heavy Cargo",
  "Hazardous Materials",
  "Pharmaceuticals",
  "Furniture",
  "E-commerce Parcels",
];

const DAILY_DELIVERY_RANGES = ["1–10", "11–50", "51–200", "201–500", "500+"];

const COUNTRIES = [
  "Afghanistan",
  "Albania",
  "Algeria",
  "Angola",
  "Argentina",
  "Armenia",
  "Australia",
  "Austria",
  "Azerbaijan",
  "Bahrain",
  "Bangladesh",
  "Belarus",
  "Belgium",
  "Benin",
  "Bolivia",
  "Bosnia and Herzegovina",
  "Botswana",
  "Brazil",
  "Bulgaria",
  "Burkina Faso",
  "Cameroon",
  "Canada",
  "Chile",
  "China",
  "Colombia",
  "Congo",
  "Costa Rica",
  "Côte d'Ivoire",
  "Croatia",
  "Cuba",
  "Czech Republic",
  "Denmark",
  "Dominican Republic",
  "DR Congo",
  "Ecuador",
  "Egypt",
  "Ethiopia",
  "Finland",
  "France",
  "Gabon",
  "Germany",
  "Ghana",
  "Greece",
  "Guatemala",
  "Guinea",
  "Honduras",
  "Hungary",
  "India",
  "Indonesia",
  "Iran",
  "Iraq",
  "Ireland",
  "Israel",
  "Italy",
  "Jamaica",
  "Japan",
  "Jordan",
  "Kazakhstan",
  "Kenya",
  "Kuwait",
  "Kyrgyzstan",
  "Laos",
  "Lebanon",
  "Libya",
  "Luxembourg",
  "Madagascar",
  "Malawi",
  "Malaysia",
  "Mali",
  "Mauritius",
  "Mexico",
  "Moldova",
  "Morocco",
  "Mozambique",
  "Myanmar",
  "Namibia",
  "Nepal",
  "Netherlands",
  "New Zealand",
  "Nicaragua",
  "Niger",
  "Nigeria",
  "Norway",
  "Oman",
  "Pakistan",
  "Panama",
  "Paraguay",
  "Peru",
  "Philippines",
  "Poland",
  "Portugal",
  "Qatar",
  "Romania",
  "Russia",
  "Rwanda",
  "Saudi Arabia",
  "Senegal",
  "Sierra Leone",
  "Singapore",
  "Slovakia",
  "South Africa",
  "South Korea",
  "South Sudan",
  "Spain",
  "Sri Lanka",
  "Sudan",
  "Sweden",
  "Switzerland",
  "Syria",
  "Taiwan",
  "Tajikistan",
  "Tanzania",
  "Thailand",
  "Togo",
  "Trinidad and Tobago",
  "Tunisia",
  "Turkey",
  "Turkmenistan",
  "Uganda",
  "Ukraine",
  "United Arab Emirates",
  "United Kingdom",
  "United States",
  "Uruguay",
  "Uzbekistan",
  "Venezuela",
  "Vietnam",
  "Yemen",
  "Zambia",
  "Zimbabwe",
];

// ── Helpers ──────────────────────────────────────────────────────────────────
function toggleMulti(arr: string[], item: string): string[] {
  return arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];
}

function getRedirectPath(
  role: string,
  approvalStatus: string | undefined,
  redirectBooking: boolean,
  redirectDashboard: boolean,
  from: string | null,
): string {
  if (role === "company") {
    return approvalStatus === "approved" ? "/company" : "/company-pending";
  }
  if (redirectDashboard && role === "customer") return "/customer";
  if (redirectBooking && role === "customer") return "/?redirect=booking";
  if (from) return from;
  if (role === "driver") return "/driver";
  if (role === "admin") return "/admin";
  return "/customer";
}

function saveBookingFromParams(searchParams: URLSearchParams) {
  try {
    const pickupAddress = searchParams.get("pickupAddress");
    const pickupLat = searchParams.get("pickupLat");
    const pickupLon = searchParams.get("pickupLon");
    const dropoffAddress = searchParams.get("dropoffAddress");
    const dropoffLat = searchParams.get("dropoffLat");
    const dropoffLon = searchParams.get("dropoffLon");
    if (pickupLat && pickupLon && dropoffLat && dropoffLon) {
      const existing = (() => {
        try {
          return JSON.parse(localStorage.getItem(BOOKING_STORAGE_KEY) ?? "{}");
        } catch {
          return {};
        }
      })();
      localStorage.setItem(
        BOOKING_STORAGE_KEY,
        JSON.stringify({
          ...existing,
          pickup: {
            address: pickupAddress ?? "",
            lat: parseFloat(pickupLat),
            lon: parseFloat(pickupLon),
          },
          dropoff: {
            address: dropoffAddress ?? "",
            lat: parseFloat(dropoffLat),
            lon: parseFloat(dropoffLon),
          },
        }),
      );
    }
  } catch {
    // ignore
  }
}

async function findCompanyDriverByEmail(
  email: string,
): Promise<{ id: string; companyId: string } | null> {
  const normalizedEmail = email.trim().toLowerCase();
  try {
    const exactQ = query(
      collection(db, "drivers"),
      where("email", "==", email.trim()),
      where("isCompanyDriver", "==", true),
      where("authLinked", "==", false),
    );
    const exactSnap = await getDocs(exactQ);
    if (!exactSnap.empty) {
      const d = exactSnap.docs[0];
      const data = d.data() as { companyId: string };
      return { id: d.id, companyId: data.companyId };
    }

    const fallbackQ = query(
      collection(db, "drivers"),
      where("isCompanyDriver", "==", true),
      where("authLinked", "==", false),
      limit(200),
    );
    const fallbackSnap = await getDocs(fallbackQ);
    const matched = fallbackSnap.docs.find((driverDoc) => {
      const data = driverDoc.data() as { email?: string };
      return (data.email ?? "").trim().toLowerCase() === normalizedEmail;
    });
    if (!matched) return null;

    const matchedData = matched.data() as { companyId: string };
    return { id: matched.id, companyId: matchedData.companyId };
  } catch {
    return null;
  }
}

async function activateCompanyDriverAccount(
  email: string,
  password: string,
): Promise<void> {
  const cleanedEmail = email.trim().toLowerCase();
  const cred = await createUserWithEmailAndPassword(
    auth,
    cleanedEmail,
    password,
  );
  const uid = cred.user.uid;
  const companyDriverRecord = await findCompanyDriverByEmail(cleanedEmail);
  if (!companyDriverRecord) {
    await deleteUser(cred.user);
    const err = new Error("No company account found for this email.");
    (err as Error & { code?: string }).code = "auth/company-driver-not-found";
    throw err;
  }

  await setDoc(doc(db, "users", uid), {
    email: cleanedEmail,
    role: "driver",
    driverType: "company",
    companyDriverId: companyDriverRecord.id,
    companyId: companyDriverRecord.companyId,
    emailVerificationRequired: true,
    createdAt: serverTimestamp(),
  });
  await updateDoc(doc(db, "drivers", companyDriverRecord.id), {
    uid,
    authLinked: true,
    updatedAt: serverTimestamp(),
  });
  try {
    await sendEmailVerification(cred.user);
  } catch {
    // Non-fatal: user can resend from the verify-email page
  }
}

function splitDisplayName(displayName: string | null): {
  firstName: string;
  lastName: string;
} {
  if (!displayName?.trim()) return { firstName: "", lastName: "" };
  const parts = displayName.trim().split(/\s+/);
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

// ── Sub-components ───────────────────────────────────────────────────────────
function ToggleChip({
  label,
  selected,
  onToggle,
}: {
  label: string;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-all duration-150 ${
        selected
          ? "bg-primary/10 text-primary border-primary/30 shadow-sm"
          : "bg-background text-foreground/70 border-border/60 hover:border-primary/30 hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function FileUploadField({
  id,
  label,
  accept,
  file,
  url,
  uploading,
  onChange,
}: {
  id: string;
  label: string;
  accept: string;
  file: File | null;
  url: string;
  uploading: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div>
      <Label htmlFor={id} className="text-xs font-medium">
        {label} <span className="text-destructive">*</span>
      </Label>
      <label
        htmlFor={id}
        className={`mt-1 flex items-center gap-3 w-full p-3 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-150 ${
          url
            ? "border-primary/40 bg-primary/5"
            : "border-border/50 hover:border-primary/30 bg-muted/20 hover:bg-muted/40"
        }`}
      >
        <input
          id={id}
          type="file"
          accept={accept}
          className="sr-only"
          onChange={onChange}
          disabled={uploading}
        />
        <div
          className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center ${
            url ? "bg-primary/10" : "bg-muted"
          }`}
        >
          {uploading ? (
            <Loader2 className="w-4 h-4 text-primary animate-spin" />
          ) : url ? (
            <CheckCircle2 className="w-4 h-4 text-primary" />
          ) : (
            <Upload className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0">
          <p
            className={`text-xs font-semibold truncate ${
              url ? "text-primary" : "text-foreground"
            }`}
          >
            {uploading
              ? "Uploading…"
              : url
                ? (file?.name ?? "Uploaded successfully")
                : "Click to upload"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            PDF or image · max 10 MB
          </p>
        </div>
      </label>
    </div>
  );
}

// ── Left brand panel ─────────────────────────────────────────────────────────
function LeftBrandPanel() {
  return (
    <div
      className="hidden lg:flex lg:w-[44%] xl:w-[42%] min-h-screen sticky top-0 flex-col overflow-hidden"
      style={{
        background:
          "linear-gradient(150deg, #00a847 0%, #008A39 30%, #006b2e 65%, #004d20 100%)",
      }}
    >
      {/* Decorative overlays */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse at 15% 15%, rgba(255,255,255,0.11) 0%, transparent 55%),
            radial-gradient(ellipse at 85% 85%, rgba(0,0,0,0.18) 0%, transparent 50%)
          `,
        }}
      />
      <div
        className="absolute -top-32 -right-32 w-96 h-96 rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(255,255,255,0.07) 0%, transparent 70%)",
        }}
      />
      <div
        className="absolute -bottom-48 -left-48 w-[560px] h-[560px] rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(255,255,255,0.04) 0%, transparent 60%)",
        }}
      />

      <div className="relative z-10 flex flex-col h-full p-10 xl:p-12">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 bg-white/15 border border-white/25 rounded-xl flex items-center justify-center">
            <Truck
              className="text-white"
              style={{ width: "56%", height: "56%" }}
            />
          </div>
          <span
            className="text-2xl font-bold text-white tracking-tight"
            style={{ fontFamily: "'DM Serif Display', serif" }}
          >
            Pil
            <span className="font-light italic text-white/75">nak</span>
          </span>
        </div>

        {/* Main copy */}
        <div className="mt-auto mb-auto pt-20 pb-10 space-y-8">
          <div>
            <h2 className="text-4xl xl:text-[2.6rem] font-bold text-white leading-[1.15] tracking-tight">
              Fast, reliable
              <br />
              delivery.
            </h2>
            <p className="text-white/60 text-[0.9375rem] mt-4 leading-relaxed max-w-xs">
              The smarter way to send and receive — for individuals, drivers,
              and businesses.
            </p>
          </div>

          <div className="space-y-3.5">
            {[
              "Real-time GPS tracking on every order",
              "Verified & insured independent drivers",
              "Company fleet management tools",
              "Instant booking with live status updates",
            ].map((item) => (
              <div key={item} className="flex items-center gap-3">
                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                    <path
                      d="M1 4L3.5 6.5L9 1"
                      stroke="white"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <span className="text-white/75 text-sm leading-relaxed">
                  {item}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="text-white/30 text-xs mt-auto">
          © {new Date().getFullYear()} Pilnak. All rights reserved.
        </p>
      </div>
    </div>
  );
}

// ── Input class helpers ───────────────────────────────────────────────────────
const inputBase =
  "h-9 rounded-xl border-border/60 bg-muted/20 focus:bg-white focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary/50 transition-all duration-150";

// ── Main component ───────────────────────────────────────────────────────────
export default function Auth() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const roleParam = searchParams.get("role") as UserRole | null;
  const from = (location.state as { from?: string } | null)?.from ?? null;

  const [mode, setMode] = useState<AuthMode>("login");
  const [role, setRole] = useState<UserRole>(roleParam || "customer");
  const [driverType, setDriverType] = useState<DriverType>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Forgot password
  const [forgotPasswordMode, setForgotPasswordMode] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [forgotPasswordSent, setForgotPasswordSent] = useState(false);
  const [forgotPasswordCooldown, setForgotPasswordCooldown] = useState(0);

  // Shared auth fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Customer / self-driver fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");

  // ── Company: Step 1 — Company Profile ────────────────────────────────────
  const [companyName, setCompanyName] = useState("");
  const [legalStructure, setLegalStructure] = useState("");
  const [country, setCountry] = useState("");
  const [yearFounded, setYearFounded] = useState("");
  const [companyRegNumber, setCompanyRegNumber] = useState("");
  const [taxId, setTaxId] = useState("");

  // ── Company: Step 2 — Operations ─────────────────────────────────────────
  const [fleetSize, setFleetSize] = useState("");
  const [vehicleTypes, setVehicleTypes] = useState<string[]>([]);
  const [serviceCoverage, setServiceCoverage] = useState<string[]>([]);
  const [cargoTypes, setCargoTypes] = useState<string[]>([]);
  const [avgDailyDeliveries, setAvgDailyDeliveries] = useState("");

  // ── Company: Step 3 — Company Contact ────────────────────────────────────
  const [companyPhone, setCompanyPhone] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [companyDescription, setCompanyDescription] = useState("");

  // ── Company: Step 4 — Team & Compliance ──────────────────────────────────
  const [contactPersonName, setContactPersonName] = useState("");
  const [contactPersonPhone, setContactPersonPhone] = useState("");
  const [contactPersonJobTitle, setContactPersonJobTitle] = useState("");
  const [emergencyContactName, setEmergencyContactName] = useState("");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("");
  const [insuranceProvider, setInsuranceProvider] = useState("");
  const [operatingLicenseNumber, setOperatingLicenseNumber] = useState("");

  // ── Company: Step 5 — Documents ──────────────────────────────────────────
  const [hasInsurance, setHasInsurance] = useState(false);
  const [operatingLicenseFile, setOperatingLicenseFile] =
    useState<File | null>(null);
  const [operatingLicenseUrl, setOperatingLicenseUrl] = useState("");
  const [operatingLicenseUploading, setOperatingLicenseUploading] =
    useState(false);
  const [cacCertFile, setCacCertFile] = useState<File | null>(null);
  const [cacCertUrl, setCacCertUrl] = useState("");
  const [cacCertUploading, setCacCertUploading] = useState(false);

  // ── Multi-step state ──────────────────────────────────────────────────────
  const [companyStep, setCompanyStep] = useState(1);

  // ── Google Sign-in state ─────────────────────────────────────────────────
  const [googleNewUser, setGoogleNewUser] = useState<{
    uid: string;
    email: string;
    firstName: string;
    lastName: string;
  } | null>(null);
  const [googleNewUserRole, setGoogleNewUserRole] = useState<
    "customer" | "driver"
  >("customer");
  const [googleNewUserPhone, setGoogleNewUserPhone] = useState("");
  const [googleLinkState, setGoogleLinkState] = useState<{
    email: string;
    credential: OAuthCredential;
  } | null>(null);
  const [googleLinkPassword, setGoogleLinkPassword] = useState("");

  const redirectBooking = searchParams.get("redirect") === "booking";
  const redirectDashboard = searchParams.get("redirect") === "dashboard";

  useEffect(() => {
    setDriverType(null);
    setCompanyStep(1);
  }, [role, mode]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      try {
        const profileSnap = await getDoc(doc(db, "users", user.uid));
        if (!profileSnap.exists()) {
          const { firstName, lastName } = splitDisplayName(user.displayName);
          setGoogleNewUser({
            uid: user.uid,
            email: user.email ?? "",
            firstName,
            lastName,
          });
          return;
        }
        const profile = profileSnap.data() as
          | {
              role?: string;
              approvalStatus?: string;
              emailVerificationRequired?: boolean;
            }
          | undefined;
        if (profile?.emailVerificationRequired && !user.emailVerified) {
          navigate("/verify-email", { replace: true });
          return;
        }
        const userRole = profile?.role ?? "customer";
        const approvalStatus = profile?.approvalStatus;
        if (redirectBooking) saveBookingFromParams(searchParams);
        navigate(
          getRedirectPath(
            userRole,
            approvalStatus,
            redirectBooking,
            redirectDashboard,
            from,
          ),
          { replace: true },
        );
      } catch {
        // ignore
      }
    });
    return () => unsub();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (forgotPasswordCooldown <= 0) return;
    const timer = setTimeout(
      () => setForgotPasswordCooldown((c) => c - 1),
      1000,
    );
    return () => clearTimeout(timer);
  }, [forgotPasswordCooldown]);

  // ── File upload handlers ─────────────────────────────────────────────────
  const handleOperatingLicenseChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setOperatingLicenseFile(file);
    setOperatingLicenseUploading(true);
    try {
      const url = await uploadFileToCloudinary(file);
      setOperatingLicenseUrl(url);
      toast.success("Operating license uploaded");
    } catch {
      toast.error("Upload failed. Please try again.");
      setOperatingLicenseFile(null);
    } finally {
      setOperatingLicenseUploading(false);
    }
  };

  const handleCacCertChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCacCertFile(file);
    setCacCertUploading(true);
    try {
      const url = await uploadFileToCloudinary(file);
      setCacCertUrl(url);
      toast.success("CAC certificate uploaded");
    } catch {
      toast.error("Upload failed. Please try again.");
      setCacCertFile(null);
    } finally {
      setCacCertUploading(false);
    }
  };

  // ── Google Sign-in handlers ──────────────────────────────────────────────
  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      const profileSnap = await getDoc(doc(db, "users", user.uid));
      if (!profileSnap.exists()) {
        const { firstName, lastName } = splitDisplayName(user.displayName);
        if (role === "driver" && driverType === "self") {
          setGoogleNewUserRole("driver");
        }
        setGoogleNewUser({
          uid: user.uid,
          email: user.email ?? "",
          firstName,
          lastName,
        });
        return;
      }

      const profile = profileSnap.data() as {
        role?: string;
        approvalStatus?: string;
        emailVerificationRequired?: boolean;
      };
      if (profile.emailVerificationRequired && !user.emailVerified) {
        navigate("/verify-email", { replace: true });
        return;
      }
      const userRole = profile.role ?? "customer";
      if (userRole === "driver") {
        const vehicleSnap = await getDoc(doc(db, "vehicles", user.uid));
        if (!vehicleSnap.exists()) {
          navigate("/driver-registration", { replace: true });
          return;
        }
      }
      if (redirectBooking) saveBookingFromParams(searchParams);
      toast.success("Welcome back!");
      navigate(
        getRedirectPath(
          userRole,
          profile.approvalStatus,
          redirectBooking,
          redirectDashboard,
          from,
        ),
        { replace: true },
      );
    } catch (err: unknown) {
      const error = err as AuthError;
      if (error.code === "auth/account-exists-with-different-credential") {
        const credential = GoogleAuthProvider.credentialFromError(error);
        const email = (error.customData?.email as string) ?? "";
        if (credential && email) {
          setGoogleLinkState({ email, credential });
        } else {
          toast.error(
            "Sign-in failed. Please use your email and password instead.",
          );
        }
      } else if (
        error.code === "auth/popup-closed-by-user" ||
        error.code === "auth/cancelled-popup-request"
      ) {
        // user dismissed — no action needed
      } else if (error.code === "auth/popup-blocked") {
        toast.error(
          "Popup was blocked. Please allow popups for this site and try again.",
        );
      } else if (error.code === "auth/network-request-failed") {
        toast.error("Network error. Please check your connection.");
      } else {
        toast.error("Google sign-in failed. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleNewUserSubmit = async () => {
    if (!googleNewUser) return;
    if (!googleNewUserPhone.trim()) {
      toast.error("Phone number is required.");
      return;
    }
    setIsLoading(true);
    try {
      const { uid, email, firstName, lastName } = googleNewUser;
      await Promise.all([
        setDoc(doc(db, "users", uid), {
          firstName,
          lastName,
          phone: googleNewUserPhone.trim(),
          email,
          role: googleNewUserRole,
          ...(googleNewUserRole === "driver" ? { driverType: "self" } : {}),
          emailVerificationRequired: false,
          createdAt: serverTimestamp(),
        }),
        googleNewUserRole === "customer"
          ? setDoc(doc(db, "customers", uid), {
              userId: uid,
              savedAddresses: [],
              walletBalance: 0,
              totalDeliveries: 0,
              createdAt: serverTimestamp(),
            })
          : setDoc(doc(db, "drivers", uid), {
              userId: uid,
              firstName,
              lastName,
              phone: googleNewUserPhone.trim(),
              email,
              status: "pending_verification",
              isOnline: false,
              isCompanyDriver: false,
              driverType: "self",
              authLinked: true,
              createdAt: serverTimestamp(),
            }),
      ]);
      if (redirectBooking && googleNewUserRole === "customer") {
        saveBookingFromParams(searchParams);
      }
      toast.success("Welcome! Your account has been created.");
      navigate(
        googleNewUserRole === "driver"
          ? "/driver-registration"
          : getRedirectPath(
              "customer",
              undefined,
              redirectBooking,
              redirectDashboard,
              from,
            ),
        { replace: true },
      );
    } catch {
      toast.error("Failed to create account. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLink = async () => {
    if (!googleLinkState || !googleLinkPassword) return;
    setIsLoading(true);
    try {
      const { email, credential } = googleLinkState;
      const userCred = await signInWithEmailAndPassword(
        auth,
        email,
        googleLinkPassword,
      );
      await linkWithCredential(userCred.user, credential);
      const profileSnap = await getDoc(doc(db, "users", userCred.user.uid));
      const profile = profileSnap.data() as
        | {
            role?: string;
            approvalStatus?: string;
            emailVerificationRequired?: boolean;
          }
        | undefined;
      if (profile?.emailVerificationRequired && !userCred.user.emailVerified) {
        navigate("/verify-email", { replace: true });
        return;
      }
      const userRole = profile?.role ?? "customer";
      if (redirectBooking) saveBookingFromParams(searchParams);
      toast.success("Google account linked! Welcome back.");
      navigate(
        getRedirectPath(
          userRole,
          profile?.approvalStatus,
          redirectBooking,
          redirectDashboard,
          from,
        ),
        { replace: true },
      );
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (
        code === "auth/wrong-password" ||
        code === "auth/invalid-credential"
      ) {
        toast.error("Incorrect password.");
      } else if (code === "auth/too-many-requests") {
        toast.error("Too many attempts. Please try again later.");
      } else if (code === "auth/network-request-failed") {
        toast.error("Network error. Please check your connection.");
      } else {
        toast.error("Failed to link account. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ── Step validation ──────────────────────────────────────────────────────
  function getCompanyStepError(step: number): string | null {
    if (step === 1) {
      if (!companyName.trim()) return "Company name is required";
      if (!legalStructure) return "Legal structure is required";
      if (!country) return "Country is required";
      const yr = Number(yearFounded);
      if (
        !yearFounded ||
        isNaN(yr) ||
        yr < 1800 ||
        yr > new Date().getFullYear()
      )
        return "Enter a valid year founded";
      if (!companyRegNumber.trim()) return "Registration number is required";
      return null;
    }
    if (step === 2) {
      if (!fleetSize) return "Fleet size is required";
      if (vehicleTypes.length === 0) return "Select at least one vehicle type";
      if (serviceCoverage.length === 0)
        return "Select at least one coverage area";
      if (cargoTypes.length === 0) return "Select at least one cargo type";
      return null;
    }
    if (step === 3) {
      if (!companyPhone.trim()) return "Company phone is required";
      if (!companyAddress.trim()) return "Company address is required";
      return null;
    }
    if (step === 4) {
      if (!contactPersonName.trim()) return "Contact person name is required";
      if (!contactPersonPhone.trim()) return "Contact person phone is required";
      if (!emergencyContactName.trim())
        return "Emergency contact name is required";
      if (!emergencyContactPhone.trim())
        return "Emergency contact phone is required";
      return null;
    }
    if (step === 5) {
      if (!operatingLicenseUrl) return "Operating license upload is required";
      if (!cacCertUrl) return "CAC certificate upload is required";
      return null;
    }
    if (step === 6) {
      if (!email.trim()) return "Email is required";
      if (password.length < 6) return "Password must be at least 6 characters";
      return null;
    }
    return null;
  }

  const handleCompanyNext = () => {
    const err = getCompanyStepError(companyStep);
    if (err) {
      toast.error(err);
      return;
    }
    setCompanyStep((s) => s + 1);
  };

  // ── Forgot password ──────────────────────────────────────────────────────
  const handleForgotPassword = async () => {
    const trimmed = forgotPasswordEmail.trim();
    if (!trimmed) {
      toast.error("Please enter your email address.");
      return;
    }
    setIsLoading(true);
    try {
      await sendPasswordResetEmail(auth, trimmed);
      setForgotPasswordSent(true);
      setForgotPasswordCooldown(60);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (
        code === "auth/user-not-found" ||
        code === "auth/invalid-credential"
      ) {
        setForgotPasswordSent(true);
        setForgotPasswordCooldown(60);
      } else if (code === "auth/invalid-email") {
        toast.error("Please enter a valid email address.");
      } else if (code === "auth/too-many-requests") {
        toast.error("Too many attempts. Please try again later.");
      } else if (code === "auth/network-request-failed") {
        toast.error("Network error. Please check your connection.");
      } else {
        toast.error("Failed to send reset email. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ── Login ────────────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const profileSnap = await getDoc(doc(db, "users", cred.user.uid));
      const profile = profileSnap.data() as
        | {
            role?: string;
            approvalStatus?: string;
            emailVerificationRequired?: boolean;
          }
        | undefined;
      if (profile?.emailVerificationRequired && !cred.user.emailVerified) {
        toast.info("Please verify your email before signing in.");
        navigate("/verify-email", { replace: true });
        return;
      }
      const userRole = profile?.role ?? "customer";
      const approvalStatus = profile?.approvalStatus;
      if (redirectBooking) saveBookingFromParams(searchParams);
      toast.success("Welcome back!");
      navigate(
        getRedirectPath(
          userRole,
          approvalStatus,
          redirectBooking,
          redirectDashboard,
          from,
        ),
        { replace: true },
      );
    } catch (error: unknown) {
      const code = (error as { code?: string })?.code;
      if (
        code === "auth/user-not-found" ||
        code === "auth/invalid-credential"
      ) {
        try {
          await activateCompanyDriverAccount(email, password);
          toast.success(
            "Account activated! Please verify your email to continue.",
          );
          navigate("/verify-email", { replace: true });
          return;
        } catch (activationError: unknown) {
          const activationCode = (activationError as { code?: string })?.code;
          if (activationCode === "auth/company-driver-not-found") {
            toast.error("Invalid email or password");
          } else if (activationCode === "auth/email-already-in-use") {
            toast.error("This email is already registered. Please sign in.");
          } else if (activationCode === "auth/weak-password") {
            toast.error("Password must be at least 6 characters.");
          } else if (activationCode === "auth/network-request-failed") {
            toast.error("Network error. Please check your connection.");
          } else if (activationCode === "auth/invalid-email") {
            toast.error("Please enter a valid email address.");
          } else {
            toast.error(`Sign in failed: ${activationCode ?? "unknown error"}`);
          }
        }
      } else if (
        code === "auth/wrong-password" ||
        code === "auth/invalid-credential"
      ) {
        toast.error("Invalid email or password");
      } else if (code === "auth/too-many-requests") {
        toast.error("Too many attempts. Please try again later.");
      } else if (code === "auth/network-request-failed") {
        toast.error("Network error. Please check your connection.");
      } else if (code === "auth/invalid-email") {
        toast.error("Please enter a valid email address.");
      } else {
        toast.error(`Sign in failed: ${code ?? "unknown error"}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ── Company submit ───────────────────────────────────────────────────────
  const handleCompanySubmit = async () => {
    const err = getCompanyStepError(6);
    if (err) {
      toast.error(err);
      return;
    }
    setIsLoading(true);
    try {
      const cleanEmail = email.trim().toLowerCase();
      const cred = await createUserWithEmailAndPassword(
        auth,
        cleanEmail,
        password,
      );
      const user: FirebaseUser = cred.user;
      try {
        await Promise.all([
          setDoc(doc(db, "users", user.uid), {
            email: cleanEmail,
            role: "company",
            approvalStatus: "pending",
            emailVerificationRequired: true,
            createdAt: serverTimestamp(),
          }),
          setDoc(doc(db, "companies", user.uid), {
            userId: user.uid,
            email: cleanEmail,
            companyName: companyName.trim(),
            legalStructure,
            country,
            yearFounded,
            companyRegNumber: companyRegNumber.trim(),
            taxId: taxId.trim() || null,
            fleetSize,
            vehicleTypes,
            serviceCoverage,
            cargoTypes,
            avgDailyDeliveries: avgDailyDeliveries || null,
            companyPhone: companyPhone.trim(),
            companyAddress: companyAddress.trim(),
            companyWebsite: companyWebsite.trim() || null,
            companyDescription: companyDescription.trim() || null,
            contactPersonName: contactPersonName.trim(),
            contactPersonPhone: contactPersonPhone.trim(),
            contactPersonJobTitle: contactPersonJobTitle.trim() || null,
            emergencyContactName: emergencyContactName.trim(),
            emergencyContactPhone: emergencyContactPhone.trim(),
            insuranceProvider: insuranceProvider.trim() || null,
            operatingLicenseNumber: operatingLicenseNumber.trim() || null,
            hasInsurance,
            operatingLicenseUrl,
            cacCertificateUrl: cacCertUrl,
            approvalStatus: "pending",
            totalDeliveries: 0,
            walletBalance: 0,
            createdAt: serverTimestamp(),
          }),
        ]);
        await setDoc(doc(db, "admin_notifications", `company_${user.uid}`), {
          type: "company_registration",
          companyId: user.uid,
          companyName: companyName.trim(),
          message: `New company registration pending approval: ${companyName.trim()}`,
          read: false,
          createdAt: serverTimestamp(),
        });
      } catch (firestoreError) {
        await deleteUser(user);
        throw firestoreError;
      }
      try {
        await sendEmailVerification(user);
      } catch {
        // Non-fatal
      }
      toast.success(
        "Application submitted! Please verify your email to continue.",
      );
      navigate("/verify-email", { replace: true });
    } catch (error: unknown) {
      const code = (error as { code?: string })?.code;
      if (code === "auth/email-already-in-use") {
        toast.error("This email is already registered. Please sign in.");
      } else if (code === "auth/weak-password") {
        toast.error("Password must be at least 6 characters.");
      } else if (code === "auth/network-request-failed") {
        toast.error("Network error. Please check your connection.");
      } else if (code === "auth/invalid-email") {
        toast.error("Please enter a valid email address.");
      } else {
        toast.error(`Registration failed: ${code ?? "unknown error"}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ── Customer / self-driver register ─────────────────────────────────────
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (role === "driver" && driverType === "company") {
        try {
          await activateCompanyDriverAccount(email, password);
        } catch (activationError: unknown) {
          const activationCode = (activationError as { code?: string })?.code;
          if (activationCode === "auth/company-driver-not-found") {
            toast.error(
              "No company account found for this email. Contact your company admin.",
            );
            setIsLoading(false);
            return;
          }
          throw activationError;
        }
        toast.success(
          "Account activated! Please verify your email to continue.",
        );
        navigate("/verify-email", { replace: true });
        return;
      }

      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const user: FirebaseUser = cred.user;

      await Promise.all([
        setDoc(doc(db, "users", user.uid), {
          firstName,
          lastName,
          phone,
          email,
          role,
          ...(role === "driver" ? { driverType: "self" } : {}),
          emailVerificationRequired: true,
          createdAt: serverTimestamp(),
        }),
        role === "customer"
          ? setDoc(doc(db, "customers", user.uid), {
              userId: user.uid,
              savedAddresses: [],
              walletBalance: 0,
              totalDeliveries: 0,
              createdAt: serverTimestamp(),
            })
          : setDoc(doc(db, "drivers", user.uid), {
              userId: user.uid,
              firstName,
              lastName,
              phone,
              email,
              status: "pending_verification",
              isOnline: false,
              isCompanyDriver: false,
              driverType: "self",
              authLinked: true,
              createdAt: serverTimestamp(),
            }),
      ]);

      if (redirectBooking && role === "customer")
        saveBookingFromParams(searchParams);

      try {
        await sendEmailVerification(user);
      } catch {
        // Non-fatal
      }

      toast.success("Account created! Please verify your email to continue.");
      navigate("/verify-email", { replace: true });
    } catch (error: unknown) {
      const code = (error as { code?: string })?.code;
      if (code === "auth/email-already-in-use") {
        toast.error("This email is already registered. Please sign in.");
      } else if (code === "auth/weak-password") {
        toast.error("Password must be at least 6 characters.");
      } else if (code === "auth/network-request-failed") {
        toast.error("Network error. Please check your connection.");
      } else if (code === "auth/invalid-email") {
        toast.error("Please enter a valid email address.");
      } else {
        toast.error(`Registration failed: ${code ?? "unknown error"}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ── Derived UI state ─────────────────────────────────────────────────────
  const roleTabs: { key: UserRole; label: string }[] = [
    { key: "customer", label: "Customer" },
    { key: "driver", label: "Driver" },
    { key: "company", label: "Company" },
  ];

  const showDriverTypePicker =
    mode === "register" && role === "driver" && driverType === null;

  // Consolidated back navigation across all states
  const handleBack = () => {
    if (forgotPasswordMode) {
      setForgotPasswordMode(false);
      setForgotPasswordSent(false);
      setForgotPasswordCooldown(0);
      return;
    }
    if (googleLinkState) {
      setGoogleLinkState(null);
      setGoogleLinkPassword("");
      return;
    }
    if (mode === "register" && role === "driver" && driverType !== null) {
      setDriverType(null);
      return;
    }
    if (mode === "register" && role === "company" && companyStep > 1) {
      setCompanyStep((s) => s - 1);
      return;
    }
    navigate(-1);
  };

  // googleNewUser state has no back button (only exit)
  const showBackButton = !googleNewUser;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-[100dvh] lg:h-[100dvh] flex bg-white">
      {/* Left brand panel */}
      <LeftBrandPanel />

      {/* Right panel */}
      <div className="flex-1 flex flex-col overflow-y-auto min-h-[100dvh] lg:min-h-0">
        {/* Header */}
        <header
          className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm flex items-center justify-between px-5 py-3 flex-shrink-0"
          style={{ paddingTop: "calc(env(safe-area-inset-top) + 1rem)" }}
        >
          {showBackButton ? (
            <button
              onClick={handleBack}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          ) : (
            <div />
          )}
          <button
            onClick={() => navigate("/")}
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
            aria-label="Exit"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* Content */}
        <main className="flex-1 flex flex-col px-5 sm:px-8 pb-8 pt-1">
          <div className="w-full max-w-[420px] mx-auto my-auto">

            {/* ── Forgot password ──────────────────────────────────────── */}
            {forgotPasswordMode && (
              <div className="space-y-4">
                <div className="text-center mb-1">
                  <div className="lg:hidden mb-3 flex justify-center">
                    <Logo size="sm" />
                  </div>
                  {forgotPasswordSent ? (
                    <>
                      <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
                        <Mail className="w-6 h-6 text-primary" />
                      </div>
                      <h1 className="text-[1.0625rem] font-bold tracking-tight">
                        Check your inbox
                      </h1>
                      <p className="text-muted-foreground text-xs mt-1.5 leading-relaxed">
                        If an account exists for{" "}
                        <span className="font-semibold text-foreground break-all">
                          {forgotPasswordEmail.trim()}
                        </span>
                        , a password reset link has been sent.
                      </p>
                    </>
                  ) : (
                    <>
                      <h1 className="text-[1.0625rem] font-bold tracking-tight">
                        Reset your password
                      </h1>
                      <p className="text-muted-foreground text-xs mt-1.5">
                        Enter your email and we'll send you a reset link.
                      </p>
                    </>
                  )}
                </div>

                {forgotPasswordSent ? (
                  <>
                    <div className="p-4 rounded-xl bg-muted/50 border border-border/40 text-sm text-muted-foreground leading-relaxed">
                      Didn't receive it? Check your spam folder, then try
                      resending.
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full h-9 rounded-xl font-semibold text-sm"
                      onClick={() => {
                        setForgotPasswordSent(false);
                        setForgotPasswordCooldown(0);
                      }}
                      disabled={forgotPasswordCooldown > 0}
                    >
                      {forgotPasswordCooldown > 0
                        ? `Resend in ${forgotPasswordCooldown}s`
                        : "Resend reset link"}
                    </Button>
                    <button
                      type="button"
                      onClick={() => {
                        setForgotPasswordMode(false);
                        setForgotPasswordSent(false);
                        setForgotPasswordCooldown(0);
                      }}
                      className="w-full flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Back to sign in
                    </button>
                  </>
                ) : (
                  <>
                    <div>
                      <Label
                        htmlFor="forgotEmail"
                        className="text-xs font-medium"
                      >
                        Email address
                      </Label>
                      <div className="relative mt-1">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                        <Input
                          id="forgotEmail"
                          type="email"
                          placeholder="you@example.com"
                          value={forgotPasswordEmail}
                          onChange={(e) =>
                            setForgotPasswordEmail(e.target.value)
                          }
                          className={`${inputBase} pl-10`}
                          autoComplete="email"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleForgotPassword();
                          }}
                        />
                      </div>
                    </div>
                    <Button
                      type="button"
                      className="w-full h-9 rounded-xl text-sm font-semibold shadow-md shadow-primary/20"
                      disabled={isLoading}
                      onClick={handleForgotPassword}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          Sending…
                        </>
                      ) : (
                        "Send reset link"
                      )}
                    </Button>
                  </>
                )}
              </div>
            )}

            {/* ── Google: new user role + phone ────────────────────────── */}
            {!forgotPasswordMode && googleNewUser && (
              <div className="space-y-4">
                <div className="text-center mb-1">
                  <div className="lg:hidden mb-3 flex justify-center">
                    <Logo size="sm" />
                  </div>
                  <h1 className="text-[1.0625rem] font-bold tracking-tight">
                    Almost there!
                  </h1>
                  <p className="text-muted-foreground text-xs mt-1.5">
                    Just a couple more details to set up your account.
                  </p>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border/40">
                  <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 text-xs font-bold text-primary uppercase">
                    {googleNewUser.firstName?.[0] ?? googleNewUser.email[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">
                      {[googleNewUser.firstName, googleNewUser.lastName]
                        .filter(Boolean)
                        .join(" ") || googleNewUser.email}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {googleNewUser.email}
                    </p>
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-medium">
                    I'm signing up as
                  </Label>
                  <div className="flex items-center bg-muted rounded-xl p-1 mt-2">
                    {(["customer", "driver"] as const).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setGoogleNewUserRole(r)}
                        className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 ${
                          googleNewUserRole === r
                            ? "bg-white text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {r === "driver" ? "Self Driver" : "Customer"}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label htmlFor="googlePhone" className="text-xs font-medium">
                    Phone Number
                  </Label>
                  <div className="relative mt-1">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input
                      id="googlePhone"
                      type="tel"
                      placeholder="+1 555 000 0000"
                      value={googleNewUserPhone}
                      onChange={(e) => setGoogleNewUserPhone(e.target.value)}
                      className={`${inputBase} pl-10`}
                      autoComplete="tel"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleGoogleNewUserSubmit();
                      }}
                    />
                  </div>
                </div>

                <Button
                  type="button"
                  className="w-full h-9 rounded-xl text-sm font-semibold shadow-md shadow-primary/20"
                  disabled={isLoading}
                  onClick={handleGoogleNewUserSubmit}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Setting up…
                    </>
                  ) : (
                    "Create Account"
                  )}
                </Button>
              </div>
            )}

            {/* ── Google: link existing account ────────────────────────── */}
            {!forgotPasswordMode && !googleNewUser && googleLinkState && (
              <div className="space-y-4">
                <div className="text-center mb-1">
                  <div className="lg:hidden mb-3 flex justify-center">
                    <Logo size="sm" />
                  </div>
                  <h1 className="text-[1.0625rem] font-bold tracking-tight">
                    Link your Google account
                  </h1>
                  <p className="text-muted-foreground text-xs mt-1.5 leading-relaxed">
                    An account for{" "}
                    <span className="font-semibold text-foreground break-all">
                      {googleLinkState.email}
                    </span>{" "}
                    already exists. Enter your password to connect Google
                    sign-in.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label
                      htmlFor="linkEmail"
                      className="text-xs font-medium"
                    >
                      Email
                    </Label>
                    <div className="relative mt-1">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                      <Input
                        id="linkEmail"
                        type="email"
                        value={googleLinkState.email}
                        readOnly
                        className={`${inputBase} pl-10 bg-muted/40 text-muted-foreground`}
                      />
                    </div>
                  </div>

                  <div>
                    <Label
                      htmlFor="linkPassword"
                      className="text-xs font-medium"
                    >
                      Password
                    </Label>
                    <div className="relative mt-1">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                      <Input
                        id="linkPassword"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={googleLinkPassword}
                        onChange={(e) => setGoogleLinkPassword(e.target.value)}
                        className={`${inputBase} pl-10 pr-11`}
                        autoComplete="current-password"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleGoogleLink();
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <Button
                    type="button"
                    className="w-full h-9 rounded-xl text-sm font-semibold shadow-md shadow-primary/20"
                    disabled={isLoading || !googleLinkPassword}
                    onClick={handleGoogleLink}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Linking…
                      </>
                    ) : (
                      "Link Account & Sign in"
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* ── Main auth ─────────────────────────────────────────────── */}
            {!forgotPasswordMode && !googleNewUser && !googleLinkState && (
              <>
                {/* ── Driver type picker ────────────────────────────────── */}
                {showDriverTypePicker ? (
                  <div>
                    <div className="text-center mb-6">
                      <div className="lg:hidden mb-3 flex justify-center">
                        <Logo size="sm" />
                      </div>
                      <h1 className="text-[1.0625rem] font-bold tracking-tight">
                        What type of driver are you?
                      </h1>
                      <p className="text-muted-foreground text-xs mt-1.5">
                        Choose how you'll operate on the platform.
                      </p>
                    </div>

                    <div className="space-y-3">
                      <button
                        type="button"
                        onClick={() => setDriverType("self")}
                        className="w-full text-left flex items-center gap-3 p-4 rounded-xl border border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-all duration-150 group"
                      >
                        <div className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center flex-shrink-0 group-hover:bg-primary/10 transition-colors">
                          <UserCheck className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-foreground">
                            Self Driver
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                            Independent — I find and accept deliveries on my
                            own.
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary flex-shrink-0 transition-colors" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setDriverType("company")}
                        className="w-full text-left flex items-center gap-3 p-4 rounded-xl border border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-all duration-150 group"
                      >
                        <div className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center flex-shrink-0 group-hover:bg-primary/10 transition-colors">
                          <Truck className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-foreground">
                            Company Driver
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                            Registered by a company — I'll use the email they
                            provided.
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary flex-shrink-0 transition-colors" />
                      </button>
                    </div>

                    <p className="text-center text-sm text-muted-foreground mt-8">
                      Already have an account?{" "}
                      <button
                        type="button"
                        onClick={() => setMode("login")}
                        className="text-primary font-semibold hover:underline"
                      >
                        Sign in
                      </button>
                    </p>
                  </div>
                ) : (
                  /* ── Login / Register form ───────────────────────────── */
                  <>
                    {/* Page heading */}
                    <div className="mb-4">
                      <div className="lg:hidden mb-3 flex justify-center">
                        <Logo size="sm" />
                      </div>
                      <h1 className="text-[1.0625rem] font-bold tracking-tight text-center">
                        {mode === "login"
                          ? "Welcome back"
                          : role === "company"
                            ? "Register your company"
                            : role === "driver" && driverType === "company"
                              ? "Activate your account"
                              : role === "driver" && driverType === "self"
                                ? "Join as a driver"
                                : "Create your account"}
                      </h1>
                      <p className="text-muted-foreground text-xs mt-1 text-center">
                        {mode === "login"
                          ? redirectDashboard
                            ? "Sign in to continue your delivery request"
                            : redirectBooking
                              ? "Sign in to continue with your booking"
                              : "Sign in to continue"
                          : role === "company"
                            ? "Register your fleet for bulk deliveries"
                            : role === "driver" && driverType === "company"
                              ? "Use the email your company registered you with"
                              : role === "driver" && driverType === "self"
                                ? "Sign up as an independent driver"
                                : "Sign up to start sending packages"}
                      </p>

                      {mode === "register" &&
                        role === "driver" &&
                        driverType !== null && (
                          <div className="flex justify-center mt-3">
                            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-xs font-semibold text-primary">
                              {driverType === "company" ? (
                                <Truck className="h-3 w-3" />
                              ) : (
                                <UserCheck className="h-3 w-3" />
                              )}
                              {driverType === "company"
                                ? "Company Driver"
                                : "Self Driver"}
                              <button
                                type="button"
                                onClick={() => setDriverType(null)}
                                className="ml-0.5 text-primary/50 hover:text-primary transition-colors"
                                title="Change driver type"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        )}
                    </div>

                    {/* Mode toggle (hidden during company multi-step after step 1) */}
                    {!(
                      mode === "register" &&
                      role === "company" &&
                      companyStep > 1
                    ) && (
                      <div className="flex items-center bg-muted rounded-xl p-1 mb-4">
                        {(["login", "register"] as const).map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setMode(m)}
                            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 ${
                              mode === m
                                ? "bg-white text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {m === "login" ? "Sign in" : "Create account"}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Role tabs — register only, not driver sub-step, not company step > 1 */}
                    {mode === "register" &&
                      !showDriverTypePicker &&
                      !(role === "company" && companyStep > 1) &&
                      !(
                        role === "driver" && driverType !== null
                      ) && (
                        <div className="flex items-center bg-muted rounded-xl p-1 mb-4">
                          {roleTabs.map((tab) => (
                            <button
                              key={tab.key}
                              type="button"
                              onClick={() => setRole(tab.key)}
                              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 ${
                                role === tab.key
                                  ? "bg-white text-foreground shadow-sm"
                                  : "text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              {tab.label}
                            </button>
                          ))}
                        </div>
                      )}

                    {/* ── Company multi-step registration ─────────────────── */}
                    {mode === "register" && role === "company" ? (
                      <div>
                        {/* Step indicator */}
                        <div className="mb-4">
                          <div className="flex items-center">
                            {STEP_LABELS.map((_, i) => {
                              const s = i + 1;
                              const done = companyStep > s;
                              const active = companyStep === s;
                              return (
                                <div
                                  key={s}
                                  className="flex items-center flex-1 last:flex-none"
                                >
                                  <div
                                    className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-200 ${
                                      done
                                        ? "bg-primary text-white"
                                        : active
                                          ? "bg-primary text-white ring-4 ring-primary/15"
                                          : "bg-muted text-muted-foreground"
                                    }`}
                                  >
                                    {done ? (
                                      <Check className="w-3.5 h-3.5" />
                                    ) : (
                                      s
                                    )}
                                  </div>
                                  {i < STEP_LABELS.length - 1 && (
                                    <div
                                      className={`flex-1 h-0.5 mx-1 rounded-full transition-all duration-200 ${
                                        done ? "bg-primary" : "bg-border"
                                      }`}
                                    />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          <p className="text-xs text-muted-foreground mt-3">
                            Step {companyStep} of {STEP_LABELS.length} —{" "}
                            <span className="font-semibold text-foreground">
                              {STEP_LABELS[companyStep - 1]}
                            </span>
                          </p>
                        </div>

                        {/* ── Step 1: Company Profile ──────────────────────── */}
                        {companyStep === 1 && (
                          <div className="space-y-3">
                            <div>
                              <Label htmlFor="companyName" className="text-xs font-medium">
                                Company Name{" "}
                                <span className="text-destructive">*</span>
                              </Label>
                              <div className="relative mt-1">
                                <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                                <Input
                                  id="companyName"
                                  type="text"
                                  placeholder="Acme Logistics Ltd."
                                  value={companyName}
                                  onChange={(e) =>
                                    setCompanyName(e.target.value)
                                  }
                                  className={`${inputBase} pl-10`}
                                />
                              </div>
                            </div>

                            <div>
                              <Label className="text-xs font-medium">
                                Legal Structure{" "}
                                <span className="text-destructive">*</span>
                              </Label>
                              <Select
                                value={legalStructure}
                                onValueChange={setLegalStructure}
                              >
                                <SelectTrigger className="mt-1 h-9 rounded-xl border-border/60 bg-muted/20">
                                  <SelectValue placeholder="Select legal structure" />
                                </SelectTrigger>
                                <SelectContent>
                                  {LEGAL_STRUCTURES.map((s) => (
                                    <SelectItem key={s} value={s}>
                                      {s}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <Label className="text-xs font-medium">
                                  Country{" "}
                                  <span className="text-destructive">*</span>
                                </Label>
                                <Select
                                  value={country}
                                  onValueChange={setCountry}
                                >
                                  <SelectTrigger className="mt-1 h-9 rounded-xl border-border/60 bg-muted/20">
                                    <SelectValue placeholder="Select country" />
                                  </SelectTrigger>
                                  <SelectContent className="max-h-60">
                                    {COUNTRIES.map((c) => (
                                      <SelectItem key={c} value={c}>
                                        {c}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label
                                  htmlFor="yearFounded"
                                  className="text-xs font-medium"
                                >
                                  Year Founded{" "}
                                  <span className="text-destructive">*</span>
                                </Label>
                                <div className="relative mt-1">
                                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                                  <Input
                                    id="yearFounded"
                                    type="number"
                                    placeholder="2015"
                                    value={yearFounded}
                                    onChange={(e) =>
                                      setYearFounded(e.target.value)
                                    }
                                    min={1800}
                                    max={new Date().getFullYear()}
                                    className={`${inputBase} pl-9`}
                                  />
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <Label
                                  htmlFor="companyRegNumber"
                                  className="text-xs font-medium"
                                >
                                  Reg. Number{" "}
                                  <span className="text-destructive">*</span>
                                </Label>
                                <div className="relative mt-1">
                                  <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                                  <Input
                                    id="companyRegNumber"
                                    type="text"
                                    placeholder="RC1234567"
                                    value={companyRegNumber}
                                    onChange={(e) =>
                                      setCompanyRegNumber(e.target.value)
                                    }
                                    className={`${inputBase} pl-9`}
                                  />
                                </div>
                              </div>
                              <div>
                                <Label
                                  htmlFor="taxId"
                                  className="text-xs font-medium"
                                >
                                  Tax ID / VAT{" "}
                                  <span className="text-muted-foreground font-normal text-xs">
                                    (optional)
                                  </span>
                                </Label>
                                <div className="relative mt-1">
                                  <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                                  <Input
                                    id="taxId"
                                    type="text"
                                    placeholder="123456789"
                                    value={taxId}
                                    onChange={(e) => setTaxId(e.target.value)}
                                    className={`${inputBase} pl-9`}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* ── Step 2: Operations ───────────────────────────── */}
                        {companyStep === 2 && (
                          <div className="space-y-4">
                            <div>
                              <Label className="text-xs font-medium">
                                Fleet Size{" "}
                                <span className="text-destructive">*</span>
                              </Label>
                              <div className="flex flex-wrap gap-2 mt-2">
                                {FLEET_SIZES.map((s) => (
                                  <button
                                    key={s}
                                    type="button"
                                    onClick={() => setFleetSize(s)}
                                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all duration-150 ${
                                      fleetSize === s
                                        ? "bg-primary/10 text-primary border-primary/30 shadow-sm"
                                        : "bg-background border-border/60 text-foreground/70 hover:border-primary/30 hover:text-foreground"
                                    }`}
                                  >
                                    {s}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div>
                              <Label className="text-xs font-medium">
                                Vehicle Types{" "}
                                <span className="text-destructive">*</span>
                              </Label>
                              <div className="flex flex-wrap gap-2 mt-2">
                                {VEHICLE_TYPE_OPTIONS.map((v) => (
                                  <ToggleChip
                                    key={v}
                                    label={v}
                                    selected={vehicleTypes.includes(v)}
                                    onToggle={() =>
                                      setVehicleTypes(
                                        toggleMulti(vehicleTypes, v),
                                      )
                                    }
                                  />
                                ))}
                              </div>
                            </div>

                            <div>
                              <Label className="text-xs font-medium">
                                Service Coverage{" "}
                                <span className="text-destructive">*</span>
                              </Label>
                              <div className="flex flex-wrap gap-2 mt-2">
                                {SERVICE_COVERAGE_OPTIONS.map((s) => (
                                  <ToggleChip
                                    key={s}
                                    label={s}
                                    selected={serviceCoverage.includes(s)}
                                    onToggle={() =>
                                      setServiceCoverage(
                                        toggleMulti(serviceCoverage, s),
                                      )
                                    }
                                  />
                                ))}
                              </div>
                            </div>

                            <div>
                              <Label className="text-xs font-medium">
                                Types of Cargo{" "}
                                <span className="text-destructive">*</span>
                              </Label>
                              <div className="flex flex-wrap gap-2 mt-2">
                                {CARGO_TYPE_OPTIONS.map((c) => (
                                  <ToggleChip
                                    key={c}
                                    label={c}
                                    selected={cargoTypes.includes(c)}
                                    onToggle={() =>
                                      setCargoTypes(
                                        toggleMulti(cargoTypes, c),
                                      )
                                    }
                                  />
                                ))}
                              </div>
                            </div>

                            <div>
                              <Label className="text-xs font-medium">
                                Avg. Daily Deliveries{" "}
                                <span className="text-muted-foreground font-normal text-xs">
                                  (optional)
                                </span>
                              </Label>
                              <Select
                                value={avgDailyDeliveries}
                                onValueChange={setAvgDailyDeliveries}
                              >
                                <SelectTrigger className="mt-1 h-9 rounded-xl border-border/60 bg-muted/20">
                                  <SelectValue placeholder="Select range" />
                                </SelectTrigger>
                                <SelectContent>
                                  {DAILY_DELIVERY_RANGES.map((r) => (
                                    <SelectItem key={r} value={r}>
                                      {r}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        )}

                        {/* ── Step 3: Company Contact ──────────────────────── */}
                        {companyStep === 3 && (
                          <div className="space-y-3">
                            <div>
                              <Label
                                htmlFor="cPhone"
                                className="text-xs font-medium"
                              >
                                Company Phone{" "}
                                <span className="text-destructive">*</span>
                              </Label>
                              <div className="relative mt-1">
                                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                                <Input
                                  id="cPhone"
                                  type="tel"
                                  placeholder="+1 555 000 0000"
                                  value={companyPhone}
                                  onChange={(e) =>
                                    setCompanyPhone(e.target.value)
                                  }
                                  className={`${inputBase} pl-10`}
                                />
                              </div>
                            </div>

                            <div>
                              <Label
                                htmlFor="cAddress"
                                className="text-xs font-medium"
                              >
                                Company Address{" "}
                                <span className="text-destructive">*</span>
                              </Label>
                              <div className="relative mt-1">
                                <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                                <Input
                                  id="cAddress"
                                  type="text"
                                  placeholder="123 Business Ave, City, Country"
                                  value={companyAddress}
                                  onChange={(e) =>
                                    setCompanyAddress(e.target.value)
                                  }
                                  className={`${inputBase} pl-10`}
                                />
                              </div>
                            </div>

                            <div>
                              <Label
                                htmlFor="cWebsite"
                                className="text-xs font-medium"
                              >
                                Website{" "}
                                <span className="text-muted-foreground font-normal text-xs">
                                  (optional)
                                </span>
                              </Label>
                              <div className="relative mt-1">
                                <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                                <Input
                                  id="cWebsite"
                                  type="url"
                                  placeholder="https://yourcompany.com"
                                  value={companyWebsite}
                                  onChange={(e) =>
                                    setCompanyWebsite(e.target.value)
                                  }
                                  className={`${inputBase} pl-10`}
                                />
                              </div>
                            </div>

                            <div>
                              <Label
                                htmlFor="cDescription"
                                className="text-xs font-medium"
                              >
                                Company Description{" "}
                                <span className="text-muted-foreground font-normal text-xs">
                                  (optional)
                                </span>
                              </Label>
                              <Textarea
                                id="cDescription"
                                placeholder="Brief description of your company and the services you offer…"
                                value={companyDescription}
                                onChange={(e) =>
                                  setCompanyDescription(e.target.value)
                                }
                                className="mt-1 resize-none rounded-xl border-border/60 bg-muted/20 focus:bg-white focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary/50 transition-all"
                                rows={3}
                              />
                            </div>
                          </div>
                        )}

                        {/* ── Step 4: Team & Compliance ────────────────────── */}
                        {companyStep === 4 && (
                          <div className="space-y-3">
                            <p className="text-sm font-semibold flex items-center gap-2 text-foreground">
                              <User className="w-4 h-4 text-primary" />
                              Primary Contact Person
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <Label
                                  htmlFor="cpName"
                                  className="text-xs font-medium"
                                >
                                  Full Name{" "}
                                  <span className="text-destructive">*</span>
                                </Label>
                                <div className="relative mt-1">
                                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                                  <Input
                                    id="cpName"
                                    type="text"
                                    placeholder="Jane Doe"
                                    value={contactPersonName}
                                    onChange={(e) =>
                                      setContactPersonName(e.target.value)
                                    }
                                    className={`${inputBase} pl-9`}
                                  />
                                </div>
                              </div>
                              <div>
                                <Label
                                  htmlFor="cpJobTitle"
                                  className="text-xs font-medium"
                                >
                                  Job Title{" "}
                                  <span className="text-muted-foreground font-normal text-xs">
                                    (opt.)
                                  </span>
                                </Label>
                                <div className="relative mt-1">
                                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                                  <Input
                                    id="cpJobTitle"
                                    type="text"
                                    placeholder="Ops Manager"
                                    value={contactPersonJobTitle}
                                    onChange={(e) =>
                                      setContactPersonJobTitle(e.target.value)
                                    }
                                    className={`${inputBase} pl-9`}
                                  />
                                </div>
                              </div>
                            </div>
                            <div>
                              <Label
                                htmlFor="cpPhone"
                                className="text-xs font-medium"
                              >
                                Phone{" "}
                                <span className="text-destructive">*</span>
                              </Label>
                              <div className="relative mt-1">
                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                                <Input
                                  id="cpPhone"
                                  type="tel"
                                  placeholder="+1 555 000 0000"
                                  value={contactPersonPhone}
                                  onChange={(e) =>
                                    setContactPersonPhone(e.target.value)
                                  }
                                  className={`${inputBase} pl-9`}
                                />
                              </div>
                            </div>

                            <div className="border-t pt-3">
                              <p className="text-sm font-semibold flex items-center gap-2 mb-2 text-foreground">
                                <Phone className="w-4 h-4 text-primary" />
                                Emergency Contact
                              </p>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <Label
                                    htmlFor="ecName"
                                    className="text-xs font-medium"
                                  >
                                    Full Name{" "}
                                    <span className="text-destructive">*</span>
                                  </Label>
                                  <div className="relative mt-1">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                                    <Input
                                      id="ecName"
                                      type="text"
                                      placeholder="John Doe"
                                      value={emergencyContactName}
                                      onChange={(e) =>
                                        setEmergencyContactName(e.target.value)
                                      }
                                      className={`${inputBase} pl-9`}
                                    />
                                  </div>
                                </div>
                                <div>
                                  <Label
                                    htmlFor="ecPhone"
                                    className="text-xs font-medium"
                                  >
                                    Phone{" "}
                                    <span className="text-destructive">*</span>
                                  </Label>
                                  <div className="relative mt-1">
                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                                    <Input
                                      id="ecPhone"
                                      type="tel"
                                      placeholder="+1 555 000 0001"
                                      value={emergencyContactPhone}
                                      onChange={(e) =>
                                        setEmergencyContactPhone(e.target.value)
                                      }
                                      className={`${inputBase} pl-9`}
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="border-t pt-3">
                              <p className="text-sm font-semibold flex items-center gap-2 mb-2 text-foreground">
                                <Shield className="w-4 h-4 text-primary" />
                                Compliance
                              </p>
                              <div className="space-y-3">
                                <div>
                                  <Label
                                    htmlFor="insuranceProvider"
                                    className="text-xs font-medium"
                                  >
                                    Insurance Provider{" "}
                                    <span className="text-muted-foreground font-normal text-xs">
                                      (optional)
                                    </span>
                                  </Label>
                                  <div className="relative mt-1">
                                    <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                                    <Input
                                      id="insuranceProvider"
                                      type="text"
                                      placeholder="e.g. AXA, Allianz, Zurich"
                                      value={insuranceProvider}
                                      onChange={(e) =>
                                        setInsuranceProvider(e.target.value)
                                      }
                                      className={`${inputBase} pl-9`}
                                    />
                                  </div>
                                </div>
                                <div>
                                  <Label
                                    htmlFor="opLicenseNumber"
                                    className="text-xs font-medium"
                                  >
                                    Operating License Number{" "}
                                    <span className="text-muted-foreground font-normal text-xs">
                                      (optional)
                                    </span>
                                  </Label>
                                  <div className="relative mt-1">
                                    <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                                    <Input
                                      id="opLicenseNumber"
                                      type="text"
                                      placeholder="OL-123456"
                                      value={operatingLicenseNumber}
                                      onChange={(e) =>
                                        setOperatingLicenseNumber(e.target.value)
                                      }
                                      className={`${inputBase} pl-9`}
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* ── Step 5: Documents ────────────────────────────── */}
                        {companyStep === 5 && (
                          <div className="space-y-4">
                            <div className="flex items-center justify-between p-3 rounded-xl border border-border/50 bg-muted/20">
                              <div>
                                <p className="text-sm font-semibold">
                                  Active Insurance{" "}
                                  <span className="text-destructive">*</span>
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  Does your company currently have active
                                  insurance?
                                </p>
                              </div>
                              <Switch
                                checked={hasInsurance}
                                onCheckedChange={setHasInsurance}
                              />
                            </div>

                            <FileUploadField
                              id="opLicense"
                              label="Operating License"
                              accept=".pdf,image/*"
                              file={operatingLicenseFile}
                              url={operatingLicenseUrl}
                              uploading={operatingLicenseUploading}
                              onChange={handleOperatingLicenseChange}
                            />

                            <FileUploadField
                              id="cacCert"
                              label="CAC Certificate"
                              accept=".pdf,image/*"
                              file={cacCertFile}
                              url={cacCertUrl}
                              uploading={cacCertUploading}
                              onChange={handleCacCertChange}
                            />
                          </div>
                        )}

                        {/* ── Step 6: Account ──────────────────────────────── */}
                        {companyStep === 6 && (
                          <div className="space-y-3">
                            <div className="p-3 bg-primary/5 border border-primary/15 rounded-xl text-xs text-muted-foreground leading-relaxed">
                              Create the login credentials for your company
                              account.
                            </div>
                            <div>
                              <Label
                                htmlFor="email"
                                className="text-xs font-medium"
                              >
                                Email{" "}
                                <span className="text-destructive">*</span>
                              </Label>
                              <div className="relative mt-1">
                                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                                <Input
                                  id="email"
                                  type="email"
                                  placeholder="you@company.com"
                                  value={email}
                                  onChange={(e) => setEmail(e.target.value)}
                                  className={`${inputBase} pl-10`}
                                  autoComplete="email"
                                />
                              </div>
                            </div>
                            <div>
                              <Label
                                htmlFor="password"
                                className="text-xs font-medium"
                              >
                                Password{" "}
                                <span className="text-destructive">*</span>
                              </Label>
                              <div className="relative mt-1">
                                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                                <Input
                                  id="password"
                                  type={showPassword ? "text" : "password"}
                                  placeholder="••••••••"
                                  value={password}
                                  onChange={(e) => setPassword(e.target.value)}
                                  className={`${inputBase} pl-10 pr-11`}
                                  autoComplete="new-password"
                                  minLength={6}
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowPassword(!showPassword)}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                >
                                  {showPassword ? (
                                    <EyeOff className="w-4 h-4" />
                                  ) : (
                                    <Eye className="w-4 h-4" />
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Step navigation */}
                        <div
                          className={`flex gap-3 mt-4 ${companyStep === 1 ? "justify-end" : ""}`}
                        >
                          {companyStep > 1 && (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setCompanyStep((s) => s - 1)}
                              className="h-8 rounded-xl text-sm font-semibold flex items-center gap-1.5"
                            >
                              <ChevronLeft className="w-4 h-4" /> Back
                            </Button>
                          )}
                          {companyStep < 6 ? (
                            <Button
                              type="button"
                              onClick={handleCompanyNext}
                              className="flex-1 h-8 rounded-xl text-sm font-semibold shadow-md shadow-primary/20 flex items-center justify-center gap-1.5"
                            >
                              Next <ChevronRight className="w-4 h-4" />
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              onClick={handleCompanySubmit}
                              className="flex-1 h-8 rounded-xl text-sm font-semibold shadow-md shadow-primary/20"
                              disabled={
                                isLoading ||
                                operatingLicenseUploading ||
                                cacCertUploading
                              }
                            >
                              {isLoading ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                  Setting up…
                                </>
                              ) : (
                                "Submit Application"
                              )}
                            </Button>
                          )}
                        </div>

                        <p className="text-center text-xs text-muted-foreground mt-4 leading-relaxed">
                          Company accounts require admin approval before access
                          is granted.
                        </p>
                        <p className="text-center text-sm text-muted-foreground mt-2">
                          Already have an account?{" "}
                          <button
                            type="button"
                            onClick={() => setMode("login")}
                            className="text-primary font-semibold hover:underline"
                          >
                            Sign in
                          </button>
                        </p>
                      </div>
                    ) : (
                      /* ── Regular form: customer / self-driver / company driver */
                      <>
                        <form
                          onSubmit={
                            mode === "login" ? handleLogin : handleRegister
                          }
                          className="space-y-3"
                          autoComplete="on"
                        >
                          {/* Self driver name + phone */}
                          {mode === "register" &&
                            role === "driver" &&
                            driverType === "self" && (
                              <>
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <Label
                                      htmlFor="firstName"
                                      className="text-xs font-medium"
                                    >
                                      First Name
                                    </Label>
                                    <div className="relative mt-1">
                                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                                      <Input
                                        id="firstName"
                                        type="text"
                                        placeholder="John"
                                        value={firstName}
                                        onChange={(e) =>
                                          setFirstName(e.target.value)
                                        }
                                        className={`${inputBase} pl-10`}
                                        autoComplete="given-name"
                                        required
                                      />
                                    </div>
                                  </div>
                                  <div>
                                    <Label
                                      htmlFor="lastName"
                                      className="text-xs font-medium"
                                    >
                                      Last Name
                                    </Label>
                                    <div className="relative mt-1">
                                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                                      <Input
                                        id="lastName"
                                        type="text"
                                        placeholder="Doe"
                                        value={lastName}
                                        onChange={(e) =>
                                          setLastName(e.target.value)
                                        }
                                        className={`${inputBase} pl-10`}
                                        autoComplete="family-name"
                                        required
                                      />
                                    </div>
                                  </div>
                                </div>
                                <div>
                                  <Label
                                    htmlFor="phone"
                                    className="text-xs font-medium"
                                  >
                                    Phone Number
                                  </Label>
                                  <div className="relative mt-1">
                                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                                    <Input
                                      id="phone"
                                      type="tel"
                                      placeholder="+1 555 000 0000"
                                      value={phone}
                                      onChange={(e) => setPhone(e.target.value)}
                                      className={`${inputBase} pl-10`}
                                      autoComplete="tel"
                                      required
                                    />
                                  </div>
                                </div>
                              </>
                            )}

                          {/* Company driver info banner */}
                          {mode === "register" &&
                            role === "driver" &&
                            driverType === "company" && (
                              <div className="p-3 bg-primary/5 border border-primary/15 rounded-xl">
                                <p className="text-xs font-semibold text-foreground mb-0.5">
                                  Enter your company-provided email
                                </p>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                  Use the email your company registered you
                                  with, then set a password to activate your
                                  account.
                                </p>
                              </div>
                            )}

                          {/* Customer name + phone */}
                          {mode === "register" && role === "customer" && (
                            <>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <Label
                                    htmlFor="firstName"
                                    className="text-xs font-medium"
                                  >
                                    First Name
                                  </Label>
                                  <div className="relative mt-1">
                                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                                    <Input
                                      id="firstName"
                                      type="text"
                                      placeholder="John"
                                      value={firstName}
                                      onChange={(e) =>
                                        setFirstName(e.target.value)
                                      }
                                      className={`${inputBase} pl-10`}
                                      autoComplete="given-name"
                                      required
                                    />
                                  </div>
                                </div>
                                <div>
                                  <Label
                                    htmlFor="lastName"
                                    className="text-xs font-medium"
                                  >
                                    Last Name
                                  </Label>
                                  <div className="relative mt-1">
                                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                                    <Input
                                      id="lastName"
                                      type="text"
                                      placeholder="Doe"
                                      value={lastName}
                                      onChange={(e) =>
                                        setLastName(e.target.value)
                                      }
                                      className={`${inputBase} pl-10`}
                                      autoComplete="family-name"
                                      required
                                    />
                                  </div>
                                </div>
                              </div>
                              <div>
                                <Label
                                  htmlFor="phone"
                                  className="text-xs font-medium"
                                >
                                  Phone Number
                                </Label>
                                <div className="relative mt-1">
                                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                                  <Input
                                    id="phone"
                                    type="tel"
                                    placeholder="+1 555 000 0000"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    className={`${inputBase} pl-10`}
                                    autoComplete="tel"
                                    required
                                  />
                                </div>
                              </div>
                            </>
                          )}

                          {/* Email */}
                          <div>
                            <Label
                              htmlFor="email"
                              className="text-xs font-medium"
                            >
                              Email
                            </Label>
                            <div className="relative mt-1">
                              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                              <Input
                                id="email"
                                type="email"
                                placeholder="you@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className={`${inputBase} pl-10`}
                                autoComplete="email"
                                required
                              />
                            </div>
                          </div>

                          {/* Password */}
                          <div>
                            <div className="flex items-center justify-between">
                              <Label
                                htmlFor="password"
                                className="text-xs font-medium"
                              >
                                Password
                              </Label>
                              {mode === "login" && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setForgotPasswordEmail(email);
                                    setForgotPasswordSent(false);
                                    setForgotPasswordCooldown(0);
                                    setForgotPasswordMode(true);
                                  }}
                                  className="text-xs text-primary font-semibold hover:underline"
                                >
                                  Forgot password?
                                </button>
                              )}
                            </div>
                            <div className="relative mt-1">
                              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                              <Input
                                id="password"
                                type={showPassword ? "text" : "password"}
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className={`${inputBase} pl-10 pr-11`}
                                autoComplete={
                                  mode === "login"
                                    ? "current-password"
                                    : "new-password"
                                }
                                required
                                minLength={6}
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                              >
                                {showPassword ? (
                                  <EyeOff className="w-4 h-4" />
                                ) : (
                                  <Eye className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          </div>

                          <Button
                            type="submit"
                            className="w-full h-9 rounded-xl text-sm font-semibold shadow-md shadow-primary/20"
                            disabled={isLoading}
                          >
                            {isLoading ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                {mode === "login"
                                  ? "Signing in…"
                                  : "Setting up…"}
                              </>
                            ) : mode === "login" ? (
                              "Sign in"
                            ) : role === "driver" &&
                              driverType === "company" ? (
                              "Activate Account"
                            ) : role === "driver" && driverType === "self" ? (
                              "Create Driver Account"
                            ) : (
                              "Create Account"
                            )}
                          </Button>
                        </form>

                        {/* Google sign-in */}
                        {!(
                          mode === "register" &&
                          role === "driver" &&
                          driverType === "company"
                        ) && (
                          <>
                            <div className="relative flex items-center gap-3 my-4">
                              <div className="flex-1 h-px bg-border/50" />
                              <span className="text-xs text-muted-foreground/60 font-medium">
                                or
                              </span>
                              <div className="flex-1 h-px bg-border/50" />
                            </div>
                            <button
                              type="button"
                              onClick={handleGoogleSignIn}
                              disabled={isLoading}
                              className="w-full h-9 flex items-center justify-center gap-2.5 rounded-xl border border-border/60 bg-white hover:bg-muted/30 text-sm font-semibold text-foreground transition-all duration-150 shadow-sm hover:shadow disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <svg
                                width="18"
                                height="18"
                                viewBox="0 0 18 18"
                                aria-hidden="true"
                              >
                                <path
                                  fill="#4285F4"
                                  d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
                                />
                                <path
                                  fill="#34A853"
                                  d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"
                                />
                                <path
                                  fill="#FBBC05"
                                  d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z"
                                />
                                <path
                                  fill="#EA4335"
                                  d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
                                />
                              </svg>
                              Continue with Google
                            </button>
                          </>
                        )}

                        {/* Footer switch links */}
                        {mode === "login" && (
                          <p className="text-center text-xs text-muted-foreground mt-4">
                            Don't have an account?{" "}
                            <button
                              type="button"
                              onClick={() => setMode("register")}
                              className="text-primary font-semibold hover:underline"
                            >
                              Sign up
                            </button>
                          </p>
                        )}
                        {mode === "register" && role !== "company" && (
                          <p className="text-center text-xs text-muted-foreground mt-4">
                            Already have an account?{" "}
                            <button
                              type="button"
                              onClick={() => setMode("login")}
                              className="text-primary font-semibold hover:underline"
                            >
                              Sign in
                            </button>
                          </p>
                        )}
                      </>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

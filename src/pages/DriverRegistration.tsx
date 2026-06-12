import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Input } from "@/components/ui/input";
import { CameraCapture } from "@/components/camera/CameraCapture";
import { toast } from "sonner";
import { auth, db } from "@/integrations/firebase/client";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  Loader2,
  X,
  User,
  Truck,
  Car,
  Package,
  Snowflake,
  Zap,
} from "lucide-react";

type Step = 1 | 2 | 3;

const VEHICLE_SIDES = ["Front", "Back", "Left side", "Right side"] as const;
type VehicleSide = typeof VEHICLE_SIDES[number];

interface FormState {
  firstName: string;
  lastName: string;
  phone: string;
  vehicleType: string;
  brand: string;
  model: string;
  plateNumber: string;
  color: string;
  selfieUrl: string;
  vehiclePhotoUrls: Partial<Record<VehicleSide, string>>;
}

const initial: FormState = {
  firstName: "",
  lastName: "",
  phone: "",
  vehicleType: "cargo_van",
  brand: "",
  model: "",
  plateNumber: "",
  color: "",
  selfieUrl: "",
  vehiclePhotoUrls: {},
};

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

const REG_STORAGE_KEY = "pilnak_driver_registration_state";

interface PersistedRegState {
  step: Step;
  form: FormState;
}

async function uploadToCloudinary(dataUrl: string): Promise<string> {
  const formData = new FormData();
  formData.append("file", dataUrl);
  formData.append("upload_preset", UPLOAD_PRESET);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message ?? "Cloudinary upload failed");
  }

  const data = await res.json();
  return data.secure_url as string;
}

const VEHICLE_OPTIONS = [
  { value: "cargo_van",      label: "Cargo Van",      Icon: Truck,     desc: "Versatile enclosed van" },
  { value: "box_truck",      label: "Box Truck",      Icon: Package,   desc: "Medium-volume freight" },
  { value: "dry_van",        label: "Dry Van",        Icon: Truck,     desc: "Standard enclosed trailer" },
  { value: "flatbed",        label: "Flatbed",        Icon: Truck,     desc: "Open deck, oversized loads" },
  { value: "reefer",         label: "Reefer",         Icon: Snowflake, desc: "Temperature-controlled trailer" },
  { value: "power_only",     label: "Power Only",     Icon: Zap,       desc: "Tractor unit, no trailer" },
  { value: "auto_transport", label: "Auto Transport", Icon: Car,       desc: "Vehicle hauling" },
] as const;

const STEP_META = [
  { label: "Personal Info", desc: "Your basic details" },
  { label: "Vehicle Info", desc: "Vehicle details" },
  { label: "Photos", desc: "Identity & vehicle photos" },
] as const;

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
      {children}
    </p>
  );
}

function StyledInput({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <Input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="h-11 bg-gray-50 border-gray-200 text-sm font-medium text-gray-800 placeholder:text-gray-300 focus-visible:ring-[#028538]/30 focus-visible:border-[#028538]"
    />
  );
}

export default function DriverRegistration() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(() => {
    try {
      const raw = sessionStorage.getItem(REG_STORAGE_KEY);
      if (raw) return (JSON.parse(raw) as PersistedRegState).step ?? 1;
    } catch {}
    return 1;
  });
  const [form, setForm] = useState<FormState>(() => {
    try {
      const raw = sessionStorage.getItem(REG_STORAGE_KEY);
      if (raw) return (JSON.parse(raw) as PersistedRegState).form ?? initial;
    } catch {}
    return initial;
  });
  const [uid, setUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  type CameraTarget = "selfie" | VehicleSide | null;
  const [cameraTarget, setCameraTarget] = useState<CameraTarget>(null);
  const [uploadingTarget, setUploadingTarget] = useState<CameraTarget>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { navigate("/auth?role=driver"); return; }
      setUid(u.uid);
      const snap = await getDoc(doc(db, "users", u.uid));
      const user = snap.exists() ? (snap.data() as Record<string, string>) : null;
      setForm((prev) => ({
        ...prev,
        firstName: user?.firstName ?? prev.firstName,
        lastName: user?.lastName ?? prev.lastName,
        phone: user?.phone ?? prev.phone,
      }));
    });
    return () => unsub();
  }, [navigate]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  useEffect(() => {
    if (step === 1 && !form.firstName && !form.lastName) {
      try { sessionStorage.removeItem(REG_STORAGE_KEY); } catch {}
      return;
    }
    try { sessionStorage.setItem(REG_STORAGE_KEY, JSON.stringify({ step, form })); } catch {}
  }, [step, form]);

  const handleCameraCapture = async (dataUrl: string) => {
    const target = cameraTarget;
    setCameraTarget(null);
    if (!target) return;

    setUploadingTarget(target);
    try {
      const url = await uploadToCloudinary(dataUrl);
      if (target === "selfie") {
        setForm((prev) => ({ ...prev, selfieUrl: url }));
        toast.success("Selfie uploaded");
      } else {
        const side = target as VehicleSide;
        setForm((prev) => ({
          ...prev,
          vehiclePhotoUrls: { ...prev.vehiclePhotoUrls, [side]: url },
        }));
        toast.success(`${side} photo uploaded`);
      }
    } catch (e) {
      console.error(e);
      toast.error("Upload failed. Please try again.");
    } finally {
      setUploadingTarget(null);
    }
  };

  const nextDisabled =
    (step === 1 && (!form.firstName || !form.lastName || !form.phone)) ||
    (step === 2 && (!form.vehicleType || !form.plateNumber));

  const allVehiclePhotosDone = VEHICLE_SIDES.every((s) => !!form.vehiclePhotoUrls[s]);

  const submitDisabled =
    !uid || !form.firstName || !form.lastName || !form.phone ||
    !form.vehicleType || !form.plateNumber ||
    !form.selfieUrl || !allVehiclePhotosDone || loading;

  const handleSubmit = async () => {
    if (!uid) return;
    setLoading(true);
    try {
      await setDoc(doc(db, "users", uid), {
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone,
        role: "driver",
        updatedAt: serverTimestamp(),
      }, { merge: true });

      await setDoc(doc(db, "drivers", uid), {
        userId: uid,
        status: "pending_verification",
        isOnline: false,
        driverType: "self",
        driverCategory: form.vehicleType,
        selfieUrl: form.selfieUrl,
        vehiclePhotoUrls: form.vehiclePhotoUrls,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });

      await setDoc(doc(db, "vehicles", uid), {
        driverId: uid,
        vehicleType: form.vehicleType,
        brand: form.brand,
        model: form.model,
        plateNumber: form.plateNumber,
        color: form.color,
        photoUrls: form.vehiclePhotoUrls,
        createdAt: serverTimestamp(),
      }, { merge: true });

      toast.success("Registration submitted for verification");
      try { sessionStorage.removeItem(REG_STORAGE_KEY); } catch {}
      navigate("/driver-pending", { replace: true });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to submit registration");
    } finally {
      setLoading(false);
    }
  };

  if (cameraTarget !== null) {
    return (
      <CameraCapture
        title={cameraTarget === "selfie" ? "Take Selfie" : `Vehicle — ${cameraTarget}`}
        facingMode={cameraTarget === "selfie" ? "user" : "environment"}
        onCapture={handleCameraCapture}
        onCancel={() => setCameraTarget(null)}
      />
    );
  }

  const photosCompletedCount = [
    form.selfieUrl ? 1 : 0,
    ...VEHICLE_SIDES.map((s) => (form.vehiclePhotoUrls[s] ? 1 : 0)),
  ].reduce((a: number, b: number) => a + b, 0);

  return (
    <div className="min-h-[100dvh] bg-[#F5F7F5]">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40 pt-safe shadow-sm">
        <div className="container mx-auto px-4 lg:px-8 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => step === 1 ? navigate("/driver") : setStep((s) => (s - 1) as Step)}
              className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
            >
              <ArrowLeft className="w-4 h-4 text-gray-500" />
            </button>
            <Logo />
          </div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center">
              <Truck className="w-3.5 h-3.5 text-[#028538]" />
            </div>
            <span className="text-xs font-bold text-gray-500 hidden sm:inline">Driver Registration</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 lg:px-8 py-6 max-w-xl space-y-4">

        {/* Step tracker */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-0">
            {STEP_META.map((meta, i) => {
              const n = (i + 1) as Step;
              const done = step > n;
              const active = step === n;
              return (
                <div key={n} className="flex items-center flex-1 min-w-0">
                  <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                        done
                          ? "bg-[#028538] text-white shadow-sm shadow-[#028538]/20"
                          : active
                          ? "bg-white border-2 border-[#028538] text-[#028538]"
                          : "bg-gray-100 text-gray-400"
                      }`}
                    >
                      {done ? <Check className="w-3.5 h-3.5" /> : n}
                    </div>
                    <div className="text-center">
                      <p className={`text-[9px] font-bold uppercase tracking-widest ${active ? "text-[#028538]" : done ? "text-gray-500" : "text-gray-300"}`}>
                        {meta.label}
                      </p>
                    </div>
                  </div>
                  {i < STEP_META.length - 1 && (
                    <div className={`flex-1 h-px mx-2 mb-4 ${done ? "bg-[#028538]" : "bg-gray-200"}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Step heading */}
        <div className="px-1">
          <p className="text-[9px] font-bold text-[#028538] uppercase tracking-widest">Step {step} of 3</p>
          <h1 className="text-lg font-bold text-gray-900 mt-0.5">{STEP_META[step - 1].label}</h1>
          <p className="text-xs text-gray-400 mt-0.5">{STEP_META[step - 1].desc}</p>
        </div>

        {/* ── Step 1: Personal Info ── */}
        {step === 1 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-gray-50">
              <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center">
                <User className="w-4 h-4 text-[#028538]" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-800">Personal Details</p>
                <p className="text-[10px] text-gray-400">Fill in your name and contact info</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <FieldLabel>First name</FieldLabel>
                <StyledInput
                  value={form.firstName}
                  onChange={(v) => setForm({ ...form, firstName: v })}
                  placeholder="e.g. Chukwuemeka"
                />
              </div>
              <div>
                <FieldLabel>Last name</FieldLabel>
                <StyledInput
                  value={form.lastName}
                  onChange={(v) => setForm({ ...form, lastName: v })}
                  placeholder="e.g. Adeyemi"
                />
              </div>
            </div>

            <div>
              <FieldLabel>Phone number</FieldLabel>
              <StyledInput
                value={form.phone}
                onChange={(v) => setForm({ ...form, phone: v })}
                placeholder="e.g. 08012345678"
                type="tel"
              />
            </div>
          </div>
        )}

        {/* ── Step 2: Vehicle Info ── */}
        {step === 2 && (
          <div className="space-y-4">
            {/* Vehicle type picker */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-gray-50">
                <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center">
                  <Truck className="w-4 h-4 text-[#028538]" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-800">Vehicle Category</p>
                  <p className="text-[10px] text-gray-400">Select the type of vehicle you drive</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {VEHICLE_OPTIONS.map(({ value, label, Icon, desc }) => {
                  const selected = form.vehicleType === value;
                  return (
                    <button
                      key={value}
                      onClick={() => setForm({ ...form, vehicleType: value })}
                      className={`relative flex flex-col items-start gap-2 p-3.5 rounded-xl border-2 text-left transition-all ${
                        selected
                          ? "border-[#028538] bg-green-50 shadow-sm shadow-[#028538]/10"
                          : "border-gray-100 bg-gray-50 hover:border-gray-200"
                      }`}
                    >
                      {selected && (
                        <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-[#028538] flex items-center justify-center">
                          <Check className="w-2.5 h-2.5 text-white" />
                        </span>
                      )}
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${selected ? "bg-[#028538]" : "bg-gray-200"}`}>
                        <Icon className={`w-4 h-4 ${selected ? "text-white" : "text-gray-400"}`} />
                      </div>
                      <div>
                        <p className={`text-sm font-bold ${selected ? "text-[#028538]" : "text-gray-700"}`}>{label}</p>
                        <p className="text-[10px] text-gray-400 leading-tight">{desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Vehicle details */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Vehicle Details</p>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel>Brand / Make</FieldLabel>
                  <StyledInput
                    value={form.brand}
                    onChange={(v) => setForm({ ...form, brand: v })}
                    placeholder="e.g. Toyota"
                  />
                </div>
                <div>
                  <FieldLabel>Model</FieldLabel>
                  <StyledInput
                    value={form.model}
                    onChange={(v) => setForm({ ...form, model: v })}
                    placeholder="e.g. Corolla"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel>Plate number <span className="text-red-400">*</span></FieldLabel>
                  <StyledInput
                    value={form.plateNumber}
                    onChange={(v) => setForm({ ...form, plateNumber: v })}
                    placeholder="e.g. LSD 123 AB"
                  />
                </div>
                <div>
                  <FieldLabel>Color</FieldLabel>
                  <StyledInput
                    value={form.color}
                    onChange={(v) => setForm({ ...form, color: v })}
                    placeholder="e.g. Silver"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 3: Photos ── */}
        {step === 3 && (
          <div className="space-y-4">

            {/* Selfie */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center">
                    <User className="w-4 h-4 text-[#028538]" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-800">Selfie Photo</p>
                    <p className="text-[10px] text-gray-400">Clear face photo for identity verification</p>
                  </div>
                </div>
                <button
                  onClick={() => setCameraTarget("selfie")}
                  disabled={uploadingTarget === "selfie"}
                  className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl transition-all ${
                    form.selfieUrl
                      ? "bg-gray-100 text-gray-500 hover:bg-gray-200"
                      : "bg-[#028538] text-white shadow-sm shadow-[#028538]/20"
                  }`}
                >
                  {uploadingTarget === "selfie" ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" />Uploading…</>
                  ) : (
                    <><Camera className="w-3.5 h-3.5" />{form.selfieUrl ? "Retake" : "Capture"}</>
                  )}
                </button>
              </div>

              {form.selfieUrl ? (
                <div className="relative">
                  <img src={form.selfieUrl} alt="Selfie" className="w-full h-52 object-cover" />
                  <div className="absolute top-3 right-3">
                    <span className="flex items-center gap-1 bg-[#028538] text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow">
                      <Check className="w-3 h-3" /> Captured
                    </span>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setCameraTarget("selfie")}
                  className="w-full py-10 flex flex-col items-center gap-2.5 text-gray-400 hover:bg-gray-50 transition-colors"
                >
                  <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center">
                    <Camera className="w-7 h-7 text-gray-300" />
                  </div>
                  <p className="text-xs font-semibold">Tap to open camera</p>
                </button>
              )}
            </div>

            {/* Vehicle photos */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center">
                    <Truck className="w-4 h-4 text-[#028538]" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-800">Vehicle Photos</p>
                    <p className="text-[10px] text-gray-400">All four sides required</p>
                  </div>
                </div>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                  allVehiclePhotosDone
                    ? "bg-green-100 text-[#028538]"
                    : "bg-gray-100 text-gray-500"
                }`}>
                  {VEHICLE_SIDES.filter((s) => form.vehiclePhotoUrls[s]).length}/4
                </span>
              </div>

              <div className="p-4 grid grid-cols-2 gap-3">
                {VEHICLE_SIDES.map((side) => {
                  const url = form.vehiclePhotoUrls[side];
                  const isUploading = uploadingTarget === side;
                  return (
                    <div key={side} className="space-y-1.5">
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{side}</p>
                      {url ? (
                        <div className="relative rounded-xl overflow-hidden border border-gray-100">
                          <img src={url} alt={side} className="w-full h-28 object-cover" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                            <button
                              onClick={() => setCameraTarget(side)}
                              className="flex items-center gap-1.5 bg-white text-gray-700 text-xs font-bold px-3 py-1.5 rounded-full shadow"
                            >
                              <Camera className="w-3 h-3" />
                              Retake
                            </button>
                          </div>
                          <div className="absolute top-1.5 right-1.5">
                            <span className="w-5 h-5 bg-[#028538] rounded-full flex items-center justify-center shadow">
                              <Check className="w-3 h-3 text-white" />
                            </span>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setCameraTarget(side)}
                          disabled={isUploading}
                          className="w-full h-28 rounded-xl border-2 border-dashed border-gray-200 hover:border-[#028538] hover:bg-green-50/50 transition-colors flex flex-col items-center justify-center gap-1.5 text-gray-400"
                        >
                          {isUploading ? (
                            <><Loader2 className="w-5 h-5 animate-spin" /><span className="text-[10px] font-semibold">Uploading…</span></>
                          ) : (
                            <><Camera className="w-5 h-5 text-gray-300" /><span className="text-[10px] font-semibold">Tap to capture</span></>
                          )}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Submission checklist */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-3">Submission Checklist</p>
              <div className="space-y-2">
                {[
                  { label: "Selfie photo", done: !!form.selfieUrl },
                  ...VEHICLE_SIDES.map((s) => ({ label: `Vehicle — ${s}`, done: !!form.vehiclePhotoUrls[s] })),
                ].map(({ label, done }) => (
                  <div key={label} className="flex items-center gap-2.5">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${done ? "bg-[#028538]" : "bg-gray-100"}`}>
                      {done
                        ? <Check className="w-3 h-3 text-white" />
                        : <X className="w-3 h-3 text-gray-300" />
                      }
                    </div>
                    <span className={`text-xs font-semibold ${done ? "text-gray-700" : "text-gray-400"}`}>{label}</span>
                  </div>
                ))}
              </div>

              {photosCompletedCount === 5 && (
                <div className="mt-3 pt-3 border-t border-gray-50 flex items-center gap-2 text-[#028538]">
                  <Check className="w-4 h-4" />
                  <p className="text-xs font-bold">All photos ready — you can submit!</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between gap-3 pb-8">
          <button
            onClick={() => step === 1 ? navigate("/driver") : setStep((s) => (s - 1) as Step)}
            className="flex items-center gap-2 bg-white border border-gray-200 text-gray-600 text-sm font-bold px-5 py-3 rounded-xl shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          {step < 3 ? (
            <button
              onClick={() => setStep((s) => (s + 1) as Step)}
              disabled={nextDisabled}
              className="flex items-center gap-2 bg-[#028538] text-white text-sm font-bold px-6 py-3 rounded-xl shadow-sm shadow-[#028538]/20 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Continue
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitDisabled}
              className="flex items-center gap-2 bg-[#028538] text-white text-sm font-bold px-6 py-3 rounded-xl shadow-sm shadow-[#028538]/20 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Submitting…</>
              ) : (
                <><Check className="w-4 h-4" />Submit Application</>
              )}
            </button>
          )}
        </div>
      </main>
    </div>
  );
}

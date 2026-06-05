import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/integrations/firebase/client";

function stripUndefined<T extends Record<string, unknown>>(data: T): T {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined)
  ) as T;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CompanyDoc {
  userId: string;
  companyName: string;
  email: string;
  companyAddress?: string;
  companyPhone?: string;
  companyRegNumber?: string;
  companyWebsite?: string | null;
  contactPersonName?: string;
  contactPersonPhone?: string;
  approvalStatus: "pending" | "approved" | "rejected" | "suspended";
  approvedAt?: unknown;
  approvedBy?: string;
  walletBalance: number;
  totalDeliveries: number;
  createdAt?: unknown;
}

export type CompanyDriverStatus = "active" | "inactive" | "suspended";

export interface CompanyDriver {
  id?: string;
  companyId: string;

  // Basic
  name: string;
  email: string;
  phone: string;
  alternatePhone?: string;

  // Personal info
  dateOfBirth?: string;
  gender?: "male" | "female" | "other";
  homeAddress?: string;
  stateOfOrigin?: string;
  nationality?: string;

  // Professional
  licenseNumber: string;
  licenseExpiry?: string;
  yearsOfExperience?: number;
  vehicleTypeExpertise?: string;

  // ID
  governmentIdType?: "drivers_license" | "national_id" | "passport" | "voters_card";
  governmentIdNumber?: string;

  // Media
  passportPhotoUrl?: string | null;

  // Status & ops
  status: CompanyDriverStatus;
  isOnline: boolean;
  currentLatitude?: number | null;
  currentLongitude?: number | null;
  locationUpdatedAt?: unknown;
  assignedVehicleId?: string | null;
  assignedVehiclePlate?: string | null;
  assignedVehicleBrand?: string | null;

  // Company driver flags
  isCompanyDriver?: boolean;
  authLinked?: boolean;
  uid?: string | null;

  // Stats
  totalDeliveries: number;
  rating: number;

  createdAt?: unknown;
  updatedAt?: unknown;
}

export type FleetStatus = "available" | "in_use" | "maintenance" | "retired";

export interface FleetVehicle {
  id?: string;
  companyId: string;

  // Core (required)
  brand: string;
  model: string;
  plateNumber: string;
  vehicleType: string;
  color: string;
  year: number;
  engineNumber?: string;
  chassisNumber?: string;
  fuelType?: "petrol" | "diesel" | "electric" | "hybrid" | "gas";
  transmission?: "manual" | "automatic";
  seatingCapacity?: number;
  maxLoadKg?: number;

  // Documents
  insuranceNumber?: string;
  insuranceExpiry?: string;
  roadWorthinessExpiry?: string;

  // Images (Cloudinary URLs)
  imageFront?: string | null;
  imageLeft?: string | null;
  imageRight?: string | null;
  imageBack?: string | null;

  // Assignment
  status: FleetStatus;
  assignedDriverId?: string | null;
  assignedDriverName?: string | null;

  createdAt?: unknown;
  updatedAt?: unknown;
}

export type BookingStatus =
  | "pending"
  | "assigned"
  | "in_progress"
  | "completed"
  | "cancelled";

export interface CompanyBooking {
  id?: string;
  companyId: string;
  customerName: string;
  customerPhone?: string;
  pickup: string;
  dropoff: string;
  driverId?: string | null;
  driverName?: string | null;
  vehicleId?: string | null;
  status: BookingStatus;
  itemDescription?: string;
  itemWeight?: string;
  estimatedPrice?: number | null;
  finalPrice?: number | null;
  notes?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CompanyDelivery {
  id?: string;
  companyId: string;
  bookingId?: string | null;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  driverId?: string | null;
  driverName?: string | null;
  vehicleId?: string | null;
  pickup: string;
  dropoff: string;
  status: BookingStatus;
  itemDescription?: string;
  itemWeight?: string;
  finalPrice?: number | null;
  proofUrl?: string | null;
  paymentProofUrl?: string | null;
  completedAt?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
}

// ─── Cloudinary Upload ────────────────────────────────────────────────────────

export async function uploadToCloudinary(
  file: File,
  folder = "fleet"
): Promise<string> {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    throw new Error("Cloudinary env vars missing: VITE_CLOUDINARY_CLOUD_NAME / VITE_CLOUDINARY_UPLOAD_PRESET");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", uploadPreset);
  formData.append("folder", folder);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    { method: "POST", body: formData }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any)?.error?.message ?? "Cloudinary upload failed");
  }

  const data = await res.json();
  return data.secure_url as string;
}

// ─── Company ──────────────────────────────────────────────────────────────────

export async function getCompanyDoc(companyId: string): Promise<CompanyDoc | null> {
  const snap = await getDoc(doc(db, "companies", companyId));
  return snap.exists() ? (snap.data() as CompanyDoc) : null;
}

export function listenCompany(
  companyId: string,
  cb: (data: CompanyDoc | null) => void
): Unsubscribe {
  return onSnapshot(doc(db, "companies", companyId), (snap) => {
    cb(snap.exists() ? (snap.data() as CompanyDoc) : null);
  });
}

export async function updateCompanyProfile(
  companyId: string,
  data: Partial<Pick<CompanyDoc, "companyPhone" | "companyAddress" | "companyWebsite" | "contactPersonName" | "contactPersonPhone">>
): Promise<void> {
  await updateDoc(doc(db, "companies", companyId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

// ─── Drivers ──────────────────────────────────────────────────────────────────

export function listenCompanyDrivers(
  companyId: string,
  cb: (drivers: Array<CompanyDriver & { id: string }>) => void
): Unsubscribe {
  const q = query(
    collection(db, "drivers"),
    where("companyId", "==", companyId),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as CompanyDriver) })));
  });
}

export async function createCompanyDriver(
  data: Omit<CompanyDriver, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  const ref = await addDoc(
    collection(db, "drivers"),
    stripUndefined({
      ...data,
      // These two flags are what Auth.tsx queries to detect company-pre-created drivers
      isCompanyDriver: true,
      authLinked: false,
      uid: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  );
  return ref.id;
}

export async function updateCompanyDriver(
  driverId: string,
  data: Partial<Omit<CompanyDriver, "id" | "companyId" | "createdAt">>
): Promise<void> {
  await updateDoc(
    doc(db, "drivers", driverId),
    stripUndefined({
      ...data,
      updatedAt: serverTimestamp(),
    })
  );
}

export async function deleteCompanyDriver(driverId: string): Promise<void> {
  await deleteDoc(doc(db, "drivers", driverId));
}

// ─── Fleet ────────────────────────────────────────────────────────────────────

export function listenCompanyFleet(
  companyId: string,
  cb: (fleet: Array<FleetVehicle & { id: string }>) => void
): Unsubscribe {
  const q = query(
    collection(db, "vehicles"),
    where("companyId", "==", companyId),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as FleetVehicle) })));
  });
}

export async function createFleetVehicle(
  data: Omit<FleetVehicle, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  const ref = await addDoc(collection(db, "vehicles"), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateFleetVehicle(
  vehicleId: string,
  data: Partial<Omit<FleetVehicle, "id" | "companyId" | "createdAt">>
): Promise<void> {
  await updateDoc(doc(db, "vehicles", vehicleId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteFleetVehicle(vehicleId: string): Promise<void> {
  await deleteDoc(doc(db, "vehicles", vehicleId));
}

export async function assignDriverToVehicle(
  vehicleId: string,
  driverId: string | null,
  driverName: string | null,
  vehicle?: FleetVehicle & { id: string }
): Promise<void> {
  // If assigning a driver, first clear any previous vehicle assignment for that driver
  if (driverId) {
    const driverSnap = await getDoc(doc(db, "drivers", driverId));
    const prevVehicleId = driverSnap.exists()
      ? (driverSnap.data() as any).assignedVehicleId
      : null;
    if (prevVehicleId && prevVehicleId !== vehicleId) {
      await updateDoc(doc(db, "vehicles", prevVehicleId), {
        assignedDriverId: null,
        assignedDriverName: null,
        status: "available",
        updatedAt: serverTimestamp(),
      });
    }
  }

  await updateDoc(doc(db, "vehicles", vehicleId), {
    assignedDriverId: driverId,
    assignedDriverName: driverName,
    status: driverId ? "in_use" : "available",
    updatedAt: serverTimestamp(),
  });

  if (driverId) {
    await updateDoc(doc(db, "drivers", driverId), {
      assignedVehicleId: vehicleId,
      assignedVehiclePlate: vehicle?.plateNumber ?? null,
      assignedVehicleBrand: vehicle ? `${vehicle.brand} ${vehicle.model}` : null,
      updatedAt: serverTimestamp(),
    });
  }
}

export async function unassignDriverFromVehicle(
  vehicleId: string,
  previousDriverId: string | null
): Promise<void> {
  await updateDoc(doc(db, "vehicles", vehicleId), {
    assignedDriverId: null,
    assignedDriverName: null,
    status: "available",
    updatedAt: serverTimestamp(),
  });

  if (previousDriverId) {
    await updateDoc(doc(db, "drivers", previousDriverId), {
      assignedVehicleId: null,
      assignedVehiclePlate: null,
      assignedVehicleBrand: null,
      updatedAt: serverTimestamp(),
    });
  }
}

// ─── Bookings ─────────────────────────────────────────────────────────────────

export function listenCompanyBookings(
  companyId: string,
  cb: (bookings: Array<CompanyBooking & { id: string }>) => void
): Unsubscribe {
  const q = query(
    collection(db, "bookings"),
    where("companyId", "==", companyId),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as CompanyBooking) })));
  });
}

export async function createBooking(
  data: Omit<CompanyBooking, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  const ref = await addDoc(collection(db, "bookings"), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateBooking(
  bookingId: string,
  data: Partial<Omit<CompanyBooking, "id" | "companyId" | "createdAt">>
): Promise<void> {
  await updateDoc(doc(db, "bookings", bookingId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteBooking(bookingId: string): Promise<void> {
  await deleteDoc(doc(db, "bookings", bookingId));
}

// ─── Deliveries ───────────────────────────────────────────────────────────────

export function listenCompanyDeliveries(
  companyId: string,
  cb: (deliveries: Array<CompanyDelivery & { id: string }>) => void
): Unsubscribe {
  const q = query(
    collection(db, "deliveries"),
    where("companyId", "==", companyId),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as CompanyDelivery) })));
  });
}

export async function createDelivery(
  data: Omit<CompanyDelivery, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  const ref = await addDoc(collection(db, "deliveries"), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateDelivery(
  deliveryId: string,
  data: Partial<Omit<CompanyDelivery, "id" | "companyId" | "createdAt">>
): Promise<void> {
  await updateDoc(doc(db, "deliveries", deliveryId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteDelivery(deliveryId: string): Promise<void> {
  await deleteDoc(doc(db, "deliveries", deliveryId));
}

// ─── History (completed deliveries) ──────────────────────────────────────────

export function listenCompanyHistory(
  companyId: string,
  cb: (history: Array<CompanyDelivery & { id: string }>) => void
): Unsubscribe {
  const q = query(
    collection(db, "deliveries"),
    where("companyId", "==", companyId),
    where("status", "==", "completed"),
    orderBy("completedAt", "desc")
  );
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as CompanyDelivery) })));
  });
}
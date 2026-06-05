import {
  addDoc,
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { auth, db } from "@/integrations/firebase/client";

export type AppRole = "admin" | "customer" | "driver";

export type DeliveryStatus =
  | "pending"
  | "admin_review"
  | "negotiating_price"
  | "price_set"
  | "payment_pending"
  | "customer_confirmed"
  | "driver_assigned"
  | "driver_accepted"
  | "in_progress"
  | "arrived"
  | "awaiting_signature"
  | "completed"
  | "cancelled";

export interface UserDoc {
  role: AppRole;
  firstName: string;
  lastName: string;
  phone?: string;
  email: string;
  createdAt?: unknown;
}

export interface DriverDoc {
  userId: string;
  status: "pending_verification" | "approved" | "suspended" | "rejected";
  isOnline: boolean;
  driverType?: string;
  currentLocation?: { lat: number; lng: number; updatedAt?: unknown };
  currentLatitude?: number | null;
  currentLongitude?: number | null;
  locationUpdatedAt?: unknown;
  isCompanyDriver?: boolean;
  assignedVehicleId?: string | null;
  assignedVehiclePlate?: string | null;
  assignedVehicleBrand?: string | null;
  selfieUrl?: string;
  averageRating?: number;
  totalDeliveries?: number;
  totalEarnings?: number;
  createdAt?: unknown;
}

export interface VehicleDoc {
  driverId: string;
  vehicleType: string;
  brand?: string;
  model?: string;
  plateNumber: string;
  color?: string;
  createdAt?: unknown;
}

export interface PaymentDetails {
  bankName: string;
  accountNumber: string;
  accountName: string;
}

export interface DeliveryRating {
  rating: number;
  feedback?: string;
  timestamp: unknown;
}

export interface ProofMeta {
  url: string;
  uploadedAt: unknown;
  lat?: number | null;
  lng?: number | null;
  locked: boolean;
}

export interface DeliveryRequestDoc {
  customerId: string;
  pickup: { address: string; lat: number; lng: number };
  dropoff: { address: string; lat: number; lng: number };
  transportType: string;
  status: DeliveryStatus;
  driverType?: string | null;
  estimatedPrice?: number | null;
  finalPrice?: number | null;
  quotedPrice?: number | null;
  quotedAt?: unknown;
  quotedBy?: string | null;
  quoteNote?: string | null;
  negotiationRequested?: boolean;
  negotiationRequestedAt?: unknown;
  negotiatedPrice?: number | null;
  paymentDetails?: PaymentDetails | null;
  paymentDetailsSetAt?: unknown;
  paymentSentAt?: unknown;
  /** URL of the bank transfer receipt uploaded by the customer */
  paymentProofUrl?: string | null;
  paymentConfirmedAt?: unknown;
  paymentConfirmedBy?: string | null;
  proof?: ProofMeta | null;
  deliveryProofUrl?: string | null;
  deliveryProofUploadedAt?: unknown;
  driverArrivedAt?: unknown;
  itemDescription?: string | null;
  itemWeight?: string | null;
  itemSize?: string | null;
  packagePhotoUrl?: string | null;
  isScheduled?: boolean;
  scheduledTime?: string | null;
  rating?: DeliveryRating | null;
  signatureRequestSentAt?: unknown | null;
  customerSignatureUrl?: string | null;
  customerConfirmedDelivery?: boolean | null;
  customerConfirmedDeliveryAt?: unknown | null;
  signatureExpiresAt?: unknown | null;
  autoCompletedDueToExpiry?: boolean | null;
  fixedPrice?: boolean | null;
  allowNegotiation?: boolean | null;
  counterOfferPrice?: number | null;
  counterOfferDriverId?: string | null;
  counterOfferAt?: unknown | null;
  counterOfferAccepted?: boolean | null;
  acceptedCounterPrice?: number | null;
  distanceKm?: number | null;
  assignmentId?: string | null;
  paymentProofVerified?: boolean | null;
  paymentProofVerifiedAt?: unknown | null;
  createdAt?: unknown;
  updatedAt?: unknown;
  workflowOwner?: "admin" | "company";
  companyAssignmentStatus?: "open" | "claimed" | "bidding" | "accepted" | "closed";
  quoteExpiresAt?: unknown;
  /** Snapshot of customer contact info stored at request creation for company visibility */
  customerName?: string | null;
  customerPhone?: string | null;
  assignedCompanyId?: string | null;
  assignedCompanyName?: string | null;
  companyAcceptedAt?: unknown | null;
  acceptedByCompanyId?: string | null;
  /** Company details snapshot shown to customer after acceptance */
  companyInfo?: {
    name: string;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
  } | null;
}

export interface AssignmentDoc {
  requestId: string;
  driverId: string;
  driverAccepted: boolean | null;
  assignedBy: string | null;
  assignedAt?: unknown;
  acceptedAt?: unknown;
  startedAt?: unknown;
  arrivedAt?: unknown;
  completedAt?: unknown;
  cancelledAt?: unknown;
  cancelledBy?: "customer" | "driver";
}

export interface DeliveryQuoteNegotiationEntry {
  by: "company" | "customer";
  price: number;
  at: unknown;
}

export interface DeliveryQuoteDoc {
  requestId: string;
  companyId: string;
  companyName: string;
  companyInfo?: {
    name: string;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
  } | null;
  status: "pending" | "customer_countered" | "company_countered" | "accepted" | "declined";
  currentPrice: number;
  negotiationHistory: DeliveryQuoteNegotiationEntry[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AdminNotificationDoc {
  type:
    | "negotiation_request"
    | "payment_sent"
    | "new_delivery"
    | "driver_completed"
    | "delivery_proof"
    | "signature_request"
    | "company_registration"
    | "driver_accepted"
    | "driver_arrived"
    | "delivery_started"
    | "driver_report"
    | "quote_accepted"
    | "quote_declined"
    | "driver_declined"
    | "delivery_cancelled_by_driver";
  requestId: string;
  customerId?: string;
  message: string;
  read: boolean;
  proofImageUrl?: string;
  createdAt?: unknown;
}

export interface ChatDoc {
  requestId: string;
  participantIds: string[];
  chatType?: "delivery" | "support";
  customerId?: string;
  customerName?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface MessageDoc {
  chatId: string;
  senderId: string;
  content: string;
  readBy: string[];
  createdAt?: unknown;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function getCurrentUid(): Promise<string | null> {
  return auth.currentUser?.uid ?? null;
}

export async function getUserDoc(uid: string): Promise<UserDoc | null> {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? (snap.data() as UserDoc) : null;
}

export async function getDriverDoc(uid: string): Promise<DriverDoc | null> {
  const snap = await getDoc(doc(db, "drivers", uid));
  return snap.exists() ? (snap.data() as DriverDoc) : null;
}

export function listenDriver(
  uid: string,
  cb: (data: DriverDoc | null) => void
): Unsubscribe {
  return onSnapshot(doc(db, "drivers", uid), (snap) => {
    cb(snap.exists() ? (snap.data() as DriverDoc) : null);
  });
}

export async function updateDriverLocation(uid: string, lat: number, lng: number) {
  await updateDoc(doc(db, "drivers", uid), {
    currentLocation: { lat, lng, updatedAt: serverTimestamp() },
    currentLatitude: lat,
    currentLongitude: lng,
    locationUpdatedAt: serverTimestamp(),
  });
}

export async function listOnlineApprovedDrivers(max = 25) {
  const q = query(
    collection(db, "drivers"),
    where("isOnline", "==", true),
    where("status", "==", "approved"),
    limit(max)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as DriverDoc) }));
}

export function listenOnlineDrivers(
  cb: (drivers: Array<DriverDoc & { id: string }>) => void
): Unsubscribe {
  const q = query(
    collection(db, "drivers"),
    where("isOnline", "==", true),
    where("status", "==", "approved")
  );
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as DriverDoc) })));
  });
}

// ── Delivery Requests ─────────────────────────────────────────────────────────

export async function createDeliveryRequest(
  data: Omit<DeliveryRequestDoc, "createdAt" | "updatedAt"> & Record<string, unknown>
) {
  const ref = await addDoc(collection(db, "delivery_requests"), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export function listenDeliveryRequest(
  requestId: string,
  cb: (doc: (DeliveryRequestDoc & { id: string }) | null) => void
): Unsubscribe {
  return onSnapshot(doc(db, "delivery_requests", requestId), (snap) => {
    cb(snap.exists() ? { id: snap.id, ...(snap.data() as DeliveryRequestDoc) } : null);
  });
}

export function listenActiveDeliveries(
  cb: (docs: Array<DeliveryRequestDoc & { id: string }>) => void
): Unsubscribe {
  const activeStatuses: DeliveryStatus[] = [
    "driver_assigned",
    "driver_accepted",
    "in_progress",
    "arrived",
    "awaiting_signature",
  ];
  const q = query(
    collection(db, "delivery_requests"),
    where("status", "in", activeStatuses)
  );
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as DeliveryRequestDoc) })));
  });
}

export async function updateDeliveryStatus(
  requestId: string,
  status: DeliveryStatus,
  patch: Record<string, unknown> = {}
) {
  await updateDoc(doc(db, "delivery_requests", requestId), {
    status,
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

export async function getDeliveryRequestStatus(requestId: string): Promise<string | null> {
  try {
    const snap = await getDoc(doc(db, "delivery_requests", requestId));
    return snap.exists() ? ((snap.data() as DeliveryRequestDoc).status ?? null) : null;
  } catch { return null; }
}

// ── Company Workflow ───────────────────────────────────────────────────────────

export function listenOpenCompanyRequests(
  cb: (docs: Array<DeliveryRequestDoc & { id: string }>) => void
): Unsubscribe {
  // Include both "open" (no bids yet) and "bidding" (already has bids — still open for more quotes)
  const q = query(
    collection(db, "delivery_requests"),
    where("companyAssignmentStatus", "in", ["open", "bidding"]),
    where("driverType", "==", "company_driver"),
    where("workflowOwner", "==", "company"),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as DeliveryRequestDoc) })));
  });
}

export function listenCompanyWorkflowRequests(
  companyId: string,
  cb: (docs: Array<DeliveryRequestDoc & { id: string }>) => void
): Unsubscribe {
  const q = query(
    collection(db, "delivery_requests"),
    where("assignedCompanyId", "==", companyId),
    where("driverType", "==", "company_driver"),
    where("workflowOwner", "==", "company"),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as DeliveryRequestDoc) })));
  });
}

export async function claimCompanyDeliveryRequest(
  requestId: string,
  companyId: string,
  companyName?: string,
  companyInfo?: { phone?: string | null; email?: string | null; address?: string | null }
) {
  const requestRef = doc(db, "delivery_requests", requestId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(requestRef);
    if (!snap.exists()) throw new Error("Delivery request not found");
    const data = snap.data() as DeliveryRequestDoc;
    if (data.workflowOwner !== "company" || data.driverType !== "company_driver")
      throw new Error("This request is not available to companies");
    if (data.companyAssignmentStatus === "claimed" && data.assignedCompanyId !== companyId)
      throw new Error("Another company has already accepted this request");
    if (data.companyAssignmentStatus === "claimed" && data.assignedCompanyId === companyId)
      return { alreadyClaimedByYou: true };

    tx.update(requestRef, {
      companyAssignmentStatus: "claimed",
      assignedCompanyId: companyId,
      assignedCompanyName: companyName ?? null,
      companyAcceptedAt: serverTimestamp(),
      acceptedByCompanyId: companyId,
      // Keep "pending" here — status advances to "admin_review" only when the company
      // actively reviews the request (e.g. sets a price or assigns a driver).
      status: "pending" as DeliveryStatus,
      // Snapshot company contact info so customer can see it immediately
      companyInfo: {
        name: companyName ?? "",
        phone: companyInfo?.phone ?? null,
        email: companyInfo?.email ?? null,
        address: companyInfo?.address ?? null,
      },
      updatedAt: serverTimestamp(),
    });
    return { alreadyClaimedByYou: false, customerId: data.customerId };
  }).then(async (result) => {
    if (!result.alreadyClaimedByYou) {
      await addDoc(collection(db, "notifications"), {
        userId: result.customerId,
        title: "Request Accepted",
        message: `${companyName ?? "A company"} has accepted your delivery request and will send a price quote shortly.`,
        read: false,
        type: "company_accepted",
        requestId,
        createdAt: serverTimestamp(),
      });
    }
    return result;
  });
}

export async function unclaimCompanyDeliveryRequest(
  requestId: string,
  companyId: string
): Promise<void> {
  const requestRef = doc(db, "delivery_requests", requestId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(requestRef);
    if (!snap.exists()) throw new Error("Request not found");
    const data = snap.data() as DeliveryRequestDoc;
    if (data.assignedCompanyId !== companyId)
      throw new Error("Your company does not own this request");
    const releasableStatuses = ["pending", "admin_review", "negotiating_price", "price_set"];
    if (!releasableStatuses.includes(data.status as string))
      throw new Error("Request is too far along to release");
    tx.update(requestRef, {
      companyAssignmentStatus: "open",
      assignedCompanyId: null,
      assignedCompanyName: null,
      companyAcceptedAt: null,
      acceptedByCompanyId: null,
      companyInfo: null,
      status: "pending",
      updatedAt: serverTimestamp(),
    });
  });
}

// ── Price Quote ───────────────────────────────────────────────────────────────

export async function setPriceQuote(
  requestId: string,
  quotedPrice: number,
  adminUid: string,
  quoteNote?: string
) {
  await updateDoc(doc(db, "delivery_requests", requestId), {
    quotedPrice,
    estimatedPrice: quotedPrice,
    quotedBy: adminUid,
    quotedAt: serverTimestamp(),
    quoteNote: quoteNote ?? null,
    negotiationRequested: false,
    status: "price_set" as DeliveryStatus,
    updatedAt: serverTimestamp(),
  });
  const reqSnap = await getDoc(doc(db, "delivery_requests", requestId));
  if (reqSnap.exists()) {
    const reqData = reqSnap.data() as DeliveryRequestDoc;
    await addDoc(collection(db, "notifications"), {
      userId: reqData.customerId,
      title: "Price Quote Received",
      message: `Your delivery has been quoted at ₦${quotedPrice.toLocaleString()}. Please review and confirm.`,
      read: false,
      type: "price_quote",
      requestId,
      createdAt: serverTimestamp(),
    });
  }
}

export async function acceptPriceQuote(requestId: string) {
  await updateDoc(doc(db, "delivery_requests", requestId), {
    status: "payment_pending" as DeliveryStatus,
    updatedAt: serverTimestamp(),
  });
  const reqSnap = await getDoc(doc(db, "delivery_requests", requestId));
  if (reqSnap.exists()) {
    const reqData = reqSnap.data() as DeliveryRequestDoc;
    if (reqData.workflowOwner === "company") {
      await addDoc(collection(db, "admin_notifications"), {
        type: "quote_accepted" as AdminNotificationDoc["type"],
        requestId,
        customerId: reqData.customerId,
        message: "Customer has accepted your price quote and is ready to send payment.",
        read: false,
        createdAt: serverTimestamp(),
      } satisfies AdminNotificationDoc);
    }
  }
}

export async function rejectPriceQuote(requestId: string) {
  await updateDoc(doc(db, "delivery_requests", requestId), {
    status: "cancelled" as DeliveryStatus,
    updatedAt: serverTimestamp(),
  });
}

// ── Negotiation ───────────────────────────────────────────────────────────────

export async function submitDriverCounterOffer(
  requestId: string,
  driverId: string,
  counterOfferPrice: number
) {
  await updateDoc(doc(db, "delivery_requests", requestId), {
    counterOfferPrice,
    counterOfferDriverId: driverId,
    counterOfferAt: serverTimestamp(),
    status: "negotiating_price" as DeliveryStatus,
    updatedAt: serverTimestamp(),
  });
}

export async function requestNegotiationCall(requestId: string, customerId: string) {
  await updateDoc(doc(db, "delivery_requests", requestId), {
    negotiationRequested: true,
    negotiationRequestedAt: serverTimestamp(),
    status: "negotiating_price" as DeliveryStatus,
    updatedAt: serverTimestamp(),
  });
  await addDoc(collection(db, "admin_notifications"), {
    type: "negotiation_request",
    requestId,
    customerId,
    message: "A customer is requesting a call to negotiate the delivery price.",
    read: false,
    createdAt: serverTimestamp(),
  } satisfies AdminNotificationDoc);
}

// ── Payment ───────────────────────────────────────────────────────────────────

export async function setPaymentDetails(
  requestId: string,
  negotiatedPrice: number,
  paymentDetails: PaymentDetails,
  adminUid: string
) {
  await updateDoc(doc(db, "delivery_requests", requestId), {
    negotiatedPrice,
    quotedPrice: negotiatedPrice,
    estimatedPrice: negotiatedPrice,
    paymentDetails,
    paymentDetailsSetAt: serverTimestamp(),
    quotedBy: adminUid,
    status: "payment_pending" as DeliveryStatus,
    updatedAt: serverTimestamp(),
  });
  const reqSnap = await getDoc(doc(db, "delivery_requests", requestId));
  if (reqSnap.exists()) {
    const reqData = reqSnap.data() as DeliveryRequestDoc;
    await addDoc(collection(db, "notifications"), {
      userId: reqData.customerId,
      title: "Payment Details Ready",
      message: `Please transfer ₦${negotiatedPrice.toLocaleString()} to complete your booking.`,
      read: false,
      type: "payment_details",
      requestId,
      createdAt: serverTimestamp(),
    });
  }
}

/**
 * Customer marks payment as sent AND uploads a proof-of-transfer screenshot.
 * The proofUrl is stored as paymentProofUrl so the company can view it.
 */
export async function markPaymentSentWithProof(
  requestId: string,
  proofUrl: string
) {
  await updateDoc(doc(db, "delivery_requests", requestId), {
    paymentSentAt: serverTimestamp(),
    paymentProofUrl: proofUrl,
    updatedAt: serverTimestamp(),
  });
  // Notify company (admin_notifications collection) so they see the proof
  await addDoc(collection(db, "admin_notifications"), {
    type: "payment_sent",
    requestId,
    message: "Customer has sent payment and uploaded proof. Please verify and confirm.",
    proofImageUrl: proofUrl,
    read: false,
    createdAt: serverTimestamp(),
  } satisfies AdminNotificationDoc);
}

/** Legacy — kept for backward compat (no proof upload) */
export async function markPaymentSent(requestId: string) {
  await updateDoc(doc(db, "delivery_requests", requestId), {
    paymentSentAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await addDoc(collection(db, "admin_notifications"), {
    type: "payment_sent",
    requestId,
    message: "Customer has marked payment as sent. Please confirm the transaction.",
    read: false,
    createdAt: serverTimestamp(),
  } satisfies AdminNotificationDoc);
}

export async function confirmPayment(requestId: string, adminUid: string) {
  await updateDoc(doc(db, "delivery_requests", requestId), {
    paymentConfirmedAt: serverTimestamp(),
    paymentConfirmedBy: adminUid,
    status: "customer_confirmed" as DeliveryStatus,
    updatedAt: serverTimestamp(),
  });
  const reqSnap = await getDoc(doc(db, "delivery_requests", requestId));
  if (reqSnap.exists()) {
    const reqData = reqSnap.data() as DeliveryRequestDoc;
    await addDoc(collection(db, "notifications"), {
      userId: reqData.customerId,
      title: "Payment Confirmed!",
      message: "Your payment has been confirmed. A driver will be assigned shortly.",
      read: false,
      type: "payment_confirmed",
      requestId,
      createdAt: serverTimestamp(),
    });
  }
}

// ── Multi-company quote bidding ───────────────────────────────────────────────

export function listenQuotesForRequest(
  requestId: string,
  cb: (docs: Array<DeliveryQuoteDoc & { id: string }>) => void
): Unsubscribe {
  const q = query(
    collection(db, "delivery_quotes"),
    where("requestId", "==", requestId)
  );
  return onSnapshot(q, (snap) => {
    const docs = snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as DeliveryQuoteDoc) }))
      .sort((a, b) => {
        const aMs = a.createdAt instanceof Timestamp ? a.createdAt.toMillis() : 0;
        const bMs = b.createdAt instanceof Timestamp ? b.createdAt.toMillis() : 0;
        return aMs - bMs;
      });
    cb(docs);
  });
}

export function listenActiveQuotesForCompany(
  companyId: string,
  cb: (docs: Array<DeliveryQuoteDoc & { id: string }>) => void
): Unsubscribe {
  const q = query(
    collection(db, "delivery_quotes"),
    where("companyId", "==", companyId),
    where("status", "in", ["pending", "customer_countered", "company_countered"])
  );
  return onSnapshot(q, (snap) => {
    const docs = snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as DeliveryQuoteDoc) }))
      .sort((a, b) => {
        const aMs = a.createdAt instanceof Timestamp ? a.createdAt.toMillis() : 0;
        const bMs = b.createdAt instanceof Timestamp ? b.createdAt.toMillis() : 0;
        return bMs - aMs; // newest first
      });
    cb(docs);
  });
}

export async function submitCompanyQuote(
  requestId: string,
  companyId: string,
  price: number,
  companyName?: string,
  companyInfo?: { phone?: string | null; email?: string | null; address?: string | null }
): Promise<string> {
  const reqSnap = await getDoc(doc(db, "delivery_requests", requestId));
  if (!reqSnap.exists()) throw new Error("Request not found");
  const reqData = reqSnap.data() as DeliveryRequestDoc;
  if (reqData.workflowOwner !== "company") throw new Error("Not a company request");
  if (!["open", "bidding"].includes(reqData.companyAssignmentStatus as string))
    throw new Error("This request is no longer accepting quotes");

  const existingQ = query(
    collection(db, "delivery_quotes"),
    where("requestId", "==", requestId),
    where("companyId", "==", companyId),
    where("status", "in", ["pending", "customer_countered", "company_countered"])
  );
  const existingSnap = await getDocs(existingQ);
  if (!existingSnap.empty) throw new Error("You have already submitted a quote for this request");

  const quoteRef = await addDoc(collection(db, "delivery_quotes"), {
    requestId,
    companyId,
    companyName: companyName ?? "",
    companyInfo: {
      name: companyName ?? "",
      phone: companyInfo?.phone ?? null,
      email: companyInfo?.email ?? null,
      address: companyInfo?.address ?? null,
    },
    status: "pending",
    currentPrice: price,
    negotiationHistory: [{ by: "company", price, at: new Date() }],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  } satisfies Omit<DeliveryQuoteDoc, "createdAt" | "updatedAt"> & { createdAt: unknown; updatedAt: unknown });

  if (reqData.companyAssignmentStatus === "open") {
    await updateDoc(doc(db, "delivery_requests", requestId), {
      companyAssignmentStatus: "bidding",
      updatedAt: serverTimestamp(),
    });
  }

  await addDoc(collection(db, "notifications"), {
    userId: reqData.customerId,
    title: "New Price Quote",
    message: `${companyName ?? "A company"} quoted ₦${price.toLocaleString()} for your delivery.`,
    read: false,
    type: "price_quote",
    requestId,
    createdAt: serverTimestamp(),
  });

  return quoteRef.id;
}

export async function customerCounterQuote(quoteId: string, price: number): Promise<void> {
  const quoteRef = doc(db, "delivery_quotes", quoteId);
  const quoteSnap = await getDoc(quoteRef);
  if (!quoteSnap.exists()) throw new Error("Quote not found");
  const quoteData = quoteSnap.data() as DeliveryQuoteDoc;
  if (!["pending", "company_countered"].includes(quoteData.status))
    throw new Error("Cannot counter this quote at its current status");

  await updateDoc(quoteRef, {
    status: "customer_countered",
    currentPrice: price,
    negotiationHistory: [
      ...(quoteData.negotiationHistory ?? []),
      { by: "customer", price, at: new Date() },
    ],
    updatedAt: serverTimestamp(),
  });

  await addDoc(collection(db, "admin_notifications"), {
    type: "negotiation_request" as AdminNotificationDoc["type"],
    requestId: quoteData.requestId,
    message: `Customer countered with ₦${price.toLocaleString()}. Please respond to proceed.`,
    read: false,
    createdAt: serverTimestamp(),
  } satisfies AdminNotificationDoc);
}

export async function companyRespondToCounter(
  quoteId: string,
  action: "accept" | "decline" | "counter",
  price?: number
): Promise<void> {
  const quoteRef = doc(db, "delivery_quotes", quoteId);
  const quoteSnap = await getDoc(quoteRef);
  if (!quoteSnap.exists()) throw new Error("Quote not found");
  const quoteData = quoteSnap.data() as DeliveryQuoteDoc;
  if (quoteData.status !== "customer_countered")
    throw new Error("No pending customer counter to respond to");

  if (action === "accept") {
    // Company agrees to the customer's counter price — finalise
    await finalizeAcceptedQuote(
      quoteData.requestId,
      quoteId,
      quoteData.currentPrice,
      quoteData.companyId,
      quoteData.companyName
    );
  } else if (action === "decline") {
    await updateDoc(quoteRef, { status: "declined", updatedAt: serverTimestamp() });
    const reqSnap = await getDoc(doc(db, "delivery_requests", quoteData.requestId));
    if (reqSnap.exists()) {
      await addDoc(collection(db, "notifications"), {
        userId: (reqSnap.data() as DeliveryRequestDoc).customerId,
        title: "Counter Offer Declined",
        message: `${quoteData.companyName ?? "A company"} declined your counter-offer.`,
        read: false,
        type: "price_quote",
        requestId: quoteData.requestId,
        createdAt: serverTimestamp(),
      });
    }
  } else if (action === "counter" && price != null) {
    await updateDoc(quoteRef, {
      status: "company_countered",
      currentPrice: price,
      negotiationHistory: [
        ...(quoteData.negotiationHistory ?? []),
        { by: "company", price, at: new Date() },
      ],
      updatedAt: serverTimestamp(),
    });
    const reqSnap = await getDoc(doc(db, "delivery_requests", quoteData.requestId));
    if (reqSnap.exists()) {
      await addDoc(collection(db, "notifications"), {
        userId: (reqSnap.data() as DeliveryRequestDoc).customerId,
        title: "Counter Offer Received",
        message: `${quoteData.companyName ?? "A company"} countered with ₦${price.toLocaleString()}.`,
        read: false,
        type: "price_quote",
        requestId: quoteData.requestId,
        createdAt: serverTimestamp(),
      });
    }
  }
}

export async function customerAcceptQuote(requestId: string, quoteId: string): Promise<void> {
  const quoteSnap = await getDoc(doc(db, "delivery_quotes", quoteId));
  if (!quoteSnap.exists()) throw new Error("Quote not found");
  const quoteData = quoteSnap.data() as DeliveryQuoteDoc;
  if (!["pending", "company_countered"].includes(quoteData.status))
    throw new Error("This quote can no longer be accepted");
  await finalizeAcceptedQuote(
    requestId,
    quoteId,
    quoteData.currentPrice,
    quoteData.companyId,
    quoteData.companyName
  );
}

export async function customerDeclineQuote(quoteId: string): Promise<void> {
  const quoteRef = doc(db, "delivery_quotes", quoteId);
  const quoteSnap = await getDoc(quoteRef);
  if (!quoteSnap.exists()) throw new Error("Quote not found");
  const quoteData = quoteSnap.data() as DeliveryQuoteDoc;
  await updateDoc(quoteRef, { status: "declined", updatedAt: serverTimestamp() });
  await addDoc(collection(db, "admin_notifications"), {
    type: "quote_declined" as AdminNotificationDoc["type"],
    requestId: quoteData.requestId,
    message: `Customer declined your price quote of ₦${quoteData.currentPrice.toLocaleString()}.`,
    read: false,
    createdAt: serverTimestamp(),
  } satisfies AdminNotificationDoc);
}

export async function extendDeliveryQuoteExpiry(
  requestId: string,
  additionalMinutes: 5 | 15 | 30
): Promise<void> {
  const reqSnap = await getDoc(doc(db, "delivery_requests", requestId));
  if (!reqSnap.exists()) throw new Error("Request not found");
  const reqData = reqSnap.data() as DeliveryRequestDoc;
  const currentExpiry = reqData.quoteExpiresAt as any;
  const currentMs = currentExpiry?.toMillis?.() ?? Date.now();
  const baseMs = Math.max(currentMs, Date.now());
  const { Timestamp } = await import("firebase/firestore");
  const newExpiry = Timestamp.fromMillis(baseMs + additionalMinutes * 60 * 1000);
  await updateDoc(doc(db, "delivery_requests", requestId), {
    quoteExpiresAt: newExpiry,
    updatedAt: serverTimestamp(),
  });
}

export async function cancelDeliveryRequestWithQuotes(requestId: string): Promise<void> {
  const quotesSnap = await getDocs(
    query(collection(db, "delivery_quotes"), where("requestId", "==", requestId))
  );
  const batch = writeBatch(db);
  quotesSnap.docs.forEach((d) => {
    if (["pending", "customer_countered", "company_countered"].includes(d.data().status)) {
      batch.update(d.ref, { status: "declined", updatedAt: serverTimestamp() });
    }
  });
  batch.update(doc(db, "delivery_requests", requestId), {
    status: "cancelled" as DeliveryStatus,
    companyAssignmentStatus: "closed",
    updatedAt: serverTimestamp(),
  });
  await batch.commit();

  // Notify each company whose active quote was declined
  for (const d of quotesSnap.docs) {
    const data = d.data() as DeliveryQuoteDoc;
    if (["pending", "customer_countered", "company_countered"].includes(data.status)) {
      await addDoc(collection(db, "admin_notifications"), {
        type: "quote_declined" as AdminNotificationDoc["type"],
        requestId,
        message: `The delivery request #${requestId.slice(0, 8)} was cancelled by the customer.`,
        read: false,
        createdAt: serverTimestamp(),
      } satisfies AdminNotificationDoc);
    }
  }
}

export async function cancelDeliveryByCustomer(
  requestId: string,
  driverId: string,
  assignmentId: string,
  reason?: string,
): Promise<void> {
  let customerId: string | undefined;
  await runTransaction(db, async (tx) => {
    const requestRef    = doc(db, "delivery_requests", requestId);
    const assignmentRef = doc(db, "assignments", assignmentId);
    const [reqSnap, assignSnap] = await Promise.all([tx.get(requestRef), tx.get(assignmentRef)]);
    if (!reqSnap.exists()) throw new Error("Delivery not found");
    const data = reqSnap.data() as DeliveryRequestDoc;
    if (!["driver_assigned", "driver_accepted"].includes(data.status)) {
      throw new Error("Delivery can no longer be cancelled");
    }
    // Fix #1: reject if driver has already set startedAt even before status flips
    if (assignSnap.exists() && assignSnap.data().startedAt) {
      throw new Error("Delivery can no longer be cancelled");
    }
    customerId = data.customerId;
    tx.update(requestRef, {
      status: "cancelled" as DeliveryStatus,
      cancelledBy: "customer",
      cancelledAt: serverTimestamp(),
      ...(reason ? { cancelReason: reason } : {}),
      updatedAt: serverTimestamp(),
    });
    // Fix #6: stamp the assignment doc atomically with the same transaction
    if (assignSnap.exists()) {
      tx.update(assignmentRef, {
        cancelledAt: serverTimestamp(),
        cancelledBy: "customer" as const,
      });
    }
    // Fix #7: increment cancellation count on the customer's user doc
    if (customerId) {
      tx.update(doc(db, "users", customerId), {
        cancellationCount: increment(1),
        lastCancelledAt: serverTimestamp(),
      });
    }
  });
  // Fix #5: notification failure must never roll back the cancellation
  try {
    await addDoc(collection(db, "notifications"), {
      userId: driverId,
      title: "Delivery Cancelled",
      message: "The customer has cancelled this delivery.",
      type: "delivery_cancelled_by_customer",
      read: false,
      requestId,
      createdAt: serverTimestamp(),
    } satisfies Omit<UserNotificationDoc, "id">);
  } catch (err) {
    console.error("[cancel] Failed to send driver notification:", err);
  }
}

export async function cancelDeliveryByDriver(
  requestId: string,
  customerId: string,
  assignmentId: string,
  reason?: string,
): Promise<void> {
  let driverId: string | undefined;
  await runTransaction(db, async (tx) => {
    const requestRef    = doc(db, "delivery_requests", requestId);
    const assignmentRef = doc(db, "assignments", assignmentId);
    const [reqSnap, assignSnap] = await Promise.all([tx.get(requestRef), tx.get(assignmentRef)]);
    if (!reqSnap.exists()) throw new Error("Delivery not found");
    const data = reqSnap.data() as DeliveryRequestDoc;
    if (!["driver_assigned", "driver_accepted"].includes(data.status)) {
      throw new Error("Delivery can no longer be cancelled");
    }
    // Fix #1: reject if startedAt is already set on the assignment
    if (assignSnap.exists() && assignSnap.data().startedAt) {
      throw new Error("Delivery can no longer be cancelled");
    }
    driverId = assignSnap.exists() ? (assignSnap.data().driverId as string | undefined) : undefined;
    tx.update(requestRef, {
      status: "cancelled" as DeliveryStatus,
      cancelledBy: "driver",
      cancelledAt: serverTimestamp(),
      ...(reason ? { cancelReason: reason } : {}),
      updatedAt: serverTimestamp(),
    });
    // Fix #6: stamp the assignment doc atomically
    if (assignSnap.exists()) {
      tx.update(assignmentRef, {
        cancelledAt: serverTimestamp(),
        cancelledBy: "driver" as const,
      });
    }
    // Fix #7: increment cancellation count on the driver's user doc
    if (driverId) {
      tx.update(doc(db, "users", driverId), {
        cancellationCount: increment(1),
        lastCancelledAt: serverTimestamp(),
      });
    }
  });
  // Fix #5: notification failures are non-fatal
  try {
    await addDoc(collection(db, "notifications"), {
      userId: customerId,
      title: "Driver Cancelled",
      message: "Your driver has cancelled this delivery. Tap to find another driver.",
      type: "delivery_cancelled_by_driver",
      read: false,
      requestId,
      createdAt: serverTimestamp(),
    } satisfies Omit<UserNotificationDoc, "id">);
  } catch (err) {
    console.error("[cancel] Failed to send customer notification:", err);
  }
  // Fix #9: notify admin of driver-initiated cancellations
  try {
    await addDoc(collection(db, "admin_notifications"), {
      type: "delivery_cancelled_by_driver" as AdminNotificationDoc["type"],
      requestId,
      customerId,
      message: `Driver cancelled delivery${reason ? `: "${reason}"` : "."}`,
      read: false,
      createdAt: serverTimestamp(),
    } satisfies AdminNotificationDoc);
  } catch (err) {
    console.error("[cancel] Failed to send admin notification:", err);
  }
}

/** Returns the lifetime cancellation count for a user (0 if none recorded). */
export async function getUserCancellationCount(userId: string): Promise<number> {
  const snap = await getDoc(doc(db, "users", userId));
  if (!snap.exists()) return 0;
  return (snap.data().cancellationCount as number | undefined) ?? 0;
}

async function finalizeAcceptedQuote(
  requestId: string,
  acceptedQuoteId: string,
  agreedPrice: number,
  companyId: string,
  companyName: string
): Promise<void> {
  const quotesSnap = await getDocs(
    query(collection(db, "delivery_quotes"), where("requestId", "==", requestId))
  );

  const batch = writeBatch(db);
  const declinedCompanyIds: string[] = [];

  quotesSnap.docs.forEach((d) => {
    if (d.id === acceptedQuoteId) {
      batch.update(d.ref, { status: "accepted", updatedAt: serverTimestamp() });
    } else if (["pending", "customer_countered", "company_countered"].includes(d.data().status)) {
      batch.update(d.ref, { status: "declined", updatedAt: serverTimestamp() });
      declinedCompanyIds.push((d.data() as DeliveryQuoteDoc).companyId);
    }
  });

  batch.update(doc(db, "delivery_requests", requestId), {
    status: "payment_pending" as DeliveryStatus,
    assignedCompanyId: companyId,
    assignedCompanyName: companyName,
    quotedPrice: agreedPrice,
    estimatedPrice: agreedPrice,
    companyAssignmentStatus: "accepted",
    updatedAt: serverTimestamp(),
  });

  await batch.commit();

  for (const cId of declinedCompanyIds) {
    await addDoc(collection(db, "admin_notifications"), {
      type: "quote_declined" as AdminNotificationDoc["type"],
      requestId,
      message: `Your quote for delivery #${requestId.slice(0, 8).toUpperCase()} was not selected.`,
      read: false,
      createdAt: serverTimestamp(),
    } satisfies AdminNotificationDoc);
  }

  const reqSnap = await getDoc(doc(db, "delivery_requests", requestId));
  if (reqSnap.exists()) {
    await addDoc(collection(db, "notifications"), {
      userId: (reqSnap.data() as DeliveryRequestDoc).customerId,
      title: "Quote Accepted!",
      message: `Your delivery is confirmed at ₦${agreedPrice.toLocaleString()}. Payment details will be sent shortly.`,
      read: false,
      type: "payment_confirmed",
      requestId,
      createdAt: serverTimestamp(),
    });
  }
}

// ── Driver Workflow ───────────────────────────────────────────────────────────

export async function markDriverArrived(assignmentId: string, requestId: string) {
  await updateDoc(doc(db, "assignments", assignmentId), {
    arrivedAt: serverTimestamp(),
  });
  await updateDoc(doc(db, "delivery_requests", requestId), {
    driverArrivedAt: serverTimestamp(),
    status: "arrived" as DeliveryStatus,
    updatedAt: serverTimestamp(),
  });
}

// ── Signature / Completion Flow ───────────────────────────────────────────────

export async function submitDeliveryProofAndRequestSignature(
  requestId: string,
  assignmentId: string,
  proofImageUrl: string,
  gpsLat?: number | null,
  gpsLng?: number | null
) {
  const reqSnap = await getDoc(doc(db, "delivery_requests", requestId));
  const existing = reqSnap.exists() ? (reqSnap.data() as DeliveryRequestDoc) : null;
  // Only set a new expiry if one hasn't been set yet — prevents driver retries from resetting the clock
  const expiresAt = existing?.signatureExpiresAt
    ? existing.signatureExpiresAt
    : new Date(Date.now() + 24 * 60 * 60 * 1000);
  const proof: ProofMeta = {
    url: proofImageUrl,
    uploadedAt: serverTimestamp(),
    lat: gpsLat ?? null,
    lng: gpsLng ?? null,
    locked: true,
  };
  await updateDoc(doc(db, "delivery_requests", requestId), {
    proof,
    deliveryProofUrl: proofImageUrl,
    deliveryProofUploadedAt: serverTimestamp(),
    status: "awaiting_signature" as DeliveryStatus,
    signatureRequestSentAt: null,
    customerSignatureUrl: null,
    customerConfirmedDelivery: null,
    signatureExpiresAt: expiresAt,
    updatedAt: serverTimestamp(),
  });
  await addDoc(collection(db, "admin_notifications"), {
    type: "delivery_proof",
    requestId,
    message: "Delivery proof uploaded. Awaiting customer signature.",
    proofImageUrl,
    read: false,
    createdAt: serverTimestamp(),
  } satisfies AdminNotificationDoc);
}

export async function unlockDeliveryProof(requestId: string): Promise<void> {
  const snap = await getDoc(doc(db, "delivery_requests", requestId));
  if (!snap.exists()) throw new Error("Delivery request not found");
  const data = snap.data() as DeliveryRequestDoc;
  if (!data.proof) throw new Error("No proof to unlock");
  await updateDoc(doc(db, "delivery_requests", requestId), {
    proof: { ...data.proof, locked: false },
    status: "in_progress" as DeliveryStatus,
    updatedAt: serverTimestamp(),
  });
}

export async function completeDeliveryWithProof(
  requestId: string,
  assignmentId: string,
  proofImageUrl: string
) {
  await submitDeliveryProofAndRequestSignature(requestId, assignmentId, proofImageUrl);
}

export async function sendSignatureRequestToCustomer(
  requestId: string,
  customerId: string
) {
  await updateDoc(doc(db, "delivery_requests", requestId), {
    signatureRequestSentAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await addDoc(collection(db, "notifications"), {
    userId: customerId,
    title: "Signature Required ✍️",
    message: "Your delivery has been dropped off. Please sign or confirm receipt.",
    read: false,
    type: "signature_request",
    requestId,
    createdAt: serverTimestamp(),
  });
}

export async function submitCustomerSignature(
  requestId: string,
  assignmentId: string,
  signatureUrl: string
) {
  if (!signatureUrl) throw new Error("Signature image is required");
  const requestRef = doc(db, "delivery_requests", requestId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(requestRef);
    if (!snap.exists()) throw new Error("Delivery request not found");
    const data = snap.data() as DeliveryRequestDoc;
    if (data.status !== "awaiting_signature") {
      throw new Error(`Cannot sign delivery in status "${data.status}"`);
    }
    tx.update(requestRef, {
      customerSignatureUrl: signatureUrl,
      customerConfirmedDelivery: true,
      customerConfirmedDeliveryAt: serverTimestamp(),
      status: "completed" as DeliveryStatus,
      updatedAt: serverTimestamp(),
    });
    tx.update(doc(db, "assignments", assignmentId), {
      completedAt: serverTimestamp(),
    });
  });
}

export async function confirmDeliveryWithoutSignature(
  requestId: string,
  assignmentId: string
) {
  await updateDoc(doc(db, "delivery_requests", requestId), {
    customerConfirmedDelivery: true,
    customerConfirmedDeliveryAt: serverTimestamp(),
    status: "completed" as DeliveryStatus,
    updatedAt: serverTimestamp(),
  });
  await updateDoc(doc(db, "assignments", assignmentId), {
    completedAt: serverTimestamp(),
  });
}

export async function autoCompleteExpiredSignature(
  requestId: string,
  assignmentId: string
) {
  const snap = await getDoc(doc(db, "delivery_requests", requestId));
  if (!snap.exists()) return;
  const data = snap.data() as DeliveryRequestDoc;
  if (data.status !== "awaiting_signature") return;
  const expiresAt = (data.signatureExpiresAt as any)?.toDate?.() as Date | null;
  if (expiresAt && new Date() < expiresAt) return;
  await updateDoc(doc(db, "delivery_requests", requestId), {
    customerConfirmedDelivery: null,
    customerConfirmedDeliveryAt: null,
    autoCompletedDueToExpiry: true,
    status: "completed" as DeliveryStatus,
    updatedAt: serverTimestamp(),
  });
  await updateDoc(doc(db, "assignments", assignmentId), {
    completedAt: serverTimestamp(),
  });
}

// ── Admin Notifications ───────────────────────────────────────────────────────

export function listenAdminNotifications(
  cb: (docs: Array<AdminNotificationDoc & { id: string }>) => void
): Unsubscribe {
  const q = query(
    collection(db, "admin_notifications"),
    orderBy("createdAt", "desc"),
    limit(50)
  );
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as AdminNotificationDoc) })));
  });
}

export async function markAdminNotificationRead(notificationId: string) {
  await updateDoc(doc(db, "admin_notifications", notificationId), { read: true });
}

export async function markAllAdminNotificationsRead(
  notifications: Array<{ id: string; read: boolean }>
) {
  const unread = notifications.filter((n) => !n.read);
  if (!unread.length) return;
  const batch = writeBatch(db);
  unread.forEach((n) => {
    batch.update(doc(db, "admin_notifications", n.id), { read: true });
  });
  await batch.commit();
}

// ── Customer / Driver notifications (general "notifications" collection) ───────

export interface UserNotificationDoc {
  userId: string;
  title: string;
  message: string;
  type?: string;
  read: boolean;
  requestId?: string;
  createdAt?: unknown;
}

export function listenDriverNotifications(
  driverId: string,
  cb: (docs: Array<UserNotificationDoc & { id: string }>) => void
): Unsubscribe {
  const q = query(
    collection(db, "notifications"),
    where("userId", "==", driverId),
    orderBy("createdAt", "desc"),
    limit(30)
  );
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as UserNotificationDoc) })));
  });
}

export async function markNotificationRead(notificationId: string) {
  await updateDoc(doc(db, "notifications", notificationId), { read: true });
}

export async function markAllNotificationsRead(
  notifications: Array<{ id: string; read: boolean }>
) {
  const unread = notifications.filter((n) => !n.read);
  if (!unread.length) return;
  const batch = writeBatch(db);
  unread.forEach((n) => {
    batch.update(doc(db, "notifications", n.id), { read: true });
  });
  await batch.commit();
}

// ── Assignments ───────────────────────────────────────────────────────────────

export async function createAssignment(
  requestId: string,
  driverId: string,
  assignedBy: string | null
) {
  const ref = await addDoc(collection(db, "assignments"), {
    requestId,
    driverId,
    driverAccepted: null,
    assignedBy,
    assignedAt: serverTimestamp(),
  } satisfies AssignmentDoc);
  // Write assignmentId back to the delivery request; clear any prior driverDeclinedAt flag
  await updateDoc(doc(db, "delivery_requests", requestId), {
    assignmentId: ref.id,
    driverDeclinedAt: null,
    updatedAt: serverTimestamp(),
  });
  try {
    await addDoc(collection(db, "notifications"), {
      userId: driverId,
      title: "New Job Offer",
      message: "You have been assigned a new delivery. Tap to review and accept.",
      type: "job_offer",
      read: false,
      requestId,
      createdAt: serverTimestamp(),
    } satisfies Omit<UserNotificationDoc, "id">);
  } catch (e) {
    console.error("Failed to send job offer notification:", e);
  }
  return ref.id;
}

export function listenAssignmentsForRequest(
  requestId: string,
  cb: (docs: Array<AssignmentDoc & { id: string }>) => void
): Unsubscribe {
  const q = query(collection(db, "assignments"), where("requestId", "==", requestId));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as AssignmentDoc) })));
  });
}

export function listenAssignmentsForDriver(
  driverId: string,
  cb: (docs: Array<AssignmentDoc & { id: string }>) => void
): Unsubscribe {
  const q = query(
    collection(db, "assignments"),
    where("driverId", "==", driverId),
    orderBy("assignedAt", "desc")
  );
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as AssignmentDoc) })));
  });
}

export async function setDriverAccepted(
  assignmentId: string,
  accepted: boolean,
  requestId?: string
) {
  let capturedRequestId: string | null = null;
  let capturedAssignedBy: string | null = null;

  try {
    await runTransaction(db, async (tx) => {
      const assignmentRef = doc(db, "assignments", assignmentId);
      const snap = await tx.get(assignmentRef);
      if (!snap.exists()) return;
      // Skip write if already at the desired value — prevents precondition conflicts
      // when two concurrent callers both try to set the same value (e.g. driver decline
      // races with customer cleanup both setting driverAccepted: false).
      if ((snap.data() as any).driverAccepted === accepted) return;
      const aData = snap.data() as AssignmentDoc;
      capturedRequestId = aData.requestId ?? requestId ?? null;
      capturedAssignedBy = aData.assignedBy ?? null;
      tx.update(assignmentRef, {
        driverAccepted: accepted,
        acceptedAt: accepted ? serverTimestamp() : null,
      });
      if (requestId) {
        const requestRef = doc(db, "delivery_requests", requestId);
        tx.update(requestRef, {
          status: (accepted ? "driver_accepted" : "pending") as DeliveryStatus,
          updatedAt: serverTimestamp(),
        });
      }
    });
  } catch (err: any) {
    if (err?.code === "failed-precondition") {
      // A concurrent write already changed the document between our read and commit.
      // Re-read; if it already reached the desired value another writer did our job.
      const snap = await getDoc(doc(db, "assignments", assignmentId));
      if (!snap.exists() || (snap.data() as any).driverAccepted === accepted) return;
    }
    throw err;
  }

  // After a successful decline, notify the company if this was their assignment
  if (!accepted && capturedRequestId && capturedAssignedBy) {
    try {
      const reqSnap = await getDoc(doc(db, "delivery_requests", capturedRequestId));
      if (reqSnap.exists()) {
        const reqData = reqSnap.data() as DeliveryRequestDoc;
        if (reqData.workflowOwner === "company") {
          const name = (reqData as any).deliveryName ?? "your delivery";
          // Stamp the request so the company card shows an inline alert
          await updateDoc(doc(db, "delivery_requests", capturedRequestId), {
            driverDeclinedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          await addDoc(collection(db, "admin_notifications"), {
            type: "driver_declined" as AdminNotificationDoc["type"],
            requestId: capturedRequestId,
            message: `A driver declined the assignment for "${name}". Please assign another driver.`,
            read: false,
            createdAt: serverTimestamp(),
          } satisfies AdminNotificationDoc);
        }
      }
    } catch { /* non-critical — don't block the decline */ }
  }
}

export async function markAssignmentStarted(assignmentId: string) {
  await updateDoc(doc(db, "assignments", assignmentId), {
    startedAt: serverTimestamp(),
  });
}

export async function markAssignmentCompleted(assignmentId: string) {
  await updateDoc(doc(db, "assignments", assignmentId), {
    completedAt: serverTimestamp(),
  });
}

export async function getAssignmentsByRequestIds(
  requestIds: string[]
): Promise<Array<AssignmentDoc & { id: string }>> {
  if (!requestIds.length) return [];
  const q = query(
    collection(db, "assignments"),
    where("requestId", "in", requestIds.slice(0, 30))
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as AssignmentDoc) }));
}

export async function getUsersByIds(
  userIds: string[]
): Promise<Record<string, UserDoc>> {
  if (!userIds.length) return {};
  const q = query(
    collection(db, "users"),
    where(documentId(), "in", userIds.slice(0, 30))
  );
  const snap = await getDocs(q);
  const result: Record<string, UserDoc> = {};
  snap.docs.forEach((d) => { result[d.id] = d.data() as UserDoc; });
  return result;
}

export async function checkDriverEmailConflict(email: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  const snap = await getDocs(
    query(collection(db, "users"), where("email", "==", normalized))
  );
  return !snap.empty;
}

// ── Geocoding ─────────────────────────────────────────────────────────────────

export interface GeocodedResult {
  lat: number;
  lng: number;
  displayName: string;
}

export async function geocodeAddress(query: string): Promise<GeocodedResult[]> {
  const params = new URLSearchParams({
    q: query,
    format: "json",
    limit: "5",
    countrycodes: "ng",
  });
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?${params}`,
    { headers: { "Accept-Language": "en" } }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data as any[]).map((r: any) => ({
    lat: parseFloat(r.lat),
    lng: parseFloat(r.lon),
    displayName: r.display_name as string,
  }));
}

// ── Haversine ─────────────────────────────────────────────────────────────────

export { haversineKm } from "@/lib/haversine";

// ── Chat ──────────────────────────────────────────────────────────────────────

export async function getOrCreateChat(requestId: string, participantIds: string[]) {
  const q = query(collection(db, "chats"), where("requestId", "==", requestId), limit(10));
  const snap = await getDocs(q);
  const existing = snap.docs.find((d) => {
    const data = d.data() as ChatDoc;
    const set = new Set(data.participantIds ?? []);
    return participantIds.every((id) => set.has(id));
  });
  if (existing) return existing.id;
  const ref = await addDoc(collection(db, "chats"), {
    requestId,
    participantIds,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  } satisfies ChatDoc);
  return ref.id;
}

export function listenMessages(
  chatId: string,
  cb: (msgs: Array<MessageDoc & { id: string }>) => void
): Unsubscribe {
  const q = query(
    collection(db, "messages"),
    where("chatId", "==", chatId),
    orderBy("createdAt", "asc")
  );
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as MessageDoc) })));
  });
}

export async function sendMessage(chatId: string, senderId: string, content: string) {
  await addDoc(collection(db, "messages"), {
    chatId,
    senderId,
    content,
    readBy: [senderId],
    createdAt: serverTimestamp(),
  } satisfies MessageDoc);
  await updateDoc(doc(db, "chats", chatId), { updatedAt: serverTimestamp() });
}

export async function getOrCreateSupportChat(
  userId: string,
  customerName?: string
): Promise<string> {
  const q = query(
    collection(db, "chats"),
    where("chatType", "==", "support"),
    where("customerId", "==", userId)
  );
  const snap = await getDocs(q);
  if (!snap.empty) return snap.docs[0].id;
  const ref = await addDoc(collection(db, "chats"), {
    requestId: `support_${userId}`,
    chatType: "support",
    customerId: userId,
    customerName: customerName ?? null,
    participantIds: [userId],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  } satisfies ChatDoc);
  return ref.id;
}

export function listenSupportChats(
  cb: (chats: Array<ChatDoc & { id: string }>) => void
): Unsubscribe {
  const q = query(
    collection(db, "chats"),
    where("chatType", "==", "support"),
    orderBy("updatedAt", "desc")
  );
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as ChatDoc) })));
  });
}

// ── Delivery Broadcasts ───────────────────────────────────────────────────────

export interface DeliveryBroadcastData {
  customerId: string;
  pickup: { address: string; lat: number; lng: number };
  dropoff: { address: string; lat: number; lng: number };
  transportType: string;
  estimatedPrice: number;
  distanceKm: number;
  allowNegotiation: boolean;
  itemDescription?: string | null;
  itemSize?: string | null;
  packagePhotoUrl?: string | null;
}

export interface DeliveryBroadcastDoc extends DeliveryBroadcastData {
  status: "active" | "fulfilled" | "expired" | "cancelled";
  expiresAt: unknown;
  createdAt: unknown;
  selectedDriverId?: string | null;
  deliveryRequestId?: string | null;
}

export interface BroadcastResponseDoc {
  broadcastId: string;
  driverId: string;
  responseType: "interested" | "counter_offer";
  counterOfferPrice?: number | null;
  status: "pending" | "selected" | "dismissed";
  assignmentId?: string | null;
  requestId?: string | null;
  createdAt: unknown;
  updatedAt: unknown;
}

const BROADCAST_TTL_MS = 2 * 60 * 1000; // 2 minutes

export async function createBroadcast(data: DeliveryBroadcastData): Promise<string> {
  const ref = await addDoc(collection(db, "delivery_broadcasts"), {
    ...data,
    status: "active",
    expiresAt: Timestamp.fromDate(new Date(Date.now() + BROADCAST_TTL_MS)),
    createdAt: serverTimestamp(),
    selectedDriverId: null,
    deliveryRequestId: null,
  });
  return ref.id;
}

export async function expireBroadcast(broadcastId: string): Promise<void> {
  await updateDoc(doc(db, "delivery_broadcasts", broadcastId), {
    status: "expired",
  });
}

export async function fulfillBroadcast(
  broadcastId: string,
  selectedDriverId: string,
  deliveryRequestId: string
): Promise<void> {
  await updateDoc(doc(db, "delivery_broadcasts", broadcastId), {
    status: "fulfilled",
    selectedDriverId,
    deliveryRequestId,
  });
}

export async function respondToBroadcast(
  broadcastId: string,
  driverId: string,
  responseType: "interested" | "counter_offer",
  counterOfferPrice?: number
): Promise<void> {
  const broadcastSnap = await getDoc(doc(db, "delivery_broadcasts", broadcastId));
  if (!broadcastSnap.exists()) throw new Error("Broadcast not found");
  const broadcastData = broadcastSnap.data() as DeliveryBroadcastDoc;
  if (broadcastData.status !== "active") throw new Error("This broadcast is no longer active");
  const expiresAt = (broadcastData.expiresAt as any)?.toDate?.() ?? new Date(broadcastData.expiresAt as any);
  if (expiresAt <= new Date()) {
    // Lazily expire the broadcast if client-side TTL has passed
    await updateDoc(doc(db, "delivery_broadcasts", broadcastId), { status: "expired" });
    throw new Error("This broadcast has expired");
  }
  const responseRef = doc(db, "delivery_broadcasts", broadcastId, "responses", driverId);
  await setDoc(responseRef, {
    broadcastId,
    driverId,
    responseType,
    counterOfferPrice: counterOfferPrice ?? null,
    status: "pending",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function dismissBroadcastResponse(
  broadcastId: string,
  driverId: string
): Promise<void> {
  const responseRef = doc(db, "delivery_broadcasts", broadcastId, "responses", driverId);
  await updateDoc(responseRef, { status: "dismissed", updatedAt: serverTimestamp() });
}

export async function selectBroadcastDriver(
  broadcastId: string,
  driverId: string,
  assignmentId: string,
  requestId: string
): Promise<void> {
  await updateDoc(
    doc(db, "delivery_broadcasts", broadcastId, "responses", driverId),
    { status: "selected", assignmentId, requestId, updatedAt: serverTimestamp() }
  );
  await updateDoc(doc(db, "delivery_broadcasts", broadcastId), {
    selectedDriverId: driverId,
  });
  try {
    await addDoc(collection(db, "notifications"), {
      userId: driverId,
      title: "Customer Selected You! 🎯",
      message: "A customer has chosen you for their delivery. Accept the job to get started.",
      type: "customer_selected",
      read: false,
      requestId,
      createdAt: serverTimestamp(),
    } satisfies Omit<UserNotificationDoc, "id">);
  } catch (e) {
    console.error("Failed to send customer-selected notification:", e);
  }
}

export async function resetBroadcastDriverSelection(
  broadcastId: string,
  driverId: string
): Promise<void> {
  await updateDoc(
    doc(db, "delivery_broadcasts", broadcastId, "responses", driverId),
    { status: "pending", assignmentId: null, requestId: null, updatedAt: serverTimestamp() }
  );
}

export async function notifyBroadcastDriversCancelled(broadcastId: string): Promise<void> {
  const responsesSnap = await getDocs(
    query(
      collection(db, "delivery_broadcasts", broadcastId, "responses"),
      where("status", "==", "pending")
    )
  );
  const batch = writeBatch(db);
  const notifications: Promise<unknown>[] = [];
  responsesSnap.docs.forEach((d) => {
    const data = d.data() as BroadcastResponseDoc;
    batch.update(d.ref, { status: "dismissed", updatedAt: serverTimestamp() });
    notifications.push(
      addDoc(collection(db, "notifications"), {
        userId: data.driverId,
        title: "Delivery Request Cancelled",
        message: "The customer has cancelled this delivery request.",
        type: "broadcast_cancelled",
        read: false,
        createdAt: serverTimestamp(),
      }).catch((e) => console.error("Failed to notify driver of cancellation:", e))
    );
  });
  await batch.commit();
  await Promise.allSettled(notifications);
}

export function listenBroadcastResponses(
  broadcastId: string,
  cb: (responses: Array<BroadcastResponseDoc & { id: string }>) => void
): Unsubscribe {
  const q = query(
    collection(db, "delivery_broadcasts", broadcastId, "responses"),
    where("status", "==", "pending"),
    orderBy("createdAt", "asc")
  );
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as BroadcastResponseDoc) })));
  });
}

export function listenActiveBroadcasts(
  cb: (broadcasts: Array<DeliveryBroadcastDoc & { id: string }>) => void
): Unsubscribe {
  const q = query(
    collection(db, "delivery_broadcasts"),
    where("status", "==", "active"),
    orderBy("createdAt", "desc"),
    limit(50)
  );
  return onSnapshot(q, (snap) => {
    const now = new Date();
    const results = snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as DeliveryBroadcastDoc) }))
      .filter((b) => {
        const exp = (b.expiresAt as any)?.toDate?.() ?? new Date(b.expiresAt as any);
        return exp > now;
      });
    cb(results);
  });
}
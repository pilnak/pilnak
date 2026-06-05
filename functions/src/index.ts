import * as admin from "firebase-admin";
import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";

admin.initializeApp();

type DriverMode = "self" | "company";

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

async function notifyUser(userId: string, payload: { title: string; body: string; type: string; data?: any }) {
  await admin.firestore().collection("notifications").add({
    userId,
    title: payload.title,
    body: payload.body,
    type: payload.type,
    data: payload.data ?? null,
    read: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

export const matchDriverOnRequestCreate = onDocumentCreated("delivery_requests/{requestId}", async (event) => {
  const requestId = event.params.requestId as string;
  const snap = event.data;
  if (!snap) return;
  const req = snap.data() as any;

  const pickup = req.pickup as { lat: number; lng: number; address?: string } | undefined;
  const driverMode = (req.driverMode as DriverMode | undefined) ?? "self";
  const status = req.status as string | undefined;

  if (!pickup?.lat || !pickup?.lng) return;
  if (status && status !== "pending") return;

  // Company requests: send to admin queue
  if (driverMode === "company") {
    await snap.ref.update({
      status: "admin_review",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return;
  }

  // Self driver matching: pick nearest online approved driver (simple baseline)
  const driversSnap = await admin
    .firestore()
    .collection("drivers")
    .where("isOnline", "==", true)
    .where("status", "==", "approved")
    .limit(50)
    .get();

  const candidates = driversSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as any) }))
    .map((d) => {
      const loc = d.currentLocation as { lat?: number; lng?: number } | undefined;
      if (!loc?.lat || !loc?.lng) return null;
      const distanceKm = haversineKm({ lat: pickup.lat, lng: pickup.lng }, { lat: loc.lat, lng: loc.lng });
      return { driverId: d.id, distanceKm };
    })
    .filter(Boolean) as Array<{ driverId: string; distanceKm: number }>;

  candidates.sort((a, b) => a.distanceKm - b.distanceKm);
  const selected = candidates[0];
  if (!selected) {
    await snap.ref.update({
      status: "pending",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      matchingError: "no_online_drivers",
    });
    return;
  }

  const assignmentRef = await admin.firestore().collection("assignments").add({
    requestId,
    driverId: selected.driverId,
    driverAccepted: null,
    assignedBy: "system",
    assignedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await snap.ref.update({
    status: "driver_assigned",
    assignmentId: assignmentRef.id,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await notifyUser(selected.driverId, {
    title: "New ride request",
    body: "You have a new request to accept.",
    type: "ride_request",
    data: { requestId, assignmentId: assignmentRef.id },
  });
});

export const onAssignmentAcceptance = onDocumentUpdated("assignments/{assignmentId}", async (event) => {
  const before = event.data?.before.data() as any;
  const after = event.data?.after.data() as any;
  if (!before || !after) return;

  // only react on change
  if (before.driverAccepted === after.driverAccepted) return;

  const requestId = after.requestId as string | undefined;
  const driverId = after.driverId as string | undefined;
  if (!requestId || !driverId) return;

  const reqRef = admin.firestore().collection("delivery_requests").doc(requestId);

  if (after.driverAccepted === true) {
    await reqRef.update({
      status: "driver_accepted",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    // notify customer
    const reqSnap = await reqRef.get();
    const req = reqSnap.data() as any;
    if (req?.customerId) {
      await notifyUser(req.customerId, {
        title: "Driver accepted",
        body: "Your driver accepted the request.",
        type: "driver_accepted",
        data: { requestId, driverId },
      });
    }
  }

  if (after.driverAccepted === false) {
    await reqRef.update({
      status: "pending",
      assignmentId: admin.firestore.FieldValue.delete(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
});


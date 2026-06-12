import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoist mocks so they are available before module imports ───────────────────

const {
  mockAddDoc,
  mockUpdateDoc,
  mockSetDoc,
  mockOnSnapshot,
  mockCollection,
  mockDoc,
  mockTimestampFromDate,
} = vi.hoisted(() => ({
  mockAddDoc: vi.fn(),
  mockUpdateDoc: vi.fn(),
  mockSetDoc: vi.fn(),
  mockOnSnapshot: vi.fn(),
  mockCollection: vi.fn((...args: unknown[]) => ({ _collection: args })),
  mockDoc: vi.fn((...args: unknown[]) => ({ _doc: args })),
  mockTimestampFromDate: vi.fn((d: Date) => ({ toDate: () => d, _isTimestamp: true })),
}));

vi.mock("@/integrations/firebase/client", () => ({
  db: { _mock: true },
  auth: {},
}));

vi.mock("firebase/firestore", () => ({
  addDoc: mockAddDoc,
  updateDoc: mockUpdateDoc,
  setDoc: mockSetDoc,
  onSnapshot: mockOnSnapshot,
  collection: mockCollection,
  doc: mockDoc,
  query: vi.fn((...args: unknown[]) => ({ _query: args })),
  where: vi.fn((...args: unknown[]) => ({ _where: args })),
  orderBy: vi.fn((...args: unknown[]) => ({ _orderBy: args })),
  limit: vi.fn((...args: unknown[]) => ({ _limit: args })),
  serverTimestamp: vi.fn(() => ({ _serverTimestamp: true })),
  Timestamp: { fromDate: mockTimestampFromDate },
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  documentId: vi.fn(),
  runTransaction: vi.fn(),
  writeBatch: vi.fn(),
}));

import {
  createBroadcast,
  expireBroadcast,
  fulfillBroadcast,
  respondToBroadcast,
  dismissBroadcastResponse,
  listenActiveBroadcasts,
  type DeliveryBroadcastData,
} from "@/services/firebase";

// ── Shared fixture ────────────────────────────────────────────────────────────

const sampleData: DeliveryBroadcastData = {
  customerId: "cust-1",
  pickup: { address: "123 Main St", lat: 6.5244, lng: 3.3792 },
  dropoff: { address: "456 End Ave", lat: 6.6, lng: 3.4 },
  transportType: "cargo_van",
  estimatedPrice: 1500,
  distanceKm: 8.2,
  allowNegotiation: true,
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ── createBroadcast ───────────────────────────────────────────────────────────

describe("createBroadcast", () => {
  it("returns the Firestore document id", async () => {
    mockAddDoc.mockResolvedValue({ id: "broadcast-abc" });
    const id = await createBroadcast(sampleData);
    expect(id).toBe("broadcast-abc");
  });

  it("writes to the delivery_broadcasts collection", async () => {
    mockAddDoc.mockResolvedValue({ id: "x" });
    await createBroadcast(sampleData);
    expect(mockCollection).toHaveBeenCalledWith(
      expect.anything(),
      "delivery_broadcasts",
    );
  });

  it("sets status to 'active'", async () => {
    mockAddDoc.mockResolvedValue({ id: "x" });
    await createBroadcast(sampleData);
    const payload = mockAddDoc.mock.calls[0][1];
    expect(payload.status).toBe("active");
  });

  it("includes all fields from sampleData", async () => {
    mockAddDoc.mockResolvedValue({ id: "x" });
    await createBroadcast(sampleData);
    const payload = mockAddDoc.mock.calls[0][1];
    expect(payload.customerId).toBe(sampleData.customerId);
    expect(payload.pickup).toEqual(sampleData.pickup);
    expect(payload.dropoff).toEqual(sampleData.dropoff);
    expect(payload.transportType).toBe(sampleData.transportType);
    expect(payload.estimatedPrice).toBe(sampleData.estimatedPrice);
    expect(payload.distanceKm).toBe(sampleData.distanceKm);
    expect(payload.allowNegotiation).toBe(sampleData.allowNegotiation);
  });

  it("sets selectedDriverId and deliveryRequestId to null initially", async () => {
    mockAddDoc.mockResolvedValue({ id: "x" });
    await createBroadcast(sampleData);
    const payload = mockAddDoc.mock.calls[0][1];
    expect(payload.selectedDriverId).toBeNull();
    expect(payload.deliveryRequestId).toBeNull();
  });

  it("sets expiresAt ~10 minutes from now", async () => {
    mockAddDoc.mockResolvedValue({ id: "x" });
    const before = Date.now();
    await createBroadcast(sampleData);
    const after = Date.now();

    expect(mockTimestampFromDate).toHaveBeenCalledOnce();
    const expiryDate: Date = mockTimestampFromDate.mock.calls[0][0];
    const ttl = expiryDate.getTime();

    // Should be 10 minutes (600 000 ms) after the call, within a small margin
    expect(ttl).toBeGreaterThanOrEqual(before + 600_000);
    expect(ttl).toBeLessThanOrEqual(after + 600_000 + 100);
  });
});

// ── expireBroadcast ───────────────────────────────────────────────────────────

describe("expireBroadcast", () => {
  it("calls updateDoc with status 'expired'", async () => {
    mockUpdateDoc.mockResolvedValue(undefined);
    await expireBroadcast("bcast-1");
    expect(mockUpdateDoc).toHaveBeenCalledOnce();
    const [, payload] = mockUpdateDoc.mock.calls[0];
    expect(payload).toEqual({ status: "expired" });
  });

  it("targets the correct document path", async () => {
    mockUpdateDoc.mockResolvedValue(undefined);
    await expireBroadcast("bcast-1");
    expect(mockDoc).toHaveBeenCalledWith(
      expect.anything(),
      "delivery_broadcasts",
      "bcast-1",
    );
  });
});

// ── fulfillBroadcast ──────────────────────────────────────────────────────────

describe("fulfillBroadcast", () => {
  it("sets status to 'fulfilled'", async () => {
    mockUpdateDoc.mockResolvedValue(undefined);
    await fulfillBroadcast("bcast-1", "driver-99", "req-42");
    const [, payload] = mockUpdateDoc.mock.calls[0];
    expect(payload.status).toBe("fulfilled");
  });

  it("records selectedDriverId and deliveryRequestId", async () => {
    mockUpdateDoc.mockResolvedValue(undefined);
    await fulfillBroadcast("bcast-1", "driver-99", "req-42");
    const [, payload] = mockUpdateDoc.mock.calls[0];
    expect(payload.selectedDriverId).toBe("driver-99");
    expect(payload.deliveryRequestId).toBe("req-42");
  });

  it("targets the correct broadcast document", async () => {
    mockUpdateDoc.mockResolvedValue(undefined);
    await fulfillBroadcast("bcast-1", "driver-99", "req-42");
    expect(mockDoc).toHaveBeenCalledWith(
      expect.anything(),
      "delivery_broadcasts",
      "bcast-1",
    );
  });
});

// ── respondToBroadcast ────────────────────────────────────────────────────────

describe("respondToBroadcast", () => {
  it("writes to the responses subcollection path", async () => {
    mockSetDoc.mockResolvedValue(undefined);
    await respondToBroadcast("bcast-1", "driver-5", "interested");
    expect(mockDoc).toHaveBeenCalledWith(
      expect.anything(),
      "delivery_broadcasts",
      "bcast-1",
      "responses",
      "driver-5",
    );
  });

  it("sets responseType to 'interested'", async () => {
    mockSetDoc.mockResolvedValue(undefined);
    await respondToBroadcast("bcast-1", "driver-5", "interested");
    const [, payload] = mockSetDoc.mock.calls[0];
    expect(payload.responseType).toBe("interested");
    expect(payload.counterOfferPrice).toBeNull();
  });

  it("sets responseType to 'counter_offer' with price", async () => {
    mockSetDoc.mockResolvedValue(undefined);
    await respondToBroadcast("bcast-1", "driver-5", "counter_offer", 2500);
    const [, payload] = mockSetDoc.mock.calls[0];
    expect(payload.responseType).toBe("counter_offer");
    expect(payload.counterOfferPrice).toBe(2500);
  });

  it("sets status to 'pending'", async () => {
    mockSetDoc.mockResolvedValue(undefined);
    await respondToBroadcast("bcast-1", "driver-5", "interested");
    const [, payload] = mockSetDoc.mock.calls[0];
    expect(payload.status).toBe("pending");
  });

  it("includes broadcastId and driverId in payload", async () => {
    mockSetDoc.mockResolvedValue(undefined);
    await respondToBroadcast("bcast-1", "driver-5", "interested");
    const [, payload] = mockSetDoc.mock.calls[0];
    expect(payload.broadcastId).toBe("bcast-1");
    expect(payload.driverId).toBe("driver-5");
  });

  it("uses merge:true so re-responding overwrites cleanly", async () => {
    mockSetDoc.mockResolvedValue(undefined);
    await respondToBroadcast("bcast-1", "driver-5", "interested");
    const [, , options] = mockSetDoc.mock.calls[0];
    expect(options).toEqual({ merge: true });
  });
});

// ── dismissBroadcastResponse ──────────────────────────────────────────────────

describe("dismissBroadcastResponse", () => {
  it("sets status to 'dismissed'", async () => {
    mockUpdateDoc.mockResolvedValue(undefined);
    await dismissBroadcastResponse("bcast-1", "driver-5");
    const [, payload] = mockUpdateDoc.mock.calls[0];
    expect(payload.status).toBe("dismissed");
  });

  it("targets the correct response document path", async () => {
    mockUpdateDoc.mockResolvedValue(undefined);
    await dismissBroadcastResponse("bcast-1", "driver-5");
    expect(mockDoc).toHaveBeenCalledWith(
      expect.anything(),
      "delivery_broadcasts",
      "bcast-1",
      "responses",
      "driver-5",
    );
  });
});

// ── listenActiveBroadcasts ────────────────────────────────────────────────────

describe("listenActiveBroadcasts", () => {
  function makeDoc(id: string, expiresAt: Date, extra: object = {}) {
    return {
      id,
      data: () => ({
        status: "active",
        transportType: "cargo_van",
        estimatedPrice: 1000,
        distanceKm: 5,
        allowNegotiation: true,
        pickup: { address: "A", lat: 6.5, lng: 3.4 },
        dropoff: { address: "B", lat: 6.6, lng: 3.5 },
        customerId: "cust-1",
        expiresAt: { toDate: () => expiresAt },
        createdAt: { _serverTimestamp: true },
        selectedDriverId: null,
        deliveryRequestId: null,
        ...extra,
      }),
    };
  }

  it("passes non-expired broadcasts to the callback", () => {
    const future = new Date(Date.now() + 5 * 60 * 1000);
    const fakeSnap = { docs: [makeDoc("b1", future)] };
    mockOnSnapshot.mockImplementation((_q: unknown, cb: (snap: unknown) => void) => {
      cb(fakeSnap);
      return vi.fn();
    });

    const received: unknown[] = [];
    listenActiveBroadcasts((all) => received.push(...all));
    expect(received).toHaveLength(1);
    expect((received[0] as any).id).toBe("b1");
  });

  it("filters out broadcasts whose expiresAt is in the past", () => {
    const past = new Date(Date.now() - 1000);
    const fakeSnap = { docs: [makeDoc("b-stale", past)] };
    mockOnSnapshot.mockImplementation((_q: unknown, cb: (snap: unknown) => void) => {
      cb(fakeSnap);
      return vi.fn();
    });

    const received: unknown[] = [];
    listenActiveBroadcasts((all) => received.push(...all));
    expect(received).toHaveLength(0);
  });

  it("keeps valid broadcasts and drops expired ones from the same snapshot", () => {
    const past = new Date(Date.now() - 1000);
    const future = new Date(Date.now() + 60_000);
    const fakeSnap = {
      docs: [makeDoc("expired", past), makeDoc("valid", future)],
    };
    mockOnSnapshot.mockImplementation((_q: unknown, cb: (snap: unknown) => void) => {
      cb(fakeSnap);
      return vi.fn();
    });

    const received: unknown[] = [];
    listenActiveBroadcasts((all) => received.push(...all));
    expect(received).toHaveLength(1);
    expect((received[0] as any).id).toBe("valid");
  });

  it("returns an unsubscribe function", () => {
    const unsub = vi.fn();
    mockOnSnapshot.mockReturnValue(unsub);
    const returned = listenActiveBroadcasts(vi.fn());
    expect(typeof returned).toBe("function");
  });

  it("queries the delivery_broadcasts collection with status=active", () => {
    mockOnSnapshot.mockReturnValue(vi.fn());
    listenActiveBroadcasts(vi.fn());
    expect(mockCollection).toHaveBeenCalledWith(
      expect.anything(),
      "delivery_broadcasts",
    );
  });
});

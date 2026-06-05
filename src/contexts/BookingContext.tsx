import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { auth, db } from "@/integrations/firebase/client";
import {
  addDoc,
  collection,
  getDoc,
  serverTimestamp,
  Timestamp,
  doc,
  updateDoc,
} from "firebase/firestore";
import { estimatePriceNgN, estimateTimeMinutes } from "@/lib/pricing";
import { haversineKm } from "@/lib/haversine";
import { TRANSPORT_OPTIONS } from "@/lib/transportOptions";
import type {
  AssignedDriver,
  BookingState,
  LocationCoords,
  RideStatus,
  TransportOption,
} from "@/types/booking";
import { BOOKING_STORAGE_KEY } from "@/types/booking";

// BookingState no longer includes isPanelOpen — it lives in its own useState
// so that openPanel()/closePanel() don't trigger a full state object mutation
// and don't cause the data-only parts of the context to re-memo.
type BookingData = Omit<BookingState, "isPanelOpen">;

function getDefaultData(): BookingData {
  return {
    pickup: { address: "", lat: null, lon: null },
    dropoff: { address: "", lat: null, lon: null },
    distanceKm: null,
    estimatedTimeMinutes: null,
    basePrice: null,
    selectedTransport: null,
    rideStatus: "idle",
    requestId: null,
    assignmentId: null,
    driver: null,
  };
}

function loadSavedState(): Partial<BookingData> | null {
  try {
    const raw = localStorage.getItem(BOOKING_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<BookingData>;
    if (
      parsed.pickup &&
      parsed.dropoff &&
      parsed.pickup.lat != null &&
      parsed.dropoff.lat != null
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

// Serialise only the fields worth persisting (isPanelOpen is intentionally excluded)
function persistFields(data: BookingData) {
  return {
    pickup: data.pickup,
    dropoff: data.dropoff,
    distanceKm: data.distanceKm,
    estimatedTimeMinutes: data.estimatedTimeMinutes,
    basePrice: data.basePrice,
    selectedTransport: data.selectedTransport,
    rideStatus: data.rideStatus,
    requestId: data.requestId,
    assignmentId: data.assignmentId,
    driver: data.driver,
  };
}

function saveState(data: BookingData) {
  try {
    localStorage.setItem(BOOKING_STORAGE_KEY, JSON.stringify(persistFields(data)));
  } catch {
    // ignore quota errors
  }
}

function clearSavedState() {
  try {
    localStorage.removeItem(BOOKING_STORAGE_KEY);
  } catch {
    // ignore
  }
}

// ── Distance helper ────────────────────────────────────────────────────────────

function calcDistance(
  pickup: LocationCoords,
  dropoff: LocationCoords
): { distanceKm: number; estimatedTimeMinutes: number; basePrice: number } | null {
  if (
    pickup.lat == null || pickup.lon == null ||
    dropoff.lat == null || dropoff.lon == null
  ) return null;
  const distanceKm = haversineKm(pickup.lat, pickup.lon, dropoff.lat, dropoff.lon);
  return {
    distanceKm,
    estimatedTimeMinutes: estimateTimeMinutes(distanceKm),
    basePrice: estimatePriceNgN(distanceKm, "economy"),
  };
}

// ── Context types ──────────────────────────────────────────────────────────────

interface BookingContextValue extends BookingData {
  isPanelOpen: boolean;
  setPickup: (v: LocationCoords) => void;
  setDropoff: (v: LocationCoords) => void;
  setLocations: (pickup: LocationCoords, dropoff: LocationCoords) => void;
  selectTransport: (option: TransportOption | null) => void;
  openPanel: () => void;
  closePanel: () => void;
  startBooking: () => Promise<boolean>;
  setRideStatus: (status: RideStatus) => void;
  setDriver: (driver: AssignedDriver | null) => void;
  cancelRide: () => Promise<void>;
  resetBooking: () => void;
  resumeFromStorage: () => boolean;
  transportOptions: TransportOption[];
  estimatedPriceForOption: (option: TransportOption) => number | null;
  estimatedTimeForOption: (option: TransportOption) => number | null;
}

const BookingContext = createContext<BookingContextValue | null>(null);

// ── Provider ───────────────────────────────────────────────────────────────────

export function BookingProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<BookingData>(() => {
    const saved = loadSavedState();
    if (saved) return { ...getDefaultData(), ...saved };
    return getDefaultData();
  });

  // isPanelOpen is separated so opening/closing the panel doesn't mutate the
  // data object and doesn't cause the booking-data useMemo to re-run.
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  // A ref that always holds the latest data — lets startBooking and cancelRide
  // have empty dependency arrays (stable references) while still reading fresh state.
  const dataRef = useRef(data);
  dataRef.current = data;

  // ── Debounced localStorage write ─────────────────────────────────────────────
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleSave = useCallback((next: BookingData) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => saveState(next), 150);
  }, []);

  // ── State updater ────────────────────────────────────────────────────────────
  const updateData = useCallback(
    (patch: Partial<BookingData>) => {
      setData((prev) => {
        const next = { ...prev, ...patch };
        scheduleSave(next);
        return next;
      });
    },
    [scheduleSave]
  );

  // ── Location setters (each extracts the haversine result in-place) ───────────
  const setPickup = useCallback(
    (v: LocationCoords) => {
      setData((prev) => {
        const dist = calcDistance(v, prev.dropoff);
        const next: BookingData = {
          ...prev,
          pickup: v,
          distanceKm: dist?.distanceKm ?? null,
          estimatedTimeMinutes: dist?.estimatedTimeMinutes ?? null,
          basePrice: dist?.basePrice ?? null,
        };
        scheduleSave(next);
        return next;
      });
    },
    [scheduleSave]
  );

  const setDropoff = useCallback(
    (v: LocationCoords) => {
      setData((prev) => {
        const dist = calcDistance(prev.pickup, v);
        const next: BookingData = {
          ...prev,
          dropoff: v,
          distanceKm: dist?.distanceKm ?? null,
          estimatedTimeMinutes: dist?.estimatedTimeMinutes ?? null,
          basePrice: dist?.basePrice ?? null,
        };
        scheduleSave(next);
        return next;
      });
    },
    [scheduleSave]
  );

  const setLocations = useCallback(
    (pickup: LocationCoords, dropoff: LocationCoords) => {
      setData((prev) => {
        const dist = calcDistance(pickup, dropoff);
        const next: BookingData = {
          ...prev,
          pickup,
          dropoff,
          distanceKm: dist?.distanceKm ?? null,
          estimatedTimeMinutes: dist?.estimatedTimeMinutes ?? null,
          basePrice: dist?.basePrice ?? null,
        };
        scheduleSave(next);
        return next;
      });
    },
    [scheduleSave]
  );

  const selectTransport = useCallback(
    (option: TransportOption | null) => updateData({ selectedTransport: option }),
    [updateData]
  );

  // ── Panel control — only touch isPanelOpen, never the data object ─────────────
  const openPanel = useCallback(() => setIsPanelOpen(true), []);
  const closePanel = useCallback(() => setIsPanelOpen(false), []);

  // ── Ride status / driver ─────────────────────────────────────────────────────
  const setRideStatus = useCallback(
    (rideStatus: RideStatus) => updateData({ rideStatus }),
    [updateData]
  );

  const setDriver = useCallback(
    (driver: AssignedDriver | null) => updateData({ driver }),
    [updateData]
  );

  // ── Async actions — use dataRef so dep arrays can stay empty ─────────────────
  const startBooking = useCallback(async (): Promise<boolean> => {
    const user = auth.currentUser;
    if (!user) return false;

    const { pickup, dropoff, selectedTransport, basePrice } = dataRef.current;
    if (!pickup.lat || !pickup.lon || !dropoff.lat || !dropoff.lon || !selectedTransport) {
      return false;
    }

    const estimatedPrice = basePrice
      ? Math.round(basePrice * selectedTransport.priceMultiplier)
      : null;

    const isCompany = selectedTransport.driverMode === "company";
    const isSelf = selectedTransport.driverMode === "self";

    let customerName: string | null = null;
    let customerPhone: string | null = null;
    try {
      const userSnap = await getDoc(doc(db, "users", user.uid));
      if (userSnap.exists()) {
        const u = userSnap.data() as any;
        customerName = [u.firstName, u.lastName].filter(Boolean).join(" ") || null;
        customerPhone = u.phone ?? null;
      }
    } catch { /* non-critical */ }

    const docRef = await addDoc(collection(db, "delivery_requests"), {
      customerId: user.uid,
      customerName,
      customerPhone,
      pickup: { address: pickup.address, lat: pickup.lat, lng: pickup.lon },
      dropoff: { address: dropoff.address, lat: dropoff.lat, lng: dropoff.lon },
      transportType: selectedTransport.id,
      driverMode: selectedTransport.driverMode,
      driverType: isCompany ? "company_driver" : isSelf ? "self_driver" : null,
      workflowOwner: isCompany ? "company" : "admin",
      ...(isCompany ? {
        companyAssignmentStatus: "open",
        quoteExpiresAt: Timestamp.fromMillis(Date.now() + 30 * 60 * 1000),
      } : {}),
      status: "pending",
      isScheduled: false,
      estimatedPrice,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    updateData({ requestId: docRef.id, rideStatus: "searching" });
    return true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateData]); // dataRef.current is read at call-time, not captured

  const cancelRide = useCallback(async () => {
    const { requestId } = dataRef.current;
    if (requestId) {
      await updateDoc(doc(db, "delivery_requests", requestId), {
        status: "cancelled",
        updatedAt: serverTimestamp(),
      });
    }
    updateData({ rideStatus: "cancelled", requestId: null, assignmentId: null, driver: null });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateData]); // dataRef.current is read at call-time, not captured

  const resetBooking = useCallback(() => {
    clearSavedState();
    setData(getDefaultData());
  }, []);

  const resumeFromStorage = useCallback((): boolean => {
    const saved = loadSavedState();
    if (!saved) return false;
    setData((prev) => ({ ...prev, ...saved }));
    setIsPanelOpen(true);
    return true;
  }, []);

  // ── Computed price/time helpers — stable unless base values change ────────────
  const estimatedPriceForOption = useCallback(
    (option: TransportOption): number | null => {
      const { basePrice } = dataRef.current;
      if (basePrice == null) return null;
      return Math.round(basePrice * option.priceMultiplier);
    },
    [] // reads dataRef at call-time; consumers re-render via data change anyway
  );

  const estimatedTimeForOption = useCallback(
    (option: TransportOption): number | null => {
      const { estimatedTimeMinutes } = dataRef.current;
      if (estimatedTimeMinutes == null) return null;
      return estimatedTimeMinutes + option.etaMinutesOffset;
    },
    [] // same pattern
  );

  // ── Context value ─────────────────────────────────────────────────────────────
  // Only re-memos when booking data or panel state changes.
  // All action callbacks are stable (empty or minimal deps) so they don't
  // contribute to unnecessary re-renders of consumers.
  const value = useMemo<BookingContextValue>(
    () => ({
      ...data,
      isPanelOpen,
      setPickup,
      setDropoff,
      setLocations,
      selectTransport,
      openPanel,
      closePanel,
      startBooking,
      setRideStatus,
      setDriver,
      cancelRide,
      resetBooking,
      resumeFromStorage,
      transportOptions: TRANSPORT_OPTIONS,
      estimatedPriceForOption,
      estimatedTimeForOption,
    }),
    // Stable callbacks don't need to be listed — they never change reference.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, isPanelOpen]
  );

  return (
    <BookingContext.Provider value={value}>{children}</BookingContext.Provider>
  );
}

export function useBooking() {
  const ctx = useContext(BookingContext);
  if (!ctx) throw new Error("useBooking must be used within BookingProvider");
  return ctx;
}

export function useBookingOptional() {
  return useContext(BookingContext);
}

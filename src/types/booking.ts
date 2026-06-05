// Booking / ride lifecycle and UI state
//
// NOTE: RideStatus is the *UI* state used by BookingContext and the booking sheet
// flow (legacy ride-hailing UX). The authoritative delivery state is DeliveryStatus
// in src/services/firebase.ts, which is persisted to Firestore and drives all
// dashboards and the DeliveryTracking component.
// Use deliveryStatusToRideStatus() when you need to map a Firestore status to
// this UI enum (e.g., for the legacy booking sheet).

export type RideStatus =
  | "idle"
  | "vehicle_selected"
  | "searching"
  | "driver_found"
  | "driver_arriving"
  | "trip_started"
  | "completed"
  | "cancelled";

export type TransportOptionId =
  | "economy"
  | "premium"
  | "xl"
  | "self_driver"
  | "company_driver";

export type DriverMode = "self" | "company";

export interface LocationCoords {
  address: string;
  lat: number | null;
  lon: number | null;
}

export interface TransportOption {
  id: TransportOptionId;
  label: string;
  description: string;
  seats: number;
  priceMultiplier: number;
  etaMinutesOffset: number;
  icon: string; // lucide name or component id
  driverMode: DriverMode | null; // null = any, "self" | "company"
}

export interface BookingState {
  pickup: LocationCoords;
  dropoff: LocationCoords;
  distanceKm: number | null;
  estimatedTimeMinutes: number | null;
  basePrice: number | null;
  selectedTransport: TransportOption | null;
  rideStatus: RideStatus;
  requestId: string | null;
  assignmentId: string | null;
  driver: AssignedDriver | null;
  isPanelOpen: boolean;
}

export interface AssignedDriver {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  avatar_url?: string | null;
  selfie_url?: string | null;
  car_model: string;
  plate_number: string;
  rating: number;
  distanceAwayKm: number;
  etaMinutes: number;
  vehicle_type: string;
  current_latitude: number | null;
  current_longitude: number | null;
}

export const BOOKING_STORAGE_KEY = "pilnak_booking_state";

// Maps a Firestore DeliveryStatus to the nearest UI RideStatus so legacy
// booking-sheet components can consume it without importing firebase types.
export function deliveryStatusToRideStatus(status: string): RideStatus {
  switch (status) {
    case "pending":
    case "admin_review":
    case "negotiating_price":
    case "price_set":
    case "payment_pending":
    case "customer_confirmed":
    case "driver_assigned":
      return "searching";
    case "driver_accepted":
      return "driver_found";
    case "in_progress":
      return "trip_started";
    case "arrived":
      return "driver_arriving";
    case "awaiting_signature":
    case "completed":
      return "completed";
    case "cancelled":
      return "cancelled";
    default:
      return "idle";
  }
}

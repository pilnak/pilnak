// Distance-based pricing with vehicle multipliers

const BASE_FARE_NGN = 500;
const PER_KM_NGN = 150;

// Legacy ride-hailing tiers (used by BookingContext)
type LegacyTier = "economy" | "premium" | "xl" | "heavy";

// Freight vehicle types
export type FreightVehicleType =
  | "cargo_van"
  | "box_truck"
  | "dry_van"
  | "flatbed"
  | "reefer"
  | "power_only"
  | "auto_transport";

export type VehicleTier = LegacyTier | FreightVehicleType;

const MULTIPLIERS: Record<VehicleTier, number> = {
  // Legacy tiers
  economy: 1,
  premium: 1.5,
  xl: 2,
  heavy: 3,
  // Freight vehicle types
  cargo_van: 1.2,
  box_truck: 1.8,
  dry_van: 2.0,
  flatbed: 2.5,
  reefer: 2.5,
  power_only: 3.0,
  auto_transport: 3.0,
};

// Lagos traffic-aware speed tiers (km/h)
// Peak: 7–9am and 4–7pm weekdays; Off-peak: everything else; Night: 10pm–5am
function getAverageSpeedKmh(date: Date = new Date()): number {
  const hour = date.getHours();
  const isWeekday = date.getDay() >= 1 && date.getDay() <= 5;
  if (hour >= 22 || hour < 5) return 45; // night — light traffic
  if (isWeekday && ((hour >= 7 && hour < 9) || (hour >= 16 && hour < 19))) return 15; // peak
  return 30; // off-peak
}

export function estimatePriceNgN(
  distanceKm: number,
  tier: VehicleTier = "economy"
): number {
  const multiplier = MULTIPLIERS[tier] ?? 1;
  return Math.round((BASE_FARE_NGN + distanceKm * PER_KM_NGN) * multiplier);
}

export function estimateTimeMinutes(distanceKm: number, at?: Date): number {
  const speed = getAverageSpeedKmh(at);
  return Math.round((distanceKm / speed) * 60);
}

export function getBaseFare(): number {
  return BASE_FARE_NGN;
}

export function getPerKmRate(): number {
  return PER_KM_NGN;
}

export function getMultiplier(tier: VehicleTier): number {
  return MULTIPLIERS[tier] ?? 1;
}

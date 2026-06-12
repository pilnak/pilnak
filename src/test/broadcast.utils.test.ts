import { describe, it, expect } from "vitest";
import { haversineKm } from "@/services/firebase";
import {
  estimatePriceNgN,
  estimateTimeMinutes,
  getBaseFare,
  getPerKmRate,
  getMultiplier,
} from "@/lib/pricing";

// ── haversineKm ───────────────────────────────────────────────────────────────

describe("haversineKm", () => {
  it("returns 0 for the same point", () => {
    expect(haversineKm(6.5244, 3.3792, 6.5244, 3.3792)).toBe(0);
  });

  it("returns a positive distance for different points", () => {
    const dist = haversineKm(6.5244, 3.3792, 6.6018, 3.3515);
    expect(dist).toBeGreaterThan(0);
  });

  it("is symmetric — swapping start/end gives the same distance", () => {
    const a = haversineKm(6.5244, 3.3792, 6.9, 3.7);
    const b = haversineKm(6.9, 3.7, 6.5244, 3.3792);
    expect(a).toBeCloseTo(b, 6);
  });

  it("returns roughly 1 km for points ~1 km apart", () => {
    // 0.009° latitude ≈ 1 km
    const dist = haversineKm(6.5244, 3.3792, 6.5334, 3.3792);
    expect(dist).toBeGreaterThan(0.9);
    expect(dist).toBeLessThan(1.1);
  });

  it("classifies a 10 km radius boundary correctly", () => {
    const within = haversineKm(6.5244, 3.3792, 6.5244, 3.4688); // ~9.7 km east
    const outside = haversineKm(6.5244, 3.3792, 6.5244, 3.5);   // ~11.9 km east
    expect(within).toBeLessThanOrEqual(10);
    expect(outside).toBeGreaterThan(10);
  });
});

// ── estimatePriceNgN ──────────────────────────────────────────────────────────

describe("estimatePriceNgN", () => {
  it("applies the base fare for 0 km", () => {
    expect(estimatePriceNgN(0)).toBe(getBaseFare());
  });

  it("adds per-km rate on top of base fare", () => {
    const expected = Math.round(getBaseFare() + 5 * getPerKmRate());
    expect(estimatePriceNgN(5)).toBe(expected);
  });

  it("economy multiplier is 1× (no change)", () => {
    expect(estimatePriceNgN(10, "economy")).toBe(
      Math.round(getBaseFare() + 10 * getPerKmRate()),
    );
  });

  it("premium multiplier is 1.5×", () => {
    const base = getBaseFare() + 10 * getPerKmRate();
    expect(estimatePriceNgN(10, "premium")).toBe(Math.round(base * 1.5));
  });

  it("xl multiplier is 2×", () => {
    const base = getBaseFare() + 10 * getPerKmRate();
    expect(estimatePriceNgN(10, "xl")).toBe(Math.round(base * 2));
  });

  it("price scales linearly with distance", () => {
    const p5 = estimatePriceNgN(5);
    const p10 = estimatePriceNgN(10);
    // p10 - p5 should equal 5 * PER_KM_RATE (rounded individually so allow ±1)
    expect(p10 - p5).toBeCloseTo(5 * getPerKmRate(), 0);
  });

  it("price is always positive", () => {
    expect(estimatePriceNgN(0)).toBeGreaterThan(0);
    expect(estimatePriceNgN(100, "xl")).toBeGreaterThan(0);
  });
});

describe("getMultiplier", () => {
  it("returns 1 for economy", () => expect(getMultiplier("economy")).toBe(1));
  it("returns 1.5 for premium", () => expect(getMultiplier("premium")).toBe(1.5));
  it("returns 2 for xl", () => expect(getMultiplier("xl")).toBe(2));
});

describe("estimateTimeMinutes", () => {
  it("returns 0 for 0 km", () => expect(estimateTimeMinutes(0)).toBe(0));
  it("returns 2 minutes for 1 km at 30 km/h", () => expect(estimateTimeMinutes(1)).toBe(2));
  it("returns 60 minutes for 30 km at 30 km/h", () => expect(estimateTimeMinutes(30)).toBe(60));
});

// ── Broadcast expiry logic ────────────────────────────────────────────────────

describe("broadcast expiry logic", () => {
  const BROADCAST_TTL_MS = 10 * 60 * 1000;

  function isBroadcastExpired(expiresAt: Date, now = new Date()): boolean {
    return expiresAt <= now;
  }

  it("TTL constant is 10 minutes in milliseconds", () => {
    expect(BROADCAST_TTL_MS).toBe(600_000);
  });

  it("a broadcast expiring in the future is not expired", () => {
    const future = new Date(Date.now() + 5 * 60 * 1000);
    expect(isBroadcastExpired(future)).toBe(false);
  });

  it("a broadcast whose expiresAt is in the past is expired", () => {
    const past = new Date(Date.now() - 1000);
    expect(isBroadcastExpired(past)).toBe(true);
  });

  it("a broadcast expiring exactly now is expired", () => {
    const now = new Date();
    expect(isBroadcastExpired(now, now)).toBe(true);
  });

  it("a fresh broadcast has ~10 min left", () => {
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + BROADCAST_TTL_MS);
    const remaining = expiresAt.getTime() - createdAt.getTime();
    expect(remaining).toBe(BROADCAST_TTL_MS);
  });
});

// ── Broadcast proximity filter ─────────────────────────────────────────────

describe("broadcast proximity filter (driver-side)", () => {
  const RADIUS_KM = 10;

  interface MinBroadcast {
    transportType: string;
    pickup: { lat: number; lng: number };
  }

  function isNearbyBroadcast(
    b: MinBroadcast,
    driverLat: number,
    driverLng: number,
    vehicleType: string,
  ): boolean {
    if (b.transportType !== vehicleType) return false;
    if (!b.pickup?.lat || !b.pickup?.lng) return false;
    return haversineKm(driverLat, driverLng, b.pickup.lat, b.pickup.lng) <= RADIUS_KM;
  }

  const driver = { lat: 6.5244, lng: 3.3792 };

  it("includes a matching broadcast within 10 km", () => {
    const b: MinBroadcast = { transportType: "cargo_van", pickup: { lat: 6.53, lng: 3.38 } };
    expect(isNearbyBroadcast(b, driver.lat, driver.lng, "cargo_van")).toBe(true);
  });

  it("excludes a broadcast beyond 10 km", () => {
    const b: MinBroadcast = { transportType: "cargo_van", pickup: { lat: 6.7, lng: 3.5 } };
    expect(isNearbyBroadcast(b, driver.lat, driver.lng, "cargo_van")).toBe(false);
  });

  it("excludes a broadcast with a different vehicle type", () => {
    const b: MinBroadcast = { transportType: "dry_van", pickup: { lat: 6.53, lng: 3.38 } };
    expect(isNearbyBroadcast(b, driver.lat, driver.lng, "cargo_van")).toBe(false);
  });

  it("excludes a broadcast with missing pickup coordinates", () => {
    const b = { transportType: "cargo_van", pickup: { lat: 0, lng: 0 } };
    expect(isNearbyBroadcast(b, driver.lat, driver.lng, "cargo_van")).toBe(false);
  });

  it("includes when the broadcast is exactly at the driver location", () => {
    const b: MinBroadcast = { transportType: "cargo_van", pickup: driver };
    expect(isNearbyBroadcast(b, driver.lat, driver.lng, "cargo_van")).toBe(true);
  });
});

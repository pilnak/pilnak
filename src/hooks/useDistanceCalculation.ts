import { useMemo } from 'react';

interface DistanceResult {
  distanceKm: number | null;
  distanceText: string;
  estimatedTime: string;
  estimatedPrice: number | null;
}

export function useDistanceCalculation(
  pickupLat: number | null,
  pickupLon: number | null,
  dropoffLat: number | null,
  dropoffLon: number | null
): DistanceResult {
  return useMemo(() => {
    if (!pickupLat || !pickupLon || !dropoffLat || !dropoffLon) {
      return {
        distanceKm: null,
        distanceText: '',
        estimatedTime: '',
        estimatedPrice: null,
      };
    }

    // Haversine formula to calculate distance between two points
    const R = 6371; // Earth's radius in km
    const dLat = toRad(dropoffLat - pickupLat);
    const dLon = toRad(dropoffLon - pickupLon);
    const lat1 = toRad(pickupLat);
    const lat2 = toRad(dropoffLat);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceKm = R * c;

    // Format distance
    const distanceText = distanceKm < 1 
      ? `${Math.round(distanceKm * 1000)} m` 
      : `${distanceKm.toFixed(1)} km`;

    // Estimate time (assuming average speed of 30 km/h in city traffic)
    const timeHours = distanceKm / 30;
    const timeMinutes = Math.round(timeHours * 60);
    const estimatedTime = timeMinutes < 60 
      ? `${timeMinutes} min` 
      : `${Math.floor(timeMinutes / 60)}h ${timeMinutes % 60}min`;

    // Estimate price (base fare + per km rate)
    const baseFare = 500; // NGN
    const perKmRate = 150; // NGN per km
    const estimatedPrice = Math.round(baseFare + (distanceKm * perKmRate));

    return {
      distanceKm,
      distanceText,
      estimatedTime,
      estimatedPrice,
    };
  }, [pickupLat, pickupLon, dropoffLat, dropoffLon]);
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

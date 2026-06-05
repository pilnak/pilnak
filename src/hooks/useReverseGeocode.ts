import { useState, useEffect } from 'react';

interface GeocodedLocation {
  displayName: string;
  city: string;
  state: string;
  country: string;
  isLoading: boolean;
  error: string | null;
}

export function useReverseGeocode(latitude: number | null, longitude: number | null): GeocodedLocation {
  const [location, setLocation] = useState<GeocodedLocation>({
    displayName: '',
    city: '',
    state: '',
    country: '',
    isLoading: false,
    error: null,
  });

  useEffect(() => {
    if (!latitude || !longitude) {
      setLocation(prev => ({ ...prev, displayName: '', isLoading: false }));
      return;
    }

    const fetchLocationName = async () => {
      setLocation(prev => ({ ...prev, isLoading: true, error: null }));

      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
          {
            headers: {
              'Accept-Language': 'en',
              // Required by Nominatim usage policy — identify your app
              'User-Agent': 'Pilnak Delivery App (contact@pilnak.com)',
            },
          }
        );

        if (!response.ok) {
          throw new Error(`Nominatim error: ${response.status}`);
        }

        const data = await response.json();

        if (data.error) {
          throw new Error(data.error);
        }

        const address = data.address || {};

        const city = address.city || address.town || address.village || address.municipality || '';
        const state = address.state || address.region || '';
        const country = address.country || '';
        const road = address.road || address.street || '';
        const neighbourhood = address.neighbourhood || address.suburb || '';

        let displayName = '';

        if (road && neighbourhood) {
          displayName = `${road}, ${neighbourhood}`;
        } else if (road) {
          displayName = road;
        } else if (neighbourhood) {
          displayName = neighbourhood;
        } else if (city) {
          displayName = city;
        }

        if (city && displayName !== city) {
          displayName = displayName ? `${displayName}, ${city}` : city;
        }

        setLocation({
          displayName: displayName || data.display_name?.split(',').slice(0, 2).join(',') || 'Unknown location',
          city,
          state,
          country,
          isLoading: false,
          error: null,
        });
      } catch (err) {
        console.error('Reverse geocode error:', err);
        setLocation(prev => ({
          ...prev,
          displayName: '',
          isLoading: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        }));
      }
    };

    fetchLocationName();
  }, [latitude, longitude]);

  return location;
}
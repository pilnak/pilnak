import { useState, useCallback, useRef, useEffect } from "react";

export interface LocationSuggestion {
  place_id: string;
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    road?: string;
    house_number?: string;
    neighbourhood?: string;
    suburb?: string;
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    country?: string;
  };
}

interface UseLocationSearchResult {
  suggestions: LocationSuggestion[];
  isLoading: boolean;
  error: string | null;
  search: (query: string) => void;
  clearSuggestions: () => void;
}

// ── Bootstrap Google Maps (new weekly channel) ────────────────────────────────

let bootstrapPromise: Promise<void> | null = null;

export function bootstrapGoogleMaps(): Promise<void> {
  if (bootstrapPromise) return bootstrapPromise;

  bootstrapPromise = new Promise<void>((resolve, reject) => {
    if ((window as any).google?.maps?.importLibrary) {
      resolve();
      return;
    }

    const existing = document.querySelector(
      'script[src*="maps.googleapis.com"]'
    ) as HTMLScriptElement | null;

    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Google Maps script failed")));
      return;
    }

    const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? "";
    (window as any).__googleMapsCallback = () => resolve();

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places&v=weekly&callback=__googleMapsCallback`;
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(script);
  });

  return bootstrapPromise;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useLocationSearch(): UseLocationSearchResult {
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // cancelRef holds a flag for the most-recently-started search.
  // Any in-flight async work checks this before writing state.
  const cancelRef = useRef<{ cancelled: boolean }>({ cancelled: false });

  useEffect(() => {
    bootstrapGoogleMaps().catch(() => {});
  }, []);

  const search = useCallback((query: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    // Cancel whatever async chain is still running from the previous call
    cancelRef.current.cancelled = true;

    if (query.length < 2) {
      setSuggestions([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      // Create a new cancel token for this invocation
      const token = { cancelled: false };
      cancelRef.current = token;

      setIsLoading(true);
      setError(null);

      try {
        await bootstrapGoogleMaps();
        if (token.cancelled) return;

        const { AutocompleteSessionToken, AutocompleteSuggestion } =
          await (window as any).google.maps.importLibrary("places");

        const sessionToken = new AutocompleteSessionToken();

        const { suggestions: raw } =
          await AutocompleteSuggestion.fetchAutocompleteSuggestions({
            input: query,
            sessionToken,
            includedRegionCodes: ["ng"],
          });

        if (token.cancelled) return;

        if (!raw?.length) {
          setSuggestions([]);
          setIsLoading(false);
          return;
        }

        // Resolve suggestions progressively — show each result as soon as it lands
        const pending = (raw as any[]).slice(0, 5);
        const resolved: LocationSuggestion[] = [];

        await Promise.all(
          pending.map(async (s) => {
            if (token.cancelled) return;
            try {
              const place = s.placePrediction.toPlace();
              await place.fetchFields({
                fields: ["displayName", "formattedAddress", "location"],
              });
              if (token.cancelled) return;

              const lat = place.location?.lat?.() ?? 0;
              const lng = place.location?.lng?.() ?? 0;

              resolved.push({
                place_id: place.id ?? s.placePrediction.placeId,
                display_name: place.formattedAddress ?? place.displayName ?? query,
                lat: lat.toString(),
                lon: lng.toString(),
              });

              // Update state immediately so results appear as they arrive
              if (!token.cancelled) setSuggestions([...resolved]);
            } catch {
              // skip failed suggestions
            }
          })
        );

        if (!token.cancelled && resolved.length === 0) setSuggestions([]);
      } catch (err: any) {
        if (token.cancelled) return;
        console.error("Places search error:", err);
        setError("Failed to fetch suggestions");
        setSuggestions([]);
      } finally {
        if (!token.cancelled) setIsLoading(false);
      }
    }, 200);
  }, []);

  const clearSuggestions = useCallback(() => {
    // Cancel any in-flight search so it can't overwrite the cleared list
    cancelRef.current.cancelled = true;
    setSuggestions([]);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      cancelRef.current.cancelled = true;
    };
  }, []);

  return { suggestions, isLoading, error, search, clearSuggestions };
}

// ── formatLocationName ────────────────────────────────────────────────────────

export function formatLocationName(suggestion: LocationSuggestion): string {
  const a = suggestion.address ?? {};
  const parts: string[] = [];

  if (a.house_number && a.road) {
    parts.push(`${a.house_number} ${a.road}`);
  } else if (a.road) {
    parts.push(a.road);
  } else if (a.neighbourhood) {
    parts.push(a.neighbourhood);
  } else if (a.suburb) {
    parts.push(a.suburb);
  }

  const city = a.city ?? a.town ?? a.village;
  if (city && !parts.includes(city)) parts.push(city);
  if (a.state && !parts.includes(a.state)) parts.push(a.state);

  if (parts.length > 0) return parts.join(", ");

  // No address components — use the first 3 comma-separated parts of display_name
  return suggestion.display_name.split(",").slice(0, 3).join(",").trim();
}
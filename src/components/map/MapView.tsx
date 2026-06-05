import { useEffect, useRef, useState, useCallback } from 'react';
import { haversineKm } from '@/lib/haversine';

// ── Types ────────────────────────────────────────────────────────────────────

export interface MapMarker {
  id: string;
  latitude: number;
  longitude: number;
  type: 'user' | 'driver' | 'pickup' | 'dropoff';
  label?: string;
  meta?: string;
  data?: unknown;
}

export interface SearchPin {
  lat: number;
  lng: number;
  label?: string;
}

interface MapViewProps {
  center?: [number, number];
  zoom?: number;
  markers?: MapMarker[];
  onMarkerClick?: (marker: MapMarker) => void;
  className?: string;
  showUserLocation?: boolean;
  userLatitude?: number | null;
  userLongitude?: number | null;
  routeFrom?: [number, number];
  routeTo?: [number, number];
  searchPin?: SearchPin | null;
  onMapClick?: (lat: number, lng: number) => void;
  liveTrackUrl?: string;
  hideExternalLink?: boolean;
  onLiveTrack?: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildGoogleMapsUrl(from: [number, number], to: [number, number]): string {
  return `https://www.google.com/maps/dir/?api=1&origin=${from[0]},${from[1]}&destination=${to[0]},${to[1]}&travelmode=driving`;
}

// ── Off-route detection helpers ───────────────────────────────────────────────

// Minimum distance from a point to a polyline (array of lat/lng segments)
function distToRouteKm(lat: number, lng: number, path: Array<{ lat: number; lng: number }>): number {
  if (path.length === 0) return Infinity;
  if (path.length === 1) return haversineKm(lat, lng, path[0].lat, path[0].lng);
  let min = Infinity;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i], b = path[i + 1];
    const dx = b.lng - a.lng, dy = b.lat - a.lat;
    const lenSq = dx * dx + dy * dy;
    const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((lng - a.lng) * dx + (lat - a.lat) * dy) / lenSq));
    const d = haversineKm(lat, lng, a.lat + t * dy, a.lng + t * dx);
    if (d < min) min = d;
  }
  return min;
}

// ── Marker SVG pin builders ───────────────────────────────────────────────────

function makePinSvg(bg: string, label: string): string {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="38" height="48" viewBox="0 0 38 48">
      <path d="M19 0C8.507 0 0 8.507 0 19c0 13.255 19 29 19 29S38 32.255 38 19C38 8.507 29.493 0 19 0z" fill="${bg}" stroke="#fff" stroke-width="2"/>
      <circle cx="19" cy="19" r="9" fill="white" fill-opacity="0.3"/>
      <text x="19" y="23" text-anchor="middle" font-size="12" font-weight="bold" fill="white" font-family="sans-serif">${label}</text>
    </svg>`;
}

function makeDriverSvg(): string {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="44" height="54" viewBox="0 0 44 54">
      <circle cx="22" cy="22" r="22" fill="#1e3a5f" fill-opacity="0.2"/>
      <path d="M22 4C12.611 4 5 11.611 5 21c0 12.728 17 29 17 29S39 33.728 39 21C39 11.611 31.389 4 22 4z" fill="#1e3a5f" stroke="#fff" stroke-width="2"/>
      <text x="22" y="25" text-anchor="middle" font-size="14" fill="white" font-family="sans-serif">🚗</text>
    </svg>`;
}

function makeSearchSvg(): string {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <circle cx="16" cy="16" r="14" fill="#f59e0b" stroke="#fff" stroke-width="3"/>
      <text x="16" y="21" text-anchor="middle" font-size="14" font-family="sans-serif">📍</text>
    </svg>`;
}

function svgToDataUrl(svg: string): string {
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg.trim());
}

// ── Google Maps script loader ─────────────────────────────────────────────────

let scriptPromise: Promise<void> | null = null;

function loadGoogleMaps(): Promise<void> {
  if (scriptPromise) return scriptPromise;
  if (window.google?.maps) {
    scriptPromise = Promise.resolve();
    return scriptPromise;
  }

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(
      'script[src*="maps.googleapis.com"]'
    ) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject());
      return;
    }
    const script = document.createElement('script');
    const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '';
    (window as any).__googleMapsCallback = () => resolve();
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places,geometry&v=weekly&callback=__googleMapsCallback`;
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error('Failed to load Google Maps'));
    document.head.appendChild(script);
  });

  return scriptPromise;
}

// ── Main component ────────────────────────────────────────────────────────────

export function MapView({
  center = [6.5244, 3.3792],
  zoom = 13,
  markers = [],
  onMarkerClick,
  className = '',
  showUserLocation = true,
  userLatitude,
  userLongitude,
  routeFrom,
  routeTo,
  searchPin,
  onMapClick,
  liveTrackUrl,
  hideExternalLink = false,
  onLiveTrack,
}: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const markersKeyRef = useRef<string>('');
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const lastRouteRef = useRef<{ from: [number, number]; to: [number, number] } | null>(null);
  const routeRequestIdRef = useRef(0);
  const lastRequestTimeRef = useRef(0);
  const routePathRef = useRef<Array<{ lat: number; lng: number }>>([]);
  const searchMarkerRef = useRef<google.maps.Marker | null>(null);
  const userMarkerRef = useRef<google.maps.Marker | null>(null);
  const clickListenerRef = useRef<google.maps.MapsEventListener | null>(null);

  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeInfo, setRouteInfo] = useState<{ duration: string; distance: string } | null>(null);
  const [routeError, setRouteError] = useState(false);

  // ── Load Google Maps SDK ──────────────────────────────────────────────────
  useEffect(() => {
    loadGoogleMaps()
      .then(() => setMapsLoaded(true))
      .catch((err) => console.error(err));
  }, []);

  // ── Init map ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapsLoaded || !mapRef.current || mapInstanceRef.current) return;

    const initialCenter =
      userLatitude && userLongitude
        ? { lat: userLatitude, lng: userLongitude }
        : { lat: center[0], lng: center[1] };

    const map = new google.maps.Map(mapRef.current, {
      center: initialCenter,
      zoom,
      disableDefaultUI: false,
      zoomControl: true,
      zoomControlOptions: {
        // Moves +/− buttons to the top-left corner
        position: google.maps.ControlPosition.LEFT_TOP,
      },
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      // Scroll/pinch zooms immediately — no Ctrl or two-finger wall
      gestureHandling: 'greedy',
      maxZoom: 16,
      styles: [
        { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
      ],
    });

    mapInstanceRef.current = map;

    // ── Traffic layer — shows green/yellow/red on roads ───────────────────
    const trafficLayer = new google.maps.TrafficLayer();
    trafficLayer.setMap(map);

    // ── Directions renderer ───────────────────────────────────────────────
    const renderer = new google.maps.DirectionsRenderer({
      suppressMarkers: true,
      polylineOptions: {
        strokeColor: '#1a73e8',
        strokeWeight: 6,
        strokeOpacity: 1,
      },
    });
    renderer.setMap(map);
    directionsRendererRef.current = renderer;
  }, [mapsLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Click handler ─────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (clickListenerRef.current) {
      google.maps.event.removeListener(clickListenerRef.current);
      clickListenerRef.current = null;
    }

    if (onMapClick) {
      clickListenerRef.current = map.addListener('click', (e: google.maps.MapMouseEvent) => {
        if (e.latLng) onMapClick(e.latLng.lat(), e.latLng.lng());
      });
    }

    return () => {
      if (clickListenerRef.current) {
        google.maps.event.removeListener(clickListenerRef.current);
        clickListenerRef.current = null;
      }
    };
  }, [mapsLoaded, onMapClick]);

  // ── User location marker ──────────────────────────────────────────────────
  useEffect(() => {
    if (!mapsLoaded || !mapInstanceRef.current) return;

    if (showUserLocation && userLatitude && userLongitude) {
      if (userMarkerRef.current) {
        // Smoothly update position without recreating the marker
        userMarkerRef.current.setPosition({ lat: userLatitude, lng: userLongitude });
      } else {
        userMarkerRef.current = new google.maps.Marker({
          position: { lat: userLatitude, lng: userLongitude },
          map: mapInstanceRef.current,
          icon: {
            url: svgToDataUrl(makePinSvg('#00B140', '●')),
            scaledSize: new google.maps.Size(38, 48),
            anchor: new google.maps.Point(19, 48),
          },
          title: 'Your location',
          zIndex: 10,
        });
      }
    } else {
      if (userMarkerRef.current) {
        userMarkerRef.current.setMap(null);
        userMarkerRef.current = null;
      }
    }
  }, [mapsLoaded, showUserLocation, userLatitude, userLongitude]);

  // ── Search pin ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapsLoaded || !mapInstanceRef.current) return;

    if (searchMarkerRef.current) {
      searchMarkerRef.current.setMap(null);
      searchMarkerRef.current = null;
    }

    if (searchPin) {
      searchMarkerRef.current = new google.maps.Marker({
        position: { lat: searchPin.lat, lng: searchPin.lng },
        map: mapInstanceRef.current,
        icon: {
          url: svgToDataUrl(makeSearchSvg()),
          scaledSize: new google.maps.Size(32, 32),
          anchor: new google.maps.Point(16, 16),
        },
        title: searchPin.label ?? 'Searched location',
        zIndex: 9,
      });

      if (searchPin.label) {
        const infoWindow = new google.maps.InfoWindow({ content: searchPin.label });
        searchMarkerRef.current.addListener('click', () =>
          infoWindow.open(mapInstanceRef.current, searchMarkerRef.current!)
        );
      }
    }
  }, [mapsLoaded, searchPin]);

  // ── Custom markers ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapsLoaded || !mapInstanceRef.current) return;

    // Skip full recreation if the meaningful marker data hasn't changed
    const key = markers.map(m => `${m.id}:${m.latitude.toFixed(5)}:${m.longitude.toFixed(5)}:${m.type}`).join('|');
    if (key === markersKeyRef.current) return;
    markersKeyRef.current = key;

    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    markers.forEach((marker) => {
      let iconUrl: string;
      let size = new google.maps.Size(38, 48);
      let anchor = new google.maps.Point(19, 48);

      switch (marker.type) {
        case 'driver':
          iconUrl = svgToDataUrl(makeDriverSvg());
          size = new google.maps.Size(44, 54);
          anchor = new google.maps.Point(22, 54);
          break;
        case 'pickup':
          iconUrl = svgToDataUrl(makePinSvg('#16a34a', 'A'));
          break;
        case 'dropoff':
          iconUrl = svgToDataUrl(makePinSvg('#dc2626', 'B'));
          break;
        default:
          iconUrl = svgToDataUrl(makePinSvg('#00B140', '●'));
      }

      const gMarker = new google.maps.Marker({
        position: { lat: marker.latitude, lng: marker.longitude },
        map: mapInstanceRef.current!,
        icon: { url: iconUrl, scaledSize: size, anchor },
        title: marker.label,
        zIndex: marker.type === 'driver' ? 20 : 5,
      });

      if (marker.label || marker.meta) {
        const content = `<div style="font-size:13px;min-width:120px;">
          ${marker.label ? `<p style="font-weight:600;margin:0 0 4px;">${marker.label}</p>` : ''}
          ${marker.meta ? `<p style="color:#666;margin:0;font-size:11px;">${marker.meta}</p>` : ''}
        </div>`;
        const infoWindow = new google.maps.InfoWindow({ content });
        gMarker.addListener('click', () => {
          infoWindow.open(mapInstanceRef.current, gMarker);
          onMarkerClick?.(marker);
        });
      } else if (onMarkerClick) {
        gMarker.addListener('click', () => onMarkerClick(marker));
      }

      markersRef.current.push(gMarker);
    });
  }, [mapsLoaded, markers, onMarkerClick]);

  // ── Route — fetches once, then only re-routes when driver goes off-route ─────
  useEffect(() => {
    if (!mapsLoaded || !mapInstanceRef.current || !directionsRendererRef.current) return;

    if (!routeFrom || !routeTo) {
      directionsRendererRef.current.setDirections({ routes: [] } as any);
      setRouteInfo(null);
      setRouteError(false);
      lastRouteRef.current = null;
      routePathRef.current = [];
      return;
    }

    const prev = lastRouteRef.current;
    const destChanged = !prev || prev.to[0] !== routeTo[0] || prev.to[1] !== routeTo[1];
    const isFirstFetch = !prev;

    if (!destChanged && routePathRef.current.length > 0) {
      // Driver is on the same leg — check if they're still on the polyline
      const distKm = distToRouteKm(routeFrom[0], routeFrom[1], routePathRef.current);
      if (distKm < 0.075) return; // within 75 m — on-route, nothing to do
      // Beyond 75 m — off-route, fall through and re-route immediately
      lastRequestTimeRef.current = 0;
    }

    // Cooldown guard: prevents re-routing spam right after a fresh route arrives.
    // Bypassed on first fetch, destination change, and off-route (reset above).
    const now = Date.now();
    if (!isFirstFetch && !destChanged && now - lastRequestTimeRef.current < 20000) return;
    lastRequestTimeRef.current = now;

    lastRouteRef.current = { from: [routeFrom[0], routeFrom[1]], to: [routeTo[0], routeTo[1]] };
    const requestId = ++routeRequestIdRef.current;

    setRouteLoading(true);
    setRouteError(false);
    const service = new google.maps.DirectionsService();

    service.route(
      {
        origin:      { lat: routeFrom[0], lng: routeFrom[1] },
        destination: { lat: routeTo[0],   lng: routeTo[1]   },
        travelMode:  google.maps.TravelMode.DRIVING,
        drivingOptions: {
          departureTime: new Date(),
          trafficModel:  google.maps.TrafficModel.BEST_GUESS,
        },
      },
      (result, status) => {
        if (requestId !== routeRequestIdRef.current) return; // stale — discard

        setRouteLoading(false);
        if (status === 'OK' && result) {
          directionsRendererRef.current!.setDirections(result);
          // Store polyline for off-route checks on subsequent GPS pings
          const overviewPath = result.routes[0]?.overview_path ?? [];
          routePathRef.current = overviewPath.map(p => ({ lat: p.lat(), lng: p.lng() }));
          const leg = result.routes[0]?.legs[0];
          if (leg) {
            setRouteInfo({
              duration: leg.duration_in_traffic?.text ?? leg.duration?.text ?? '',
              distance: leg.distance?.text ?? '',
            });
          }
          if (isFirstFetch || destChanged) {
            mapInstanceRef.current!.fitBounds(result.routes[0].bounds, 60);
          }
        } else {
          console.warn('Directions request failed:', status);
          lastRouteRef.current = null;
          routePathRef.current = [];
          setRouteError(true);
          if (isFirstFetch) {
            const midLat = (routeFrom[0] + routeTo[0]) / 2;
            const midLng = (routeFrom[1] + routeTo[1]) / 2;
            mapInstanceRef.current!.setCenter({ lat: midLat, lng: midLng });
          }
        }
      }
    );
  }, [mapsLoaded, routeFrom?.[0], routeFrom?.[1], routeTo?.[0], routeTo?.[1]]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-fit bounds when no route ─────────────────────────────────────────
  useEffect(() => {
    if (!mapsLoaded || !mapInstanceRef.current) return;
    if (routeFrom && routeTo) return;

    const pts: google.maps.LatLngLiteral[] = [];
    markers.forEach((m) => pts.push({ lat: m.latitude, lng: m.longitude }));
    if (searchPin) pts.push({ lat: searchPin.lat, lng: searchPin.lng });
    if (userLatitude && userLongitude) pts.push({ lat: userLatitude, lng: userLongitude });

    if (pts.length >= 2) {
      const bounds = new google.maps.LatLngBounds();
      pts.forEach((p) => bounds.extend(p));
      mapInstanceRef.current.fitBounds(bounds, 60);
    } else if (pts.length === 1) {
      mapInstanceRef.current.setCenter(pts[0]);
      mapInstanceRef.current.setZoom(15);
    }
  }, [mapsLoaded, markers, searchPin, userLatitude, userLongitude, routeFrom, routeTo]);

  const hasRoute = routeFrom && routeTo;
  const googleMapsUrl = hasRoute ? buildGoogleMapsUrl(routeFrom, routeTo) : null;

  return (
    <div className={`relative ${className}`} style={{ cursor: onMapClick ? 'crosshair' : undefined }}>
      {/* Map container */}
      <div ref={mapRef} className="w-full h-full rounded-xl z-0" style={{ minHeight: '200px' }} />

      {/* Loading skeleton */}
      {!mapsLoaded && (
        <div className="absolute inset-0 rounded-xl bg-gray-100 animate-pulse flex items-center justify-center">
          <span className="text-sm text-gray-400">Loading map…</span>
        </div>
      )}

      {/* Route loading spinner */}
      {routeLoading && (
        <div className="absolute top-3 right-3 z-[1000] bg-white/95 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-md flex items-center gap-2">
          <div className="w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-medium text-gray-600">Finding route…</span>
        </div>
      )}

      {/* Route error pill */}
      {routeError && !routeLoading && (
        <div className="absolute top-3 right-3 z-[1000] bg-red-50/95 backdrop-blur-sm border border-red-200 rounded-full px-3 py-1.5 shadow-md flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
          <span className="text-xs font-medium text-red-700">Route unavailable</span>
        </div>
      )}

      {/* Route info pill */}
      {routeInfo && !routeLoading && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] bg-white/95 backdrop-blur-sm rounded-full px-4 py-2 shadow-md flex items-center gap-3 whitespace-nowrap">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            <span className="text-xs font-bold text-gray-800">{routeInfo.duration}</span>
          </div>
          <div className="w-px h-3 bg-gray-300" />
          <span className="text-xs font-medium text-gray-500">{routeInfo.distance}</span>
        </div>
      )}

      {/* Track Live / Open in Google Maps */}
      {!hideExternalLink && onLiveTrack ? (
        <button
          onClick={onLiveTrack}
          className="absolute bottom-24 right-4 z-[1000] flex items-center gap-2 bg-white hover:bg-gray-50 active:bg-gray-100 text-gray-800 text-xs font-semibold px-3 py-2 rounded-full shadow-lg border border-gray-200 transition-all duration-150 hover:shadow-xl active:scale-95"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
          Track Live
        </button>
      ) : !hideExternalLink && liveTrackUrl ? (
        <a
          href={liveTrackUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute bottom-24 right-4 z-[1000] flex items-center gap-2 bg-white hover:bg-gray-50 active:bg-gray-100 text-gray-800 text-xs font-semibold px-3 py-2 rounded-full shadow-lg border border-gray-200 transition-all duration-150 hover:shadow-xl"
          style={{ textDecoration: 'none' }}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
          Track Live
        </a>
      ) : !hideExternalLink && googleMapsUrl ? (
        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute bottom-24 right-4 z-[1000] flex items-center gap-2 bg-white hover:bg-gray-50 active:bg-gray-100 text-gray-800 text-xs font-semibold px-3 py-2 rounded-full shadow-lg border border-gray-200 transition-all duration-150 hover:shadow-xl"
          style={{ textDecoration: 'none' }}
        >
          <svg width="16" height="16" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M24 4C15.163 4 8 11.163 8 20c0 12 16 28 16 28s16-16 16-28c0-8.837-7.163-16-16-16z" fill="#EA4335"/>
            <circle cx="24" cy="20" r="6" fill="white"/>
          </svg>
          Open in Google Maps
        </a>
      ) : null}
    </div>
  );
}
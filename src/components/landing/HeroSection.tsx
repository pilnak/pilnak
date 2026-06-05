import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Truck, MapPin, Clock, Package, ChevronRight, Navigation, Crosshair, Route, ShieldCheck, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MapView } from "@/components/map/MapView";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useReverseGeocode } from "@/hooks/useReverseGeocode";
import { useDistanceCalculation } from "@/hooks/useDistanceCalculation";
import { LocationInput } from "./LocationInput";
import { auth } from "@/integrations/firebase/client";

// Key used to pass hero locations into the customer dashboard
export const HERO_BOOKING_KEY = "pilnak_hero_booking";

interface LocationCoords {
  address: string;
  lat: number | null;
  lon: number | null;
}

interface HeroSectionProps {
  onContinueAsCustomer: () => void;
  onContinueAsDriver: () => void;
  onGetQuote?: () => void;
}

export function HeroSection({ onContinueAsCustomer, onContinueAsDriver }: HeroSectionProps) {
  const navigate = useNavigate();
  const { latitude, longitude, isLoading, requestPermission } = useGeolocation();
  const { displayName, city, isLoading: isGeocodingLoading } = useReverseGeocode(latitude, longitude);

  const [pickup, setPickup] = useState<LocationCoords>({ address: "", lat: null, lon: null });
  const [dropoff, setDropoff] = useState<LocationCoords>({ address: "", lat: null, lon: null });

  const { distanceText, estimatedTime, estimatedPrice } = useDistanceCalculation(
    pickup.lat,
    pickup.lon,
    dropoff.lat,
    dropoff.lon
  );

  const handleUseCurrentLocation = async () => {
    if (latitude && longitude) {
      setPickup({
        address: displayName || "Current location",
        lat: latitude,
        lon: longitude,
      });
      return;
    }
    const result = await requestPermission();
    if (!result) return;
    setPickup({
      address: displayName || "Current location",
      lat: result.latitude,
      lon: result.longitude,
    });
  };

  const mapMarkers = useMemo(() => {
    const markers: Array<{
      id: string;
      latitude: number;
      longitude: number;
      type: 'pickup' | 'dropoff';
      label: string;
    }> = [];
    if (pickup.lat && pickup.lon) {
      markers.push({ id: 'pickup', latitude: pickup.lat, longitude: pickup.lon, type: 'pickup', label: `Pickup: ${pickup.address}` });
    }
    if (dropoff.lat && dropoff.lon) {
      markers.push({ id: 'dropoff', latitude: dropoff.lat, longitude: dropoff.lon, type: 'dropoff', label: `Dropoff: ${dropoff.address}` });
    }
    return markers;
  }, [pickup, dropoff]);

  const getCurrentTime = () => new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  const getLocationText = () => {
    if (isGeocodingLoading) return "Getting location...";
    if (displayName) return displayName;
    return "Enter pickup address";
  };

  useEffect(() => {
    void requestPermission();
  }, [requestPermission]);

  const handleGetInstantPrice = () => {
    if (!pickup.lat || !pickup.lon || !dropoff.lat || !dropoff.lon) return;

    // Save the hero locations to localStorage so the dashboard can pick them up
    try {
      localStorage.setItem(HERO_BOOKING_KEY, JSON.stringify({
        pickup: { address: pickup.address, lat: pickup.lat, lon: pickup.lon },
        dropoff: { address: dropoff.address, lat: dropoff.lat, lon: dropoff.lon },
      }));
    } catch {}

    const user = auth.currentUser;
    if (!user) {
      // Not logged in — send to auth, will redirect to /customer after login
      navigate("/auth?role=customer&redirect=dashboard");
    } else {
      // Already logged in — go straight to the customer dashboard new-request view
      navigate("/customer");
    }
  };

  return (
    <section className="relative min-h-[calc(100dvh-4rem)] flex items-center bg-gradient-to-br from-background via-background to-muted/30">
      <div className="container mx-auto px-4 py-6 lg:py-12">
        <div className="grid lg:grid-cols-2 gap-6 lg:gap-12 items-center">

          {/* Left Side - Form */}
          <div className="order-2 lg:order-1 space-y-5 lg:space-y-6">

            {/* Main Heading */}
            <div className="space-y-1">
              <p className="text-sm font-medium text-primary flex items-center gap-2">
                <Package className="w-4 h-4" />
                Your Trusted Link to Reliable Transport.
              </p>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-black leading-[1.1] text-foreground">
                Pilnak
                <span className="block text-primary">Logistics made simple</span>
              </h1>
            </div>

            {/* Subtitle */}
            <p className="text-muted-foreground text-base lg:text-lg max-w-md">
             Connect with trusted transporters nearby and get your packages delivered hassle-free.
            </p>

            {/* Pickup Time Badge */}
            <div className="inline-flex items-center gap-2 bg-primary/10 rounded-full px-1 py-1 pr-4">
              <div className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 rounded-full text-sm font-semibold">
                <Clock className="w-3.5 h-3.5" />
                Now
              </div>
              <span className="text-foreground text-sm font-medium">{getCurrentTime()}</span>
            </div>

            {/* Location Inputs Card */}
            <div className="bg-card border border-border rounded-2xl p-4 lg:p-5 space-y-3 shadow-sm">
              {/* Pickup Location */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    Pickup
                  </label>
                  <button
                    onClick={handleUseCurrentLocation}
                    className="text-xs font-medium text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
                  >
                    <Crosshair className="w-3 h-3" />
                    Use my location
                  </button>
                </div>
                <LocationInput
                  value={pickup.address}
                  onChange={(value, lat, lon) => setPickup({ address: value, lat: lat ?? null, lon: lon ?? null })}
                  placeholder={getLocationText()}
                  icon="pickup"
                />
              </div>

              {/* Connector Line */}
              <div className="flex items-center gap-3 pl-3">
                <div className="w-0.5 h-6 bg-border rounded-full" />
              </div>

              {/* Dropoff Location */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-destructive" />
                  Dropoff
                </label>
                <LocationInput
                  value={dropoff.address}
                  onChange={(value, lat, lon) => setDropoff({ address: value, lat: lat ?? null, lon: lon ?? null })}
                  placeholder="Where should we deliver?"
                  icon="dropoff"
                />
              </div>

              {/* Distance & Time Estimate */}
              {distanceText && estimatedTime && (
                <div className="flex items-center justify-between bg-muted/50 rounded-xl px-3 py-2.5 mt-1">
                  <div className="flex items-center gap-2">
                    <Route className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium text-foreground">{distanceText}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">~{estimatedTime}</span>
                  </div>
                  {estimatedPrice && (
                    <span className="text-sm font-semibold text-primary">
                      ₦{estimatedPrice.toLocaleString()}
                    </span>
                  )}
                </div>
              )}

              {/* CTA Button */}
              <Button
                variant="default"
                size="lg"
                onClick={handleGetInstantPrice}
                disabled={!pickup.lat || !pickup.lon || !dropoff.lat || !dropoff.lon}
                className="w-full mt-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
              >
                Get Instant Price
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>

            {/* Secondary CTA */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 pt-1">
              <Button
                variant="outline"
                size="lg"
                onClick={onContinueAsDriver}
                className="w-full sm:w-auto"
              >
                <Truck className="w-4 h-4 mr-2" />
                Become a Driver
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
              <p className="text-xs text-muted-foreground">
                Earn money delivering packages
              </p>
            </div>
          </div>

          {/* Right Side - Map */}
          <div className="order-1 lg:order-2 relative h-[280px] sm:h-[350px] lg:h-[550px] rounded-2xl lg:rounded-3xl overflow-hidden shadow-xl border border-border/50">
            <MapView
              className="w-full h-full"
              zoom={14}
              showUserLocation={!pickup.lat && !dropoff.lat}
              userLatitude={latitude}
              userLongitude={longitude}
              markers={mapMarkers}
              routeFrom={
                pickup.lat != null && pickup.lon != null
                  ? [pickup.lat, pickup.lon]
                  : undefined
              }
              routeTo={
                dropoff.lat != null && dropoff.lon != null
                  ? [dropoff.lat, dropoff.lon]
                  : undefined
              }
            />

            {/* Map Overlay Gradient */}
            <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-background/30 via-transparent to-transparent" />

            {/* Location Card Overlay */}
            {latitude && longitude && (
              <div className="absolute bottom-3 left-3 right-3 sm:bottom-4 sm:left-4 sm:right-4 bg-card/95 backdrop-blur-md border border-border rounded-xl p-3 shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                    <MapPin className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {isGeocodingLoading ? "Locating..." : "Your Location"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {isGeocodingLoading ? "Getting address..." : (displayName || "Location detected")}
                    </p>
                  </div>
                  {city && (
                    <span className="hidden sm:inline-flex text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-full">
                      {city}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Loading State */}
            {isLoading && (
              <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center">
                <div className="text-center space-y-3">
                  <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-sm text-muted-foreground">Finding your location...</p>
                </div>
              </div>
            )}

            {/* Request Location State */}
            {!isLoading && !latitude && !longitude && (
              <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center">
                <div className="text-center space-y-3 p-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                    <MapPin className="w-6 h-6 text-primary" />
                  </div>
                  <p className="text-sm font-medium text-foreground">Enable location access</p>
                  <Button
                    size="sm"
                    onClick={requestPermission}
                    className="bg-primary text-primary-foreground"
                  >
                    <Navigation className="w-4 h-4 mr-2" />
                    Allow Location
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
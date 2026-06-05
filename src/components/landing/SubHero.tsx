import {
  ArrowRight,
  Truck,
  Package,
  MapPin,
  ShieldCheck,
  Clock,
  Info,
  Car
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";

declare global {
  interface Window {
    google?: typeof google;
  }
}

interface HeroSectionProps {
  onContinueAsCustomer: () => void;
  onContinueAsDriver: () => void;
}

interface LocationSuggestion {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

interface SelectedLocation {
  lat: number;
  lng: number;
  city?: string;
  country?: string;
  address: string;
}

export function SubHero({
  onContinueAsCustomer,
  onContinueAsDriver,
}: HeroSectionProps) {
  const [selectedPickup, setSelectedPickup] = useState<SelectedLocation | null>(null);
  const [selectedDropoff, setSelectedDropoff] = useState<SelectedLocation | null>(null);
  const [showMoreInfo, setShowMoreInfo] = useState(false);

  /* ---------------- GOOGLE MAPS INIT ---------------- */
  useEffect(() => {
    const initGoogleMaps = () => {
      if (window.google?.maps) {
        getCurrentLocation();
      }
    };

    if (!window.google) {
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=YOUR_API_KEY&libraries=places`;
      script.async = true;
      script.onload = initGoogleMaps;
      document.head.appendChild(script);
    } else {
      initGoogleMaps();
    }
  }, []);

  /* ---------------- GEOLOCATION ---------------- */
  const getCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setSelectedPickup({
          lat: latitude,
          lng: longitude,
          address: "Current Location",
        });
      },
      () => toast.error("Unable to get your location")
    );
  }, []);

  return (
    <section className="min-h-[100dvh] bg-gradient-to-b from-gray-50 to-white overflow-hidden">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 md:py-16">
        <div className="grid lg:grid-cols-2 gap-6 sm:gap-8 md:gap-10 lg:gap-14 items-center">

          {/* IMAGE - Mobile optimized */}
          <div className="relative h-[200px] sm:h-[280px] md:h-[380px] lg:h-[480px] rounded-xl sm:rounded-2xl md:rounded-3xl overflow-hidden shadow-lg sm:shadow-xl md:shadow-2xl order-1 lg:order-1">
            <img
              src="https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?q=80&w=1600&auto=format&fit=crop"
              alt="Delivery service"
              className="w-full h-full object-cover hover:scale-110 transition-transform duration-700"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-tr from-black/60 via-black/30 to-transparent" />
            
            {/* Mobile overlay text */}
            <div className="absolute bottom-4 left-4 right-4 lg:hidden">
              <p className="text-white text-sm font-medium bg-black/50 backdrop-blur-sm px-3 py-1.5 rounded-full inline-block">
                Fast & Reliable Delivery
              </p>
            </div>
          </div>

          {/* CONTENT - Mobile optimized */}
          <div className="order-2 lg:order-2">
            <div className="max-w-xl mx-auto lg:mx-0">
              {/* Badge for mobile */}
              <div className="inline-block mb-4 sm:mb-6">
                <span className="bg-primary/10 text-primary text-xs sm:text-sm font-semibold px-3 sm:px-4 py-1.5 sm:py-2 rounded-full">
                    #1 Delivery Platform
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold mb-4 sm:mb-6 leading-tight">
                Move Your Goods
                <span className="block text-primary mt-1 sm:mt-2">
                  Anywhere, Anytime
                </span>
              </h1>

              <p className="text-sm sm:text-base md:text-lg text-muted-foreground mb-6 sm:mb-8 max-w-xl">
                Fast, secure and reliable delivery powered by verified drivers
                across Nigeria.
              </p>

              {/* CTA BUTTONS - Mobile stacked, horizontal on larger screens */}
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-4 sm:mb-6">
                <Button 
                  size="xl" 
                  variant="hero" 
                  onClick={onContinueAsCustomer}
                  className="w-full sm:w-auto text-sm sm:text-base py-3 sm:py-4 px-4 sm:px-6"
                >
                  Send a Package
                  <ArrowRight className="ml-2 w-4 h-4 sm:w-5 sm:h-5" />
                </Button>

                <Button 
                  size="xl" 
                  variant="hero-outline" 
                  onClick={onContinueAsDriver}
                  className="w-full sm:w-auto text-sm sm:text-base py-3 sm:py-4 px-4 sm:px-6"
                >
                  <Truck className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                  Drive & Earn
                </Button>

                
              </div>
              {/* MORE INFO BUTTON - Hidden on smallest screens, visible on mobile */}
                <Button
                  size="xl"
                  variant="outline"
                  onClick={() => setShowMoreInfo(!showMoreInfo)}
                  className="w-full sm:w-auto text-sm sm:text-base py-3 sm:py-4 px-4 sm:px-6 lg:flex"
                >
                  <Info className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                  More Info
                </Button>

              {/* MORE INFO PANEL - Mobile optimized */}
              {showMoreInfo && (
                <div className="mt-4 sm:mt-6 bg-white/80 backdrop-blur-lg rounded-xl sm:rounded-2xl p-4 sm:p-6 border shadow-md animate-in fade-in slide-in-from-bottom-2">
                  <h3 className="font-semibold text-base sm:text-lg mb-3 sm:mb-4">
                    How It Works
                  </h3>

                  <div className="space-y-3 sm:space-y-4 text-xs sm:text-sm text-gray-700">
                    <div className="flex items-start gap-2 sm:gap-3">
                      <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-primary mt-0.5 flex-shrink-0" />
                      <p className="flex-1">
                        Enter pickup and drop-off locations to instantly match
                        with nearby drivers.
                      </p>
                    </div>

                    <div className="flex items-start gap-2 sm:gap-3">
                      <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-primary mt-0.5 flex-shrink-0" />
                      <p className="flex-1">
                        Average delivery time is <strong>30–60 minutes</strong>
                        within city limits.
                      </p>
                    </div>

                    <div className="flex items-start gap-2 sm:gap-3">
                      <Package className="w-4 h-4 sm:w-5 sm:h-5 text-primary mt-0.5 flex-shrink-0" />
                      <p className="flex-1">
                        Track your package in real-time from pickup to delivery.
                      </p>
                    </div>

                    <div className="flex items-start gap-2 sm:gap-3">
                      <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 text-primary mt-0.5 flex-shrink-0" />
                      <p className="flex-1">
                        All drivers are verified and every delivery is insured.
                      </p>
                    </div>
                  </div>
                </div>
              )}

             
            </div>
          </div>
        </div>

        {/* Mobile bottom indicator */}
        <div className="flex justify-center mt-8 lg:hidden">
          <div className="w-12 h-1.5 bg-gray-300 rounded-full"></div>
        </div>
      </div>
    </section>
  );
}
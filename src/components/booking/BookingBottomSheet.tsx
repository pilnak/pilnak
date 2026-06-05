import { useEffect, useState } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useBooking } from "@/contexts/BookingContext";
import { TransportOptions } from "./TransportOptions";
import { DriverFoundCard } from "./DriverFoundCard";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/integrations/firebase/client";
import {
  createAssignment,
  listenAssignmentsForRequest,
  listenDriver,
  listOnlineApprovedDrivers,
  updateDeliveryStatus,
} from "@/services/firebase";
import { toast } from "sonner";

export function BookingBottomSheet() {
  const isMobile = useIsMobile();
  const booking = useBooking();
  const [searchSimulationDone, setSearchSimulationDone] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const isOpen = booking.isPanelOpen;
  const onClose = () => booking.closePanel();

  const hasLocations =
    booking.pickup.lat != null &&
    booking.dropoff.lat != null &&
    booking.pickup.address &&
    booking.dropoff.address;

  const loadAssignedDriver = async (driverId: string) => {
    const [driverSnap, userSnap, vehicleSnap] = await Promise.all([
      getDoc(doc(db, "drivers", driverId)),
      getDoc(doc(db, "users", driverId)),
      getDoc(doc(db, "vehicles", driverId)),
    ]);
    const driver = driverSnap.exists() ? (driverSnap.data() as any) : null;
    const user = userSnap.exists() ? (userSnap.data() as any) : null;
    const vehicle = vehicleSnap.exists() ? (vehicleSnap.data() as any) : null;

    booking.setDriver({
      id: driverId,
      user_id: driverId,
      first_name: user?.firstName ?? "Driver",
      last_name: user?.lastName ?? "",
      phone: user?.phone ?? null,
      avatar_url: null,
      selfie_url: driver?.selfieUrl ?? null,
      car_model: vehicle
        ? [vehicle.brand, vehicle.model].filter(Boolean).join(" ") || vehicle.vehicleType
        : "Car",
      plate_number: vehicle?.plateNumber ?? "",
      rating: driver?.averageRating ?? 4.8,
      distanceAwayKm: 1.5,
      etaMinutes: 5,
      vehicle_type: vehicle?.vehicleType ?? "car",
      current_latitude: driver?.currentLocation?.lat ?? null,
      current_longitude: driver?.currentLocation?.lng ?? null,
    });
  };

  // When status is "searching", listen to assignments
  useEffect(() => {
    if (booking.rideStatus !== "searching" || !booking.requestId) return;
    setSearchError(null);

    const isCompany = booking.selectedTransport?.driverMode === "company";

    // Company requests are fulfilled manually by a company, not auto-matched —
    // don't show a "no driver found" timeout for them.
    const timeout = isCompany
      ? null
      : setTimeout(() => {
          setSearchSimulationDone(true);
          setSearchError("No driver found yet. Try again or choose Company Driver.");
        }, 15000);

    const unsub = listenAssignmentsForRequest(booking.requestId, async (assignments) => {
      if (!assignments.length) return;
      if (timeout) clearTimeout(timeout);
      setSearchError(null);
      toast.success("Driver assigned!");
      booking.setRideStatus("driver_found");
      booking.setDriver(null);
      await loadAssignedDriver(assignments[0].driverId);
    });

    return () => { if (timeout) clearTimeout(timeout); unsub(); };
  }, [booking.rideStatus, booking.requestId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Live driver location updates
  useEffect(() => {
    const driverId = booking.driver?.id;
    if (!driverId) return;
    const unsub = listenDriver(driverId, (driver) => {
      if (!driver || !booking.driver) return;
      const lat = driver.currentLocation?.lat ?? booking.driver.current_latitude;
      const lng = driver.currentLocation?.lng ?? booking.driver.current_longitude;
      booking.setDriver({ ...booking.driver, current_latitude: lat, current_longitude: lng });
    });
    return () => unsub();
  }, [booking.driver?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleConfirmVehicle = async () => {
    if (!booking.selectedTransport) {
      toast.error("Please select a ride type");
      return;
    }
    const started = await booking.startBooking();
    if (!started) { toast.error("Could not start booking"); return; }

    if (booking.selectedTransport.driverMode === "company") {
      toast.success("Request sent to available companies!");
      // Company flow: request sits open in the marketplace until a company claims it,
      // sets a price, and eventually assigns a driver. The listenAssignmentsForRequest
      // listener above will fire once that happens.
      return;
    }

    toast.success("Finding a driver...");
    if (booking.selectedTransport.driverMode === "self") {
      const drivers = await listOnlineApprovedDrivers(1);
      if (!drivers.length) { setSearchError("No online drivers available."); return; }
      setTimeout(async () => {
        await createAssignment(booking.requestId!, drivers[0].id, "system");
        await updateDeliveryStatus(booking.requestId!, "driver_assigned");
      }, 2500);
    }
  };

  const handleCancelRide = async () => {
    await booking.cancelRide();
    onClose();
    toast.info("Delivery cancelled");
  };

  const isCompanyMode = booking.selectedTransport?.driverMode === "company";

  const title =
    booking.rideStatus === "searching"
      ? isCompanyMode ? "Request sent" : "Finding your driver"
      : booking.rideStatus === "driver_found"
      ? "Driver found"
      : "Choose your ride";

  const content = (
    <div className="space-y-4">

      {/* Route summary */}
      {hasLocations && (
        <div className="rounded-xl bg-muted/50 border border-border p-3.5 space-y-2">
          <div className="flex items-start gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-primary mt-1 flex-shrink-0" />
            <p className="text-sm font-medium truncate flex-1">{booking.pickup.address}</p>
          </div>
          <div className="flex items-start gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-destructive mt-1 flex-shrink-0" />
            <p className="text-sm font-medium truncate flex-1">{booking.dropoff.address}</p>
          </div>
          {booking.distanceKm != null && (
            <p className="text-xs text-muted-foreground pl-5">
              {booking.distanceKm < 1
                ? `${Math.round(booking.distanceKm * 1000)}m`
                : `${booking.distanceKm.toFixed(1)}km`}
              {" · "}~{booking.estimatedTimeMinutes} min
            </p>
          )}
        </div>
      )}

      {/* Vehicle selection */}
      {(booking.rideStatus === "idle" || booking.rideStatus === "vehicle_selected") && (
        <>
          <TransportOptions
            options={booking.transportOptions}
            selected={booking.selectedTransport}
            onSelect={booking.selectTransport}
            estimatedPrice={booking.estimatedPriceForOption}
            estimatedTime={booking.estimatedTimeForOption}
          />
          <Button
            className="w-full rounded-xl h-12 text-base font-semibold"
            disabled={!booking.selectedTransport}
            onClick={handleConfirmVehicle}
          >
            Confirm {booking.selectedTransport?.label ?? "ride"}
          </Button>
        </>
      )}

      {/* Searching */}
      {booking.rideStatus === "searching" && (
        <div className="py-10 flex flex-col items-center text-center">
          <div className="relative mb-5">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
            <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-ping" />
          </div>
          <h3 className="font-bold text-base">
            {isCompanyMode ? "Request sent to companies" : "Finding a driver"}
          </h3>
          <p className="text-sm text-muted-foreground mt-1.5">
            {isCompanyMode
              ? "A company will review your request and send a price quote shortly."
              : "Matching you with a nearby driver..."}
          </p>
          <div className="flex items-center gap-1.5 mt-3">
            {[0, 75, 150].map(delay => (
              <div
                key={delay}
                className="w-2 h-2 rounded-full bg-primary animate-pulse"
                style={{ animationDelay: `${delay}ms` }}
              />
            ))}
          </div>
          {searchError && (
            <p className="text-sm text-destructive mt-4 bg-destructive/5 border border-destructive/20 rounded-lg px-4 py-2">
              {searchError}
            </p>
          )}
          <button
            onClick={handleCancelRide}
            className="mt-6 px-5 py-2 rounded-xl border border-destructive/30 text-destructive text-sm font-medium hover:bg-destructive/5 transition-colors"
          >
            Cancel Delivery
          </button>
        </div>
      )}

      {/* Driver found */}
      {booking.rideStatus === "driver_found" && booking.driver && (
        <DriverFoundCard
          driver={booking.driver}
          statusLabel="Driver on the way"
          onCall={() => {}}
          onMessage={() => toast.info("Chat will open for this ride")}
          onCancel={handleCancelRide}
        />
      )}

      {/* Driver found loading */}
      {booking.rideStatus === "driver_found" && !booking.driver && (
        <div className="py-8 text-center">
          <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Loading driver details...</p>
        </div>
      )}

      {/* Fallback */}
      {!["idle", "vehicle_selected", "searching", "driver_found"].includes(booking.rideStatus) && (
        <div className="py-6 text-center space-y-3">
          <p className="text-sm text-muted-foreground">Status: {booking.rideStatus}</p>
          <div className="flex gap-2 justify-center">
            <Button variant="outline" className="rounded-xl" onClick={onClose}>Close</Button>
            <Button
              variant="outline"
              className="rounded-xl border-destructive/30 text-destructive hover:bg-destructive/5"
              onClick={handleCancelRide}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={open => !open && onClose()}>
        <DrawerContent className="max-h-[88vh] rounded-t-3xl">
          {/* Handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
          </div>
          <DrawerHeader className="pb-2">
            <DrawerTitle className="text-base font-bold">{title}</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-8 overflow-y-auto">{content}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Sheet open={isOpen} onOpenChange={open => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md rounded-l-3xl border-l shadow-2xl"
      >
        <SheetHeader className="pb-2">
          <SheetTitle className="text-base font-bold">{title}</SheetTitle>
        </SheetHeader>
        <div className="mt-4 overflow-y-auto">{content}</div>
      </SheetContent>
    </Sheet>
  );
}
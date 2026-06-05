import { Phone, MessageCircle, X, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { AssignedDriver } from "@/types/booking";

interface DriverFoundCardProps {
  driver: AssignedDriver;
  onCall: () => void;
  onMessage: () => void;
  onCancel: () => void;
  cancelLoading?: boolean;
  statusLabel?: string;
  className?: string;
}

export function DriverFoundCard({
  driver,
  onCall,
  onMessage,
  onCancel,
  cancelLoading,
  statusLabel,
  className,
}: DriverFoundCardProps) {
  const initials =
    [driver.first_name, driver.last_name]
      .map((s) => s?.charAt(0) ?? "")
      .join("")
      .toUpperCase() || "D";
  const photo = driver.avatar_url ?? driver.selfie_url;

  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card p-4 shadow-sm",
        className
      )}
    >
      {statusLabel && (
        <p className="text-xs font-medium text-primary mb-3 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          {statusLabel}
        </p>
      )}
      <div className="flex items-center gap-4">
        <Avatar className="h-14 w-14 rounded-xl">
          <AvatarImage src={photo ?? undefined} alt="" />
          <AvatarFallback className="rounded-xl bg-primary/10 text-primary text-lg">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground">
            {driver.first_name} {driver.last_name}
          </p>
          <p className="text-sm text-muted-foreground">
            {driver.car_model} · {driver.plate_number}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <Star className="w-4 h-4 text-warning fill-warning" />
            <span className="text-sm font-medium">{driver.rating.toFixed(1)}</span>
            <span className="text-xs text-muted-foreground">
              · {driver.distanceAwayKm.toFixed(1)} km away · ETA {driver.etaMinutes} min
            </span>
          </div>
        </div>
      </div>
      <div className="flex gap-2 mt-4">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={onCall}
          asChild
        >
          <a href={driver.phone ? `tel:${driver.phone}` : "#"}>
            <Phone className="w-4 h-4 mr-2" />
            Call
          </a>
        </Button>
        <Button variant="outline" size="sm" className="flex-1" onClick={onMessage}>
          <MessageCircle className="w-4 h-4 mr-2" />
          Message
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={onCancel}
          disabled={cancelLoading}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

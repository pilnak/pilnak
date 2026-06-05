import { Car, User, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TransportOption } from "@/types/booking";

interface TransportOptionsProps {
  options: TransportOption[];
  selected: TransportOption | null;
  onSelect: (option: TransportOption) => void;
  estimatedPrice: (option: TransportOption) => number | null;
  estimatedTime: (option: TransportOption) => number | null;
  disabled?: boolean;
}

const iconMap = {
  Car,
  User,
  Building2,
};

export function TransportOptions({
  options,
  selected,
  onSelect,
  estimatedPrice,
  estimatedTime,
  disabled,
}: TransportOptionsProps) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-muted-foreground">
        Choose your ride
      </p>
      <div className="space-y-1.5 max-h-[280px] overflow-y-auto pr-1">
        {options.map((option) => {
          const price = estimatedPrice(option);
          const time = estimatedTime(option);
          const Icon = iconMap[option.icon as keyof typeof iconMap] ?? Car;
          const isSelected = selected?.id === option.id;
          return (
            <button
              key={option.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(option)}
              className={cn(
                "w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all",
                isSelected
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border bg-card hover:border-muted-foreground/30 hover:bg-muted/50",
                disabled && "opacity-60 pointer-events-none"
              )}
            >
              <div
                className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                  isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
                )}
              >
                <Icon className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground">{option.label}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {option.description}
                </p>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span>{option.seats} seats</span>
                  {time != null && <span>~{time} min</span>}
                </div>
              </div>
              {price != null && (
                <div className="shrink-0 text-right">
                  <p className="font-bold text-primary">
                    ₦{price.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">estimate</p>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

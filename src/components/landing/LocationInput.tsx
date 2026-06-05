import { useState, useRef, useEffect } from "react";
import { MapPin, Navigation, Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  useLocationSearch,
  formatLocationName,
  LocationSuggestion
} from "@/hooks/useLocationSearch";
import { cn } from "@/lib/utils";

interface LocationInputProps {
  value: string;
  onChange: (value: string, lat?: number, lon?: number) => void;
  placeholder: string;
  icon: "pickup" | "dropoff";
  className?: string;
}

export function LocationInput({
  value,
  onChange,
  placeholder,
  icon,
  className
}: LocationInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const { suggestions, isLoading, search, clearSuggestions } =
    useLocationSearch();

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const IconComponent = icon === "pickup" ? MapPin : Navigation;
  const iconColor = icon === "pickup" ? "text-primary" : "text-destructive";

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;

    onChange(newValue);

    if (newValue.length >= 3) {
      search(newValue);
      setShowSuggestions(true);
    } else {
      clearSuggestions();
      setShowSuggestions(false);
    }
  };

  const handleSuggestionClick = (suggestion: LocationSuggestion) => {
    const formattedName = formatLocationName(suggestion);

    const lat = parseFloat(suggestion.lat);
    const lon = parseFloat(suggestion.lon);

    onChange(formattedName, lat, lon);

    setShowSuggestions(false);
    clearSuggestions();

    inputRef.current?.blur();
  };

  const handleFocus = () => {
    setIsFocused(true);
    if (suggestions.length > 0) setShowSuggestions(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
    setTimeout(() => setShowSuggestions(false), 200);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div
        className={cn(
          "flex items-center gap-2 bg-muted/50 rounded-xl px-3 py-2.5 transition-all",
          isFocused && "ring-2 ring-primary/20 bg-muted/70"
        )}
      >
        <IconComponent className={cn("w-4 h-4 shrink-0", iconColor)} />

        <Input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className="border-0 p-0 h-auto text-base md:text-sm font-medium bg-transparent focus-visible:ring-0"
        />

        {isLoading && (
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Suggestions */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="py-1">
            {suggestions.map((suggestion, index) => (
              <button
                key={suggestion.place_id}
                onClick={() => handleSuggestionClick(suggestion)}
                className={cn(
                  "w-full px-3 py-2.5 text-left flex items-start gap-3 hover:bg-muted/50",
                  index !== suggestions.length - 1 &&
                    "border-b border-border/50"
                )}
              >
                <Search className="w-4 h-4 text-muted-foreground mt-0.5" />

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {formatLocationName(suggestion)}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {suggestion.display_name}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* No Results */}
      {showSuggestions &&
        !isLoading &&
        value.length >= 3 &&
        suggestions.length === 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-lg z-50 p-4">
            <p className="text-sm text-muted-foreground text-center">
              No locations found. Try another search.
            </p>
          </div>
        )}
    </div>
  );
}

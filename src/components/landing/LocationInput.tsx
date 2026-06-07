import { useState, useRef, useEffect } from "react";
import { MapPin, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  useLocationSearch,
  formatLocationName,
  LocationSuggestion,
} from "@/hooks/useLocationSearch";

interface LocationInputProps {
  value: string;
  placeholder: string;
  dotColor: "primary" | "destructive";
  onSelect: (suggestion: LocationSuggestion) => void;
  onChange: (value: string) => void;
}

export function LocationInput({
  value,
  placeholder,
  dotColor,
  onSelect,
  onChange,
}: LocationInputProps) {
  const { suggestions, isLoading, search, clearSuggestions } = useLocationSearch();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleChange = (val: string) => {
    onChange(val);
    search(val);
    setOpen(true);
  };

  const handleSelect = (s: LocationSuggestion) => {
    onSelect(s);
    clearSuggestions();
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative flex-1">
      <div
        className={`absolute left-3 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full z-10 ${
          dotColor === "primary" ? "bg-primary" : "bg-destructive"
        }`}
      />
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        className="pl-8 pr-8 rounded-xl border-border/80 focus-visible:ring-primary/30"
        autoComplete="off"
      />
      {isLoading && (
        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
      )}
      {open && suggestions.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-lg overflow-hidden">
          {suggestions.map((s) => (
            <button
              key={s.place_id}
              type="button"
              onMouseDown={() => handleSelect(s)}
              className="w-full flex items-start gap-2.5 px-3 py-2.5 text-left hover:bg-muted/60 transition-colors border-b border-border/40 last:border-0"
            >
              <MapPin className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{formatLocationName(s)}</p>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{s.display_name}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

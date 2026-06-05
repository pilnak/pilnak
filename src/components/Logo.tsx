import { Package, Truck } from "lucide-react";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  onClick?: () => void;
  className?: string;
}

const sizeClasses = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-14 w-14",
};

const textSizeClasses = {
  sm: "text-lg",
  md: "text-xl",
  lg: "text-3xl",
};

export function Logo({
  size = "md",
  showText = true,
  onClick,
  className = "",
}: LogoProps) {
  return (
    <div
      className={`flex items-center gap-2 cursor-pointer select-none ${className}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div
        className={`${sizeClasses[size]} bg-white rounded-xl flex items-center justify-center shadow-lg`}
      >
        <Truck
          className="text-[#028538] foreground"
          style={{ width: "60%", height: "60%" }}
        />
      </div>
      {showText && (
        <span className={`${textSizeClasses[size]} font-bold tracking-tight`}>
          <span className="color: textcolor">Pilnak</span>
        </span>
      )}
    </div>
  );
}

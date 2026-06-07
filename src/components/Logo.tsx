import { Truck } from "lucide-react";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  onClick?: () => void;
  // outer wrapper
  className?: string;
  // icon box (the white rounded square)
  iconWrapperClassName?: string;
  // the Truck icon itself
  iconClassName?: string;
  // "Pil" text span
  textClassName?: string;
  // "nak" accent span
  accentClassName?: string;
}

const sizeClasses = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-14 w-14",
};

const textSizeClasses = {
  sm: "text-lg",
  md: "text-2xl",
  lg: "text-4xl",
};

export function Logo({
  size = "md",
  showText = true,
  onClick,
  className = "",
  iconWrapperClassName = "",
  iconClassName = "",
  textClassName = "",
  accentClassName = "",
}: LogoProps) {
  return (
    <div
      className={`flex items-center gap-2 select-none ${onClick ? "cursor-pointer" : ""} ${className}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div
        className={`${sizeClasses[size]} bg-white rounded-xl flex items-center justify-center shadow-lg ${iconWrapperClassName}`}
      >
        <Truck
          className={`text-[#028538] ${iconClassName}`}
          style={{ width: "60%", height: "60%" }}
        />
      </div>
      {showText && (
        <span
          className={`${textSizeClasses[size]} font-bold tracking-tight ${textClassName}`}
          style={{ fontFamily: "'DM Serif Display', serif", color: "" }}
        >
          Pil
          <span
            className={accentClassName}
            style={{
              color: "#121212",
              fontStyle: "italic",
              fontWeight: 400,
              letterSpacing: "0.01em",
            }}
          >
            nak
          </span>
        </span>
      )}
    </div>
  );
}

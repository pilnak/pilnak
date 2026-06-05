import { useState } from "react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";

interface HeaderProps {
  onLogin: () => void;
  onLogoClick: () => void;
  onBecomeDriver?: () => void;
}

export function Header({ onLogin, onLogoClick, onBecomeDriver }: HeaderProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const handleBecomeDriver = onBecomeDriver ?? onLogin;

  return (
    <header className="sticky top-0 left-0 right-0 z-50 bg-[#00B140] border-b border-white/20 pt-safe">
      <div className="container mx-auto px-4">

        {/* TOP BAR */}
        <div className="flex items-center justify-between h-16">
          <div onClick={onLogoClick} className="cursor-pointer">
            <Logo size="md" className="text-white"  />
          </div>

          {/* DESKTOP NAV */}
          <nav className="hidden md:flex items-center gap-8">
            <a
              href="#features"
              className="text-sm font-medium text-white/90 hover:text-white transition-colors"
            >
              Features
            </a>
            <a
              href="#how-it-works"
              className="text-sm font-medium text-white/90 hover:text-white transition-colors"
            >
              How it Works
            </a>
            <a
              href="#pricing"
              className="text-sm font-medium text-white/90 hover:text-white transition-colors"
            >
              Pricing
            </a>
          </nav>

          {/* DESKTOP ACTIONS */}
          <div className="hidden md:flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBecomeDriver}
              className="text-white hover:bg-white/10"
            >
              Become a Driver
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onLogin}
              className="text-white hover:bg-white/10"
            >
              Log in
            </Button>
            <Button
              size="sm"
              onClick={onLogin}
              className="bg-white text-[#028538] hover:bg-emerald-50 shadow-sm"
            >
              Sign up
            </Button>
          </div>

          {/* MOBILE TOGGLE */}
          <button
            className="md:hidden p-2 text-white rounded-md hover:bg-white/10 transition"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* MOBILE MENU */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-white/20 bg-[#00B140] animate-slide-down">
            <div className="py-6 flex flex-col gap-6">

              <nav className="flex flex-col gap-4">
                <a
                  href="#features"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-sm font-medium text-white/90 hover:text-white"
                >
                  Features
                </a>
                <a
                  href="#how-it-works"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-sm font-medium text-white/90 hover:text-white"
                >
                  How it Works
                </a>
                <a
                  href="#pricing"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-sm font-medium text-white/90 hover:text-white"
                >
                  Pricing
                </a>
              </nav>

              <div className="flex flex-col gap-2">
                <Button
                  variant="ghost"
                  onClick={handleBecomeDriver}
                  className="text-white hover:bg-white/10"
                >
                  Become a Driver
                </Button>
                <Button
                  variant="ghost"
                  onClick={onLogin}
                  className="text-white hover:bg-white/10"
                >
                  Log in
                </Button>
                <Button
                  onClick={onLogin}
                  className="bg-white text-[#028538] hover:bg-emerald-50 shadow-sm"
                >
                  Sign up
                </Button>
              </div>

            </div>
          </div>
        )}
      </div>
    </header>
  );
}

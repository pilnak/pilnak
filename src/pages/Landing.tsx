import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/landing/Header";
import { HeroSection } from "@/components/landing/HeroSection";
import { SubHero } from "@/components/landing/SubHero";
import { HeroSlideshow } from "@/components/landing/HeroSlideshow";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { HowItWorksSection } from "@/components/landing/HowItWorksSection";
import { CTASection } from "@/components/landing/CTASection";
import { Footer } from "@/components/landing/Footer";
import { AdminPinModal } from "@/components/AdminPinModal";
import { LocationPermissionModal } from "@/components/map/LocationPermissionModal";

export default function Landing() {
  const navigate = useNavigate();
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [logoClickCount, setLogoClickCount] = useState(0);
  const [showLocationModal, setShowLocationModal] = useState(false);

  const handleLogoClick = () => {
    const newCount = logoClickCount + 1;
    setLogoClickCount(newCount);
    setTimeout(() => setLogoClickCount(0), 2000);
    if (newCount >= 3) {
      setIsAdminModalOpen(true);
      setLogoClickCount(0);
    }
  };

  const handleContinueAsCustomer = () => navigate("/auth?role=customer");
  const handleContinueAsDriver = () => navigate("/auth?role=driver");
  const handleLogin = () => navigate("/auth");
  const handleAdminAccess = () => { setIsAdminModalOpen(false); navigate("/admin"); };

  return (
    <div className="min-h-[100dvh] bg-background">
      <Header
        onLogin={handleLogin}
        onLogoClick={handleLogoClick}
        onBecomeDriver={handleContinueAsDriver}
      />
      <LocationPermissionModal
        isOpen={showLocationModal}
        onAllow={() => setShowLocationModal(false)}
        onDeny={() => setShowLocationModal(false)}
      />

      <main style={{ paddingTop: "calc(4rem + env(safe-area-inset-top, 0px))" }}>
        <HeroSection
          onContinueAsCustomer={handleContinueAsCustomer}
          onContinueAsDriver={handleContinueAsDriver}
        />
        <SubHero
          onContinueAsCustomer={handleContinueAsCustomer}
          onContinueAsDriver={handleContinueAsDriver}
        />
        <HeroSlideshow />
        <section id="features">
          <FeaturesSection />
        </section>
        <section id="how-it-works">
          <HowItWorksSection />
        </section>
        <CTASection
          onContinueAsCustomer={handleContinueAsCustomer}
          onContinueAsDriver={handleContinueAsDriver}
        />
        <Footer />
      </main>

      <AdminPinModal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
        onSuccess={handleAdminAccess}
      />
    </div>
  );
}
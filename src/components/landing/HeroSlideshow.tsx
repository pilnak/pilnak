import { useState, useEffect } from "react";
import {
  ArrowRight,
  Truck,
  Package,
  MapPin,
  Clock,
  Shield,
  Users,
  Zap,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import  DesignSlide1  from "@/assets/Untitled design (1).gif";
import  DesignSlide2  from "@/assets/Untitled design (2).gif";
import  DesignSlide3  from "@/assets/Untitled design (3).gif";



interface Slide {
  id: number;
  title: string;
  description: string;
  image: string;
  icon: React.ElementType;
  color: string;
}

const slides: Slide[] = [
  {
    id: 1,
    title: "Fast & Reliable Deliveries",
    description:
      "Get your packages delivered in minutes, not hours. Our network of verified drivers ensures quick pickup and dropoff.",
    image: DesignSlide1,
    icon: Truck,
    color: "from-blue-500 to-cyan-500",
  },
  {
    id: 2,
    title: "Real-Time Tracking",
    description:
      "Track your package from pickup to delivery with live GPS tracking. Know exactly where your items are at all times.",
    image: DesignSlide2,
    icon: MapPin,
    color: "from-green-500 to-emerald-500",
  },
  {
    id: 3,
    title: "Secure & Insured",
    description:
      "Every delivery is fully insured and all drivers are verified. Your packages are in safe hands with our platform.",
    image: DesignSlide3,
    icon: Shield,
    color: "from-purple-500 to-pink-500",
  },
  {
    id: 4,
    title: "Earn on Your Schedule",
    description:
      "Join as a driver and earn money flexibly. Drive when you want, take breaks when you need, and keep what you earn.",
    image:
      "https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?fm=jpg&q=60&w=3000&auto=format&fit=crop",
    icon: Users,
    color: "from-orange-500 to-red-500",
  },
];

const stats = [
  { label: "Active Drivers", value: "10,000+", icon: Users },
  { label: "Deliveries Completed", value: "500K+", icon: Package },
  { label: "Cities Covered", value: "25+", icon: MapPin },
  { label: "Avg. Delivery Time", value: "< 30min", icon: Clock },
];

export function HeroSlideshow() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  useEffect(() => {
    if (!isAutoPlaying) return;

    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [isAutoPlaying]);

  const nextSlide = () => {
    setIsAutoPlaying(false);
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  };

  const prevSlide = () => {
    setIsAutoPlaying(false);
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const goToSlide = (index: number) => {
    setIsAutoPlaying(false);
    setCurrentSlide(index);
  };

  const CurrentIcon = slides[currentSlide].icon;

  return (
    <section className="relative w-full bg-gradient-to-b from-gray-50 to-white overflow-hidden">
      {/* Background pattern */}
      <div className="absolute inset-0 bg-grid-gray-900/[0.02] -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 lg:py-20">
        {/* Slideshow */}
        <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden bg-gray-900 shadow-xl sm:shadow-2xl mb-12 lg:mb-20">
          <div className="relative h-[320px] sm:h-[420px] md:h-[520px] lg:h-[620px]">
            {slides.map((slide, index) => (
              <div
                key={slide.id}
                className={`absolute inset-0 transition-opacity duration-1000 ${
                  index === currentSlide ? "opacity-100" : "opacity-0"
                }`}
              >
                <img
                  src={slide.image}
                  alt={slide.title}
                  className="w-full h-full object-cover"
                />

                <div
                  className={`absolute inset-0 bg-gradient-to-r ${slide.color} opacity-70`}
                />
              </div>
            ))}

            {/* Content */}
            <div className="absolute inset-0 flex items-center">
              <div className="w-full px-5 sm:px-8 lg:px-12">
                <div className="max-w-xl lg:max-w-2xl text-white">
                  <div className="flex items-center gap-3 mb-3 sm:mb-4">
                    <div className="p-2 bg-white/20 backdrop-blur-md rounded-lg">
                      <CurrentIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>

                    <span className="text-xs sm:text-sm font-medium uppercase tracking-wider opacity-80">
                      {currentSlide + 1} / {slides.length}
                    </span>
                  </div>

                  <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold leading-tight mb-3 sm:mb-4">
                    {slides[currentSlide].title}
                  </h2>

                  <p className="text-sm sm:text-base md:text-lg opacity-90 mb-5 sm:mb-6">
                    {slides[currentSlide].description}
                  </p>

                  <Button
                    size="lg"
                    className="group rounded-xl px-5 sm:px-6 py-2.5 sm:py-3"
                  >
                    Get Started
                    <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Arrows */}
            <button
              onClick={prevSlide}
              className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 p-2 sm:p-3 rounded-full bg-black/30 backdrop-blur text-white hover:bg-black/50 transition"
            >
              <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>

            <button
              onClick={nextSlide}
              className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 p-2 sm:p-3 rounded-full bg-black/30 backdrop-blur text-white hover:bg-black/50 transition"
            >
              <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>

            {/* Indicators */}
            <div className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
              {slides.map((_, index) => (
                <button
                  key={index}
                  onClick={() => goToSlide(index)}
                  className={`h-2 rounded-full transition-all ${
                    index === currentSlide
                      ? "w-6 sm:w-8 bg-white"
                      : "w-2 bg-white/50 hover:bg-white/80"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
          {stats.map((stat, index) => {
            const Icon = stat.icon;

            return (
              <div
                key={index}
                className="bg-white/80 backdrop-blur rounded-xl sm:rounded-2xl 
                           p-4 sm:p-5 lg:p-6 border border-gray-100 
                           shadow-md hover:shadow-xl transition-all"
              >
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="p-2.5 sm:p-3 bg-primary/10 rounded-lg sm:rounded-xl">
                    <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                  </div>

                  <div>
                    <p className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">
                      {stat.value}
                    </p>

                    <p className="text-xs sm:text-sm text-gray-600">
                      {stat.label}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

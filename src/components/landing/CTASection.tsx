import { ArrowRight, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CTASectionProps {
  onContinueAsCustomer: () => void;
  onContinueAsDriver: () => void;
}

export function CTASection({ onContinueAsCustomer, onContinueAsDriver }: CTASectionProps) {
  return (
    <section className="relative py-24 bg-gradient-to-r from-[#028538]/30 to-[#e6f4ea] overflow-hidden">
      
      {/* Decorative floating shapes */}
      <div className="absolute top-0 left-0 w-64 h-64 bg-primary/20 rounded-full blur-3xl animate-float" />
      <div className="absolute bottom-0 right-0 w-80 h-80 bg-primary/10 rounded-full blur-3xl animate-float" style={{ animationDelay: "2s" }} />

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold mb-6 text-gray-900">
            Ready to <span className="text-primary">Get Started?</span>
          </h2>
          <p className="text-lg text-gray-700 mb-10 max-w-xl mx-auto">
            Join thousands of satisfied customers and drivers. Experience the future of logistics today.
          </p>

          <div className="flex flex-col sm:flex-row gap-6 justify-center">
            {/* Customer Button */}
            <Button
              size="xl"
              onClick={onContinueAsCustomer}
              className="w-full sm:w-auto bg-primary text-white hover:bg-green-700 group transition-all duration-300 shadow-lg flex items-center gap-2 justify-center"
            >
              Continue as Customer
              <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform duration-300" />
            </Button>

            {/* Driver Button */}
            <Button
              variant="outline"
              size="xl"
              onClick={onContinueAsDriver}
              className="w-full sm:w-auto border-primary text-primary hover:bg-primary hover:text-white transition-all duration-300 shadow"
            >
              <Truck className="w-5 h-5 mr-2" />
              Continue as Driver
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

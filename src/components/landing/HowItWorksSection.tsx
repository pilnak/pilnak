import { MapPin, Users, Truck, CheckCircle2, ArrowRight } from "lucide-react";

const steps = [
  {
    icon: MapPin,
    step: "01",
    title: "Enter Locations",
    description:
      "Set your pickup and drop-off points on the map. Add item details and photos.",
  },
  {
    icon: Users,
    step: "02",
    title: "Get Matched",
    description:
      "Our admin reviews your request and assigns the best available driver.",
  },
  {
    icon: Truck,
    step: "03",
    title: "Track Live",
    description:
      "Watch your driver approach in real-time and chat if needed.",
  },
  {
    icon: CheckCircle2,
    step: "04",
    title: "Delivery Complete",
    description:
      "Receive your goods safely, rate the service, and pay securely.",
  },
];

export function HowItWorksSection() {
  return (
    <section className="py-24 bg-muted/30 relative">
      <div className="container mx-auto px-4">

        {/* HEADER */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            How It <span className="text-primary">Works</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            Deliver your goods in four simple, stress-free steps.
          </p>
        </div>

        {/* ARROW LINE (desktop only) */}
        <div className="hidden lg:flex absolute top-[175px] left-0 right-0 justify-between px-4 z-0 pointer-events-none">
          {steps.map((_, index) =>
            index < steps.length - 1 ? (
              <div key={index} className="flex-1 flex items-center justify-center">
                <ArrowRight className="w-6 h-6 text-primary/40 animate-pulse" />
              </div>
            ) : null
          )}
        </div>

        {/* STEPS GRID */}
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4 relative z-10">
          {steps.map((item, index) => (
            <div
              key={item.step}
              className="group relative bg-card rounded-2xl p-6 border border-border shadow-sm hover:shadow-lg transition-all duration-300 animate-slide-up"
              style={{ animationDelay: `${index * 0.12}s` }}
            >
              {/* STEP NUMBER */}
              <span className="absolute top-4 right-4 text-sm font-semibold text-primary/40">
                {item.step}
              </span>

              {/* ICON */}
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/15 transition">
                <item.icon className="w-7 h-7 text-primary" />
              </div>

              {/* CONTENT */}
              <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

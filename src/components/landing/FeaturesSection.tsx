import { MapPin, Shield, Clock, Wallet, MessageCircle, Star } from "lucide-react";

const features = [
  {
    icon: MapPin,
    title: "Real-time Tracking",
    description:
      "Track your deliveries live on the map. Know exactly where your package is at any moment.",
  },
  {
    icon: Shield,
    title: "Secure & Insured",
    description:
      "All deliveries are covered by comprehensive insurance. Your goods are protected.",
  },
  {
    icon: Clock,
    title: "Fast Delivery",
    description:
      "Same-day and scheduled deliveries available. We work on your timeline.",
  },
  {
    icon: Wallet,
    title: "Fair Pricing",
    description:
      "Transparent pricing with no hidden fees. Pay only for what you need.",
  },
  {
    icon: MessageCircle,
    title: "In-App Chat",
    description:
      "Communicate directly with your driver and our support team in real-time.",
  },
  {
    icon: Star,
    title: "Rated Drivers",
    description:
      "Choose from our verified and highly-rated driver network for peace of mind.",
  },
];

export function FeaturesSection() {
  return (
    <section className="relative py-24 bg-gradient-to-b from-[#e6f4ea] to-white overflow-hidden">
      {/* Decorative floating shapes */}
      <div className="absolute top-0 left-10 w-36 h-36 bg-primary/10 rounded-full blur-3xl animate-float"></div>
      <div className="absolute bottom-0 right-20 w-60 h-60 bg-primary/5 rounded-full blur-3xl animate-float" style={{ animationDelay: "2s" }}></div>

      <div className="container mx-auto px-4 relative z-10">
        {/* HEADER */}
        <div className="text-center mb-20">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Why Choose <span className="text-primary">Pilnak</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Everything you need for seamless logistics, all in one platform.
          </p>
        </div>

        {/* FEATURE CARDS */}
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className="group bg-white rounded-2xl p-8 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-2 animate-slide-up"
              style={{ animationDelay: `${index * 0.12}s` }}
            >
              {/* ICON */}
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-primary group-hover:scale-110 transition-all duration-300">
                <feature.icon className="w-8 h-8 text-primary group-hover:text-white transition-colors" />
              </div>

              {/* TITLE */}
              <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>

              {/* DESCRIPTION */}
              <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

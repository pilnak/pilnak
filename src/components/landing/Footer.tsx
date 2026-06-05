import { Logo } from "@/components/Logo";

export function Footer() {
  return (
    <footer className="py-12 bg-secondary/30">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <Logo size="md" />
          
          <nav className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
            <a href="#" className="hover:text-foreground transition-colors">About</a>
            <a href="#" className="hover:text-foreground transition-colors">How it Works</a>
            <a href="#" className="hover:text-foreground transition-colors">Safety</a>
            <a href="#" className="hover:text-foreground transition-colors">Pricing</a>
            <a href="#" className="hover:text-foreground transition-colors">Support</a>
          </nav>
          
          <p className="text-sm text-muted-foreground">
          @Pilnak. All rights reserved by Sky-Findas.
          </p>
        </div>
      </div>
    </footer>
  );
}

import { Rocket } from "lucide-react";

const Footer = () => {
  return (
    <footer className="py-12 bg-card border-t border-border">
      <div className="container mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Logo */}
          <a href="#" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Rocket className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-display text-xl text-foreground tracking-wide">
              CLEAR SITE <span className="text-primary">CONSULTANTS</span>
            </span>
          </a>

          {/* Links */}
          <nav className="flex items-center gap-6">
            <a href="#services" className="text-sm text-muted-foreground hover:text-primary transition-colors">
              Services
            </a>
            <a href="#why-us" className="text-sm text-muted-foreground hover:text-primary transition-colors">
              Why Us
            </a>
            <a href="#contact" className="text-sm text-muted-foreground hover:text-primary transition-colors">
              Contact
            </a>
          </nav>

          {/* Copyright */}
          <p className="text-sm text-muted-foreground">
            © 2026 Clear Site Consultants. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

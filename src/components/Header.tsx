import { Button } from "@/components/ui/button";
import { Globe, Menu, X } from "lucide-react";
import { useState } from "react";

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <a href="#" className="flex items-center gap-2 group">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center box-glow group-hover:box-glow-intense transition-all duration-300">
              <Globe className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="font-display text-2xl text-foreground tracking-wide">
              CLEAR<span className="text-primary">SITE</span>
            </span>
          </a>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            <a href="#services" className="text-muted-foreground hover:text-primary transition-colors font-medium">
              Services
            </a>
            <a href="#why-us" className="text-muted-foreground hover:text-primary transition-colors font-medium">
              Why Us
            </a>
            <a href="#contact" className="text-muted-foreground hover:text-primary transition-colors font-medium">
              Contact
            </a>
            <a href="#contact">
              <Button variant="outline" size="sm">
                Book Now
              </Button>
            </a>
          </nav>

          {/* Mobile Menu Button */}
          <button 
            className="md:hidden text-foreground"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <nav className="md:hidden pt-6 pb-4 flex flex-col gap-4 animate-fade-in">
            <a href="#services" className="text-muted-foreground hover:text-primary transition-colors font-medium py-2">
              Services
            </a>
            <a href="#why-us" className="text-muted-foreground hover:text-primary transition-colors font-medium py-2">
              Why Us
            </a>
            <a href="#contact" className="text-muted-foreground hover:text-primary transition-colors font-medium py-2">
              Contact
            </a>
            <a href="#contact" className="w-full mt-2">
              <Button variant="outline" className="w-full">
                Book Now
              </Button>
            </a>
          </nav>
        )}
      </div>
    </header>
  );
};

export default Header;

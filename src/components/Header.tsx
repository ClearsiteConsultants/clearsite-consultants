import { Button } from "@/components/ui/button";
import { Rocket, Menu, X } from "lucide-react";
import { useState } from "react";

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 shadow-sm">
      <div className="container mx-auto px-6 py-3">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <a href="#" className="flex items-center gap-2 group">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center transition-all duration-300">
              <Rocket className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="font-display text-lg text-gray-900 tracking-wide">
              CLEAR SITE <span className="text-primary">CONSULTANTS</span>
            </span>
          </a>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            <a href="#services" className="text-gray-600 hover:text-primary transition-colors font-medium">
              Services
            </a>
            <a href="#why-us" className="text-gray-600 hover:text-primary transition-colors font-medium">
              Why Us
            </a>
            <a href="#pricing" className="text-gray-600 hover:text-primary transition-colors font-medium">
              Pricing
            </a>
            <a href="#contact" className="text-gray-600 hover:text-primary transition-colors font-medium">
              Contact
            </a>
          </nav>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden text-gray-800"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <nav className="md:hidden pt-6 pb-4 flex flex-col gap-4 animate-fade-in">
            <a href="#services" className="text-gray-600 hover:text-primary transition-colors font-medium py-2">
              Services
            </a>
            <a href="#why-us" className="text-gray-600 hover:text-primary transition-colors font-medium py-2">
              Why Us
            </a>
            <a href="#pricing" className="text-gray-600 hover:text-primary transition-colors font-medium py-2">
              Pricing
            </a>
            <a href="#contact" className="text-gray-600 hover:text-primary transition-colors font-medium py-2">
              Contact
            </a>
          </nav>
        )}
      </div>
    </header>
  );
};

export default Header;

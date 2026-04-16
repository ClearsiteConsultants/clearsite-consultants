import { Menu, X } from "lucide-react";
import { useState } from "react";
import Link from "next/link";

type HeaderProps = {
  showNavigation?: boolean;
};

export default function Header({ showNavigation = true }: HeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleNavLinkClick = () => {
    setIsMenuOpen(false);
  };

  const handleMenuButtonClick = () => {
    setIsMenuOpen((prev) => !prev);
  };

  const handleHomeClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    setIsMenuOpen(false);

    if (window.location.pathname === "/") {
      event.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur border-b border-gray-200/70">
      <div className="mx-auto w-full max-w-[1800px] px-3 py-3 sm:px-5 lg:px-6">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group" onClick={handleHomeClick}>
            <div className="w-10 h-10 border border-gray-200 flex items-center justify-center">
              <img src="/favicon-nav.png" alt="Clearsite logo" className="w-7 h-7" />
            </div>
            <span className="font-display text-lg text-gray-900 tracking-wide">
              CLEARSITE <span className="text-primary">CONSULTANTS</span>
            </span>
          </Link>

          {showNavigation && (
            <>
              {/* Desktop Navigation */}
              <div className="hidden min-[900px]:flex items-center gap-8">
                <nav className="flex items-center gap-8">
                  <a href="#services" onClick={handleNavLinkClick} className="text-gray-600 hover:text-primary transition-colors font-medium">
                    Services
                  </a>
                  <a href="#why-us" onClick={handleNavLinkClick} className="text-gray-600 hover:text-primary transition-colors font-medium">
                    Why Us
                  </a>
                  <a href="#pricing" onClick={handleNavLinkClick} className="text-gray-600 hover:text-primary transition-colors font-medium">
                    Pricing
                  </a>
                  <a href="#contact" onClick={handleNavLinkClick} className="text-gray-600 hover:text-primary transition-colors font-medium">
                    Contact
                  </a>
                </nav>
                <Link href="/login" onClick={handleNavLinkClick} className="font-bold text-primary hover:text-primary/80 transition-colors">
                  Client Portal
                </Link>
              </div>

              {/* Mobile Menu Button */}
              <button
                className="min-[900px]:hidden text-gray-800"
                onClick={handleMenuButtonClick}
              >
                {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </>
          )}
        </div>

        {/* Mobile Navigation */}
        {showNavigation && isMenuOpen && (
          <nav className="min-[900px]:hidden pt-6 pb-4 flex flex-col gap-4 animate-fade-in">
            <a href="#services" onClick={handleNavLinkClick} className="text-gray-600 hover:text-primary transition-colors font-medium py-2">
              Services
            </a>
            <a href="#why-us" onClick={handleNavLinkClick} className="text-gray-600 hover:text-primary transition-colors font-medium py-2">
              Why Us
            </a>
            <a href="#pricing" onClick={handleNavLinkClick} className="text-gray-600 hover:text-primary transition-colors font-medium py-2">
              Pricing
            </a>
            <a href="#contact" onClick={handleNavLinkClick} className="text-gray-600 hover:text-primary transition-colors font-medium py-2">
              Contact
            </a>
            <Link href="/login" onClick={handleNavLinkClick} className="font-bold text-primary hover:text-primary/80 transition-colors py-2">
              Client Portal
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}

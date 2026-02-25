import logo from "@/assets/logo_transparent.png";

const Footer = () => {
  return (
    <footer className="py-12 bg-gray-50 border-t border-gray-200">
      <div className="container mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Logo */}
          <a href="#" className="flex items-center gap-2 group">
            <img src={logo} alt="Clear Site Consultants" className="h-14 w-auto object-contain" />
          </a>

          {/* Links */}
          <nav className="flex items-center gap-6">
            <a href="#services" className="text-sm text-gray-600 hover:text-primary transition-colors">
              Services
            </a>
            <a href="#why-us" className="text-sm text-gray-600 hover:text-primary transition-colors">
              Why Us
            </a>
            <a href="#pricing" className="text-sm text-gray-600 hover:text-primary transition-colors">
              Pricing
            </a>
            <a href="#contact" className="text-sm text-gray-600 hover:text-primary transition-colors">
              Contact
            </a>
          </nav>

          {/* Copyright */}
          <p className="text-sm text-gray-600">
            © 2026 Clear Site Consultants. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

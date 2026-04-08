import Link from "next/link";

export default function Footer() {
  return (
    <footer className="py-12 bg-gray-50 border-t border-gray-200">
      <div className="container mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <span className="font-display text-lg text-gray-900 tracking-wide">
              CLEARSITE <span className="text-primary">CONSULTANTS</span>
            </span>
          </Link>

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
            © 2026 Clearsite Consultants. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

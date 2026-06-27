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
            <Link href="/#services" className="text-sm text-gray-600 hover:text-primary transition-colors">
              Services
            </Link>
            <Link href="/#why-us" className="text-sm text-gray-600 hover:text-primary transition-colors">
              Why Us
            </Link>
            <Link href="/#pricing" className="text-sm text-gray-600 hover:text-primary transition-colors">
              Pricing
            </Link>
            <Link href="/#contact" className="text-sm text-gray-600 hover:text-primary transition-colors">
              Contact
            </Link>
          </nav>

          {/* Copyright & Legal */}
          <div className="flex flex-col items-center md:items-end gap-1">
            <p className="text-sm text-gray-600">
              © 2026 Clearsite Consultants. All rights reserved.
            </p>
            <div className="flex items-center gap-3">
              <Link href="/privacy" className="text-xs text-gray-500 hover:text-primary transition-colors">
                Privacy Policy
              </Link>
              <span className="text-xs text-gray-400">·</span>
              <Link href="/terms" className="text-xs text-gray-500 hover:text-primary transition-colors">
                Terms of Use
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

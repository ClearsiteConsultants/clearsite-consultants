import Link from "next/link";

export default function Footer() {
  return (
    <footer className="py-12 bg-gray-50 border-t border-gray-200">
      <div className="container mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <span className="font-bold text-lg text-gray-900">
              CLEAR SITE <span className="text-blue-600">CONSULTANTS</span>
            </span>
          </Link>

          {/* Links */}
          <nav className="flex items-center gap-6">
            <a href="#services" className="text-sm text-gray-600 hover:text-blue-600 transition-colors">
              Services
            </a>
            <a href="#why-us" className="text-sm text-gray-600 hover:text-blue-600 transition-colors">
              Why Us
            </a>
            <a href="#contact" className="text-sm text-gray-600 hover:text-blue-600 transition-colors">
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
}

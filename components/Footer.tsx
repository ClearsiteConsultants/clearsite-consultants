"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Mail, Phone } from "lucide-react";
import { handleAnchorClick } from "@/lib/utils";

export default function Footer() {
  const pathname = usePathname();
  return (
    <footer className="py-12 bg-gray-50 border-t border-gray-200">
      <div className="container mx-auto px-6">
        <div className="flex flex-col items-center gap-5 text-center">
          <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
            <Link
              href="/#services"
              onClick={(e) => handleAnchorClick(e, "services", pathname)}
              className="text-sm text-gray-600 hover:text-primary transition-colors"
            >
              Services
            </Link>
            <Link
              href="/#why-us"
              onClick={(e) => handleAnchorClick(e, "why-us", pathname)}
              className="text-sm text-gray-600 hover:text-primary transition-colors"
            >
              Why Us
            </Link>
            <Link
              href="/#pricing"
              onClick={(e) => handleAnchorClick(e, "pricing", pathname)}
              className="text-sm text-gray-600 hover:text-primary transition-colors"
            >
              Pricing
            </Link>
            <Link
              href="/#contact"
              onClick={(e) => handleAnchorClick(e, "contact", pathname)}
              className="text-sm text-gray-600 hover:text-primary transition-colors"
            >
              Contact
            </Link>
          </nav>

          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            <Link href="/privacy" className="text-xs text-gray-500 hover:text-primary transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-xs text-gray-500 hover:text-primary transition-colors">
              Terms of Use
            </Link>
          </div>

          <p className="text-sm text-gray-600">
            © 2026 Clearsite Consultants. All rights reserved.
          </p>

          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-6">
            <a
              href="tel:+18017091872"
              className="flex items-center gap-2 text-sm text-gray-600 transition-colors hover:text-blue-600"
            >
              <Phone className="h-4 w-4 text-blue-600" aria-hidden="true" />
              <span>801-709-1872</span>
            </a>
            <a
              href="mailto:developersclearsite@gmail.com"
              className="flex items-center gap-2 text-sm text-gray-600 transition-colors hover:text-blue-600"
            >
              <Mail className="h-4 w-4 text-blue-600" aria-hidden="true" />
              <span>developersclearsite@gmail.com</span>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

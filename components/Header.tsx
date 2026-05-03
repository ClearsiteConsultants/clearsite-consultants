'use client';

import { Menu, X, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";

type HeaderProps = {
  showNavigation?: boolean;
};

function getInitials(firstName?: string, lastName?: string, name?: string | null, email?: string | null): string {
  if (firstName && lastName) {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  }
  if (firstName) {
    return firstName[0].toUpperCase();
  }
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2 && parts[0] && parts[parts.length - 1]) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    if (parts[0]) {
      return parts[0][0].toUpperCase();
    }
  }
  if (email) {
    return email[0].toUpperCase();
  }
  return "?";
}

export default function Header({ showNavigation = true }: HeaderProps) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!isMenuOpen && !isDropdownOpen) {
      return;
    }

    const handleOutsidePointerDown = (event: MouseEvent | TouchEvent) => {
      if (headerRef.current && !headerRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsidePointerDown);
    document.addEventListener("touchstart", handleOutsidePointerDown);

    return () => {
      document.removeEventListener("mousedown", handleOutsidePointerDown);
      document.removeEventListener("touchstart", handleOutsidePointerDown);
    };
  }, [isMenuOpen, isDropdownOpen]);

  const handleNavLinkClick = () => {
    setIsMenuOpen(false);
    setIsDropdownOpen(false);
  };

  const handleMenuButtonClick = () => {
    setIsMenuOpen((prev) => !prev);
  };

  const handleHomeClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    setIsMenuOpen(false);
    setIsDropdownOpen(false);

    if (window.location.pathname === "/") {
      event.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleLogout = async () => {
    setIsMenuOpen(false);
    setIsDropdownOpen(false);
    await signOut({ redirect: true, callbackUrl: "/" });
  };

  const isAuthenticated = status === "authenticated" && !!session;
  const userType = (session?.user as { user_type?: string } | undefined)?.user_type;
  const firstName = (session?.user as { first_name?: string } | undefined)?.first_name;
  const lastName = (session?.user as { last_name?: string } | undefined)?.last_name;
  const initials = isAuthenticated
    ? getInitials(firstName, lastName, session?.user?.name, session?.user?.email)
    : "";

  const portalHref = userType === "admin" ? "/admin" : "/portal";
  const portalLabel = userType === "admin" ? "Admin Dashboard" : "Client Portal";
  const isHomepage = pathname === "/";
  const showFullNavigation = showNavigation && isHomepage;
  const showSimplifiedNavigation = showNavigation && !isHomepage;

  const renderProfileMenu = () => (
    <div className="relative">
      <button
        onClick={() => setIsDropdownOpen((prev) => !prev)}
        className="flex items-center gap-2 focus:outline-none"
        aria-label="Account menu"
      >
        <span className="w-9 h-9 rounded-full bg-primary text-white text-sm font-bold flex items-center justify-center select-none">
          {initials}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-600 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`} />
      </button>

      {isDropdownOpen && (
        <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl border border-gray-200 shadow-lg py-1 z-50">
          <Link
            href={portalHref}
            onClick={handleNavLinkClick}
            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 font-medium"
          >
            {portalLabel}
          </Link>
          {userType === "admin" && (
            <Link
              href="/admin/invoices"
              onClick={handleNavLinkClick}
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 font-medium"
            >
              Invoice Management
            </Link>
          )}
          <Link
            href="/account-settings"
            onClick={handleNavLinkClick}
            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 font-medium"
          >
            Account Settings
          </Link>
          <hr className="my-1 border-gray-100" />
          <button
            onClick={handleLogout}
            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-50 font-medium"
          >
            Log out
          </button>
        </div>
      )}
    </div>
  );

  return (
    <header ref={headerRef} className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur border-b border-gray-200/70">
      <div className="mx-auto w-full max-w-[1800px] px-3 py-3 sm:px-5 lg:px-6">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group" onClick={handleHomeClick}>
            <div className="w-10 h-10 border border-gray-200 flex items-center justify-center">
              <Image
                src="/favicon-nav.png"
                alt="Clearsite logo"
                width={28}
                height={28}
                className="w-7 h-7"
              />
            </div>
            <span className="font-display text-lg text-gray-900 tracking-wide">
              CLEARSITE <span className="text-primary">CONSULTANTS</span>
            </span>
          </Link>

          {showFullNavigation && (
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

                {isAuthenticated ? (
                  renderProfileMenu()
                ) : (
                  <Link href="/login" onClick={handleNavLinkClick} className="font-bold text-primary hover:text-primary/80 transition-colors">
                    Client Portal
                  </Link>
                )}
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

          {showSimplifiedNavigation && isAuthenticated && renderProfileMenu()}
        </div>

        {/* Mobile Navigation */}
        {showFullNavigation && isMenuOpen && (
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

            {isAuthenticated ? (
              <>
                <Link href={portalHref} onClick={handleNavLinkClick} className="font-bold text-primary hover:text-primary/80 transition-colors py-2">
                  {portalLabel}
                </Link>
                {userType === "admin" && (
                  <Link href="/admin/invoices" onClick={handleNavLinkClick} className="font-bold text-primary hover:text-primary/80 transition-colors py-2">
                    Invoice Management
                  </Link>
                )}
                <Link href="/account-settings" onClick={handleNavLinkClick} className="font-bold text-primary hover:text-primary/80 transition-colors py-2">
                  Account Settings
                </Link>
                <button
                  onClick={handleLogout}
                  className="text-left font-bold text-red-600 hover:text-red-500 transition-colors py-2"
                >
                  Log out
                </button>
              </>
            ) : (
              <Link href="/login" onClick={handleNavLinkClick} className="font-bold text-primary hover:text-primary/80 transition-colors py-2">
                Client Portal
              </Link>
            )}
          </nav>
        )}
      </div>
    </header>
  );
}

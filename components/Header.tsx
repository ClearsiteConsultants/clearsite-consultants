'use client';

import { Menu, X, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const recoverBodyInteraction = () => {
      const body = document.body;
      const hasActiveRadixLayer =
        document.querySelector("[data-radix-popper-content-wrapper]") !== null ||
        document.querySelector("[data-radix-dialog-content]") !== null ||
        document.querySelector("[data-radix-portal]") !== null;

      if (body.style.pointerEvents === "none") {
        body.style.pointerEvents = "";
      }

      if (!hasActiveRadixLayer) {
        if (body.style.overflow === "hidden") {
          body.style.overflow = "";
        }
        if (body.style.paddingRight) {
          body.style.paddingRight = "";
        }
      }
    };

    recoverBodyInteraction();
    const immediateTimer = window.setTimeout(recoverBodyInteraction, 0);
    const followUpTimer = window.setTimeout(recoverBodyInteraction, 150);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        recoverBodyInteraction();
      }
    };

    window.addEventListener("focus", recoverBodyInteraction);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("pointerdown", recoverBodyInteraction, true);

    return () => {
      window.clearTimeout(immediateTimer);
      window.clearTimeout(followUpTimer);
      window.removeEventListener("focus", recoverBodyInteraction);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("pointerdown", recoverBodyInteraction, true);
    };
  }, [pathname, status]);

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    const handleOutsidePointerDown = (event: MouseEvent | TouchEvent) => {
      if (headerRef.current && !headerRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsidePointerDown);
    document.addEventListener("touchstart", handleOutsidePointerDown);

    return () => {
      document.removeEventListener("mousedown", handleOutsidePointerDown);
      document.removeEventListener("touchstart", handleOutsidePointerDown);
    };
  }, [isMenuOpen]);

  const handleNavLinkClick = () => {
    setIsMenuOpen(false);
    setIsProfileMenuOpen(false);
  };

  const handleMenuButtonClick = () => {
    setIsMenuOpen((prev) => !prev);
  };

  const handleHomeClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    setIsMenuOpen(false);
    setIsProfileMenuOpen(false);

    if (window.location.pathname === "/") {
      event.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleLogout = async () => {
    setIsMenuOpen(false);
    setIsProfileMenuOpen(false);
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
    <DropdownMenu modal={false} open={isProfileMenuOpen} onOpenChange={setIsProfileMenuOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 focus:outline-none"
          aria-label="Account menu"
        >
          <span className="w-9 h-9 rounded-full bg-primary text-white text-sm font-bold flex items-center justify-center select-none">
            {initials}
          </span>
          <ChevronDown className={`w-4 h-4 text-gray-600 transition-transform ${isProfileMenuOpen ? "rotate-180" : ""}`} />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-52 rounded-xl border-gray-200 py-1 shadow-lg z-[120]"
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        <DropdownMenuItem asChild className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 font-medium cursor-pointer">
          <Link href={portalHref} onClick={handleNavLinkClick}>
            {portalLabel}
          </Link>
        </DropdownMenuItem>
        {userType === "admin" && (
          <DropdownMenuItem asChild className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 font-medium cursor-pointer">
            <Link href="/admin/invoices" onClick={handleNavLinkClick}>
              Invoice Management
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 font-medium cursor-pointer">
          <Link href="/account-settings" onClick={handleNavLinkClick}>
            Account Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="my-1 bg-gray-100" />
        <DropdownMenuItem
          onClick={handleLogout}
          className="w-full px-4 py-2 text-sm text-red-600 hover:bg-gray-50 font-medium cursor-pointer"
        >
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <header ref={headerRef} className="fixed top-0 left-0 right-0 z-[100] isolate pointer-events-auto bg-white/80 backdrop-blur border-b border-gray-200/70">
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

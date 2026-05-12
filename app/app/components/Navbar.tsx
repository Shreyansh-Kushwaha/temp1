"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Clock,
  PlusCircle,
  LogOut,
  Shield,
  Bot,
  ScrollText,
  LifeBuoy,
  MessageSquare,
  Menu,
  X,
} from "lucide-react";
import { getAuth, clearAuth, type AuthState } from "@/app/lib/auth";

type NavLink = {
  href: string;
  label: string;
  Icon: typeof PlusCircle;
  adminOnly?: boolean;
  teacherOnly?: boolean;
};

const NAV_LINKS: NavLink[] = [
  { href: "/ptm", label: "Generate", Icon: PlusCircle },
  { href: "/ptm/pending", label: "Pending", Icon: Clock },
  { href: "/ptm/logs", label: "Logs", Icon: ScrollText },
  { href: "/ptm/issues", label: "Issues", Icon: LifeBuoy, adminOnly: true },
  { href: "/ptm/support", label: "Support", Icon: MessageSquare, teacherOnly: true },
  { href: "/ptm/escalated", label: "Escalated", Icon: AlertTriangle },
  { href: "/ptm/automation", label: "Automation", Icon: Bot },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [auth, setAuthState] = useState<AuthState | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    setAuthState(getAuth());
    const handler = () => setAuthState(getAuth());
    window.addEventListener("ptm:auth-change", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("ptm:auth-change", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  // Close drawer on route change so a tap-link feels native.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // Lock body scroll while drawer is open so the page underneath doesn't move.
  useEffect(() => {
    if (drawerOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [drawerOpen]);

  function handleLogout() {
    setDrawerOpen(false);
    clearAuth();
    router.replace("/login");
  }

  const displayName =
    auth?.role === "admin" ? "Administrator" : auth?.teacher_name ?? "Guest";
  const subline = auth?.role === "admin" ? "All-access" : "Class Teacher";
  const initials = (displayName || "?")
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const isActive = (href: string) => {
    if (href === "/ptm") return pathname === "/ptm" || pathname.startsWith("/ptm/students");
    return pathname.startsWith(href);
  };

  // Show neutral links to everyone, admin-only links only to admins, and
  // teacher-only links only to teachers. Signed-out users see neutral only.
  const visibleLinks = NAV_LINKS.filter((l) => {
    if (l.adminOnly) return auth?.role === "admin";
    if (l.teacherOnly) return auth?.role === "teacher";
    return true;
  });

  return (
    <>
      <nav className="sticky top-0 z-50 h-16 bg-white border-b border-[var(--ss-i-200)] shadow-[var(--ss-shadow)] flex items-center px-4 md:px-8 gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-full bg-[var(--ss-o-500)] flex items-center justify-center shadow-[var(--ss-shadow-brand)]">
            <span className="text-white font-extrabold text-sm" style={{ fontFamily: "var(--font-jakarta)" }}>S</span>
          </div>
          <div className="hidden sm:flex flex-col leading-none">
            <span className="font-bold text-[var(--ss-i-900)] text-sm leading-tight" style={{ fontFamily: "var(--font-jakarta)" }}>
              Super Sheldon
            </span>
            <span className="text-[10px] text-[var(--ss-i-400)] font-medium tracking-wide">PTM Agent</span>
          </div>
        </Link>

        {/* Divider */}
        <div className="hidden sm:block w-px h-6 bg-[var(--ss-i-200)] mx-1" />

        {/* Nav links — desktop only (≥ md) */}
        <div className="hidden md:flex items-center gap-1">
          {visibleLinks.map(({ href, label, Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  active
                    ? "bg-[var(--ss-o-50)] text-[var(--ss-o-600)] border border-[var(--ss-o-200)]"
                    : "text-[var(--ss-i-500)] hover:bg-[var(--ss-i-100)] hover:text-[var(--ss-i-700)]"
                }`}
              >
                <Icon size={14} />
                <span>{label}</span>
              </Link>
            );
          })}
        </div>

        {/* User + logout */}
        <div className="ml-auto flex items-center gap-2 md:gap-2.5">
          <div className="hidden md:flex flex-col items-end leading-none">
            <span className="text-xs font-semibold text-[var(--ss-i-700)] flex items-center gap-1.5">
              {auth?.role === "admin" && <Shield size={11} className="text-[var(--ss-o-500)]" />}
              {displayName}
            </span>
            <span className="text-[10px] text-[var(--ss-i-400)]">{subline}</span>
          </div>
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center shadow-[var(--ss-shadow-brand)] shrink-0 ${
              auth?.role === "admin"
                ? "bg-gradient-to-br from-[var(--ss-i-900)] to-[var(--ss-o-700)]"
                : "bg-[var(--ss-o-500)]"
            }`}
          >
            <span className="text-white font-bold text-xs" style={{ fontFamily: "var(--font-jakarta)" }}>
              {initials || "?"}
            </span>
          </div>
          {auth && (
            <button
              type="button"
              onClick={handleLogout}
              className="hidden md:inline-flex p-1.5 rounded-full text-[var(--ss-i-400)] hover:bg-[var(--ss-i-100)] hover:text-[var(--ss-i-700)] transition-colors"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut size={14} />
            </button>
          )}
          {/* Hamburger — mobile only */}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="md:hidden inline-flex items-center justify-center w-11 h-11 rounded-full text-[var(--ss-i-700)] hover:bg-[var(--ss-i-100)] transition-colors"
            aria-label="Open menu"
            aria-expanded={drawerOpen}
            aria-controls="mobile-nav-drawer"
          >
            <Menu size={20} />
          </button>
        </div>
      </nav>

      {/* Mobile drawer — overlay + sheet */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-[60]" id="mobile-nav-drawer" role="dialog" aria-modal="true">
          {/* Scrim */}
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-[var(--ss-i-900)]/40 backdrop-blur-sm transition-opacity animate-[fadeIn_150ms_ease-out]"
          />
          {/* Sheet */}
          <div className="absolute right-0 top-0 h-full w-[85%] max-w-sm bg-white shadow-[var(--ss-shadow-lg)] flex flex-col animate-[slideInRight_200ms_ease-out]">
            <div className="h-16 flex items-center justify-between px-4 border-b border-[var(--ss-i-200)] shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[var(--ss-o-500)] flex items-center justify-center shadow-[var(--ss-shadow-brand)]">
                  <span className="text-white font-extrabold text-sm" style={{ fontFamily: "var(--font-jakarta)" }}>S</span>
                </div>
                <div className="flex flex-col leading-none">
                  <span className="font-bold text-[var(--ss-i-900)] text-sm leading-tight" style={{ fontFamily: "var(--font-jakarta)" }}>
                    Super Sheldon
                  </span>
                  <span className="text-[10px] text-[var(--ss-i-400)] font-medium tracking-wide">PTM Agent</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="inline-flex items-center justify-center w-11 h-11 rounded-full text-[var(--ss-i-500)] hover:bg-[var(--ss-i-100)] transition-colors"
                aria-label="Close menu"
              >
                <X size={20} />
              </button>
            </div>

            {auth && (
              <div className="px-4 py-4 border-b border-[var(--ss-i-200)] flex items-center gap-3 shrink-0">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center shadow-[var(--ss-shadow-brand)] ${
                    auth?.role === "admin"
                      ? "bg-gradient-to-br from-[var(--ss-i-900)] to-[var(--ss-o-700)]"
                      : "bg-[var(--ss-o-500)]"
                  }`}
                >
                  <span className="text-white font-bold text-sm" style={{ fontFamily: "var(--font-jakarta)" }}>
                    {initials || "?"}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-[var(--ss-i-900)] flex items-center gap-1.5 truncate">
                    {auth?.role === "admin" && <Shield size={12} className="text-[var(--ss-o-500)] shrink-0" />}
                    {displayName}
                  </div>
                  <div className="text-[11px] text-[var(--ss-i-500)]">{subline}</div>
                </div>
              </div>
            )}

            <nav className="flex-1 overflow-y-auto px-3 py-3">
              {visibleLinks.map(({ href, label, Icon }) => {
                const active = isActive(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setDrawerOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-base font-medium mb-1 transition-colors min-h-[48px] ${
                      active
                        ? "bg-[var(--ss-o-50)] text-[var(--ss-o-700)] border border-[var(--ss-o-200)]"
                        : "text-[var(--ss-i-700)] hover:bg-[var(--ss-i-50)]"
                    }`}
                  >
                    <Icon size={18} />
                    <span>{label}</span>
                  </Link>
                );
              })}
            </nav>

            {auth && (
              <div className="p-3 border-t border-[var(--ss-i-200)] shrink-0">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-sm font-semibold text-[var(--ss-i-700)] hover:bg-[var(--ss-i-100)] border border-[var(--ss-i-200)] min-h-[48px]"
                >
                  <LogOut size={16} />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Drawer animations — scoped here so we don't pollute globals.css */}
      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </>
  );
}

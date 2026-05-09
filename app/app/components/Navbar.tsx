"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AlertTriangle, Clock, PlusCircle, LogOut, Shield, Bot } from "lucide-react";
import { getAuth, clearAuth, type AuthState } from "@/app/lib/auth";

const NAV_LINKS = [
  { href: "/ptm", label: "Generate", Icon: PlusCircle },
  { href: "/ptm/pending", label: "Pending", Icon: Clock },
  { href: "/ptm/escalated", label: "Escalated", Icon: AlertTriangle },
  { href: "/ptm/automation", label: "Automation", Icon: Bot },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [auth, setAuthState] = useState<AuthState | null>(null);

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

  function handleLogout() {
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

  return (
    <nav className="sticky top-0 z-50 h-16 bg-white border-b border-[var(--ss-i-200)] shadow-[var(--ss-shadow)] flex items-center px-5 md:px-8 gap-4">
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

      {/* Nav links */}
      <div className="flex items-center gap-1">
        {NAV_LINKS.map(({ href, label, Icon }) => {
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
      <div className="ml-auto flex items-center gap-2.5">
        <div className="hidden md:flex flex-col items-end leading-none">
          <span className="text-xs font-semibold text-[var(--ss-i-700)] flex items-center gap-1.5">
            {auth?.role === "admin" && <Shield size={11} className="text-[var(--ss-o-500)]" />}
            {displayName}
          </span>
          <span className="text-[10px] text-[var(--ss-i-400)]">{subline}</span>
        </div>
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center shadow-[var(--ss-shadow-brand)] ${
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
            className="p-1.5 rounded-full text-[var(--ss-i-400)] hover:bg-[var(--ss-i-100)] hover:text-[var(--ss-i-700)] transition-colors"
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut size={14} />
          </button>
        )}
      </div>
    </nav>
  );
}

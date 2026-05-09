"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getAuth } from "@/app/lib/auth";

const PUBLIC_PATHS = new Set(["/login", "/"]);
// Print pages render via the backend's Playwright PDF service which has no
// browser session — they must be accessible without auth. The URL is keyed
// by the report id which is already an unguessable UUID.
const PRINT_PATH_RE = /^\/ptm\/[^/]+\/print$/;

function isPathPublic(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  if (PUBLIC_PATHS.has(pathname)) return true;
  return PRINT_PATH_RE.test(pathname);
}

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const auth = getAuth();
    const isPublic = isPathPublic(pathname);

    if (!auth && !isPublic) {
      router.replace("/login");
      return;
    }
    if (auth && pathname === "/login") {
      router.replace("/ptm/pending");
      return;
    }
    setReady(true);
  }, [pathname, router]);

  // Listen for sign-out from other tabs / Navbar
  useEffect(() => {
    const handler = () => {
      const auth = getAuth();
      const isPublic = isPathPublic(pathname);
      if (!auth && !isPublic) router.replace("/login");
      if (auth && pathname === "/login") router.replace("/ptm/pending");
    };
    window.addEventListener("ptm:auth-change", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("ptm:auth-change", handler);
      window.removeEventListener("storage", handler);
    };
  }, [pathname, router]);

  if (!ready) {
    // Tiny invisible shell — avoids a flash of protected content
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "var(--ss-bg)",
        }}
      />
    );
  }
  return <>{children}</>;
}

"use client";

export type Role = "admin" | "teacher";

export interface AuthState {
  role: Role;
  teacher_name: string | null;
  loggedInAt: string;
}

const KEY = "ptm.auth";

// Demo password — replace with proper auth before any non-internal use.
export const DEMO_PASSWORD = "123456789";

export function getAuth(): AuthState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthState;
    if (parsed && (parsed.role === "admin" || parsed.role === "teacher")) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function setAuth(state: Omit<AuthState, "loggedInAt">) {
  if (typeof window === "undefined") return;
  const full: AuthState = { ...state, loggedInAt: new Date().toISOString() };
  window.localStorage.setItem(KEY, JSON.stringify(full));
  window.dispatchEvent(new CustomEvent("ptm:auth-change"));
}

export function clearAuth() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
  window.dispatchEvent(new CustomEvent("ptm:auth-change"));
}

export function isAuthenticated(): boolean {
  return getAuth() !== null;
}

export function isAdmin(): boolean {
  return getAuth()?.role === "admin";
}

export function currentTeacherName(): string | null {
  const a = getAuth();
  return a && a.role === "teacher" ? a.teacher_name : null;
}

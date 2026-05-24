"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore, selectUser } from "@/stores/auth.store";
import type { AppUser } from "@/types/user";

/**
 * Guards a page to admin-role users only.
 *
 * Redirect rules:
 *   - Not logged in      → redirect to "/"
 *   - role === "student" → redirect to "/"
 *   - role === "admin"   → returns the user, page renders normally
 *
 * Redirects to "/" rather than "/login" so a student who stumbles onto
 * /admin sees the landing page, not a confusing login prompt.
 *
 * Works identically to useRequireAuth — Zustand persist rehydrates the
 * auth store from localStorage synchronously before the first render, so
 * there is no flash of unprotected content.
 */
export function useRequireAdmin(): AppUser | null {
  const router = useRouter();
  const user = useAuthStore(selectUser);

  useEffect(() => {
    if (!user || user.role !== "admin") {
      router.replace("/");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // once on mount — store is already rehydrated at this point

  // Return null immediately for non-admins so the page can bail before rendering.
  if (!user || user.role !== "admin") return null;
  return user;
}

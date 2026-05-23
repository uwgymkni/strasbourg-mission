"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore, selectUser } from "@/stores/auth.store";
import type { AppUser } from "@/types/user";

/**
 * Redirects to /login if no authenticated user is found on mount.
 * Returns the user immediately — Zustand persist rehydrates from localStorage
 * synchronously, so authenticated users see their data on the first render.
 *
 * Pages should return null when this returns null to avoid rendering
 * protected content during the redirect.
 */
export function useRequireAuth(): AppUser | null {
  const router = useRouter();
  const user = useAuthStore(selectUser);

  useEffect(() => {
    if (!user) {
      router.replace("/login");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // once on mount — user is already rehydrated from localStorage by this point

  return user;
}

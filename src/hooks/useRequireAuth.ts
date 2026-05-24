"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore, selectUser } from "@/stores/auth.store";
import type { AppUser } from "@/types/user";

/**
 * Guards game pages to logged-in users only.
 *
 * Redirect rules (evaluated once on mount — store is already rehydrated):
 *   - No user  → /login
 *   - Has user → returns the user, page renders normally
 *
 * Pages should return null when this returns null to avoid rendering
 * protected content during the in-flight redirect.
 */
export function useRequireAuth(): AppUser | null {
  const router = useRouter();

  // Subscribe for reactivity (re-render on logout).
  // Value intentionally ignored — we read via getState() below to bypass
  // the useSyncExternalStore snapshot-timing issue that can return null on
  // the first render of a new route segment even after localStorage rehydration.
  useAuthStore(selectUser);

  useEffect(() => {
    const u = useAuthStore.getState().user;
    if (!u) {
      router.replace("/login");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // once on mount — store is already rehydrated at this point

  const u = useAuthStore.getState().user;
  if (!u) return null;
  return u;
}

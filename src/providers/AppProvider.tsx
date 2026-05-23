"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";

interface AppProviderProps {
  children: React.ReactNode;
}

/**
 * Validates the persisted session against Firebase once on app load.
 * Runs in the background — the app is functional immediately from the persisted
 * Zustand state while the check completes. On network failure, the session is
 * preserved optimistically (handled inside restoreSession).
 */
export function AppProvider({ children }: AppProviderProps) {
  const { restoreSession } = useAuth();
  const restoredRef = useRef(false);

  useEffect(() => {
    if (restoredRef.current) return; // prevent double-fire in React StrictMode
    restoredRef.current = true;
    void restoreSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // once per app load

  return <>{children}</>;
}

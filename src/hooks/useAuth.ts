"use client";

import { useRef, useState } from "react";
import {
  useAuthStore,
  selectUser,
  selectAuthStatus,
  selectIsAuthenticated,
} from "@/stores/auth.store";
import { useGameStore } from "@/stores/game.store";
import {
  loginWithGroupCode,
  getTeamByCode,
  logout as logoutService,
} from "@/services/auth.service";
import type { ServiceResult } from "@/lib/result";
import type { AppUser } from "@/types/user";

export function useAuth() {
  const [loading, setLoading] = useState(false);
  // Ref-based guard: prevents concurrent logins without triggering a rerender on check
  const loginInFlight = useRef(false);

  const user = useAuthStore(selectUser);
  const status = useAuthStore(selectAuthStatus);
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const authError = useAuthStore((s) => s.error);

  const setUser = useAuthStore((s) => s.setUser);
  const setStatus = useAuthStore((s) => s.setStatus);
  const setAuthError = useAuthStore((s) => s.setError);
  const resetAuth = useAuthStore((s) => s.reset);
  const resetGame = useGameStore((s) => s.resetGame);

  async function login(code: string): Promise<ServiceResult<AppUser>> {
    if (loginInFlight.current) {
      return { success: false, error: "Login already in progress." };
    }

    loginInFlight.current = true;
    setLoading(true);
    setAuthError(null);
    setStatus("loading");

    const result = await loginWithGroupCode(code);

    if (result.success) {
      setUser(result.data);
      setStatus("authenticated");
    } else {
      setAuthError(result.error);
      setStatus("error");
    }

    setLoading(false);
    loginInFlight.current = false;
    return result;
  }

  async function logout(): Promise<void> {
    setLoading(true);
    await logoutService(); // stateless at service layer — always succeeds
    resetGame();           // clear game progress from store and localStorage
    resetAuth();           // clear user session from store and localStorage
    setLoading(false);
  }

  /**
   * Re-validates a persisted session against Firebase.
   * Call once on app mount (e.g. in a layout or provider component).
   *
   * On network failure, the persisted session is restored optimistically — a school
   * trip in the field may have poor connectivity, and forcing re-login would break the UX.
   * A genuinely invalid session will surface naturally on the next Firebase interaction.
   */
  async function restoreSession(): Promise<void> {
    const persisted = useAuthStore.getState().user;
    if (!persisted) return;

    setStatus("loading");

    const result = await getTeamByCode(persisted.teamCode);

    if (result.success) {
      setUser(result.data); // refresh with latest Firestore data (e.g. role changes)
      setStatus("authenticated");
    } else {
      // Restore optimistically — do not clear session on network errors.
      // If the team was genuinely deleted, the next service call will surface that.
      setStatus("authenticated");
    }
  }

  function clearError(): void {
    setAuthError(null);
  }

  return {
    user,
    status,
    isAuthenticated,
    loading,
    error: authError,
    login,
    logout,
    restoreSession,
    clearError,
  };
}

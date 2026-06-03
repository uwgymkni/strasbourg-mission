"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AppUser } from "@/types/user";

export type AuthStatus = "idle" | "loading" | "authenticated" | "error";

interface AuthState {
  user: AppUser | null;
  status: AuthStatus;
  error: string | null;
  /** Locally-generated, persisted session marker. Used by the multi-device
   *  detection to recognise "this is still me on the same browser" vs. "a
   *  second device just signed in as the same team". Cleared on explicit
   *  logout, regenerated on the next login. */
  sessionId: string | null;
}

interface AuthActions {
  setUser: (user: AppUser | null) => void;
  setStatus: (status: AuthStatus) => void;
  setError: (error: string | null) => void;
  setSessionId: (sessionId: string | null) => void;
  reset: () => void;
}

const initialState: AuthState = {
  user: null,
  status: "idle",
  error: null,
  sessionId: null,
};

export const useAuthStore = create<AuthState & AuthActions>()(
  persist(
    (set) => ({
      ...initialState,

      setUser: (user) => set({ user }),
      setStatus: (status) => set({ status }),
      setError: (error) => set({ error }),
      setSessionId: (sessionId) => set({ sessionId }),
      // Logout clears identity but PRESERVES sessionId: it identifies the
      // browser/device, not the login. Keeping it stable across logout means
      // a re-login on the same device reads its own marker back from Firestore
      // (sessionId === localSessionId) and never warns against itself. A real
      // second device still has a different sessionId, so cross-device warnings
      // remain correct. Offline-safe — no Firestore write needed on logout.
      reset: () =>
        set((state) => ({ ...initialState, sessionId: state.sessionId })),
    }),
    {
      name: "sm-auth",
      // Persist identity + session marker so the same browser keeps the
      // same session across reloads. status and error stay transient.
      partialize: (state) => ({
        user: state.user,
        sessionId: state.sessionId,
      }),
    }
  )
);

// Selectors — stable references, no new function created on each render
export const selectUser = (s: AuthState & AuthActions) => s.user;
export const selectAuthStatus = (s: AuthState & AuthActions) => s.status;
export const selectAuthError = (s: AuthState & AuthActions) => s.error;
export const selectIsAuthenticated = (s: AuthState & AuthActions) =>
  s.status === "authenticated" && s.user !== null;

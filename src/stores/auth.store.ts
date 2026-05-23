"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AppUser } from "@/types/user";

export type AuthStatus = "idle" | "loading" | "authenticated" | "error";

interface AuthState {
  user: AppUser | null;
  status: AuthStatus;
  error: string | null;
}

interface AuthActions {
  setUser: (user: AppUser | null) => void;
  setStatus: (status: AuthStatus) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState: AuthState = {
  user: null,
  status: "idle",
  error: null,
};

export const useAuthStore = create<AuthState & AuthActions>()(
  persist(
    (set) => ({
      ...initialState,

      setUser: (user) => set({ user }),
      setStatus: (status) => set({ status }),
      setError: (error) => set({ error }),
      reset: () => set(initialState),
    }),
    {
      name: "sm-auth",
      // Only persist the user identity — status and error are transient
      partialize: (state) => ({ user: state.user }),
    }
  )
);

// Selectors — stable references, no new function created on each render
export const selectUser = (s: AuthState & AuthActions) => s.user;
export const selectAuthStatus = (s: AuthState & AuthActions) => s.status;
export const selectAuthError = (s: AuthState & AuthActions) => s.error;
export const selectIsAuthenticated = (s: AuthState & AuthActions) =>
  s.status === "authenticated" && s.user !== null;

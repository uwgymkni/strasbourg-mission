"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Station, StationStatus } from "@/types/game";

interface GameState {
  stations: Station[];
  progress: Record<string, StationStatus>;
  currentStationId: string | null;
}

interface GameActions {
  setStations: (stations: Station[]) => void;
  setProgress: (progress: Record<string, StationStatus>) => void;
  completeStation: (stationId: string) => void;
  unlockNextStation: () => void;
  resetGame: () => void;
}

const initialState: GameState = {
  stations: [],
  progress: {},
  currentStationId: null,
};

export const useGameStore = create<GameState & GameActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      setStations: (stations) => set({ stations }),

      setProgress: (progress) => set({ progress }),

      // Marks a single station completed. Does NOT unlock the next one.
      // The hook calling this is responsible for calling unlockNextStation() afterwards.
      completeStation: (stationId) =>
        set((state) => ({
          progress: { ...state.progress, [stationId]: "completed" },
        })),

      // Activates the station that follows the current one by order.
      // No-op if there is no current station or no next station.
      unlockNextStation: () => {
        const { stations, progress, currentStationId } = get();

        const current = stations.find((s) => s.id === currentStationId);
        if (!current) return;

        const next = stations.find((s) => s.order === current.order + 1);
        if (!next) return;

        set({
          progress: { ...progress, [next.id]: "active" },
          currentStationId: next.id,
        });
      },

      // Wipes all game progress. Does not touch stations (static config).
      resetGame: () =>
        set({ progress: {}, currentStationId: null }),
    }),
    {
      name: "sm-game",
      // Persist user progress only — stations are reloaded from Firebase on each session
      partialize: (state) => ({
        progress: state.progress,
        currentStationId: state.currentStationId,
      }),
    }
  )
);

// Selectors
export const selectStations = (s: GameState & GameActions) => s.stations;
export const selectProgress = (s: GameState & GameActions) => s.progress;
export const selectCurrentStationId = (s: GameState & GameActions) => s.currentStationId;

// Derived — computed inline in components with useGameStore(selectCompletedCount)
export const selectCompletedCount = (s: GameState & GameActions) =>
  Object.values(s.progress).filter((v) => v === "completed").length;

// Per-station status — use inline: useGameStore(s => s.progress[stationId] ?? "locked")
// Avoid curried selectors at module level; they create a new function reference on every call.

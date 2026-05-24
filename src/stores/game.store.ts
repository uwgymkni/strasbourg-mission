"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Station, StationStatus } from "@/types/game";

interface GameState {
  stations: Station[];
  progress: Record<string, StationStatus>;
  currentStationId: string | null;
  wrongAnswers: Record<string, number>;
}

interface GameActions {
  setStations: (stations: Station[]) => void;
  setProgress: (progress: Record<string, StationStatus>) => void;
  completeStation: (stationId: string) => void;
  unlockNextStation: (nextStationId: string | null) => void;
  skipStation: (stationId: string) => void;
  incrementWrongAnswer: (stationId: string) => void;
  resetGame: () => void;
}

const initialState: GameState = {
  stations: [],
  progress: {},
  currentStationId: null,
  wrongAnswers: {},
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

      // Activates the station identified by nextStationId.
      // No-op if nextStationId is null (last station completed or skipped).
      // The hook is responsible for computing nextStationId before calling this,
      // so the same value can be passed to the service layer without duplication.
      unlockNextStation: (nextStationId) => {
        if (!nextStationId) return;
        set((state) => ({
          progress: { ...state.progress, [nextStationId]: "active" },
          currentStationId: nextStationId,
        }));
      },

      // Marks a station as skipped. Does NOT unlock the next one.
      // The hook calling this is responsible for calling unlockNextStation() afterwards.
      skipStation: (stationId) =>
        set((state) => ({
          progress: { ...state.progress, [stationId]: "skipped" },
        })),

      // Increments the wrong-answer counter for a station.
      // Stored in localStorage so the skip threshold survives page navigation.
      incrementWrongAnswer: (stationId) =>
        set((state) => ({
          wrongAnswers: {
            ...state.wrongAnswers,
            [stationId]: (state.wrongAnswers[stationId] ?? 0) + 1,
          },
        })),

      // Wipes all game progress. Does not touch stations (static config).
      resetGame: () =>
        set({ progress: {}, currentStationId: null, wrongAnswers: {} }),
    }),
    {
      name: "sm-game",
      // Persist user progress only — stations are reloaded from Firebase on each session
      partialize: (state) => ({
        progress: state.progress,
        currentStationId: state.currentStationId,
        wrongAnswers: state.wrongAnswers,
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

// True when every station has been either completed or skipped (all resolved, ready for final).
export const selectAllResolved = (s: GameState & GameActions): boolean => {
  if (s.stations.length === 0) return false;
  return s.stations.every(
    (station) =>
      s.progress[station.id] === "completed" || s.progress[station.id] === "skipped"
  );
};

export const selectWrongAnswers = (s: GameState & GameActions) => s.wrongAnswers;

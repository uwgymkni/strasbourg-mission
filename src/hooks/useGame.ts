"use client";

import { useRef, useState } from "react";
import {
  useGameStore,
  selectStations,
  selectProgress,
  selectCurrentStationId,
  selectCompletedCount,
  selectAllResolved,
  selectWrongAnswers,
} from "@/stores/game.store";
import {
  fetchStations,
  fetchTeamProgress,
  persistStationCompletion,
  persistStationSkip,
  persistProgress,
  submitFinalSolution,
  resetTeamProgress,
  persistWrongAnswer,
} from "@/services/game.service";
import { ok, type ServiceResult } from "@/lib/result";
import type { Station, TeamProgress } from "@/types/game";

/**
 * Returns the ID of the station that immediately follows the given one (by order),
 * or null if no such station exists (i.e. the given station is the last one).
 *
 * Single source of truth for "what comes next" — used by both completeCurrentStation
 * and skipCurrentStation so the value is computed once and passed both to the Firestore
 * write (service layer) and the in-memory store update, ensuring they always agree.
 */
function findNextStationId(
  stations: Station[],
  currentStationId: string | null
): string | null {
  if (!currentStationId) return null;
  const current = stations.find((s) => s.id === currentStationId);
  if (!current) return null;
  const next = stations.find((s) => s.order === current.order + 1);
  return next?.id ?? null;
}

export function useGame() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stores the team ID for the lifetime of the game session.
  // Set by loadGame; used by all subsequent actions.
  const teamIdRef = useRef<string | null>(null);

  // Prevents concurrent station submissions without triggering rerenders on the guard check.
  const submittingRef = useRef(false);

  const stations = useGameStore(selectStations);
  const progress = useGameStore(selectProgress);
  const currentStationId = useGameStore(selectCurrentStationId);
  const completedCount = useGameStore(selectCompletedCount);
  const allResolved = useGameStore(selectAllResolved);
  const wrongAnswers = useGameStore(selectWrongAnswers);

  const setStations = useGameStore((s) => s.setStations);
  const completeStationInStore = useGameStore((s) => s.completeStation);
  const unlockNextInStore = useGameStore((s) => s.unlockNextStation);
  const skipStationInStore = useGameStore((s) => s.skipStation);
  const incrementWrongAnswerInStore = useGameStore((s) => s.incrementWrongAnswer);
  const resetGameInStore = useGameStore((s) => s.resetGame);

  /**
   * Loads stations and team progress from Firebase.
   * Firebase always wins over persisted localStorage state.
   * If no progress document exists (new team), creates the initial one.
   * Falls back silently to persisted state on network failure.
   */
  async function loadGame(teamId: string): Promise<void> {
    teamIdRef.current = teamId;
    setLoading(true);
    setError(null);

    // Stations are always fetched fresh — they are config, not user state.
    const stationsResult = await fetchStations();
    if (!stationsResult.success) {
      setError(stationsResult.error);
      setLoading(false);
      return;
    }
    setStations(stationsResult.data);

    const progressResult = await fetchTeamProgress(teamId);

    if (!progressResult.success) {
      // Firebase unreachable — persisted Zustand state remains as fallback.
      // Do not overwrite it; the student can continue from their last known position.
      setLoading(false);
      return;
    }

    if (progressResult.data) {
      // Firebase has a progress document — overwrite persisted local state atomically.
      // useGameStore.setState is used here (rather than individual store actions)
      // because there is no single store action that sets both fields together.
      useGameStore.setState({
        progress: progressResult.data.progress,
        currentStationId: progressResult.data.currentStationId,
      });
    } else if (stationsResult.data.length > 0) {
      // New team — initialize their progress with the first station active.
      const firstStation = stationsResult.data[0]!;
      const initialProgress: TeamProgress = {
        teamId,
        progress: { [firstStation.id]: "active" },
        currentStationId: firstStation.id,
        startedAt: Date.now(),
        finalAnswer: null,
      };

      const initResult = await persistProgress(teamId, initialProgress);
      if (initResult.success) {
        useGameStore.setState({
          progress: initialProgress.progress,
          currentStationId: initialProgress.currentStationId,
        });
      } else {
        setError(initResult.error);
      }
    }

    setLoading(false);
  }

  /**
   * Completes the current station and unlocks the next.
   *
   * Explicit sequence — Firebase first, store second:
   *   1. persistStationCompletion()  → write to Firebase
   *   2. completeStation()           → mark completed in store
   *   3. unlockNextStation()         → activate next station in store
   *
   * Steps 2 and 3 only run if step 1 succeeds. The store never moves ahead of Firebase.
   * Retries are safe — the Firestore write is idempotent (dot-notation update).
   */
  async function completeCurrentStation(answer?: string): Promise<ServiceResult<void>> {
    const currentId = useGameStore.getState().currentStationId;

    if (!currentId) {
      return { success: false, error: "No active station to complete." };
    }
    if (!teamIdRef.current) {
      return { success: false, error: "Game session not loaded. Call loadGame first." };
    }
    if (submittingRef.current) {
      return { success: false, error: "Submission already in progress." };
    }

    submittingRef.current = true;
    setLoading(true);
    setError(null);

    // Compute once — reused for the Firestore write and the store update so both
    // always activate the exact same next station without duplicating the lookup.
    const nextStationId = findNextStationId(
      useGameStore.getState().stations,
      currentId
    );

    const result = await persistStationCompletion(
      teamIdRef.current,
      currentId,
      nextStationId,
      answer
    );

    if (!result.success) {
      setError(result.error);
      setLoading(false);
      submittingRef.current = false;
      return result;
    }

    // Firebase confirmed — now mirror the same state in the store.
    completeStationInStore(currentId);
    unlockNextInStore(nextStationId);

    setLoading(false);
    submittingRef.current = false;
    return ok(undefined);
  }

  /** Records the team's final answer in Firebase. */
  async function submitFinal(answer: string): Promise<ServiceResult<void>> {
    if (!teamIdRef.current) {
      return { success: false, error: "Game session not loaded." };
    }
    if (!answer.trim()) {
      return { success: false, error: "Answer cannot be empty." };
    }

    setLoading(true);
    const result = await submitFinalSolution(teamIdRef.current, answer);
    if (!result.success) setError(result.error);
    setLoading(false);
    return result;
  }

  /**
   * Skips the current station — marks it as skipped in Firebase and unlocks the next.
   *
   * Same explicit sequence as completeCurrentStation:
   *   1. persistStationSkip()  → write to Firebase (progress.stationId = "skipped", wrongAnswers)
   *   2. skipStation()         → mark skipped in store
   *   3. unlockNextStation()   → activate next station in store
   *
   * Steps 2 and 3 only run if step 1 succeeds. Retries are safe (idempotent write).
   */
  async function skipCurrentStation(): Promise<ServiceResult<void>> {
    const currentId = useGameStore.getState().currentStationId;

    if (!currentId) {
      return { success: false, error: "Keine aktive Station zum Überspringen." };
    }
    if (!teamIdRef.current) {
      return { success: false, error: "Spielsitzung nicht geladen. Bitte neu laden." };
    }
    if (submittingRef.current) {
      return { success: false, error: "Aktion bereits in Bearbeitung." };
    }

    submittingRef.current = true;
    setLoading(true);
    setError(null);

    // Compute once — same value goes to both the Firestore write and the store update.
    const nextStationId = findNextStationId(
      useGameStore.getState().stations,
      currentId
    );
    const wrongCount = useGameStore.getState().wrongAnswers[currentId] ?? 0;

    const result = await persistStationSkip(
      teamIdRef.current,
      currentId,
      wrongCount,
      nextStationId
    );

    if (!result.success) {
      setError(result.error);
      setLoading(false);
      submittingRef.current = false;
      return result;
    }

    // Firebase confirmed — now mirror the same state in the store.
    skipStationInStore(currentId);
    unlockNextInStore(nextStationId);

    setLoading(false);
    submittingRef.current = false;
    return ok(undefined);
  }

  /**
   * Increments the local wrong-answer counter for a station. Persisted to localStorage.
   * If `answer` is provided, also fires-and-forgets a Firestore update so Mission Control
   * can see the count + the raw wrong text in (near) real time. Never throws — a failed
   * persist must not block the student from trying again.
   */
  function incrementWrongAnswer(stationId: string, answer?: string): void {
    incrementWrongAnswerInStore(stationId);
    if (typeof answer === "string" && answer.length > 0 && teamIdRef.current) {
      const newCount = useGameStore.getState().wrongAnswers[stationId] ?? 0;
      void persistWrongAnswer(teamIdRef.current, stationId, answer, newCount);
    }
  }

  /**
   * Resets a team's progress. Admin-facing.
   * The calling component is responsible for verifying admin role before invoking this.
   */
  async function resetGame(): Promise<ServiceResult<void>> {
    if (!teamIdRef.current) {
      return { success: false, error: "No active game session." };
    }

    setLoading(true);
    const result = await resetTeamProgress(teamIdRef.current);

    if (result.success) {
      resetGameInStore();
    } else {
      setError(result.error);
    }

    setLoading(false);
    return result;
  }

  /** Sets the team ID ref without triggering a Firebase read.
   * Call on pages that need to write (mission, final) when stations are already
   * in the store from a prior loadGame call on the dashboard. */
  function initTeamId(teamId: string): void {
    teamIdRef.current = teamId;
  }

  function clearError(): void {
    setError(null);
  }

  return {
    stations,
    progress,
    currentStationId,
    completedCount,
    allResolved,
    wrongAnswers,
    loading,
    error,
    loadGame,
    initTeamId,
    completeCurrentStation,
    skipCurrentStation,
    incrementWrongAnswer,
    submitFinal,
    resetGame,
    clearError,
  };
}

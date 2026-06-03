"use client";

import { useEffect, useState } from "react";
import {
  subscribeQuizState,
  subscribeScores,
  subscribeOwnResponse,
  submitQuizAnswer,
} from "@/services/quiz.service";
import { useAuthStore, selectUser } from "@/stores/auth.store";
import type { QuizState, QuizScore } from "@/types/quiz";

/**
 * Student-side quiz hook. Read-only on state + scores (push via onSnapshot),
 * plus a local 1 s tick for the live timer. The only write is submitting the
 * team's own answer. No polling intervals beyond the display tick.
 */
export function useQuiz() {
  const user = useAuthStore(selectUser);
  const teamId = user?.teamCode ?? null;

  const [state, setState] = useState<QuizState | null>(null);
  const [scores, setScores] = useState<QuizScore[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [myOptionIndex, setMyOptionIndex] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeQuizState(setState);
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = subscribeScores(setScores);
    return unsub;
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, []);

  const nonce = state?.sessionNonce ?? "";
  const phase = state?.phase ?? "idle";
  const qIndex = state?.currentQuestionIndex ?? -1;

  // Track our own answer for the current question (survives reload mid-question).
  // The reset lives in cleanup (runs on dep change / unmount), so there is no
  // synchronous setState in the effect body. On a new question the fresh
  // subscription fires with the non-existent doc → null, clearing the choice.
  useEffect(() => {
    if (!teamId || !nonce || qIndex < 0 || (phase !== "question" && phase !== "reveal")) {
      return;
    }
    const unsub = subscribeOwnResponse(nonce, qIndex, teamId, setMyOptionIndex);
    return () => {
      unsub();
      setMyOptionIndex(null);
    };
  }, [teamId, nonce, qIndex, phase]);

  async function submit(optionIndex: number): Promise<void> {
    if (!state || !teamId || state.phase !== "question") return;
    if (myOptionIndex !== null) return; // already answered
    const sessionId = useAuthStore.getState().sessionId ?? "";
    setSubmitting(true);
    setSubmitError(null);
    // Optimistic — disable the buttons immediately.
    setMyOptionIndex(optionIndex);
    const result = await submitQuizAnswer(
      state.sessionNonce,
      state.currentQuestionIndex,
      teamId,
      optionIndex,
      sessionId,
    );
    if (!result.success) {
      // Likely already answered (create-only) or offline — keep optimistic
      // choice but surface a hint; the snapshot will reconcile the truth.
      setSubmitError("Antwort konnte evtl. nicht gespeichert werden.");
    }
    setSubmitting(false);
  }

  return {
    state,
    scores,
    now,
    teamId,
    myOptionIndex,
    hasAnswered: myOptionIndex !== null,
    submitting,
    submitError,
    submit,
  };
}

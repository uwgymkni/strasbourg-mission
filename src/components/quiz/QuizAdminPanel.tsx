"use client";

import { useEffect, useRef, useState } from "react";
import {
  subscribeQuizState,
  subscribeScores,
  subscribeResponseCount,
  fetchResponsesOnce,
  fetchScoresOnce,
  writeTeamScore,
  updateQuizState,
  startQuiz,
  resetQuiz,
} from "@/services/quiz.service";
import {
  QUIZ_QUESTIONS,
  QUIZ_COUNTDOWN_MS,
  QUIZ_REVEAL_MS,
  QUIZ_DURATION_OPTIONS_MS,
  QUIZ_DEFAULT_DURATION_MS,
} from "@/constants/quiz";
import { computeScore, rankScores } from "@/lib/quizScoring";
import { TEAM_CONFIGS } from "@/constants/routes";
import type { QuizState, QuizScore } from "@/types/quiz";

const TEAMS = TEAM_CONFIGS.map((t) => ({ teamId: t.teamCode, teamName: t.teamName }));
function teamName(teamId: string): string {
  return TEAM_CONFIGS.find((t) => t.teamCode === teamId)?.teamName ?? teamId;
}

/**
 * Quiz control panel + autonomous controller for Mission Control.
 *
 * The controller (the transition effect below) is the single authoritative
 * driver of the quiz state machine. It must run wherever Mission Control is
 * open — keep this tab open for the whole quiz. All transitions are guarded by
 * busyRef (serialises in-flight writes) and re-evaluated whenever a new state
 * snapshot or the 1 s tick arrives.
 *
 * Fully isolated from the rest of Mission Control: its own subscriptions +
 * tick live here, so it never changes props of the memoised MissionMap.
 */
export function QuizAdminPanel() {
  const [state, setState] = useState<QuizState | null>(null);
  const [scores, setScores] = useState<QuizScore[]>([]);
  const [responseCount, setResponseCount] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [durationMs, setDurationMs] = useState<number>(QUIZ_DEFAULT_DURATION_MS);
  const [busyButton, setBusyButton] = useState(false);

  // Serialises controller transitions. Reset to false on every fresh state
  // snapshot, so the next tick can act on the new phase.
  const busyRef = useRef(false);

  // ── Subscriptions ──────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = subscribeQuizState((s) => {
      setState(s);
      busyRef.current = false;
    });
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

  // Response count for the current question (only while a question is live).
  const nonce = state?.sessionNonce ?? "";
  const phase = state?.phase ?? "idle";
  const qIndex = state?.currentQuestionIndex ?? -1;
  useEffect(() => {
    if (phase !== "question" || !nonce || qIndex < 0) {
      return;
    }
    const unsub = subscribeResponseCount(nonce, qIndex, setResponseCount);
    return () => {
      unsub();
      setResponseCount(0);
    };
  }, [phase, nonce, qIndex]);

  /** Scores the just-closed question and transitions to reveal. */
  async function closeQuestion(s: QuizState) {
    const index = s.currentQuestionIndex;
    const q = QUIZ_QUESTIONS[index];
    const startedAt = s.questionStartedAt ?? 0;

    const [respRes, scoreRes] = await Promise.all([
      fetchResponsesOnce(s.sessionNonce, index),
      fetchScoresOnce(),
    ]);
    if (!q || !respRes.success || !scoreRes.success) {
      // Bail out without advancing — next tick retries.
      busyRef.current = false;
      return;
    }

    const scoreMap = new Map(scoreRes.data.map((sc) => [sc.teamId, sc]));

    let fastestTeamId: string | null = null;
    let fastestMs = Number.POSITIVE_INFINITY;

    for (const r of respRes.data) {
      const prev: QuizScore =
        scoreMap.get(r.teamId) ?? {
          teamId: r.teamId,
          teamName: teamName(r.teamId),
          totalScore: 0,
          answeredCount: 0,
          perQuestion: {},
          updatedAt: 0,
        };
      // Idempotent: skip if already scored (e.g. controller re-ran).
      if (prev.perQuestion[index]) continue;

      const correct = r.optionIndex === q.correctIndex;
      // Raw server-measured response time. Two invalid cases are forced to the
      // full duration (→ 0 points, never counted as fastest):
      //   - submittedAt === 0: server timestamp not yet resolved
      //   - rawMs < 0: submission stamped BEFORE questionStartedAt, i.e. a
      //     pre-question write (the countdown-window timing exploit). Clamping
      //     a negative value to 0 would otherwise award full points.
      const rawMs = r.submittedAt > 0 ? r.submittedAt - startedAt : s.questionDurationMs;
      const responseMs = rawMs < 0 ? s.questionDurationMs : rawMs;
      const points = computeScore(responseMs, s.questionDurationMs, correct);

      const perQuestion = {
        ...prev.perQuestion,
        [index]: { score: points, correct, responseMs },
      };
      const totalScore = Object.values(perQuestion).reduce((sum, p) => sum + p.score, 0);

      const updated: QuizScore = {
        teamId: r.teamId,
        teamName: teamName(r.teamId),
        totalScore,
        answeredCount: Object.keys(perQuestion).length,
        perQuestion,
        updatedAt: Date.now(),
      };
      scoreMap.set(r.teamId, updated);
      await writeTeamScore(updated);

      if (correct && r.submittedAt > 0 && responseMs < fastestMs) {
        fastestMs = responseMs;
        fastestTeamId = r.teamId;
      }
    }

    await updateQuizState({
      phase: "reveal",
      revealStartedAt: Date.now(),
      lastReveal: {
        questionIndex: index,
        fastestTeamId,
        fastestTeamName: fastestTeamId ? teamName(fastestTeamId) : null,
      },
    });
  }

  // ── Controller transitions ───────────────────────────────────────────────
  useEffect(() => {
    if (!state) return;
    if (busyRef.current) return;

    // countdown → question 0
    if (
      state.phase === "countdown" &&
      state.countdownStartedAt !== null &&
      now >= state.countdownStartedAt + QUIZ_COUNTDOWN_MS
    ) {
      busyRef.current = true;
      void updateQuizState({
        phase: "question",
        currentQuestionIndex: 0,
        questionStartedAt: Date.now(),
        revealStartedAt: null,
      });
      return;
    }

    // question → reveal (all answered OR time up)
    if (state.phase === "question" && state.questionStartedAt !== null) {
      const timeUp = now >= state.questionStartedAt + state.questionDurationMs;
      const allAnswered =
        state.expectedTeamCount > 0 && responseCount >= state.expectedTeamCount;
      if (timeUp || allAnswered) {
        busyRef.current = true;
        void closeQuestion(state);
      }
      return;
    }

    // reveal → next question OR finished
    if (
      state.phase === "reveal" &&
      state.revealStartedAt !== null &&
      now >= state.revealStartedAt + QUIZ_REVEAL_MS
    ) {
      busyRef.current = true;
      if (state.currentQuestionIndex < state.totalQuestions - 1) {
        void updateQuizState({
          phase: "question",
          currentQuestionIndex: state.currentQuestionIndex + 1,
          questionStartedAt: Date.now(),
          revealStartedAt: null,
        });
      } else {
        void updateQuizState({ phase: "finished" });
      }
      return;
    }
  }, [state, now, responseCount]);

  // ── Actions ──────────────────────────────────────────────────────────────
  async function handleStart() {
    setBusyButton(true);
    await startQuiz(durationMs, TEAMS);
    setBusyButton(false);
  }
  async function handleReset() {
    setBusyButton(true);
    await resetQuiz();
    setBusyButton(false);
  }

  // ── Render ─────────────────────────────────────────────────────────────
  const ranked = rankScores(scores).slice(0, 8);
  const idle = !state || state.phase === "idle";

  const phaseLabel: Record<string, string> = {
    idle: "Bereit",
    countdown: "Countdown läuft",
    question: "Frage läuft",
    reveal: "Auflösung",
    finished: "Beendet",
  };

  const btn =
    "px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors disabled:opacity-50";

  return (
    <div className="bg-navy-800 border border-navy-700 rounded-2xl p-5 mb-6">
      <div className="flex items-center justify-between mb-3">
        <p className="text-gold-600 text-xs font-medium tracking-widest uppercase">
          Quiz
        </p>
        {state && !idle && (
          <span className="text-xs text-stone-400">
            {phaseLabel[state.phase]}
            {(state.phase === "question" || state.phase === "reveal") &&
              ` · Frage ${state.currentQuestionIndex + 1} / ${state.totalQuestions}`}
          </span>
        )}
      </div>

      {idle ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-stone-400">Zeit pro Frage:</span>
            {QUIZ_DURATION_OPTIONS_MS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDurationMs(d)}
                className={`${btn} ${
                  durationMs === d
                    ? "text-gold-400 border-gold-500/60 bg-gold-500/10"
                    : "text-stone-400 border-navy-600 hover:bg-navy-700/50"
                }`}
              >
                {d / 1000}s
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void handleStart()}
            disabled={busyButton}
            className={`${btn} self-start text-gold-400 border-gold-500/40 hover:bg-gold-500/10`}
          >
            {busyButton ? "Startet…" : "Quiz starten"}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Live status */}
          <div className="flex items-center gap-6 text-sm">
            {state?.phase === "question" && (
              <span className="text-stone-300">
                Geantwortet:{" "}
                <span className="text-cream tabular-nums font-medium">
                  {responseCount} / {state.expectedTeamCount}
                </span>
              </span>
            )}
            {state?.phase === "reveal" && state.lastReveal?.fastestTeamName && (
              <span className="text-stone-300">
                Schnellstes Team:{" "}
                <span className="text-gold-400 font-medium">
                  {state.lastReveal.fastestTeamName}
                </span>
              </span>
            )}
            {state?.phase === "finished" && (
              <span className="text-gold-400 font-medium">Quiz beendet 🎉</span>
            )}
          </div>

          {/* Mini leaderboard */}
          {ranked.length > 0 && (
            <div className="flex flex-col gap-1">
              {ranked.map((s) => (
                <div
                  key={s.teamId}
                  className="flex items-center justify-between text-sm py-1 border-b border-navy-700/40 last:border-0"
                >
                  <span className="text-stone-400 tabular-nums w-6">{s.rank}.</span>
                  <span className="text-cream flex-1">{s.teamName}</span>
                  <span className="text-gold-400 tabular-nums font-medium">
                    {Math.round(s.totalScore)}
                  </span>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => void handleReset()}
            disabled={busyButton}
            className={`${btn} self-start text-red-400 border-red-500/30 hover:bg-red-500/10`}
          >
            {busyButton ? "…" : "Quiz abbrechen / zurücksetzen"}
          </button>
        </div>
      )}
    </div>
  );
}

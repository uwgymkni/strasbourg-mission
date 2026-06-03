import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { getDb, COLLECTIONS } from "@/lib/firebase";
import { ok, err, type ServiceResult } from "@/lib/result";
import { QUIZ_QUESTIONS, QUIZ_DEFAULT_DURATION_MS } from "@/constants/quiz";
import type { QuizState, QuizResponse, QuizScore } from "@/types/quiz";

const QUIZ_STATE_DOC = "state";

/** Resolve a Firestore Timestamp-ish value to ms; 0 if not yet resolved. */
function toMs(value: unknown): number {
  if (typeof value === "number") return value;
  if (value && typeof (value as { toMillis?: unknown }).toMillis === "function") {
    return (value as { toMillis: () => number }).toMillis();
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Quiz state (single doc quiz/state)
// ---------------------------------------------------------------------------

export const DEFAULT_QUIZ_STATE: QuizState = {
  phase: "idle",
  currentQuestionIndex: -1,
  totalQuestions: QUIZ_QUESTIONS.length,
  questionDurationMs: QUIZ_DEFAULT_DURATION_MS,
  expectedTeamCount: 0,
  countdownStartedAt: null,
  questionStartedAt: null,
  revealStartedAt: null,
  sessionNonce: "",
  lastReveal: null,
  updatedAt: 0,
};

function normalizeQuizState(data: Record<string, unknown> | undefined): QuizState {
  if (!data) return { ...DEFAULT_QUIZ_STATE };
  const lr = data.lastReveal;
  const lastReveal =
    lr && typeof lr === "object" && !Array.isArray(lr)
      ? {
          questionIndex:
            typeof (lr as Record<string, unknown>).questionIndex === "number"
              ? ((lr as Record<string, unknown>).questionIndex as number)
              : -1,
          fastestTeamId:
            typeof (lr as Record<string, unknown>).fastestTeamId === "string"
              ? ((lr as Record<string, unknown>).fastestTeamId as string)
              : null,
          fastestTeamName:
            typeof (lr as Record<string, unknown>).fastestTeamName === "string"
              ? ((lr as Record<string, unknown>).fastestTeamName as string)
              : null,
        }
      : null;

  const phase = data.phase;
  return {
    phase:
      phase === "countdown" || phase === "question" || phase === "reveal" || phase === "finished"
        ? phase
        : "idle",
    currentQuestionIndex:
      typeof data.currentQuestionIndex === "number" ? data.currentQuestionIndex : -1,
    totalQuestions:
      typeof data.totalQuestions === "number" ? data.totalQuestions : QUIZ_QUESTIONS.length,
    questionDurationMs:
      typeof data.questionDurationMs === "number" ? data.questionDurationMs : QUIZ_DEFAULT_DURATION_MS,
    expectedTeamCount: typeof data.expectedTeamCount === "number" ? data.expectedTeamCount : 0,
    countdownStartedAt: typeof data.countdownStartedAt === "number" ? data.countdownStartedAt : null,
    questionStartedAt: typeof data.questionStartedAt === "number" ? data.questionStartedAt : null,
    revealStartedAt: typeof data.revealStartedAt === "number" ? data.revealStartedAt : null,
    sessionNonce: typeof data.sessionNonce === "string" ? data.sessionNonce : "",
    lastReveal,
    updatedAt: typeof data.updatedAt === "number" ? data.updatedAt : 0,
  };
}

/** Subscribe to quiz/state. Returns an unsubscribe fn. Push, not polling. */
export function subscribeQuizState(onChange: (state: QuizState) => void): () => void {
  const ref = doc(getDb(), COLLECTIONS.QUIZ, QUIZ_STATE_DOC);
  return onSnapshot(
    ref,
    (snap) => {
      onChange(
        normalizeQuizState(snap.exists() ? (snap.data() as Record<string, unknown>) : undefined),
      );
    },
    (error) => {
      console.warn("[quiz] state snapshot error:", error);
    },
  );
}

/** Merge a partial patch into quiz/state and stamp updatedAt. Admin only. */
export async function updateQuizState(
  patch: Partial<Omit<QuizState, "updatedAt">>,
): Promise<ServiceResult<void>> {
  try {
    await setDoc(
      doc(getDb(), COLLECTIONS.QUIZ, QUIZ_STATE_DOC),
      { ...patch, updatedAt: Date.now() },
      { merge: true },
    );
    return ok(undefined);
  } catch (error) {
    return err(error);
  }
}

/** Reset to idle. Admin only. */
export async function resetQuiz(): Promise<ServiceResult<void>> {
  try {
    await setDoc(doc(getDb(), COLLECTIONS.QUIZ, QUIZ_STATE_DOC), {
      ...DEFAULT_QUIZ_STATE,
      updatedAt: Date.now(),
    });
    return ok(undefined);
  } catch (error) {
    return err(error);
  }
}

/**
 * Start a fresh run: zero every team's score, then enter the lobby countdown.
 * A new sessionNonce namespaces all responses so a previous run never leaks in.
 */
export async function startQuiz(
  durationMs: number,
  teams: { teamId: string; teamName: string }[],
): Promise<ServiceResult<string>> {
  try {
    const nonce =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `q-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    // Reset cumulative scores for all teams.
    await Promise.all(
      teams.map((t) =>
        setDoc(doc(getDb(), COLLECTIONS.QUIZ_SCORES, t.teamId), {
          teamId: t.teamId,
          teamName: t.teamName,
          totalScore: 0,
          answeredCount: 0,
          perQuestion: {},
          updatedAt: Date.now(),
        }),
      ),
    );

    await setDoc(doc(getDb(), COLLECTIONS.QUIZ, QUIZ_STATE_DOC), {
      phase: "countdown",
      currentQuestionIndex: -1,
      totalQuestions: QUIZ_QUESTIONS.length,
      questionDurationMs: durationMs,
      expectedTeamCount: teams.length,
      countdownStartedAt: Date.now(),
      questionStartedAt: null,
      revealStartedAt: null,
      sessionNonce: nonce,
      lastReveal: null,
      updatedAt: Date.now(),
    });
    return ok(nonce);
  } catch (error) {
    return err(error);
  }
}

// ---------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------

function runQuestionId(nonce: string, index: number): string {
  return `${nonce}__${index}`;
}

/**
 * Submit a team's answer. Create-only — a second submission is rejected by the
 * rules (returned as an error the caller can treat as "already answered").
 * submittedAt uses serverTimestamp() so the response time can't be forged.
 */
export async function submitQuizAnswer(
  nonce: string,
  index: number,
  teamId: string,
  optionIndex: number,
  sessionId: string,
): Promise<ServiceResult<void>> {
  try {
    const ref = doc(
      getDb(),
      COLLECTIONS.QUIZ_RESPONSES,
      runQuestionId(nonce, index),
      "teams",
      teamId,
    );
    await setDoc(ref, {
      teamId,
      optionIndex,
      submittedAt: serverTimestamp(),
      sessionId,
    });
    return ok(undefined);
  } catch (error) {
    return err(error);
  }
}

/** Subscribe to a single team's own response doc for one question (existence + choice). */
export function subscribeOwnResponse(
  nonce: string,
  index: number,
  teamId: string,
  onChange: (optionIndex: number | null) => void,
): () => void {
  const ref = doc(
    getDb(),
    COLLECTIONS.QUIZ_RESPONSES,
    runQuestionId(nonce, index),
    "teams",
    teamId,
  );
  return onSnapshot(
    ref,
    (snap) => {
      const oi = snap.exists() ? (snap.data() as Record<string, unknown>).optionIndex : null;
      onChange(typeof oi === "number" ? oi : null);
    },
    (error) => console.warn("[quiz] own-response snapshot error:", error),
  );
}

/** Subscribe to the live response count for the current question (admin trigger). */
export function subscribeResponseCount(
  nonce: string,
  index: number,
  onChange: (count: number) => void,
): () => void {
  const ref = collection(getDb(), COLLECTIONS.QUIZ_RESPONSES, runQuestionId(nonce, index), "teams");
  return onSnapshot(
    ref,
    (snap) => onChange(snap.size),
    (error) => console.warn("[quiz] response-count snapshot error:", error),
  );
}

/** One-shot read of all responses for scoring — server-resolved timestamps. */
export async function fetchResponsesOnce(
  nonce: string,
  index: number,
): Promise<ServiceResult<QuizResponse[]>> {
  try {
    const ref = collection(getDb(), COLLECTIONS.QUIZ_RESPONSES, runQuestionId(nonce, index), "teams");
    const snap = await getDocs(ref);
    const list = snap.docs.map((d) => {
      const data = d.data() as Record<string, unknown>;
      return {
        teamId: typeof data.teamId === "string" ? data.teamId : d.id,
        optionIndex: typeof data.optionIndex === "number" ? data.optionIndex : -1,
        submittedAt: toMs(data.submittedAt),
        sessionId: typeof data.sessionId === "string" ? data.sessionId : "",
      } satisfies QuizResponse;
    });
    return ok(list);
  } catch (error) {
    return err(error);
  }
}

// ---------------------------------------------------------------------------
// Scores
// ---------------------------------------------------------------------------

function normalizeScore(id: string, data: Record<string, unknown>): QuizScore {
  const pq = data.perQuestion;
  const perQuestion: QuizScore["perQuestion"] = {};
  if (pq && typeof pq === "object" && !Array.isArray(pq)) {
    for (const [k, v] of Object.entries(pq as Record<string, unknown>)) {
      if (v && typeof v === "object") {
        const o = v as Record<string, unknown>;
        perQuestion[Number(k)] = {
          score: typeof o.score === "number" ? o.score : 0,
          correct: o.correct === true,
          responseMs: typeof o.responseMs === "number" ? o.responseMs : 0,
        };
      }
    }
  }
  return {
    teamId: typeof data.teamId === "string" ? data.teamId : id,
    teamName: typeof data.teamName === "string" ? data.teamName : id,
    totalScore: typeof data.totalScore === "number" ? data.totalScore : 0,
    answeredCount: typeof data.answeredCount === "number" ? data.answeredCount : 0,
    perQuestion,
    updatedAt: typeof data.updatedAt === "number" ? data.updatedAt : 0,
  };
}

/** Subscribe to all team scores (live leaderboard). */
export function subscribeScores(onChange: (scores: QuizScore[]) => void): () => void {
  const ref = collection(getDb(), COLLECTIONS.QUIZ_SCORES);
  return onSnapshot(
    ref,
    (snap) => onChange(snap.docs.map((d) => normalizeScore(d.id, d.data() as Record<string, unknown>))),
    (error) => console.warn("[quiz] scores snapshot error:", error),
  );
}

/** One-shot read of all scores (admin scoring). */
export async function fetchScoresOnce(): Promise<ServiceResult<QuizScore[]>> {
  try {
    const snap = await getDocs(collection(getDb(), COLLECTIONS.QUIZ_SCORES));
    return ok(snap.docs.map((d) => normalizeScore(d.id, d.data() as Record<string, unknown>)));
  } catch (error) {
    return err(error);
  }
}

/** Overwrite a team's score doc (admin controller, after scoring a question). */
export async function writeTeamScore(score: QuizScore): Promise<ServiceResult<void>> {
  try {
    await setDoc(doc(getDb(), COLLECTIONS.QUIZ_SCORES, score.teamId), {
      ...score,
      updatedAt: Date.now(),
    });
    return ok(undefined);
  } catch (error) {
    return err(error);
  }
}

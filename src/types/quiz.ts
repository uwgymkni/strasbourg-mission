// Real-time quiz — shared types. The quiz runs on top of the existing
// Strasbourg Mission infrastructure (Firestore client SDK, no Cloud Functions).
// Mission Control is the single authoritative writer of quiz state + scores.

export type QuizPhase =
  | "idle"        // no quiz running
  | "countdown"   // 30 s lobby countdown before question 0
  | "question"    // a question is live; teams may answer
  | "reveal"      // correct answer + explanation + ranking shown
  | "finished";   // final podium

/** The single live-state doc: quiz/state. */
export interface QuizState {
  phase: QuizPhase;
  currentQuestionIndex: number;       // -1 in idle/countdown, 0..n-1 otherwise
  totalQuestions: number;
  questionDurationMs: number;         // 10000 | 15000 | 20000
  expectedTeamCount: number;          // teams expected → drives "all answered"
  countdownStartedAt: number | null;  // ms — drives the 30 s lobby countdown
  questionStartedAt: number | null;   // ms — drives question timer + scoring
  revealStartedAt: number | null;     // ms — drives the 8 s reveal window
  sessionNonce: string;               // unique per quiz run; namespaces responses
  lastReveal: {
    questionIndex: number;
    fastestTeamId: string | null;
    fastestTeamName: string | null;
  } | null;
  updatedAt: number;
}

/** One team's answer to one question: quizResponses/{nonce}__{index}/teams/{teamId}. */
export interface QuizResponse {
  teamId: string;
  optionIndex: number;   // 0..3
  submittedAt: number;   // resolved server time (ms) — authoritative for scoring
  sessionId: string;
}

/** Cumulative per-team score: quizScores/{teamId}. Written only by the admin controller. */
export interface QuizScore {
  teamId: string;
  teamName: string;
  totalScore: number;
  answeredCount: number;
  perQuestion: Record<number, { score: number; correct: boolean; responseMs: number }>;
  updatedAt: number;
}

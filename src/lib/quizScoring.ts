/**
 * Quiz scoring — pure functions, no state, no I/O.
 *
 * Score formula (final, per spec):
 *   score = MAX_POINTS · remainingFraction,  remainingFraction = remainingMs / durationMs
 *   wrong answer → 0
 * Decimals allowed. Max 1500 over 15 questions at MAX_POINTS = 100.
 */

import { QUIZ_MAX_POINTS_PER_QUESTION } from "@/constants/quiz";
import type { QuizScore } from "@/types/quiz";

/**
 * Points for a single answer. `responseMs` is server-measured time since the
 * question started; it is clamped to [0, durationMs] so clock skew or a late
 * write can never produce a negative or above-max score.
 */
export function computeScore(
  responseMs: number,
  durationMs: number,
  correct: boolean,
): number {
  if (!correct) return 0;
  if (durationMs <= 0) return 0;
  const clamped = Math.min(Math.max(responseMs, 0), durationMs);
  const remainingFraction = (durationMs - clamped) / durationMs;
  return QUIZ_MAX_POINTS_PER_QUESTION * remainingFraction;
}

export interface RankedScore extends QuizScore {
  rank: number; // 1-based; ties share a rank
}

/**
 * Sorts teams by total score (desc), assigning 1-based ranks with standard
 * competition ranking (ties share a rank, next rank skips). Stable tiebreak
 * on teamId so order never flickers between renders.
 */
export function rankScores(scores: QuizScore[]): RankedScore[] {
  const sorted = [...scores].sort(
    (a, b) => b.totalScore - a.totalScore || a.teamId.localeCompare(b.teamId),
  );
  let rank = 0;
  let seen = 0;
  let prevScore = Number.POSITIVE_INFINITY;
  return sorted.map((s) => {
    seen++;
    if (s.totalScore < prevScore) {
      rank = seen;
      prevScore = s.totalScore;
    }
    return { ...s, rank };
  });
}

"use client";

import { useQuiz } from "@/hooks/useQuiz";
import { QUIZ_QUESTIONS, QUIZ_COUNTDOWN_MS, effectiveQuestionMs } from "@/constants/quiz";
import { rankScores } from "@/lib/quizScoring";

const OPTION_LETTERS = ["A", "B", "C", "D"];

export function QuizStudent() {
  const { state, scores, now, teamId, myOptionIndex, hasAnswered, submitting, submit } = useQuiz();

  if (!state || state.phase === "idle") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center py-16">
        <p className="text-gold-500 text-xs font-medium tracking-widest uppercase mb-3">Quiz</p>
        <p className="text-stone-400 text-sm">Aktuell läuft kein Quiz. Wartet auf den Start.</p>
      </div>
    );
  }

  // ── Countdown (lobby) ──────────────────────────────────────────────────
  if (state.phase === "countdown") {
    const ms = (state.countdownStartedAt ?? now) + QUIZ_COUNTDOWN_MS - now;
    const sec = Math.max(0, Math.ceil(ms / 1000));
    // Countdown elapsed but the first question hasn't flipped in yet → show a
    // loading state instead of a frozen "0".
    if (sec <= 0) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-16">
          <span className="w-8 h-8 rounded-full border-2 border-gold-500/40 border-t-gold-400 animate-spin mb-5" />
          <p className="text-gold-400 text-sm font-medium">Erste Frage wird geladen …</p>
        </div>
      );
    }
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center py-16">
        <p className="text-gold-500 text-xs font-medium tracking-widest uppercase mb-4">
          Das Quiz beginnt
        </p>
        <div className="text-7xl font-display font-semibold text-gold-400 tabular-nums">{sec}</div>
        <p className="text-stone-400 text-sm mt-4">Macht euch bereit!</p>
      </div>
    );
  }

  const q = QUIZ_QUESTIONS[state.currentQuestionIndex];
  if (!q) return null;

  // ── Question ──────────────────────────────────────────────────────────
  if (state.phase === "question") {
    const startedAt = state.questionStartedAt ?? now;
    const durMs = effectiveQuestionMs(state.currentQuestionIndex, state.questionDurationMs);
    const remaining = Math.max(0, startedAt + durMs - now);
    const frac = Math.max(0, Math.min(1, remaining / durMs));
    const sec = Math.ceil(remaining / 1000);

    return (
      <div className="flex-1 flex flex-col gap-5 py-6">
        <div className="flex items-center justify-between text-xs text-stone-500">
          <span>Frage {state.currentQuestionIndex + 1} / {state.totalQuestions}</span>
          <span className="tabular-nums text-gold-400 font-medium">{sec}s</span>
        </div>

        {/* Timer bar */}
        <div className="h-1.5 w-full bg-navy-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gold-500 transition-[width] duration-1000 ease-linear"
            style={{ width: `${frac * 100}%` }}
          />
        </div>

        <h2 className="text-xl font-semibold text-cream leading-snug">{q.question}</h2>

        <div className="grid grid-cols-1 gap-3">
          {q.options.map((opt, i) => {
            const chosen = myOptionIndex === i;
            return (
              <button
                key={i}
                type="button"
                disabled={hasAnswered || submitting}
                onClick={() => void submit(i)}
                className={[
                  "flex items-center gap-3 w-full px-4 py-4 rounded-xl border text-left transition-colors",
                  chosen
                    ? "border-gold-500 bg-gold-500/15 text-cream"
                    : hasAnswered
                      ? "border-navy-700 bg-navy-800/50 text-stone-500"
                      : "border-navy-600 bg-navy-800 text-cream hover:border-gold-500/60 hover:bg-navy-700/50",
                ].join(" ")}
              >
                <span className="shrink-0 w-7 h-7 rounded-full border border-current flex items-center justify-center text-sm font-semibold">
                  {OPTION_LETTERS[i]}
                </span>
                <span className="text-sm">{opt}</span>
              </button>
            );
          })}
        </div>

        {hasAnswered && (
          <p className="text-center text-sm text-gold-400">
            Antwort abgegeben — warte auf die anderen Teams …
          </p>
        )}
      </div>
    );
  }

  // ── Reveal ──────────────────────────────────────────────────────────────
  if (state.phase === "reveal") {
    const ranked = rankScores(scores);
    const me = ranked.find((s) => s.teamId === teamId);
    const myRound = me?.perQuestion[state.currentQuestionIndex];
    const wasCorrect = myOptionIndex === q.correctIndex;

    return (
      <div className="flex-1 flex flex-col gap-5 py-6">
        <p className="text-gold-500 text-xs font-medium tracking-widest uppercase">Auflösung</p>
        <h2 className="text-lg font-semibold text-cream leading-snug">{q.question}</h2>

        <div className="flex flex-col gap-2">
          {q.options.map((opt, i) => {
            const isCorrect = i === q.correctIndex;
            const isMine = myOptionIndex === i;
            return (
              <div
                key={i}
                className={[
                  "flex items-center gap-3 px-4 py-3 rounded-xl border text-sm",
                  isCorrect
                    ? "border-green-500 bg-green-900/40 text-green-200"
                    : isMine
                      ? "border-red-500 bg-red-900/40 text-red-200"
                      : "border-navy-700 bg-navy-800/40 text-stone-500",
                ].join(" ")}
              >
                <span className="shrink-0 w-6 h-6 rounded-full border border-current flex items-center justify-center text-xs font-semibold">
                  {OPTION_LETTERS[i]}
                </span>
                <span className="flex-1">{opt}</span>
                {isCorrect && <span>✓</span>}
                {isMine && !isCorrect && <span>✗</span>}
              </div>
            );
          })}
        </div>

        <div className="rounded-xl bg-navy-800 border border-navy-700 px-4 py-3">
          <p className="text-xs text-stone-500 uppercase tracking-widest mb-1">Erklärung</p>
          <p className="text-sm text-stone-300 leading-relaxed">{q.explanation}</p>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className={wasCorrect ? "text-green-400" : "text-red-400"}>
            {wasCorrect ? "Richtig!" : myOptionIndex !== null ? "Leider falsch" : "Keine Antwort"}
          </span>
          {myRound && (
            <span className="text-gold-400 tabular-nums font-medium">
              +{Math.round(myRound.score)} Punkte
            </span>
          )}
        </div>

        {state.lastReveal?.fastestTeamName && (
          <p className="text-center text-sm text-stone-400">
            ⚡ Schnellstes Team: <span className="text-gold-400">{state.lastReveal.fastestTeamName}</span>
          </p>
        )}

        <Leaderboard ranked={ranked} teamId={teamId} title="Zwischenstand" />
      </div>
    );
  }

  // ── Finished — podium ────────────────────────────────────────────────────
  const ranked = rankScores(scores);
  const podium = ranked.slice(0, 3);
  const medals = ["🥇", "🥈", "🥉"];
  return (
    <div className="flex-1 flex flex-col gap-6 py-8">
      <div className="text-center">
        <p className="text-gold-500 text-xs font-medium tracking-widest uppercase mb-2">Quiz beendet</p>
        <h1 className="font-display text-3xl font-semibold text-cream">Siegerehrung</h1>
      </div>

      <div className="flex flex-col gap-3">
        {podium.map((s, i) => (
          <div
            key={s.teamId}
            className={[
              "flex items-center gap-4 px-5 py-4 rounded-2xl border",
              s.teamId === teamId ? "border-gold-500/60 bg-gold-500/10" : "border-navy-700 bg-navy-800",
            ].join(" ")}
          >
            <span className="text-3xl">{medals[i]}</span>
            <span className="flex-1 text-lg font-semibold text-cream">{s.teamName}</span>
            <span className="text-gold-400 text-lg tabular-nums font-semibold">
              {Math.round(s.totalScore)}
            </span>
          </div>
        ))}
      </div>

      {ranked.length > 3 && <Leaderboard ranked={ranked} teamId={teamId} title="Gesamtrangliste" />}
    </div>
  );
}

function Leaderboard({
  ranked,
  teamId,
  title,
}: {
  ranked: ReturnType<typeof rankScores>;
  teamId: string | null;
  title: string;
}) {
  return (
    <div className="rounded-xl bg-navy-800 border border-navy-700 overflow-hidden">
      <p className="text-xs text-stone-500 uppercase tracking-widest px-4 pt-3 pb-2">{title}</p>
      <div className="flex flex-col">
        {ranked.map((s) => (
          <div
            key={s.teamId}
            className={[
              "flex items-center justify-between px-4 py-2 text-sm border-t border-navy-700/40",
              s.teamId === teamId ? "bg-gold-500/10" : "",
            ].join(" ")}
          >
            <span className="text-stone-400 tabular-nums w-7">{s.rank}.</span>
            <span className={`flex-1 ${s.teamId === teamId ? "text-gold-300 font-medium" : "text-cream"}`}>
              {s.teamName}
            </span>
            <span className="text-gold-400 tabular-nums font-medium">{Math.round(s.totalScore)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

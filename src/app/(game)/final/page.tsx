"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useGame } from "@/hooks/useGame";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default function FinalPage() {
  const router = useRouter();
  const user = useRequireAuth();
  const MIN_LETTERS_FOR_FINAL = 5; // max 1 skip allowed

  const {
    stations,
    progress,
    completedCount,
    allResolved,
    loading,
    error,
    loadGame,
    initTeamId,
    submitFinal,
    clearError,
  } = useGame();

  const [answer, setAnswer] = useState("");
  const [answerError, setAnswerError] = useState<string | null>(null);

  const sortedLetters = [...stations].sort((a, b) => a.rewardNumber - b.rewardNumber);
  const correctAnswer = sortedLetters.map((s) => s.rewardLetter).join("").toLowerCase();

  // How many stations were actually solved (not skipped)
  const collectedLetterCount = sortedLetters.filter(
    (s) => progress[s.id] === "completed"
  ).length;
  const canSubmitFinal = collectedLetterCount >= MIN_LETTERS_FOR_FINAL;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!user?.teamCode) return;
    if (stations.length === 0) {
      void loadGame(user.teamCode);
    } else {
      initTeamId(user.teamCode);
    }
  }, [user?.teamCode]);

  // Redirect back if not all stations are resolved (completed or skipped)
  useEffect(() => {
    if (!stations.length) return;
    if (!allResolved) {
      router.replace("/dashboard");
    }
  }, [stations.length, allResolved, router]);

  // ── Guards ────────────────────────────────────────────────────────────────

  if (!user) return null;

  // ── Handlers ─────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAnswerError(null);
    clearError();

    if (answer.trim().toLowerCase() !== correctAnswer) {
      setAnswerError("Falsch. Setzt eure gesammelten Buchstaben in der richtigen Reihenfolge zusammen.");
      return;
    }

    const result = await submitFinal(answer.trim().toUpperCase());
    if (!result.success) return; // error shown by hook

    router.push("/success");
  }

  async function handleRetry() {
    clearError();
    const result = await submitFinal(answer.trim().toUpperCase());
    if (result.success) {
      router.push("/success");
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <PageHeader
        title="Der finale Code"
        subtitle="Stellt die Wahrheit zusammen"
        onBack={() => router.push("/dashboard")}
      />

      <div className="flex-1 flex flex-col gap-6 pb-10">

        {/* Collected letters with position index */}
        <Card padding="md">
          <p className="text-xs font-medium text-stone-500 uppercase tracking-widest mb-4">
            Eure gesammelten Buchstaben
          </p>

          {sortedLetters.length === 0 ? (
            <p className="text-stone-600 text-sm">
              {loading ? "Wird geladen …" : "Keine Buchstaben gefunden. Schließt zuerst die Stationen ab."}
            </p>
          ) : (
            <>
              <div className="flex gap-3 justify-center flex-wrap">
                {sortedLetters.map((s) => {
                  const isSkipped = progress[s.id] === "skipped";
                  return (
                    <div key={s.id} className="flex flex-col items-center gap-1">
                      <div className={`w-11 h-11 rounded-lg flex items-center justify-center border ${
                        isSkipped
                          ? "border-amber-700/40 bg-amber-950/30"
                          : "border-gold-500/40 bg-gold-500/5"
                      }`}>
                        <span className={`font-display text-2xl font-semibold ${
                          isSkipped ? "text-amber-700" : "text-gold-400"
                        }`}>
                          {isSkipped ? "?" : s.rewardLetter}
                        </span>
                      </div>
                      <span className="text-xs text-stone-600 tabular-nums">
                        {s.rewardNumber}
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="text-stone-500 text-xs mt-4 text-center leading-relaxed">
                Setzt diese Buchstaben in der richtigen Reihenfolge zusammen.
              </p>
            </>
          )}
        </Card>

        {/* Firebase error with retry */}
        {error && (
          <div className="rounded-lg bg-red-400/15 px-4 py-3">
            <p className="text-sm text-red-400 leading-relaxed">{error}</p>
            <button
              type="button"
              disabled={loading}
              onClick={handleRetry}
              className="mt-1 text-sm font-medium text-gold-500 hover:text-gold-400 disabled:opacity-50 focus-visible:outline-none"
            >
              {loading ? "Wiederholen …" : "Erneut versuchen →"}
            </button>
          </div>
        )}

        {/* Minimum letters guard */}
        {!canSubmitFinal && sortedLetters.length > 0 && (
          <div className="rounded-lg bg-amber-950/40 border border-amber-700/40 px-4 py-3">
            <p className="text-sm text-amber-400 leading-relaxed">
              Ihr habt zu wenige Buchstaben gesammelt ({collectedLetterCount} von {MIN_LETTERS_FOR_FINAL} benötigt).
              Das Lösungswort kann nicht eingegeben werden.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Lösungswort"
            value={answer}
            onChange={(e) => {
              setAnswerError(null);
              clearError();
              setAnswer(e.target.value);
            }}
            placeholder="Das zusammengesetzte Wort"
            autoCorrect="off"
            autoCapitalize="characters"
            spellCheck={false}
            error={answerError ?? undefined}
            disabled={loading || !canSubmitFinal}
          />

          <Button
            type="submit"
            variant="primary"
            loading={loading}
            disabled={!answer.trim() || loading || !canSubmitFinal}
            className="w-full"
          >
            Wahrheit enthüllen
          </Button>
        </form>

      </div>
    </>
  );
}

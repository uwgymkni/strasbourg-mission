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
  const {
    stations,
    completedCount,
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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!user?.teamCode) return;
    if (stations.length === 0) {
      void loadGame(user.teamCode);
    } else {
      initTeamId(user.teamCode);
    }
  }, [user?.teamCode]);

  // Redirect back if not all stations are complete (fires after stations load)
  useEffect(() => {
    if (!stations.length) return;
    if (completedCount < stations.length) {
      router.replace("/dashboard");
    }
  }, [stations.length, completedCount, router]);

  // ── Guards ────────────────────────────────────────────────────────────────

  if (!user) return null;

  // ── Handlers ─────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAnswerError(null);
    clearError();

    if (answer.trim().toLowerCase() !== correctAnswer) {
      setAnswerError("Incorrect. Use your collected letters to find the word.");
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
        title="The Final Cipher"
        subtitle="Assemble the truth"
        onBack={() => router.push("/dashboard")}
      />

      <div className="flex-1 flex flex-col gap-6 pb-10">

        {/* Collected letters with position index */}
        <Card padding="md">
          <p className="text-xs font-medium text-stone-500 uppercase tracking-widest mb-4">
            Your collected letters
          </p>

          {sortedLetters.length === 0 ? (
            <p className="text-stone-600 text-sm">
              {loading ? "Loading…" : "No letters found. Complete the stations first."}
            </p>
          ) : (
            <>
              <div className="flex gap-3 justify-center flex-wrap">
                {sortedLetters.map((s) => (
                  <div key={s.id} className="flex flex-col items-center gap-1">
                    <div className="w-11 h-11 rounded-lg border border-gold-500/40 bg-gold-500/5 flex items-center justify-center">
                      <span className="font-display text-2xl font-semibold text-gold-400">
                        {s.rewardLetter}
                      </span>
                    </div>
                    <span className="text-xs text-stone-600 tabular-nums">
                      {s.rewardNumber}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-stone-500 text-xs mt-4 text-center leading-relaxed">
                Arrange these letters in order to form the final word.
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
              {loading ? "Retrying…" : "Try again →"}
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Final answer"
            value={answer}
            onChange={(e) => {
              setAnswerError(null);
              clearError();
              setAnswer(e.target.value);
            }}
            placeholder="The assembled word"
            autoCorrect="off"
            autoCapitalize="characters"
            spellCheck={false}
            error={answerError ?? undefined}
            disabled={loading}
          />

          <Button
            type="submit"
            variant="primary"
            loading={loading}
            disabled={!answer.trim() || loading}
            className="w-full"
          >
            Reveal the Truth
          </Button>
        </form>

      </div>
    </>
  );
}

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useGame } from "@/hooks/useGame";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

export default function SuccessPage() {
  const router = useRouter();
  const user = useRequireAuth();
  const { stations, completedCount, loadGame } = useGame();

  const total = stations.length > 0 ? stations.length : 6;
  const sortedLetters = [...stations].sort((a, b) => a.rewardNumber - b.rewardNumber);
  const finalWord = sortedLetters.map((s) => s.rewardLetter).join("");

  // Reload station data on hard refresh (stations are not persisted in the store)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!user?.teamCode || stations.length > 0) return;
    void loadGame(user.teamCode);
  }, [user?.teamCode]);

  if (!user) return null;

  return (
    <div className="flex-1 flex flex-col items-center justify-center py-12 px-2">

      {/* Emblem */}
      <div className="flex items-center justify-center w-24 h-24 rounded-full border border-gold-500/40">
        <div className="flex items-center justify-center w-14 h-14 rounded-full border border-gold-500 bg-gold-500/10">
          <div className="w-3 h-3 rounded-full bg-gold-500" />
        </div>
      </div>

      {/* Message */}
      <div className="text-center mt-8">
        <p className="text-gold-500 text-xs font-medium tracking-widest uppercase mb-3">
          Mission Complete
        </p>
        <h1 className="font-display text-4xl font-semibold text-cream leading-tight">
          Truth Uncovered
        </h1>
        <p className="text-stone-400 text-sm mt-4 leading-relaxed max-w-xs">
          Your team has navigated the streets of Strasbourg and revealed the
          secret hidden in plain sight.
        </p>
      </div>

      {/* Result card */}
      <Card padding="md" className="w-full mt-10">
        <p className="text-xs font-medium text-stone-500 uppercase tracking-widest mb-4">
          Your result
        </p>

        {/* Final word letter tiles */}
        {finalWord && (
          <div className="flex justify-center gap-1.5 mb-5">
            {sortedLetters.map((s) => (
              <div
                key={s.id}
                className="w-10 h-10 rounded-lg border border-gold-500/40 bg-gold-500/5 flex items-center justify-center"
              >
                <span className="font-display text-xl font-semibold text-gold-400">
                  {s.rewardLetter}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-stone-400 text-sm">Team</span>
            <span className="text-cream text-sm font-medium">{user.teamName}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-stone-400 text-sm">Stations</span>
            <Badge variant="completed">{completedCount} / {total}</Badge>
          </div>
        </div>
      </Card>

      <Button
        variant="ghost"
        className="mt-8"
        onClick={() => router.push("/")}
      >
        Return to base
      </Button>

    </div>
  );
}

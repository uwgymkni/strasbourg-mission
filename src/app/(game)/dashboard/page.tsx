"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useGame } from "@/hooks/useGame";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { StationStatus } from "@/types/game";

export default function DashboardPage() {
  const router = useRouter();
  const user = useRequireAuth();
  const {
    stations,
    progress,
    completedCount,
    loading,
    error,
    loadGame,
    clearError,
  } = useGame();

  const total = stations.length > 0 ? stations.length : 6;
  const allComplete = stations.length > 0 && completedCount === stations.length;
  const sortedStations = [...stations].sort((a, b) => a.order - b.order);
  const collectedLetters = sortedStations
    .filter((s) => progress[s.id] === "completed")
    .sort((a, b) => a.rewardNumber - b.rewardNumber);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!user?.teamCode) return;
    void loadGame(user.teamCode);
  }, [user?.teamCode]);

  if (!user) return null;

  function handleRetry() {
    clearError();
    void loadGame(user!.teamCode);
  }

  return (
    <>
      <PageHeader
        title={user.teamName}
        subtitle={
          loading && stations.length === 0
            ? "Loading mission data…"
            : `${completedCount} of ${total} stations complete`
        }
      />

      <div className="flex-1 flex flex-col gap-5 pb-10">

        {/* Progress bar */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-1 bg-navy-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gold-500 rounded-full transition-all duration-500"
              style={{ width: `${(completedCount / total) * 100}%` }}
            />
          </div>
          <span className="text-xs text-stone-400 tabular-nums shrink-0">
            {completedCount} / {total}
          </span>
        </div>

        {/* Error with retry */}
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

        {/* Station list */}
        <div className="flex flex-col gap-2">
          {sortedStations.map((station) => {
            const status = (progress[station.id] ?? "locked") as StationStatus;
            const isActive = status === "active";

            return (
              <Card
                key={station.id}
                padding="sm"
                interactive={isActive}
                onClick={
                  isActive
                    ? () => router.push(`/mission/${station.id}`)
                    : undefined
                }
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`shrink-0 w-7 h-7 rounded-full border flex items-center justify-center text-xs tabular-nums ${
                      isActive
                        ? "border-gold-500/60 text-gold-400 bg-gold-500/10"
                        : "border-navy-600 text-stone-400"
                    }`}>
                      {station.order}
                    </span>
                    <span
                      className={`text-sm font-medium truncate ${
                        status === "locked" ? "text-stone-600" : "text-cream"
                      }`}
                    >
                      {station.title}
                    </span>
                  </div>
                  <Badge variant={status} className="shrink-0 capitalize">
                    {status}
                  </Badge>
                </div>
              </Card>
            );
          })}

          {/* Loading placeholders while stations fetch */}
          {loading && stations.length === 0 &&
            Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} padding="sm">
                <div
                  className="h-5 bg-navy-700 rounded-md animate-pulse"
                  style={{ width: `${55 + (i % 3) * 15}%` }}
                />
              </Card>
            ))
          }

          {/* Empty state after load */}
          {!loading && stations.length === 0 && (
            <Card padding="md">
              <p className="text-stone-500 text-sm leading-relaxed">
                No stations loaded. Check your connection or contact your coordinator.
              </p>
            </Card>
          )}
        </div>

        {/* Collected code letters */}
        <Card padding="sm">
          <p className="text-xs font-medium text-stone-500 uppercase tracking-widest mb-3">
            Collected code fragments
          </p>
          {collectedLetters.length === 0 ? (
            <p className="text-stone-600 text-sm">
              Complete a station to collect your first letter.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2 items-center">
              {collectedLetters.map((s) => (
                <Badge key={s.id} variant="completed">
                  {s.rewardLetter}
                </Badge>
              ))}
              {collectedLetters.length < total && (
                <span className="text-stone-600 text-sm">
                  + {total - collectedLetters.length} more to discover
                </span>
              )}
            </div>
          )}
        </Card>

        {/* Final cipher — only when all stations complete */}
        {allComplete && (
          <Button
            variant="primary"
            className="w-full"
            onClick={() => router.push("/final")}
          >
            Proceed to Final Cipher
          </Button>
        )}

      </div>
    </>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useGame } from "@/hooks/useGame";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import type { StationStatus } from "@/types/game";

function isAnswerCorrect(input: string, accepted: string[]): boolean {
  const n = input.trim().toLowerCase();
  return accepted.some((a) => a.trim().toLowerCase() === n);
}

const STATUS_LABEL: Record<StationStatus, string> = {
  active: "Aktiv",
  completed: "Abgeschlossen",
  locked: "Gesperrt",
};

export default function MissionPage() {
  const params = useParams();
  const router = useRouter();
  const stationId = params.stationId as string;

  const user = useRequireAuth();
  const {
    stations,
    progress,
    currentStationId,
    loading,
    error,
    loadGame,
    initTeamId,
    completeCurrentStation,
    clearError,
  } = useGame();

  const [answer, setAnswer] = useState("");
  const [answerError, setAnswerError] = useState<string | null>(null);
  // "challenge" → form visible; "reward" → letter revealed after correct submission
  const [phase, setPhase] = useState<"challenge" | "reward">("challenge");

  const station = stations.find((s) => s.id === stationId);
  const stationStatus = (progress[stationId] ?? "locked") as StationStatus;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!user?.teamCode) return;
    if (stations.length === 0) {
      void loadGame(user.teamCode);
    } else {
      initTeamId(user.teamCode);
    }
  }, [user?.teamCode]);

  // ── All hooks above — guards and conditionals below ───────────────────────

  if (!user) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAnswerError(null);
    clearError();

    if (!station) return;

    // 1. Validate locally — no Firebase call if wrong
    if (!isAnswerCorrect(answer, station.acceptedAnswers)) {
      setAnswerError("Falsche Antwort. Schaut noch einmal genau vor Ort nach.");
      return;
    }

    // 2. Guard: only the current active station can be completed
    if (stationId !== currentStationId) {
      setAnswerError("Diese Station kann gerade nicht abgeschlossen werden.");
      return;
    }

    // 3. Persist to Firebase, then update store
    const result = await completeCurrentStation();
    if (!result.success) return; // error shown by hook

    setPhase("reward");
  }

  async function handleRetry() {
    clearError();
    const result = await completeCurrentStation();
    if (result.success) setPhase("reward");
  }

  // ── Loading / not-found ───────────────────────────────────────────────────

  if (!station) {
    return (
      <>
        <PageHeader
          title="Station"
          subtitle="Mission: Strasbourg"
          onBack={() => router.push("/dashboard")}
        />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-stone-500 text-sm">
            {loading ? "Wird geladen …" : "Station nicht gefunden."}
          </p>
        </div>
      </>
    );
  }

  // ── Reward reveal ─────────────────────────────────────────────────────────

  if (phase === "reward") {
    return (
      <>
        <PageHeader
          title={station.title}
          subtitle="Buchstabenfragment gesammelt"
          onBack={() => router.push("/dashboard")}
        />
        <div className="flex-1 flex flex-col items-center justify-center gap-8 pb-10">
          <div className="text-center">
            <p className="text-gold-500 text-xs font-medium tracking-widest uppercase mb-6">
              Buchstabenfragment gesammelt
            </p>
            <div className="flex items-center justify-center w-32 h-32 rounded-full border border-gold-500/40 mx-auto">
              <div className="flex items-center justify-center w-20 h-20 rounded-full border border-gold-500/60 bg-gold-500/5">
                <span className="font-display text-6xl font-semibold text-gold-400">
                  {station.rewardLetter}
                </span>
              </div>
            </div>
            <p className="text-stone-400 text-sm mt-6">
              Station {station.order} von {stations.length} abgeschlossen
            </p>
          </div>

          <Button
            variant="primary"
            className="w-full"
            onClick={() => router.push("/dashboard")}
          >
            Zurück zur Übersicht
          </Button>
        </div>
      </>
    );
  }

  // ── Locked station ────────────────────────────────────────────────────────

  if (stationStatus === "locked") {
    return (
      <>
        <PageHeader
          title={station.title}
          subtitle="Mission: Strasbourg"
          onBack={() => router.push("/dashboard")}
          action={<Badge variant="locked">Gesperrt</Badge>}
        />
        <div className="flex-1 flex flex-col gap-5 pb-10">
          <Card padding="md">
            <p className="text-xs font-medium text-stone-500 uppercase tracking-widest mb-2">
              Euer Standort
            </p>
            <p className="text-stone-500 leading-relaxed">{station.locationHint}</p>
          </Card>
          <Card padding="md">
            <p className="text-stone-500 text-sm leading-relaxed">
              Schließt die vorherige Station ab, um diese Aufgabe freizuschalten.
            </p>
          </Card>
        </div>
      </>
    );
  }

  // ── Completed station ─────────────────────────────────────────────────────

  if (stationStatus === "completed") {
    return (
      <>
        <PageHeader
          title={station.title}
          subtitle="Mission: Strasbourg"
          onBack={() => router.push("/dashboard")}
          action={<Badge variant="completed">Abgeschlossen</Badge>}
        />
        <div className="flex-1 flex flex-col gap-5 pb-10">
          <Card padding="md">
            <p className="text-xs font-medium text-stone-500 uppercase tracking-widest mb-2">
              Euer Standort
            </p>
            <p className="text-cream leading-relaxed">{station.locationHint}</p>
          </Card>
          <Card padding="md">
            <p className="text-xs font-medium text-stone-500 uppercase tracking-widest mb-2">
              Historischer Hintergrund
            </p>
            <p className="text-stone-400 text-sm leading-relaxed">{station.knowledgeText}</p>
          </Card>
          <Card padding="md">
            <p className="text-xs font-medium text-stone-500 uppercase tracking-widest mb-3">
              Euer gesammelter Buchstabe
            </p>
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-full border border-gold-500/60 bg-gold-500/5">
                <span className="font-display text-3xl font-semibold text-gold-400">
                  {station.rewardLetter}
                </span>
              </div>
              <p className="text-stone-400 text-sm">Fragment #{station.rewardNumber}</p>
            </div>
          </Card>
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => router.push("/dashboard")}
          >
            Zurück zur Übersicht
          </Button>
        </div>
      </>
    );
  }

  // ── Active station ────────────────────────────────────────────────────────

  return (
    <>
      <PageHeader
        title={station.title}
        subtitle="Genau beobachten"
        onBack={() => router.push("/dashboard")}
        action={
          <Badge variant={stationStatus}>
            {STATUS_LABEL[stationStatus]}
          </Badge>
        }
      />

      <div className="flex-1 flex flex-col gap-5 pb-10">

        <Card padding="md">
          <p className="text-xs font-medium text-stone-500 uppercase tracking-widest mb-2">
            Euer Standort
          </p>
          <p className="text-cream leading-relaxed">{station.locationHint}</p>
        </Card>

        <Card padding="md">
          <p className="text-xs font-medium text-stone-500 uppercase tracking-widest mb-2">
            Fotoaufgabe
          </p>
          <p className="text-stone-400 text-sm leading-relaxed">{station.photoChallenge}</p>
        </Card>

        <Card padding="md">
          <p className="text-xs font-medium text-stone-500 uppercase tracking-widest mb-2">
            Historischer Hintergrund
          </p>
          <p className="text-stone-400 text-sm leading-relaxed">{station.knowledgeText}</p>
        </Card>

        {/* Firebase error with retry — preserves the typed answer */}
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

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label={station.observationQuestion}
            value={answer}
            onChange={(e) => {
              setAnswerError(null);
              clearError();
              setAnswer(e.target.value);
            }}
            placeholder="Eure Antwort"
            autoCorrect="off"
            autoCapitalize="off"
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
            Antwort absenden
          </Button>
        </form>

      </div>
    </>
  );
}

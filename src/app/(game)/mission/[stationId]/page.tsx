"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useGame } from "@/hooks/useGame";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import type { StationStatus } from "@/types/game";
import { haversineMeters, walkingMinutes, formatDistance } from "@/lib/geo";
import { resizeImage } from "@/lib/image";
import { fetchTeamProgress, uploadStationPhoto } from "@/services/game.service";

// Wrong answers before the skip button becomes available
const SKIP_THRESHOLD = 2;

// Photo upload limits — keep generous for the raw file (camera apps vary widely);
// resize step caps the actual upload at ~200–500 KB regardless.
const MAX_RAW_FILE_BYTES = 15 * 1024 * 1024;
const RESIZE_MAX_EDGE = 1600;
const RESIZE_QUALITY = 0.85;

function isAnswerCorrect(input: string, accepted: string[]): boolean {
  const n = input.trim().toLowerCase();
  return accepted.some((a) => a.trim().toLowerCase() === n);
}

const STATUS_LABEL: Record<StationStatus, string> = {
  active:    "Aktiv",
  completed: "Abgeschlossen",
  locked:    "Gesperrt",
  skipped:   "Übersprungen",
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
    skipCurrentStation,
    incrementWrongAnswer,
    clearError,
    wrongAnswers,
  } = useGame();

  const [answer, setAnswer] = useState("");
  const [answerError, setAnswerError] = useState<string | null>(null);
  // "challenge" → form visible; "reward" → letter revealed; "skipped" → skip outcome screen
  const [phase, setPhase] = useState<"challenge" | "reward" | "skipped">("challenge");
  // Two-step skip confirmation — prevents accidental skips
  const [skipConfirming, setSkipConfirming] = useState(false);

  // ── Photo upload — optional, never blocks the answer flow ────────────────
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const station = stations.find((s) => s.id === stationId);
  const stationStatus = (progress[stationId] ?? "locked") as StationStatus;
  const wrongCount = wrongAnswers[stationId] ?? 0;
  const showSkipSection = wrongCount >= SKIP_THRESHOLD;

  // The station that follows this one — shown as a hint after completion/skip
  const nextStation = station
    ? stations.find((s) => s.order === station.order + 1)
    : undefined;

  // Walking distance hint between current and next station — only when both
  // have coordinates. Pure math, no API. Computed once per render.
  const nextLegMeters =
    station?.latitude != null &&
    station?.longitude != null &&
    nextStation?.latitude != null &&
    nextStation?.longitude != null
      ? haversineMeters(
          { latitude: station.latitude, longitude: station.longitude },
          { latitude: nextStation.latitude, longitude: nextStation.longitude }
        )
      : null;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!user?.teamCode) return;
    if (stations.length === 0) {
      void loadGame(user.teamCode);
    } else {
      initTeamId(user.teamCode);
    }
  }, [user?.teamCode]);

  // Load any previously-uploaded photo URL for this station — one extra
  // Firestore read per page mount. Independent of the game-load flow so a
  // photo network error never affects the answer form.
  useEffect(() => {
    if (!user?.teamCode || !stationId) return;
    let cancelled = false;
    void (async () => {
      const result = await fetchTeamProgress(user.teamCode);
      if (cancelled) return;
      if (result.success && result.data?.photos?.[stationId]) {
        setPhotoUrl(result.data.photos[stationId]);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.teamCode, stationId]);

  // ── All hooks above — guards and conditionals below ───────────────────────

  if (!user) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAnswerError(null);
    clearError();

    if (!station) return;

    // 1. Validate locally — no Firebase call if wrong
    if (!isAnswerCorrect(answer, station.acceptedAnswers)) {
      // Pass the raw input so it's also persisted alongside the count
      incrementWrongAnswer(stationId, answer.trim());
      const newCount = wrongCount + 1; // compute locally — store update is async

      if (newCount < SKIP_THRESHOLD) {
        // First wrong attempt: simple error, no skip option yet
        setAnswerError("Nicht korrekt. Schaut euch den Ort noch einmal genau an.");
      } else {
        // At or beyond threshold: skip section provides the messaging
        setAnswerError(null);
      }
      return;
    }

    // 2. Guard: only the current active station can be completed
    if (stationId !== currentStationId) {
      setAnswerError("Diese Station kann gerade nicht abgeschlossen werden.");
      return;
    }

    // 3. Persist to Firebase, then update store — pass the correct input so
    //    Mission Control can show what the team actually typed.
    const result = await completeCurrentStation(answer.trim());
    if (!result.success) return; // error shown by hook

    setPhase("reward");
  }

  async function handleRetry() {
    clearError();
    const result = await completeCurrentStation();
    if (result.success) setPhase("reward");
  }

  async function handleSkip() {
    clearError();
    setAnswerError(null);
    const result = await skipCurrentStation();
    if (!result.success) return; // Firebase error shown by hook
    setPhase("skipped");
  }

  /**
   * Photo upload — completely independent of the answer flow.
   * Failure never blocks gameplay; the student can keep playing without a photo.
   */
  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset the input value so picking the same file again still triggers onChange
    if (e.target) e.target.value = "";
    if (!file || !user?.teamCode) return;

    setPhotoError(null);

    if (!file.type.startsWith("image/")) {
      setPhotoError("Bitte ein Bild auswählen.");
      return;
    }
    if (file.size > MAX_RAW_FILE_BYTES) {
      setPhotoError("Datei zu groß. Bitte ein anderes Foto wählen.");
      return;
    }

    setPhotoUploading(true);
    try {
      const blob = await resizeImage(file, RESIZE_MAX_EDGE, RESIZE_QUALITY);
      const result = await uploadStationPhoto(user.teamCode, stationId, blob);
      if (result.success) {
        setPhotoUrl(result.data);
      } else {
        setPhotoError(result.error);
      }
    } catch (err) {
      setPhotoError(
        err instanceof Error ? err.message : "Foto-Upload fehlgeschlagen."
      );
    } finally {
      setPhotoUploading(false);
    }
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
        <div className="flex-1 flex flex-col gap-6 pb-10">

          {/* Letter reveal */}
          <div className="text-center mt-4">
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

          {/* Next station hint — atmospheric pointer for the next location */}
          {nextStation && (
            <Card padding="md">
              <p className="text-xs font-medium text-stone-500 uppercase tracking-widest mb-2">
                Eure nächste Station
              </p>
              <p className="text-sm font-semibold text-cream mb-2">{nextStation.title}</p>
              <p className="text-stone-400 text-sm leading-relaxed">
                {nextStation.locationHint}
              </p>
              {nextLegMeters !== null && (
                <p className="text-xs text-stone-500 mt-2">
                  📐 ca. {formatDistance(nextLegMeters)} · ~{walkingMinutes(nextLegMeters)} min Fußweg
                </p>
              )}
              {nextStation.mapsUrl && (
                <a
                  href={nextStation.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 mt-3 text-xs font-medium text-gold-500 hover:text-gold-400 transition-colors duration-150"
                >
                  📍 Navigation öffnen
                </a>
              )}
            </Card>
          )}

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

  // ── Skipped outcome ───────────────────────────────────────────────────────

  if (phase === "skipped") {
    return (
      <>
        <PageHeader
          title={station.title}
          subtitle="Station übersprungen"
          onBack={() => router.push("/dashboard")}
        />
        <div className="flex-1 flex flex-col gap-6 pb-10">

          <Card padding="md" className="border-amber-700/40">
            <p className="text-amber-400 text-xs font-medium tracking-widest uppercase mb-3">
              Station übersprungen
            </p>
            <p className="text-stone-400 text-sm leading-relaxed">
              Ihr habt keinen Buchstaben für diese Station erhalten. Das Lösungswort
              wird schwieriger zu knacken sein.
            </p>
          </Card>

          {/* Next station hint — shown even after a skip */}
          {nextStation && (
            <Card padding="md">
              <p className="text-xs font-medium text-stone-500 uppercase tracking-widest mb-2">
                Eure nächste Station
              </p>
              <p className="text-sm font-semibold text-cream mb-2">{nextStation.title}</p>
              <p className="text-stone-400 text-sm leading-relaxed">
                {nextStation.locationHint}
              </p>
              {nextLegMeters !== null && (
                <p className="text-xs text-stone-500 mt-2">
                  📐 ca. {formatDistance(nextLegMeters)} · ~{walkingMinutes(nextLegMeters)} min Fußweg
                </p>
              )}
              {nextStation.mapsUrl && (
                <a
                  href={nextStation.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 mt-3 text-xs font-medium text-gold-500 hover:text-gold-400 transition-colors duration-150"
                >
                  📍 Navigation öffnen
                </a>
              )}
            </Card>
          )}

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

  // ── Completed station (visited after solving) ─────────────────────────────

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

  // ── Skipped station (visited after skipping) ──────────────────────────────

  if (stationStatus === "skipped") {
    return (
      <>
        <PageHeader
          title={station.title}
          subtitle="Mission: Strasbourg"
          onBack={() => router.push("/dashboard")}
          action={<Badge variant="skipped">Übersprungen</Badge>}
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
              Diese Station wurde übersprungen. Es wurde kein Buchstabenfragment vergeben.
            </p>
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
          {station.mapsUrl && (
            <a
              href={station.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="
                mt-4 flex items-center justify-center gap-2
                w-full px-4 py-2.5 rounded-xl
                text-sm font-medium text-gold-400
                bg-gold-500/10 border border-gold-500/40
                hover:bg-gold-500/15 active:bg-gold-500/20
                transition-colors duration-150
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500
              "
            >
              <span aria-hidden="true">📍</span>
              Navigation öffnen
            </a>
          )}
        </Card>

        <Card padding="md">
          <p className="text-xs font-medium text-stone-500 uppercase tracking-widest mb-2">
            Fotoaufgabe
          </p>
          <p className="text-stone-400 text-sm leading-relaxed">{station.photoChallenge}</p>

          {/* Hidden file input — triggered by the visible label/button below.
              accept + capture cues mobile OS to surface the camera as default. */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhotoChange}
            disabled={photoUploading}
            className="hidden"
            aria-hidden="true"
          />

          {/* Thumbnail of the already-uploaded photo (if any) */}
          {photoUrl && (
            <div className="mt-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoUrl}
                alt="Euer Foto zu dieser Station"
                className="w-full max-h-56 object-cover rounded-xl border border-navy-700"
              />
            </div>
          )}

          {/* Upload trigger — full-width mobile button.
              Label is acting as a button per HTML semantics so the hidden
              input receives the tap correctly on iOS. */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={photoUploading}
            className="
              mt-4 flex items-center justify-center gap-2
              w-full px-4 py-2.5 rounded-xl
              text-sm font-medium text-gold-400
              bg-gold-500/10 border border-gold-500/40
              hover:bg-gold-500/15 active:bg-gold-500/20
              disabled:opacity-60 disabled:cursor-not-allowed
              transition-colors duration-150
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500
            "
          >
            {photoUploading ? (
              <>
                <span className="w-4 h-4 rounded-full border-2 border-gold-500/40 border-t-gold-400 animate-spin" />
                Foto wird hochgeladen …
              </>
            ) : (
              <>
                <span aria-hidden="true">📷</span>
                {photoUrl ? "Foto ersetzen" : "Foto aufnehmen oder wählen"}
              </>
            )}
          </button>

          {/* Inline error — never blocks the answer form */}
          {photoError && (
            <p role="alert" className="mt-2 text-xs text-red-400">
              {photoError} Spielfluss läuft trotzdem weiter.
            </p>
          )}

          {/* Privacy hint */}
          <p className="mt-3 text-xs text-stone-600 leading-relaxed">
            Foto ist optional. Eure Lehrkraft sieht das Foto in Mission Control.
          </p>
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

        {/* Skip section — appears after SKIP_THRESHOLD wrong attempts */}
        {showSkipSection && (
          <Card padding="md" className="border-amber-700/30">
            {!skipConfirming ? (
              /* Step 1: offer the choice */
              <div className="flex flex-col gap-3">
                <p className="text-amber-400 text-sm leading-relaxed">
                  Noch nicht richtig. Ihr könnt weiterprobieren oder die Station
                  überspringen (-3 Punkte).
                </p>
                <div className="flex flex-col gap-2">
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={() => setSkipConfirming(true)}
                  >
                    Station überspringen (-3 Punkte)
                  </Button>
                  <button
                    type="button"
                    className="text-sm text-stone-500 hover:text-stone-400 transition-colors duration-150 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 rounded"
                  >
                    Weiter versuchen
                  </button>
                </div>
              </div>
            ) : (
              /* Step 2: confirm the skip */
              <div className="flex flex-col gap-3">
                <p className="text-amber-400 text-sm font-medium">
                  Wirklich überspringen?
                </p>
                <p className="text-stone-400 text-sm leading-relaxed">
                  Ihr erhaltet keinen Buchstaben für diese Station.
                </p>
                <div className="flex flex-col gap-2">
                  <Button
                    variant="danger"
                    loading={loading}
                    className="w-full"
                    onClick={handleSkip}
                  >
                    Ja, Station überspringen
                  </Button>
                  <Button
                    variant="secondary"
                    className="w-full"
                    disabled={loading}
                    onClick={() => setSkipConfirming(false)}
                  >
                    Nein, weiterversuchen
                  </Button>
                </div>
              </div>
            )}
          </Card>
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

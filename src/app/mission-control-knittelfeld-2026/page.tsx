"use client";

import { Fragment, useState, useEffect, useCallback, useRef } from "react";
import {
  fetchStations,
  fetchAllProgress,
  resetTeamProgress,
  fetchTeamArchive,
  type ArchiveSnapshot,
} from "@/services/game.service";
import { fetchAllTeams } from "@/services/auth.service";
import { MissionMap } from "@/components/MissionMap";
import { MissionCountdownAdmin } from "@/components/MissionCountdownAdmin";
import type { Station, StationStatus, TeamProgress } from "@/types/game";
import type { AppUser } from "@/types/user";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Progress + teams are re-fetched every N ms. Stations are static — fetched once. */
const PROGRESS_POLL_MS = 30_000;

// ---------------------------------------------------------------------------
// View model
// ---------------------------------------------------------------------------

/**
 * Lazy-loaded archive cache state for a single team.
 *   - "loading" → fetch in flight, no data yet
 *   - "loaded"  → fetch succeeded; snapshots may be empty []
 *   - "error"   → fetch failed; user can retry via the "erneut versuchen" link
 *
 * Keyed by teamId in the parent component. Never auto-populated — only set
 * when the teacher explicitly clicks "Archiv anzeigen".
 */
type ArchiveState =
  | { status: "loading"; snapshots: ArchiveSnapshot[] }
  | { status: "loaded";  snapshots: ArchiveSnapshot[] }
  | { status: "error";   snapshots: ArchiveSnapshot[]; error: string };

interface TeamSummary {
  teamId: string;
  teamName: string;
  completedCount: number;
  skippedCount: number;
  totalStations: number;
  currentStationId: string | null;  // needed by MissionMap to look up coordinates
  currentStationTitle: string | null;
  finalSolved: boolean;
  finalAnswer: string | null;
  finishedAt: number | undefined;
  startedAt: number; // 0 = never started
  members: string[];
  totalWrongAnswers: number;
  photos: Record<string, string>; // stationId → Storage download URL (empty = no photos)
  answers: Record<string, string>;          // stationId → correct answer the student typed
  lastWrongAnswer: Record<string, string>;  // stationId → most recent wrong submission
  // Per-station details — surfaced to the expand-row only.
  progress: Record<string, StationStatus>;
  wrongAnswers: Record<string, number>;
}

function buildSummaries(
  teams: AppUser[],
  progressMap: Map<string, TeamProgress>,
  stations: Station[]
): TeamSummary[] {
  const stationMap = new Map(stations.map((s) => [s.id, s]));
  const total = stations.length;

  // Exclude any residual admin-role docs (e.g. PROF-0) that may still exist
  // in Firestore from the old architecture. All new teams are role==="student".
  return teams
    .filter((t) => t.role === "student")
    .map((team) => {
      const prog = progressMap.get(team.teamCode);
      const statuses = prog ? Object.values(prog.progress) : [];

      const completedCount    = statuses.filter((v) => v === "completed").length;
      const skippedCount      = statuses.filter((v) => v === "skipped").length;
      const currentStation    = prog?.currentStationId
        ? (stationMap.get(prog.currentStationId) ?? null)
        : null;
      const totalWrongAnswers = prog?.wrongAnswers
        ? Object.values(prog.wrongAnswers).reduce((sum, n) => sum + n, 0)
        : 0;

      return {
        teamId:              team.teamCode,
        teamName:            team.teamName,
        completedCount,
        skippedCount,
        totalStations:       total,
        currentStationId:    prog?.currentStationId ?? null,
        currentStationTitle: currentStation?.title ?? null,
        finalSolved:
          typeof prog?.finalAnswer === "string" && prog.finalAnswer.length > 0,
        finalAnswer:         prog?.finalAnswer ?? null,
        finishedAt:          prog?.finishedAt,
        startedAt:           prog?.startedAt ?? 0,
        members:             prog?.members ?? [],
        totalWrongAnswers,
        photos:              prog?.photos ?? {},
        answers:             prog?.answers ?? {},
        lastWrongAnswer:     prog?.lastWrongAnswer ?? {},
        progress:            prog?.progress ?? {},
        wrongAnswers:        prog?.wrongAnswers ?? {},
      };
    })
    .sort((a, b) => {
      // 1. Finished teams first
      if (a.finalSolved !== b.finalSolved) return a.finalSolved ? -1 : 1;
      // 2. Resolved (completed + skipped) descending
      const aR = a.completedCount + a.skippedCount;
      const bR = b.completedCount + b.skippedCount;
      if (bR !== aR) return bR - aR;
      // 3. Alphabetical by team code
      return a.teamId.localeCompare(b.teamId);
    });
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

function formatTime(ms: number | undefined): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Human-readable relative time for the Zeit column.
 * Called on every render — Date.now() is always fresh because the
 * component re-renders every second via the tick interval.
 */
function relativeTime(s: TeamSummary): string {
  if (s.finalSolved && s.finishedAt && s.startedAt > 0) {
    const durMin = Math.round((s.finishedAt - s.startedAt) / 60_000);
    return `Dauer: ${durMin} min`;
  }
  if (s.startedAt > 0) {
    const agoMin = Math.floor((Date.now() - s.startedAt) / 60_000);
    if (agoMin < 1) return "gerade gestartet";
    return `vor ${agoMin} min`;
  }
  return "—";
}

// ---------------------------------------------------------------------------
// CSV export helper
// ---------------------------------------------------------------------------

/**
 * Escapes a single CSV cell value per RFC 4180:
 * wraps in double-quotes whenever the value contains a comma, double-quote,
 * carriage return, or newline; internal double-quotes are doubled.
 * Null/undefined become empty string.
 */
function escapeCsv(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (
    str.includes('"') ||
    str.includes(",") ||
    str.includes("\n") ||
    str.includes("\r")
  ) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Two-segment bar: gold = completed, stone = skipped. */
function ProgressBar({
  completed,
  skipped,
  total,
}: {
  completed: number;
  skipped: number;
  total: number;
}) {
  if (total === 0) return null;
  const pctDone    = (completed / total) * 100;
  const pctSkipped = (skipped  / total) * 100;
  return (
    <div className="mt-1.5 h-1 w-20 bg-navy-700 rounded-full overflow-hidden flex">
      <div
        className="h-full bg-gold-500"
        style={{ width: `${pctDone}%` }}
      />
      <div
        className="h-full bg-stone-600"
        style={{ width: `${pctSkipped}%` }}
      />
    </div>
  );
}

/**
 * Status badge + optional final-answer display.
 * Fertig teams also show their submitted answer (font-mono, dimmed).
 */
function StatusCell({ s }: { s: TeamSummary }) {
  if (s.finalSolved) {
    return (
      <div>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gold-500/15 text-gold-400 border border-gold-500/30">
          Fertig
        </span>
        {s.finalAnswer && (
          <p className="text-xs text-stone-500 font-mono mt-1 tracking-wider">
            „{s.finalAnswer}"
          </p>
        )}
      </div>
    );
  }
  if (s.startedAt > 0) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
        Aktiv
      </span>
    );
  }
  return <span className="text-xs text-stone-600">Nicht gestartet</span>;
}

/**
 * Renders thumbnail row of all photos a team has uploaded, sorted by station
 * order. Each thumb is a plain <a target="_blank"> — no modal, no lightbox.
 * Empty state shows "—" so the column never collapses visually.
 */
function PhotoList({
  photos,
  stations,
}: {
  photos: Record<string, string>;
  stations: Station[];
}) {
  const items = stations
    .filter((st) => photos[st.id])
    .map((st) => ({ id: st.id, title: st.title, url: photos[st.id]! }));

  if (items.length === 0) {
    return <span className="text-stone-700">—</span>;
  }

  return (
    <div className="flex gap-1.5 flex-wrap max-w-[180px]">
      {items.map((p) => (
        <a
          key={p.id}
          href={p.url}
          target="_blank"
          rel="noopener noreferrer"
          title={p.title}
          className="block"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={p.url}
            alt={`Foto: ${p.title}`}
            loading="lazy"
            className="w-10 h-10 rounded object-cover border border-navy-700 hover:border-gold-500/60 transition-colors"
          />
        </a>
      ))}
    </div>
  );
}

// Visual mapping for the per-station status badge inside TeamDetailRow.
const DETAIL_STATUS: Record<StationStatus, { label: string; cls: string }> = {
  active:    { label: "Aktiv",        cls: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
  completed: { label: "Abgeschlossen", cls: "bg-gold-500/15 text-gold-300 border-gold-500/30" },
  locked:    { label: "Gesperrt",     cls: "bg-navy-700/50 text-stone-500 border-navy-600" },
  skipped:   { label: "Übersprungen", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
};

/**
 * Expanded detail row content for a single team — rendered only when the team
 * is the one currently expanded. Lays out one card per station with the
 * student's answer, last wrong attempt, error count, and (larger) photo.
 *
 * Pure presentation — no fetches, no state, no side effects.
 */
function TeamDetailRow({
  team,
  stations,
}: {
  team: TeamSummary;
  stations: Station[];
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {stations.map((st) => {
        const status: StationStatus = team.progress[st.id] ?? "locked";
        const meta = DETAIL_STATUS[status];
        const correct = team.answers[st.id];
        const wrong = team.lastWrongAnswer[st.id];
        const errors = team.wrongAnswers[st.id] ?? 0;
        const photoUrl = team.photos[st.id];

        return (
          <div
            key={st.id}
            className="bg-navy-900/60 border border-navy-700/60 rounded-lg p-3 flex flex-col gap-2"
          >
            {/* Header: order + title + status */}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs text-stone-500 tabular-nums">
                  Station {st.order}
                </p>
                <p className="text-sm font-medium text-cream truncate">
                  {st.title}
                </p>
              </div>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border whitespace-nowrap ${meta.cls}`}
              >
                {meta.label}
              </span>
            </div>

            {/* Answers + errors */}
            <div className="text-xs space-y-1">
              {correct ? (
                <p>
                  <span className="text-stone-500">Antwort: </span>
                  <span className="text-cream font-mono">{correct}</span>
                </p>
              ) : null}
              {wrong && !correct ? (
                <p>
                  <span className="text-stone-500">letzte falsch: </span>
                  <span className="text-red-400 font-mono">{wrong}</span>
                </p>
              ) : null}
              {errors > 0 ? (
                <p className="text-stone-500">
                  {errors} Fehlversuch{errors === 1 ? "" : "e"}
                </p>
              ) : null}
              {!correct && !wrong && errors === 0 ? (
                <p className="text-stone-600 italic">— keine Eingaben</p>
              ) : null}
            </div>

            {/* Larger photo if uploaded */}
            {photoUrl ? (
              <a
                href={photoUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="block mt-1"
                title="Foto in neuem Tab öffnen"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photoUrl}
                  alt={`Foto: ${st.title}`}
                  loading="lazy"
                  className="w-full h-32 object-cover rounded border border-navy-700 hover:border-gold-500/60 transition-colors"
                />
              </a>
            ) : (
              <p className="text-xs text-stone-600 italic mt-1">
                — kein Foto hochgeladen
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * One row in the archive list — a single pre-reset snapshot rendered as a
 * compact summary card. Re-derives counts/status from the archived progress
 * map so the SnapshotCard is fully self-contained (no parent helpers).
 */
function SnapshotCard({
  snap,
  stations,
}: {
  snap: ArchiveSnapshot;
  stations: Station[];
}) {
  const total = stations.length;
  const completed = Object.values(snap.progress).filter((v) => v === "completed").length;
  const skipped   = Object.values(snap.progress).filter((v) => v === "skipped").length;
  const wrongs = Object.values(snap.wrongAnswers ?? {}).reduce(
    (sum, n) => sum + (typeof n === "number" ? n : 0),
    0
  );
  const isFinished =
    typeof snap.finalAnswer === "string" && snap.finalAnswer.length > 0;
  const wasStarted = snap.startedAt > 0;
  const members = snap.members ?? [];

  const when = new Date(snap.archivedAt).toLocaleString("de-DE", {
    day:    "2-digit",
    month:  "2-digit",
    year:   "numeric",
    hour:   "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="bg-navy-900/40 border border-navy-700/40 rounded-lg px-3 py-2.5">
      <div className="flex items-baseline justify-between gap-3 mb-1.5">
        <p className="text-xs text-stone-400 tabular-nums">{when}</p>
        {isFinished ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-gold-500/15 text-gold-300 border border-gold-500/30">
            Fertig
          </span>
        ) : wasStarted ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/15 text-blue-300 border border-blue-500/30">
            War aktiv
          </span>
        ) : (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-navy-700/50 text-stone-500 border border-navy-600">
            Nicht gestartet
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
        <span>
          <span className="text-stone-500">Fortschritt: </span>
          <span className="text-cream tabular-nums">{completed} / {total}</span>
          {skipped > 0 && (
            <span className="text-stone-500"> ({skipped} übersprungen)</span>
          )}
        </span>
        <span>
          <span className="text-stone-500">Fehler: </span>
          <span className={wrongs > 0 ? "text-red-400" : "text-stone-300"}>
            {wrongs}
          </span>
        </span>
        {isFinished && snap.finalAnswer && (
          <span>
            <span className="text-stone-500">Lösung: </span>
            <span className="text-gold-400 font-mono">„{snap.finalAnswer}"</span>
          </span>
        )}
      </div>

      {members.length > 0 && (
        <p className="text-xs text-stone-500 mt-1.5 truncate">
          <span className="text-stone-600">Mitglieder: </span>
          <span className="text-stone-400">{members.join(", ")}</span>
        </p>
      )}
    </div>
  );
}

/**
 * Collapsible archive section rendered beneath TeamDetailRow inside the
 * expanded `<tr>`. Renders a toggle button and, when open, the cached state
 * for this team (loading / loaded / error / empty).
 *
 * The component is purely presentational — fetching, caching, and visibility
 * are owned by the parent page so multiple sections share the same cache.
 */
function ArchiveSection({
  stations,
  state,
  open,
  onToggle,
  onReload,
}: {
  stations: Station[];
  state: ArchiveState | undefined;
  open: boolean;
  onToggle: () => void;
  onReload: () => void;
}) {
  return (
    <div className="mt-5 pt-4 border-t border-navy-700/40">
      <button
        type="button"
        onClick={onToggle}
        className="text-xs font-medium text-stone-500 hover:text-stone-300 transition-colors"
      >
        {open ? "Archiv verbergen ▲" : "Archiv anzeigen ▼"}
      </button>

      {open && (
        <div className="mt-3 flex flex-col gap-2">
          {!state || state.status === "loading" ? (
            <p className="text-xs text-stone-500 italic">Archiv wird geladen …</p>
          ) : state.status === "error" ? (
            <p className="text-xs text-red-400">
              {state.error}{" "}
              <button
                type="button"
                onClick={onReload}
                className="underline hover:text-red-300"
              >
                erneut versuchen
              </button>
            </p>
          ) : state.snapshots.length === 0 ? (
            <p className="text-xs text-stone-500 italic">
              Kein Archiv vorhanden — bisher kein Reset durchgeführt.
            </p>
          ) : (
            state.snapshots.map((snap) => (
              <SnapshotCard key={snap.id} snap={snap} stations={stations} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Compact per-station answer list. Shows the correct answer (cream font-mono)
 * when present; otherwise falls back to the latest wrong attempt (red, with
 * "falsch:" prefix). Stations with neither entry are skipped.
 * Sorted by station.order so output is stable across renders.
 */
function AnswerList({
  answers,
  lastWrongAnswer,
  stations,
}: {
  answers: Record<string, string>;
  lastWrongAnswer: Record<string, string>;
  stations: Station[];
}) {
  const items = stations
    .filter((st) => answers[st.id] || lastWrongAnswer[st.id])
    .map((st) => ({
      id: st.id,
      shortLabel: `S${st.order}`,
      correct: answers[st.id],
      wrong: lastWrongAnswer[st.id],
    }));

  if (items.length === 0) {
    return <span className="text-stone-700">—</span>;
  }

  return (
    <div className="flex flex-col gap-0.5 text-xs max-w-[200px]">
      {items.map((it) => (
        <div key={it.id} className="whitespace-nowrap">
          <span className="text-stone-500">{it.shortLabel}:</span>{" "}
          {it.correct ? (
            <span className="text-cream font-mono">{it.correct}</span>
          ) : (
            <span>
              <span className="text-stone-500">falsch:</span>{" "}
              <span className="text-red-400 font-mono">{it.wrong}</span>
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page — no auth guard needed; access is controlled by the secret URL only
// ---------------------------------------------------------------------------

export default function MissionControlPage() {
  // Stations are loaded once — never polled. Stored in a ref so loadProgress
  // (called from a setInterval) always reads the latest value without a stale
  // closure and without needing stations in its useCallback dependency array.
  const stationsRef = useRef<Station[]>([]);

  const [summaries,     setSummaries]     = useState<TeamSummary[]>([]);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  // Increments every second. The value itself is intentionally discarded ([, setTick]);
  // the only purpose is to trigger a re-render so relative-time strings stay fresh.
  const [, setTick] = useState(0);

  // teamId whose reset button is in "Sicher?" confirm state; null = none open.
  const [confirmResetId,  setConfirmResetId]  = useState<string | null>(null);
  // teamIds whose Firestore reset is currently in-flight (disable the button).
  const [resettingIds,    setResettingIds]    = useState<Set<string>>(new Set());

  // Global reset state — two-step confirm + in-flight loading for "reset all".
  const [confirmResetAll, setConfirmResetAll] = useState(false);
  const [resettingAll,    setResettingAll]    = useState(false);

  // teamId of the currently expanded detail row — null means no row is open.
  // Independent of summaries state, so auto-refresh never closes the row.
  const [expandedTeamId,  setExpandedTeamId]  = useState<string | null>(null);

  // Lazy-loaded archive state, keyed by teamId. Never populated automatically:
  // a team's archive is fetched only when the teacher clicks "Archiv anzeigen"
  // inside that team's expanded detail row. Cache survives close/re-open so
  // toggling visibility never re-fetches.
  const [archives,        setArchives]        = useState<
    Record<string, ArchiveState>
  >({});
  const [archiveOpenFor,  setArchiveOpenFor]  = useState<Set<string>>(new Set());

  // ------------------------------------------------------------------
  // Data loading
  // ------------------------------------------------------------------

  /**
   * Fetches teams + progress, rebuilds summaries from stationsRef.
   * `silent=true` skips the loading-spinner so auto-refresh doesn't flicker.
   */
  const loadProgress = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);

    const [teamsResult, progressResult] = await Promise.all([
      fetchAllTeams(),
      fetchAllProgress(),
    ]);

    if (!silent) setLoading(false);

    if (!teamsResult.success)    { setError(teamsResult.error);    return; }
    if (!progressResult.success) { setError(progressResult.error); return; }

    const progressMap = new Map(
      progressResult.data.map((p) => [p.teamId, p])
    );
    setSummaries(
      buildSummaries(teamsResult.data, progressMap, stationsRef.current)
    );
    setLastRefreshed(new Date());
  }, []); // stable ref — no deps needed

  /**
   * On mount: fetch stations once, then immediately load progress.
   * Stations are static config — no need to ever re-fetch them.
   */
  useEffect(() => {
    void (async () => {
      const result = await fetchStations();
      if (!result.success) {
        setError(result.error);
        return;
      }
      stationsRef.current = result.data;
      void loadProgress();
    })();
  }, [loadProgress]);

  /** Auto-refresh: reload teams + progress every 30 s, silently. */
  useEffect(() => {
    const id = setInterval(() => void loadProgress(true), PROGRESS_POLL_MS);
    return () => clearInterval(id);
  }, [loadProgress]);

  /** 1-second tick — forces re-render so relative-time strings stay live. */
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1_000);
    return () => clearInterval(id);
  }, []);

  // ------------------------------------------------------------------
  // Reset actions
  // ------------------------------------------------------------------

  async function handleReset(teamId: string): Promise<void> {
    setResettingIds((prev) => new Set(prev).add(teamId));

    const result = await resetTeamProgress(teamId);

    setResettingIds((prev) => {
      const next = new Set(prev);
      next.delete(teamId);
      return next;
    });
    setConfirmResetId(null);

    if (result.success) {
      void loadProgress(true);
    } else {
      setError(result.error);
    }
  }

  /**
   * Lazy fetch of a team's archive snapshots. Skips the fetch when the cache
   * already has fresh data; re-fetches when the previous attempt errored.
   * Set state never resets to "loading" if data was previously loaded — so a
   * second click ("Archiv anzeigen" → "verbergen" → "anzeigen") never flashes
   * a loading spinner.
   */
  async function loadArchive(teamId: string): Promise<void> {
    const current = archives[teamId];
    if (current && current.status === "loading") return;
    if (current && current.status === "loaded")  return;

    setArchives((prev) => ({
      ...prev,
      [teamId]: { status: "loading", snapshots: prev[teamId]?.snapshots ?? [] },
    }));

    const result = await fetchTeamArchive(teamId);

    setArchives((prev) => ({
      ...prev,
      [teamId]: result.success
        ? { status: "loaded", snapshots: result.data }
        : { status: "error", snapshots: [], error: result.error },
    }));
  }

  /**
   * Toggle the archive section's visibility for a team. Opening lazily kicks
   * off a load if no cache exists. Closing never clears the cache, so the
   * next open is instant.
   */
  function toggleArchive(teamId: string): void {
    setArchiveOpenFor((prev) => {
      const next = new Set(prev);
      if (next.has(teamId)) {
        next.delete(teamId);
      } else {
        next.add(teamId);
        void loadArchive(teamId); // safe to fire-and-forget — handler is idempotent
      }
      return next;
    });
  }

  /**
   * Resets every student team in parallel.
   * Safe by construction: summaries only ever contains role === "student" teams.
   */
  async function handleResetAll(): Promise<void> {
    setResettingAll(true);
    setConfirmResetAll(false);
    setError(null);

    const results = await Promise.all(
      summaries.map((s) => resetTeamProgress(s.teamId))
    );

    setResettingAll(false);

    const failCount = results.filter((r) => !r.success).length;
    if (failCount > 0) {
      setError(`${failCount} Team(s) konnten nicht zurückgesetzt werden.`);
    }

    void loadProgress(true);
  }

  // ------------------------------------------------------------------
  // CSV export
  // ------------------------------------------------------------------

  /**
   * Builds and immediately downloads a UTF-8 BOM CSV of the current summaries.
   * Uses the Blob + URL.createObjectURL pattern — no server round-trip, 0 new
   * Firestore reads. UTF-8 BOM (﻿) ensures Excel opens German umlauts
   * without a manual import wizard.
   *
   * Per-station columns (answer + error-count) are appended at the end so
   * the fixed columns are always in the same position regardless of station
   * count changes.
   */
  function handleExportCSV(): void {
    const stations = stationsRef.current;
    const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    // Station-specific headers: one pair per station, sorted by station.order
    // (stationsRef is already order-sorted — verified in fetchStations).
    const stationHeaders = stations.flatMap((st) => [
      `Station ${st.order} Antwort`,
      `Station ${st.order} Fehler`,
    ]);

    const headers = [
      "Team",
      "Name",
      "Mitglieder",
      "Status",
      "Abgeschlossen",
      "Übersprungen",
      "Fehler gesamt",
      "Zeit (min)",
      "Endantwort",
      "Fotos",
      ...stationHeaders,
    ];

    const rows = summaries.map((s) => {
      const status = s.finalSolved
        ? "Fertig"
        : s.startedAt > 0
          ? "Aktiv"
          : "Nicht gestartet";

      const timeMin =
        s.finalSolved && s.finishedAt && s.startedAt > 0
          ? String(Math.round((s.finishedAt - s.startedAt) / 60_000))
          : "";

      const stationCells = stations.flatMap((st) => [
        s.answers[st.id] ?? "",
        String(s.wrongAnswers[st.id] ?? 0),
      ]);

      return [
        s.teamId,
        s.teamName,
        s.members.join("; "), // semicolon-separated so it stays in one cell
        status,
        String(s.completedCount),
        String(s.skippedCount),
        String(s.totalWrongAnswers),
        timeMin,
        s.finalAnswer ?? "",
        String(Object.keys(s.photos).length),
        ...stationCells,
      ];
    });

    const csvContent =
      "﻿" + // UTF-8 BOM — Excel needs this to decode German umlauts correctly
      [headers, ...rows]
        .map((row) => row.map(escapeCsv).join(","))
        .join("\r\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `strasbourg-mission-${date}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ------------------------------------------------------------------
  // Markdown content dump
  // ------------------------------------------------------------------

  /**
   * Generates a human-readable Markdown file containing ALL station content —
   * questions, accepted answers, hints, knowledge texts, photo challenges, and
   * reward letters — intended for didactic review and content iteration.
   *
   * Reads exclusively from stationsRef.current (already populated at mount,
   * same Firestore data the students see). Zero new Firestore reads.
   * Same Blob + URL.createObjectURL pattern as handleExportCSV.
   */
  function handleExportMarkdown(): void {
    const stations = stationsRef.current;
    if (stations.length === 0) return; // guard: stations not yet loaded

    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const timestamp = now.toLocaleString("de-DE", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });

    const lines: string[] = [
      "# Strasbourg Mission — Content Dump",
      "",
      `> Exportiert am ${timestamp}`,
      "",
      "---",
      "",
    ];

    // ── Lösungswort-Übersicht ───────────────────────────────────────
    const sorted = [...stations].sort((a, b) => a.rewardNumber - b.rewardNumber);
    const finalWord = sorted.map((st) => st.rewardLetter).join("");

    lines.push("## Lösungswort-Übersicht");
    lines.push("");
    lines.push(`**Lösungswort (Buchstaben nach rewardNumber sortiert):** \`${finalWord}\``);
    lines.push("");
    lines.push("| Station | Titel | Buchstabe | Position im Lösungswort |");
    lines.push("|---------|-------|-----------|------------------------|");
    for (const st of sorted) {
      lines.push(`| ${st.order} | ${st.title} | \`${st.rewardLetter}\` | ${st.rewardNumber} |`);
    }
    lines.push("");
    lines.push("---");
    lines.push("");

    // ── Pro-Station-Blöcke ─────────────────────────────────────────
    for (const st of stations) {
      lines.push(`## Station ${st.order} — ${st.title}`);
      lines.push("");

      // Meta
      lines.push(`**Challenge-Typ:** \`${st.challengeType}\``);
      if (st.latitude !== undefined && st.longitude !== undefined) {
        lines.push(`**Koordinaten:** ${st.latitude}, ${st.longitude}`);
      }
      if (st.mapsUrl) {
        lines.push(`**Maps-Link:** ${st.mapsUrl}`);
      }
      lines.push("");

      // Standort-Hinweis
      lines.push("### Standort-Hinweis");
      lines.push("");
      lines.push(st.locationHint);
      lines.push("");

      // Frage
      lines.push("### Frage / Aufgabenstellung");
      lines.push("");
      lines.push(st.observationQuestion);
      lines.push("");

      // Akzeptierte Antworten
      lines.push("### Akzeptierte Antworten");
      lines.push("");
      for (const ans of st.acceptedAnswers) {
        lines.push(`- \`${ans}\``);
      }
      lines.push("");

      // Wissenstext
      lines.push("### Wissenstext");
      lines.push("");
      lines.push(st.knowledgeText);
      lines.push("");

      // Fotoaufgabe
      lines.push("### Fotoaufgabe");
      lines.push("");
      lines.push(st.photoChallenge);
      lines.push("");

      // Reward
      lines.push("### Reward");
      lines.push("");
      lines.push(
        `**Buchstabe:** \`${st.rewardLetter}\` — Position **${st.rewardNumber}** im Lösungswort`,
      );
      lines.push("");

      lines.push("---");
      lines.push("");
    }

    const content = lines.join("\n");
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `strasbourg-mission-content-${date}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ------------------------------------------------------------------
  // Compact review export (Frage + Wissenstext + Antworten only)
  // ------------------------------------------------------------------

  /**
   * Generates a focused Markdown file for didactic review — contains ONLY
   * the pedagogically relevant content per station: question, knowledge text,
   * and the full list of accepted answers (including all spelling variants).
   *
   * Intentionally omits: coordinates, mapsUrl, locationHint, photoChallenge,
   * rewardLetter/Number, and all team/status data.
   *
   * Optimised for paste into Claude/Opus or a human reviewer — no noise.
   * Same stationsRef.current source and Blob pattern as the full export.
   */
  function handleExportReview(): void {
    const stations = stationsRef.current;
    if (stations.length === 0) return;

    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const timestamp = now.toLocaleString("de-DE", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });

    const lines: string[] = [
      "# Strasbourg Mission — Review Export",
      "",
      `> Exportiert am ${timestamp}`,
      `> Enthält: Frage, Wissenstext, Akzeptierte Antworten (alle Varianten)`,
      `> Nicht enthalten: Koordinaten, Reward, Foto-Aufgaben, Teamdaten`,
      "",
    ];

    for (const st of stations) {
      lines.push("---");
      lines.push("");
      lines.push(`# Station ${st.order} — ${st.title}`);
      lines.push("");

      lines.push("## Frage");
      lines.push("");
      lines.push(st.observationQuestion);
      lines.push("");

      lines.push("## Wissenstext");
      lines.push("");
      lines.push(st.knowledgeText);
      lines.push("");

      lines.push("## Akzeptierte Antworten");
      lines.push("");
      for (const ans of st.acceptedAnswers) {
        lines.push(`- \`${ans}\``);
      }
      lines.push("");
    }

    const content = lines.join("\n");
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `strasbourg-mission-review-${date}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ------------------------------------------------------------------
  // Derived counts (for stats bar)
  // ------------------------------------------------------------------

  const finishedCount   = summaries.filter((s) => s.finalSolved).length;
  const activeCount     = summaries.filter((s) => !s.finalSolved && s.startedAt > 0).length;
  const notStartedCount = summaries.filter((s) => s.startedAt === 0).length;

  const secondsAgo = lastRefreshed
    ? Math.max(0, Math.floor((Date.now() - lastRefreshed.getTime()) / 1_000))
    : null;

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  return (
    <div className="min-h-dvh bg-navy-950 text-cream p-6">
      <div className="max-w-6xl mx-auto">

        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <p className="text-gold-600 text-xs font-medium tracking-widest uppercase mb-2">
              Mission Control
            </p>
            <h1 className="text-2xl font-semibold text-cream">Strasbourg Mission</h1>
            <p className="text-stone-500 text-xs mt-1 h-4">
              {secondsAgo === null
                ? ""
                : secondsAgo === 0
                  ? "Gerade aktualisiert"
                  : `Letzte Aktualisierung vor ${secondsAgo} Sek.`}
            </p>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <button
              type="button"
              onClick={() => { setConfirmResetAll(true); setConfirmResetId(null); }}
              disabled={loading || resettingAll || summaries.length === 0}
              className="px-4 py-2 text-sm font-medium text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/10 disabled:opacity-50 transition-colors"
            >
              Alle zurücksetzen
            </button>
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={summaries.length === 0}
              title="Alle Teamdaten als CSV herunterladen (für Excel)"
              className="px-4 py-2 text-sm font-medium text-stone-400 border border-navy-600 rounded-lg hover:bg-navy-700/50 hover:text-stone-200 disabled:opacity-50 transition-colors"
            >
              CSV
            </button>
            <button
              type="button"
              onClick={handleExportMarkdown}
              disabled={summaries.length === 0}
              title="Alle Stationsinhalte als Markdown herunterladen (zur didaktischen Überprüfung)"
              className="px-4 py-2 text-sm font-medium text-stone-400 border border-navy-600 rounded-lg hover:bg-navy-700/50 hover:text-stone-200 disabled:opacity-50 transition-colors"
            >
              Inhalt
            </button>
            <button
              type="button"
              onClick={handleExportReview}
              disabled={summaries.length === 0}
              title="Kompakter Review-Export: Fragen, Wissenstexte und Antworten (für didaktische Analyse)"
              className="px-4 py-2 text-sm font-medium text-stone-400 border border-navy-600 rounded-lg hover:bg-navy-700/50 hover:text-stone-200 disabled:opacity-50 transition-colors"
            >
              Review
            </button>
            <button
              type="button"
              onClick={() => void loadProgress()}
              disabled={loading || resettingAll}
              className="px-4 py-2 text-sm font-medium text-gold-500 border border-gold-500/30 rounded-lg hover:bg-gold-500/10 disabled:opacity-50 transition-colors"
            >
              {loading ? "Laden…" : "Aktualisieren"}
            </button>
          </div>
        </div>

        {/* ── Error ──────────────────────────────────────────────── */}
        {error && (
          <div className="rounded-lg bg-red-400/10 px-4 py-3 mb-6">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* ── Global reset confirm ────────────────────────────────── */}
        {confirmResetAll && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-5 py-4 mb-6">
            <p className="text-sm font-semibold text-red-400 mb-1">
              Wirklich alle {summaries.length} Schülerteams zurücksetzen?
            </p>
            <p className="text-xs text-stone-500 mb-4 leading-relaxed">
              Alle Fortschritte, Antworten und Ergebnisse werden unwiderruflich gelöscht.
              Jedes Team startet danach neu bei Station 1.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void handleResetAll()}
                disabled={resettingAll}
                className="px-3 py-1.5 text-sm font-medium rounded-lg bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30 disabled:opacity-50 transition-colors"
              >
                {resettingAll ? "Wird zurückgesetzt…" : `Ja, alle ${summaries.length} Teams zurücksetzen`}
              </button>
              <button
                type="button"
                onClick={() => setConfirmResetAll(false)}
                disabled={resettingAll}
                className="px-3 py-1.5 text-sm text-stone-400 hover:text-stone-200 disabled:opacity-50 transition-colors"
              >
                Abbrechen
              </button>
            </div>
          </div>
        )}

        {/* ── Countdown + announcement (admin) ───────────────────── */}
        <MissionCountdownAdmin />

        {/* ── Stats bar ──────────────────────────────────────────── */}
        {summaries.length > 0 && (
          <div className="grid grid-cols-4 gap-3 mb-6">
            {[
              { label: "Teams",           value: summaries.length },
              { label: "Fertig",          value: finishedCount },
              { label: "Aktiv",           value: activeCount },
              { label: "Nicht gestartet", value: notStartedCount },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="bg-navy-800 border border-navy-700 rounded-xl px-4 py-3"
              >
                <p className="text-stone-500 text-xs uppercase tracking-widest mb-1">
                  {label}
                </p>
                <p className="text-2xl font-semibold text-cream">{value}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── Operations Map ─────────────────────────────────────── */}
        {summaries.length > 0 && (
          <div className="mb-6">
            <MissionMap
              summaries={summaries}
              stations={stationsRef.current}
            />
          </div>
        )}

        {/* ── Table ──────────────────────────────────────────────── */}
        <div className="bg-navy-800 border border-navy-700 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-navy-700">
                <th className="text-left px-5 py-4 text-stone-400 font-medium">Team</th>
                <th className="text-left px-5 py-4 text-stone-400 font-medium">Fortschritt</th>
                <th className="text-left px-5 py-4 text-stone-400 font-medium hidden md:table-cell">Aktuelle Station</th>
                <th className="text-left px-5 py-4 text-stone-400 font-medium hidden md:table-cell">Fehler</th>
                <th className="text-left px-5 py-4 text-stone-400 font-medium">Status</th>
                <th className="text-left px-5 py-4 text-stone-400 font-medium hidden md:table-cell">Zeit</th>
                <th className="text-left px-5 py-4 text-stone-400 font-medium hidden md:table-cell">Fotos</th>
                <th className="text-left px-5 py-4 text-stone-400 font-medium hidden md:table-cell">Antworten</th>
                <th className="w-px px-4 py-4" />{/* Reset — no header text */}
              </tr>
            </thead>
            <tbody>

              {/* Skeleton rows on initial load.
                  Column order: Team, Fortschritt, Aktuelle Station, Fehler,
                  Status, Zeit, Fotos, Antworten, Reset. Indices 2,3,5,6,7 are md-only. */}
              {loading && summaries.length === 0 && (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-navy-700/50">
                    {[28, 20, 32, 10, 14, 14, 18, 22, 6].map((w, j) => (
                      <td
                        key={j}
                        className={`px-5 py-4${[2, 3, 5, 6, 7].includes(j) ? " hidden md:table-cell" : ""}`}
                      >
                        <div
                          className="h-4 bg-navy-700 rounded animate-pulse"
                          style={{ width: `${w * 4}px` }}
                        />
                      </td>
                    ))}
                  </tr>
                ))
              )}

              {/* Empty state */}
              {!loading && summaries.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-5 py-8 text-center text-stone-500 italic">
                    Keine Teams gefunden. Zuerst das Seed-Skript ausführen.
                  </td>
                </tr>
              )}

              {/* Data rows */}
              {summaries.map((s) => {
                const isActive     = !s.finalSolved && s.startedAt > 0;
                const isResetting  = resettingIds.has(s.teamId) || resettingAll;
                const isConfirming = confirmResetId === s.teamId && !resettingAll;
                const isExpanded   = expandedTeamId === s.teamId;

                return (
                  <Fragment key={s.teamId}>
                  <tr
                    data-team-code={s.teamId}
                    onClick={() =>
                      setExpandedTeamId((prev) => (prev === s.teamId ? null : s.teamId))
                    }
                    aria-expanded={isExpanded}
                    className={[
                      "border-b border-navy-700/50 transition-colors cursor-pointer hover:bg-navy-700/30",
                      isExpanded
                        ? "bg-navy-700/40"
                        : isActive
                          ? "bg-blue-500/[0.04]"
                          : "",
                    ].join(" ")}
                  >

                    {/* Team ---------------------------------------- */}
                    <td className="px-5 py-4">
                      <p className="font-medium text-cream">{s.teamId}</p>
                      <p className="text-xs text-stone-500">{s.teamName}</p>
                      {s.members.length > 0 && (
                        <p
                          className="text-xs text-stone-600 mt-0.5 max-w-[200px] truncate"
                          title={s.members.join(", ")}
                        >
                          {s.members.join(", ")}
                        </p>
                      )}
                    </td>

                    {/* Fortschritt ---------------------------------- */}
                    <td className="px-5 py-4 tabular-nums">
                      <div className="flex items-baseline gap-1">
                        <span className={
                          s.completedCount === s.totalStations && s.totalStations > 0
                            ? "text-gold-400 font-medium"
                            : "text-stone-300"
                        }>
                          {s.completedCount}
                        </span>
                        <span className="text-stone-600">/ {s.totalStations}</span>
                      </div>
                      <ProgressBar
                        completed={s.completedCount}
                        skipped={s.skippedCount}
                        total={s.totalStations}
                      />
                      {s.skippedCount > 0 && (
                        <p className="text-xs text-stone-600 mt-0.5">
                          {s.skippedCount} übersprungen
                        </p>
                      )}
                    </td>

                    {/* Aktuelle Station ----------------------------- */}
                    <td className={[
                      "px-5 py-4 hidden md:table-cell",
                      isActive ? "text-cream font-medium" : "text-stone-400",
                    ].join(" ")}>
                      {s.finalSolved ? "—" : (s.currentStationTitle ?? "—")}
                    </td>

                    {/* Fehler --------------------------------------- */}
                    <td className="px-5 py-4 tabular-nums hidden md:table-cell">
                      {s.startedAt > 0 ? (
                        <span className={s.totalWrongAnswers > 0 ? "text-red-400" : "text-stone-600"}>
                          {s.totalWrongAnswers}
                        </span>
                      ) : (
                        <span className="text-stone-700">—</span>
                      )}
                    </td>

                    {/* Status -------------------------------------- */}
                    <td className="px-5 py-4">
                      <StatusCell s={s} />
                    </td>

                    {/* Zeit ---------------------------------------- */}
                    <td className="px-5 py-4 text-stone-400 text-xs hidden md:table-cell whitespace-nowrap">
                      {relativeTime(s)}
                      {s.finalSolved && s.finishedAt && (
                        <p className="text-stone-600 mt-0.5">
                          Fertig {formatTime(s.finishedAt)}
                        </p>
                      )}
                    </td>

                    {/* Fotos --------------------------------------- */}
                    {/* stopPropagation: clicks on photo links / cell empty
                        area must not trigger the row's expand toggle. */}
                    <td
                      className="px-5 py-4 hidden md:table-cell"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <PhotoList photos={s.photos} stations={stationsRef.current} />
                    </td>

                    {/* Antworten ----------------------------------- */}
                    <td className="px-5 py-4 hidden md:table-cell align-top">
                      <AnswerList
                        answers={s.answers}
                        lastWrongAnswer={s.lastWrongAnswer}
                        stations={stationsRef.current}
                      />
                    </td>

                    {/* Reset --------------------------------------- */}
                    {/* stopPropagation: reset buttons + confirm UI are pure
                        action territory; never bubble to the row's expand. */}
                    <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                      {isConfirming ? (
                        <div className="flex flex-col items-end gap-1">
                          <p className="text-xs text-stone-300 whitespace-nowrap">
                            {s.teamId} zurücksetzen?
                          </p>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => void handleReset(s.teamId)}
                              disabled={isResetting}
                              className="px-2 py-0.5 text-xs font-medium rounded bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 disabled:opacity-50 transition-colors"
                            >
                              {isResetting ? "…" : "Ja"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmResetId(null)}
                              className="px-2 py-0.5 text-xs font-medium rounded text-stone-500 hover:text-stone-300 transition-colors"
                            >
                              Nein
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmResetId(s.teamId)}
                          disabled={isResetting}
                          className="px-2 py-0.5 text-xs font-medium rounded text-stone-600 border border-transparent hover:text-red-400 hover:border-red-500/30 transition-colors disabled:opacity-50"
                        >
                          Reset
                        </button>
                      )}
                    </td>

                  </tr>

                  {/* Detail row — only rendered when this team is expanded.
                      Sits inside the same <tbody> so colSpan aligns with the
                      9 columns of the parent table. */}
                  {isExpanded && (
                    <tr className="bg-navy-900/40 border-b border-navy-700/50">
                      <td colSpan={9} className="px-5 py-5">
                        <TeamDetailRow
                          team={s}
                          stations={stationsRef.current}
                        />
                        <ArchiveSection
                          stations={stationsRef.current}
                          state={archives[s.teamId]}
                          open={archiveOpenFor.has(s.teamId)}
                          onToggle={() => toggleArchive(s.teamId)}
                          onReload={() => void loadArchive(s.teamId)}
                        />
                      </td>
                    </tr>
                  )}
                  </Fragment>
                );
              })}

            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}

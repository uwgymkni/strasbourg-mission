"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  fetchStations,
  fetchAllProgress,
  resetTeamProgress,
} from "@/services/game.service";
import { fetchAllTeams } from "@/services/auth.service";
import { useRequireAdmin } from "@/hooks/useRequireAdmin";
import type { Station, TeamProgress } from "@/types/game";
import type { AppUser } from "@/types/user";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Progress + teams are re-fetched every N ms. Stations are static — fetched once. */
const PROGRESS_POLL_MS = 30_000;

// ---------------------------------------------------------------------------
// View model
// ---------------------------------------------------------------------------

interface TeamSummary {
  teamId: string;
  teamName: string;
  completedCount: number;
  skippedCount: number;
  totalStations: number;
  currentStationTitle: string | null;
  finalSolved: boolean;
  finalAnswer: string | null;
  finishedAt: number | undefined;
  startedAt: number; // 0 = never started
  members: string[];
  totalWrongAnswers: number;
}

function buildSummaries(
  teams: AppUser[],
  progressMap: Map<string, TeamProgress>,
  stations: Station[]
): TeamSummary[] {
  const stationMap = new Map(stations.map((s) => [s.id, s]));
  const total = stations.length;

  // Admin accounts are excluded from Mission Control — they are not student teams.
  // fetchAllTeams() returns all roles; we filter here so the stats bar and table
  // only reflect actual student teams without touching any other code path.
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
        currentStationTitle: currentStation?.title ?? null,
        finalSolved:
          typeof prog?.finalAnswer === "string" && prog.finalAnswer.length > 0,
        finalAnswer:         prog?.finalAnswer ?? null,
        finishedAt:          prog?.finishedAt,
        startedAt:           prog?.startedAt ?? 0,
        members:             prog?.members ?? [],
        totalWrongAnswers,
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

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminPage() {
  const adminUser = useRequireAdmin();

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
  const [confirmResetId, setConfirmResetId] = useState<string | null>(null);
  // teamIds whose Firestore reset is currently in-flight (disable the button).
  const [resettingIds,   setResettingIds]   = useState<Set<string>>(new Set());

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
  // Reset action
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
      void loadProgress(true); // silent: update table without full spinner
    } else {
      setError(result.error);
    }
  }

  // ------------------------------------------------------------------
  // Guard
  // ------------------------------------------------------------------

  if (!adminUser) return null;

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
              Admin
            </p>
            <h1 className="text-2xl font-semibold text-cream">Mission Control</h1>
            <p className="text-stone-500 text-xs mt-1 h-4">
              {secondsAgo === null
                ? ""
                : secondsAgo === 0
                  ? "Gerade aktualisiert"
                  : `Letzte Aktualisierung vor ${secondsAgo} Sek.`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadProgress()}
            disabled={loading}
            className="mt-1 px-4 py-2 text-sm font-medium text-gold-500 border border-gold-500/30 rounded-lg hover:bg-gold-500/10 disabled:opacity-50 transition-colors"
          >
            {loading ? "Laden…" : "Aktualisieren"}
          </button>
        </div>

        {/* ── Error ──────────────────────────────────────────────── */}
        {error && (
          <div className="rounded-lg bg-red-400/10 px-4 py-3 mb-6">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

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
                <th className="w-px px-4 py-4" />{/* Reset — no header text */}
              </tr>
            </thead>
            <tbody>

              {/* Skeleton rows on initial load */}
              {loading && summaries.length === 0 && (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-navy-700/50">
                    {[28, 20, 32, 10, 14, 14, 6].map((w, j) => (
                      <td
                        key={j}
                        className={`px-5 py-4${j >= 2 && j !== 4 && j !== 6 ? " hidden md:table-cell" : ""}`}
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
                  <td colSpan={7} className="px-5 py-8 text-center text-stone-500 italic">
                    Keine Teams gefunden. Zuerst das Seed-Skript ausführen.
                  </td>
                </tr>
              )}

              {/* Data rows */}
              {summaries.map((s) => {
                const isActive     = !s.finalSolved && s.startedAt > 0;
                const isResetting  = resettingIds.has(s.teamId);
                const isConfirming = confirmResetId === s.teamId;

                return (
                  <tr
                    key={s.teamId}
                    className={[
                      "border-b border-navy-700/50 last:border-0 transition-colors",
                      isActive ? "bg-blue-500/[0.04]" : "",
                    ].join(" ")}
                  >

                    {/* Team ---------------------------------------- */}
                    <td className="px-5 py-4">
                      <p className="font-medium text-cream">{s.teamId}</p>
                      <p className="text-xs text-stone-500">{s.teamName}</p>
                      {s.members.length > 0 && (
                        <p className="text-xs text-stone-600 mt-0.5 max-w-[200px] truncate">
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

                    {/* Reset --------------------------------------- */}
                    <td className="px-4 py-4">
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
                );
              })}

            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchStations, fetchAllProgress } from "@/services/game.service";
import { fetchAllTeams } from "@/services/auth.service";
import { useRequireAdmin } from "@/hooks/useRequireAdmin";
import type { Station, TeamProgress } from "@/types/game";
import type { AppUser } from "@/types/user";

// ---------------------------------------------------------------------------
// View model
// ---------------------------------------------------------------------------

interface TeamSummary {
  teamId: string;
  teamName: string;
  completedCount: number;
  totalStations: number;
  currentStationTitle: string | null;
  finalSolved: boolean;
  finishedAt: number | undefined;
  startedAt: number; // 0 means never started (seed default)
}

function buildSummaries(
  teams: AppUser[],
  progressMap: Map<string, TeamProgress>,
  stations: Station[]
): TeamSummary[] {
  const stationMap = new Map(stations.map((s) => [s.id, s]));
  const total = stations.length;

  return teams
    .map((team) => {
      const prog = progressMap.get(team.teamCode);
      const completedCount = prog
        ? Object.values(prog.progress).filter((v) => v === "completed").length
        : 0;
      const currentStation = prog?.currentStationId
        ? (stationMap.get(prog.currentStationId) ?? null)
        : null;

      return {
        teamId: team.teamCode,
        teamName: team.teamName,
        completedCount,
        totalStations: total,
        currentStationTitle: currentStation?.title ?? null,
        finalSolved:
          typeof prog?.finalAnswer === "string" && prog.finalAnswer.length > 0,
        finishedAt: prog?.finishedAt,
        startedAt: prog?.startedAt ?? 0,
      };
    })
    .sort((a, b) => {
      if (a.finalSolved !== b.finalSolved) return a.finalSolved ? -1 : 1;
      if (b.completedCount !== a.completedCount)
        return b.completedCount - a.completedCount;
      return a.teamId.localeCompare(b.teamId);
    });
}

function formatTime(ms: number | undefined): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminPage() {
  const adminUser = useRequireAdmin();

  const [summaries, setSummaries] = useState<TeamSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [teamsResult, progressResult, stationsResult] = await Promise.all([
      fetchAllTeams(),
      fetchAllProgress(),
      fetchStations(),
    ]);

    setLoading(false);

    if (!teamsResult.success) { setError(teamsResult.error); return; }
    if (!progressResult.success) { setError(progressResult.error); return; }
    if (!stationsResult.success) { setError(stationsResult.error); return; }

    const progressMap = new Map(
      progressResult.data.map((p) => [p.teamId, p])
    );
    setSummaries(
      buildSummaries(teamsResult.data, progressMap, stationsResult.data)
    );
    setLastRefreshed(new Date());
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Guard: hook redirects non-admins, but we also bail here to avoid
  // rendering protected content during the in-flight redirect.
  if (!adminUser) return null;

  const finishedCount = summaries.filter((s) => s.finalSolved).length;
  const activeCount = summaries.filter(
    (s) => !s.finalSolved && s.startedAt > 0
  ).length;
  const notStartedCount = summaries.filter((s) => s.startedAt === 0).length;

  return (
    <div className="min-h-dvh bg-navy-950 text-cream p-6">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <p className="text-gold-600 text-xs font-medium tracking-widest uppercase mb-2">
              Admin
            </p>
            <h1 className="text-2xl font-semibold text-cream">Mission Control</h1>
            {lastRefreshed && (
              <p className="text-stone-500 text-xs mt-1">
                Last refreshed: {lastRefreshed.toLocaleTimeString()}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="mt-1 px-4 py-2 text-sm font-medium text-gold-500 border border-gold-500/30 rounded-lg hover:bg-gold-500/10 disabled:opacity-50 transition-colors"
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg bg-red-400/10 px-4 py-3 mb-6">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Stats bar */}
        {summaries.length > 0 && (
          <div className="grid grid-cols-4 gap-3 mb-6">
            {[
              { label: "Teams", value: summaries.length },
              { label: "Finished", value: finishedCount },
              { label: "Active", value: activeCount },
              { label: "Not started", value: notStartedCount },
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

        {/* Table */}
        <div className="bg-navy-800 border border-navy-700 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-navy-700">
                <th className="text-left px-5 py-4 text-stone-400 font-medium">
                  Team
                </th>
                <th className="text-left px-5 py-4 text-stone-400 font-medium">
                  Progress
                </th>
                <th className="text-left px-5 py-4 text-stone-400 font-medium hidden md:table-cell">
                  Current station
                </th>
                <th className="text-left px-5 py-4 text-stone-400 font-medium">
                  Status
                </th>
                <th className="text-left px-5 py-4 text-stone-400 font-medium hidden md:table-cell">
                  Started
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && summaries.length === 0 ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-navy-700/50">
                    {[24, 12, 32, 16, 12].map((w, j) => (
                      <td
                        key={j}
                        className={`px-5 py-4${j >= 2 && j !== 3 ? " hidden md:table-cell" : ""}`}
                      >
                        <div
                          className="h-4 bg-navy-700 rounded animate-pulse"
                          style={{ width: `${w * 4}px` }}
                        />
                      </td>
                    ))}
                  </tr>
                ))
              ) : summaries.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-8 text-center text-stone-500 italic"
                  >
                    No teams found. Run the seed script first.
                  </td>
                </tr>
              ) : (
                summaries.map((s) => (
                  <tr
                    key={s.teamId}
                    className="border-b border-navy-700/50 last:border-0"
                  >
                    <td className="px-5 py-4">
                      <p className="font-medium text-cream">{s.teamId}</p>
                      <p className="text-xs text-stone-500">{s.teamName}</p>
                    </td>
                    <td className="px-5 py-4 tabular-nums">
                      <span
                        className={
                          s.completedCount === s.totalStations && s.totalStations > 0
                            ? "text-gold-400 font-medium"
                            : "text-stone-300"
                        }
                      >
                        {s.completedCount}
                      </span>
                      <span className="text-stone-600"> / {s.totalStations}</span>
                    </td>
                    <td className="px-5 py-4 text-stone-400 hidden md:table-cell">
                      {s.finalSolved ? "—" : (s.currentStationTitle ?? "—")}
                    </td>
                    <td className="px-5 py-4">
                      {s.finalSolved ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gold-500/15 text-gold-400 border border-gold-500/30">
                          Finished
                        </span>
                      ) : s.startedAt > 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          Active
                        </span>
                      ) : (
                        <span className="text-xs text-stone-600">Not started</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-stone-500 tabular-nums hidden md:table-cell">
                      {formatTime(s.startedAt || undefined)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}

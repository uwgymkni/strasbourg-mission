"use client";

import { memo } from "react";
import { latLngToSvg, clusterOffset, type LatLngBounds } from "@/lib/geo";
import { TEAM_CONFIGS } from "@/constants/routes";
import type { Station } from "@/types/game";

// ---------------------------------------------------------------------------
// Props — decoupled from page.tsx's TeamSummary so this component can be
// developed and tested independently. TeamSummary already structurally
// satisfies MapTeam (it has all these fields plus more), so passing it
// directly type-checks without any cast.
// ---------------------------------------------------------------------------

interface MapTeam {
  teamId: string;
  currentStationId: string | null;
  finalSolved: boolean;
  startedAt: number;
}

interface MissionMapProps {
  summaries: MapTeam[];
  stations: Station[];
}

// ---------------------------------------------------------------------------
// Projection constants
// ---------------------------------------------------------------------------

/**
 * Bounding box covering all 6 stations. Münsterplatz (the return point for
 * finished teams) lies inside this bbox so no expansion needed.
 *   minLat = Vauban (48.5781)   maxLat = Kléber  (48.5840)
 *   minLng = Vauban (7.7361)    maxLng = Kammerz.(7.7511)
 */
const BOUNDS: LatLngBounds = {
  minLat: 48.5781,
  maxLat: 48.5840,
  minLng: 7.7361,
  maxLng: 7.7511,
};

/**
 * Münsterplatz — symbolic "return point" for teams that have submitted the
 * final answer. Picked just south-west of Haus Kammerzell so the gold star
 * does not sit exactly on top of station 6's marker.
 */
const MUENSTERPLATZ_LAT = 48.5817;
const MUENSTERPLATZ_LNG = 7.7508;

/**
 * ViewBox aspect ratio matches the true ground aspect of BOUNDS:
 *   width/height ≈ Δlng × cos(48.58°) / Δlat ≈ 1.68
 * The container <div> uses the same CSS aspect-ratio so the SVG scales
 * uniformly without distortion.
 */
const SVG_WIDTH   = 1000;
const SVG_HEIGHT  =  595;          // 1000 / 1.681 ≈ 595
const SVG_PADDING =   70;          // px margin inside the SVG for edge markers

// ---------------------------------------------------------------------------
// Team colour palette — Tailwind 400-shades, picked for contrast on navy-950.
// Indexed by team position in TEAM_CONFIGS (stable lookup by teamCode).
// ---------------------------------------------------------------------------

const TEAM_COLORS = [
  "#60a5fa", // 0 ALPHA-1   blue-400
  "#34d399", // 1 BRAVO-2   emerald-400
  "#c084fc", // 2 CHARLIE-3 purple-400
  "#fb7185", // 3 DELTA-4   rose-400
  "#fbbf24", // 4 ECHO-5    amber-400
  "#22d3ee", // 5 FOXTROT-6 cyan-400
  "#fb923c", // 6 GOLF-7    orange-400
  "#a3e635", // 7 HOTEL-8   lime-400
];

function teamColor(teamId: string): string {
  const idx = TEAM_CONFIGS.findIndex((t) => t.teamCode === teamId);
  return TEAM_COLORS[idx >= 0 ? idx : 0] ?? "#94a3b8";
}

/** Two-character team label: ALPHA-1 → "A1", HOTEL-8 → "H8". */
function teamLabel(teamId: string): string {
  const parts = teamId.split("-");
  if (parts.length === 2 && parts[0] && parts[1]) {
    return parts[0][0]! + parts[1];
  }
  return teamId.slice(0, 2).toUpperCase();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function MissionMapInner({ summaries, stations }: MissionMapProps) {
  // Group active (non-finished) teams by their current station so the
  // jitter logic knows the cluster size for each station.
  const teamsByStationId: Record<string, MapTeam[]> = {};
  for (const team of summaries) {
    if (team.finalSolved) continue;
    if (!team.currentStationId) continue;
    const bucket = teamsByStationId[team.currentStationId];
    if (bucket) {
      bucket.push(team);
    } else {
      teamsByStationId[team.currentStationId] = [team];
    }
  }

  const finishedTeams = summaries.filter((t) => t.finalSolved);

  return (
    <div className="bg-navy-800 border border-navy-700 rounded-2xl overflow-hidden">
      <div className="px-5 py-3 border-b border-navy-700/40">
        <p className="text-gold-600 text-xs font-medium tracking-widest uppercase">
          Operations Map
        </p>
      </div>

      <div
        className="relative w-full bg-navy-950"
        style={{ aspectRatio: "1.68 / 1" }}
      >
        {/* Static background. If the asset is missing the broken-image icon
            is suppressed and the bg-navy-950 fallback shows through, keeping
            the SVG markers fully usable as a schematic. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/strasbourg-map.png"
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-70"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />

        <svg
          viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
          className="absolute inset-0 w-full h-full"
          aria-label="Operations Map: Teamverteilung über die Stationen"
        >
          {/* ── Station circles (always rendered) ─────────────────── */}
          {stations.map((station) => {
            if (
              station.latitude === undefined ||
              station.longitude === undefined
            ) {
              return null;
            }
            const { x, y } = latLngToSvg(
              station.latitude,
              station.longitude,
              BOUNDS,
              SVG_WIDTH,
              SVG_HEIGHT,
              SVG_PADDING,
            );
            const teamCount = (teamsByStationId[station.id] ?? []).length;
            // grey = empty · blue = 1 team · orange = stau (2+)
            const fill =
              teamCount === 0
                ? "#475569"
                : teamCount === 1
                  ? "#3b82f6"
                  : "#f97316";

            return (
              <g key={`station-${station.id}`}>
                <circle
                  cx={x}
                  cy={y}
                  r={18}
                  fill={fill}
                  stroke="#0f172a"
                  strokeWidth={2}
                  opacity={0.95}
                />
                <text
                  x={x}
                  y={y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#fff"
                  fontSize={13}
                  fontWeight={600}
                >
                  {station.order}
                </text>
              </g>
            );
          })}

          {/* ── Active team markers ───────────────────────────────── */}
          {stations.flatMap((station) => {
            if (
              station.latitude === undefined ||
              station.longitude === undefined
            ) {
              return [];
            }
            const teams = teamsByStationId[station.id] ?? [];
            if (teams.length === 0) return [];

            const { x, y } = latLngToSvg(
              station.latitude,
              station.longitude,
              BOUNDS,
              SVG_WIDTH,
              SVG_HEIGHT,
              SVG_PADDING,
            );

            return teams.map((team, idx) => {
              const { dx, dy } = clusterOffset(idx, teams.length);
              const colour = teamColor(team.teamId);
              return (
                <g key={`team-${team.teamId}`}>
                  <circle
                    cx={x + dx}
                    cy={y + dy}
                    r={16}
                    fill={colour}
                    fillOpacity={0.7}
                    stroke={colour}
                    strokeWidth={2}
                  />
                  <text
                    x={x + dx}
                    y={y + dy}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="#0f172a"
                    fontSize={11}
                    fontWeight={700}
                  >
                    {teamLabel(team.teamId)}
                  </text>
                </g>
              );
            });
          })}

          {/* ── Finished teams at Münsterplatz ───────────────────── */}
          {finishedTeams.map((team, idx) => {
            const { x, y } = latLngToSvg(
              MUENSTERPLATZ_LAT,
              MUENSTERPLATZ_LNG,
              BOUNDS,
              SVG_WIDTH,
              SVG_HEIGHT,
              SVG_PADDING,
            );
            const { dx, dy } = clusterOffset(idx, finishedTeams.length);
            return (
              <text
                key={`done-${team.teamId}`}
                x={x + dx}
                y={y + dy}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={30}
                fill="#eab308"
              >
                ★
              </text>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

/**
 * memo()-wrapped because Mission Control re-renders every second (relative-
 * time tick). The map's inputs only change every 30 s (poll interval), so
 * shallow comparison on summaries + stations is enough to skip 29 of every
 * 30 renders.
 */
export const MissionMap = memo(MissionMapInner);

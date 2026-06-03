"use client";

import { memo, useState } from "react";
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
  currentStationTitle: string | null;
  finalSolved: boolean;
  startedAt: number;
  completedCount: number;
  totalWrongAnswers: number;
}

interface MissionMapProps {
  summaries: MapTeam[];
  stations: Station[];
}

// ---------------------------------------------------------------------------
// Projection constants
// ---------------------------------------------------------------------------

/**
 * Bounding box calibrated against public/strasbourg-operations-map.png.
 *
 * Derived by reading off the normalised (0–1) positions of two anchors per
 * axis on the base map — longitude from Barrage Vauban (west) ↔ Haus
 * Kammerzell (east), latitude from Place Kléber (north) ↔ Barrage Vauban
 * (south) — then back-solving a linear lng→x / lat→y mapping. Normalised
 * readings are dimension-independent, so these four numbers stay correct as
 * long as the container aspectRatio matches the image's real aspect.
 *
 * To nudge alignment: ±0.0005° ≈ 50 m. To shift everything north on the
 * image, lower maxLat. To shift west, raise minLng. Etc.
 */
const BOUNDS: LatLngBounds = {
  minLat: 48.5769,
  maxLat: 48.5906,
  minLng: 7.7345,
  maxLng: 7.7608,
};

/** Münsterplatz — return point for finished teams. */
const MUENSTERPLATZ_LAT = 48.5817;
const MUENSTERPLATZ_LNG = 7.7508;

/**
 * SVG viewBox proportions match public/strasbourg-operations-map.png's real
 * pixel size (2532 × 1822 ≈ 1.390 : 1). Container aspectRatio below uses the
 * same ratio, so the SVG overlay scales 1:1 with the background image and
 * object-cover never crops.
 *
 * Padding stays at 0: BOUNDS already extend beyond the station extents, so
 * markers never reach an SVG edge.
 */
const SVG_WIDTH   = 2532;
const SVG_HEIGHT  = 1822;
const SVG_PADDING =    0;

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

/**
 * Per-station visual nudge in SVG pixel units. Applied AFTER latLngToSvg so
 * the global BOUNDS stay clean — these compensate for the small projection
 * drift Apple Maps introduces at this zoom (≈ 7 m per 10 SVG units rendered).
 *
 * Keyed by station.order so we don't depend on string IDs. Both routes and
 * markers go through stationToSvg, so a nudge moves the polyline endpoint
 * and the marker together — no drift between them.
 */
// Values scaled to the 2532 × 1822 canvas (≈ ×1.81 x, ×1.82 y vs the prior
// 1400 × 1000 calibration) so the visual offsets stay identical after the
// viewBox resize. ~1 % of the canvas ≈ 25 px x / 18 px y.
const STATION_NUDGE: Record<number, { dx: number; dy: number }> = {
  1: { dx:  14, dy:  73 }, // Place Gutenberg → etwas tiefer (SO der Cathédrale)
  2: { dx: -22, dy:   0 }, // Place Kléber    → minimal nach Westen
  3: { dx:  45, dy:   7 }, // Petite France   → Richtung Bain-aux-Plantes (O)
  4: { dx:  14, dy: -33 }, // Ponts Couverts  → leicht NO
  5: { dx:   0, dy:   0 }, // Barrage Vauban  → Anker (SW)
  6: { dx:   7, dy: -73 }, // Haus Kammerzell → höher an die Cathédrale (N)
};

/**
 * Project a station to SVG pixel coords with its visual nudge applied.
 * Returns null if the station has no lat/lng.
 */
function stationToSvg(s: Station): { x: number; y: number } | null {
  if (s.latitude === undefined || s.longitude === undefined) return null;
  const pt = latLngToSvg(
    s.latitude,
    s.longitude,
    BOUNDS,
    SVG_WIDTH,
    SVG_HEIGHT,
    SVG_PADDING,
  );
  const nudge = STATION_NUDGE[s.order] ?? { dx: 0, dy: 0 };
  return { x: pt.x + nudge.dx, y: pt.y + nudge.dy };
}

// ---------------------------------------------------------------------------
// Per-team route — derived from TEAM_CONFIGS.routeOffset.
//
// Each team visits all 6 stations in the canonical order field sequence,
// rotated by their routeOffset so they don't all start at the same spot.
// The split between past / future segments is driven by currentStationId:
// the team has walked from route[0] up to and including currentIndex; the
// edges from currentIndex onwards are still ahead of them.
// ---------------------------------------------------------------------------

/** Stations in the order a single team is supposed to visit them. */
function teamRouteStations(teamId: string, stations: Station[]): Station[] {
  const config = TEAM_CONFIGS.find((t) => t.teamCode === teamId);
  const offset = config?.routeOffset ?? 0;
  const sorted = [...stations]
    .filter((s) => s.latitude !== undefined && s.longitude !== undefined)
    .sort((a, b) => a.order - b.order);
  if (sorted.length === 0) return [];
  const idx = ((offset % sorted.length) + sorted.length) % sorted.length;
  return [...sorted.slice(idx), ...sorted.slice(0, idx)];
}

interface TeamRoute {
  /** Polyline string for already-walked segments (incl. current station as the last point). */
  pastPath: string;
  /** The single "just-walked" segment, route[currentIdx-1] → route[currentIdx].
   *  Drawn over pastPath as a high-emphasis layer so the eye reads "the team
   *  is moving here". Null when there's no preceding station (start, finished,
   *  not-started). */
  currentSegment: string | null;
  /** Polyline string for still-to-come segments (incl. current station as the first point). */
  futurePath: string;
  /** SVG coords of the team's current station, for the ring + glow. Null for finished/not-started. */
  currentXY: { x: number; y: number } | null;
}

/** Build pastPath / futurePath polylines + currentStationXY for one team. */
function buildTeamRoute(
  team: MapTeam,
  stations: Station[],
): TeamRoute {
  const route = teamRouteStations(team.teamId, stations);
  const points = route.map((s) => {
    const pt = stationToSvg(s);
    return pt ? `${pt.x},${pt.y}` : "";
  });

  // Finished — everything is "past", no current station, no current segment.
  if (team.finalSolved) {
    return {
      pastPath: points.filter(Boolean).join(" "),
      currentSegment: null,
      futurePath: "",
      currentXY: null,
    };
  }

  // Not started or unknown currentStationId — everything is "future".
  const currentIdx = team.currentStationId
    ? route.findIndex((s) => s.id === team.currentStationId)
    : -1;
  if (currentIdx < 0) {
    return {
      pastPath: "",
      currentSegment: null,
      futurePath: points.filter(Boolean).join(" "),
      currentXY: null,
    };
  }

  const pastPoints   = points.slice(0, currentIdx + 1).filter(Boolean);
  const futurePoints = points.slice(currentIdx).filter(Boolean);
  const currentStation = route[currentIdx];
  const currentXY = currentStation ? stationToSvg(currentStation) : null;

  // The just-walked segment exists only when there's a previous station.
  // When the team is still at route[0] we can't draw a segment from -1.
  const prevPt = currentIdx > 0 ? points[currentIdx - 1] : null;
  const currPt = points[currentIdx];
  const currentSegment =
    prevPt && currPt ? `${prevPt} ${currPt}` : null;

  return {
    // pastPath needs ≥ 2 points to draw a visible segment.
    pastPath:       pastPoints.length   >= 2 ? pastPoints.join(" ")   : "",
    currentSegment,
    futurePath:     futurePoints.length >= 2 ? futurePoints.join(" ") : "",
    currentXY,
  };
}

// ---------------------------------------------------------------------------
// Stuck-team heuristic
//
// A team is "stuck" when their average minutes-per-completed-station crosses
// a threshold. Because elapsed time keeps growing while completedCount stays
// fixed during the current station, the average naturally inflates if the
// team lingers — no per-station timestamp persistence needed.
//
// Re-evaluates on every render. MissionMap is React.memo'd so this only
// recomputes on the 30-s poll (or on local hover/click state changes), not
// on the parent's 1-s tick. Up-to-30-s detection latency is fine for an
// admin overview.
// ---------------------------------------------------------------------------

const STUCK_MIN_PER_STATION = 18;

function isStuck(team: MapTeam): boolean {
  if (team.finalSolved) return false;
  if (team.completedCount <= 0) return false;
  if (!team.startedAt) return false;
  const elapsedMin = (Date.now() - team.startedAt) / 60_000;
  return elapsedMin / team.completedCount > STUCK_MIN_PER_STATION;
}

// ---------------------------------------------------------------------------
// DOM bridge — scroll to the team's table row and flash-highlight it.
//
// Pragmatic: the row lives in the same document, we know its data-attribute,
// no React state needs to cross component boundaries. Safe on SSR because
// MissionMap is "use client" and this only runs in onClick handlers.
// ---------------------------------------------------------------------------

const FLASH_CLASSES = [
  "bg-gold-500/20",
  "ring-2",
  "ring-gold-500/60",
  "ring-inset",
];
const FLASH_DURATION_MS = 1500;

function scrollAndHighlightRow(teamId: string): void {
  // The row's `transition-colors` class already animates the bg fade, so we
  // only need to add + later remove the flash classes.
  const row = document.querySelector<HTMLElement>(
    `[data-team-code="${teamId}"]`,
  );
  if (!row) return;

  row.scrollIntoView({ behavior: "smooth", block: "center" });
  row.classList.add(...FLASH_CLASSES);
  window.setTimeout(() => {
    row.classList.remove(...FLASH_CLASSES);
  }, FLASH_DURATION_MS);
}

// ---------------------------------------------------------------------------
// Tooltip geometry — kept here so future tweaks live next to the SVG sizes.
// ---------------------------------------------------------------------------

const TIP_W           = 172;
const TIP_H_BASE      =  90;
const TIP_STUCK_EXTRA =  18;   // additional height for the ⚠ line
const TIP_GAP         = 12;    // distance between marker edge and tooltip
const MARKER_R        = 22;    // padding used to compute marker → tooltip offset
const EDGE_INSET      =  6;

interface TooltipMetrics {
  x: number;
  y: number;
  flippedBelow: boolean;
}

/**
 * Position the tooltip box above the marker, flipping below when clipping the
 * top of the SVG and clamping horizontally. `tipH` is passed in so the stuck-
 * warning variant can use a taller box without breaking the flip threshold.
 */
function tooltipPosition(cx: number, cy: number, tipH: number): TooltipMetrics {
  // Prefer above the marker.
  let x = cx - TIP_W / 2;
  let y = cy - MARKER_R - TIP_GAP - tipH;
  let flippedBelow = false;

  if (y < EDGE_INSET) {
    y = cy + MARKER_R + TIP_GAP;
    flippedBelow = true;
  }
  if (x < EDGE_INSET) x = EDGE_INSET;
  if (x + TIP_W > SVG_WIDTH - EDGE_INSET) {
    x = SVG_WIDTH - TIP_W - EDGE_INSET;
  }

  return { x, y, flippedBelow };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface RenderedMarker {
  team: MapTeam;
  /** Coords of the underlying station/münsterplatz, no jitter applied. */
  baseX: number;
  baseY: number;
  /** Final marker coords with cluster jitter applied. */
  cx: number;
  cy: number;
  color: string;
  label: string;
  isFinished: boolean;
  /** Station title to show in the tooltip (null for finished teams). */
  stationTitle: string | null;
}

function MissionMapInner({ summaries, stations }: MissionMapProps) {
  // Local UI state. NOT shared with the parent — only this component
  // re-renders when the user hovers/taps a marker.
  //
  // Two-state model so desktop hover and mobile tap can coexist:
  //   • hovered → set/cleared by mouse pointerEnter/pointerLeave (gated to
  //               pointerType === "mouse" so synthetic touch pointers don't
  //               fire it and break Tap-to-pin on mobile).
  //   • pinned  → toggled by click/tap on a marker; survives mouseleave so
  //               a clicked tooltip stays on desktop and so a second tap on
  //               the same marker dismisses on mobile.
  // The derived `active` is what the rest of the render reads.
  const [hovered, setHovered] = useState<string | null>(null);
  const [pinned,  setPinned]  = useState<string | null>(null);
  const active = pinned ?? hovered;

  const totalStations = stations.length;

  // ── Pre-compute markers in one pass ──────────────────────────────────
  const teamsByStationId: Record<string, MapTeam[]> = {};
  for (const team of summaries) {
    if (team.finalSolved) continue;
    if (!team.currentStationId) continue;
    const bucket = teamsByStationId[team.currentStationId];
    if (bucket) bucket.push(team);
    else teamsByStationId[team.currentStationId] = [team];
  }
  const finishedTeams = summaries.filter((t) => t.finalSolved);

  const markers: RenderedMarker[] = [];

  // Active markers — by station, with jitter inside each cluster.
  for (const station of stations) {
    const teams = teamsByStationId[station.id] ?? [];
    if (teams.length === 0) continue;
    const pt = stationToSvg(station);
    if (!pt) continue;

    teams.forEach((team, idx) => {
      const { dx, dy } = clusterOffset(idx, teams.length);
      markers.push({
        team,
        baseX: pt.x,
        baseY: pt.y,
        cx: pt.x + dx,
        cy: pt.y + dy,
        color: teamColor(team.teamId),
        label: teamLabel(team.teamId),
        isFinished: false,
        stationTitle: station.title,
      });
    });
  }

  // Finished markers — clustered at Münsterplatz.
  if (finishedTeams.length > 0) {
    const muensterPt = latLngToSvg(
      MUENSTERPLATZ_LAT,
      MUENSTERPLATZ_LNG,
      BOUNDS,
      SVG_WIDTH,
      SVG_HEIGHT,
      SVG_PADDING,
    );
    finishedTeams.forEach((team, idx) => {
      const { dx, dy } = clusterOffset(idx, finishedTeams.length);
      markers.push({
        team,
        baseX: muensterPt.x,
        baseY: muensterPt.y,
        cx: muensterPt.x + dx,
        cy: muensterPt.y + dy,
        color: "#eab308",
        label: "★",
        isFinished: true,
        stationTitle: null,
      });
    });
  }

  // ── Route polylines ─────────────────────────────────────────────────
  // Two subtle dashed standard routes derived from routeOffset groups.
  // Route A: stations in natural order (1→2→3→4→5→6), used by offset 0 teams.
  // Route B: rotated by one (2→3→4→5→6→1), used by offset 1 teams; visually
  // the same edges as A except for the unique start (1-2) vs end (6-1).
  // Different dash patterns let the eye separate them where they overlap.
  const orderedStations = [...stations]
    .filter((s) => s.latitude !== undefined && s.longitude !== undefined)
    .sort((a, b) => a.order - b.order);

  const routePoint = (s: Station): string => {
    const pt = stationToSvg(s);
    return pt ? `${pt.x},${pt.y}` : "";
  };

  const routeAPoints = orderedStations.map(routePoint).filter(Boolean).join(" ");

  const rotated =
    orderedStations.length > 1
      ? [...orderedStations.slice(1), orderedStations[0]!]
      : orderedStations;
  const routeBPoints = rotated.map(routePoint).filter(Boolean).join(" ");

  // ── Active team's route (computed only when something is active) ────
  // Doing this conditionally keeps the no-hover render path cheap — the
  // common case allocates nothing beyond the existing markers array.
  const activeTeam = active ? summaries.find((t) => t.teamId === active) ?? null : null;
  const activeRoute: TeamRoute | null = activeTeam
    ? buildTeamRoute(activeTeam, stations)
    : null;
  const activeColor = active ? teamColor(active) : null;

  // ── Active tooltip data ─────────────────────────────────────────────
  const activeMarker = active ? markers.find((m) => m.team.teamId === active) ?? null : null;
  const activeStuck = activeTeam ? isStuck(activeTeam) : false;
  const tipH = activeStuck ? TIP_H_BASE + TIP_STUCK_EXTRA : TIP_H_BASE;
  const tip = activeMarker ? tooltipPosition(activeMarker.cx, activeMarker.cy, tipH) : null;

  // Background-tap handler — clears both states so the route + tooltip go
  // away. Marker handlers stopPropagation so this only fires on empty SVG.
  const handleBackgroundClick = () => {
    setPinned(null);
    setHovered(null);
  };

  return (
    <div className="bg-navy-800 border border-navy-700 rounded-2xl overflow-hidden">
      <div className="px-5 py-3 border-b border-navy-700/40">
        <p className="text-gold-600 text-xs font-medium tracking-widest uppercase">
          Operations Map
        </p>
      </div>

      <div
        className="relative w-full bg-navy-950"
        style={{ aspectRatio: "2532 / 1822" }}
      >
        {/* Static background. onError hides the broken-image icon if the
            asset is missing — bg-navy-950 + SVG markers still work as a
            standalone schematic. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/strasbourg-operations-map.png"
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-85"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />

        <svg
          viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
          className="absolute inset-0 w-full h-full"
          aria-label="Operations Map: Teamverteilung über die Stationen"
          /* Tap on empty SVG area closes any open tooltip / route. Marker
             click handlers stopPropagation so they don't bubble here. */
          onClick={handleBackgroundClick}
        >
          {/* ── Standard routes — only when no team is focused. When a
                team route is active we hide the generic overlay so the
                tactical layer isn't visually cluttered. ─────────────── */}
          {!active && routeAPoints && (
            <polyline
              points={routeAPoints}
              fill="none"
              stroke="#94a3b8"        /* slate-400 — sits quieter on the map */
              strokeWidth={1.1}
              strokeDasharray="5 8"
              opacity={0.18}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
          {!active && routeBPoints && (
            <polyline
              points={routeBPoints}
              fill="none"
              stroke="#d6d3d1"        /* stone-300 — neutral, no warm accent */
              strokeWidth={1.1}
              strokeDasharray="2 10"
              opacity={0.18}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* ── Active team's route (z below stations) ────────────────
                Past = bolder, longer dashes, higher opacity → "walked".
                Future = thin, sparse dots, low opacity → "ahead".
                Both share the current station as a junction point so
                the two polylines visually meet without a gap. */}
          {activeRoute && activeColor && activeRoute.pastPath && (
            <polyline
              points={activeRoute.pastPath}
              fill="none"
              stroke={activeColor}
              strokeWidth={2.2}
              strokeDasharray="8 4"
              opacity={0.55}
              strokeLinecap="round"
              strokeLinejoin="round"
              pointerEvents="none"
            />
          )}
          {/* Just-walked segment — overlaid on top of pastPath so the eye
              immediately reads "team is moving here". Layered between past
              and future so future-dots stay over the current-station meeting
              point. Static, no animation. */}
          {activeRoute && activeColor && activeRoute.currentSegment && (
            <polyline
              points={activeRoute.currentSegment}
              fill="none"
              stroke={activeColor}
              strokeWidth={3}
              strokeDasharray="10 4"
              opacity={0.75}
              strokeLinecap="round"
              strokeLinejoin="round"
              pointerEvents="none"
            />
          )}
          {activeRoute && activeColor && activeRoute.futurePath && (
            <polyline
              points={activeRoute.futurePath}
              fill="none"
              stroke={activeColor}
              strokeWidth={1.2}
              strokeDasharray="1 6"
              opacity={0.28}
              strokeLinecap="round"
              strokeLinejoin="round"
              pointerEvents="none"
            />
          )}

          {/* ── Station circles ───────────────────────────────────────── */}
          {stations.map((station) => {
            const pt = stationToSvg(station);
            if (!pt) return null;

            const teamCount = (teamsByStationId[station.id] ?? []).length;
            // grey = empty · blue = 1 team · orange = stau (2+)
            const fill =
              teamCount === 0
                ? "#475569"
                : teamCount === 1
                  ? "#3b82f6"
                  : "#f97316";

            return (
              <g key={`station-${station.id}`} pointerEvents="none">
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={18}
                  fill={fill}
                  stroke="#0f172a"
                  strokeWidth={2}
                  opacity={0.95}
                />
                <text
                  x={pt.x}
                  y={pt.y}
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

          {/* ── Active team's current-station ring + glow ─────────────
                Two concentric rings give a subtle halo without needing an
                SVG <filter> (iOS Safari can be flaky with those). Sits
                above the station circle so it's never occluded. */}
          {activeRoute?.currentXY && activeColor && (
            <g pointerEvents="none">
              <circle
                cx={activeRoute.currentXY.x}
                cy={activeRoute.currentXY.y}
                r={36}
                fill="none"
                stroke={activeColor}
                strokeWidth={1}
                opacity={0.22}
              />
              <circle
                cx={activeRoute.currentXY.x}
                cy={activeRoute.currentXY.y}
                r={28}
                fill="none"
                stroke={activeColor}
                strokeWidth={2}
                opacity={0.60}
              />
            </g>
          )}

          {/* ── Team markers ──────────────────────────────────────────── */}
          {markers.map((m) => {
            const isActive = active === m.team.teamId;
            const isDimmed = active !== null && !isActive;
            const stuck    = isStuck(m.team);

            // Mouse-only hover, gated by pointerType so touch taps don't
            // accidentally trigger the hover code-path and then immediately
            // get toggled off by the synthetic click event.
            const handlePointerEnter = (e: React.PointerEvent) => {
              if (e.pointerType !== "mouse") return;
              setHovered(m.team.teamId);
            };
            const handlePointerLeave = (e: React.PointerEvent) => {
              if (e.pointerType !== "mouse") return;
              setHovered((prev) => (prev === m.team.teamId ? null : prev));
            };

            // Click semantics differ by primary input device:
            //
            //   • Hover-capable (desktop mouse / trackpad):
            //       Click only scrolls + flash-highlights the table row.
            //       Pinned state is NEVER changed by clicks here, so a click
            //       never leaves a sticky tooltip behind on Desktop.
            //       The tooltip + route remain visible via `hovered` while
            //       the cursor is over the marker, and disappear on
            //       pointerleave — the natural desktop flow.
            //
            //   • Touch / coarse pointer (mobile, iPad without trackpad):
            //       Click toggles the pin (since hover can't carry state on
            //       touch). Second tap on the same marker, tap on another
            //       marker, or background tap all close as before.
            //
            // matchMedia is evaluated inside the handler — runs only post-
            // mount inside a user gesture, so SSR-safe with no special
            // guard. Each call is microseconds; not worth memoising.
            const handleClick = (e: React.MouseEvent) => {
              e.stopPropagation(); // don't bubble to SVG background-close

              const hoverCapable =
                window.matchMedia("(hover: hover)").matches;

              if (hoverCapable) {
                scrollAndHighlightRow(m.team.teamId);
                return;
              }

              // Touch path — same behaviour as before.
              setPinned((prev) => {
                const next = prev === m.team.teamId ? null : m.team.teamId;
                if (next) scrollAndHighlightRow(next);
                return next;
              });
              setHovered((prev) => (prev === m.team.teamId ? null : prev));
            };

            return (
              <g
                key={`team-${m.team.teamId}`}
                style={{ cursor: "pointer" }}
                opacity={isDimmed ? 0.32 : 1}
                onPointerEnter={handlePointerEnter}
                onPointerLeave={handlePointerLeave}
                onClick={handleClick}
              >
                {/* Stuck warning ring — thin amber circle sitting just
                    outside the marker. No animation, no pulse. Rendered
                    first so the marker circle/star paints over its
                    intersection cleanly. */}
                {stuck && (
                  <circle
                    cx={m.cx}
                    cy={m.cy}
                    r={22}
                    fill="none"
                    stroke="#f59e0b"        /* amber-500 */
                    strokeWidth={1.5}
                    opacity={0.75}
                    pointerEvents="none"
                  />
                )}
                {m.isFinished ? (
                  <text
                    x={m.cx}
                    y={m.cy}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={30}
                    fill={m.color}
                    /* Outline approximates a clickable hit-box; the star glyph
                       alone is sparse and would miss taps on its concave bits. */
                    stroke={isActive ? "#0f172a" : "transparent"}
                    strokeWidth={isActive ? 0.5 : 0}
                  >
                    ★
                  </text>
                ) : (
                  <>
                    <circle
                      cx={m.cx}
                      cy={m.cy}
                      r={16}
                      fill={m.color}
                      fillOpacity={0.7}
                      stroke={m.color}
                      strokeWidth={isActive ? 3 : 2}
                    />
                    <text
                      x={m.cx}
                      y={m.cy}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="#0f172a"
                      fontSize={11}
                      fontWeight={700}
                      pointerEvents="none"
                    >
                      {m.label}
                    </text>
                  </>
                )}

                {/* Invisible larger hit-box for easier tapping on mobile.
                    pointer-events="all" makes it catch taps even though fill
                    is transparent. */}
                <circle
                  cx={m.cx}
                  cy={m.cy}
                  r={22}
                  fill="transparent"
                  pointerEvents="all"
                />
              </g>
            );
          })}

          {/* ── Active tooltip (z-top) ────────────────────────────────── */}
          {activeMarker && tip && (
            <g pointerEvents="none">
              {/* Soft drop-shadow halo so the tooltip reads on top of the map. */}
              <rect
                x={tip.x - 1}
                y={tip.y - 1}
                width={TIP_W + 2}
                height={tipH + 2}
                rx={8}
                fill="#000"
                opacity={0.35}
              />
              <rect
                x={tip.x}
                y={tip.y}
                width={TIP_W}
                height={tipH}
                rx={7}
                fill="#1e293b"            /* navy-800 */
                stroke="#a16207"          /* gold-700 */
                strokeWidth={1}
                opacity={0.98}
              />
              {/* Team code — gold, bold */}
              <text
                x={tip.x + 10}
                y={tip.y + 20}
                fill="#fbbf24"            /* gold-400 */
                fontSize={13}
                fontWeight={700}
                fontFamily="ui-monospace, monospace"
                letterSpacing={0.6}
              >
                {activeMarker.team.teamId}
              </text>
              {/* Station name — cream */}
              <text
                x={tip.x + 10}
                y={tip.y + 39}
                fill="#f5f5f4"
                fontSize={11}
              >
                {activeMarker.isFinished
                  ? "Münsterplatz · Fertig"
                  : activeMarker.stationTitle ?? "—"}
              </text>
              {/* Progress */}
              <text
                x={tip.x + 10}
                y={tip.y + 58}
                fill="#94a3b8"
                fontSize={10}
                fontFamily="ui-monospace, monospace"
              >
                {`${activeMarker.team.completedCount} / ${totalStations}`}
              </text>
              {/* Errors — red when > 0 */}
              <text
                x={tip.x + 10}
                y={tip.y + 76}
                fill={
                  activeMarker.team.totalWrongAnswers > 0 ? "#fb7185" : "#94a3b8"
                }
                fontSize={10}
                fontFamily="ui-monospace, monospace"
              >
                {`${activeMarker.team.totalWrongAnswers} Fehler`}
              </text>
              {/* Stuck warning — only rendered when the heuristic fires.
                  tipH was already expanded above to make room. */}
              {activeStuck && (
                <text
                  x={tip.x + 10}
                  y={tip.y + 94}
                  fill="#fb923c"            /* orange-400 — subtle warning */
                  fontSize={10}
                >
                  {"⚠ länger hier"}
                </text>
              )}
            </g>
          )}
        </svg>

        {/* ── Mini legend ───────────────────────────────────────────────
              Static reference key sitting bottom-right of the map. Inline
              SVGs for the line glyphs so colour + dash matches what's
              drawn above. pointer-events-none so it can never block a
              marker tap, even if a finished-team star happens to sit
              right under it. No box-shadow, no animation. */}
        <div
          className="absolute bottom-3 right-3 bg-navy-900/90 border border-navy-700 rounded-xl text-[10px] px-3 py-2 text-stone-400 pointer-events-none leading-snug"
          aria-hidden="true"
        >
          <div className="flex items-center gap-2">
            <svg width="22" height="6" viewBox="0 0 22 6" aria-hidden="true">
              <line
                x1="0" y1="3" x2="22" y2="3"
                stroke="#cbd5e1" strokeWidth="2.2"
                strokeDasharray="8 4" strokeLinecap="round"
              />
            </svg>
            <span>besucht</span>
          </div>
          <div className="flex items-center gap-2">
            <svg width="22" height="6" viewBox="0 0 22 6" aria-hidden="true">
              <line
                x1="0" y1="3" x2="22" y2="3"
                stroke="#cbd5e1" strokeWidth="1.2"
                strokeDasharray="1 6" strokeLinecap="round"
              />
            </svg>
            <span>noch offen</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="inline-block text-center"
              style={{ width: 22, color: "#eab308", fontSize: 14, lineHeight: 1 }}
            >
              ★
            </span>
            <span>fertig</span>
          </div>
          <div className="flex items-center gap-2">
            <svg width="22" height="10" viewBox="0 0 22 10" aria-hidden="true">
              <circle
                cx="11" cy="5" r="4"
                fill="none" stroke="#f59e0b" strokeWidth="1.5"
              />
            </svg>
            <span>hängt fest</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * memo()-wrapped because Mission Control re-renders every second (relative-
 * time tick). The map's inputs only change every 30 s (poll interval); shallow
 * comparison on `summaries` + `stations` skips 29 of every 30 parent renders.
 * Local hover/tap state still re-renders MissionMap normally — that's fine
 * (only ~50 SVG elements; no perf concern).
 */
export const MissionMap = memo(MissionMapInner);

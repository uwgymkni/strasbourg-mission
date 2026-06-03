/**
 * Countdown helpers — pure functions, no state, no I/O.
 *
 * Shared by the student banner (MissionBanner) and the admin control panel
 * (MissionCountdownAdmin) so both compute remaining time, colour tiers, and
 * the HH:MM:SS string identically.
 */

import type { MissionSettings } from "@/types/game";

export type CountdownTier =
  | "green"      // > 30 min
  | "yellow"     // 15–30 min
  | "red"        // < 15 min
  | "critical"   // < 5 min
  | "expired";   // <= 0

/**
 * Remaining milliseconds for the current settings, or null when no countdown
 * is configured. When paused, returns the frozen remaining value. May be
 * negative when a running countdown has elapsed — callers clamp for display.
 */
export function remainingMs(settings: MissionSettings, now: number): number | null {
  if (settings.countdownPaused) {
    return settings.pausedRemainingMs;
  }
  if (settings.countdownEndsAt === null) return null;
  return settings.countdownEndsAt - now;
}

/** True when there is something to count down (running or paused). */
export function hasCountdown(settings: MissionSettings): boolean {
  if (settings.countdownPaused) return settings.pausedRemainingMs !== null;
  return settings.countdownEndsAt !== null;
}

/** Formats milliseconds as HH:MM:SS, never negative. */
export function formatHMS(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/**
 * Colour/urgency tier for a remaining-ms value.
 *   <= 0      → expired
 *   < 5 min   → critical
 *   < 15 min  → red
 *   <= 30 min → yellow
 *   else      → green
 */
export function countdownTier(ms: number): CountdownTier {
  if (ms <= 0) return "expired";
  const minutes = ms / 60_000;
  if (minutes < 5) return "critical";
  if (minutes < 15) return "red";
  if (minutes <= 30) return "yellow";
  return "green";
}

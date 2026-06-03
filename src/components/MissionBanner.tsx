"use client";

import { useEffect, useState } from "react";
import { subscribeMissionSettings } from "@/services/game.service";
import {
  remainingMs,
  hasCountdown,
  formatHMS,
  countdownTier,
  type CountdownTier,
} from "@/lib/countdown";
import type { MissionSettings } from "@/types/game";

/**
 * Tailwind classes per tier. Literal strings (not interpolated) so the
 * compiler keeps them. critical + expired reuse the red palette.
 */
const TIER_CLASSES: Record<CountdownTier, string> = {
  green:    "bg-green-900/40 border-green-500 text-green-200",
  yellow:   "bg-yellow-900/40 border-yellow-500 text-yellow-200",
  red:      "bg-red-900/40 border-red-500 text-red-200",
  critical: "bg-red-900/40 border-red-500 text-red-200",
  expired:  "bg-red-900/40 border-red-500 text-red-200",
};

/**
 * Student-facing broadcast banner: shared countdown + optional admin message.
 * Mounted once in the (game) layout so it appears on dashboard, mission,
 * reward and final screens — never on the login screens (separate layout).
 *
 * Reads the settings doc via an onSnapshot subscription (push, no polling).
 * A local 1-second tick re-renders the displayed time; Firestore is never
 * written from here. Renders nothing when there is neither a countdown nor a
 * message, so it adds zero visual footprint when idle.
 */
export function MissionBanner() {
  const [settings, setSettings] = useState<MissionSettings | null>(null);
  // Current time as state, advanced once per second — a pure render read,
  // and the sole driver that keeps the displayed countdown live.
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    // onSnapshot push subscription — not a polling interval.
    const unsub = subscribeMissionSettings(setSettings);
    return unsub;
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, []);

  if (!settings) return null;

  const countdownActive = hasCountdown(settings);
  const announcement = settings.announcement.trim();

  // Nothing to show → render nothing (no layout impact).
  if (!countdownActive && !announcement) return null;

  let timerNode: React.ReactNode = null;
  if (countdownActive) {
    const ms = remainingMs(settings, now) ?? 0;
    const tier = countdownTier(ms);
    const classes = TIER_CLASSES[tier];

    timerNode = (
      <div
        className={`rounded-xl border px-4 py-2.5 ${classes}`}
        role="timer"
        aria-live="off"
      >
        {tier === "expired" ? (
          <p className="text-sm font-semibold tabular-nums">⏰ Zeit abgelaufen</p>
        ) : (
          <>
            <p className="text-sm font-semibold tabular-nums">
              ⏱ Noch {formatHMS(ms)}
              {settings.countdownPaused && (
                <span className="ml-2 font-normal opacity-80">(pausiert)</span>
              )}
            </p>
            {tier === "critical" && (
              <p className="text-xs mt-1 font-medium">
                ⚠ Rückkehr zum Treffpunkt vorbereiten
              </p>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="sticky top-0 z-30 -mx-4 px-4 pt-2 pb-2 bg-navy-950/95 backdrop-blur-sm space-y-2">
      {timerNode}
      {announcement && (
        <div className="rounded-xl border border-gold-500/40 bg-gold-500/10 px-4 py-2.5">
          <p className="text-sm text-gold-200 whitespace-pre-line leading-relaxed">
            📢 {announcement}
          </p>
        </div>
      )}
    </div>
  );
}

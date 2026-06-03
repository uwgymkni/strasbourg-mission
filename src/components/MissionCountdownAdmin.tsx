"use client";

import { useEffect, useRef, useState } from "react";
import {
  subscribeMissionSettings,
  updateMissionSettings,
} from "@/services/game.service";
import {
  remainingMs,
  hasCountdown,
  formatHMS,
  countdownTier,
} from "@/lib/countdown";
import type { MissionSettings } from "@/types/game";

const HOUR_MS = 60 * 60 * 1000;

/** Parse "HH:MM" into today's absolute UNIX ms, or null if malformed. */
function parseReturnTime(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  const d = new Date();
  d.setHours(h, min, 0, 0);
  return d.getTime();
}

/**
 * Admin countdown + announcement panel for Mission Control. Self-contained:
 * owns its own onSnapshot subscription and 1-second display tick, so it never
 * routes countdown state through the page and therefore never affects the
 * memoised MissionMap. The only writer of settings/mission.
 */
export function MissionCountdownAdmin() {
  const [settings, setSettings] = useState<MissionSettings | null>(null);
  // Current time as state, ticked once per second — pure render read that
  // keeps the displayed timer live without calling Date.now() during render.
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);

  // Local drafts (not written until the teacher confirms).
  const [announcementDraft, setAnnouncementDraft] = useState("");
  const [returnTimeDraft, setReturnTimeDraft] = useState("");
  // True once the teacher edits the textarea — stops snapshot syncs from
  // overwriting an in-progress edit. Mirrored into a ref so the (once-created)
  // snapshot callback always reads the latest value without re-subscribing.
  const [announcementDirty, setAnnouncementDirty] = useState(false);
  const announcementDirtyRef = useRef(announcementDirty);
  useEffect(() => {
    announcementDirtyRef.current = announcementDirty;
  }, [announcementDirty]);

  useEffect(() => {
    const unsub = subscribeMissionSettings((s) => {
      setSettings(s);
      // Only adopt the remote announcement when the teacher isn't mid-edit.
      if (!announcementDirtyRef.current) {
        setAnnouncementDraft(s.announcement);
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, []);

  async function apply(patch: Partial<Omit<MissionSettings, "updatedAt">>) {
    setBusy(true);
    await updateMissionSettings(patch);
    setBusy(false);
  }

  function handleStart(hours: number) {
    void apply({
      countdownEndsAt: Date.now() + hours * HOUR_MS,
      countdownPaused: false,
      pausedRemainingMs: null,
    });
  }

  function handlePause() {
    if (!settings || settings.countdownEndsAt === null || settings.countdownPaused) {
      return;
    }
    void apply({
      countdownPaused: true,
      pausedRemainingMs: settings.countdownEndsAt - Date.now(),
    });
  }

  function handleResume() {
    if (!settings || !settings.countdownPaused || settings.pausedRemainingMs === null) {
      return;
    }
    void apply({
      countdownEndsAt: Date.now() + settings.pausedRemainingMs,
      countdownPaused: false,
      pausedRemainingMs: null,
    });
  }

  function handleReset() {
    void apply({
      countdownEndsAt: null,
      countdownPaused: false,
      pausedRemainingMs: null,
    });
  }

  function handleApplyReturnTime() {
    const ts = parseReturnTime(returnTimeDraft);
    if (ts === null) return;
    void apply({
      countdownEndsAt: ts,
      countdownPaused: false,
      pausedRemainingMs: null,
    });
  }

  function handleSaveAnnouncement() {
    void apply({ announcement: announcementDraft.trim() });
    setAnnouncementDirty(false);
  }

  function handleClearAnnouncement() {
    setAnnouncementDraft("");
    setAnnouncementDirty(false);
    void apply({ announcement: "" });
  }

  // ── Derived display ─────────────────────────────────────────────────
  const ms = settings ? remainingMs(settings, now) : null;
  const active = settings ? hasCountdown(settings) : false;
  const tier = ms !== null ? countdownTier(ms) : null;

  const timerColor =
    tier === "green"
      ? "text-green-400"
      : tier === "yellow"
        ? "text-yellow-400"
        : tier === "red" || tier === "critical" || tier === "expired"
          ? "text-red-400"
          : "text-stone-500";

  const btn =
    "px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors disabled:opacity-50";

  return (
    <div className="bg-navy-800 border border-navy-700 rounded-2xl p-5 mb-6">
      <p className="text-gold-600 text-xs font-medium tracking-widest uppercase mb-3">
        Countdown
      </p>

      {/* Timer display */}
      <div className="mb-4">
        <p className="text-stone-500 text-xs uppercase tracking-widest mb-1">
          Mission Timer
        </p>
        <p className={`text-3xl font-semibold tabular-nums ${timerColor}`}>
          {!active
            ? "—"
            : tier === "expired"
              ? "Zeit abgelaufen"
              : formatHMS(ms ?? 0)}
          {settings?.countdownPaused && active && tier !== "expired" && (
            <span className="ml-3 text-sm font-normal text-stone-400 align-middle">
              pausiert
            </span>
          )}
        </p>
      </div>

      {/* Countdown controls */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          type="button"
          onClick={() => handleStart(2)}
          disabled={busy}
          className={`${btn} text-gold-400 border-gold-500/40 hover:bg-gold-500/10`}
        >
          Start 2h
        </button>
        <button
          type="button"
          onClick={() => handleStart(3)}
          disabled={busy}
          className={`${btn} text-gold-400 border-gold-500/40 hover:bg-gold-500/10`}
        >
          Start 3h
        </button>
        <button
          type="button"
          onClick={handlePause}
          disabled={busy || !active || settings?.countdownPaused}
          className={`${btn} text-stone-300 border-navy-600 hover:bg-navy-700/50`}
        >
          Pause
        </button>
        <button
          type="button"
          onClick={handleResume}
          disabled={busy || !settings?.countdownPaused}
          className={`${btn} text-stone-300 border-navy-600 hover:bg-navy-700/50`}
        >
          Fortsetzen
        </button>
        <button
          type="button"
          onClick={handleReset}
          disabled={busy || !active}
          className={`${btn} text-red-400 border-red-500/30 hover:bg-red-500/10`}
        >
          Zurücksetzen
        </button>
      </div>

      {/* Return time */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <label className="text-sm text-stone-400">Rückkehrzeit:</label>
        <input
          type="time"
          value={returnTimeDraft}
          onChange={(e) => setReturnTimeDraft(e.target.value)}
          className="px-3 py-1.5 rounded-lg bg-navy-900 border border-navy-600 text-cream text-sm focus:outline-none focus:ring-2 focus:ring-gold-500"
        />
        <button
          type="button"
          onClick={handleApplyReturnTime}
          disabled={busy || !returnTimeDraft}
          className={`${btn} text-gold-400 border-gold-500/40 hover:bg-gold-500/10`}
        >
          Übernehmen
        </button>
      </div>

      {/* Announcement */}
      <div className="border-t border-navy-700/50 pt-4">
        <label className="text-stone-500 text-xs uppercase tracking-widest mb-2 block">
          Nachricht an alle Teams
        </label>
        <textarea
          value={announcementDraft}
          onChange={(e) => {
            setAnnouncementDraft(e.target.value);
            setAnnouncementDirty(true);
          }}
          rows={2}
          placeholder="z. B. Treffpunkt Münsterplatz um 15:30"
          className="w-full px-3 py-2 rounded-lg bg-navy-900 border border-navy-600 text-cream text-sm placeholder:text-stone-600 focus:outline-none focus:ring-2 focus:ring-gold-500 resize-y"
        />
        <div className="flex gap-2 mt-2">
          <button
            type="button"
            onClick={handleSaveAnnouncement}
            disabled={busy}
            className={`${btn} text-gold-400 border-gold-500/40 hover:bg-gold-500/10`}
          >
            Speichern
          </button>
          <button
            type="button"
            onClick={handleClearAnnouncement}
            disabled={busy || (!announcementDraft && !settings?.announcement)}
            className={`${btn} text-red-400 border-red-500/30 hover:bg-red-500/10`}
          >
            Löschen
          </button>
        </div>
      </div>
    </div>
  );
}

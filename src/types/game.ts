export type StationStatus = "locked" | "active" | "completed" | "skipped";

export type ChallengeType = "text" | "qr" | "multiple-choice";

export interface Station {
  id: string;
  order: number; // 1-based, used by unlockNextStation
  title: string;
  locationHint: string;
  challengeType: ChallengeType;
  observationQuestion: string;
  acceptedAnswers: string[];
  photoChallenge: string;
  knowledgeText: string;
  rewardLetter: string; // single letter; all 6 letters spell the final answer
  rewardNumber: number; // 1-based position of this letter in the final answer
  // Navigation — optional so old Firestore docs without these fields still normalise cleanly
  latitude?: number;
  longitude?: number;
  mapsUrl?: string; // pre-built Google Maps deep-link: opens app on mobile, browser on desktop
}

// Firestore document shape — used by services layer
export interface TeamProgress {
  teamId: string;
  progress: Record<string, StationStatus>; // stationId → status
  currentStationId: string | null;
  startedAt: number; // Unix ms
  finishedAt?: number;
  finalAnswer: string | null; // null until the team submits the final cipher
  members?: string[];          // team member names, saved on /team-members page
  wrongAnswers?: Record<string, number>; // wrong attempt count per stationId
  photos?: Record<string, string>;       // stationId → Firebase Storage download URL
  answers?: Record<string, string>;          // stationId → the correct answer the student typed
  lastWrongAnswer?: Record<string, string>;  // stationId → most recent wrong submission
  sessionId?: string;                        // active session marker — soft multi-device detection
  lastSeenAt?: number;                       // UNIX ms of last loadGame() heartbeat by the holding session
}

/**
 * Global mission settings — a single Firestore doc (settings/mission) shared by
 * every device. The admin (Mission Control) is the only writer; student devices
 * subscribe read-only. The countdown runs purely client-side off countdownEndsAt,
 * so Firestore is written only on admin actions, never per second.
 */
export interface MissionSettings {
  /** Absolute UNIX ms when the countdown hits zero. null = no countdown set. */
  countdownEndsAt: number | null;
  /** True while paused — the live ticking is frozen. */
  countdownPaused: boolean;
  /** Remaining ms captured at pause time; null when not paused. */
  pausedRemainingMs: number | null;
  /** Broadcast message shown to all teams. Empty string = no announcement. */
  announcement: string;
  /** UNIX ms of the last admin write — bookkeeping only. */
  updatedAt: number;
}

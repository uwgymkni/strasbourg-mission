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
}

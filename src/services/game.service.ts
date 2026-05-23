import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { getDb, COLLECTIONS } from "@/lib/firebase";
import { ok, err, type ServiceResult } from "@/lib/result";
import type { Station, StationStatus, TeamProgress, ChallengeType } from "@/types/game";

// ---------------------------------------------------------------------------
// Normalization helpers
// ---------------------------------------------------------------------------

const VALID_STATUSES = new Set<string>(["locked", "active", "completed", "skipped"]);
const VALID_CHALLENGE_TYPES = new Set<string>(["text", "qr", "multiple-choice"]);

function isValidStatus(v: unknown): v is StationStatus {
  return typeof v === "string" && VALID_STATUSES.has(v);
}

function isValidChallengeType(v: unknown): v is ChallengeType {
  return typeof v === "string" && VALID_CHALLENGE_TYPES.has(v);
}

function toMs(value: unknown): number {
  if (typeof value === "number") return value;
  if (value && typeof (value as { toMillis?: unknown }).toMillis === "function") {
    return (value as { toMillis: () => number }).toMillis();
  }
  return Date.now();
}

function normalizeStation(id: string, data: Record<string, unknown>): Station {
  return {
    id,
    order: typeof data.order === "number" ? data.order : 0,
    title: typeof data.title === "string" && data.title ? data.title : "Untitled Station",
    locationHint: typeof data.locationHint === "string" ? data.locationHint : "",
    challengeType: isValidChallengeType(data.challengeType) ? data.challengeType : "text",
    observationQuestion: typeof data.observationQuestion === "string" ? data.observationQuestion : "",
    acceptedAnswers: Array.isArray(data.acceptedAnswers)
      ? (data.acceptedAnswers as unknown[]).filter((a): a is string => typeof a === "string")
      : [],
    photoChallenge: typeof data.photoChallenge === "string" ? data.photoChallenge : "",
    knowledgeText: typeof data.knowledgeText === "string" ? data.knowledgeText : "",
    rewardLetter: typeof data.rewardLetter === "string" ? data.rewardLetter : "",
    rewardNumber: typeof data.rewardNumber === "number" ? data.rewardNumber : 0,
  };
}

function normalizeProgressMap(
  raw: unknown
): Record<string, StationStatus> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};

  return Object.fromEntries(
    Object.entries(raw as Record<string, unknown>)
      .filter(([, v]) => isValidStatus(v))
      .map(([k, v]) => [k, v as StationStatus])
  );
}

function normalizeTeamProgress(
  teamId: string,
  data: Record<string, unknown>
): TeamProgress {
  return {
    teamId,
    progress: normalizeProgressMap(data.progress),
    currentStationId:
      typeof data.currentStationId === "string" ? data.currentStationId : null,
    // Use 0 (not Date.now()) for null/missing so admin can distinguish "never started"
    startedAt: typeof data.startedAt === "number" ? data.startedAt : 0,
    ...(data.finishedAt !== undefined && { finishedAt: toMs(data.finishedAt) }),
    finalAnswer: typeof data.finalAnswer === "string" ? data.finalAnswer : null,
    wrongAnswers:
      data.wrongAnswers &&
      typeof data.wrongAnswers === "object" &&
      !Array.isArray(data.wrongAnswers)
        ? Object.fromEntries(
            Object.entries(data.wrongAnswers as Record<string, unknown>)
              .filter(([, v]) => typeof v === "number")
              .map(([k, v]) => [k, v as number])
          )
        : {},
  };
}

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

/** Fetches all stations ordered by their sequence number. */
export async function fetchStations(): Promise<ServiceResult<Station[]>> {
  try {
    const snap = await getDocs(
      query(collection(getDb(), COLLECTIONS.STATIONS), orderBy("order"))
    );

    const stations = snap.docs.map((d) =>
      normalizeStation(d.id, d.data() as Record<string, unknown>)
    );

    return ok(stations);
  } catch (error) {
    return err(error);
  }
}

/** Fetches all progress documents — used by the admin dashboard. */
export async function fetchAllProgress(): Promise<ServiceResult<TeamProgress[]>> {
  try {
    const snap = await getDocs(collection(getDb(), COLLECTIONS.PROGRESS));
    const list = snap.docs.map((d) =>
      normalizeTeamProgress(d.id, d.data() as Record<string, unknown>)
    );
    return ok(list);
  } catch (error) {
    return err(error);
  }
}

/** Fetches the current progress document for a team. Returns null data if none exists yet. */
export async function fetchTeamProgress(
  teamId: string
): Promise<ServiceResult<TeamProgress | null>> {
  try {
    const snap = await getDoc(doc(getDb(), COLLECTIONS.PROGRESS, teamId));

    if (!snap.exists()) return ok(null);

    return ok(
      normalizeTeamProgress(teamId, snap.data() as Record<string, unknown>)
    );
  } catch (error) {
    return err(error);
  }
}

/**
 * Marks a single station as completed in Firestore.
 * Uses dot notation to update only that station's status — avoids overwriting other fields.
 * Assumes the progress document already exists (created when the game starts).
 */
export async function persistStationCompletion(
  teamId: string,
  stationId: string
): Promise<ServiceResult<void>> {
  try {
    await updateDoc(doc(getDb(), COLLECTIONS.PROGRESS, teamId), {
      [`progress.${stationId}`]: "completed" satisfies StationStatus,
    });
    return ok(undefined);
  } catch (error) {
    return err(error);
  }
}

/**
 * Marks a single station as skipped in Firestore and records the wrong-answer count.
 * Uses dot notation to avoid overwriting unrelated fields.
 * Idempotent — safe to retry after a network error.
 */
export async function persistStationSkip(
  teamId: string,
  stationId: string,
  wrongCount: number
): Promise<ServiceResult<void>> {
  try {
    await updateDoc(doc(getDb(), COLLECTIONS.PROGRESS, teamId), {
      [`progress.${stationId}`]: "skipped" satisfies StationStatus,
      [`wrongAnswers.${stationId}`]: wrongCount,
    });
    return ok(undefined);
  } catch (error) {
    return err(error);
  }
}

/**
 * Writes the full progress state for a team.
 * Used on game init and for admin corrections. Merges to avoid clobbering sibling fields.
 */
export async function persistProgress(
  teamId: string,
  progress: TeamProgress
): Promise<ServiceResult<void>> {
  try {
    await setDoc(
      doc(getDb(), COLLECTIONS.PROGRESS, teamId),
      {
        teamId: progress.teamId,
        progress: progress.progress,
        currentStationId: progress.currentStationId,
        startedAt: progress.startedAt,
      },
      { merge: true }
    );
    return ok(undefined);
  } catch (error) {
    return err(error);
  }
}

/**
 * Saves team member names into the progress document.
 * Called from the /team-members page before navigating to /dashboard.
 */
export async function saveTeamMembers(
  teamId: string,
  members: string[]
): Promise<ServiceResult<void>> {
  try {
    await updateDoc(doc(getDb(), COLLECTIONS.PROGRESS, teamId), {
      members,
    });
    return ok(undefined);
  } catch (error) {
    return err(error);
  }
}

/** Records the team's final answer and timestamps their finish. */
export async function submitFinalSolution(
  teamId: string,
  answer: string
): Promise<ServiceResult<void>> {
  try {
    await updateDoc(doc(getDb(), COLLECTIONS.PROGRESS, teamId), {
      finalAnswer: answer.trim(),
      finishedAt: Date.now(),
    });
    return ok(undefined);
  } catch (error) {
    return err(error);
  }
}

/**
 * Resets a team's progress to a clean initial state.
 * Preserves the document (for audit history) but wipes all progress fields.
 * Admin-facing — hooks should guard this behind a role check.
 */
export async function resetTeamProgress(
  teamId: string
): Promise<ServiceResult<void>> {
  try {
    await setDoc(
      doc(getDb(), COLLECTIONS.PROGRESS, teamId),
      {
        teamId,
        progress: {},
        currentStationId: null,
        startedAt: Date.now(),
        finishedAt: null,
        finalAnswer: null,
        wrongAnswers: {},
        resetAt: Date.now(),
      },
      { merge: false } // Full overwrite — this is intentional for a hard reset
    );
    return ok(undefined);
  } catch (error) {
    return err(error);
  }
}

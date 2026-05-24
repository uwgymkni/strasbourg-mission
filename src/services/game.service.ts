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
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  listAll,
  deleteObject,
} from "firebase/storage";
import { getDb, getStorage, COLLECTIONS } from "@/lib/firebase";
import { ok, err, type ServiceResult } from "@/lib/result";
import type { Station, StationStatus, TeamProgress, ChallengeType } from "@/types/game";
import { TEAM_CONFIGS } from "@/constants/routes";

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
    // Navigation (optional — omit entirely when absent so the field stays undefined)
    ...(typeof data.latitude === "number" && { latitude: data.latitude }),
    ...(typeof data.longitude === "number" && { longitude: data.longitude }),
    ...(typeof data.mapsUrl === "string" && data.mapsUrl && { mapsUrl: data.mapsUrl }),
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
    members: Array.isArray(data.members)
      ? (data.members as unknown[]).filter((m): m is string => typeof m === "string")
      : undefined,
    photos:
      data.photos &&
      typeof data.photos === "object" &&
      !Array.isArray(data.photos)
        ? Object.fromEntries(
            Object.entries(data.photos as Record<string, unknown>)
              .filter(([, v]) => typeof v === "string")
              .map(([k, v]) => [k, v as string])
          )
        : {},
    answers:
      data.answers &&
      typeof data.answers === "object" &&
      !Array.isArray(data.answers)
        ? Object.fromEntries(
            Object.entries(data.answers as Record<string, unknown>)
              .filter(([, v]) => typeof v === "string")
              .map(([k, v]) => [k, v as string])
          )
        : {},
    lastWrongAnswer:
      data.lastWrongAnswer &&
      typeof data.lastWrongAnswer === "object" &&
      !Array.isArray(data.lastWrongAnswer)
        ? Object.fromEntries(
            Object.entries(data.lastWrongAnswer as Record<string, unknown>)
              .filter(([, v]) => typeof v === "string")
              .map(([k, v]) => [k, v as string])
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

/**
 * A pre-reset archive snapshot — full TeamProgress data plus two metadata
 * fields written by archiveTeamProgress before each reset.
 */
export interface ArchiveSnapshot extends TeamProgress {
  id: string;          // Firestore doc-ID = String(archivedAt)
  archivedAt: number;
  archivedBy: string;
}

/**
 * Fetches every snapshot for a single team, sorted newest first.
 *
 * Reads archive/{teamId}/snapshots ordered by archivedAt desc. Uses an
 * implicit single-field index — Firestore creates and maintains it
 * automatically, no firestore.indexes.json entry needed.
 *
 * Returns an empty array when the team has no snapshots — never null,
 * never throws on emptiness. Only used by Mission Control on demand
 * (lazy-loaded), never by student-facing pages.
 */
export async function fetchTeamArchive(
  teamId: string
): Promise<ServiceResult<ArchiveSnapshot[]>> {
  try {
    const snapsCollection = collection(
      getDb(),
      COLLECTIONS.ARCHIVE,
      teamId,
      "snapshots"
    );
    const q = query(snapsCollection, orderBy("archivedAt", "desc"));
    const snap = await getDocs(q);

    const list: ArchiveSnapshot[] = snap.docs.map((d) => {
      const data = d.data() as Record<string, unknown>;
      // Reuse the same defensive parser that normalizes live progress docs,
      // then graft the three archive-specific fields on top.
      const base = normalizeTeamProgress(teamId, data);
      return {
        ...base,
        id: d.id,
        archivedAt:
          typeof data.archivedAt === "number" ? data.archivedAt : 0,
        archivedBy:
          typeof data.archivedBy === "string" ? data.archivedBy : "",
      };
    });

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
 * Marks a single station as completed in Firestore and activates the next one.
 *
 * Writing nextStationId + currentStationId in the same updateDoc ensures that
 * loadGame() on the dashboard always reads the fully-updated state from Firestore,
 * not a stale snapshot that is missing the next station's "active" status.
 *
 * nextStationId is null only for the last station — in that case only the
 * completion status is written (no next station to unlock).
 */
export async function persistStationCompletion(
  teamId: string,
  stationId: string,
  nextStationId: string | null,
  answer?: string
): Promise<ServiceResult<void>> {
  try {
    const update: Record<string, unknown> = {
      [`progress.${stationId}`]: "completed" satisfies StationStatus,
    };
    if (nextStationId) {
      update[`progress.${nextStationId}`] = "active" satisfies StationStatus;
      update.currentStationId = nextStationId;
    }
    // Persist the student's correct input alongside the status flip — single
    // atomic update. Field is optional so legacy callers without an answer
    // continue to work unchanged.
    if (typeof answer === "string" && answer.length > 0) {
      update[`answers.${stationId}`] = answer;
    }
    await updateDoc(doc(getDb(), COLLECTIONS.PROGRESS, teamId), update);
    return ok(undefined);
  } catch (error) {
    return err(error);
  }
}

/**
 * Marks a single station as skipped in Firestore, records the wrong-answer count,
 * and activates the next station — all in a single atomic updateDoc call.
 *
 * Writing nextStationId + currentStationId in the same update ensures that
 * loadGame() on the dashboard always reads the fully-updated state from Firestore,
 * not a stale snapshot missing the next station's "active" status.
 *
 * nextStationId is null only for the last station — in that case only the
 * skip status and wrong-answer count are written (no next station to unlock).
 * Idempotent — safe to retry after a network error.
 */
export async function persistStationSkip(
  teamId: string,
  stationId: string,
  wrongCount: number,
  nextStationId: string | null
): Promise<ServiceResult<void>> {
  try {
    const update: Record<string, unknown> = {
      [`progress.${stationId}`]: "skipped" satisfies StationStatus,
      [`wrongAnswers.${stationId}`]: wrongCount,
    };
    if (nextStationId) {
      update[`progress.${nextStationId}`] = "active" satisfies StationStatus;
      update.currentStationId = nextStationId;
    }
    await updateDoc(doc(getDb(), COLLECTIONS.PROGRESS, teamId), update);
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
 * Writes a snapshot of the team's current progress document into
 * archive/{teamId}/snapshots/{timestamp} before any destructive reset
 * touches it. Adds two metadata fields and persists every other field
 * verbatim — so future field additions on TeamProgress are automatically
 * captured without changing this helper.
 *
 * Never used by the student- or teacher-facing pages. Only called from
 * resetTeamProgress as a best-effort safety net.
 */
async function archiveTeamProgress(
  teamId: string,
  source: Record<string, unknown>
): Promise<void> {
  const archivedAt = Date.now();
  const archiveDoc = doc(
    getDb(),
    COLLECTIONS.ARCHIVE,
    teamId,
    "snapshots",
    String(archivedAt)
  );
  await setDoc(archiveDoc, {
    ...source,
    archivedAt,
    archivedBy: "mission-control",
  });
}

/**
 * Best-effort cleanup of a team's photos in Firebase Storage.
 * Lists everything under progress/{teamId}/ and deletes each object in
 * parallel. Idempotent: an empty prefix yields items: [] and the function
 * resolves immediately. Per-file errors (e.g. object-not-found in a race
 * with another delete) are caught individually so one bad file never
 * stops the rest. Any outer error (listAll failure, network outage) is
 * swallowed by the caller so the Firestore reset always runs.
 */
async function deleteTeamPhotos(teamId: string): Promise<void> {
  const folderRef = storageRef(getStorage(), `progress/${teamId}`);
  const listing = await listAll(folderRef);
  await Promise.all(
    listing.items.map((itemRef) =>
      deleteObject(itemRef).catch((e: unknown) => {
        const code = (e as { code?: string })?.code;
        if (code === "storage/object-not-found") return; // already gone — fine
        // Other per-file failures: log and continue with the rest.
        console.warn(
          `[reset] failed to delete ${itemRef.fullPath}:`,
          e
        );
      })
    )
  );
}

/**
 * Resets a team's progress to a clean initial state:
 *   - Snapshot of the existing doc written to archive/{teamId}/snapshots/{ts}
 *     before any destructive write (best-effort — never blocks the reset)
 *   - Storage folder progress/{teamId}/ wiped (best-effort, non-blocking)
 *   - station-1 → "active", all others → "locked"
 *   - currentStationId = first station by order
 *   - startedAt = 0 (not yet started)
 *   - wrongAnswers, finalAnswer, finishedAt cleared
 *   - members preserved (read from existing doc before overwrite)
 *
 * Fetches the stations collection to build a correct progress map so the
 * dashboard shows station-1 as active immediately after reset.
 */
export async function resetTeamProgress(
  teamId: string
): Promise<ServiceResult<void>> {
  try {
    // 0a. Read the existing progress doc once — both for the archive snapshot
    //     AND to preserve team members below. Single read serves both purposes.
    const existingSnap = await getDoc(doc(getDb(), COLLECTIONS.PROGRESS, teamId));
    const existingData = existingSnap.exists()
      ? (existingSnap.data() as Record<string, unknown>)
      : null;

    // 0b. Best-effort archive of the pre-reset state. Skipped silently if no
    //     prior doc exists (fresh team). A failure here logs and continues —
    //     the primary reset action is more important than the safety net.
    if (existingData) {
      await archiveTeamProgress(teamId, existingData).catch((e: unknown) => {
        console.warn(`[reset] archive for ${teamId} failed:`, e);
      });
    }

    // 0c. Best-effort photo cleanup BEFORE the Firestore reset.
    //     Swallowed catch ensures a Storage failure never blocks Firestore.
    //     Mission Control gracefully degrades: after the Firestore reset
    //     the photos map is gone, so orphan files (if any) stay invisible.
    await deleteTeamPhotos(teamId).catch((e: unknown) => {
      console.warn(`[reset] Storage cleanup for ${teamId} failed:`, e);
    });

    // 1. Fetch ordered station IDs to build the initial progress map.
    const stationsSnap = await getDocs(
      query(collection(getDb(), COLLECTIONS.STATIONS), orderBy("order"))
    );
    const stationIds = stationsSnap.docs.map((d) => d.id);

    if (stationIds.length === 0) {
      return err(new Error("Keine Stationen gefunden — Reset abgebrochen."));
    }

    // 2. Rotate station IDs by the team's original routeOffset — same logic as
    //    the seed script — so each team lands back on its designated start station.
    const teamConfig = TEAM_CONFIGS.find((t) => t.teamCode === teamId);
    const offset = teamConfig?.routeOffset ?? 0;
    const rotated = [
      ...stationIds.slice(offset),
      ...stationIds.slice(0, offset),
    ];

    // 3. Preserve team members — reuse the read from step 0a.
    const members = Array.isArray(existingData?.members)
      ? (existingData!.members as unknown[]).filter(
          (m): m is string => typeof m === "string"
        )
      : [];

    // 4. Build progress map: first in rotated order → active, rest → locked.
    const progress: Record<string, string> = {};
    rotated.forEach((id, idx) => {
      progress[id] = idx === 0 ? "active" : "locked";
    });

    // 4. Full overwrite — merge: false ensures no stale fields survive.
    await setDoc(
      doc(getDb(), COLLECTIONS.PROGRESS, teamId),
      {
        teamId,
        progress,
        currentStationId: rotated[0],
        startedAt: 0,        // 0 = not yet started (distinct from Date.now())
        finishedAt: null,
        finalAnswer: null,
        wrongAnswers: {},
        members,             // restored from pre-reset snapshot
        resetAt: Date.now(),
      },
      { merge: false }
    );
    return ok(undefined);
  } catch (error) {
    return err(error);
  }
}

/**
 * Persists a wrong-answer attempt to Firestore — writes both the new count
 * and the raw text the student typed. Called on every wrong submission so
 * Mission Control can show in-flight struggles, not only post-skip data.
 *
 * Both fields use dot-notation updates and are idempotent under retry.
 */
export async function persistWrongAnswer(
  teamId: string,
  stationId: string,
  answer: string,
  count: number
): Promise<ServiceResult<void>> {
  try {
    await updateDoc(doc(getDb(), COLLECTIONS.PROGRESS, teamId), {
      [`wrongAnswers.${stationId}`]: count,
      [`lastWrongAnswer.${stationId}`]: answer,
    });
    return ok(undefined);
  } catch (error) {
    return err(error);
  }
}

/**
 * Uploads a station photo to Firebase Storage and persists the download URL
 * into the team's progress document.
 *
 * Path convention: progress/{teamId}/{stationId}.jpg — overwriting any prior
 * photo at the same path. Caller is responsible for client-side resizing
 * before invocation (see src/lib/image.ts).
 *
 * Returns the download URL on success. The blob is uploaded as image/jpeg.
 */
export async function uploadStationPhoto(
  teamId: string,
  stationId: string,
  blob: Blob
): Promise<ServiceResult<string>> {
  try {
    const path = `progress/${teamId}/${stationId}.jpg`;
    const ref = storageRef(getStorage(), path);

    await uploadBytes(ref, blob, { contentType: "image/jpeg" });
    const url = await getDownloadURL(ref);

    await updateDoc(doc(getDb(), COLLECTIONS.PROGRESS, teamId), {
      [`photos.${stationId}`]: url,
    });

    return ok(url);
  } catch (error) {
    return err(error);
  }
}

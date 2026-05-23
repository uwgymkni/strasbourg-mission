import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { getDb, COLLECTIONS } from "@/lib/firebase";
import { ok, err, type ServiceResult } from "@/lib/result";
import type { AppUser, UserRole } from "@/types/user";

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

function toMs(value: unknown): number {
  if (typeof value === "number") return value;
  if (value && typeof (value as { toMillis?: unknown }).toMillis === "function") {
    return (value as { toMillis: () => number }).toMillis();
  }
  return Date.now();
}

function normalizeTeamDoc(id: string, data: Record<string, unknown>): AppUser {
  return {
    uid: id,
    teamName: typeof data.teamName === "string" && data.teamName ? data.teamName : "Unknown Team",
    teamCode: typeof data.teamCode === "string" && data.teamCode ? data.teamCode : id,
    role: (data.role === "admin" ? "admin" : "student") as UserRole,
    createdAt: toMs(data.createdAt),
  };
}

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

/**
 * Validates a group code against Firestore and returns the matching team.
 * Teams use their code as the Firestore document ID for O(1) lookup.
 */
export async function loginWithGroupCode(
  code: string
): Promise<ServiceResult<AppUser>> {
  try {
    const normalized = code.trim().toLowerCase();
    if (!normalized) {
      return { success: false, error: "Team code cannot be empty." };
    }

    const snap = await getDoc(doc(getDb(), COLLECTIONS.TEAMS, normalized));

    if (!snap.exists()) {
      return { success: false, error: "Team code not found. Check the code and try again." };
    }

    return ok(normalizeTeamDoc(snap.id, snap.data() as Record<string, unknown>));
  } catch (error) {
    return err(error);
  }
}

/**
 * Fetches a team document by its code.
 * Used to refresh user data without re-entering the code.
 */
export async function getTeamByCode(code: string): Promise<ServiceResult<AppUser>> {
  return loginWithGroupCode(code);
}

/** Fetches all team documents — used by the admin dashboard. */
export async function fetchAllTeams(): Promise<ServiceResult<AppUser[]>> {
  try {
    const snap = await getDocs(collection(getDb(), COLLECTIONS.TEAMS));
    const teams = snap.docs.map((d) =>
      normalizeTeamDoc(d.id, d.data() as Record<string, unknown>)
    );
    return ok(teams);
  } catch (error) {
    return err(error);
  }
}

/**
 * Logout is stateless at the service layer (no Firebase Auth session to end).
 * The hook is responsible for clearing the Zustand store after calling this.
 */
export async function logout(): Promise<ServiceResult<void>> {
  return ok(undefined);
}

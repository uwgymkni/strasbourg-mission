import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  initializeFirestore,
  getFirestore,
  type Firestore,
} from "firebase/firestore";
import { getStorage as fbGetStorage, type FirebaseStorage } from "firebase/storage";

function assertEnv(): void {
  // Must use dot notation — Next.js only statically inlines process.env.NEXT_PUBLIC_*
  // references at build time. Bracket notation (process.env[key]) is NOT replaced and
  // returns undefined in the browser bundle even when the vars are set.
  const missing: string[] = [];
  if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY) missing.push("NEXT_PUBLIC_FIREBASE_API_KEY");
  if (!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) missing.push("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
  if (missing.length === 0) return;

  throw new Error(
    `[strasbourg-mission] Firebase is not configured.\n` +
      `Missing environment variables: ${missing.join(", ")}\n\n` +
      `Quick fix:\n` +
      `  cp .env.example .env.local\n` +
      `  # then fill in your Firebase project credentials\n\n` +
      `Get credentials at: https://console.firebase.google.com → Project settings → Your apps`
  );
}

function createApp(): FirebaseApp {
  assertEnv();
  // Guard against double-initialization (Next.js hot reload, module re-evaluation)
  if (getApps().length > 0) return getApps()[0]!;

  if (process.env.NODE_ENV === "development") {
    console.debug(`[firebase] connecting to project: ${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}`);
  }

  return initializeApp({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  });
}

let _db: Firestore | null = null;
let _storage: FirebaseStorage | null = null;

/**
 * Returns the Firestore instance. Initializes Firebase on first call.
 * Throws a descriptive error if required environment variables are missing.
 *
 * Uses initializeFirestore with experimentalForceLongPolling instead of plain
 * getFirestore. WHY: the default WebChannel streaming transport (and even the
 * default auto-detect-long-polling probe, which is on since SDK v9.22) fails to
 * deliver real-time onSnapshot pushes on Safari — the initial fetch on page
 * load works, but subsequent server-side changes never arrive, so the live
 * quiz never updates without a manual reload. Forcing long-polling bypasses the
 * broken streaming path and delivers snapshots reliably on Safari, Chrome and
 * behind proxies alike. Payloads here are tiny (a single state doc + scores),
 * so the minor long-polling overhead is irrelevant.
 */
export function getDb(): Firestore {
  if (_db) return _db;
  const app = createApp();
  try {
    _db = initializeFirestore(app, { experimentalForceLongPolling: true });
  } catch {
    // Firestore was already started for this app (e.g. dev hot-reload
    // re-evaluated this module). Reuse the existing instance.
    _db = getFirestore(app);
  }
  return _db;
}

/**
 * Returns the Firebase Storage instance. Initializes Firebase on first call.
 * Uses NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET from the app config.
 */
export function getStorage(): FirebaseStorage {
  if (!_storage) _storage = fbGetStorage(createApp());
  return _storage;
}

/** Firestore collection names — single source of truth to avoid string typos. */
export const COLLECTIONS = {
  TEAMS: "teams",
  STATIONS: "stations",
  PROGRESS: "progress",
  /** Pre-reset snapshots: archive/{teamId}/snapshots/{timestamp}. Never read by
   *  the student- or teacher-facing pages — kept for post-trip retrospection. */
  ARCHIVE: "archive",
  /** Global mission settings — a single doc settings/mission holding the
   *  shared countdown + announcement broadcast to every device. */
  SETTINGS: "settings",
  /** Real-time quiz — live state doc quiz/state. Single writer: Mission Control. */
  QUIZ: "quiz",
  /** Quiz answers — quizResponses/{nonce}__{index}/teams/{teamId}, create-only. */
  QUIZ_RESPONSES: "quizResponses",
  /** Cumulative per-team quiz scores — quizScores/{teamId}, written by admin. */
  QUIZ_SCORES: "quizScores",
} as const;

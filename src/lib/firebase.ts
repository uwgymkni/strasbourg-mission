import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";

// These two are the minimum Firestore requires.
// The remaining four are passed through — Firebase handles missing optionals gracefully.
const REQUIRED_ENV_VARS = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
] as const;

function assertEnv(): void {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
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

/**
 * Returns the Firestore instance. Initializes Firebase on first call.
 * Throws a descriptive error if required environment variables are missing.
 */
export function getDb(): Firestore {
  if (!_db) _db = getFirestore(createApp());
  return _db;
}

/** Firestore collection names — single source of truth to avoid string typos. */
export const COLLECTIONS = {
  TEAMS: "teams",
  STATIONS: "stations",
  PROGRESS: "progress",
} as const;

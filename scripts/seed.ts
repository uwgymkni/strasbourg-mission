/**
 * Seed script — populates Firestore with stations, teams, and initial progress docs.
 *
 * Prerequisites:
 *   1. Download a Firebase Admin service account key:
 *      Firebase Console → Project Settings → Service Accounts → Generate new private key
 *   2. Save it as serviceAccountKey.json in the project root (already in .gitignore)
 *   3. Add to .env.local:
 *        GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json
 *
 * Usage:
 *   npm run seed
 *
 * Idempotency:
 *   - Existing station and team docs are overwritten (content changes are safe to re-seed).
 *   - Existing progress docs are SKIPPED — never overwrite in-progress games.
 */

import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

// Validate credentials before importing Firebase Admin (its errors are cryptic)
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error("\n❌  GOOGLE_APPLICATION_CREDENTIALS is not set.\n");
  console.error("Steps to fix:");
  console.error(
    "  1. Firebase Console → Project Settings → Service Accounts → Generate new private key"
  );
  console.error("  2. Save the file as serviceAccountKey.json in the project root");
  console.error("  3. Add to .env.local:");
  console.error("       GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json\n");
  process.exit(1);
}

import { initializeApp, cert, applicationDefault, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { STATIONS } from "../src/constants/stations";
import { TEAM_CONFIGS } from "../src/constants/routes";

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

if (!getApps().length) {
  initializeApp({ credential: applicationDefault() });
}

const db = getFirestore();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rotateStations(offset: number) {
  const sorted = [...STATIONS].sort((a, b) => a.order - b.order);
  return [...sorted.slice(offset), ...sorted.slice(0, offset)];
}

// ---------------------------------------------------------------------------
// Seed functions
// ---------------------------------------------------------------------------

async function seedStations(): Promise<void> {
  console.log("\n📍 Seeding stations...");
  const batch = db.batch();

  for (const station of STATIONS) {
    const { id, ...fields } = station;
    const ref = db.collection("stations").doc(id);
    batch.set(ref, fields);
    console.log(`   ✓ station ${id}: ${station.title}`);
  }

  await batch.commit();
  console.log(`   → ${STATIONS.length} stations written.`);
}

async function seedTeams(): Promise<void> {
  console.log("\n👥 Seeding teams...");
  const batch = db.batch();

  for (const team of TEAM_CONFIGS) {
    const ref = db.collection("teams").doc(team.teamCode);
    batch.set(ref, {
      teamName: team.teamName,
      teamCode: team.teamCode,
      role: "student",
      createdAt: Date.now(),
    });
    console.log(`   ✓ team ${team.teamCode}: ${team.teamName} (offset ${team.routeOffset})`);
  }

  await batch.commit();
  console.log(`   → ${TEAM_CONFIGS.length} teams written.`);
}

async function seedProgress(): Promise<void> {
  console.log("\n🗺️  Seeding initial progress docs...");
  let written = 0;
  let skipped = 0;

  for (const team of TEAM_CONFIGS) {
    const ref = db.collection("progress").doc(team.teamCode);
    const snap = await ref.get();

    if (snap.exists) {
      console.log(`   ⚠️  progress/${team.teamCode} already exists — skipping`);
      skipped++;
      continue;
    }

    const rotated = rotateStations(team.routeOffset);
    const progress: Record<string, string> = {};

    rotated.forEach((station, index) => {
      progress[station.id] = index === 0 ? "active" : "locked";
    });

    await ref.set({
      teamId: team.teamCode,
      progress,
      currentStationId: rotated[0].id,
      startedAt: null,
      finishedAt: null,
      finalAnswer: null,
      resetAt: null,
    });

    const firstStation = rotated[0];
    console.log(
      `   ✓ progress/${team.teamCode}: starts at ${firstStation.id} (${firstStation.title})`
    );
    written++;
  }

  console.log(`   → ${written} written, ${skipped} skipped.`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function seed(): Promise<void> {
  console.log("🌱 Strasbourg Mission — seed script");
  console.log(`   Project: ${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "(inferred from credentials)"}`);
  console.log(`   Stations: ${STATIONS.length}`);
  console.log(`   Teams: ${TEAM_CONFIGS.length}`);

  await seedStations();
  await seedTeams();
  await seedProgress();

  console.log("\n✅ Seed complete.\n");
}

seed()
  .catch((error) => {
    console.error("\n❌ Seed failed:", error);
    process.exit(1);
  })
  .finally(() => process.exit(0));

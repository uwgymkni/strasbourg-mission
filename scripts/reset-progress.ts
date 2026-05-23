/**
 * Reset script — wipes all team progress back to initial rotated state.
 *
 * Prerequisites: same as seed.ts (GOOGLE_APPLICATION_CREDENTIALS in .env.local)
 *
 * Usage:
 *   npm run reset:progress
 *
 * Safety:
 *   1. Prints current state of every progress doc before asking.
 *   2. Requires typing "YES" (case-sensitive) to proceed.
 *   3. Uses a single batch write — atomic, no partial resets.
 */

import dotenv from "dotenv";
import path from "path";
import readline from "readline";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error("\n❌  GOOGLE_APPLICATION_CREDENTIALS is not set.\n");
  console.error("  Add to .env.local:");
  console.error("    GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json\n");
  process.exit(1);
}

import { initializeApp, applicationDefault, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { STATIONS } from "../src/constants/stations";
import { TEAM_CONFIGS } from "../src/constants/routes";

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

async function showCurrentState(): Promise<void> {
  console.log("\n📊 Current progress state:\n");
  const snap = await db.collection("progress").get();

  if (snap.empty) {
    console.log("   (no progress documents found)\n");
    return;
  }

  for (const doc of snap.docs) {
    const data = doc.data();
    const completed = Object.values(
      (data.progress ?? {}) as Record<string, string>
    ).filter((v) => v === "completed").length;
    const total = Object.keys(
      (data.progress ?? {}) as Record<string, string>
    ).length;
    const finished = typeof data.finalAnswer === "string" && data.finalAnswer.length > 0;
    const status = finished
      ? "✅ FINISHED"
      : `${completed}/${total} stations`;
    console.log(`   ${doc.id.padEnd(14)} ${status}`);
  }
  console.log();
}

function askConfirmation(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim() === "YES");
    });
  });
}

// ---------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------

async function resetAll(): Promise<void> {
  const batch = db.batch();

  for (const team of TEAM_CONFIGS) {
    const rotated = rotateStations(team.routeOffset);
    const progress: Record<string, string> = {};

    rotated.forEach((station, index) => {
      progress[station.id] = index === 0 ? "active" : "locked";
    });

    const ref = db.collection("progress").doc(team.teamCode);
    batch.set(ref, {
      teamId: team.teamCode,
      progress,
      currentStationId: rotated[0]!.id,
      startedAt: null,
      finishedAt: null,
      finalAnswer: null,
      resetAt: Date.now(),
    });

    const firstStation = rotated[0]!;
    console.log(
      `   ✓ ${team.teamCode.padEnd(14)} → starts at ${firstStation.id} (${firstStation.title})`
    );
  }

  await batch.commit();
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("⚠️   Strasbourg Mission — reset progress");
  console.log(`    This will WIPE all team progress and cannot be undone.`);
  console.log(`    Teams: ${TEAM_CONFIGS.length}  |  Stations: ${STATIONS.length}`);

  await showCurrentState();

  const confirmed = await askConfirmation(
    'Type "YES" to confirm full reset, anything else to abort: '
  );

  if (!confirmed) {
    console.log("\n   Aborted. No data was changed.\n");
    process.exit(0);
  }

  console.log("\n🔄 Resetting all progress...\n");
  await resetAll();
  console.log(
    `\n✅ Reset complete. ${TEAM_CONFIGS.length} teams restored to initial state.\n`
  );
}

main()
  .catch((error) => {
    console.error("\n❌ Reset failed:", error);
    process.exit(1);
  })
  .finally(() => process.exit(0));

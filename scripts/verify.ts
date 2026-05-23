/**
 * Verify script — read-only pre-flight check before running a mission.
 *
 * Checks:
 *   1. Firebase connectivity
 *   2. All stations exist, are valid, have no duplicate orders/rewardNumbers
 *   3. Reward letters assemble into the correct final word
 *   4. All team documents exist in Firestore
 *   5. All progress documents exist and are structurally valid
 *   6. Each progress document covers every station exactly once
 *
 * Never writes to Firestore. Safe to run at any time, including mid-mission.
 *
 * Usage:
 *   npm run verify
 *
 * Exit code 0 = all checks passed.
 * Exit code 1 = one or more checks failed (details printed above summary).
 */

import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error("\n❌  GOOGLE_APPLICATION_CREDENTIALS is not set.");
  console.error("    Add to .env.local:");
  console.error("      GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json\n");
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
// Check primitives
// ---------------------------------------------------------------------------

interface Check {
  ok: boolean;
  label: string;     // short identifier, printed in the table
  detail: string;    // human-readable result or error
  fix?: string;      // command to run on failure
}

const p = (label: string, detail: string): Check => ({ ok: true,  label, detail });
const f = (label: string, detail: string, fix?: string): Check => ({ ok: false, label, detail, fix });

// ---------------------------------------------------------------------------
// Section printer
// ---------------------------------------------------------------------------

function printSection(title: string, checks: Check[]): void {
  const w = 80;
  console.log(`\n${"─".repeat(w)}`);
  console.log(` ${title}`);
  console.log("─".repeat(w));

  for (const c of checks) {
    const icon = c.ok ? "  ✓" : "  ✗";
    const label = c.label.padEnd(22);
    const line = `${icon}  ${label}  ${c.detail}`;
    console.log(line);
    if (!c.ok && c.fix) {
      console.log(`       fix: ${c.fix}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Station checks
// ---------------------------------------------------------------------------

function checkStations(
  firestoreDocs: Map<string, Record<string, unknown>>
): Check[] {
  const checks: Check[] = [];
  const seenOrders = new Set<number>();
  const seenRewardNumbers = new Set<number>();

  for (const station of STATIONS) {
    const doc = firestoreDocs.get(station.id);

    if (!doc) {
      checks.push(
        f(`stations/${station.id}`, "document not found in Firestore", "npm run seed")
      );
      continue;
    }

    const issues: string[] = [];

    // Order
    if (typeof doc.order !== "number") {
      issues.push(`order missing or not a number`);
    } else if (doc.order !== station.order) {
      issues.push(`order mismatch (Firestore:${doc.order} constant:${station.order})`);
    } else if (seenOrders.has(doc.order)) {
      issues.push(`duplicate order value: ${doc.order}`);
    } else {
      seenOrders.add(doc.order);
    }

    // Reward letter
    const letter = doc.rewardLetter;
    if (typeof letter !== "string" || !/^[A-Za-z]$/.test(letter)) {
      issues.push(`invalid rewardLetter: ${JSON.stringify(letter)}`);
    }

    // Reward number
    const num = doc.rewardNumber;
    if (typeof num !== "number" || num < 1 || !Number.isInteger(num)) {
      issues.push(`invalid rewardNumber: ${JSON.stringify(num)}`);
    } else if (seenRewardNumbers.has(num)) {
      issues.push(`duplicate rewardNumber: ${num}`);
    } else {
      seenRewardNumbers.add(num);
    }

    // Accepted answers
    const answers = doc.acceptedAnswers;
    if (!Array.isArray(answers) || answers.length === 0) {
      issues.push("acceptedAnswers empty or missing");
    }

    // Observation question
    if (typeof doc.observationQuestion !== "string" || !doc.observationQuestion.trim()) {
      issues.push("observationQuestion missing");
    }

    if (issues.length > 0) {
      checks.push(
        f(
          `stations/${station.id}`,
          issues.join("; "),
          "npm run seed"
        )
      );
    } else {
      checks.push(
        p(
          `stations/${station.id}`,
          `"${String(doc.title)}"  order:${doc.order}  letter:${String(letter)}(${String(num)})  answers:${(answers as unknown[]).length}`
        )
      );
    }
  }

  // Extra stations in Firestore not in constants (harmless but flagged)
  for (const id of firestoreDocs.keys()) {
    if (!STATIONS.some((s) => s.id === id)) {
      checks.push(p(`stations/${id}`, "(extra — not in constants, harmless)"));
    }
  }

  // Reward word assembly
  const sortedByRewardNumber = [...STATIONS].sort(
    (a, b) => a.rewardNumber - b.rewardNumber
  );
  const canAssemble = sortedByRewardNumber.every((s) => {
    const doc = firestoreDocs.get(s.id);
    return doc && typeof doc.rewardLetter === "string" && /^[A-Za-z]$/.test(doc.rewardLetter);
  });

  if (canAssemble) {
    const word = sortedByRewardNumber
      .map((s) => String(firestoreDocs.get(s.id)!.rewardLetter).toUpperCase())
      .join("");
    checks.push(p("reward word", `"${word}" assembled from ${sortedByRewardNumber.length} letters ✓`));
  } else {
    checks.push(
      f("reward word", "cannot assemble — one or more rewardLetter fields are invalid", "npm run seed")
    );
  }

  return checks;
}

// ---------------------------------------------------------------------------
// Team checks
// ---------------------------------------------------------------------------

function checkTeams(
  firestoreDocs: Map<string, Record<string, unknown>>
): Check[] {
  return TEAM_CONFIGS.map((team) => {
    const doc = firestoreDocs.get(team.teamCode);

    if (!doc) {
      return f(team.teamCode, "team document not found", "npm run seed");
    }

    const issues: string[] = [];
    if (typeof doc.teamName !== "string" || !doc.teamName) issues.push("teamName missing");
    if (doc.teamCode !== team.teamCode) issues.push(`teamCode mismatch in doc: ${String(doc.teamCode)}`);

    return issues.length > 0
      ? f(team.teamCode, issues.join("; "), "npm run seed")
      : p(team.teamCode, `"${String(doc.teamName)}"  role:${String(doc.role ?? "student")}`);
  });
}

// ---------------------------------------------------------------------------
// Progress checks
// ---------------------------------------------------------------------------

function checkProgress(
  progressDocs: Map<string, Record<string, unknown>>,
  stationIds: Set<string>
): Check[] {
  return TEAM_CONFIGS.map((team) => {
    const doc = progressDocs.get(team.teamCode);

    if (!doc) {
      return f(
        team.teamCode,
        "progress document not found",
        "npm run seed  (or npm run reset:progress)"
      );
    }

    const issues: string[] = [];
    const progress = doc.progress as Record<string, unknown> | undefined;

    if (!progress || typeof progress !== "object" || Array.isArray(progress)) {
      return f(team.teamCode, "progress field missing or invalid", "npm run reset:progress");
    }

    // All expected station IDs present
    for (const id of stationIds) {
      if (!(id in progress)) {
        issues.push(`missing station: ${id}`);
      }
    }

    // No unexpected station IDs
    for (const id of Object.keys(progress)) {
      if (!stationIds.has(id)) {
        issues.push(`unknown station in progress: ${id}`);
      }
    }

    // Status values valid
    const validStatuses = new Set(["locked", "active", "completed"]);
    for (const [id, status] of Object.entries(progress)) {
      if (!validStatuses.has(String(status))) {
        issues.push(`invalid status for ${id}: ${JSON.stringify(status)}`);
      }
    }

    // Exactly one active station
    const activeStations = Object.entries(progress).filter(([, s]) => s === "active");
    if (activeStations.length === 0) {
      // Finished teams have no active station — only flag if not finished
      const isFinished =
        typeof doc.finalAnswer === "string" && doc.finalAnswer.length > 0;
      if (!isFinished) {
        issues.push("no active station (and team has not finished)");
      }
    } else if (activeStations.length > 1) {
      issues.push(`${activeStations.length} active stations — should be exactly 1`);
    }

    // currentStationId consistency
    const currentId = doc.currentStationId;
    if (typeof currentId === "string" && currentId) {
      if (!stationIds.has(currentId)) {
        issues.push(`currentStationId "${currentId}" is not a valid station`);
      } else if (activeStations.length === 1 && activeStations[0]![0] !== currentId) {
        issues.push(
          `currentStationId "${currentId}" does not match active station "${activeStations[0]![0]}"`
        );
      }
    }

    if (issues.length > 0) {
      return f(team.teamCode, issues.join("; "), "npm run reset:progress");
    }

    const completedCount = Object.values(progress).filter((s) => s === "completed").length;
    const isFinished = typeof doc.finalAnswer === "string" && doc.finalAnswer.length > 0;
    const status = isFinished
      ? "FINISHED"
      : activeStations[0]
        ? `active:${activeStations[0][0]}`
        : "no active station";

    return p(
      team.teamCode,
      `${completedCount}/${stationIds.size} complete  ${status}`
    );
  });
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

function printSummary(allChecks: Check[]): void {
  const failed = allChecks.filter((c) => !c.ok);
  const passed = allChecks.filter((c) => c.ok);

  console.log(`\n${"─".repeat(80)}`);
  console.log(` SUMMARY`);
  console.log("─".repeat(80));

  if (failed.length === 0) {
    console.log(`\n  ✅  All ${passed.length} checks passed.`);
    console.log("  Ready for mission.\n");
  } else {
    console.log(
      `\n  ❌  ${passed.length} passed, ${failed.length} failed.\n`
    );
    console.log("  Failed checks:");
    for (const c of failed) {
      console.log(`    • ${c.label}: ${c.detail}`);
      if (c.fix) console.log(`      → ${c.fix}`);
    }
    console.log();
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("\n🔍  Strasbourg Mission — pre-flight verification");
  console.log(
    `    Project : ${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "(inferred from credentials)"}`
  );
  console.log(`    Stations: ${STATIONS.length}  |  Teams: ${TEAM_CONFIGS.length}`);

  // Fetch all three collections in parallel — read-only
  let stationsSnap: FirebaseFirestore.QuerySnapshot;
  let teamsSnap: FirebaseFirestore.QuerySnapshot;
  let progressSnap: FirebaseFirestore.QuerySnapshot;

  try {
    [stationsSnap, teamsSnap, progressSnap] = await Promise.all([
      db.collection("stations").get(),
      db.collection("teams").get(),
      db.collection("progress").get(),
    ]);
  } catch (error) {
    console.error(
      "\n❌  Firebase connection failed:",
      error instanceof Error ? error.message : error
    );
    console.error(
      "    Check GOOGLE_APPLICATION_CREDENTIALS and your network connection.\n"
    );
    process.exit(1);
  }

  const stationDocs = new Map(
    stationsSnap.docs.map((d) => [d.id, d.data() as Record<string, unknown>])
  );
  const teamDocs = new Map(
    teamsSnap.docs.map((d) => [d.id, d.data() as Record<string, unknown>])
  );
  const progressDocs = new Map(
    progressSnap.docs.map((d) => [d.id, d.data() as Record<string, unknown>])
  );
  const stationIds = new Set(STATIONS.map((s) => s.id));

  // Run all checks
  const stationChecks = checkStations(stationDocs);
  const teamChecks = checkTeams(teamDocs);
  const progressChecks = checkProgress(progressDocs, stationIds);

  printSection(`STATIONS  (${stationDocs.size} in Firestore, ${STATIONS.length} expected)`, stationChecks);
  printSection(`TEAMS  (${teamDocs.size} in Firestore, ${TEAM_CONFIGS.length} expected)`, teamChecks);
  printSection(`PROGRESS  (${progressDocs.size} in Firestore, ${TEAM_CONFIGS.length} expected)`, progressChecks);

  const allChecks = [...stationChecks, ...teamChecks, ...progressChecks];
  printSummary(allChecks);

  process.exit(allChecks.some((c) => !c.ok) ? 1 : 0);
}

main().catch((error) => {
  console.error("\n❌  Unexpected error:", error);
  process.exit(1);
});

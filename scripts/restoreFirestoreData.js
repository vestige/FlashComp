import fs from "node:fs/promises";
import { Timestamp, doc, getDoc, writeBatch } from "firebase/firestore";
import { cleanupScriptFirebase, db, signInForScripts } from "./firestoreClient.js";

const requireYes = process.argv.includes("--yes");

if (!requireYes) {
  console.log("Abort: This command writes data to Firestore.");
  console.log("Run again with --yes and --file <backup-json-path>.");
  process.exit(1);
}

function normalizeGymIds(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((id) => typeof id === "string" && id.trim().length > 0);
}

function readArgValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index < 0 || index + 1 >= process.argv.length) return "";
  return process.argv[index + 1] || "";
}

function splitDocPath(pathText) {
  return String(pathText || "")
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
}

function deserializeValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => deserializeValue(item));
  }
  if (value && typeof value === "object") {
    if (value.__type === "timestamp" && typeof value.seconds === "number") {
      const seconds = value.seconds;
      const nanoseconds = typeof value.nanoseconds === "number" ? value.nanoseconds : 0;
      return new Timestamp(seconds, nanoseconds);
    }

    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, deserializeValue(child)])
    );
  }
  return value;
}

async function run() {
  const filePath = readArgValue("--file");
  if (!filePath) {
    console.error("Missing --file option.");
    console.error("Example: npm run db:restore -- --yes --file backups/firestore-backup-20260307-120000.json");
    process.exit(1);
  }

  const signedInUser = await signInForScripts();
  if (!signedInUser) {
    console.error("Authentication is required for restore under current Firestore rules.");
    console.error("Set env vars and run again:");
    console.error(
      "$env:SCRIPT_AUTH_EMAIL='owner.multi@example.com'; $env:SCRIPT_AUTH_PASSWORD='YOUR_PASSWORD'; npm run db:restore -- --yes --file backups/xxx.json"
    );
    process.exit(1);
  }

  const includeSystem = process.argv.includes("--include-system");

  const profileSnap = await getDoc(doc(db, "users", signedInUser.uid));
  const profileData = profileSnap.exists() ? profileSnap.data() : {};
  const allowedGymIds = normalizeGymIds(profileData.gymIds);
  const hasAllGymAccess = profileData.role === "admin" || allowedGymIds.includes("*");

  if (!hasAllGymAccess && allowedGymIds.length === 0) {
    console.error(`No gymIds found in users/${signedInUser.uid}. Cannot restore events.`);
    process.exit(1);
  }

  const raw = await fs.readFile(filePath, "utf8");
  const payload = JSON.parse(raw);
  const sourceDocs = Array.isArray(payload.docs) ? payload.docs : [];

  if (sourceDocs.length === 0) {
    console.error("Backup file has no docs to restore.");
    process.exit(1);
  }

  const eventGymById = new Map();
  for (const row of sourceDocs) {
    const segments = splitDocPath(row.path);
    if (segments.length === 2 && segments[0] === "events") {
      const gymId = row.data?.gymId;
      if (typeof gymId === "string" && gymId.trim().length > 0) {
        eventGymById.set(segments[1], gymId);
      }
    }
  }

  const restorableDocs = [];
  let skippedByScope = 0;
  let skippedBySystemFlag = 0;

  for (const row of sourceDocs) {
    const segments = splitDocPath(row.path);
    if (segments.length === 0) continue;

    if (segments[0] === "events") {
      const eventId = segments[1];
      const gymId = eventGymById.get(eventId);
      if (!hasAllGymAccess) {
        if (!gymId || !allowedGymIds.includes(gymId)) {
          skippedByScope += 1;
          continue;
        }
      }
      restorableDocs.push(row);
      continue;
    }

    if (segments[0] === "gyms" || segments[0] === "users") {
      if (!includeSystem) {
        skippedBySystemFlag += 1;
        continue;
      }
      restorableDocs.push(row);
      continue;
    }

    // Unknown top-level collections are skipped intentionally.
  }

  let batch = writeBatch(db);
  let opCount = 0;
  let restoredCount = 0;

  async function queueSet(pathText, data) {
    const segments = splitDocPath(pathText);
    batch.set(doc(db, ...segments), deserializeValue(data));
    opCount += 1;

    if (opCount >= 450) {
      await batch.commit();
      batch = writeBatch(db);
      opCount = 0;
    }
  }

  async function flushBatch() {
    if (opCount > 0) {
      await batch.commit();
      batch = writeBatch(db);
      opCount = 0;
    }
  }

  console.log("Start restoring Firestore data...");
  console.log(`[auth] signed in as: ${signedInUser.email || signedInUser.uid}`);
  console.log(`[mode] include system collections: ${includeSystem ? "yes" : "no"}`);
  console.log(`[mode] allowed gyms: ${hasAllGymAccess ? "ALL" : JSON.stringify(allowedGymIds)}`);
  console.log(`[source] docs in file: ${sourceDocs.length}`);
  console.log(`[target] docs to restore: ${restorableDocs.length}`);

  for (const row of restorableDocs) {
    await queueSet(row.path, row.data);
    restoredCount += 1;
  }

  await flushBatch();

  console.log(`Restore completed. restored=${restoredCount}`);
  console.log(`Skipped by gym scope: ${skippedByScope}`);
  console.log(`Skipped by --include-system flag: ${skippedBySystemFlag}`);
}

run()
  .catch((error) => {
    console.error("Failed to restore Firestore data:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanupScriptFirebase();
    process.exit(process.exitCode ?? 0);
  });

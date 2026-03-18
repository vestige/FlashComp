import fs from "node:fs/promises";
import path from "node:path";
import { Timestamp, doc, getDoc, writeBatch } from "firebase/firestore";
import { cleanupScriptFirebase, db, signInForScripts } from "./firestoreClient.js";

const requireYes = process.argv.includes("--yes");
const dryRun = process.argv.includes("--dry-run");

if (!requireYes && !dryRun) {
  console.log("Abort: This command writes data to Firestore.");
  console.log("Run again with --yes --file <backup-json-path>.");
  console.log("For preview only, run --dry-run --file <backup-json-path>.");
  process.exit(1);
}

if (dryRun) {
  console.log("Dry-run mode: this command will show restore preview only.");
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

function readList(flag) {
  const raw = readArgValue(flag);
  if (!raw) return [];
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function summarizeSet(items, label, limit = 12) {
  const values = Array.from(items).sort();
  const head = values.slice(0, limit);
  const suffix = values.length > limit ? ` ...(+${values.length - limit} more)` : "";
  return `[${label}] count=${values.length} values=${head.join(", ")}${suffix}`;
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

function promptApproval(message) {
  return new Promise((resolve) => {
    const normalizedMessage = `${message} (y/N): `;
    process.stdout.write(normalizedMessage);
    process.stdin.setEncoding("utf8");
    process.stdin.resume();
    process.stdin.once("data", (chunk) => {
      const answer = String(chunk || "").trim().toLowerCase();
      process.stdin.pause();
      resolve(answer === "y" || answer === "yes");
    });
  });
}

async function run() {
  const startedAt = new Date().toISOString();
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
  const scopeEvents = readList("--scope-events");
  const scopeGyms = readList("--scope-gym");
  const logFilePath = readArgValue("--log") || path.join("backups", "restore-logs", `restore-${formatTimestamp(startedAt)}.jsonl`);

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
  const sourceEventIds = new Set();
  const sourceGymIds = new Set();
  for (const row of sourceDocs) {
    const segments = splitDocPath(row.path);
    if (segments.length === 2 && segments[0] === "events") {
      const gymId = row.data?.gymId;
      sourceEventIds.add(segments[1]);
      if (typeof gymId === "string" && gymId.trim().length > 0) {
        sourceGymIds.add(gymId);
      }
      if (typeof gymId === "string" && gymId.trim().length > 0) {
        eventGymById.set(segments[1], gymId);
      }
    }
  }

  const restorableDocs = [];
  let skippedByScope = 0;
  let skippedBySystemFlag = 0;
  let skippedByScopeFilter = 0;
  let skippedByUnknownTopLevel = 0;
  let totalTargetEvents = new Set();
  let totalTargetGyms = new Set();

  for (const row of sourceDocs) {
    const segments = splitDocPath(row.path);
    if (segments.length === 0) continue;

    if (segments[0] === "events") {
      const eventId = segments[1];
      const gymId = eventGymById.get(eventId);
      if (scopeEvents.length > 0 && !scopeEvents.includes(eventId)) {
        skippedByScopeFilter += 1;
        continue;
      }
      if (scopeGyms.length > 0 && (!gymId || !scopeGyms.includes(gymId))) {
        skippedByScopeFilter += 1;
        continue;
      }
      if (!hasAllGymAccess) {
        if (!gymId || !allowedGymIds.includes(gymId)) {
          skippedByScope += 1;
          continue;
        }
      }
      totalTargetEvents.add(eventId);
      if (gymId) totalTargetGyms.add(gymId);
      restorableDocs.push(row);
      continue;
    }

    if (segments[0] === "gyms" || segments[0] === "users") {
      if (!includeSystem) {
        skippedBySystemFlag += 1;
        continue;
      }
      if (segments[0] === "users") {
        const userId = segments[1] || "";
        if (scopeEvents.length > 0 || scopeGyms.length > 0) {
          // Scope filters are event/gym oriented, so system docs are restored only when no scope filter is set.
          if (scopeEvents.length > 0 || scopeGyms.length > 0) {
            skippedByScopeFilter += 1;
            continue;
          }
        }
      }
      restorableDocs.push(row);
      continue;
    }

    // Unknown top-level collections are skipped intentionally.
    skippedByUnknownTopLevel += 1;
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
  if (scopeEvents.length > 0) {
    console.log(`[filter] events: ${scopeEvents.join(", ")}`);
  }
  if (scopeGyms.length > 0) {
    console.log(`[filter] gyms: ${scopeGyms.join(", ")}`);
  }
  console.log(`[source] events=${sourceEventIds.size}, gyms=${sourceGymIds.size}, docs=${sourceDocs.length}`);
  console.log(`[source] docs in file: ${sourceDocs.length}`);
  console.log(`[target] docs to restore: ${restorableDocs.length}`);
  console.log(summarizeSet(totalTargetEvents, "target events"));
  console.log(summarizeSet(totalTargetGyms, "target gyms"));
  console.log(`[scope skip] permission: ${skippedByScope}, system-flag: ${skippedBySystemFlag}, filter: ${skippedByScopeFilter}, unknown: ${skippedByUnknownTopLevel}`);

  if (dryRun) {
    console.log("Dry-run completed. No data written.");
    await fs.mkdir(path.dirname(logFilePath), { recursive: true });
    await fs.appendFile(
      logFilePath,
      `${JSON.stringify({
        startedAt,
        completedAt: new Date().toISOString(),
        mode: "dry-run",
        actor: signedInUser.email || signedInUser.uid,
        sourceFile: filePath,
        includeSystem,
        hasAllGymAccess,
        sourceProject: payload.sourceProject || undefined,
        environment: payload.environment || "manual",
        requestedScope: {
          events: scopeEvents,
          gyms: scopeGyms,
        },
        targetDocs: restorableDocs.length,
        sourceDocs: sourceDocs.length,
        skipped: {
          byPermissionScope: skippedByScope,
          bySystemFlag: skippedBySystemFlag,
          byFilter: skippedByScopeFilter,
          byUnknownTopLevel: skippedByUnknownTopLevel,
        },
        restoredCount: 0,
        restoredEvents: Array.from(totalTargetEvents),
        restoredGyms: Array.from(totalTargetGyms),
      })}\n`
    );
    console.log(`[log] dry-run log: ${logFilePath}`);
    return;
  }

  const confirmed = await promptApproval("Proceed with restore?");
  if (!confirmed) {
    console.log("Restore aborted by user.");
    return;
  }

  if (restorableDocs.length === 0) {
    console.log("No documents are eligible for restore.");
  }

  for (const row of restorableDocs) {
    await queueSet(row.path, row.data);
    restoredCount += 1;
  }

  await flushBatch();

  console.log(`Restore completed. restored=${restoredCount}`);
  console.log(`Skipped by gym scope: ${skippedByScope}`);
  console.log(`Skipped by --include-system flag: ${skippedBySystemFlag}`);
  await fs.mkdir(path.dirname(logFilePath), { recursive: true });
  await fs.appendFile(
    logFilePath,
    `${JSON.stringify({
      startedAt,
      completedAt: new Date().toISOString(),
      mode: "apply",
      actor: signedInUser.email || signedInUser.uid,
      sourceFile: filePath,
      includeSystem,
      hasAllGymAccess,
      sourceProject: payload.sourceProject || undefined,
      environment: payload.environment || "manual",
      requestedScope: {
        events: scopeEvents,
        gyms: scopeGyms,
      },
      targetDocs: restorableDocs.length,
      sourceDocs: sourceDocs.length,
      skipped: {
        byPermissionScope: skippedByScope,
        bySystemFlag: skippedBySystemFlag,
        byFilter: skippedByScopeFilter,
        byUnknownTopLevel: skippedByUnknownTopLevel,
      },
      restoredCount,
      restoredEvents: Array.from(totalTargetEvents),
      restoredGyms: Array.from(totalTargetGyms),
    })}\n`
  );
  console.log(`[log] restore log: ${logFilePath}`);
}

function formatTimestamp(dateIsoString) {
  const date = new Date(dateIsoString);
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  const second = String(date.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}-${hour}${minute}${second}`;
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

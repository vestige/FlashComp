import fs from "node:fs/promises";
import path from "node:path";
import { collection, deleteDoc, doc, getDoc, getDocs } from "firebase/firestore";
import {
  createPurgeLogEntry,
  formatTimestamp,
  normalizeGymIds,
  readArgValue,
  readScopeFromArgv,
  validateScopeOptions,
} from "./lib/purgeUtils.js";
import { cleanupScriptFirebase, db, signInForScripts } from "./firestoreClient.js";

const requireYes = process.argv.includes("--yes");
const dryRun = process.argv.includes("--dry-run");

if (!requireYes && !dryRun) {
  console.log("Abort: This command is destructive.");
  console.log("Run again with --yes to delete Firestore test data.");
  console.log("For preview only, run with --dry-run.");
  process.exit(1);
}

function hasArg(name) {
  return process.argv.includes(name);
}

if (dryRun) {
  console.log("Dry-run mode: this command will show deletion preview only.");
}

async function deleteSnapshot(snapshot, label, options = {}) {
  const { dryRunMode = false, filterFn = null } = options;
  if (snapshot.empty) {
    console.log(`[skip] ${label}: 0 docs`);
    return { deleted: 0, wouldDelete: 0, skippedPermission: 0, skippedFilter: 0 };
  }

  let deleted = 0;
  let wouldDelete = 0;
  let skippedPermission = 0;
  let skippedFilter = 0;

  for (const docSnap of snapshot.docs) {
    if (typeof filterFn === "function" && !filterFn(docSnap)) {
      skippedFilter += 1;
      continue;
    }
    if (dryRunMode) {
      wouldDelete += 1;
      continue;
    }
    try {
      await deleteDoc(docSnap.ref);
      deleted += 1;
    } catch (error) {
      if (error?.code === "permission-denied") {
        skippedPermission += 1;
        continue;
      }
      throw error;
    }
  }

  if (dryRunMode) {
    console.log(
      `[done] ${label}: ${wouldDelete} docs would delete, ${skippedFilter} skipped by scope`
    );
  } else {
    console.log(
      `[done] ${label}: ${deleted} docs deleted, ${skippedPermission} permission skipped, ${skippedFilter} skipped by scope`
    );
  }

  return { deleted, wouldDelete, skippedPermission, skippedFilter };
}

async function purgeEvent(eventDoc, options = {}) {
  const { dryRunMode = false } = options;
  const eventId = eventDoc.id;
  let deleted = 0;
  let wouldDelete = 0;
  let skippedPermission = 0;

  const safeDelete = async (docRef) => {
    if (dryRunMode) {
      wouldDelete += 1;
      return;
    }
    try {
      await deleteDoc(docRef);
      deleted += 1;
    } catch (error) {
      if (error?.code === "permission-denied") {
        skippedPermission += 1;
        return;
      }
      throw error;
    }
  };

  const seasonSnap = await getDocs(collection(db, "events", eventId, "seasons"));
  for (const seasonDoc of seasonSnap.docs) {
    const seasonId = seasonDoc.id;
    const seasonCategorySnap = await getDocs(
      collection(db, "events", eventId, "seasons", seasonId, "categories")
    );

    for (const seasonCategoryDoc of seasonCategorySnap.docs) {
      const categoryId = seasonCategoryDoc.id;
      const routeSnap = await getDocs(
        collection(db, "events", eventId, "seasons", seasonId, "categories", categoryId, "routes")
      );
      for (const routeDoc of routeSnap.docs) {
        await safeDelete(routeDoc.ref);
      }

      const scoreSnap = await getDocs(
        collection(
          db,
          "events",
          eventId,
          "seasons",
          seasonId,
          "categories",
          categoryId,
          "participants"
        )
      );
      for (const scoreDoc of scoreSnap.docs) {
        await safeDelete(scoreDoc.ref);
      }

      await safeDelete(seasonCategoryDoc.ref);
    }

    await safeDelete(seasonDoc.ref);
  }

  const categorySnap = await getDocs(collection(db, "events", eventId, "categories"));
  for (const categoryDoc of categorySnap.docs) {
    await safeDelete(categoryDoc.ref);
  }

  const participantSnap = await getDocs(collection(db, "events", eventId, "participants"));
  for (const participantDoc of participantSnap.docs) {
    await safeDelete(participantDoc.ref);
  }

  await safeDelete(eventDoc.ref);
  if (dryRunMode) {
    console.log(`[done] event(${eventId}): ${wouldDelete} docs would delete`);
  } else {
    console.log(`[done] event(${eventId}): ${deleted} docs deleted, ${skippedPermission} permission skipped`);
  }
  return { deleted, wouldDelete, skippedPermission };
}

async function run() {
  const startedAt = new Date().toISOString();
  const clearAll = hasArg("--all");
  const scope = readScopeFromArgv(process.argv);
  const scopeEvents = Array.from(scope.events);
  const scopeGyms = Array.from(scope.gyms);
  const scopeValidation = validateScopeOptions({ clearAll, scope });
  const hasScope = scopeValidation.hasScope;
  const logFilePath =
    readArgValue(process.argv, "--log") || path.join("backups", "purge-logs", `purge-${formatTimestamp(startedAt)}.jsonl`);

  if (!scopeValidation.ok) {
    for (const message of scopeValidation.messages) {
      console.error(message);
    }
    process.exit(1);
  }

  const signedInUser = await signInForScripts();
  if (!signedInUser) {
    console.error("Authentication is required for purge under current Firestore rules.");
    console.error("Set env vars and run again:");
    console.error(
      "$env:SCRIPT_AUTH_EMAIL='owner.multi@example.com'; $env:SCRIPT_AUTH_PASSWORD='YOUR_PASSWORD'; npm run db:purge:yes"
    );
    process.exit(1);
  }

  const includeSystem = hasArg("--include-system") || clearAll;

  console.log("Start purging Firestore test data...");
  console.log(`[auth] signed in as: ${signedInUser.email || signedInUser.uid}`);
  console.log(`[mode] include system collections: ${includeSystem ? "yes" : "no"}`);
  console.log(`[mode] clear all data: ${clearAll ? "yes" : "no"}`);
  console.log(`[mode] dry-run: ${dryRun ? "yes" : "no"}`);
  if (hasScope) {
    console.log(`[filter] scope events: ${scopeEvents.length > 0 ? scopeEvents.join(", ") : "(none)"}`);
    console.log(`[filter] scope gyms: ${scopeGyms.length > 0 ? scopeGyms.join(", ") : "(none)"}`);
  }
  const profileSnap = await getDoc(doc(db, "users", signedInUser.uid));
  const profileData = profileSnap.exists() ? profileSnap.data() : {};
  const userRole = typeof profileData.role === "string" ? profileData.role : "unset";
  const allowedGymIds = normalizeGymIds(profileData.gymIds);
  const hasAllGymAccess = userRole === "admin" || allowedGymIds.includes("*");
  const isOwnerLike = userRole === "owner" || userRole === "admin";

  console.log(`[profile] users/${signedInUser.uid} role=${userRole} gymIds=${JSON.stringify(allowedGymIds)} exists=${profileSnap.exists()}`);

  if (!isOwnerLike) {
    console.error(`Script user is not owner/admin. role=${userRole}`);
    console.error("Set users/{uid} for SCRIPT_AUTH_UID as owner or admin before running destructive commands.");
    process.exit(1);
  }

  if (clearAll && !hasAllGymAccess && !dryRun) {
    console.error("--all requires users/{uid} with role admin or gymIds includes \"*\".");
    console.error("For demo cleanup, set gymIds: [\"*\"] in users/{uid}.");
    process.exit(1);
  }

  if (!clearAll && !hasAllGymAccess && allowedGymIds.length === 0) {
    console.error(`No gymIds found in users/${signedInUser.uid}. Cannot purge events.`);
    process.exit(1);
  }

  console.log(
    `[mode] allowed gyms: ${hasAllGymAccess ? "ALL" : JSON.stringify(allowedGymIds)}`
  );

  let totalDeleted = 0;
  let totalWouldDelete = 0;
  let totalPermissionSkipped = 0;
  let totalScopeSkipped = 0;
  let totalEvents = 0;

  const eventSnapshot = await getDocs(collection(db, "events"));
  const manageableEvents = (hasAllGymAccess
    ? eventSnapshot.docs
    : eventSnapshot.docs.filter((eventDoc) => {
      const gymId = eventDoc.data().gymId;
      return allowedGymIds.includes(gymId);
    }));

  const scopedEvents = manageableEvents.filter((eventDoc) => {
    const gymId = eventDoc.data().gymId;
    if (scopeEvents.length > 0 && !scope.events.has(eventDoc.id)) {
      totalScopeSkipped += 1;
      return false;
    }
    if (scopeGyms.length > 0 && !scope.gyms.has(gymId)) {
      totalScopeSkipped += 1;
      return false;
    }
    return true;
  });

  if (scopedEvents.length === 0) {
    console.log("[skip] events: no manageable events found");
  } else {
    for (const eventDoc of scopedEvents) {
      totalEvents += 1;
      const result = await purgeEvent(eventDoc, { dryRunMode: dryRun });
      totalDeleted += result.deleted;
      totalWouldDelete += result.wouldDelete;
      totalPermissionSkipped += result.skippedPermission;
    }
  }

  if (includeSystem) {
    const gymsResult = await deleteSnapshot(
      await getDocs(collection(db, "gyms")),
      "collection(gyms)",
      {
        dryRunMode: dryRun,
        filterFn: scopeGyms.length > 0 ? (docSnap) => scope.gyms.has(docSnap.id) : null,
      }
    );
    totalDeleted += gymsResult.deleted;
    totalWouldDelete += gymsResult.wouldDelete;
    totalPermissionSkipped += gymsResult.skippedPermission;
    totalScopeSkipped += gymsResult.skippedFilter;

    if (hasScope) {
      console.log("[skip] collection(users): skipped because --scope is set (safety guard)");
    } else {
      const usersResult = await deleteSnapshot(
        await getDocs(collection(db, "users")),
        "collection(users)",
        { dryRunMode: dryRun }
      );
      totalDeleted += usersResult.deleted;
      totalWouldDelete += usersResult.wouldDelete;
      totalPermissionSkipped += usersResult.skippedPermission;
      totalScopeSkipped += usersResult.skippedFilter;
    }
  }

  if (dryRun) {
    console.log(`Dry-run completed. Total docs to delete: ${totalWouldDelete}`);
  } else {
    console.log(`Completed. Total deleted docs: ${totalDeleted}`);
  }

  await fs.mkdir(path.dirname(logFilePath), { recursive: true });
  const logEntry = createPurgeLogEntry({
    startedAt,
    completedAt: new Date().toISOString(),
    dryRun,
    actor: signedInUser.email || signedInUser.uid,
    includeSystem,
    clearAll,
    scopeEvents,
    scopeGyms,
    hasAllGymAccess,
    role: userRole,
    manageableEventCount: manageableEvents.length,
    targetEventCount: scopedEvents.length,
    processedEventCount: totalEvents,
    deletedCount: totalDeleted,
    wouldDeleteCount: totalWouldDelete,
    skippedByPermission: totalPermissionSkipped,
    skippedByScope: totalScopeSkipped,
    logFile: logFilePath,
  });
  await fs.appendFile(
    logFilePath,
    `${JSON.stringify(logEntry)}\n`
  );
  console.log(`[log] purge log: ${logFilePath}`);
}

run()
  .catch((error) => {
    console.error("Failed to purge Firestore data:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanupScriptFirebase();
    process.exit(process.exitCode ?? 0);
  });

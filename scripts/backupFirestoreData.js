import fs from "node:fs/promises";
import path from "node:path";
import { Timestamp, collection, doc, getDoc, getDocs } from "firebase/firestore";
import {
  createBackupPayload,
  formatFileTimestamp,
  normalizeEnvironmentTag,
  normalizeGymIds,
  readArgValue,
} from "./lib/backupUtils.js";
import { cleanupScriptFirebase, db, signInForScripts } from "./firestoreClient.js";

function serializeValue(value) {
  if (value instanceof Timestamp) {
    return {
      __type: "timestamp",
      seconds: value.seconds,
      nanoseconds: value.nanoseconds,
    };
  }
  if (Array.isArray(value)) {
    return value.map((item) => serializeValue(item));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, serializeValue(child)])
    );
  }
  return value;
}

function pushSnapshotDocs(snapshot, docs) {
  for (const docSnap of snapshot.docs) {
    docs.push({
      path: docSnap.ref.path,
      data: serializeValue(docSnap.data()),
    });
  }
}

async function collectEventDocs(eventDoc, docs) {
  const eventId = eventDoc.id;
  docs.push({
    path: eventDoc.ref.path,
    data: serializeValue(eventDoc.data()),
  });

  const [seasonsSnap, categoriesSnap, participantsSnap] = await Promise.all([
    getDocs(collection(db, "events", eventId, "seasons")),
    getDocs(collection(db, "events", eventId, "categories")),
    getDocs(collection(db, "events", eventId, "participants")),
  ]);

  pushSnapshotDocs(seasonsSnap, docs);
  pushSnapshotDocs(categoriesSnap, docs);
  pushSnapshotDocs(participantsSnap, docs);

  const categoryIds = categoriesSnap.docs.map((categoryDoc) => categoryDoc.id);

  for (const seasonDoc of seasonsSnap.docs) {
    const seasonId = seasonDoc.id;

    const tasksSnap = await getDocs(collection(db, "events", eventId, "seasons", seasonId, "tasks"));
    pushSnapshotDocs(tasksSnap, docs);

    for (const categoryId of categoryIds) {
      const [routesSnap, scoreSnap, assignmentSnap] = await Promise.all([
        getDocs(
          collection(db, "events", eventId, "seasons", seasonId, "categories", categoryId, "routes")
        ),
        getDocs(
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
        ),
        getDocs(
          collection(
            db,
            "events",
            eventId,
            "seasons",
            seasonId,
            "categoryTaskMap",
            categoryId,
            "assignments"
          )
        ),
      ]);

      pushSnapshotDocs(routesSnap, docs);
      pushSnapshotDocs(scoreSnap, docs);
      pushSnapshotDocs(assignmentSnap, docs);
    }
  }
}

async function run() {
  const signedInUser = await signInForScripts();
  if (!signedInUser) {
    console.error("Authentication is required for backup under current Firestore rules.");
    console.error("Set env vars and run again:");
    console.error(
      "$env:SCRIPT_AUTH_EMAIL='owner.multi@example.com'; $env:SCRIPT_AUTH_PASSWORD='YOUR_PASSWORD'; npm run db:backup"
    );
    process.exit(1);
  }

  const includeSystem = process.argv.includes("--include-system");
  const requestedOutPath = readArgValue(process.argv, "--out");
  const environmentTag = normalizeEnvironmentTag(
    readArgValue(process.argv, "--env") || process.env.BACKUP_ENV
  );
  const outputPath = requestedOutPath
    || path.join(
      "backups",
      environmentTag,
      `firestore-backup-${environmentTag}-${formatFileTimestamp()}.json`
    );

  const profileSnap = await getDoc(doc(db, "users", signedInUser.uid));
  const profileData = profileSnap.exists() ? profileSnap.data() : {};
  const allowedGymIds = normalizeGymIds(profileData.gymIds);
  const hasAllGymAccess = profileData.role === "admin" || allowedGymIds.includes("*");

  if (!hasAllGymAccess && allowedGymIds.length === 0) {
    console.error(`No gymIds found in users/${signedInUser.uid}. Cannot backup events.`);
    process.exit(1);
  }

  console.log("Start backup from Firestore...");
  console.log(`[auth] signed in as: ${signedInUser.email || signedInUser.uid}`);
  console.log(`[mode] include system collections: ${includeSystem ? "yes" : "no"}`);
  console.log(`[mode] allowed gyms: ${hasAllGymAccess ? "ALL" : JSON.stringify(allowedGymIds)}`);

  const eventSnapshot = await getDocs(collection(db, "events"));
  const manageableEvents = hasAllGymAccess
    ? eventSnapshot.docs
    : eventSnapshot.docs.filter((eventDoc) => {
      const gymId = eventDoc.data().gymId;
      return allowedGymIds.includes(gymId);
    });

  const docs = [];
  for (const eventDoc of manageableEvents) {
    await collectEventDocs(eventDoc, docs);
  }

  if (includeSystem) {
    const [gymsSnap, usersSnap] = await Promise.all([
      getDocs(collection(db, "gyms")),
      getDocs(collection(db, "users")),
    ]);
    pushSnapshotDocs(gymsSnap, docs);
    pushSnapshotDocs(usersSnap, docs);
  }

  docs.sort((a, b) => a.path.localeCompare(b.path));

  const payload = createBackupPayload({
    exportedAt: new Date().toISOString(),
    sourceUser: signedInUser.email || signedInUser.uid,
    sourceProject:
      process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || "flashcompauth",
    includeSystem,
    environment: environmentTag,
    eventCount: manageableEvents.length,
    docs,
  });

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  console.log(`Backup completed. events=${manageableEvents.length}, docs=${docs.length}`);
  console.log(`Output: ${outputPath}`);
}

run()
  .catch((error) => {
    console.error("Failed to backup Firestore data:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanupScriptFirebase();
    process.exit(process.exitCode ?? 0);
  });

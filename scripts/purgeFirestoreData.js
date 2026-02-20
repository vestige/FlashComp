import { collection, deleteDoc, doc, getDoc, getDocs } from "firebase/firestore";
import { cleanupScriptFirebase, db, signInForScripts } from "./firestoreClient.js";

const requireYes = process.argv.includes("--yes");

if (!requireYes) {
  console.log("Abort: This command is destructive.");
  console.log("Run again with --yes to delete Firestore test data.");
  process.exit(1);
}

async function deleteSnapshot(snapshot, label) {
  if (snapshot.empty) {
    console.log(`[skip] ${label}: 0 docs`);
    return 0;
  }

  let deleted = 0;
  let skipped = 0;

  for (const docSnap of snapshot.docs) {
    try {
      await deleteDoc(docSnap.ref);
      deleted += 1;
    } catch (error) {
      if (error?.code === "permission-denied") {
        skipped += 1;
        continue;
      }
      throw error;
    }
  }

  console.log(`[done] ${label}: ${deleted} docs deleted, ${skipped} skipped`);
  return deleted;
}

function normalizeGymIds(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((id) => typeof id === "string" && id.trim().length > 0);
}

async function purgeEvent(eventDoc) {
  const eventId = eventDoc.id;
  let deleted = 0;
  let skipped = 0;

  const safeDelete = async (docRef) => {
    try {
      await deleteDoc(docRef);
      deleted += 1;
    } catch (error) {
      if (error?.code === "permission-denied") {
        skipped += 1;
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
  console.log(`[done] event(${eventId}): ${deleted} docs deleted, ${skipped} skipped`);
  return deleted;
}

async function run() {
  const signedInUser = await signInForScripts();
  if (!signedInUser) {
    console.error("Authentication is required for purge under current Firestore rules.");
    console.error("Set env vars and run again:");
    console.error(
      "$env:SCRIPT_AUTH_EMAIL='owner.multi@example.com'; $env:SCRIPT_AUTH_PASSWORD='YOUR_PASSWORD'; npm run db:purge:yes"
    );
    process.exit(1);
  }

  const includeSystem = process.argv.includes("--include-system");

  console.log("Start purging Firestore test data...");
  console.log(`[auth] signed in as: ${signedInUser.email || signedInUser.uid}`);
  console.log(`[mode] include system collections: ${includeSystem ? "yes" : "no"}`);
  const profileSnap = await getDoc(doc(db, "users", signedInUser.uid));
  const profileData = profileSnap.exists() ? profileSnap.data() : {};
  const allowedGymIds = normalizeGymIds(profileData.gymIds);
  const hasAllGymAccess = profileData.role === "admin" || allowedGymIds.includes("*");

  if (!hasAllGymAccess && allowedGymIds.length === 0) {
    console.error(`No gymIds found in users/${signedInUser.uid}. Cannot purge events.`);
    process.exit(1);
  }

  console.log(
    `[mode] allowed gyms: ${hasAllGymAccess ? "ALL" : JSON.stringify(allowedGymIds)}`
  );

  let totalDeleted = 0;
  const eventSnapshot = await getDocs(collection(db, "events"));
  const manageableEvents = hasAllGymAccess
    ? eventSnapshot.docs
    : eventSnapshot.docs.filter((eventDoc) => {
      const gymId = eventDoc.data().gymId;
      return allowedGymIds.includes(gymId);
    });

  if (manageableEvents.length === 0) {
    console.log("[skip] events: no manageable events found");
  } else {
    for (const eventDoc of manageableEvents) {
      totalDeleted += await purgeEvent(eventDoc);
    }
  }

  if (includeSystem) {
    totalDeleted += await deleteSnapshot(await getDocs(collection(db, "gyms")), "collection(gyms)");
    totalDeleted += await deleteSnapshot(await getDocs(collection(db, "users")), "collection(users)");
  }

  console.log(`Completed. Total deleted docs: ${totalDeleted}`);
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

import { collection, collectionGroup, getDocs, writeBatch } from "firebase/firestore";
import { db } from "./firestoreClient.js";

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
  let batch = writeBatch(db);
  let opCount = 0;

  for (const docSnap of snapshot.docs) {
    batch.delete(docSnap.ref);
    deleted += 1;
    opCount += 1;

    if (opCount >= 450) {
      await batch.commit();
      batch = writeBatch(db);
      opCount = 0;
    }
  }

  if (opCount > 0) {
    await batch.commit();
  }

  console.log(`[done] ${label}: ${deleted} docs deleted`);
  return deleted;
}

async function purgeCollectionGroup(collectionId) {
  const snapshot = await getDocs(collectionGroup(db, collectionId));
  return deleteSnapshot(snapshot, `collectionGroup(${collectionId})`);
}

async function purgeTopLevelCollection(collectionId) {
  const snapshot = await getDocs(collection(db, collectionId));
  return deleteSnapshot(snapshot, `collection(${collectionId})`);
}

async function run() {
  console.log("Start purging Firestore test data...");

  const groupOrder = ["routes", "participants", "categories", "seasons", "scores"];
  const topLevelCollections = ["events", "gyms", "users"];

  let totalDeleted = 0;

  for (const collectionId of groupOrder) {
    totalDeleted += await purgeCollectionGroup(collectionId);
  }

  for (const collectionId of topLevelCollections) {
    totalDeleted += await purgeTopLevelCollection(collectionId);
  }

  console.log(`Completed. Total deleted docs: ${totalDeleted}`);
}

run().catch((error) => {
  console.error("Failed to purge Firestore data:", error);
  process.exit(1);
});

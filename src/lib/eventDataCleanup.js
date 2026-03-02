import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";

const MAX_BATCH_OPS = 400;

const createBatchWriter = () => {
  let batch = writeBatch(db);
  let opCount = 0;

  const commitIfNeeded = async (force = false) => {
    if (opCount >= MAX_BATCH_OPS || (force && opCount > 0)) {
      await batch.commit();
      batch = writeBatch(db);
      opCount = 0;
    }
  };

  const queueDelete = async (docRef) => {
    batch.delete(docRef);
    opCount += 1;
    await commitIfNeeded();
  };

  const queueSetMerge = async (docRef, payload) => {
    batch.set(docRef, payload, { merge: true });
    opCount += 1;
    await commitIfNeeded();
  };

  const flush = async () => {
    await commitIfNeeded(true);
  };

  return {
    queueDelete,
    queueSetMerge,
    flush,
  };
};

const getSeasonCategoryIds = async (eventId, seasonId, fallbackCategoryIds = []) => {
  const categoryIds = new Set(fallbackCategoryIds.filter(Boolean));
  const seasonCategorySnap = await getDocs(
    collection(db, "events", eventId, "seasons", seasonId, "categories")
  );
  for (const seasonCategoryDoc of seasonCategorySnap.docs) {
    categoryIds.add(seasonCategoryDoc.id);
  }
  return Array.from(categoryIds);
};

export const deleteSeasonCascade = async ({ eventId, seasonId }) => {
  const writer = createBatchWriter();

  const taskSnap = await getDocs(collection(db, "events", eventId, "seasons", seasonId, "tasks"));
  for (const taskDoc of taskSnap.docs) {
    await writer.queueDelete(taskDoc.ref);
  }

  const categoryTaskMapSnap = await getDocs(
    collection(db, "events", eventId, "seasons", seasonId, "categoryTaskMap")
  );
  for (const categoryMapDoc of categoryTaskMapSnap.docs) {
    const assignmentSnap = await getDocs(
      collection(
        db,
        "events",
        eventId,
        "seasons",
        seasonId,
        "categoryTaskMap",
        categoryMapDoc.id,
        "assignments"
      )
    );
    for (const assignmentDoc of assignmentSnap.docs) {
      await writer.queueDelete(assignmentDoc.ref);
    }
    await writer.queueDelete(categoryMapDoc.ref);
  }

  const seasonCategorySnap = await getDocs(
    collection(db, "events", eventId, "seasons", seasonId, "categories")
  );
  for (const seasonCategoryDoc of seasonCategorySnap.docs) {
    const [participantSnap, routeSnap] = await Promise.all([
      getDocs(
        collection(
          db,
          "events",
          eventId,
          "seasons",
          seasonId,
          "categories",
          seasonCategoryDoc.id,
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
          "categories",
          seasonCategoryDoc.id,
          "routes"
        )
      ),
    ]);

    for (const participantDoc of participantSnap.docs) {
      await writer.queueDelete(participantDoc.ref);
    }
    for (const routeDoc of routeSnap.docs) {
      await writer.queueDelete(routeDoc.ref);
    }
    await writer.queueDelete(seasonCategoryDoc.ref);
  }

  await writer.queueDelete(doc(db, "events", eventId, "seasons", seasonId));
  await writer.flush();
};

export const deleteEventCascade = async ({ eventId }) => {
  const seasonSnap = await getDocs(collection(db, "events", eventId, "seasons"));
  for (const seasonDoc of seasonSnap.docs) {
    await deleteSeasonCascade({ eventId, seasonId: seasonDoc.id });
  }

  const writer = createBatchWriter();
  const [participantSnap, categorySnap] = await Promise.all([
    getDocs(collection(db, "events", eventId, "participants")),
    getDocs(collection(db, "events", eventId, "categories")),
  ]);

  for (const participantDoc of participantSnap.docs) {
    await writer.queueDelete(participantDoc.ref);
  }
  for (const categoryDoc of categorySnap.docs) {
    await writer.queueDelete(categoryDoc.ref);
  }
  await writer.queueDelete(doc(db, "events", eventId));
  await writer.flush();
};

export const deleteCategoryCascade = async ({ eventId, categoryId }) => {
  const writer = createBatchWriter();

  const participantsInCategorySnap = await getDocs(
    query(
      collection(db, "events", eventId, "participants"),
      where("categoryId", "==", categoryId)
    )
  );
  for (const participantDoc of participantsInCategorySnap.docs) {
    await writer.queueSetMerge(participantDoc.ref, {
      categoryId: "",
      updatedAt: serverTimestamp(),
    });
  }

  const seasonSnap = await getDocs(collection(db, "events", eventId, "seasons"));
  for (const seasonDoc of seasonSnap.docs) {
    const seasonId = seasonDoc.id;
    const [assignmentSnap, participantScoreSnap, routeSnap] = await Promise.all([
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
          "categories",
          categoryId,
          "routes"
        )
      ),
    ]);

    for (const assignmentDoc of assignmentSnap.docs) {
      await writer.queueDelete(assignmentDoc.ref);
    }
    for (const participantDoc of participantScoreSnap.docs) {
      await writer.queueDelete(participantDoc.ref);
    }
    for (const routeDoc of routeSnap.docs) {
      await writer.queueDelete(routeDoc.ref);
    }

    await writer.queueDelete(
      doc(db, "events", eventId, "seasons", seasonId, "categoryTaskMap", categoryId)
    );
    await writer.queueDelete(doc(db, "events", eventId, "seasons", seasonId, "categories", categoryId));
  }

  await writer.queueDelete(doc(db, "events", eventId, "categories", categoryId));
  await writer.flush();
};

export const deleteParticipantCascade = async ({ eventId, participantId }) => {
  const writer = createBatchWriter();
  const [seasonSnap, eventCategorySnap] = await Promise.all([
    getDocs(collection(db, "events", eventId, "seasons")),
    getDocs(collection(db, "events", eventId, "categories")),
  ]);

  const defaultCategoryIds = eventCategorySnap.docs.map((categoryDoc) => categoryDoc.id);
  for (const seasonDoc of seasonSnap.docs) {
    const seasonId = seasonDoc.id;
    const categoryIds = await getSeasonCategoryIds(eventId, seasonId, defaultCategoryIds);
    for (const categoryId of categoryIds) {
      await writer.queueDelete(
        doc(
          db,
          "events",
          eventId,
          "seasons",
          seasonId,
          "categories",
          categoryId,
          "participants",
          participantId
        )
      );
    }
  }

  await writer.queueDelete(doc(db, "events", eventId, "participants", participantId));
  await writer.flush();
};

export const cleanupParticipantScoresOutsideCategory = async ({
  eventId,
  participantId,
  keepCategoryId = "",
}) => {
  const writer = createBatchWriter();
  const [seasonSnap, eventCategorySnap] = await Promise.all([
    getDocs(collection(db, "events", eventId, "seasons")),
    getDocs(collection(db, "events", eventId, "categories")),
  ]);

  const defaultCategoryIds = eventCategorySnap.docs.map((categoryDoc) => categoryDoc.id);
  for (const seasonDoc of seasonSnap.docs) {
    const seasonId = seasonDoc.id;
    const categoryIds = await getSeasonCategoryIds(eventId, seasonId, defaultCategoryIds);
    for (const categoryId of categoryIds) {
      if (keepCategoryId && categoryId === keepCategoryId) continue;
      await writer.queueDelete(
        doc(
          db,
          "events",
          eventId,
          "seasons",
          seasonId,
          "categories",
          categoryId,
          "participants",
          participantId
        )
      );
    }
  }

  await writer.flush();
};

export const deleteCategoryTaskAssignment = async ({ eventId, seasonId, categoryId, taskId }) => {
  await deleteDoc(
    doc(
      db,
      "events",
      eventId,
      "seasons",
      seasonId,
      "categoryTaskMap",
      categoryId,
      "assignments",
      taskId
    )
  );
};

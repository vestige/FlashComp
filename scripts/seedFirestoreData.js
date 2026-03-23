import { Timestamp, doc, getDoc, writeBatch } from "firebase/firestore";
import { cleanupScriptFirebase, db, signInForScripts } from "./firestoreClient.js";

function createRandom(seed = 20260216) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function toTimestamp(dateText) {
  return Timestamp.fromDate(new Date(`${dateText}T00:00:00`));
}

function toDateText(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(baseDate, days) {
  const next = new Date(baseDate);
  next.setDate(next.getDate() + days);
  return next;
}

function routeName(routeNo) {
  return `No.${String(routeNo).padStart(2, "0")}`;
}

const gyms = [
  {
    id: "gym-shibuya",
    name: "Shibuya Boulder Lab",
    city: "Tokyo",
    prefecture: "Tokyo",
  },
  {
    id: "gym-yokohama",
    name: "Yokohama Rock Base",
    city: "Yokohama",
    prefecture: "Kanagawa",
  },
];

const ownerProfiles = [
  {
    id: "owner-shibuya",
    email: "owner.shibuya@example.com",
    name: "Shibuya Owner",
    role: "owner",
    gymIds: ["gym-shibuya"],
  },
  {
    id: "owner-yokohama",
    email: "owner.yokohama@example.com",
    name: "Yokohama Owner",
    role: "owner",
    gymIds: ["gym-yokohama"],
  },
  {
    id: "owner-multi",
    email: "owner.multi@example.com",
    name: "Multi Gym Owner",
    role: "admin",
    gymIds: ["*"],
  },
  {
    id: "vestige-sync",
    email: "vestige_sync@me.com",
    name: "Vestige Sync",
    role: "admin",
    gymIds: ["*"],
  },
];

const categoryTemplates = [
  { id: "cat-beginner", name: "Beginner", grades: ["8Q", "7Q", "6Q"], basePoints: 80, clearRate: 0.68 },
  { id: "cat-middle", name: "Middle", grades: ["6Q", "5Q", "4Q"], basePoints: 100, clearRate: 0.55 },
  { id: "cat-open", name: "Open", grades: ["3Q", "2Q", "1Q"], basePoints: 130, clearRate: 0.42 },
  { id: "cat-kids", name: "Kids", grades: ["10Q", "9Q", "8Q"], basePoints: 60, clearRate: 0.74 },
];
const categoryTemplateById = new Map(categoryTemplates.map((category) => [category.id, category]));

const participantsByCategory = {
  "cat-beginner": [
    { id: "p001", name: "Aoi Sato", memberNo: "M-1001", age: 15, gender: "female", grade: "7Q", skill: 0.07 },
    { id: "p002", name: "Riku Tanaka", memberNo: "M-1002", age: 16, gender: "male", grade: "6Q", skill: 0.03 },
    { id: "p003", name: "Mio Yamamoto", memberNo: "M-1003", age: 13, gender: "female", grade: "8Q", skill: -0.04 },
    { id: "p004", name: "Ren Kato", memberNo: "M-1004", age: 18, gender: "male", grade: "6Q", skill: 0.01 },
  ],
  "cat-middle": [
    { id: "p101", name: "Yui Suzuki", memberNo: "M-1101", age: 22, gender: "female", grade: "5Q", skill: 0.04 },
    { id: "p102", name: "Sora Ito", memberNo: "M-1102", age: 27, gender: "male", grade: "4Q", skill: 0.08 },
    { id: "p103", name: "Nagi Watanabe", memberNo: "M-1103", age: 24, gender: "female", grade: "5Q", skill: -0.02 },
    { id: "p104", name: "Daichi Mori", memberNo: "M-1104", age: 30, gender: "male", grade: "4Q", skill: 0.02 },
  ],
  "cat-open": [
    { id: "p201", name: "Kai Inoue", memberNo: "M-1201", age: 31, gender: "male", grade: "2Q", skill: 0.09 },
    { id: "p202", name: "Hina Nishimura", memberNo: "M-1202", age: 28, gender: "female", grade: "1Q", skill: 0.03 },
    { id: "p203", name: "Sei Kobayashi", memberNo: "M-1203", age: 34, gender: "male", grade: "3Q", skill: -0.01 },
    { id: "p204", name: "Rin Nakajima", memberNo: "M-1204", age: 26, gender: "female", grade: "2Q", skill: 0.05 },
  ],
  "cat-kids": [
    { id: "pk01", name: "Sena Aoki", memberNo: "K-2001", age: 10, gender: "female", grade: "9Q", skill: 0.05 },
    { id: "pk02", name: "Taiga Ueno", memberNo: "K-2002", age: 11, gender: "male", grade: "8Q", skill: 0.01 },
    { id: "pk03", name: "Yuna Hase", memberNo: "K-2003", age: 9, gender: "female", grade: "10Q", skill: -0.03 },
  ],
};

function buildLiveEvent() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const season1Start = addDays(today, -30);
  const season1End = addDays(today, -11);
  const season2Start = addDays(today, -10);
  const season2End = addDays(today, 20);
  const season3Start = addDays(today, 21);
  const season3End = addDays(today, 50);

  return {
    id: "event-live-now",
    name: "FlashComp Live Now",
    gymId: "gym-shibuya",
    startDate: toDateText(season1Start),
    endDate: toDateText(season3End),
    seasons: [
      {
        id: "season-01",
        name: "Phase 1",
        startDate: toDateText(season1Start),
        endDate: toDateText(season1End),
      },
      {
        id: "season-02",
        name: "Phase 2",
        startDate: toDateText(season2Start),
        endDate: toDateText(season2End),
      },
      {
        id: "season-03",
        name: "Phase 3",
        startDate: toDateText(season3Start),
        endDate: toDateText(season3End),
      },
    ],
    routesPerCategory: 10,
  };
}

function buildUpcomingEvent() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const season1Start = addDays(today, 18);
  const season1End = addDays(today, 47);
  const season2Start = addDays(today, 48);
  const season2End = addDays(today, 78);

  return {
    id: "event-upcoming-2026",
    name: "FlashComp Upcoming 2026",
    gymId: "gym-yokohama",
    startDate: toDateText(season1Start),
    endDate: toDateText(season2End),
    seasons: [
      {
        id: "season-01",
        name: "Advance Phase",
        startDate: toDateText(season1Start),
        endDate: toDateText(season1End),
      },
      {
        id: "season-02",
        name: "Final Phase",
        startDate: toDateText(season2Start),
        endDate: toDateText(season2End),
      },
    ],
    routesPerCategory: 9,
  };
}

const events = [
  {
    id: "event-spring-2026",
    name: "FlashComp Spring 2026",
    gymId: "gym-shibuya",
    startDate: "2026-03-01",
    endDate: "2026-05-31",
    seasons: [
      { id: "season-01", name: "Season 1", startDate: "2026-03-01", endDate: "2026-03-31" },
      { id: "season-02", name: "Season 2", startDate: "2026-04-01", endDate: "2026-04-30" },
      { id: "season-03", name: "Season 3", startDate: "2026-05-01", endDate: "2026-05-31" },
    ],
    routesPerCategory: 12,
  },
  {
    id: "event-autumn-2025",
    name: "FlashComp Autumn 2025",
    gymId: "gym-yokohama",
    startDate: "2025-09-01",
    endDate: "2025-11-30",
    seasons: [
      { id: "season-01", name: "Qualifier", startDate: "2025-09-01", endDate: "2025-09-30" },
      { id: "season-02", name: "Middle Round", startDate: "2025-10-01", endDate: "2025-10-31" },
      { id: "season-03", name: "Final Round", startDate: "2025-11-01", endDate: "2025-11-30" },
    ],
    routesPerCategory: 10,
  },
  {
    id: "event-rookie-cup-2026",
    name: "Rookie Cup 2026",
    gymId: "gym-yokohama",
    startDate: "2026-01-12",
    endDate: "2026-02-10",
    seasons: [
      { id: "season-01", name: "Rookie Session", startDate: "2026-01-12", endDate: "2026-02-10" },
    ],
    routesPerCategory: 8,
    categoryIds: ["cat-beginner"],
    participantIdsByCategory: {
      "cat-beginner": ["p001", "p002", "p003"],
    },
  },
  {
    id: "event-endurance-2026",
    name: "Endurance Challenge 2026",
    gymId: "gym-yokohama",
    startDate: "2026-06-01",
    endDate: "2026-09-30",
    seasons: [
      { id: "season-01", name: "June Stage", startDate: "2026-06-01", endDate: "2026-06-30" },
      { id: "season-02", name: "July Stage", startDate: "2026-07-01", endDate: "2026-07-31" },
      { id: "season-03", name: "August Stage", startDate: "2026-08-01", endDate: "2026-08-31" },
      { id: "season-04", name: "September Stage", startDate: "2026-09-01", endDate: "2026-09-30" },
    ],
    categoryIds: ["cat-middle", "cat-open"],
    routesPerCategoryByCategory: {
      "cat-middle": 11,
      "cat-open": 14,
    },
    participantIdsByCategory: {
      "cat-middle": ["p101", "p102", "p103"],
      "cat-open": ["p201", "p202", "p204"],
    },
  },
  {
    id: "event-edge-mixed-2026",
    name: "Edge Case Mixed Cup 2026",
    gymId: "gym-shibuya",
    startDate: "2025-12-01",
    endDate: "2026-01-15",
    seasons: [
      { id: "season-01", name: "Trial Stage", startDate: "2025-12-01", endDate: "2025-12-20" },
      { id: "season-02", name: "Mix Stage", startDate: "2025-12-21", endDate: "2026-01-15" },
    ],
    categoryIds: ["cat-beginner", "cat-kids"],
    routesPerCategoryByCategory: {
      "cat-beginner": 7,
      "cat-kids": 5,
    },
    participantIdsByCategory: {
      "cat-beginner": ["p001", "p002"],
      "cat-kids": ["pk01", "pk02", "pk03"],
    },
  },
  buildLiveEvent(),
  buildUpcomingEvent(),
];

const seasonParticipationByEvent = {
  "event-spring-2026": {
    p004: ["season-02", "season-03"], // joins from Season 2
    p103: ["season-02", "season-03"], // joins from Season 2
    p204: ["season-03"], // joins only Season 3
    p002: ["season-01", "season-03"], // skips Season 2
  },
  "event-live-now": {
    p003: ["season-02", "season-03"], // joins from Phase 2
    p104: ["season-02", "season-03"], // joins from Phase 2
    p203: ["season-01", "season-03"], // skips Phase 2
  },
  "event-endurance-2026": {
    p103: ["season-01", "season-02", "season-04"], // skips season-03
    p204: ["season-02", "season-03", "season-04"], // joins from season-02
  },
  "event-edge-mixed-2026": {
    p002: ["season-02"], // enters only mix stage
    pk03: ["season-02"], // kids participant joins late
  },
};

const restoreEdgeCasesByEvent = {
  "event-edge-mixed-2026": [
    {
      id: "mixed-array",
      data: {
        kind: "mixed-array",
        values: ["alpha", 1, true, null, { nested: "ok" }, ["beta", 2]],
        notes: "Restore validation for mixed array element types.",
      },
    },
    {
      id: "non-array-field",
      data: {
        kind: "non-array-field",
        participatingSeasonIds: "season-01",
        gymIds: null,
        metadata: { source: "seed", version: 2 },
      },
    },
    {
      id: "sparse-map",
      data: {
        kind: "sparse-map",
        scores: { "No.01": true, "No.02": "1", "No.03": null, "No.04": 0 },
        participants: ["p001", "pk01"],
      },
    },
  ],
  "event-endurance-2026": [
    {
      id: "nested-structure",
      data: {
        kind: "nested-structure",
        checkpoints: [
          { seasonId: "season-01", state: "ok" },
          { seasonId: "season-02", state: "ok" },
          { seasonId: "season-03", state: "warn" },
          { seasonId: "season-04", state: "ok" },
        ],
        tags: ["ops", "restore", "backup"],
        nullableValue: null,
      },
    },
  ],
};

function resolveParticipatingSeasonIds(event, seasonIndexById, participantId) {
  const configured = seasonParticipationByEvent[event.id]?.[participantId];
  if (!Array.isArray(configured) || configured.length === 0) {
    return event.seasons.map((season) => season.id);
  }

  const valid = configured
    .filter((seasonId) => seasonIndexById.has(seasonId))
    .sort((a, b) => seasonIndexById.get(a) - seasonIndexById.get(b));

  if (valid.length === 0) {
    return event.seasons.map((season) => season.id);
  }

  return valid;
}

function resolveCategoriesForEvent(event) {
  const configuredCategoryIds = Array.isArray(event.categoryIds)
    ? event.categoryIds.filter((categoryId) => categoryTemplateById.has(categoryId))
    : [];
  const categoryIds =
    configuredCategoryIds.length > 0
      ? configuredCategoryIds
      : categoryTemplates.map((category) => category.id);
  return categoryIds
    .map((categoryId) => categoryTemplateById.get(categoryId))
    .filter((category) => Boolean(category));
}

function resolveParticipantsForEventCategory(event, categoryId) {
  const defaults = participantsByCategory[categoryId] || [];
  const participantIds = event.participantIdsByCategory?.[categoryId];
  if (!Array.isArray(participantIds) || participantIds.length === 0) {
    return defaults;
  }
  const participantIdSet = new Set(participantIds);
  return defaults.filter((participant) => participantIdSet.has(participant.id));
}

function resolveRoutesPerCategory(event, categoryId) {
  const byCategory = event.routesPerCategoryByCategory || {};
  const raw = Number(byCategory[categoryId] ?? event.routesPerCategory ?? 10);
  if (!Number.isFinite(raw)) return 10;
  return Math.max(1, Math.trunc(raw));
}

async function seed() {
  const signedInUser = await signInForScripts();
  if (!signedInUser) {
    console.error("Authentication is required for seed under current Firestore rules.");
    console.error("Set env vars and run again:");
    console.error(
      "$env:SCRIPT_AUTH_EMAIL='owner.multi@example.com'; $env:SCRIPT_AUTH_PASSWORD='YOUR_PASSWORD'; npm run db:seed"
    );
    process.exit(1);
  }

  const includeSystem = process.argv.includes("--include-system");
  const ownerProfileSnap = await getDoc(doc(db, "users", signedInUser.uid));
  const ownerProfile = ownerProfileSnap.exists() ? ownerProfileSnap.data() : {};
  const allowedGymIds = Array.isArray(ownerProfile.gymIds)
    ? ownerProfile.gymIds.filter((id) => typeof id === "string" && id.trim().length > 0)
    : [];
  const hasAllGymAccess = ownerProfile.role === "admin" || allowedGymIds.includes("*");

  if (!hasAllGymAccess && allowedGymIds.length === 0) {
    console.error(`No gymIds found in users/${signedInUser.uid}. Cannot seed events.`);
    process.exit(1);
  }

  console.log(`[auth] signed in as: ${signedInUser.email || signedInUser.uid}`);
  console.log(`[mode] include system collections: ${includeSystem ? "yes" : "no"}`);
  console.log(`[mode] allowed gyms: ${hasAllGymAccess ? "ALL" : JSON.stringify(allowedGymIds)}`);

  const random = createRandom();
  let batch = writeBatch(db);
  let opCount = 0;
  let seededEventCount = 0;
  let skippedEventCount = 0;

  async function queueSet(pathSegments, data) {
    const ref = doc(db, ...pathSegments);
    batch.set(ref, data);
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

  if (includeSystem) {
    for (const gym of gyms) {
      await queueSet(["gyms", gym.id], {
        name: gym.name,
        city: gym.city,
        prefecture: gym.prefecture,
        createdAt: Timestamp.now(),
      });
    }

    for (const owner of ownerProfiles) {
      await queueSet(["users", owner.id], {
        uid: owner.id,
        email: owner.email,
        name: owner.name,
        role: owner.role,
        gymIds: owner.gymIds,
        createdAt: Timestamp.now(),
      });
    }
  }

  const manageableEvents = hasAllGymAccess
    ? events
    : events.filter((event) => allowedGymIds.includes(event.gymId));
  skippedEventCount = events.length - manageableEvents.length;

  // Create parent event docs first so subcollection writes pass canManageEvent(eventId) rules.
  for (const event of manageableEvents) {
    await queueSet(["events", event.id], {
      name: event.name,
      gymId: event.gymId,
      startDate: toTimestamp(event.startDate),
      endDate: toTimestamp(event.endDate),
      createdAt: Timestamp.now(),
    });
  }
  await flushBatch();

  for (const event of manageableEvents) {
    seededEventCount += 1;
    const seasonIndexById = new Map(event.seasons.map((season, index) => [season.id, index]));
    const participantSeasonIdsById = new Map();
    const eventCategories = resolveCategoriesForEvent(event);
    const eventParticipantsByCategory = new Map(
      eventCategories.map((category) => [
        category.id,
        resolveParticipantsForEventCategory(event, category.id),
      ])
    );

    for (const season of event.seasons) {
      await queueSet(["events", event.id, "seasons", season.id], {
        name: season.name,
        startDate: toTimestamp(season.startDate),
        endDate: toTimestamp(season.endDate),
      });
    }

    for (const category of eventCategories) {
      await queueSet(["events", event.id, "categories", category.id], {
        name: category.name,
      });
    }

    for (const category of eventCategories) {
      const participants = eventParticipantsByCategory.get(category.id) || [];

      for (const participant of participants) {
        const participatingSeasonIds = resolveParticipatingSeasonIds(
          event,
          seasonIndexById,
          participant.id
        );
        const entrySeasonId = participatingSeasonIds[0];
        participantSeasonIdsById.set(participant.id, participatingSeasonIds);

        await queueSet(["events", event.id, "participants", participant.id], {
          name: participant.name,
          memberNo: participant.memberNo,
          age: participant.age,
          gender: participant.gender,
          grade: participant.grade,
          categoryId: category.id,
          entrySeasonId,
          participatingSeasonIds,
          createdAt: Timestamp.now(),
        });
      }
    }

    for (const season of event.seasons) {
      for (const category of eventCategories) {
        const routes = [];
        const routeCount = resolveRoutesPerCategory(event, category.id);

        for (let i = 1; i <= routeCount; i += 1) {
          const grade = category.grades[(i - 1) % category.grades.length];
          const isBonus = i % 6 === 0;
          const points = category.basePoints + (routeCount - i) * 5 + (isBonus ? 10 : 0);
          const name = routeName(i);

          routes.push({ name, points, isBonus });

          await queueSet(
            ["events", event.id, "seasons", season.id, "categories", category.id, "routes", name],
            { name, routeNo: i, grade, points, isBonus }
          );
        }

        const participants = eventParticipantsByCategory.get(category.id) || [];
        for (const participant of participants) {
          const participatingSeasonIds = participantSeasonIdsById.get(participant.id) || [];
          const isParticipating = participatingSeasonIds.includes(season.id);

          const scores = {};
          const clearRate = Math.min(0.92, Math.max(0.18, category.clearRate + participant.skill));

          for (const route of routes) {
            const clear = isParticipating ? random() < clearRate : false;
            scores[route.name] = clear;
          }

          await queueSet(
            ["events", event.id, "seasons", season.id, "categories", category.id, "participants", participant.id],
            {
              participantName: participant.name,
              participantGrade: participant.grade,
              participated: isParticipating,
              seasonStatus: isParticipating ? "active" : "absent",
              scores,
              updatedAt: isParticipating ? Timestamp.now() : null,
            }
          );
        }
      }
    }

    const edgeCases = restoreEdgeCasesByEvent[event.id] || [];
    for (const edge of edgeCases) {
      await queueSet(["events", event.id, "restoreEdgeCases", edge.id], {
        ...edge.data,
        createdAt: Timestamp.now(),
      });
    }
  }

  await flushBatch();

  return { seededEventCount, skippedEventCount, includeSystem };
}

seed()
  .then((result) => {
    console.log("Seed completed.");
    console.log("Created: events, seasons, categories, routes, participants, scores.");
    console.log(`Seeded events: ${result.seededEventCount}, skipped by gym scope: ${result.skippedEventCount}`);
    if (!result.includeSystem) {
      console.log("System collections (gyms/users): --include-system not used by default.");
    }
  })
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanupScriptFirebase();
    process.exit(process.exitCode ?? 0);
  });

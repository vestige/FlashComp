import { Timestamp, doc, writeBatch } from "firebase/firestore";
import { db } from "./firestoreClient.js";

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

const categoryTemplates = [
  { id: "cat-beginner", name: "Beginner", grades: ["8Q", "7Q", "6Q"], basePoints: 80, clearRate: 0.68 },
  { id: "cat-middle", name: "Middle", grades: ["6Q", "5Q", "4Q"], basePoints: 100, clearRate: 0.55 },
  { id: "cat-open", name: "Open", grades: ["3Q", "2Q", "1Q"], basePoints: 130, clearRate: 0.42 },
];

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
};

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
];

async function seed() {
  const random = createRandom();
  let batch = writeBatch(db);
  let opCount = 0;

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

  for (const gym of gyms) {
    await queueSet(["gyms", gym.id], {
      name: gym.name,
      city: gym.city,
      prefecture: gym.prefecture,
      createdAt: Timestamp.now(),
    });
  }

  for (const event of events) {
    await queueSet(["events", event.id], {
      name: event.name,
      gymId: event.gymId,
      startDate: toTimestamp(event.startDate),
      endDate: toTimestamp(event.endDate),
      createdAt: Timestamp.now(),
    });

    for (const season of event.seasons) {
      await queueSet(["events", event.id, "seasons", season.id], {
        name: season.name,
        startDate: toTimestamp(season.startDate),
        endDate: toTimestamp(season.endDate),
      });
    }

    for (const category of categoryTemplates) {
      await queueSet(["events", event.id, "categories", category.id], {
        name: category.name,
      });
    }

    for (const category of categoryTemplates) {
      const participants = participantsByCategory[category.id];

      for (const participant of participants) {
        await queueSet(["events", event.id, "participants", participant.id], {
          name: participant.name,
          memberNo: participant.memberNo,
          age: participant.age,
          gender: participant.gender,
          grade: participant.grade,
          categoryId: category.id,
          createdAt: Timestamp.now(),
        });
      }
    }

    for (const season of event.seasons) {
      for (const category of categoryTemplates) {
        const routes = [];

        for (let i = 1; i <= event.routesPerCategory; i += 1) {
          const grade = category.grades[(i - 1) % category.grades.length];
          const isBonus = i % 6 === 0;
          const points = category.basePoints + (event.routesPerCategory - i) * 5 + (isBonus ? 10 : 0);
          const name = routeName(i);

          routes.push({ name, points, isBonus });

          await queueSet(
            ["events", event.id, "seasons", season.id, "categories", category.id, "routes", name],
            { name, routeNo: i, grade, points, isBonus }
          );
        }

        const participants = participantsByCategory[category.id];
        for (const participant of participants) {
          const scores = {};
          const clearRate = Math.min(0.92, Math.max(0.18, category.clearRate + participant.skill));

          for (const route of routes) {
            const clear = random() < clearRate;
            scores[route.name] = clear;
          }

          await queueSet(
            ["events", event.id, "seasons", season.id, "categories", category.id, "participants", participant.id],
            {
              participantName: participant.name,
              participantGrade: participant.grade,
              scores,
              updatedAt: Timestamp.now(),
            }
          );
        }
      }
    }
  }

  if (opCount > 0) {
    await batch.commit();
  }
}

seed()
  .then(() => {
    console.log("Seed completed.");
    console.log("Created: gyms, events, seasons, categories, routes, participants, scores.");
  })
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  });

import { collection, getDocs } from "firebase/firestore";
import {
  buildAssignedTasks,
  buildTaskByScoreKey,
  fetchCategoryAssignments,
  fetchSeasonTasks,
} from "./taskAssignments";

const toTimestampMs = (value) => {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.seconds === "number") return value.seconds * 1000;
  return 0;
};

const buildInitialCategoryMap = (categories, participants) => {
  const result = {};
  for (const category of categories) {
    const byParticipantId = new Map();
    for (const participant of participants.filter((p) => p.categoryId === category.id)) {
      byParticipantId.set(participant.id, {
        participantId: participant.id,
        name: participant.name || "名無し",
        memberNo: participant.memberNo || "-",
        totalPoints: 0,
        clearCount: 0,
        latestUpdatedAt: 0,
      });
    }
    result[category.id] = byParticipantId;
  }
  return result;
};

const buildRankings = (categoryMap) => {
  const rankings = {};

  for (const [categoryId, participants] of Object.entries(categoryMap)) {
    const sorted = Array.from(participants.values()).sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      if (b.clearCount !== a.clearCount) return b.clearCount - a.clearCount;
      return a.name.localeCompare(b.name, "ja");
    });

    let prevPoints = null;
    let prevClears = null;
    let rank = 0;

    rankings[categoryId] = sorted.map((row, index) => {
      if (row.totalPoints !== prevPoints || row.clearCount !== prevClears) {
        rank = index + 1;
      }
      prevPoints = row.totalPoints;
      prevClears = row.clearCount;
      return { ...row, rank };
    });
  }

  return rankings;
};

export const calculateRankingRows = async ({
  db,
  eventId,
  seasons,
  categories,
  participants,
  selectedSeasonId = "all",
}) => {
  const targetSeasonIds =
    selectedSeasonId === "all"
      ? seasons.map((season) => season.id)
      : [selectedSeasonId].filter(Boolean);

  if (targetSeasonIds.length === 0) return [];

  const categoryMap = buildInitialCategoryMap(categories, participants);
  const participantById = new Map(participants.map((participant) => [participant.id, participant]));

  const seasonTasksBySeasonId = new Map(
    await Promise.all(
      targetSeasonIds.map(async (seasonId) => [seasonId, await fetchSeasonTasks(eventId, seasonId)])
    )
  );

  const fetchTasks = targetSeasonIds.flatMap((seasonId) =>
    categories.map(async (category) => {
      const [assignments, scoreSnap] = await Promise.all([
        fetchCategoryAssignments(eventId, seasonId, category.id),
        getDocs(
          collection(db, "events", eventId, "seasons", seasonId, "categories", category.id, "participants")
        ),
      ]);

      return {
        categoryId: category.id,
        assignedTasks: buildAssignedTasks(seasonTasksBySeasonId.get(seasonId) || [], assignments),
        scoreSnap,
      };
    })
  );

  const results = await Promise.all(fetchTasks);

  for (const { categoryId, assignedTasks, scoreSnap } of results) {
    const taskByScoreKey = buildTaskByScoreKey(assignedTasks);
    for (const scoreDoc of scoreSnap.docs) {
      const data = scoreDoc.data();
      const scoreMap = data.scores || {};
      const participantId = scoreDoc.id;

      if (!categoryMap[categoryId].has(participantId)) {
        const fallback = participantById.get(participantId);
        categoryMap[categoryId].set(participantId, {
          participantId,
          name: fallback?.name || data.participantName || `ID:${participantId}`,
          memberNo: fallback?.memberNo || "-",
          totalPoints: 0,
          clearCount: 0,
          latestUpdatedAt: 0,
        });
      }

      const row = categoryMap[categoryId].get(participantId);
      const countedTaskIds = new Set();
      for (const [scoreKey, isCleared] of Object.entries(scoreMap)) {
        if (!isCleared) continue;

        const task = taskByScoreKey.get(scoreKey);
        const canonicalTaskId = task?.id || scoreKey;
        if (countedTaskIds.has(canonicalTaskId)) continue;
        countedTaskIds.add(canonicalTaskId);

        row.totalPoints += Number(task?.points) || 1;
        row.clearCount += 1;
      }
      row.latestUpdatedAt = Math.max(row.latestUpdatedAt, toTimestampMs(data.updatedAt));
    }
  }

  const rankings = buildRankings(categoryMap);
  const seasonScope =
    selectedSeasonId === "all"
      ? "all"
      : seasons.find((season) => season.id === selectedSeasonId)?.name || selectedSeasonId;

  const rows = [];
  for (const category of categories) {
    const rankedRows = rankings[category.id] || [];
    for (const rankedRow of rankedRows) {
      rows.push({
        seasonScope,
        categoryId: category.id,
        categoryName: category.name || category.id,
        rank: rankedRow.rank,
        participantId: rankedRow.participantId,
        participantName: rankedRow.name,
        memberNo: rankedRow.memberNo,
        totalPoints: rankedRow.totalPoints,
        clearCount: rankedRow.clearCount,
      });
    }
  }

  return rows;
};

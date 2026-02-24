import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";

const FALLBACK_TASK_NO = Number.MAX_SAFE_INTEGER;

const toFiniteTaskNo = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

export const toTaskNo = (task) => {
  const explicit = toFiniteTaskNo(task?.taskNo);
  if (explicit != null) return explicit;
  const match = String(task?.name || "").match(/(\d+)/);
  return match ? Number(match[1]) : FALLBACK_TASK_NO;
};

export const sortTasksByTaskNo = (rows = []) => {
  return [...rows].sort((a, b) => {
    const noDiff = toTaskNo(a) - toTaskNo(b);
    if (noDiff !== 0) return noDiff;
    return String(a?.name || "").localeCompare(String(b?.name || ""), "ja");
  });
};

export const buildAssignedTasks = (tasks = [], assignments = []) => {
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const merged = [];

  for (const assignment of assignments) {
    if (assignment?.enabled === false) continue;
    const task = taskById.get(assignment.id);
    if (!task) continue;

    const assignmentTaskNo = toFiniteTaskNo(assignment.taskNo);
    const taskTaskNo = toFiniteTaskNo(task.taskNo);
    merged.push({
      ...task,
      taskNo: taskTaskNo ?? assignmentTaskNo ?? toTaskNo(task),
    });
  }

  return sortTasksByTaskNo(merged);
};

export const buildTaskByScoreKey = (tasks = []) => {
  const map = new Map();
  for (const task of tasks) {
    if (task.id) map.set(task.id, task);
    if (task.name) map.set(task.name, task);
  }
  return map;
};

export const getScoreValueByTask = (scoreMap, task) => {
  if (!scoreMap || !task) return false;
  if (task.id && task.id in scoreMap) return !!scoreMap[task.id];
  if (task.name && task.name in scoreMap) return !!scoreMap[task.name];
  return false;
};

export const fetchSeasonTasks = async (eventId, seasonId) => {
  const taskSnap = await getDocs(collection(db, "events", eventId, "seasons", seasonId, "tasks"));
  const tasks = taskSnap.docs.map((taskDoc) => ({ id: taskDoc.id, ...taskDoc.data() }));
  return sortTasksByTaskNo(tasks);
};

export const fetchCategoryAssignments = async (eventId, seasonId, categoryId) => {
  const assignmentSnap = await getDocs(
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
  );

  return assignmentSnap.docs.map((assignmentDoc) => ({
    id: assignmentDoc.id,
    ...assignmentDoc.data(),
  }));
};

export const fetchAssignedTasksForCategory = async ({
  eventId,
  seasonId,
  categoryId,
  seasonTasks,
}) => {
  const [tasks, assignments] = await Promise.all([
    seasonTasks ? Promise.resolve(seasonTasks) : fetchSeasonTasks(eventId, seasonId),
    fetchCategoryAssignments(eventId, seasonId, categoryId),
  ]);

  return buildAssignedTasks(tasks, assignments);
};

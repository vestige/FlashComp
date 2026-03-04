import { useEffect, useMemo, useState } from "react";
import { collection, deleteDoc, doc, getDocs, setDoc } from "firebase/firestore";
import { useParams } from "react-router-dom";
import { db } from "../firebase";

const GRADE_OPTIONS = [
  "9級",
  "8級",
  "7級",
  "6級",
  "5級",
  "4級",
  "3級",
  "2級",
  "1級",
  "初段",
  "2段",
];

const toTaskNo = (task) => {
  if (typeof task.taskNo === "number" && Number.isFinite(task.taskNo)) return task.taskNo;
  const match = String(task.name || "").match(/(\d+)/);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
};

const sortTasks = (rows) => {
  return [...rows].sort((a, b) => {
    const noDiff = toTaskNo(a) - toTaskNo(b);
    if (noDiff !== 0) return noDiff;
    return String(a.name || "").localeCompare(String(b.name || ""), "ja");
  });
};

const PlusIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-4 w-4"
    aria-hidden="true"
  >
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const RouteSelector = ({
  eventId: eventIdProp,
  categories: categoriesProp = [],
  fixedSeasonId = "",
  hideSeasonSelector = false,
  title = "🧩 課題設定",
}) => {
  const params = useParams();
  const eventId = eventIdProp || params.eventId;

  const [seasons, setSeasons] = useState([]);
  const [categories, setCategories] = useState(categoriesProp);
  const [selectedSeason, setSelectedSeason] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [tasks, setTasks] = useState([]);
  const [assignedTaskIds, setAssignedTaskIds] = useState([]);
  const [status, setStatus] = useState("");
  const addTaskButtonClass =
    "inline-flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-800/15 transition hover:bg-emerald-800";

  const assignedSet = useMemo(() => new Set(assignedTaskIds), [assignedTaskIds]);

  useEffect(() => {
    if (!eventId) return;

    const fetchBaseData = async () => {
      const seasonSnap = await getDocs(collection(db, "events", eventId, "seasons"));
      setSeasons(seasonSnap.docs.map((seasonDoc) => ({ id: seasonDoc.id, ...seasonDoc.data() })));

      if (categoriesProp.length > 0) {
        setCategories(categoriesProp);
        return;
      }

      const categorySnap = await getDocs(collection(db, "events", eventId, "categories"));
      setCategories(categorySnap.docs.map((categoryDoc) => ({ id: categoryDoc.id, ...categoryDoc.data() })));
    };

    fetchBaseData();
  }, [eventId, categoriesProp]);

  useEffect(() => {
    if (!fixedSeasonId) return;
    setSelectedSeason(fixedSeasonId);
  }, [fixedSeasonId]);

  useEffect(() => {
    if (!eventId || !selectedSeason) {
      setTasks([]);
      setAssignedTaskIds([]);
      return;
    }

    const fetchTasks = async () => {
      const taskSnap = await getDocs(collection(db, "events", eventId, "seasons", selectedSeason, "tasks"));
      const rows = taskSnap.docs.map((taskDoc) => ({
        id: taskDoc.id,
        ...taskDoc.data(),
        isEditing: false,
      }));
      setTasks(sortTasks(rows));
    };

    fetchTasks();
  }, [eventId, selectedSeason]);

  useEffect(() => {
    if (!eventId || !selectedSeason || !selectedCategory) {
      setAssignedTaskIds([]);
      return;
    }

    const fetchAssignments = async () => {
      const assignSnap = await getDocs(
        collection(
          db,
          "events",
          eventId,
          "seasons",
          selectedSeason,
          "categoryTaskMap",
          selectedCategory,
          "assignments"
        )
      );
      setAssignedTaskIds(assignSnap.docs.map((assignmentDoc) => assignmentDoc.id));
    };

    fetchAssignments();
  }, [eventId, selectedSeason, selectedCategory]);

  const clearStatusLater = () => {
    setTimeout(() => setStatus(""), 2000);
  };

  const taskDocRef = (taskId) =>
    doc(db, "events", eventId, "seasons", selectedSeason, "tasks", taskId);

  const assignmentDocRef = (categoryId, taskId) =>
    doc(
      db,
      "events",
      eventId,
      "seasons",
      selectedSeason,
      "categoryTaskMap",
      categoryId,
      "assignments",
      taskId
    );

  const nextTaskNo = () => {
    const used = new Set(tasks.map((task) => toTaskNo(task)).filter((value) => Number.isFinite(value)));
    let candidate = 1;
    while (used.has(candidate)) candidate += 1;
    return candidate;
  };

  const handleAddTask = () => {
    if (!selectedSeason) {
      setStatus("❌ 先にシーズンを選択してください");
      clearStatusLater();
      return;
    }

    const taskNo = nextTaskNo();
    const padded = String(taskNo).padStart(2, "0");
    const taskId = `task-${padded}`;

    setTasks((prev) =>
      sortTasks([
        ...prev,
        {
          id: taskId,
          taskNo,
          name: `No.${padded}`,
          grade: "",
          points: 1,
          isBonus: false,
          isEditing: true,
          isNew: true,
        },
      ])
    );
  };

  const handleTaskChange = (index, field, value) => {
    setTasks((prev) => {
      const next = [...prev];
      const row = { ...next[index] };
      row[field] = field === "isBonus" ? value.target.checked : value;
      next[index] = row;
      return next;
    });
  };

  const toggleEdit = (index) => {
    setTasks((prev) => prev.map((task, i) => ({ ...task, isEditing: i === index ? !task.isEditing : false })));
  };

  const handleSaveTask = async (index) => {
    const task = tasks[index];
    if (!task.name?.trim()) {
      setStatus("❌ 課題名は必須です");
      clearStatusLater();
      return;
    }
    if (!task.grade) {
      setStatus("❌ グレードを設定してください");
      clearStatusLater();
      return;
    }

    const payload = {
      name: task.name.trim(),
      taskNo: Number(task.taskNo) || toTaskNo(task),
      grade: task.grade,
      points: Number(task.points) || 1,
      isBonus: Boolean(task.isBonus),
      isActive: true,
    };

    await setDoc(taskDocRef(task.id), payload, { merge: true });

    const mergedTask = { ...task, ...payload, isEditing: false, isNew: false };

    setTasks((prev) => {
      const next = [...prev];
      next[index] = mergedTask;
      return sortTasks(next);
    });
    setStatus(`✅ ${payload.name} を保存しました`);
    clearStatusLater();
  };

  const handleDeleteTask = async (index) => {
    const task = tasks[index];

    await deleteDoc(taskDocRef(task.id));

    await Promise.all(
      categories.map(async (category) => {
        await deleteDoc(assignmentDocRef(category.id, task.id));
      })
    );

    setTasks((prev) => prev.filter((_, i) => i !== index));
    setAssignedTaskIds((prev) => prev.filter((taskId) => taskId !== task.id));
    setStatus("🗑️ 課題を削除しました");
    clearStatusLater();
  };

  const handleToggleAssignment = async (task, checked) => {
    if (!selectedCategory) return;
    if (!task.grade) {
      setStatus("❌ 先に課題を保存してください");
      clearStatusLater();
      return;
    }

    if (checked) {
      await setDoc(assignmentDocRef(selectedCategory, task.id), {
        enabled: true,
        taskNo: toTaskNo(task),
      });
      setAssignedTaskIds((prev) => Array.from(new Set([...prev, task.id])));
      setStatus(`✅ ${task.name} をカテゴリに追加しました`);
    } else {
      await deleteDoc(assignmentDocRef(selectedCategory, task.id));
      setAssignedTaskIds((prev) => prev.filter((id) => id !== task.id));
      setStatus(`🗑️ ${task.name} をカテゴリから外しました`);
    }

    clearStatusLater();
  };

  return (
    <div>
      <h3 className="text-xl font-bold text-slate-900">{title}</h3>
      <p className="mt-1 text-sm text-slate-600">
        先にシーズン共通の課題を作成し、カテゴリごとに採用する課題を選択します。
      </p>

      <div className="mt-3 flex flex-wrap gap-3">
        {!hideSeasonSelector && (
          <label className="text-sm text-slate-700">
            シーズン選択：
            <select
              value={selectedSeason}
              onChange={(e) => setSelectedSeason(e.target.value)}
              className="ml-2 rounded-lg border border-slate-300 px-2 py-1 text-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            >
              <option value="">-- 選択 --</option>
              {seasons.map((season) => (
                <option key={season.id} value={season.id}>
                  {season.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="text-sm text-slate-700">
          カテゴリ選択：
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="ml-2 rounded-lg border border-slate-300 px-2 py-1 text-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
          >
            <option value="">-- 選択 --</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {selectedSeason && (
        <>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-slate-600">課題数: {tasks.length}</span>
              {selectedCategory && (
                <span className="text-sm text-slate-600">
                  カテゴリ採用数: {assignedTaskIds.length}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={handleAddTask}
              className={addTaskButtonClass}
            >
              <PlusIcon />
              課題を追加
            </button>
          </div>

          <table className="mt-4 w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border-b border-slate-200 py-2 text-left">課題名</th>
                <th className="border-b border-slate-200 py-2 text-left">グレード</th>
                <th className="border-b border-slate-200 py-2 text-left">ポイント</th>
                <th className="border-b border-slate-200 py-2 text-left">ボーナス</th>
                <th className="border-b border-slate-200 py-2 text-left">カテゴリ採用</th>
                <th className="border-b border-slate-200 py-2 text-left">操作</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task, index) => (
                <tr key={task.id}>
                  <td className="py-2">
                    {task.isEditing ? (
                      <input
                        value={task.name || ""}
                        onChange={(e) => handleTaskChange(index, "name", e.target.value)}
                        placeholder="課題名"
                        className="w-full rounded-lg border border-slate-300 px-2 py-1 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                      />
                    ) : (
                      task.name
                    )}
                  </td>
                  <td className="py-2">
                    {task.isEditing ? (
                      <select
                        value={task.grade || ""}
                        onChange={(e) => handleTaskChange(index, "grade", e.target.value)}
                        className="rounded-lg border border-slate-300 px-2 py-1 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                      >
                        <option value="">-- 選択 --</option>
                        {GRADE_OPTIONS.map((grade) => (
                          <option key={grade} value={grade}>
                            {grade}
                          </option>
                        ))}
                      </select>
                    ) : (
                      task.grade || "-"
                    )}
                  </td>
                  <td className="py-2">
                    {task.isEditing ? (
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={Number(task.points) || 1}
                        onChange={(e) => handleTaskChange(index, "points", e.target.value)}
                        className="w-24 rounded-lg border border-slate-300 px-2 py-1 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                      />
                    ) : (
                      Number(task.points) || 1
                    )}
                  </td>
                  <td className="py-2">
                    {task.isEditing ? (
                      <input
                        type="checkbox"
                        checked={Boolean(task.isBonus)}
                        onChange={(e) => handleTaskChange(index, "isBonus", e)}
                      />
                    ) : task.isBonus ? (
                      "✅"
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="py-2">
                    <input
                      type="checkbox"
                      disabled={!selectedCategory || !task.grade}
                      checked={selectedCategory ? assignedSet.has(task.id) : false}
                      onChange={(e) => handleToggleAssignment(task, e.target.checked)}
                    />
                  </td>
                  <td className="py-2">
                    {task.isEditing ? (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleSaveTask(index)}
                          className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                        >
                          保存
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleEdit(index)}
                          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                        >
                          キャンセル
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => toggleEdit(index)}
                          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                        >
                          編集
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteTask(index)}
                          className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700 transition hover:bg-rose-100"
                        >
                          削除
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {tasks.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-4 text-sm text-slate-500">
                    課題がありません。まずは「課題を追加」で登録してください。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </>
      )}

      <div className="mt-3 min-h-6">
        {status ? (
          <p
            className={`inline-flex rounded-lg px-3 py-1.5 text-sm ${
              status.startsWith("✅")
                ? "bg-emerald-50 text-emerald-700"
                : status.startsWith("❌")
                  ? "bg-rose-50 text-rose-700"
                  : "bg-slate-100 text-slate-700"
            }`}
          >
            {status}
          </p>
        ) : null}
      </div>
    </div>
  );
};

export default RouteSelector;

import { useEffect, useMemo, useRef, useState } from "react";
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

const STATUS_DURATION_MS = 2000;

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

const PencilIcon = ({ className = "h-5 w-5" }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="m3 21 3.8-1 11-11a2.1 2.1 0 0 0-3-3l-11 11L3 21z" />
    <path d="m14.5 6.5 3 3" />
  </svg>
);

const TrashIcon = ({ className = "h-5 w-5" }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M3 6h18" />
    <path d="M8 6V4h8v2" />
    <path d="M6 6l1 14h10l1-14" />
    <path d="M10 10v7M14 10v7" />
  </svg>
);

const CheckCircleIcon = ({ checked, className = "h-6 w-6" }) => (
  <svg
    viewBox="0 0 24 24"
    fill={checked ? "currentColor" : "none"}
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="9" />
    {checked ? <path d="m8.2 12.2 2.5 2.4 5-5.2" /> : null}
  </svg>
);

const RouteSelector = ({
  eventId: eventIdProp,
  categories: categoriesProp = [],
  fixedSeasonId = "",
  hideSeasonSelector = false,
  title = "🧩 課題設定",
  description = "先にシーズン共通の課題を作成し、カテゴリごとに採用する課題を選択します。",
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
  const statusTimeoutRef = useRef(null);
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
    if (categories.length === 0) {
      setSelectedCategory("");
      return;
    }
    const exists = categories.some((category) => category.id === selectedCategory);
    if (!exists) {
      setSelectedCategory(categories[0].id);
    }
  }, [categories, selectedCategory]);

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

  useEffect(() => {
    return () => {
      if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
    };
  }, []);

  const showStatus = (message) => {
    setStatus(message);
    if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
    statusTimeoutRef.current = setTimeout(() => {
      setStatus("");
      statusTimeoutRef.current = null;
    }, STATUS_DURATION_MS);
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

  const formatTaskNo = (task) => {
    const no = toTaskNo(task);
    if (!Number.isFinite(no) || no === Number.MAX_SAFE_INTEGER) return "--";
    return String(no).padStart(2, "0");
  };

  const validateTask = (task) => {
    if (!task.name?.trim()) return "課題名を入力してください";
    if (!task.grade) return "グレードを選択してください";
    return "";
  };

  const toPayload = (task) => ({
    name: task.name.trim(),
    taskNo: Number(task.taskNo) || toTaskNo(task),
    grade: task.grade,
    points: Number(task.points) || 1,
    isBonus: Boolean(task.isBonus),
    isActive: true,
  });

  const handleAddTask = () => {
    if (!selectedSeason) {
      showStatus("❌ 先にシーズンを選択してください");
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
    const validationMessage = validateTask(task);
    if (validationMessage) {
      showStatus(`❌ ${validationMessage}`);
      return;
    }

    const payload = toPayload(task);
    await setDoc(taskDocRef(task.id), payload, { merge: true });

    const mergedTask = { ...task, ...payload, isEditing: false, isNew: false };
    setTasks((prev) => {
      const next = [...prev];
      next[index] = mergedTask;
      return sortTasks(next);
    });
    showStatus(`✅ 「${payload.name}」を保存しました`);
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
    showStatus("🗑️ 課題を削除しました");
  };

  const handleToggleAssignment = async (task, checked) => {
    if (!selectedCategory) return;
    if (!task.grade) {
      showStatus("❌ 先に課題を保存してください");
      return;
    }

    if (checked) {
      await setDoc(assignmentDocRef(selectedCategory, task.id), {
        enabled: true,
        taskNo: toTaskNo(task),
      });
      setAssignedTaskIds((prev) => Array.from(new Set([...prev, task.id])));
      showStatus(`✅ 「${task.name}」をカテゴリに追加しました`);
    } else {
      await deleteDoc(assignmentDocRef(selectedCategory, task.id));
      setAssignedTaskIds((prev) => prev.filter((id) => id !== task.id));
      showStatus(`🗑️ 「${task.name}」をカテゴリから外しました`);
    }
  };

  return (
    <div>
      {title ? <h3 className="text-xl font-bold text-slate-900">{title}</h3> : null}
      {description ? (
        <p className={`${title ? "mt-1 " : ""}text-sm text-slate-600`}>
          {description}
        </p>
      ) : null}

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
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              {selectedCategory ? (
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
                  Total Routes: {assignedTaskIds.length}
                </span>
              ) : null}
              <span className="text-sm text-slate-500">Season Routes: {tasks.length}</span>
            </div>
            <button
              type="button"
              onClick={handleAddTask}
              className={addTaskButtonClass}
            >
              + Create Route
            </button>
          </div>

          {tasks.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">
              課題がありません。まずは「+ Create Route」で登録してください。
            </p>
          ) : (
            <>
              <div className="mt-4 grid gap-3 md:hidden">
                {tasks.map((task, index) => (
                  <article key={task.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex min-w-10 items-center justify-center rounded-lg bg-slate-200 px-2 py-1 text-base font-extrabold text-slate-700">
                        {formatTaskNo(task)}
                      </span>
                      {task.isEditing ? (
                        <input
                          value={task.name || ""}
                          onChange={(e) => handleTaskChange(index, "name", e.target.value)}
                          placeholder="課題名"
                          className="w-full rounded-lg border border-slate-300 px-2 py-1 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                        />
                      ) : (
                        <p className="text-sm font-semibold text-slate-800">{task.name}</p>
                      )}
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div>
                        <p className="mb-1 text-xs font-semibold text-slate-500">Grade</p>
                        {task.isEditing ? (
                          <select
                            value={task.grade || ""}
                            onChange={(e) => handleTaskChange(index, "grade", e.target.value)}
                            className="w-full rounded-lg border border-slate-300 px-2 py-1 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                          >
                            <option value="">-- 選択 --</option>
                            {GRADE_OPTIONS.map((grade) => (
                              <option key={grade} value={grade}>
                                {grade}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div className="rounded-lg bg-white px-3 py-2 text-sm text-slate-700">{task.grade || "-"}</div>
                        )}
                      </div>
                      <div>
                        <p className="mb-1 text-xs font-semibold text-slate-500">Points</p>
                        {task.isEditing ? (
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={Number(task.points) || 1}
                            onChange={(e) => handleTaskChange(index, "points", e.target.value)}
                            className="w-full rounded-lg border border-slate-300 px-2 py-1 text-right outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                          />
                        ) : (
                          <div className="rounded-lg bg-white px-3 py-2 text-right text-sm font-bold text-emerald-700">
                            {Number(task.points) || 1}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-600">Bonus</span>
                        {task.isEditing ? (
                          <input
                            type="checkbox"
                            checked={Boolean(task.isBonus)}
                            onChange={(e) => handleTaskChange(index, "isBonus", e)}
                          />
                        ) : task.isBonus ? (
                          <span className="inline-flex text-emerald-900">
                            <CheckCircleIcon checked />
                          </span>
                        ) : (
                          <span className="inline-flex text-slate-300">
                            <CheckCircleIcon checked={false} />
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        disabled={!selectedCategory || !task.grade}
                        onClick={() => handleToggleAssignment(task, !assignedSet.has(task.id))}
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold transition ${
                          !selectedCategory || !task.grade
                            ? "cursor-not-allowed bg-slate-100 text-slate-300"
                            : assignedSet.has(task.id)
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                      >
                        <CheckCircleIcon checked={assignedSet.has(task.id)} className="h-4 w-4" />
                        {assignedSet.has(task.id) ? "採用中" : "未採用"}
                      </button>
                    </div>

                    <div className="mt-3 flex flex-wrap justify-end gap-2">
                      {task.isEditing ? (
                        <>
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
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => toggleEdit(index)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                            aria-label="編集"
                          >
                            <PencilIcon />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteTask(index)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-500"
                            aria-label="削除"
                          >
                            <TrashIcon />
                          </button>
                        </>
                      )}
                    </div>
                  </article>
                ))}
              </div>

              <div className="mt-4 hidden md:block">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className="border-b border-slate-200 py-3 text-left text-xs font-bold tracking-wider text-slate-500">
                        Route Name (No.)
                      </th>
                      <th className="border-b border-slate-200 py-3 text-left text-xs font-bold tracking-wider text-slate-500">
                        Grade (級)
                      </th>
                      <th className="border-b border-slate-200 py-3 pr-2 text-right text-xs font-bold tracking-wider text-slate-500">
                        Points
                      </th>
                      <th className="border-b border-slate-200 py-3 text-center text-xs font-bold tracking-wider text-slate-500">
                        Bonus
                      </th>
                      <th className="border-b border-slate-200 py-3 text-center text-xs font-bold tracking-wider text-slate-500">
                        Adoption
                      </th>
                      <th className="border-b border-slate-200 py-3 text-center text-xs font-bold tracking-wider text-slate-500">
                        Actions
                      </th>
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
                            <div className="flex items-center gap-3 rounded-lg bg-slate-100 px-3 py-2 font-semibold text-slate-800">
                              <span className="inline-flex min-w-10 items-center justify-center rounded-lg bg-slate-200 px-2 py-1 text-base font-extrabold text-slate-700">
                                {formatTaskNo(task)}
                              </span>
                              <span>{task.name}</span>
                            </div>
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
                            <div className="rounded-lg bg-slate-100 px-3 py-2 text-slate-700">{task.grade || "-"}</div>
                          )}
                        </td>
                        <td className="py-2 text-right">
                          {task.isEditing ? (
                            <div className="flex justify-end">
                              <input
                                type="number"
                                min="1"
                                step="1"
                                value={Number(task.points) || 1}
                                onChange={(e) => handleTaskChange(index, "points", e.target.value)}
                                className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-right outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                              />
                            </div>
                          ) : (
                            <div className="rounded-lg bg-slate-100 px-3 py-2 font-bold text-emerald-700">
                              {Number(task.points) || 1}
                            </div>
                          )}
                        </td>
                        <td className="py-2 text-center">
                          {task.isEditing ? (
                            <input
                              type="checkbox"
                              checked={Boolean(task.isBonus)}
                              onChange={(e) => handleTaskChange(index, "isBonus", e)}
                            />
                          ) : task.isBonus ? (
                            <span className="inline-flex justify-center text-emerald-900">
                              <CheckCircleIcon checked />
                            </span>
                          ) : (
                            <span className="inline-flex justify-center text-slate-300">
                              <CheckCircleIcon checked={false} />
                            </span>
                          )}
                        </td>
                        <td className="py-2 text-center">
                          <button
                            type="button"
                            disabled={!selectedCategory || !task.grade}
                            onClick={() => handleToggleAssignment(task, !assignedSet.has(task.id))}
                            className={`inline-flex items-center justify-center rounded-full transition ${
                              !selectedCategory || !task.grade
                                ? "cursor-not-allowed text-slate-300"
                                : "text-emerald-900 hover:text-emerald-700"
                            }`}
                            aria-label={assignedSet.has(task.id) ? "採用を解除" : "採用する"}
                          >
                            <CheckCircleIcon checked={assignedSet.has(task.id)} />
                          </button>
                        </td>
                        <td className="py-2 text-center">
                          {task.isEditing ? (
                            <div className="flex flex-wrap justify-center gap-2">
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
                            <div className="flex items-center justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => toggleEdit(index)}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                                aria-label="編集"
                              >
                                <PencilIcon />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteTask(index)}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-500"
                                aria-label="削除"
                              >
                                <TrashIcon />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
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

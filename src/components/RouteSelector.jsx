import { useEffect, useMemo, useState } from "react";
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc } from "firebase/firestore";
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

const RouteSelector = ({ eventId: eventIdProp, categories: categoriesProp = [] }) => {
  const params = useParams();
  const eventId = eventIdProp || params.eventId;

  const [seasons, setSeasons] = useState([]);
  const [categories, setCategories] = useState(categoriesProp);
  const [selectedSeason, setSelectedSeason] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [tasks, setTasks] = useState([]);
  const [assignedTaskIds, setAssignedTaskIds] = useState([]);
  const [status, setStatus] = useState("");

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

  const legacyRouteDocRef = (categoryId, taskId) =>
    doc(
      db,
      "events",
      eventId,
      "seasons",
      selectedSeason,
      "categories",
      categoryId,
      "routes",
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

  const syncLegacyRouteForCategory = async (categoryId, task) => {
    await setDoc(legacyRouteDocRef(categoryId, task.id), {
      name: task.name,
      taskNo: toTaskNo(task),
      grade: task.grade,
      points: Number(task.points) || 1,
      isBonus: Boolean(task.isBonus),
    });
  };

  const syncLegacyRouteForAssignedCategories = async (task) => {
    const checks = await Promise.all(
      categories.map(async (category) => {
        const assignSnap = await getDoc(assignmentDocRef(category.id, task.id));
        return { categoryId: category.id, assigned: assignSnap.exists() };
      })
    );

    const targets = checks.filter((row) => row.assigned).map((row) => row.categoryId);
    await Promise.all(targets.map((categoryId) => syncLegacyRouteForCategory(categoryId, task)));
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

    if (selectedCategory && assignedSet.has(task.id)) {
      await syncLegacyRouteForCategory(selectedCategory, mergedTask);
    }

    await syncLegacyRouteForAssignedCategories(mergedTask);

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
        await Promise.all([
          deleteDoc(assignmentDocRef(category.id, task.id)),
          deleteDoc(legacyRouteDocRef(category.id, task.id)),
        ]);
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
      await syncLegacyRouteForCategory(selectedCategory, task);
      setAssignedTaskIds((prev) => Array.from(new Set([...prev, task.id])));
      setStatus(`✅ ${task.name} をカテゴリに追加しました`);
    } else {
      await Promise.all([
        deleteDoc(assignmentDocRef(selectedCategory, task.id)),
        deleteDoc(legacyRouteDocRef(selectedCategory, task.id)),
      ]);
      setAssignedTaskIds((prev) => prev.filter((id) => id !== task.id));
      setStatus(`🗑️ ${task.name} をカテゴリから外しました`);
    }

    clearStatusLater();
  };

  return (
    <div>
      <h3>🧩 課題設定</h3>
      <p style={{ marginTop: "0.2em", color: "#444" }}>
        先にシーズン共通の課題を作成し、カテゴリごとに採用する課題を選択します。
      </p>
      {status && <p>{status}</p>}

      <div style={{ display: "flex", gap: "0.8em", flexWrap: "wrap" }}>
        <label>
          シーズン選択：
          <select value={selectedSeason} onChange={(e) => setSelectedSeason(e.target.value)}>
            <option value="">-- 選択 --</option>
            {seasons.map((season) => (
              <option key={season.id} value={season.id}>
                {season.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          カテゴリ選択：
          <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
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
          <div style={{ marginTop: "1em", display: "flex", gap: "0.7em", alignItems: "center" }}>
            <button type="button" onClick={handleAddTask}>＋ シーズン課題を追加</button>
            <span style={{ color: "#444" }}>課題数: {tasks.length}</span>
            {selectedCategory && (
              <span style={{ color: "#444" }}>
                カテゴリ採用数: {assignedTaskIds.length}
              </span>
            )}
          </div>

          <table style={{ marginTop: "1em", borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr>
                <th>課題名</th>
                <th>グレード</th>
                <th>ポイント</th>
                <th>ボーナス</th>
                <th>カテゴリ採用</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task, index) => (
                <tr key={task.id}>
                  <td>
                    {task.isEditing ? (
                      <input
                        value={task.name || ""}
                        onChange={(e) => handleTaskChange(index, "name", e.target.value)}
                        placeholder="課題名"
                      />
                    ) : (
                      task.name
                    )}
                  </td>
                  <td>
                    {task.isEditing ? (
                      <select value={task.grade || ""} onChange={(e) => handleTaskChange(index, "grade", e.target.value)}>
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
                  <td>
                    {task.isEditing ? (
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={Number(task.points) || 1}
                        onChange={(e) => handleTaskChange(index, "points", e.target.value)}
                        style={{ width: "5.5em" }}
                      />
                    ) : (
                      Number(task.points) || 1
                    )}
                  </td>
                  <td>
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
                  <td>
                    <input
                      type="checkbox"
                      disabled={!selectedCategory || !task.grade}
                      checked={selectedCategory ? assignedSet.has(task.id) : false}
                      onChange={(e) => handleToggleAssignment(task, e.target.checked)}
                    />
                  </td>
                  <td>
                    {task.isEditing ? (
                      <>
                        <button type="button" onClick={() => handleSaveTask(index)}>保存</button>
                        <button type="button" onClick={() => toggleEdit(index)}>キャンセル</button>
                      </>
                    ) : (
                      <>
                        <button type="button" onClick={() => toggleEdit(index)}>編集</button>
                        <button type="button" onClick={() => handleDeleteTask(index)}>削除</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {tasks.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: "0.8em", color: "#666" }}>
                    課題がありません。まずは「＋ シーズン課題を追加」で登録してください。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
};

export default RouteSelector;

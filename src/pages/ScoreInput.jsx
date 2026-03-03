// src/pages/ScoreInput.jsx
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { usePageTitle } from "../hooks/usePageTitle";
import { useOwnerProfile } from "../hooks/useOwnerProfile";
import {
  fetchAssignedTasksForCategory,
  getScoreValueByTask,
} from "../lib/taskAssignments";

const ScoreInput = () => {
  const { eventId, seasonId, categoryId, participantId } = useParams();
  const [tasks, setTasks] = useState([]);
  const [participantName, setParticipantName] = useState("");
  const [scores, setScores] = useState({});
  const [viewMode, setViewMode] = useState("simple");
  const [showOnlyUncleared, setShowOnlyUncleared] = useState(true);
  const [taskKeyword, setTaskKeyword] = useState("");
  const [status, setStatus] = useState("");
  const [updatedAt, setUpdatedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [accessDenied, setAccessDenied] = useState(false);
  const {
    gymIds,
    hasAllGymAccess,
    loading: profileLoading,
    error: profileError,
  } = useOwnerProfile();
  usePageTitle(participantName ? `スコア入力: ${participantName}` : "スコア入力");

  useEffect(() => {
    if (profileLoading) return;
    if (profileError) {
      setError(profileError);
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError("");
      setAccessDenied(false);
      try {
        const eventSnap = await getDoc(doc(db, "events", eventId));
        if (!eventSnap.exists()) {
          setError("イベントが見つかりません。");
          return;
        }
        if (!hasAllGymAccess && !gymIds.includes(eventSnap.data().gymId)) {
          setAccessDenied(true);
          return;
        }

        const participantSnap = await getDoc(
          doc(db, "events", eventId, "participants", participantId)
        );
        if (!participantSnap.exists()) {
          setError("クライマーが見つかりません。");
          return;
        }
        const participantData = participantSnap.data();
        if ((participantData.categoryId || "") !== categoryId) {
          setError("クライマーのカテゴリと採点対象カテゴリが一致しません。");
          return;
        }
        setParticipantName(participantData.name || "");

        const assignedTasks = await fetchAssignedTasksForCategory({
          eventId,
          seasonId,
          categoryId,
        });
        setTasks(assignedTasks);

        const scoresSnap = await getDoc(
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
        if (scoresSnap.exists()) {
          const data = scoresSnap.data();
          if (data.scores) setScores(data.scores);
          if (data.updatedAt) setUpdatedAt(data.updatedAt.toDate());
        }
      } catch (err) {
        console.error("データの取得に失敗:", err);
        setError("採点データの取得に失敗しました。");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [
    eventId,
    seasonId,
    categoryId,
    participantId,
    gymIds,
    hasAllGymAccess,
    profileLoading,
    profileError,
  ]);

  const resolveScoreKey = (task, scoreMap = {}) => {
    if (task?.id && task.id in scoreMap) return task.id;
    if (task?.name && task.name in scoreMap) return task.name;
    return task?.name || task?.id || "";
  };

  const handleToggleScore = (task) => {
    setScores((prev) => {
      const key = resolveScoreKey(task, prev);
      if (!key) return prev;
      return {
        ...prev,
        [key]: !getScoreValueByTask(prev, task),
      };
    });
  };

  const normalizedKeyword = taskKeyword.trim().toLowerCase();
  const clearCount = tasks.filter((task) => getScoreValueByTask(scores, task)).length;
  const remainingCount = tasks.length - clearCount;
  const visibleTasks = tasks.filter((task) => {
    const matchesKeyword =
      normalizedKeyword.length === 0 ||
      String(task.name || "").toLowerCase().includes(normalizedKeyword);
    if (!matchesKeyword) return false;
    if (!showOnlyUncleared) return true;
    return !getScoreValueByTask(scores, task);
  });

  const applyBulkToVisible = (isCleared) => {
    setScores((prev) => {
      const next = { ...prev };
      for (const task of visibleTasks) {
        const key = resolveScoreKey(task, prev);
        if (!key) continue;
        next[key] = isCleared;
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (accessDenied) return;

    try {
      await setDoc(
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
        ),
        {
          scores,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setStatus("✅ 保存しました");
      setTimeout(() => setStatus(""), 2000);
    } catch (err) {
      console.error("保存失敗:", err);
      setStatus("❌ 保存に失敗しました");
    }
  };

  const statusClass = status.startsWith("✅")
    ? "rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
    : "rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700";
  const backToScoresPath = `/events/${eventId}/scores?scoreSeason=${encodeURIComponent(
    seasonId
  )}&scoreCategory=${encodeURIComponent(categoryId)}`;

  if (loading || profileLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <p className="text-sm text-slate-600">採点画面を読み込んでいます...</p>
      </div>
    );
  }

  if (error || profileError) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error || profileError}
        </p>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          このイベントの採点を行う権限がありません。
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#dbeafe_0%,_#f8fafc_45%,_#ecfeff_100%)]">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="rounded-3xl border border-slate-200 bg-white px-6 py-6 shadow-sm">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">Score Input</p>
          <h2 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">📝 スコア入力</h2>
          <div className="mt-4">
            <Link
              to={backToScoresPath}
              state={{ seasonId, categoryId }}
              className="inline-flex items-center rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              ↩ スコア入口に戻る
            </Link>
          </div>
          <p className="mt-4 text-sm text-slate-700">クライマー: {participantName}</p>
          <p className="mt-1 text-sm text-slate-600">
            完登 {clearCount} / 全{tasks.length}（未完登 {remainingCount}）
          </p>
          {updatedAt && (
            <p className="mt-1 text-xs italic text-slate-500">
              最終更新: {updatedAt.toLocaleString()}
            </p>
          )}
        </header>

        <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setViewMode("simple")}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                viewMode === "simple"
                  ? "border-sky-300 bg-sky-50 text-sky-800"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              簡易表示
            </button>
            <button
              type="button"
              onClick={() => setViewMode("detail")}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                viewMode === "detail"
                  ? "border-sky-300 bg-sky-50 text-sky-800"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              詳細表示
            </button>
            <label className="ml-1 inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={showOnlyUncleared}
                onChange={(e) => setShowOnlyUncleared(e.target.checked)}
                className="size-4 rounded border-slate-300"
              />
              未完登のみ
            </label>
            <label className="ml-1 inline-flex items-center gap-2 text-sm text-slate-700">
              課題検索:
              <input
                type="text"
                value={taskKeyword}
                onChange={(e) => setTaskKeyword(e.target.value)}
                placeholder="No.01"
                className="w-32 rounded-lg border border-slate-300 px-2 py-1 text-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => applyBulkToVisible(true)}
              className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100"
            >
              表示中をすべて完登
            </button>
            <button
              type="button"
              onClick={() => applyBulkToVisible(false)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              表示中をすべて未完登
            </button>
          </div>
        </section>

        <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          {visibleTasks.length === 0 ? (
            <p className="text-sm text-slate-600">表示条件に一致する課題がありません。</p>
          ) : viewMode === "simple" ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {visibleTasks.map((task) => {
                const isCleared = getScoreValueByTask(scores, task);
                return (
                  <button
                    key={task.id || task.name}
                    type="button"
                    onClick={() => handleToggleScore(task)}
                    className={`min-h-[96px] rounded-xl border p-3 text-left transition ${
                      isCleared
                        ? "border-emerald-300 bg-emerald-50"
                        : "border-slate-300 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <div className="font-semibold text-slate-900">{task.name || task.id}</div>
                    <div className="mt-1 text-sm text-slate-600">
                      級: {task.grade || "-"} / 点: {task.points ?? "-"}
                    </div>
                    <div className={`mt-2 text-sm font-semibold ${isCleared ? "text-emerald-700" : "text-slate-700"}`}>
                      {isCleared ? "完登" : "未完登"}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[520px] w-full border-collapse">
              <thead>
                <tr>
                    <th className="border-b border-slate-200 pb-2 text-left text-sm font-semibold text-slate-700">課題</th>
                    <th className="border-b border-slate-200 pb-2 text-left text-sm font-semibold text-slate-700">級</th>
                    <th className="border-b border-slate-200 pb-2 text-right text-sm font-semibold text-slate-700">点数</th>
                    <th className="border-b border-slate-200 pb-2 text-center text-sm font-semibold text-slate-700">完登</th>
                </tr>
              </thead>
              <tbody>
                {visibleTasks.map((task) => (
                  <tr key={task.id || task.name}>
                      <td className="py-2 text-sm text-slate-800">{task.name || task.id}</td>
                      <td className="py-2 text-sm text-slate-700">{task.grade || "-"}</td>
                      <td className="py-2 text-right text-sm text-slate-700">{task.points ?? "-"}</td>
                      <td className="py-2 text-center">
                      <input
                        type="checkbox"
                        checked={getScoreValueByTask(scores, task)}
                        onChange={() => handleToggleScore(task)}
                          className="size-4 rounded border-slate-300"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        </section>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center rounded-lg border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-800 transition hover:bg-sky-100"
          >
            💾 保存
          </button>
          {status && <span className={statusClass}>{status}</span>}
        </div>
      </div>
    </div>
  );
};

export default ScoreInput;

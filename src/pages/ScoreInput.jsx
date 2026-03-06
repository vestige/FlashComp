import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  collection,
  doc,
  getDoc,
  getDocs,
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
import ManagementHero from "../components/ManagementHero";
import {
  pageBackgroundClass,
  pageContainerClass,
  sectionCardClass,
  sectionHeadingClass,
} from "../components/uiStyles";

const ScoreInput = () => {
  const { eventId, seasonId, categoryId, participantId } = useParams();
  const [tasks, setTasks] = useState([]);
  const [participantName, setParticipantName] = useState("");
  const [participantInfo, setParticipantInfo] = useState({
    memberNo: "-",
    grade: "-",
    categoryName: "-",
  });
  const [scores, setScores] = useState({});
  const [savedScores, setSavedScores] = useState({});
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

  usePageTitle("Score Input");

  const taskScoreEquals = (baseScores, nextScores, task) => {
    return getScoreValueByTask(baseScores, task) === getScoreValueByTask(nextScores, task);
  };

  const hasUnsavedChanges = tasks.some((task) => !taskScoreEquals(savedScores, scores, task));

  const resolveScoreKey = (task, scoreMap = {}) => {
    if (task?.id && task.id in scoreMap) return task.id;
    if (task?.name && task.name in scoreMap) return task.name;
    return task?.name || task?.id || "";
  };

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

        const [participantSnap, assignedTasks, categorySnap] = await Promise.all([
          getDoc(doc(db, "events", eventId, "participants", participantId)),
          fetchAssignedTasksForCategory({
            eventId,
            seasonId,
            categoryId,
          }),
          getDocs(collection(db, "events", eventId, "categories")),
        ]);

        if (!participantSnap.exists()) {
          setError("クライマーが見つかりません。");
          return;
        }

        const participantData = participantSnap.data();
        if ((participantData.categoryId || "") !== categoryId) {
          setError("クライマーのカテゴリと採点対象カテゴリが一致しません。");
          return;
        }

        const categoryNameMap = new Map(categorySnap.docs.map((categoryDoc) => [
          categoryDoc.id,
          categoryDoc.data().name || "",
        ]));

        setParticipantName(participantData.name || "");
        setParticipantInfo({
          memberNo: participantData.memberNo || "-",
          grade: participantData.grade || "-",
          categoryName: categoryNameMap.get(participantData.categoryId) || participantData.categoryId || "-",
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
        const nextScores = scoresSnap.exists() ? scoresSnap.data().scores || {} : {};
        setScores(nextScores);
        setSavedScores(nextScores);
        if (scoresSnap.exists() && scoresSnap.data().updatedAt) {
          setUpdatedAt(scoresSnap.data().updatedAt.toDate());
        } else {
          setUpdatedAt(null);
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

    if (!hasUnsavedChanges) {
      setStatus("保存する変更がありません。");
      return;
    }

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
      setSavedScores({ ...scores });
      setUpdatedAt(new Date());
      setStatus("✅ 保存しました");
      setTimeout(() => setStatus(""), 2000);
    } catch (err) {
      console.error("保存失敗:", err);
      setStatus("❌ 保存に失敗しました");
    }
  };

  const statusClass = status.startsWith("✅")
    ? "rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
    : status.startsWith("❌")
      ? "rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
      : "rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700";

  const backToScoresPath = `/events/${eventId}/scores?scoreSeason=${encodeURIComponent(
    seasonId
  )}&scoreCategory=${encodeURIComponent(categoryId)}`;

  if (loading || profileLoading) {
    return (
      <div className={pageContainerClass}>
        <p className="text-sm text-slate-600">採点画面を読み込んでいます...</p>
      </div>
    );
  }

  if (error || profileError) {
    return (
      <div className={pageContainerClass}>
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error || profileError}
        </p>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className={pageContainerClass}>
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          このイベントの採点を行う権限がありません。
        </p>
      </div>
    );
  }

  return (
    <div className={pageBackgroundClass}>
      <div className={pageContainerClass}>
        <ManagementHero
          eyebrow="Score Input"
          title="Score Input"
          description={`クライマー「${participantName || "-"}」の採点を入力します。`}
          backTo={backToScoresPath}
          backLabel="↩ スコア一覧へ戻る"
          surface={false}
        />

        <section className="mt-4">
          <h2 className={sectionHeadingClass}>Summary</h2>
          <div className={sectionCardClass}>
            <div className="grid gap-3 md:grid-cols-2">
              <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Climber</p>
                <p className="mt-1 text-lg font-bold text-slate-900">{participantName || "-"}</p>
                <p className="mt-1 text-sm text-slate-600">会員番号: {participantInfo.memberNo}</p>
                <p className="mt-1 text-sm text-slate-600">級: {participantInfo.grade}</p>
                <p className="mt-1 text-sm text-slate-600">カテゴリ: {participantInfo.categoryName}</p>
              </article>
              <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Progress</p>
                <p className="mt-1 text-sm text-slate-600">
                  完登 {clearCount} / 全{tasks.length}（未完登 {remainingCount}）
                </p>
                <p className="mt-2 text-xs text-slate-500">最終更新: {updatedAt ? updatedAt.toLocaleString() : "未保存"}</p>
                <p
                  className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${
                    hasUnsavedChanges ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                  }`}
                >
                  {hasUnsavedChanges ? "保存前の変更あり" : "保存済み"}
                </p>
              </article>
            </div>
          </div>
        </section>

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
                const isDirty = !taskScoreEquals(savedScores, scores, task);
                return (
                  <button
                    key={task.id || task.name}
                    type="button"
                    onClick={() => handleToggleScore(task)}
                    className={`min-h-[96px] rounded-xl border p-3 text-left transition ${
                      isDirty
                        ? "border-amber-300 bg-amber-50"
                        : isCleared
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
          {hasUnsavedChanges ? (
            <p className="text-sm text-amber-700">※保存していない変更があります。</p>
          ) : null}
          {status && <span className={statusClass}>{status}</span>}
        </div>
      </div>
    </div>
  );
};

export default ScoreInput;

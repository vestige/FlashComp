// src/pages/EditEvent.jsx
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import { db } from "../firebase";
import {
  addDoc,
  collection,
  getDocs,
  doc,
  getDoc,
  Timestamp,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import SeasonManager from "../components/SeasonManager";
import CategoryManager from "../components/CategoryManager";
import ConfirmDialog from "../components/ConfirmDialog";
import ManagementHero from "../components/ManagementHero";
import { usePageTitle } from "../hooks/usePageTitle";
import { useOwnerProfile } from "../hooks/useOwnerProfile";
import { validateEventDraft } from "../lib/eventDraft";
import { buildSettingsProgress } from "../lib/settingsProgress";
import {
  getSeasonCreateDateDefaults,
  validateEventRangeAgainstSeasons,
  validateSeasonDraft,
  validateSeasonInEventRange,
} from "../lib/seasonDraft";
import { validateCategoryDraft } from "../lib/categoryDraft";
import { parseDateInputAsLocalDate } from "../lib/dateInput";
import { deleteEventCascade } from "../lib/eventDataCleanup";
import {
  inputFieldClass,
  pageBackgroundClass,
  pageContainerClass,
  primaryButtonClass,
  sectionCardClass,
  sectionHeadingClass,
  subtleButtonClass,
} from "../components/uiStyles";

const toDate = (value) => {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (typeof value.seconds === "number") return new Date(value.seconds * 1000);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toInputDate = (value) => {
  const date = toDate(value);
  if (!date) return "";
  const y = String(date.getFullYear());
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const formatDisplayDate = (value) => {
  const date = toDate(value);
  if (!date) return "-";
  return date.toLocaleDateString("ja-JP");
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

const EditEvent = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [eventName, setEventName] = useState("");

  const [categories, setCategories] = useState([]);
  const [seasons, setSeasons] = useState([]);
  const [seasonCount, setSeasonCount] = useState(0);
  const [taskCount, setTaskCount] = useState(0);
  const [seasonTaskSummary, setSeasonTaskSummary] = useState([]);
  const [eventGymId, setEventGymId] = useState("");
  const [eventDraft, setEventDraft] = useState({
    name: "",
    startDate: "",
    endDate: "",
  });
  const [savedEventMeta, setSavedEventMeta] = useState({
    name: "",
    startDate: "",
    endDate: "",
  });
  const [isEditingEventMeta, setIsEditingEventMeta] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [isSavingEvent, setIsSavingEvent] = useState(false);
  const [isSeasonModalOpen, setIsSeasonModalOpen] = useState(false);
  const [isAddingSeason, setIsAddingSeason] = useState(false);
  const [seasonRefreshToken, setSeasonRefreshToken] = useState(0);
  const [seasonDraft, setSeasonDraft] = useState({ name: "", startDate: "", endDate: "" });
  const [seasonStatus, setSeasonStatus] = useState("");
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [categoryRefreshToken, setCategoryRefreshToken] = useState(0);
  const [categoryDraftName, setCategoryDraftName] = useState("");
  const [categoryStatus, setCategoryStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [highlightedSectionId, setHighlightedSectionId] = useState("");
  const {
    gymIds,
    hasAllGymAccess,
    loading: profileLoading,
    error: profileError,
  } = useOwnerProfile();
  usePageTitle(eventName ? `イベント編集: ${eventName}` : "イベント編集");

  const refreshSetupSummary = useCallback(async () => {
    const [categorySnap, seasonSnap] = await Promise.all([
      getDocs(collection(db, "events", eventId, "categories")),
      getDocs(collection(db, "events", eventId, "seasons")),
    ]);
    const seasonRows = seasonSnap.docs.map((seasonDoc) => ({
      id: seasonDoc.id,
      ...seasonDoc.data(),
    }));
    const taskSnaps = await Promise.all(
      seasonRows.map((season) =>
        getDocs(collection(db, "events", eventId, "seasons", season.id, "tasks"))
      )
    );
    const nextTaskCount = taskSnaps.reduce((sum, taskSnap) => sum + taskSnap.size, 0);
    const nextSeasonTaskSummary = seasonRows
      .map((season, index) => ({
        seasonId: season.id,
        seasonName: String(season.name || ""),
        taskCount: taskSnaps[index]?.size || 0,
      }))
      .sort((a, b) => a.seasonName.localeCompare(b.seasonName, "ja"));
    const categoryRows = categorySnap.docs.map((categoryDoc) => ({
      id: categoryDoc.id,
      ...categoryDoc.data(),
    }));
    setCategories(categoryRows);
    setSeasons(seasonRows);
    setSeasonCount(seasonSnap.size);
    setTaskCount(nextTaskCount);
    setSeasonTaskSummary(nextSeasonTaskSummary);
  }, [eventId]);

  useEffect(() => {
    if (profileLoading) return;
    if (profileError) {
      setError(profileError);
      setLoading(false);
      return;
    }

    const fetchEventData = async () => {
      setLoading(true);
      setError("");
      setAccessDenied(false);
      try {
        const eventDocRef = doc(db, "events", eventId);
        const eventDocSnap = await getDoc(eventDocRef);
        if (!eventDocSnap.exists()) {
          setError("イベントが見つかりません。");
          return;
        }

        const eventData = eventDocSnap.data();
        const nextName = eventData.name || "";
        setEventName(nextName);
        setEventGymId(eventData.gymId || "");
        setEventDraft({
          name: nextName,
          startDate: toInputDate(eventData.startDate),
          endDate: toInputDate(eventData.endDate),
        });
        setSavedEventMeta({
          name: nextName,
          startDate: toInputDate(eventData.startDate),
          endDate: toInputDate(eventData.endDate),
        });
        if (!hasAllGymAccess && !gymIds.includes(eventData.gymId)) {
          setAccessDenied(true);
          return;
        }

        await refreshSetupSummary();
      } catch (err) {
        console.error("イベント編集データの取得に失敗:", err);
        setError("イベント編集データの取得に失敗しました。");
      } finally {
        setLoading(false);
      }
    };

    fetchEventData();
  }, [eventId, gymIds, hasAllGymAccess, profileLoading, profileError, refreshSetupSummary]);

  useEffect(() => {
    if (loading || profileLoading) return undefined;
    const targetId = location.hash?.replace("#", "");
    if (!targetId) return undefined;
    const target = document.getElementById(targetId);
    if (!target) return undefined;

    target.scrollIntoView({ behavior: "smooth", block: "start" });
    setHighlightedSectionId(targetId);

    const timerId = setTimeout(() => {
      setHighlightedSectionId((current) => (current === targetId ? "" : current));
    }, 1800);

    return () => clearTimeout(timerId);
  }, [location.hash, loading, profileLoading, categories.length, seasonCount]);

  const handleSaveEventMeta = async (e) => {
    e.preventDefault();
    const name = eventDraft.name.trim();
    const validationError = validateEventDraft({
      name,
      gymId: eventGymId,
      startDate: eventDraft.startDate,
      endDate: eventDraft.endDate,
    });

    if (validationError) {
      setSaveStatus(`❌ ${validationError}`);
      return;
    }

    setIsSavingEvent(true);
    setSaveStatus("");
    try {
      const startLocalDate = parseDateInputAsLocalDate(eventDraft.startDate);
      const endLocalDate = parseDateInputAsLocalDate(eventDraft.endDate);
      if (!startLocalDate || !endLocalDate) {
        setSaveStatus("❌ 日付の形式が不正です");
        return;
      }

      const seasonSnap = await getDocs(collection(db, "events", eventId, "seasons"));
      const seasonRows = seasonSnap.docs.map((seasonDoc) => ({
        id: seasonDoc.id,
        ...seasonDoc.data(),
      }));
      const seasonRangeError = validateEventRangeAgainstSeasons({
        seasons: seasonRows,
        eventStartDate: eventDraft.startDate,
        eventEndDate: eventDraft.endDate,
      });
      if (seasonRangeError) {
        setSaveStatus(`❌ ${seasonRangeError}`);
        return;
      }

      const payload = {
        name,
        startDate: Timestamp.fromDate(startLocalDate),
        endDate: Timestamp.fromDate(endLocalDate),
        updatedAt: serverTimestamp(),
      };
      await updateDoc(doc(db, "events", eventId), payload);
      setEventName(name);
      const nextMeta = {
        name,
        startDate: eventDraft.startDate,
        endDate: eventDraft.endDate,
      };
      setEventDraft(nextMeta);
      setSavedEventMeta(nextMeta);
      setSaveStatus("✅ イベント情報を更新しました。");
      setIsEditingEventMeta(false);
    } catch (err) {
      console.error("イベント更新に失敗:", err);
      setSaveStatus("❌ イベント更新に失敗しました。");
    } finally {
      setIsSavingEvent(false);
    }
  };

  const confirmDeleteEvent = async () => {
    setDeleteError("");
    setIsDeleting(true);
    try {
      await deleteEventCascade({ eventId });
      navigate("/dashboard", { replace: true });
    } catch (err) {
      console.error("イベント削除に失敗:", err);
      setDeleteError("イベント削除に失敗しました。");
    } finally {
      setIsDeleting(false);
      setIsDeleteModalOpen(false);
    }
  };

  const handleCreateSeason = async (e) => {
    e.preventDefault();
    const validationError = validateSeasonDraft(seasonDraft);
    if (validationError) {
      setSeasonStatus(`❌ ${validationError}`);
      return;
    }
    const rangeError = validateSeasonInEventRange({
      startDate: seasonDraft.startDate,
      endDate: seasonDraft.endDate,
      eventStartDate: savedEventMeta.startDate,
      eventEndDate: savedEventMeta.endDate,
    });
    if (rangeError) {
      setSeasonStatus(`❌ ${rangeError}`);
      return;
    }

    setIsAddingSeason(true);
    setSeasonStatus("");
    try {
      const startLocalDate = parseDateInputAsLocalDate(seasonDraft.startDate);
      const endLocalDate = parseDateInputAsLocalDate(seasonDraft.endDate);
      if (!startLocalDate || !endLocalDate) {
        setSeasonStatus("❌ 日付の形式が不正です");
        return;
      }
      await addDoc(collection(db, "events", eventId, "seasons"), {
        name: seasonDraft.name.trim(),
        startDate: Timestamp.fromDate(startLocalDate),
        endDate: Timestamp.fromDate(endLocalDate),
        createdAt: serverTimestamp(),
      });
      setSeasonDraft({ name: "", startDate: "", endDate: "" });
      setSeasonStatus("✅ シーズンを追加しました。");
      setSeasonRefreshToken((prev) => prev + 1);
      await refreshSetupSummary();
      setIsSeasonModalOpen(false);
    } catch (err) {
      console.error("シーズン追加に失敗:", err);
      setSeasonStatus("❌ シーズン追加に失敗しました。");
    } finally {
      setIsAddingSeason(false);
    }
  };

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    const validationError = validateCategoryDraft({ name: categoryDraftName });
    if (validationError) {
      setCategoryStatus(`❌ ${validationError}`);
      return;
    }

    setIsAddingCategory(true);
    setCategoryStatus("");
    try {
      await addDoc(collection(db, "events", eventId, "categories"), {
        name: categoryDraftName.trim(),
      });
      setCategoryDraftName("");
      setCategoryStatus("✅ カテゴリを追加しました。");
      setCategoryRefreshToken((prev) => prev + 1);
      await refreshSetupSummary();
      setIsCategoryModalOpen(false);
    } catch (err) {
      console.error("カテゴリ追加に失敗:", err);
      setCategoryStatus("❌ カテゴリ追加に失敗しました。");
    } finally {
      setIsAddingCategory(false);
    }
  };

  if (loading || profileLoading) {
    return (
      <div className={pageBackgroundClass}>
        <div className={pageContainerClass}>
          <p className="text-sm text-slate-600">イベント編集データを読み込んでいます...</p>
        </div>
      </div>
    );
  }

  if (error || profileError) {
    return (
      <div className={pageBackgroundClass}>
        <div className={pageContainerClass}>
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error || profileError}
          </p>
        </div>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className={pageBackgroundClass}>
        <div className={pageContainerClass}>
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            このイベントを編集する権限がありません。
          </p>
        </div>
      </div>
    );
  }

  const settingsProgress = buildSettingsProgress({
    seasonCount,
    categoryCount: categories.length,
    taskCount,
  });
  const stepStatusClass = {
    done: "border-emerald-200 bg-emerald-50 text-emerald-800",
    todo: "border-sky-200 bg-sky-50 text-sky-800",
    blocked: "border-slate-200 bg-slate-50 text-slate-600",
  };
  const seasonCreateButtonClass =
    "inline-flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-700 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-800/15 transition hover:bg-emerald-800";
  const categoryCreateButtonClass =
    "inline-flex items-center gap-2 rounded-xl border border-green-300 bg-green-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-green-800/15 transition hover:bg-green-700";
  const seasonTaskCountBySeason = Object.fromEntries(
    seasonTaskSummary.map((season) => [season.seasonId, season.taskCount])
  );
  const seasonsWithoutTasks = seasonTaskSummary.filter((season) => season.taskCount === 0);
  const eventRangeText = `${formatDisplayDate(savedEventMeta.startDate)} - ${formatDisplayDate(savedEventMeta.endDate)}`;

  return (
    <div className={pageBackgroundClass}>
      <div className={pageContainerClass}>
        <ManagementHero
          title="Event Settings"
          description="大会情報、シーズン、カテゴリ設定を1画面で管理します。"
          backTo="/dashboard"
          backLabel="↑ Back to Dashboard"
          surface={false}
        />

        <section className="mt-4">
          <h2 className={sectionHeadingClass}>📚Summary</h2>
          <div className={sectionCardClass}>
            <p className="text-sm text-slate-600">
            大会名と開催期間を更新できます。保存後すぐに各画面へ反映されます。
            </p>
          {!isEditingEventMeta ? (
            <div className="mt-4 space-y-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold tracking-wide text-slate-500">イベント名</p>
                <p className="mt-1 text-sm font-medium text-slate-900">{eventDraft.name || "-"}</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold tracking-wide text-slate-500">開始日</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">{formatDisplayDate(eventDraft.startDate)}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold tracking-wide text-slate-500">終了日</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">{formatDisplayDate(eventDraft.endDate)}</p>
                </div>
              </div>
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setEventDraft(savedEventMeta);
                    setIsEditingEventMeta(true);
                    setSaveStatus("");
                  }}
                  className={subtleButtonClass}
                >
                  編集
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSaveEventMeta} className="mt-4 grid gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-semibold text-slate-700">イベント名</label>
                <input
                  type="text"
                  value={eventDraft.name}
                  onChange={(e) => setEventDraft((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="例: FlashComp Live 2026"
                  required
                  className={inputFieldClass}
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <label className="text-sm font-semibold text-slate-700">開始日</label>
                  <input
                    type="date"
                    value={eventDraft.startDate}
                    onChange={(e) => setEventDraft((prev) => ({ ...prev, startDate: e.target.value }))}
                    required
                    className={inputFieldClass}
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-semibold text-slate-700">終了日</label>
                  <input
                    type="date"
                    value={eventDraft.endDate}
                    onChange={(e) => setEventDraft((prev) => ({ ...prev, endDate: e.target.value }))}
                    required
                    className={inputFieldClass}
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={isSavingEvent}
                  className={`${primaryButtonClass} disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  {isSavingEvent ? "更新中..." : "更新"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEventDraft(savedEventMeta);
                    setIsEditingEventMeta(false);
                    setSaveStatus("");
                  }}
                  className={subtleButtonClass}
                >
                  キャンセル
                </button>
              </div>
            </form>
          )}
          {saveStatus && (
            <p
              className={`mt-3 inline-flex rounded-lg px-3 py-2 text-sm ${
                saveStatus.startsWith("✅") ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
              }`}
            >
              {saveStatus}
            </p>
          )}
          </div>
        </section>

        <section className="mt-4">
          <h2 className={sectionHeadingClass}>👉Progress</h2>
          <div className={sectionCardClass}>
            <p className="text-sm text-slate-600">
            {settingsProgress.completed} / {settingsProgress.total} ステップ完了（{settingsProgress.percent}%）
            </p>
            <div className="mt-3 h-2 w-full rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${settingsProgress.percent}%` }}
              />
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {settingsProgress.steps.map((step) => (
                <article
                  key={step.key}
                  className={`rounded-xl border px-3 py-3 ${stepStatusClass[step.status] || stepStatusClass.todo}`}
                >
                  <p className="text-xs font-semibold tracking-wide">{step.label}</p>
                  <p className="mt-1 text-lg font-bold">
                    {step.count}
                    <span className="ml-1 text-sm font-medium">{step.unit}</span>
                  </p>
                  <p className="mt-1 text-xs">{step.hint}</p>
                </article>
              ))}
            </div>
            {seasonsWithoutTasks.length > 0 && (
              <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                ⚠ 課題未設定シーズン:
                {" "}
                {seasonsWithoutTasks
                  .map((season) => season.seasonName || "無題シーズン")
                  .join(" / ")}
              </p>
            )}
          </div>
        </section>

        <section className="mt-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">📅Registered Seasons</h2>
              <p className="mt-1 text-sm text-slate-600">Event期間: {eventRangeText}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSeasonStatus("");
                const defaults = getSeasonCreateDateDefaults({
                  seasons,
                  eventStartDate: savedEventMeta.startDate,
                  eventEndDate: savedEventMeta.endDate,
                });
                setSeasonDraft({ name: "", startDate: defaults.startDate, endDate: defaults.endDate });
                setIsSeasonModalOpen(true);
              }}
              className={seasonCreateButtonClass}
            >
              <PlusIcon />
              Create New Season
            </button>
          </div>
          <SeasonManager
            eventId={eventId}
            showCreateForm={false}
            refreshToken={seasonRefreshToken}
            onEditSeason={(seasonId) => navigate(`/events/${eventId}/seasons/${seasonId}/edit`)}
            eventRange={eventDraft}
            taskCountBySeason={seasonTaskCountBySeason}
            showSectionHeader={false}
            showSectionCard={false}
          />
        </section>

        <section
          id="registered-categories"
          className={`mt-6 scroll-mt-24 rounded-2xl transition-all duration-300 ${
            highlightedSectionId === "registered-categories"
              ? "ring-2 ring-emerald-300 ring-offset-2 ring-offset-slate-50"
              : ""
          }`}
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-bold text-slate-900">👥Registered Categories</h2>
            <button
              type="button"
              onClick={() => {
                setCategoryStatus("");
                setIsCategoryModalOpen(true);
              }}
              className={categoryCreateButtonClass}
            >
              <PlusIcon />
              Create New Category
            </button>
          </div>
          <CategoryManager
            eventId={eventId}
            categories={categories}
            setCategories={setCategories}
            showCreateForm={false}
            refreshToken={categoryRefreshToken}
            showSectionHeader={false}
            showSectionCard={false}
          />
        </section>

        <section className="mt-8">
          <h2 className="mb-4 text-2xl font-bold text-rose-800">Danger Zone</h2>
          <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4 shadow-sm">
            <p className="text-sm text-rose-700">
            イベントを削除すると、このイベント本体は復元できません。実行前に必要なデータをCSV出力してください。
            </p>
            {deleteError && (
              <p className="mt-2 rounded-lg border border-rose-300 bg-white px-3 py-2 text-sm text-rose-700">
                {deleteError}
              </p>
            )}
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(true)}
                disabled={isDeleting}
                className="inline-flex items-center rounded-lg bg-rose-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeleting ? "削除中..." : "イベントを削除"}
              </button>
            </div>
          </div>
        </section>

        {isSeasonModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4 py-8"
            role="dialog"
            aria-modal="true"
            aria-label="シーズン追加"
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsSeasonModalOpen(false);
            }}
          >
            <section className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-xl sm:p-6">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">シーズン追加</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    新しいシーズン名と開催期間を設定します。
                  </p>
                  <p className="mt-1 text-sm text-slate-600">Event期間: {eventRangeText}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSeasonModalOpen(false)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 transition hover:bg-slate-50"
                  aria-label="close season modal"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateSeason} className="grid gap-4">
                <div className="grid gap-2">
                  <label className="text-sm font-semibold text-slate-700">シーズン名</label>
                  <input
                    type="text"
                    value={seasonDraft.name}
                    onChange={(e) => setSeasonDraft((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="例: Season 1"
                    required
                    className={inputFieldClass}
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <label className="text-sm font-semibold text-slate-700">開始日</label>
                    <input
                      type="date"
                      value={seasonDraft.startDate}
                      onChange={(e) => setSeasonDraft((prev) => ({ ...prev, startDate: e.target.value }))}
                      required
                      className={inputFieldClass}
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-semibold text-slate-700">終了日</label>
                    <input
                      type="date"
                      value={seasonDraft.endDate}
                      onChange={(e) => setSeasonDraft((prev) => ({ ...prev, endDate: e.target.value }))}
                      required
                      className={inputFieldClass}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="submit"
                    disabled={isAddingSeason}
                    className={`${primaryButtonClass} disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    {isAddingSeason ? "追加中..." : "追加"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsSeasonModalOpen(false)}
                    className={subtleButtonClass}
                  >
                    キャンセル
                  </button>
                </div>
                {seasonStatus && (
                  <p
                    className={`rounded-lg px-3 py-2 text-sm ${
                      seasonStatus.startsWith("✅") ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                    }`}
                  >
                    {seasonStatus}
                  </p>
                )}
              </form>
            </section>
          </div>
        )}

        {isCategoryModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4 py-8"
            role="dialog"
            aria-modal="true"
            aria-label="カテゴリ追加"
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsCategoryModalOpen(false);
            }}
          >
            <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-xl sm:p-6">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">カテゴリ追加</h3>
                  <p className="mt-1 text-sm text-slate-600">参加カテゴリ名を追加します。</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 transition hover:bg-slate-50"
                  aria-label="close category modal"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateCategory} className="grid gap-4">
                <div className="grid gap-2">
                  <label className="text-sm font-semibold text-slate-700">カテゴリ名</label>
                  <input
                    type="text"
                    value={categoryDraftName}
                    onChange={(e) => setCategoryDraftName(e.target.value)}
                    placeholder="例: Beginner"
                    required
                    className={inputFieldClass}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="submit"
                    disabled={isAddingCategory}
                    className={`${primaryButtonClass} disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    {isAddingCategory ? "追加中..." : "追加"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCategoryModalOpen(false)}
                    className={subtleButtonClass}
                  >
                    キャンセル
                  </button>
                </div>
                {categoryStatus && (
                  <p
                    className={`rounded-lg px-3 py-2 text-sm ${
                      categoryStatus.startsWith("✅") ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                    }`}
                  >
                    {categoryStatus}
                  </p>
                )}
              </form>
            </section>
          </div>
        )}

        <ConfirmDialog
          open={isDeleteModalOpen}
          title="イベントを削除しますか？"
          message={`「${eventName || "このイベント"}」を削除します。元に戻せません。`}
          confirmLabel="イベントを削除"
          onConfirm={confirmDeleteEvent}
          onCancel={() => setIsDeleteModalOpen(false)}
          busy={isDeleting}
        />
      </div>
    </div>
  );
};

export default EditEvent;

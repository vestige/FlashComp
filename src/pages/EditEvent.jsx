// src/pages/EditEvent.jsx
import { Link, useNavigate, useParams, useLocation, useSearchParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { db } from "../firebase";
import {
  collection,
  deleteDoc,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";

import SeasonManager from "../components/SeasonManager";
import CategoryManager from "../components/CategoryManager";
import RouteSelector from "../components/RouteSelector";
import { usePageTitle } from "../hooks/usePageTitle";
import { useOwnerProfile } from "../hooks/useOwnerProfile";

const TAB_CONFIG = [
  { id: "seasons", label: "📅 シーズン", hint: "開催期間の分割を設定" },
  { id: "categories", label: "🏷 カテゴリ", hint: "参加カテゴリを設定" },
  { id: "tasks", label: "🧩 課題設定", hint: "シーズン課題とカテゴリ採用を設定" },
];

const normalizeTab = (value) => {
  if (!value) return "seasons";
  if (value === "routes" || value === "participants" || value === "scores") return "seasons";
  return TAB_CONFIG.some((tab) => tab.id === value) ? value : "seasons";
};

const EditEvent = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [eventName, setEventName] = useState("");
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(
    normalizeTab(searchParams.get("tab") || location.state?.tab || "seasons")
  );

  const [categories, setCategories] = useState([]);
  const [seasonCount, setSeasonCount] = useState(0);
  const [participantCount, setParticipantCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const {
    gymIds,
    hasAllGymAccess,
    loading: profileLoading,
    error: profileError,
  } = useOwnerProfile();
  usePageTitle(eventName ? `イベント編集: ${eventName}` : "イベント編集");

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
        setEventName(eventData.name || "");
        if (!hasAllGymAccess && !gymIds.includes(eventData.gymId)) {
          setAccessDenied(true);
          return;
        }

        const [categorySnap, seasonSnap, participantSnap] = await Promise.all([
          getDocs(collection(db, "events", eventId, "categories")),
          getDocs(collection(db, "events", eventId, "seasons")),
          getDocs(collection(db, "events", eventId, "participants")),
        ]);
        const categoryRows = categorySnap.docs.map((categoryDoc) => ({
          id: categoryDoc.id,
          ...categoryDoc.data(),
        }));
        setCategories(categoryRows);
        setSeasonCount(seasonSnap.size);
        setParticipantCount(participantSnap.size);
      } catch (err) {
        console.error("イベント編集データの取得に失敗:", err);
        setError("イベント編集データの取得に失敗しました。");
      } finally {
        setLoading(false);
      }
    };

    fetchEventData();
  }, [eventId, gymIds, hasAllGymAccess, profileLoading, profileError]);

  useEffect(() => {
    const tabParam = normalizeTab(searchParams.get("tab"));
    if (tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (next.get("tab") !== activeTab) {
      next.set("tab", activeTab);
      setSearchParams(next, { replace: true });
    }
  }, [activeTab, searchParams, setSearchParams]);

  const handleDeleteEvent = async () => {
    const targetName = eventName || "このイベント";
    const ok = window.confirm(
      `「${targetName}」を削除します。よろしいですか？\nこの操作は元に戻せません。`
    );
    if (!ok) return;

    setDeleteError("");
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, "events", eventId));
      navigate("/dashboard", { replace: true });
    } catch (err) {
      console.error("イベント削除に失敗:", err);
      setDeleteError("イベント削除に失敗しました。");
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading || profileLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <p className="text-sm text-slate-600">イベント編集データを読み込んでいます...</p>
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
          このイベントを編集する権限がありません。
        </p>
      </div>
    );
  }

  const activeTabConfig = TAB_CONFIG.find((tab) => tab.id === activeTab);
  const summaryItems = [
    { label: "シーズン", value: seasonCount },
    { label: "カテゴリ", value: categories.length },
    { label: "クライマー", value: participantCount },
  ];
  const tabClass = (isActive) =>
    `rounded-lg border px-3 py-2 text-sm font-medium transition ${
      isActive
        ? "border-sky-300 bg-sky-50 text-sky-800"
        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
    }`;
  const quickLinkClass = (active) =>
    `inline-flex items-center rounded-lg border px-3 py-2 text-sm font-medium transition ${
      active
        ? "border-sky-300 bg-sky-50 text-sky-800"
        : "border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100"
    }`;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#dbeafe_0%,_#f8fafc_45%,_#ecfeff_100%)]">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-sky-700">Event Settings</p>
            <h2 className="text-2xl font-bold text-slate-900">🛠 イベント設定：{eventName}</h2>
          </div>
          <Link
            to="/dashboard"
            className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            ↩ ダッシュボードへ戻る
          </Link>
        </div>

        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-600">
            現在の登録状況を見ながら、上から順に設定するとスムーズです。
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {summaryItems.map((item) => (
              <span
                key={item.label}
                className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-sm text-slate-700"
              >
                {item.label}: {item.value}
              </span>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link to={`/events/${eventId}/edit`} className={quickLinkClass(true)}>
              🛠 イベント設定
            </Link>
            <Link
              to={`/events/${eventId}/climbers`}
              className={quickLinkClass(false)}
            >
              👤 クライマー管理
            </Link>
            <Link
              to={`/events/${eventId}/scores`}
              className={quickLinkClass(false)}
            >
              📋 スコア管理
            </Link>
            <Link
              to={`/events/${eventId}/data-io`}
              className={quickLinkClass(false)}
            >
              ⇅ CSV入出力
            </Link>
          </div>
        </section>

        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            {TAB_CONFIG.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={tabClass(activeTab === tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <p className="mt-3 text-sm text-slate-600">{activeTabConfig?.hint}</p>
        </section>

        {activeTab === "seasons" && <SeasonManager eventId={eventId} />}
        {activeTab === "categories" && (
          <CategoryManager
            eventId={eventId}
            categories={categories}
            setCategories={setCategories}
          />
        )}
        {activeTab === "tasks" && (
          categories.length === 0 ? (
            <p className="mt-4 text-sm text-slate-600">先にカテゴリを登録してください。</p>
          ) : (
            <RouteSelector
              eventId={eventId}
              categories={categories}
            />
          )
        )}

        <section className="mt-8 rounded-2xl border border-rose-200 bg-rose-50/70 p-4 shadow-sm">
          <h3 className="text-sm font-bold text-rose-800">Danger Zone</h3>
          <p className="mt-1 text-sm text-rose-700">
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
              onClick={handleDeleteEvent}
              disabled={isDeleting}
              className="inline-flex items-center rounded-lg bg-rose-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isDeleting ? "削除中..." : "イベントを削除"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

export default EditEvent;

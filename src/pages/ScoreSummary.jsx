import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { usePageTitle } from "../hooks/usePageTitle";

const toDateText = (value) => {
  if (!value) return "-";
  if (typeof value.toDate === "function") return value.toDate().toLocaleDateString();
  if (typeof value.seconds === "number") return new Date(value.seconds * 1000).toLocaleDateString();
  return String(value);
};

const toTimestampMs = (value) => {
  if (!value) return 0;
  if (typeof value.toDate === "function") return value.toDate().getTime();
  if (typeof value.seconds === "number") return value.seconds * 1000;
  return 0;
};

const getEventStatus = (event, nowMs) => {
  const startMs = toTimestampMs(event.startDate);
  const endMs = toTimestampMs(event.endDate);
  if (startMs && endMs && startMs <= nowMs && nowMs <= endMs) return "ongoing";
  if (startMs && nowMs < startMs) return "upcoming";
  return "ended";
};

const statusLabelMap = {
  ongoing: "開催中",
  upcoming: "開催予定",
  ended: "終了",
};
const statusOrderMap = {
  ongoing: 0,
  upcoming: 1,
  ended: 2,
};

const compareEventsForDisplay = (a, b, nowMs) => {
  const aStatus = getEventStatus(a, nowMs);
  const bStatus = getEventStatus(b, nowMs);
  const aOrder = statusOrderMap[aStatus] ?? 99;
  const bOrder = statusOrderMap[bStatus] ?? 99;
  if (aOrder !== bOrder) return aOrder - bOrder;

  const aStartMs = toTimestampMs(a.startDate);
  const bStartMs = toTimestampMs(b.startDate);
  const aEndMs = toTimestampMs(a.endDate);
  const bEndMs = toTimestampMs(b.endDate);

  if (aStatus === "ongoing") {
    if (aEndMs !== bEndMs) return aEndMs - bEndMs;
    if (aStartMs !== bStartMs) return bStartMs - aStartMs;
    return (a.name || "").localeCompare(b.name || "", "ja");
  }

  if (aStatus === "upcoming") {
    if (aStartMs !== bStartMs) return aStartMs - bStartMs;
    if (aEndMs !== bEndMs) return aEndMs - bEndMs;
    return (a.name || "").localeCompare(b.name || "", "ja");
  }

  if (aEndMs !== bEndMs) return bEndMs - aEndMs;
  if (aStartMs !== bStartMs) return bStartMs - aStartMs;
  return (a.name || "").localeCompare(b.name || "", "ja");
};

const ScoreSummary = () => {
  usePageTitle("クライマー向けイベント一覧");

  const [searchParams, setSearchParams] = useSearchParams();
  const initialKeyword = searchParams.get("q") || "";
  const initialStatus = searchParams.get("status") || "all";
  const initialGymId = searchParams.get("gym") || "all";
  const [events, setEvents] = useState([]);
  const [gyms, setGyms] = useState([]);
  const [keyword, setKeyword] = useState(initialKeyword);
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [gymFilter, setGymFilter] = useState(initialGymId);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setError("");
        const [eventSnap, gymSnap] = await Promise.all([
          getDocs(collection(db, "events")),
          getDocs(collection(db, "gyms")),
        ]);
        const eventRows = eventSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        const gymRows = gymSnap.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .sort((a, b) => (a.name || "").localeCompare(b.name || "", "ja"));
        setEvents(eventRows);
        setGyms(gymRows);
      } catch (err) {
        console.error("イベントの取得に失敗:", err);
        setError("イベントの読み込みに失敗しました。");
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    const normalizedKeyword = keyword.trim();
    if (normalizedKeyword) params.set("q", normalizedKeyword);
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (gymFilter !== "all") params.set("gym", gymFilter);
    if (params.toString() !== searchParams.toString()) {
      setSearchParams(params, { replace: true });
    }
  }, [keyword, statusFilter, gymFilter, searchParams, setSearchParams]);

  useEffect(() => {
    if (gymFilter === "all") return;
    if (gyms.length === 0) return;
    const exists = gyms.some((gym) => gym.id === gymFilter);
    if (!exists) setGymFilter("all");
  }, [gymFilter, gyms]);

  const filteredEvents = useMemo(() => {
    const nowMs = Date.now();
    const normalizedKeyword = keyword.trim().toLowerCase();

    return [...events]
      .sort((a, b) => compareEventsForDisplay(a, b, nowMs))
      .filter((event) => {
        const eventName = (event.name || "").toLowerCase();
        const eventStatus = getEventStatus(event, nowMs);
        const matchesKeyword = normalizedKeyword
          ? eventName.includes(normalizedKeyword)
          : true;
        const matchesStatus = statusFilter === "all" ? true : eventStatus === statusFilter;
        const matchesGym = gymFilter === "all" ? true : event.gymId === gymFilter;
        return matchesKeyword && matchesStatus && matchesGym;
      });
  }, [events, keyword, statusFilter, gymFilter]);

  const gymNameById = useMemo(
    () => new Map(gyms.map((gym) => [gym.id, gym.name || gym.id])),
    [gyms]
  );

  const resetFilters = () => {
    setKeyword("");
    setStatusFilter("all");
    setGymFilter("all");
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <p className="text-sm text-slate-600">イベントを読み込んでいます...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            ← Homeに戻る
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#dbeafe_0%,_#f8fafc_45%,_#ecfeff_100%)]">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-2xl font-bold text-slate-900">🏆 クライマー向け結果ページ</h2>
          <Link
            to="/"
            className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            ← TOPへ戻る
          </Link>
        </div>
        <p className="mt-2 text-sm text-slate-600">確認したいイベントを選んでください。</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-700">
          <li>イベントを選ぶ</li>
          <li>ランキングから自分を検索する</li>
          <li>「詳細を見る」でシーズン別の完登内訳を確認する</li>
        </ol>

        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <label className="text-sm text-slate-700">
            イベント名:
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="例: Spring"
              className="ml-2 rounded-lg border border-slate-300 px-2 py-1 text-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            />
          </label>
          <label className="text-sm text-slate-700">
            開催状況:
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="ml-2 rounded-lg border border-slate-300 px-2 py-1 text-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            >
              <option value="all">すべて</option>
              <option value="ongoing">開催中</option>
              <option value="upcoming">開催予定</option>
              <option value="ended">終了</option>
            </select>
          </label>
          <label className="text-sm text-slate-700">
            ジム:
            <select
              value={gymFilter}
              onChange={(e) => setGymFilter(e.target.value)}
              className="ml-2 rounded-lg border border-slate-300 px-2 py-1 text-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            >
              <option value="all">すべて</option>
              {gyms.map((gym) => (
                <option key={gym.id} value={gym.id}>
                  {gym.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={resetFilters}
            className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            フィルターをリセット
          </button>
          <span className="ml-auto text-sm text-slate-600">
            表示 {filteredEvents.length} / {events.length} 件
          </span>
        </div>

        {events.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">イベントがありません。</p>
        ) : filteredEvents.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">条件に一致するイベントがありません。</p>
        ) : (
          <div className="mt-4 grid gap-3">
            {filteredEvents.map((event) => {
              const status = getEventStatus(event, Date.now());
              return (
                <section
                  key={event.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <h3 className="text-lg font-semibold text-slate-900">
                    {event.name}
                    <span className="ml-2 rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 text-xs text-slate-600">
                      {statusLabelMap[status]}
                    </span>
                  </h3>
                  <p className="mt-2 text-sm text-slate-600">
                    開催期間: {toDateText(event.startDate)} 〜 {toDateText(event.endDate)}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    ジム: {gymNameById.get(event.gymId) || "未設定"}
                  </p>
                  <Link
                    to={`/score-summary/${event.id}`}
                    className="mt-2 inline-flex items-center rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-800 transition hover:bg-sky-100"
                  >
                    このイベントのランキングを見る
                  </Link>
                </section>
              );
            })}
          </div>
        )}
        <div className="mt-8">
          <Link
            to="/"
            className="inline-flex items-center rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            ← Homeに戻る
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ScoreSummary;

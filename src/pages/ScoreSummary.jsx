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
const statusStyleMap = {
  ongoing: "border-emerald-200 bg-emerald-50 text-emerald-700",
  upcoming: "border-sky-200 bg-sky-50 text-sky-700",
  ended: "border-slate-200 bg-slate-100 text-slate-600",
};
const statusOrderMap = {
  ongoing: 0,
  upcoming: 1,
  ended: 2,
};
const gymAccentPalette = [
  {
    leftBorderClass: "border-l-emerald-400",
    chipClass: "bg-emerald-50 text-emerald-700",
  },
  {
    leftBorderClass: "border-l-sky-400",
    chipClass: "bg-sky-50 text-sky-700",
  },
  {
    leftBorderClass: "border-l-amber-400",
    chipClass: "bg-amber-50 text-amber-700",
  },
  {
    leftBorderClass: "border-l-violet-400",
    chipClass: "bg-violet-50 text-violet-700",
  },
];

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

const buildEventTimingLabel = (event, nowMs) => {
  const startMs = toTimestampMs(event.startDate);
  const endMs = toTimestampMs(event.endDate);
  const dayMs = 24 * 60 * 60 * 1000;
  const status = getEventStatus(event, nowMs);
  if (status === "ongoing" && endMs > 0) {
    const days = Math.max(0, Math.ceil((endMs - nowMs) / dayMs));
    return `終了まで ${days} 日`;
  }
  if (status === "ended" && endMs > 0) {
    const days = Math.max(0, Math.floor((nowMs - endMs) / dayMs));
    return `終了から ${days} 日`;
  }
  if (status === "upcoming" && startMs > 0) {
    const days = Math.max(0, Math.ceil((startMs - nowMs) / dayMs));
    return `開始まで ${days} 日`;
  }
  return "";
};

const ScoreSummary = () => {
  usePageTitle("クライマー向けイベント一覧");

  const [searchParams, setSearchParams] = useSearchParams();
  const initialKeyword = searchParams.get("q") || "";
  const legacyStatus = searchParams.get("status") || "";
  const initialView = searchParams.get("view") || (legacyStatus === "ended" ? "past" : "live");
  const initialGymId = searchParams.get("gym") || "all";
  const [events, setEvents] = useState([]);
  const [gyms, setGyms] = useState([]);
  const [keyword, setKeyword] = useState(initialKeyword);
  const [viewFilter, setViewFilter] = useState(initialView);
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
    if (viewFilter !== "live") params.set("view", viewFilter);
    if (gymFilter !== "all") params.set("gym", gymFilter);
    if (params.toString() !== searchParams.toString()) {
      setSearchParams(params, { replace: true });
    }
  }, [keyword, viewFilter, gymFilter, searchParams, setSearchParams]);

  useEffect(() => {
    if (gymFilter === "all") return;
    if (gyms.length === 0) return;
    const exists = gyms.some((gym) => gym.id === gymFilter);
    if (!exists) setGymFilter("all");
  }, [gymFilter, gyms]);

  const { baseEvents, filteredEvents } = useMemo(() => {
    const nowMs = Date.now();
    const normalizedKeyword = keyword.trim().toLowerCase();

    const targetStatus = viewFilter === "past" ? "ended" : "ongoing";
    const visibleEvents = [...events]
      .sort((a, b) => compareEventsForDisplay(a, b, nowMs))
      .filter((event) => {
        const eventStatus = getEventStatus(event, nowMs);
        if (eventStatus === "upcoming") return false;
        const matchesView = eventStatus === targetStatus;
        const matchesGym = gymFilter === "all" ? true : event.gymId === gymFilter;
        return matchesView && matchesGym;
      });

    const filtered = visibleEvents.filter((event) => {
      const eventName = (event.name || "").toLowerCase();
      return normalizedKeyword ? eventName.includes(normalizedKeyword) : true;
    });

    return {
      baseEvents: visibleEvents,
      filteredEvents: filtered,
    };
  }, [events, keyword, viewFilter, gymFilter]);

  const gymNameById = useMemo(
    () => new Map(gyms.map((gym) => [gym.id, gym.name || gym.id])),
    [gyms]
  );
  const gymAccentById = useMemo(() => {
    const map = new Map();
    gyms.forEach((gym, index) => {
      map.set(gym.id, gymAccentPalette[index % gymAccentPalette.length]);
    });
    return map;
  }, [gyms]);

  const resetFilters = () => {
    setKeyword("");
    setViewFilter("live");
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
        <div className="rounded-3xl border border-slate-200 bg-white/95 p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">Climber Portal</p>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
                🏆 クライマー向け結果ページ
              </h2>
            </div>
            <Link
              to="/"
              className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              ← TOPへ戻る
            </Link>
          </div>

          <p className="mt-3 text-sm text-slate-600">確認したいイベントを選んでください。</p>
          <ol className="mt-3 grid gap-1.5 pl-5 text-sm text-slate-700 sm:grid-cols-3 sm:gap-3">
            <li>イベントを選ぶ</li>
            <li>ランキングから自分を検索する</li>
            <li>「詳細を見る」でシーズン別の完登内訳を確認する</li>
          </ol>
        </div>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm text-slate-700">
              イベント名:
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="例: Spring"
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              />
            </label>
            <div className="text-sm text-slate-700">
              表示:
              <div className="mt-1 inline-flex rounded-full border border-slate-200 bg-white p-1">
                <button
                  type="button"
                  onClick={() => setViewFilter("live")}
                  className={`rounded-full px-3 py-1 text-sm font-semibold transition ${
                    viewFilter === "live" ? "bg-emerald-700 text-white" : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  Live
                </button>
                <button
                  type="button"
                  onClick={() => setViewFilter("past")}
                  className={`rounded-full px-3 py-1 text-sm font-semibold transition ${
                    viewFilter === "past" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  Past
                </button>
              </div>
            </div>
            <label className="text-sm text-slate-700">
              ジム:
              <select
                value={gymFilter}
                onChange={(e) => setGymFilter(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              >
                <option value="all">すべて</option>
                {gyms.map((gym) => (
                  <option key={gym.id} value={gym.id}>
                    {gym.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end">
              <button
                type="button"
                onClick={resetFilters}
                className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                フィルターをリセット
              </button>
            </div>
          </div>
          <span className="text-sm font-medium text-slate-600">
            表示 {filteredEvents.length} / {baseEvents.length} 件
          </span>
        </div>

        {events.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">イベントがありません。</p>
        ) : filteredEvents.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">条件に一致するイベントがありません。</p>
        ) : (
          <div className="mt-4 grid gap-3">
            {filteredEvents.map((event) => {
              const nowMs = Date.now();
              const status = getEventStatus(event, nowMs);
              const statusClass = statusStyleMap[status] || statusStyleMap.ended;
              const accent = gymAccentById.get(event.gymId) || {
                leftBorderClass: "border-l-slate-300",
                chipClass: "bg-slate-100 text-slate-700",
              };
              const timingLabel = buildEventTimingLabel(event, nowMs);
              return (
                <section
                  key={event.id}
                  className={`rounded-2xl border border-slate-200 border-l-4 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${accent.leftBorderClass}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3 className="text-lg font-semibold text-slate-900">{event.name}</h3>
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass}`}>
                      {statusLabelMap[status]}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">
                    開催期間: {toDateText(event.startDate)} 〜 {toDateText(event.endDate)}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${accent.chipClass}`}>
                      {gymNameById.get(event.gymId) || "未設定ジム"}
                    </span>
                    {timingLabel ? (
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                        {timingLabel}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link
                      to={`/score-summary/${event.id}`}
                      className="inline-flex items-center rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-800 transition hover:bg-sky-100"
                    >
                      このイベントのランキングを見る
                    </Link>
                    <Link
                      to={`/score-summary/${event.id}/ranking?from=portal`}
                      className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      新ランキング表示
                    </Link>
                  </div>
                </section>
              );
            })}
          </div>
        )}

        <div className="mt-8">
          <Link
            to="/"
            className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            ← Homeに戻る
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ScoreSummary;

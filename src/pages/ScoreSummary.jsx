import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { usePageTitle } from "../hooks/usePageTitle";
import ManagementHero from "../components/ManagementHero";
import {
  inputFieldClass,
  pageBackgroundClass,
  pageContainerClass,
  sectionCardClass,
  sectionHeadingClass,
  subtleButtonClass,
} from "../components/uiStyles";

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

const Icon = ({ children, className = "h-4 w-4" }) => (
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
    {children}
  </svg>
);

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
      <div className={pageBackgroundClass}>
        <div className={pageContainerClass}>
          <p className="text-sm text-slate-600">イベントを読み込んでいます...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={pageBackgroundClass}>
        <div className={pageContainerClass}>
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </p>
          <div className="mt-6">
            <Link to="/" className={subtleButtonClass}>
              ↑ Back to TOP
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={pageBackgroundClass}>
      <div className={pageContainerClass}>
        <ManagementHero
          title="Climber Portal"
          description="Live/Pastでイベントを切り替え、ランキングを確認します。"
          backTo="/"
          backLabel="↑ Back to TOP"
          surface={false}
        />

        <section className="mt-5">
          <h2 className={sectionHeadingClass}>Filters</h2>
          <div className={sectionCardClass}>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex min-w-[260px] flex-1 items-center gap-2 text-sm text-slate-600">
                <Icon className="h-4 w-4 text-slate-400">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </Icon>
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="例: Spring"
                  className={`w-full ${inputFieldClass}`}
                />
              </label>
              <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white p-1">
                <button
                  type="button"
                  onClick={() => setViewFilter("live")}
                  className={`rounded-full px-3 py-1 text-sm font-bold transition ${
                    viewFilter === "live" ? "bg-emerald-800 text-white" : "text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  Live
                </button>
                <button
                  type="button"
                  onClick={() => setViewFilter("past")}
                  className={`rounded-full px-3 py-1 text-sm font-bold transition ${
                    viewFilter === "past" ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  Past
                </button>
              </div>
              <label className="text-sm text-slate-700">
                ジム:
                <select
                  value={gymFilter}
                  onChange={(e) => setGymFilter(e.target.value)}
                  className={`ml-2 min-w-[170px] ${inputFieldClass}`}
                >
                  <option value="all">すべて</option>
                  {gyms.map((gym) => (
                    <option key={gym.id} value={gym.id}>
                      {gym.name}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" onClick={resetFilters} className={subtleButtonClass}>
                フィルターをリセット
              </button>
            </div>
            <p className="mt-3 text-sm font-medium text-slate-600">
              表示 {filteredEvents.length} / {baseEvents.length} 件
            </p>
          </div>
        </section>

        <section className="mt-5">
          <h2 className={sectionHeadingClass}>Events</h2>
          {events.length === 0 ? (
            <p className="text-sm text-slate-600">イベントがありません。</p>
          ) : filteredEvents.length === 0 ? (
            <p className="text-sm text-slate-600">条件に一致するイベントがありません。</p>
          ) : (
            <div className="grid gap-3">
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
                      <span
                        className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass}`}
                      >
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
                        to={`/score-summary/${event.id}/ranking?from=portal`}
                        className="inline-flex items-center rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-800 transition hover:bg-sky-100"
                      >
                        ランキングを見る
                      </Link>
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default ScoreSummary;

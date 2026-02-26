import { useEffect, useMemo, useState } from "react";
import { db } from "../firebase";
import { Link } from "react-router-dom";
import { collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import { usePageTitle } from "../hooks/usePageTitle";
import { useOwnerProfile } from "../hooks/useOwnerProfile";

const toDate = (value) => {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (typeof value.seconds === "number") return new Date(value.seconds * 1000);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toDay = (value) => {
  const date = toDate(value);
  if (!date) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const formatDate = (value) => {
  const date = toDate(value);
  if (!date) return "-";
  return date.toLocaleDateString("ja-JP");
};

const formatMonth = (value) => {
  const date = toDate(value);
  if (!date) return "---";
  return date.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
};

const formatDay = (value) => {
  const date = toDate(value);
  if (!date) return "--";
  return String(date.getDate());
};

const getEventStatus = (event) => {
  const start = toDay(event.startDate);
  const end = toDay(event.endDate);
  const today = toDay(new Date());
  if (!start || !end || !today) return "unknown";
  if (today < start) return "upcoming";
  if (today > end) return "completed";
  return "live";
};

const statusStyle = {
  live: "bg-red-50 text-red-600 border border-red-200",
  upcoming: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  completed: "bg-slate-100 text-slate-600 border border-slate-200",
  unknown: "bg-amber-50 text-amber-700 border border-amber-200",
};

const statusLabel = {
  live: "LIVE",
  upcoming: "UPCOMING",
  completed: "Completed",
  unknown: "Unknown",
};

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

const Dashboard = () => {
  usePageTitle("ジムオーナー管理");

  const [events, setEvents] = useState([]);
  const [gyms, setGyms] = useState([]);
  const [eventFilter, setEventFilter] = useState("active");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const {
    gymIds,
    hasAllGymAccess,
    loading: profileLoading,
    error: profileError,
  } = useOwnerProfile();

  useEffect(() => {
    if (profileLoading) return;
    if (profileError) {
      setError(profileError);
      setLoading(false);
      return;
    }

    const fetchEvents = async () => {
      setLoading(true);
      setError("");
      try {
        const [eventSnap, gymSnap] = await Promise.all([
          getDocs(collection(db, "events")),
          getDocs(collection(db, "gyms")),
        ]);
        const eventRows = eventSnap.docs
          .map((eventDoc) => ({ id: eventDoc.id, ...eventDoc.data() }))
          .filter((event) => hasAllGymAccess || gymIds.includes(event.gymId));
        const gymRows = gymSnap.docs
          .map((gymDoc) => ({ id: gymDoc.id, ...gymDoc.data() }))
          .filter((gym) => hasAllGymAccess || gymIds.includes(gym.id))
          .sort((a, b) => (a.name || "").localeCompare(b.name || "", "ja"));
        setEvents(eventRows);
        setGyms(gymRows);
      } catch (err) {
        console.error("イベント取得失敗:", err);
        setError("イベントの取得に失敗しました。");
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, [profileLoading, profileError, gymIds, hasAllGymAccess]);

  const handleDelete = async (id) => {
    if (!window.confirm("このイベントを削除してもよろしいですか？")) return;
    const target = events.find((event) => event.id === id);
    if (!target || (!hasAllGymAccess && !gymIds.includes(target.gymId))) {
      window.alert("このイベントを削除する権限がありません。");
      return;
    }

    try {
      await deleteDoc(doc(db, "events", id));
      setEvents((prev) => prev.filter((event) => event.id !== id));
    } catch (err) {
      console.error("削除に失敗しました:", err);
    }
  };

  const gymNameById = new Map(gyms.map((gym) => [gym.id, gym.name || gym.id]));
  const ownerGymSummary = hasAllGymAccess
    ? "すべてのジム"
    : gyms.length > 0
      ? gyms.map((gym) => gym.name || gym.id).join(" / ")
      : "未割り当て";

  const eventRows = useMemo(() => {
    const withStatus = events.map((event) => ({ ...event, status: getEventStatus(event) }));
    const filtered =
      eventFilter === "active"
        ? withStatus.filter((event) => event.status === "live" || event.status === "upcoming")
        : withStatus;
    const statusOrder = { live: 0, upcoming: 1, completed: 2, unknown: 3 };
    return filtered.sort((a, b) => {
      const priorityDiff = statusOrder[a.status] - statusOrder[b.status];
      if (priorityDiff !== 0) return priorityDiff;
      const aDate = toDate(a.startDate)?.getTime() || 0;
      const bDate = toDate(b.startDate)?.getTime() || 0;
      return bDate - aDate;
    });
  }, [events, eventFilter]);

  const sectionClass = "rounded-xl border border-slate-200 bg-white p-6 shadow-sm";
  const subtleActionClass =
    "inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100";
  const primaryActionClass =
    "inline-flex items-center gap-2 rounded-xl bg-emerald-800 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-900/15 transition hover:bg-emerald-900";
  const dangerButtonClass =
    "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-rose-700 transition hover:bg-rose-50";
  const settingsMenuItemClass =
    "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50";

  if (loading || profileLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <p className="text-sm text-slate-600">管理データを読み込んでいます...</p>
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

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#dbeafe_0%,_#f8fafc_45%,_#ecfeff_100%)]">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">Gym Owner Console</h1>
            <p className="mt-2 text-base text-slate-600">
              クライミングコンペの大会運営とジムイベントを管理します。
            </p>
            <p className="mt-2 text-sm text-slate-500">担当ジム: {ownerGymSummary}</p>
          </div>
          <Link to="/" className={subtleActionClass}>
            ← Back to TOP
          </Link>
        </div>

        <section className="mb-8">
          <h2 className="mb-4 flex items-center gap-2 text-2xl font-bold text-slate-900">
            <Icon className="h-5 w-5 text-emerald-700">
              <circle cx="12" cy="12" r="3.2" />
              <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a2 2 0 0 1-4 0v-.2a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a2 2 0 0 1-2.8-2.8l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a2 2 0 0 1 0-4h.2a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a2 2 0 0 1 2.8-2.8l.1.1a1 1 0 0 0 1.1.2h.1a1 1 0 0 0 .6-.9V4a2 2 0 0 1 4 0v.2a1 1 0 0 0 .6.9h.1a1 1 0 0 0 1.1-.2l.1-.1a2 2 0 0 1 2.8 2.8l-.1.1a1 1 0 0 0-.2 1.1v.1a1 1 0 0 0 .9.6H20a2 2 0 0 1 0 4h-.2a1 1 0 0 0-.9.6Z" />
            </Icon>
            Settings
          </h2>
          <div className={sectionClass}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="max-w-xl">
              <p className="mt-2 text-sm text-slate-600">
                ボルダー/リードの新規コンペを作成し、カテゴリや採点運用を設定します。
              </p>
            </div>
            {hasAllGymAccess || gymIds.length > 0 ? (
              <Link to="/create-event" className={primaryActionClass}>
                <Icon className="h-4 w-4">
                  <path d="M12 5v14M5 12h14" />
                </Icon>
                Create New Event
              </Link>
            ) : (
              <p className="text-sm text-slate-600">
                担当ジムが未設定のため、イベントを作成できません。システム管理者に設定を依頼してください。
              </p>
            )}
          </div>
          </div>
        </section>

        <section>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
              <Icon className="h-5 w-5 text-sky-600">
                <rect x="3" y="5" width="18" height="16" rx="2" />
                <path d="M16 3v4M8 3v4M3 11h18" />
              </Icon>
              Registered Events
            </h2>
            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white p-1">
              <button
                type="button"
                onClick={() => setEventFilter("active")}
                className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                  eventFilter === "active" ? "bg-emerald-800 text-white" : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                ACTIVE
              </button>
              <button
                type="button"
                onClick={() => setEventFilter("all")}
                className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                  eventFilter === "all" ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                ALL
              </button>
            </div>
          </div>

          {!hasAllGymAccess && gymIds.length === 0 ? (
            <p className="text-sm text-slate-600">担当ジムが未設定です。</p>
          ) : eventRows.length === 0 ? (
            <p className="text-sm text-slate-600">条件に一致するイベントがありません。</p>
          ) : (
            <div className="grid gap-4">
              {eventRows.map((event) => {
                const status = event.status;
                const isCompleted = status === "completed";
                const statusClass = statusStyle[status] || statusStyle.unknown;
                const label = statusLabel[status] || statusLabel.unknown;
                return (
                  <article
                    key={event.id}
                    className={`group rounded-xl border p-5 shadow-sm transition ${
                      isCompleted
                        ? "border-slate-200 bg-slate-50/80 opacity-80 hover:opacity-100"
                        : "border-slate-200 bg-white hover:border-emerald-300"
                    }`}
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex items-center gap-4">
                        <div
                          className={`h-16 w-16 shrink-0 rounded-lg text-center ${
                            isCompleted ? "bg-slate-200 text-slate-600" : "bg-emerald-50 text-emerald-800"
                          }`}
                        >
                          <p className="pt-1 text-[10px] font-bold tracking-wide">{formatMonth(event.startDate)}</p>
                          <p className="text-2xl font-black">{formatDay(event.startDate)}</p>
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className={`text-lg font-bold ${isCompleted ? "text-slate-600" : "text-slate-900"}`}>
                              {event.name}
                            </h3>
                            <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusClass}`}>
                              {label}
                            </span>
                          </div>
                          <p className={`mt-1 text-sm ${isCompleted ? "text-slate-400" : "text-slate-500"}`}>
                            ジム: {gymNameById.get(event.gymId) || "未設定"}
                          </p>
                          <p className={`mt-1 text-sm ${isCompleted ? "text-slate-400" : "text-slate-500"}`}>
                            {formatDate(event.startDate)} - {formatDate(event.endDate)}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 lg:justify-end">
                        {!isCompleted && (
                          <>
                            <details className="relative">
                              <summary className={`${subtleActionClass} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>
                                <Icon>
                                  <circle cx="12" cy="12" r="3.2" />
                                  <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a2 2 0 0 1-4 0v-.2a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a2 2 0 0 1-2.8-2.8l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a2 2 0 0 1 0-4h.2a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a2 2 0 0 1 2.8-2.8l.1.1a1 1 0 0 0 1.1.2h.1a1 1 0 0 0 .6-.9V4a2 2 0 0 1 4 0v.2a1 1 0 0 0 .6.9h.1a1 1 0 0 0 1.1-.2l.1-.1a2 2 0 0 1 2.8 2.8l-.1.1a1 1 0 0 0-.2 1.1v.1a1 1 0 0 0 .9.6H20a2 2 0 0 1 0 4h-.2a1 1 0 0 0-.9.6Z" />
                                </Icon>
                                Settings
                              </summary>
                              <div className="absolute right-0 z-20 mt-2 w-52 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
                                <Link to={`/events/${event.id}/edit`} className={settingsMenuItemClass}>
                                  <Icon>
                                    <path d="M4 20h4l10-10-4-4L4 16v4Z" />
                                    <path d="M12 6l4 4" />
                                  </Icon>
                                  イベント設定
                                </Link>
                                <button type="button" onClick={() => handleDelete(event.id)} className={dangerButtonClass}>
                                  <Icon>
                                    <path d="M3 6h18" />
                                    <path d="M8 6V4h8v2" />
                                    <path d="M6 6l1 14h10l1-14" />
                                  </Icon>
                                  イベント削除
                                </button>
                              </div>
                            </details>
                            <Link to={`/events/${event.id}/climbers`} className={subtleActionClass}>
                              <Icon>
                                <circle cx="9" cy="8" r="2.5" />
                                <circle cx="16" cy="9" r="2" />
                                <path d="M4 19c0-2.7 2.2-5 5-5s5 2.3 5 5" />
                                <path d="M14 19c0-1.9 1.6-3.5 3.5-3.5S21 17.1 21 19" />
                              </Icon>
                              Climbers
                            </Link>
                          </>
                        )}
                        <Link to={`/events/${event.id}/scores`} className={subtleActionClass}>
                          <Icon>
                            <path d="M4 19h16" />
                            <path d="M7 16V9" />
                            <path d="M12 16V5" />
                            <path d="M17 16v-6" />
                          </Icon>
                          Scores
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default Dashboard;

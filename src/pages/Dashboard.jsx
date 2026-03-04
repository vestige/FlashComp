import { useEffect, useMemo, useState } from "react";
import { db } from "../firebase";
import { Link } from "react-router-dom";
import { collection, getDocs } from "firebase/firestore";
import { usePageTitle } from "../hooks/usePageTitle";
import { useOwnerProfile } from "../hooks/useOwnerProfile";
import { getEventActionPlan } from "../lib/dashboardActions";
import EventCreateForm from "../components/EventCreateForm";
import ManagementHero from "../components/ManagementHero";
import {
  inputFieldClass,
  pageBackgroundClass,
  pageContainerClass,
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
  upcoming: "bg-sky-50 text-sky-700 border border-sky-200",
  completed: "bg-slate-100 text-slate-600 border border-slate-200",
  unknown: "bg-amber-50 text-amber-700 border border-amber-200",
};

const statusLabel = {
  live: "LIVE",
  upcoming: "UPCOMING",
  completed: "Completed",
  unknown: "Unknown",
};

const actionMeta = {
  settings: {
    label: "Event Settings",
    buildPath: (eventId) => `/events/${eventId}/edit`,
    icon: (
      <>
        <path d="M4 20h4l10-10-4-4L4 16v4Z" />
        <path d="M12 6l4 4" />
      </>
    ),
  },
  climbers: {
    label: "Climbers",
    buildPath: (eventId) => `/events/${eventId}/climbers`,
    icon: (
      <>
        <circle cx="9" cy="8" r="2.5" />
        <circle cx="16" cy="9" r="2" />
        <path d="M4 19c0-2.7 2.2-5 5-5s5 2.3 5 5" />
        <path d="M14 19c0-1.9 1.6-3.5 3.5-3.5S21 17.1 21 19" />
      </>
    ),
  },
  scores: {
    label: "Scores",
    buildPath: (eventId) => `/events/${eventId}/scores`,
    icon: (
      <>
        <path d="M4 19h16" />
        <path d="M7 16V9" />
        <path d="M12 16V5" />
        <path d="M17 16v-6" />
      </>
    ),
  },
  ranking: {
    label: "Public Ranking",
    buildPath: (eventId) => `/score-summary/${eventId}`,
    icon: (
      <>
        <path d="M5 19h14" />
        <path d="M8 17V9l4-3 4 3v8" />
        <path d="M10.5 13h3" />
      </>
    ),
  },
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

const eventCreateButtonClass =
  "inline-flex items-center gap-2 rounded-xl border border-emerald-700 bg-emerald-800 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-900/15 transition hover:bg-emerald-900";

const Dashboard = () => {
  usePageTitle("ジムオーナー管理");

  const [events, setEvents] = useState([]);
  const [gyms, setGyms] = useState([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [eventFilter, setEventFilter] = useState("active");
  const [eventSearch, setEventSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const {
    authUser,
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

  useEffect(() => {
    if (!isCreateModalOpen) return;
    const onKeyDown = (event) => {
      if (event.key === "Escape") setIsCreateModalOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isCreateModalOpen]);

  const gymNameById = useMemo(
    () => new Map(gyms.map((gym) => [gym.id, gym.name || gym.id])),
    [gyms]
  );
  const ownerGymSummary = hasAllGymAccess
    ? "すべてのジム"
    : gyms.length > 0
      ? gyms.map((gym) => gym.name || gym.id).join(" / ")
      : "未割り当て";

  const filterCounts = useMemo(() => {
    const withStatus = events.map((event) => ({ ...event, status: getEventStatus(event) }));
    const active = withStatus.filter((event) => event.status === "live" || event.status === "upcoming").length;
    return { active, all: withStatus.length };
  }, [events]);

  const eventRows = useMemo(() => {
    const withStatus = events.map((event) => ({ ...event, status: getEventStatus(event) }));
    const byStatus =
      eventFilter === "active"
        ? withStatus.filter((event) => event.status === "live" || event.status === "upcoming")
        : withStatus;
    const normalizedKeyword = eventSearch.trim().toLowerCase();
    const filtered = normalizedKeyword
      ? byStatus.filter((event) => {
          const name = String(event.name || "").toLowerCase();
          const gymName = String(gymNameById.get(event.gymId) || "").toLowerCase();
          return name.includes(normalizedKeyword) || gymName.includes(normalizedKeyword);
        })
      : byStatus;
    const statusOrder = { live: 0, upcoming: 1, completed: 2, unknown: 3 };
    return filtered.sort((a, b) => {
      const priorityDiff = statusOrder[a.status] - statusOrder[b.status];
      if (priorityDiff !== 0) return priorityDiff;
      const aDate = toDate(a.startDate)?.getTime() || 0;
      const bDate = toDate(b.startDate)?.getTime() || 0;
      return bDate - aDate;
    });
  }, [events, eventFilter, eventSearch, gymNameById]);

  const statusPrimaryActionClass = {
    upcoming:
      "inline-flex items-center gap-2 rounded-lg border border-sky-300 bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700",
    live:
      "inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800",
    completed:
      "inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-900",
    unknown:
      "inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-slate-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800",
  };
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
    <div className={pageBackgroundClass}>
      <div className={pageContainerClass}>
        <div className="mb-8">
          <ManagementHero
            title="Dashboard"
            description="Manage your climbing competitions and gym events."
            meta={`担当ジム: ${ownerGymSummary}`}
            backTo="/"
            backLabel="↑ Back to TOP"
            surface={false}
          >
            {hasAllGymAccess || gymIds.length > 0 ? (
              <button type="button" onClick={() => setIsCreateModalOpen(true)} className={eventCreateButtonClass}>
                <Icon className="h-4 w-4">
                  <path d="M12 5v14M5 12h14" />
                </Icon>
                Create New Event
              </button>
            ) : null}
          </ManagementHero>
          {!hasAllGymAccess && gymIds.length === 0 ? (
            <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              担当ジムが未設定のため、イベントを作成できません。システム管理者に設定を依頼してください。
            </p>
          ) : null}
        </div>

        <section className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex min-w-[280px] flex-1 items-center gap-2 text-sm text-slate-600">
              <Icon className="h-4 w-4 text-slate-400">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </Icon>
              <input
                type="text"
                value={eventSearch}
                onChange={(e) => setEventSearch(e.target.value)}
                placeholder="Search events by name or location..."
                className={`w-full ${inputFieldClass}`}
              />
            </label>
            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white p-1">
              <button
                type="button"
                onClick={() => setEventFilter("active")}
                className={`rounded-full px-3 py-1 text-sm font-bold transition ${
                  eventFilter === "active" ? "bg-emerald-800 text-white" : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                Active ({filterCounts.active})
              </button>
              <button
                type="button"
                onClick={() => setEventFilter("all")}
                className={`rounded-full px-3 py-1 text-sm font-bold transition ${
                  eventFilter === "all" ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                All Events ({filterCounts.all})
              </button>
            </div>
          </div>
        </section>

        <section className="mt-4">
          <h2 className={sectionHeadingClass}>
            <Icon className="h-5 w-5 text-sky-600">
              <rect x="3" y="5" width="18" height="16" rx="2" />
              <path d="M16 3v4M8 3v4M3 11h18" />
            </Icon>
            Registered Events
          </h2>

          {!hasAllGymAccess && gymIds.length === 0 ? (
            <p className="text-sm text-slate-600">担当ジムが未設定です。</p>
          ) : eventRows.length === 0 ? (
            <p className="text-sm text-slate-600">条件に一致するイベントがありません。</p>
          ) : (
            <div className="grid gap-4">
              {eventRows.map((event) => {
                const status = event.status;
                const isCompleted = status === "completed";
                const isUpcoming = status === "upcoming";
                const { primary: primaryActionKey, secondary: secondaryActionKeys } = getEventActionPlan({
                  status,
                  isCompleted,
                });
                const primaryAction = actionMeta[primaryActionKey];
                const statusClass = statusStyle[status] || statusStyle.unknown;
                const label = statusLabel[status] || statusLabel.unknown;
                return (
                  <article
                    key={event.id}
                    className={`group rounded-xl border p-5 shadow-sm transition ${
                      isCompleted
                        ? "border-slate-200 bg-slate-50/80 opacity-80 hover:opacity-100"
                        : isUpcoming
                          ? "border-sky-200 bg-sky-50/40 hover:border-sky-400"
                          : "border-slate-200 bg-white hover:border-emerald-300"
                    }`}
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex items-center gap-4">
                        <div
                          className={`h-16 w-16 shrink-0 rounded-lg text-center ${
                            isCompleted
                              ? "bg-slate-200 text-slate-600"
                              : isUpcoming
                                ? "bg-sky-100 text-sky-800"
                                : "bg-emerald-50 text-emerald-800"
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
                        <Link
                          to={primaryAction.buildPath(event.id)}
                          className={statusPrimaryActionClass[status] || statusPrimaryActionClass.unknown}
                        >
                          <Icon>{primaryAction.icon}</Icon>
                          {primaryAction.label}
                        </Link>
                        {secondaryActionKeys.map((actionKey) => {
                          const action = actionMeta[actionKey];
                          return (
                            <Link key={actionKey} to={action.buildPath(event.id)} className={subtleButtonClass}>
                              <Icon>{action.icon}</Icon>
                              {action.label}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {isCreateModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4 py-8"
          role="dialog"
          aria-modal="true"
          aria-label="イベント作成"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsCreateModalOpen(false);
          }}
        >
          <section className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-xl sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Create New Event</h3>
                <p className="mt-1 text-sm text-slate-600">
                  大会の基本情報を設定し、新しいイベントを開始します。
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 transition hover:bg-slate-50"
                aria-label="close event create modal"
              >
                ✕
              </button>
            </div>
            <EventCreateForm
              gyms={gyms}
              ownerUid={authUser?.uid || ""}
              submitLabel="Create Event"
              onCancel={() => setIsCreateModalOpen(false)}
              onCreated={(createdEvent) => {
                setEvents((prev) => [createdEvent, ...prev.filter((event) => event.id !== createdEvent.id)]);
                setIsCreateModalOpen(false);
              }}
            />
          </section>
        </div>
      )}
    </div>
  );
};

export default Dashboard;

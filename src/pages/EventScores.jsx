import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import ScoreManager from "../components/ScoreManager";
import ManagementHero from "../components/ManagementHero";
import { formatSeasonDate } from "../lib/seasonStatus";
import { useOwnerProfile } from "../hooks/useOwnerProfile";
import { usePageTitle } from "../hooks/usePageTitle";
import {
  pageBackgroundClass,
  pageContainerClass,
  sectionCardClass,
  sectionHeadingClass,
} from "../components/uiStyles";

const toDate = (value) => {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (typeof value.seconds === "number") return new Date(value.seconds * 1000);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getTimestamp = (value) => {
  const date = toDate(value);
  return date ? date.getTime() : null;
};

const getSeasonPeriodText = (season) => {
  const start = formatSeasonDate(season.startDate);
  const end = formatSeasonDate(season.endDate);
  if (start === "-" && end === "-") return "期間未設定";
  return `${start} - ${end}`;
};

const sortByRegistrationOrder = (rows) => {
  return [...rows].sort((a, b) => {
    const aAt = getTimestamp(a.createdAt);
    const bAt = getTimestamp(b.createdAt);
    if (aAt !== null && bAt !== null) return aAt - bAt;
    if (aAt !== null) return -1;
    if (bAt !== null) return 1;
    return 0;
  });
};

const EventScores = () => {
  const { eventId } = useParams();
  const [seasons, setSeasons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [accessDenied, setAccessDenied] = useState(false);
  const [eventStartDate, setEventStartDate] = useState("");
  const [eventEndDate, setEventEndDate] = useState("");
  const {
    gymIds,
    hasAllGymAccess,
    loading: profileLoading,
    error: profileError,
  } = useOwnerProfile();
  usePageTitle("Score Management");

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

        const eventData = eventSnap.data();
        setEventStartDate(eventData.startDate || "");
        setEventEndDate(eventData.endDate || "");
        if (!hasAllGymAccess && !gymIds.includes(eventData.gymId)) {
          setAccessDenied(true);
          return;
        }

        const seasonSnap = await getDocs(collection(db, "events", eventId, "seasons"));
        const seasonRows = seasonSnap.docs.map((seasonDoc) => ({
          id: seasonDoc.id,
          ...seasonDoc.data(),
        }));
        const seasonTaskSnaps = await Promise.all(
          seasonRows.map((season) => getDocs(collection(db, "events", eventId, "seasons", season.id, "tasks")))
        );
        const seasonsData = sortByRegistrationOrder(
          seasonRows.map((season, index) => ({
            ...season,
            taskCount: seasonTaskSnaps[index]?.size || 0,
          }))
        );
        setSeasons(seasonsData);
      } catch (err) {
        console.error("スコア画面データの取得に失敗:", err);
        setError("スコア画面データの取得に失敗しました。");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [eventId, gymIds, hasAllGymAccess, profileLoading, profileError]);

  const activeSeasonCountText = String(seasons.length);
  const eventPeriodText =
    eventStartDate || eventEndDate
      ? `${formatSeasonDate(eventStartDate)} - ${formatSeasonDate(eventEndDate)}`
      : "-";

  if (loading || profileLoading) {
    return (
      <div className={pageBackgroundClass}>
        <div className={pageContainerClass}>
          <p className="text-sm text-slate-600">スコア画面を読み込んでいます...</p>
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

  return (
    <div className={pageBackgroundClass}>
      <div className={pageContainerClass}>
        <ManagementHero
          title="Score Management"
          description="採点対象の選択とスコア入力を行います。"
          backTo="/dashboard"
          backLabel="↩ ダッシュボードへ戻る"
          surface={false}
        />

        <section className="mt-4">
          <h2 className={sectionHeadingClass}>Summary</h2>
          <div className={sectionCardClass}>
            <div className="grid gap-3 md:grid-cols-3">
              <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Season Count</p>
                <p className="mt-1 text-lg font-bold text-slate-900">{activeSeasonCountText}</p>
              </article>
              <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Event Period</p>
                <p className="mt-1 text-lg font-bold text-slate-900">{eventPeriodText}</p>
              </article>
              <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Registered Seasons
                </p>
                {seasons.length > 0 ? (
                  <ul className="mt-2 space-y-1 text-sm text-slate-700">
                    {seasons.map((season) => (
                      <li key={season.id} className="rounded-md border border-slate-200 bg-white px-2 py-1">
                        <p className="font-semibold text-slate-900">{season.name || season.id}</p>
                        <p className="text-xs text-slate-500">{getSeasonPeriodText(season)}</p>
                        <p className="mt-1 text-xs text-slate-600">
                          Total Routes: {Number.isFinite(season.taskCount) ? season.taskCount : 0}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-sm text-slate-500">登録されているシーズンはありません。</p>
                )}
              </article>
            </div>
          </div>
        </section>

        <section className="mt-5">
          <h2 className={sectionHeadingClass}>📋 Registered Climbers</h2>
          <div className={sectionCardClass}>
            <ScoreManager eventId={eventId} />
          </div>
        </section>
      </div>
    </div>
  );
};

export default EventScores;

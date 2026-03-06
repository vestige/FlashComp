import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import ManagementHero from "../components/ManagementHero";
import { useOwnerProfile } from "../hooks/useOwnerProfile";
import { usePageTitle } from "../hooks/usePageTitle";
import {
  buildAssignedTasks,
  buildTaskByScoreKey,
  fetchCategoryAssignments,
  fetchSeasonTasks,
} from "../lib/taskAssignments";
import {
  pageBackgroundClass,
  pageContainerClass,
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

const formatPercent = (value) => `${(value * 100).toFixed(1)}%`;

const countGender = (participants) => {
  const counts = { male: 0, female: 0, other: 0, unknown: 0 };
  for (const participant of participants) {
    const gender = String(participant.gender || "").toLowerCase();
    if (gender === "male") counts.male += 1;
    else if (gender === "female") counts.female += 1;
    else if (gender === "other") counts.other += 1;
    else counts.unknown += 1;
  }
  return counts;
};

const countClearedTasks = (scoreMap, taskByScoreKey) => {
  let count = 0;
  const countedTaskIds = new Set();
  for (const [scoreKey, isCleared] of Object.entries(scoreMap || {})) {
    if (!isCleared) continue;
    const task = taskByScoreKey.get(scoreKey);
    if (!task) continue;
    const canonicalTaskId = task.id || scoreKey;
    if (countedTaskIds.has(canonicalTaskId)) continue;
    countedTaskIds.add(canonicalTaskId);
    count += 1;
  }
  return count;
};

const Result = () => {
  const { eventId } = useParams();
  const [eventName, setEventName] = useState("");
  const [summary, setSummary] = useState(null);
  const [seasonMetrics, setSeasonMetrics] = useState([]);
  const [categoryMetrics, setCategoryMetrics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [accessDenied, setAccessDenied] = useState(false);
  const {
    gymIds,
    hasAllGymAccess,
    loading: profileLoading,
    error: profileError,
  } = useOwnerProfile();
  usePageTitle(eventName ? `Result: ${eventName}` : "Result");

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
        setEventName(eventData.name || "");
        if (!hasAllGymAccess && !gymIds.includes(eventData.gymId)) {
          setAccessDenied(true);
          return;
        }

        const [seasonSnap, categorySnap, participantSnap] = await Promise.all([
          getDocs(collection(db, "events", eventId, "seasons")),
          getDocs(collection(db, "events", eventId, "categories")),
          getDocs(collection(db, "events", eventId, "participants")),
        ]);

        const seasons = seasonSnap.docs
          .map((seasonDoc) => ({ id: seasonDoc.id, ...seasonDoc.data() }))
          .sort((a, b) => {
            const aStart = toDate(a.startDate)?.getTime() || 0;
            const bStart = toDate(b.startDate)?.getTime() || 0;
            return aStart - bStart;
          });
        const categories = categorySnap.docs
          .map((categoryDoc) => ({ id: categoryDoc.id, ...categoryDoc.data() }))
          .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ja"));
        const participants = participantSnap.docs.map((participantDoc) => ({
          id: participantDoc.id,
          ...participantDoc.data(),
        }));

        const participantsByCategory = new Map(
          categories.map((category) => [
            category.id,
            participants.filter((participant) => participant.categoryId === category.id),
          ])
        );

        const seasonRows = await Promise.all(
          seasons.map(async (season) => {
            const seasonTasks = await fetchSeasonTasks(eventId, season.id);
            const categoryRows = await Promise.all(
              categories.map(async (category) => {
                const participantsInCategory = participantsByCategory.get(category.id) || [];
                const [assignments, scoreSnap] = await Promise.all([
                  fetchCategoryAssignments(eventId, season.id, category.id),
                  getDocs(
                    collection(
                      db,
                      "events",
                      eventId,
                      "seasons",
                      season.id,
                      "categories",
                      category.id,
                      "participants"
                    )
                  ),
                ]);

                const assignedTasks = buildAssignedTasks(seasonTasks, assignments);
                const taskByScoreKey = buildTaskByScoreKey(assignedTasks);

                const completedCount = scoreSnap.docs.reduce(
                  (sum, scoreDoc) => sum + countClearedTasks(scoreDoc.data().scores || {}, taskByScoreKey),
                  0
                );
                const possibleCount = participantsInCategory.length * assignedTasks.length;

                return {
                  categoryId: category.id,
                  categoryName: category.name || category.id,
                  participantCount: participantsInCategory.length,
                  routeCount: assignedTasks.length,
                  completedCount,
                  possibleCount,
                  completionRate: possibleCount > 0 ? completedCount / possibleCount : 0,
                };
              })
            );

            const completedCount = categoryRows.reduce((sum, row) => sum + row.completedCount, 0);
            const possibleCount = categoryRows.reduce((sum, row) => sum + row.possibleCount, 0);

            return {
              seasonId: season.id,
              seasonName: season.name || season.id,
              routeCount: seasonTasks.length,
              completedCount,
              possibleCount,
              completionRate: possibleCount > 0 ? completedCount / possibleCount : 0,
              categories: categoryRows,
            };
          })
        );

        const categoryRows = categories.map((category) => {
          const categoryParticipants = participantsByCategory.get(category.id) || [];
          const genderCounts = countGender(categoryParticipants);
          const completedCount = seasonRows.reduce((sum, season) => {
            const row = season.categories.find((item) => item.categoryId === category.id);
            return sum + (row?.completedCount || 0);
          }, 0);
          const possibleCount = seasonRows.reduce((sum, season) => {
            const row = season.categories.find((item) => item.categoryId === category.id);
            return sum + (row?.possibleCount || 0);
          }, 0);
          return {
            categoryId: category.id,
            categoryName: category.name || category.id,
            participantCount: categoryParticipants.length,
            genderCounts,
            completedCount,
            possibleCount,
            completionRate: possibleCount > 0 ? completedCount / possibleCount : 0,
          };
        });

        const totalRoutes = seasonRows.reduce((sum, season) => sum + season.routeCount, 0);
        const overallCompletedCount = seasonRows.reduce((sum, season) => sum + season.completedCount, 0);
        const overallPossibleCount = seasonRows.reduce((sum, season) => sum + season.possibleCount, 0);

        setSeasonMetrics(seasonRows);
        setCategoryMetrics(categoryRows);
        setSummary({
          seasonCount: seasons.length,
          categoryCount: categories.length,
          participantCount: participants.length,
          totalRoutes,
          genderCounts: countGender(participants),
          overallCompletedCount,
          overallPossibleCount,
          overallCompletionRate:
            overallPossibleCount > 0 ? overallCompletedCount / overallPossibleCount : 0,
        });
      } catch (err) {
        console.error("Resultデータの取得に失敗:", err);
        setError("Resultデータの取得に失敗しました。");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [eventId, gymIds, hasAllGymAccess, profileLoading, profileError]);

  const genderRatioText = useMemo(() => {
    if (!summary) return "-";
    const { male, female, other, unknown } = summary.genderCounts;
    const total = male + female + other + unknown;
    if (total === 0) return "-";
    return `M ${formatPercent(male / total)} / F ${formatPercent(female / total)}`;
  }, [summary]);

  if (loading || profileLoading) {
    return (
      <div className={pageBackgroundClass}>
        <div className={pageContainerClass}>
          <p className="text-sm text-slate-600">Resultデータを読み込んでいます...</p>
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
            このイベントを閲覧する権限がありません。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={pageBackgroundClass}>
      <div className={pageContainerClass}>
        <ManagementHero
          title="Result"
          description="イベント分析データを確認します。"
          backTo="/dashboard"
          backLabel="↑ Back to Dashboard"
          surface={false}
        >
          <Link to={`/score-summary/${eventId}`} className={subtleButtonClass}>
            Open Public Ranking
          </Link>
        </ManagementHero>

        <section className="mt-4">
          <h2 className={sectionHeadingClass}>Summary</h2>
          <div className={sectionCardClass}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Participants</p>
                <p className="mt-1 text-xl font-black text-slate-900">{summary?.participantCount || 0}</p>
              </article>
              <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Total Routes</p>
                <p className="mt-1 text-xl font-black text-slate-900">{summary?.totalRoutes || 0}</p>
              </article>
              <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Overall Completion</p>
                <p className="mt-1 text-xl font-black text-slate-900">
                  {summary ? formatPercent(summary.overallCompletionRate) : "-"}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {summary?.overallCompletedCount || 0} / {summary?.overallPossibleCount || 0}
                </p>
              </article>
              <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Seasons</p>
                <p className="mt-1 text-xl font-black text-slate-900">{summary?.seasonCount || 0}</p>
              </article>
              <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Categories</p>
                <p className="mt-1 text-xl font-black text-slate-900">{summary?.categoryCount || 0}</p>
              </article>
              <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Gender Ratio</p>
                <p className="mt-1 text-lg font-black text-slate-900">{genderRatioText}</p>
              </article>
            </div>
          </div>
        </section>

        <section className="mt-5">
          <h2 className={sectionHeadingClass}>Season Completion</h2>
          <div className={sectionCardClass}>
            {seasonMetrics.length === 0 ? (
              <p className="text-sm text-slate-600">シーズンデータがありません。</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className="border-b border-slate-200 py-2 text-left">Season</th>
                      <th className="border-b border-slate-200 py-2 text-right">Routes</th>
                      <th className="border-b border-slate-200 py-2 text-right">Completed</th>
                      <th className="border-b border-slate-200 py-2 text-right">Possible</th>
                      <th className="border-b border-slate-200 py-2 text-right">Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {seasonMetrics.map((season) => (
                      <tr key={season.seasonId}>
                        <td className="py-2 text-slate-900">{season.seasonName}</td>
                        <td className="py-2 text-right text-slate-700">{season.routeCount}</td>
                        <td className="py-2 text-right text-slate-700">{season.completedCount}</td>
                        <td className="py-2 text-right text-slate-700">{season.possibleCount}</td>
                        <td className="py-2 text-right font-semibold text-slate-900">
                          {formatPercent(season.completionRate)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        <section className="mt-5">
          <h2 className={sectionHeadingClass}>Category Insights</h2>
          <div className={sectionCardClass}>
            {categoryMetrics.length === 0 ? (
              <p className="text-sm text-slate-600">カテゴリデータがありません。</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className="border-b border-slate-200 py-2 text-left">Category</th>
                      <th className="border-b border-slate-200 py-2 text-right">Participants</th>
                      <th className="border-b border-slate-200 py-2 text-right">Male</th>
                      <th className="border-b border-slate-200 py-2 text-right">Female</th>
                      <th className="border-b border-slate-200 py-2 text-right">Other/Unknown</th>
                      <th className="border-b border-slate-200 py-2 text-right">Completion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoryMetrics.map((category) => (
                      <tr key={category.categoryId}>
                        <td className="py-2 text-slate-900">{category.categoryName}</td>
                        <td className="py-2 text-right text-slate-700">{category.participantCount}</td>
                        <td className="py-2 text-right text-slate-700">{category.genderCounts.male}</td>
                        <td className="py-2 text-right text-slate-700">{category.genderCounts.female}</td>
                        <td className="py-2 text-right text-slate-700">
                          {category.genderCounts.other + category.genderCounts.unknown}
                        </td>
                        <td className="py-2 text-right font-semibold text-slate-900">
                          {formatPercent(category.completionRate)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default Result;

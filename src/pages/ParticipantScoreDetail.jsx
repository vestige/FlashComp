import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { usePageTitle } from "../hooks/usePageTitle";
import {
  buildAssignedTasks,
  buildTaskByScoreKey,
  fetchCategoryAssignments,
  fetchSeasonTasks,
} from "../lib/taskAssignments";

const getTimestampText = (value) => {
  if (!value) return "-";
  if (typeof value.toDate === "function") return value.toDate().toLocaleString();
  if (typeof value.seconds === "number") return new Date(value.seconds * 1000).toLocaleString();
  return "-";
};

const addRankToRows = (rows) => {
  const sorted = [...rows].sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (b.clearCount !== a.clearCount) return b.clearCount - a.clearCount;
    return a.name.localeCompare(b.name, "ja");
  });

  let prevPoints = null;
  let prevClears = null;
  let rank = 0;

  return sorted.map((row, index) => {
    if (row.totalPoints !== prevPoints || row.clearCount !== prevClears) {
      rank = index + 1;
    }
    prevPoints = row.totalPoints;
    prevClears = row.clearCount;

    return { ...row, rank };
  });
};

const ParticipantScoreDetail = () => {
  const { eventId, participantId } = useParams();
  const [searchParams] = useSearchParams();
  const categoryQuery = searchParams.get("category") || "";
  const keywordQuery = searchParams.get("q") || "";

  const [event, setEvent] = useState(null);
  const [participant, setParticipant] = useState(null);
  const [allParticipants, setAllParticipants] = useState([]);
  const [seasons, setSeasons] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState(searchParams.get("season") || "all");
  const [seasonSummaries, setSeasonSummaries] = useState([]);
  const [overallRankInfo, setOverallRankInfo] = useState(null);
  const [adjacentParticipants, setAdjacentParticipants] = useState({ prev: null, next: null });
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState("");
  usePageTitle(participant?.name ? `クライマー詳細: ${participant.name}` : "クライマー詳細");

  const buildParticipantDetailLink = (targetParticipantId) => {
    const params = new URLSearchParams();
    if (selectedSeasonId !== "all") params.set("season", selectedSeasonId);
    if (categoryQuery) params.set("category", categoryQuery);
    if (keywordQuery) params.set("q", keywordQuery);
    const query = params.toString();
    return `/score-summary/${eventId}/participants/${targetParticipantId}${query ? `?${query}` : ""}`;
  };

  const summaryLink = useMemo(() => {
    const params = new URLSearchParams();
    if (selectedSeasonId !== "all") params.set("season", selectedSeasonId);
    if (categoryQuery) params.set("category", categoryQuery);
    if (keywordQuery) params.set("q", keywordQuery);
    const query = params.toString();
    return `/score-summary/${eventId}${query ? `?${query}` : ""}`;
  }, [eventId, selectedSeasonId, categoryQuery, keywordQuery]);

  useEffect(() => {
    let cancelled = false;

    const fetchBaseData = async () => {
      setLoading(true);
      setError("");
      try {
        const [eventDocSnap, participantDocSnap, participantsSnap, seasonsSnap, categoriesSnap] = await Promise.all([
          getDoc(doc(db, "events", eventId)),
          getDoc(doc(db, "events", eventId, "participants", participantId)),
          getDocs(collection(db, "events", eventId, "participants")),
          getDocs(collection(db, "events", eventId, "seasons")),
          getDocs(collection(db, "events", eventId, "categories")),
        ]);

        if (!eventDocSnap.exists()) {
          if (!cancelled) setError("イベントが見つかりません。");
          return;
        }
        if (!participantDocSnap.exists()) {
          if (!cancelled) setError("クライマーが見つかりません。");
          return;
        }

        const seasonRows = seasonsSnap.docs
          .map((s) => ({ id: s.id, ...s.data() }))
          .sort((a, b) => a.name.localeCompare(b.name, "ja"));
        const categoryRows = categoriesSnap.docs
          .map((c) => ({ id: c.id, ...c.data() }))
          .sort((a, b) => a.name.localeCompare(b.name, "ja"));

        if (cancelled) return;

        const requestedSeason = searchParams.get("season");
        const initialSeason =
          requestedSeason && (requestedSeason === "all" || seasonRows.some((s) => s.id === requestedSeason))
            ? requestedSeason
            : "all";

        setEvent({ id: eventDocSnap.id, ...eventDocSnap.data() });
        setParticipant({ id: participantDocSnap.id, ...participantDocSnap.data() });
        setAllParticipants(participantsSnap.docs.map((p) => ({ id: p.id, ...p.data() })));
        setSeasons(seasonRows);
        setCategories(categoryRows);
        setSelectedSeasonId(initialSeason);
      } catch (err) {
        console.error("クライマー詳細の初期データ取得に失敗:", err);
        if (!cancelled) setError("クライマー詳細の読み込み中にエラーが発生しました。");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchBaseData();

    return () => {
      cancelled = true;
    };
  }, [eventId, participantId, searchParams]);

  useEffect(() => {
    let cancelled = false;

    const fetchDetailScores = async () => {
      if (loading || !participant || seasons.length === 0 || categories.length === 0) return;

      setCalculating(true);
      try {
        const targetSeasons =
          selectedSeasonId === "all"
            ? seasons
            : seasons.filter((season) => season.id === selectedSeasonId);
        const targetCategoryIds = participant.categoryId
          ? [participant.categoryId]
          : categories.map((category) => category.id);
        const categoryNameMap = new Map(categories.map((category) => [category.id, category.name]));
        const participantNameMap = new Map(allParticipants.map((p) => [p.id, p.name || "名無し"]));
        const participantMemberNoMap = new Map(allParticipants.map((p) => [p.id, p.memberNo || "-"]));

        const seasonRows = [];
        const aggregateByCategory = {};

        for (const season of targetSeasons) {
          const seasonTasks = await fetchSeasonTasks(eventId, season.id);
          const categorySummaries = [];

          const categoryTasks = targetCategoryIds.map(async (categoryId) => {
            const [assignments, scoresSnap] = await Promise.all([
              fetchCategoryAssignments(eventId, season.id, categoryId),
              getDocs(
                collection(
                  db,
                  "events",
                  eventId,
                  "seasons",
                  season.id,
                  "categories",
                  categoryId,
                  "participants"
                )
              ),
            ]);

            const assignedTasks = buildAssignedTasks(seasonTasks, assignments);
            const taskByScoreKey = buildTaskByScoreKey(assignedTasks);

            const rowsByParticipantId = new Map();
            const categoryParticipants = allParticipants.filter((p) => p.categoryId === categoryId);
            for (const p of categoryParticipants) {
              rowsByParticipantId.set(p.id, {
                participantId: p.id,
                name: p.name || "名無し",
                memberNo: p.memberNo || "-",
                totalPoints: 0,
                clearCount: 0,
              });
            }

            let participantScoreData = null;
            for (const scoreDoc of scoresSnap.docs) {
              const scoreData = scoreDoc.data();
              const scoreMap = scoreData.scores || {};
              const currentParticipantId = scoreDoc.id;
              if (currentParticipantId === participant.id) {
                participantScoreData = scoreData;
              }

              const currentRow = rowsByParticipantId.get(currentParticipantId) || {
                participantId: currentParticipantId,
                name: participantNameMap.get(currentParticipantId) || `ID:${currentParticipantId}`,
                memberNo: participantMemberNoMap.get(currentParticipantId) || "-",
                totalPoints: 0,
                clearCount: 0,
              };

              const countedTaskIds = new Set();
              for (const [routeName, isCleared] of Object.entries(scoreMap)) {
                if (!isCleared) continue;
                const task = taskByScoreKey.get(routeName);
                const canonicalTaskId = task?.id || routeName;
                if (countedTaskIds.has(canonicalTaskId)) continue;
                countedTaskIds.add(canonicalTaskId);

                currentRow.totalPoints += Number(task?.points) || 1;
                currentRow.clearCount += 1;
              }

              rowsByParticipantId.set(currentParticipantId, currentRow);
            }

            const rankedRows = addRankToRows(Array.from(rowsByParticipantId.values()));
            const myRankRow = rankedRows.find((row) => row.participantId === participant.id);

            if (!aggregateByCategory[categoryId]) {
              aggregateByCategory[categoryId] = new Map(
                rankedRows.map((row) => [
                  row.participantId,
                  {
                    participantId: row.participantId,
                    name: row.name,
                    memberNo: row.memberNo,
                    totalPoints: 0,
                    clearCount: 0,
                  },
                ])
              );
            }
            for (const row of rankedRows) {
              const aggregateRow = aggregateByCategory[categoryId].get(row.participantId) || {
                participantId: row.participantId,
                name: row.name,
                memberNo: row.memberNo,
                totalPoints: 0,
                clearCount: 0,
              };
              aggregateRow.totalPoints += row.totalPoints;
              aggregateRow.clearCount += row.clearCount;
              aggregateByCategory[categoryId].set(row.participantId, aggregateRow);
            }

            const scores = participantScoreData?.scores || {};
            const clearedTaskIds = new Set();
            const clearedRoutes = [];
            for (const [scoreKey, isCleared] of Object.entries(scores)) {
              if (!isCleared) continue;
              const task = taskByScoreKey.get(scoreKey);
              const canonicalTaskId = task?.id || scoreKey;
              if (clearedTaskIds.has(canonicalTaskId)) continue;
              clearedTaskIds.add(canonicalTaskId);

              clearedRoutes.push({
                routeName: task?.name || scoreKey,
                points: Number(task?.points) || 1,
                grade: task?.grade || "-",
              });
            }
            clearedRoutes.sort((a, b) => a.routeName.localeCompare(b.routeName, "ja"));

            const totalPoints = clearedRoutes.reduce((sum, route) => sum + route.points, 0);

            return {
              categoryId,
              categoryName: categoryNameMap.get(categoryId) || categoryId,
              clearCount: clearedRoutes.length,
              totalPoints,
              rank: myRankRow?.rank || rankedRows.length,
              totalParticipants: rankedRows.length,
              updatedAtText: getTimestampText(participantScoreData?.updatedAt),
              clearedRoutes,
            };
          });

          const categoryResults = (await Promise.all(categoryTasks)).filter(Boolean);
          for (const row of categoryResults) categorySummaries.push(row);

          seasonRows.push({
            seasonId: season.id,
            seasonName: season.name,
            categorySummaries,
            totalPoints: categorySummaries.reduce((sum, row) => sum + row.totalPoints, 0),
            totalClears: categorySummaries.reduce((sum, row) => sum + row.clearCount, 0),
          });
        }

        if (!cancelled) {
          const overallCategoryId = participant.categoryId || targetCategoryIds[0];
          const aggregatedRows = overallCategoryId
            ? Array.from((aggregateByCategory[overallCategoryId] || new Map()).values())
            : [];
          const overallRankedRows = addRankToRows(aggregatedRows);
          const myOverall = overallRankedRows.find((row) => row.participantId === participant.id);

          setOverallRankInfo(
            myOverall
              ? {
                  categoryName: categoryNameMap.get(overallCategoryId) || "未設定",
                  rank: myOverall.rank,
                  totalParticipants: overallRankedRows.length,
                  totalPoints: myOverall.totalPoints,
                  totalClears: myOverall.clearCount,
                }
              : null
          );
          if (myOverall) {
            const myIndex = overallRankedRows.findIndex(
              (row) => row.participantId === participant.id
            );
            const prev = myIndex > 0 ? overallRankedRows[myIndex - 1] : null;
            const next =
              myIndex >= 0 && myIndex < overallRankedRows.length - 1
                ? overallRankedRows[myIndex + 1]
                : null;
            setAdjacentParticipants({ prev, next });
          } else {
            setAdjacentParticipants({ prev: null, next: null });
          }
          setSeasonSummaries(seasonRows);
        }
      } catch (err) {
        console.error("クライマー詳細の集計に失敗:", err);
        if (!cancelled) setError("クライマー詳細の集計中にエラーが発生しました。");
      } finally {
        if (!cancelled) setCalculating(false);
      }
    };

    fetchDetailScores();

    return () => {
      cancelled = true;
    };
  }, [loading, participant, allParticipants, seasons, categories, selectedSeasonId, eventId]);

  const totalSummary = useMemo(
    () => ({
      totalPoints: seasonSummaries.reduce((sum, row) => sum + row.totalPoints, 0),
      totalClears: seasonSummaries.reduce((sum, row) => sum + row.totalClears, 0),
    }),
    [seasonSummaries]
  );

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <p className="text-sm text-slate-600">クライマー詳細を読み込んでいます...</p>
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
            to={summaryLink}
            className="inline-flex items-center rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            ← 集計結果に戻る
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#dbeafe_0%,_#f8fafc_45%,_#ecfeff_100%)]">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold text-slate-900">{event?.name} - クライマー詳細</h2>
        <p className="mt-3 text-sm text-slate-700">
          名前: <strong>{participant?.name || "-"}</strong>
        </p>
        <p className="mt-1 text-sm text-slate-700">
          会員番号: {participant?.memberNo || "-"} / カテゴリ:
          {" "}
          {categories.find((c) => c.id === participant?.categoryId)?.name || "未設定"}
        </p>

        <div className="mt-4">
          <label className="text-sm text-slate-700">
            表示シーズン:
            <select
              value={selectedSeasonId}
              onChange={(e) => setSelectedSeasonId(e.target.value)}
              className="ml-2 rounded-lg border border-slate-300 px-2 py-1 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            >
              <option value="all">総合（全シーズン）</option>
              {seasons.map((season) => (
                <option key={season.id} value={season.id}>
                  {season.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">合計</h3>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-700">
            <p>
              得点: <strong>{totalSummary.totalPoints}</strong>
            </p>
            <p>
              完登数: <strong>{totalSummary.totalClears}</strong>
            </p>
          </div>
          {overallRankInfo && (
            <p className="mt-2 text-sm text-slate-700">
              順位（{overallRankInfo.categoryName}）:
              {" "}
              <strong>{overallRankInfo.rank}</strong>
              {" / "}
              {overallRankInfo.totalParticipants}
              {" "}
              （得点 {overallRankInfo.totalPoints} / 完登 {overallRankInfo.totalClears}）
            </p>
          )}
        </section>
        {(adjacentParticipants.prev || adjacentParticipants.next) && (
          <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">近い順位のクライマー</h3>
            <div className="mt-2 flex flex-wrap gap-2 text-sm">
              {adjacentParticipants.prev ? (
                <Link
                  to={buildParticipantDetailLink(adjacentParticipants.prev.participantId)}
                  className="inline-flex items-center rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1 text-slate-700 transition hover:bg-slate-100"
                >
                  ↑ {adjacentParticipants.prev.rank}位 {adjacentParticipants.prev.name}
                </Link>
              ) : (
                <span className="text-slate-600">これより上位のクライマーはいません</span>
              )}
              {adjacentParticipants.next ? (
                <Link
                  to={buildParticipantDetailLink(adjacentParticipants.next.participantId)}
                  className="inline-flex items-center rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1 text-slate-700 transition hover:bg-slate-100"
                >
                  ↓ {adjacentParticipants.next.rank}位 {adjacentParticipants.next.name}
                </Link>
              ) : (
                <span className="text-slate-600">これより下位のクライマーはいません</span>
              )}
            </div>
          </section>
        )}

        {calculating && <p className="mt-4 text-sm text-slate-600">内訳を計算中...</p>}

        <div className="mt-5">
          {seasonSummaries.length === 0 ? (
            <p className="text-sm text-slate-600">採点データがありません。</p>
          ) : (
            seasonSummaries.map((season) => (
              <section
                key={season.seasonId}
                className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <h3 className="text-lg font-semibold text-slate-900">
                  {season.seasonName} / 得点 {season.totalPoints} / 完登 {season.totalClears}
                </h3>

                {season.categorySummaries.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-600">このシーズンの採点データはありません。</p>
                ) : (
                  season.categorySummaries.map((category) => (
                    <div key={`${season.seasonId}-${category.categoryId}`} className="mt-4">
                      <h4 className="text-sm font-semibold text-slate-800">
                        カテゴリ: {category.categoryName} / 順位 {category.rank}/{category.totalParticipants}
                        {" / "}得点 {category.totalPoints} / 完登 {category.clearCount}
                      </h4>
                      <p className="mt-1 text-xs text-slate-500">
                        最終更新: {category.updatedAtText}
                      </p>
                      {category.clearedRoutes.length === 0 ? (
                        <p className="mt-2 text-sm text-slate-600">完登課題はありません。</p>
                      ) : (
                        <div className="mt-2 overflow-x-auto">
                          <table className="min-w-[360px] w-full border-collapse text-sm">
                            <thead>
                              <tr>
                                <th className="border-b border-slate-200 py-2 text-left">課題</th>
                                <th className="border-b border-slate-200 py-2 text-left">グレード</th>
                                <th className="border-b border-slate-200 py-2 text-right">点数</th>
                              </tr>
                            </thead>
                            <tbody>
                              {category.clearedRoutes.map((route) => (
                                <tr key={route.routeName}>
                                  <td className="py-2">{route.routeName}</td>
                                  <td className="py-2">{route.grade}</td>
                                  <td className="py-2 text-right">{route.points}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </section>
            ))
          )}
        </div>

        <div className="mt-6">
          <Link
            to={summaryLink}
            className="inline-flex items-center rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            ← 集計結果に戻る
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ParticipantScoreDetail;

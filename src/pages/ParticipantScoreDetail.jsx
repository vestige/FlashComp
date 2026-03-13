import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { usePageTitle } from "../hooks/usePageTitle";
import ManagementHero from "../components/ManagementHero";
import {
  buildAssignedTasks,
  buildTaskByScoreKey,
  fetchCategoryAssignments,
  fetchSeasonTasks,
} from "../lib/taskAssignments";
import {
  inputFieldClass,
  pageBackgroundClass,
  pageContainerClass,
  sectionCardClass,
  sectionHeadingClass,
  subtleButtonClass,
} from "../components/uiStyles";

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
  const returnTarget = searchParams.get("return") || "";
  const fromQuery = searchParams.get("from") || "";
  const modeQuery = searchParams.get("mode") || "";
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
    if (returnTarget === "ranking") params.set("return", "ranking");
    if (fromQuery) params.set("from", fromQuery);
    if (modeQuery && modeQuery !== "category") params.set("mode", modeQuery);
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

  const rankingLink = useMemo(() => {
    if (returnTarget !== "ranking") return "";
    const params = new URLSearchParams();
    if (fromQuery) params.set("from", fromQuery);
    if (modeQuery && modeQuery !== "category") params.set("mode", modeQuery);
    if (selectedSeasonId !== "all") params.set("season", selectedSeasonId);
    if (categoryQuery) params.set("category", categoryQuery);
    if (keywordQuery) params.set("q", keywordQuery);
    const query = params.toString();
    const basePath =
      fromQuery === "owner" ? `/events/${eventId}/ranking` : `/score-summary/${eventId}/ranking`;
    return `${basePath}${query ? `?${query}` : ""}`;
  }, [returnTarget, fromQuery, modeQuery, selectedSeasonId, categoryQuery, keywordQuery, eventId]);

  const backLink = rankingLink || summaryLink;
  const backLabel = rankingLink ? "← ランキングに戻る" : "← 集計結果に戻る";
  const participantCategoryId = participant?.categoryId || "";
  const participantCategoryName = useMemo(
    () => categories.find((category) => category.id === participantCategoryId)?.name || "未設定",
    [categories, participantCategoryId]
  );

  useEffect(() => {
    let cancelled = false;

    const fetchBaseData = async () => {
      setLoading(true);
      setError("");
      try {
        const [eventDocSnap, participantDocSnap, seasonsSnap, categoriesSnap] = await Promise.all([
          getDoc(doc(db, "events", eventId)),
          getDoc(doc(db, "events", eventId, "participants", participantId)),
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
        const participantData = participantDocSnap.data();
        const participantCategoryId = participantData.categoryId || "";

        const participantsQueryRef = participantCategoryId
          ? query(
              collection(db, "events", eventId, "participants"),
              where("categoryId", "==", participantCategoryId)
            )
          : collection(db, "events", eventId, "participants");
        const participantsSnap = await getDocs(participantsQueryRef);

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
        setParticipant({ id: participantDocSnap.id, ...participantData });
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
    if (seasons.length === 0) return;
    if (selectedSeasonId === "all") return;
    if (seasons.every((season) => season.id !== selectedSeasonId)) {
      setSelectedSeasonId("all");
    }
  }, [seasons, selectedSeasonId]);

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

  const overallRankValue = overallRankInfo
    ? `${overallRankInfo.rank} / ${overallRankInfo.totalParticipants}`
    : "-";
  const averagePoints = overallRankInfo?.totalParticipants
    ? Math.round((overallRankInfo.totalPoints / overallRankInfo.totalParticipants) * 10) / 10
    : 0;

  if (loading) {
    return (
      <div className={pageBackgroundClass}>
        <div className={pageContainerClass}>
          <div className={sectionCardClass}>
            <p className="text-sm text-slate-600">クライマー詳細を読み込んでいます...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={pageBackgroundClass}>
        <div className={pageContainerClass}>
          <div className={sectionCardClass}>
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </p>
            <div className="mt-6">
              <Link
                to={backLink}
                className={subtleButtonClass}
              >
                {backLabel}
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={pageBackgroundClass}>
      <div className={pageContainerClass}>
        <div className="mb-6">
          <ManagementHero
            title="Climber Detail"
            description="クライマーの内訳・完登数・順位をモダンなレイアウトで確認します。"
            meta={`イベント: ${event?.name || "-"} / 名前: ${participant?.name || "-"} / 会員番号: ${
              participant?.memberNo || "-"
            } / カテゴリ: ${participantCategoryName}`}
            backTo={backLink}
            backLabel={backLabel}
            surface={false}
          />
        </div>

        <section className="mt-4">
          <h2 className={sectionHeadingClass}>表示シーズン</h2>
          <div className={sectionCardClass}>
            <label className="block text-sm text-slate-700">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Season Filter</span>
              <select
                value={selectedSeasonId}
                onChange={(e) => setSelectedSeasonId(e.target.value)}
                className={`${inputFieldClass} mt-1 w-full`}
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
        </section>

        <section className="mt-4">
          <h2 className={sectionHeadingClass}>サマリ</h2>
          <div className={sectionCardClass}>
            <div className="grid gap-3 md:grid-cols-4">
              <article className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold text-slate-500">総合ポイント</p>
                <p className="mt-1 text-lg font-bold text-slate-900">{totalSummary.totalPoints}</p>
              </article>
              <article className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold text-slate-500">合計完登</p>
                <p className="mt-1 text-lg font-bold text-slate-900">{totalSummary.totalClears}</p>
              </article>
              <article className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold text-slate-500">順位</p>
                <p className="mt-1 text-lg font-bold text-slate-900">{overallRankValue}</p>
              </article>
              <article className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold text-slate-500">平均ポイント</p>
                <p className="mt-1 text-lg font-bold text-slate-900">
                  {overallRankInfo ? averagePoints.toFixed(1) : "-"}
                </p>
              </article>
            </div>
            {overallRankInfo && (
              <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                {overallRankInfo.categoryName} の順位情報: {overallRankInfo.rank}位 / {overallRankInfo.totalParticipants}人
                （得点 {overallRankInfo.totalPoints} / 完登 {overallRankInfo.totalClears}）
              </p>
            )}
          </div>
        </section>

        {(adjacentParticipants.prev || adjacentParticipants.next) && (
          <section className="mt-4">
            <h2 className={sectionHeadingClass}>近い順位</h2>
            <div className={sectionCardClass}>
              <div className="flex flex-col gap-2 text-sm sm:flex-row sm:gap-3">
                {adjacentParticipants.prev ? (
                  <Link
                    to={buildParticipantDetailLink(adjacentParticipants.prev.participantId)}
                    className={`${subtleButtonClass} w-full sm:w-auto`}
                  >
                    <span>↑</span>
                    <span className="font-semibold">{adjacentParticipants.prev.rank}位</span>
                    <span>{adjacentParticipants.prev.name}</span>
                  </Link>
                ) : (
                  <span className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-600">上位なし</span>
                )}
                {adjacentParticipants.next ? (
                  <Link
                    to={buildParticipantDetailLink(adjacentParticipants.next.participantId)}
                    className={`${subtleButtonClass} w-full sm:w-auto`}
                  >
                    <span>↓</span>
                    <span className="font-semibold">{adjacentParticipants.next.rank}位</span>
                    <span>{adjacentParticipants.next.name}</span>
                  </Link>
                ) : (
                  <span className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-600">下位なし</span>
                )}
              </div>
            </div>
          </section>
        )}

        {calculating && (
          <div className="mt-4">
            <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-700">
              内訳を計算中...
            </p>
          </div>
        )}

        <div className="mt-5">
          {seasonSummaries.length === 0 ? (
            <p className="text-sm text-slate-600">採点データがありません。</p>
          ) : (
            seasonSummaries.map((season) => (
              <section
                key={season.seasonId}
                className="mb-4"
              >
                <h2 className={sectionHeadingClass}>{season.seasonName}</h2>
                <div className={sectionCardClass}>
                  <div className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-3">
                    <article>
                      <p className="text-xs font-semibold text-slate-500">シーズン合計ポイント</p>
                      <p className="mt-1 text-base font-bold text-slate-900">{season.totalPoints}</p>
                    </article>
                    <article>
                      <p className="text-xs font-semibold text-slate-500">シーズン完登</p>
                      <p className="mt-1 text-base font-bold text-slate-900">{season.totalClears}</p>
                    </article>
                    <article>
                      <p className="text-xs font-semibold text-slate-500">カテゴリ数</p>
                      <p className="mt-1 text-base font-bold text-slate-900">{season.categorySummaries.length}</p>
                    </article>
                  </div>

                  {season.categorySummaries.length === 0 ? (
                    <p className="mt-2 text-sm text-slate-600">このシーズンの採点データはありません。</p>
                  ) : (
                    season.categorySummaries.map((category) => (
                      <div
                        key={`${season.seasonId}-${category.categoryId}`}
                        className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                      >
                        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                          <h3 className="text-sm font-semibold text-slate-800">{category.categoryName}</h3>
                          <p className="mt-1 text-xs text-slate-500">
                            順位 {category.rank}/{category.totalParticipants} / 得点 {category.totalPoints} / 完登 {category.clearCount}
                          </p>
                          <p className="text-xs text-slate-500">最終更新: {category.updatedAtText}</p>
                        </div>
                        {category.clearedRoutes.length === 0 ? (
                          <p className="bg-white px-4 py-3 text-sm text-slate-600">完登課題はありません。</p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="min-w-[420px] w-full border-collapse text-sm">
                              <thead>
                                <tr className="bg-slate-100/70">
                                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">課題</th>
                                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">グレード</th>
                                  <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600">点数</th>
                                </tr>
                              </thead>
                              <tbody>
                                {category.clearedRoutes.map((route) => (
                                  <tr
                                    key={route.routeName}
                                    className="border-b border-slate-200 transition hover:bg-slate-50"
                                  >
                                    <td className="px-4 py-2 text-slate-800">{route.routeName}</td>
                                    <td className="px-4 py-2 text-slate-700">{route.grade}</td>
                                    <td className="px-4 py-2 text-right font-semibold text-slate-900">{route.points}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </section>
            ))
          )}
        </div>
        <div className="mt-6">
          <Link
            to={backLink}
            className={subtleButtonClass}
          >
            {backLabel}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ParticipantScoreDetail;

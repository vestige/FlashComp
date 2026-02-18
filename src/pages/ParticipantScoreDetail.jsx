import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { db } from "../firebase";

const getTimestampText = (value) => {
  if (!value) return "-";
  if (typeof value.toDate === "function") return value.toDate().toLocaleString();
  if (typeof value.seconds === "number") return new Date(value.seconds * 1000).toLocaleString();
  return "-";
};

const ParticipantScoreDetail = () => {
  const { eventId, participantId } = useParams();
  const [searchParams] = useSearchParams();

  const [event, setEvent] = useState(null);
  const [participant, setParticipant] = useState(null);
  const [seasons, setSeasons] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState(searchParams.get("season") || "all");
  const [seasonSummaries, setSeasonSummaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState("");

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
          if (!cancelled) setError("参加者が見つかりません。");
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
        setSeasons(seasonRows);
        setCategories(categoryRows);
        setSelectedSeasonId(initialSeason);
      } catch (err) {
        console.error("参加者詳細の初期データ取得に失敗:", err);
        if (!cancelled) setError("参加者詳細の読み込み中にエラーが発生しました。");
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

        const seasonRows = [];

        for (const season of targetSeasons) {
          const categorySummaries = [];

          const categoryTasks = targetCategoryIds.map(async (categoryId) => {
            const [routesSnap, scoreDocSnap] = await Promise.all([
              getDocs(
                collection(
                  db,
                  "events",
                  eventId,
                  "seasons",
                  season.id,
                  "categories",
                  categoryId,
                  "routes"
                )
              ),
              getDoc(
                doc(
                  db,
                  "events",
                  eventId,
                  "seasons",
                  season.id,
                  "categories",
                  categoryId,
                  "participants",
                  participant.id
                )
              ),
            ]);

            if (!scoreDocSnap.exists()) return null;

            const routeMap = new Map(
              routesSnap.docs.map((routeDoc) => {
                const route = routeDoc.data();
                return [route.name, route];
              })
            );

            const scoreData = scoreDocSnap.data();
            const scores = scoreData.scores || {};
            const clearedRoutes = Object.entries(scores)
              .filter(([, isCleared]) => !!isCleared)
              .map(([routeName]) => {
                const route = routeMap.get(routeName);
                return {
                  routeName,
                  points: Number(route?.points) || 1,
                  grade: route?.grade || "-",
                };
              })
              .sort((a, b) => a.routeName.localeCompare(b.routeName, "ja"));

            const totalPoints = clearedRoutes.reduce((sum, route) => sum + route.points, 0);

            return {
              categoryId,
              categoryName: categoryNameMap.get(categoryId) || categoryId,
              clearCount: clearedRoutes.length,
              totalPoints,
              updatedAtText: getTimestampText(scoreData.updatedAt),
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
          setSeasonSummaries(seasonRows);
        }
      } catch (err) {
        console.error("参加者詳細の集計に失敗:", err);
        if (!cancelled) setError("参加者詳細の集計中にエラーが発生しました。");
      } finally {
        if (!cancelled) setCalculating(false);
      }
    };

    fetchDetailScores();

    return () => {
      cancelled = true;
    };
  }, [loading, participant, seasons, categories, selectedSeasonId, eventId]);

  const totalSummary = useMemo(
    () => ({
      totalPoints: seasonSummaries.reduce((sum, row) => sum + row.totalPoints, 0),
      totalClears: seasonSummaries.reduce((sum, row) => sum + row.totalClears, 0),
    }),
    [seasonSummaries]
  );

  if (loading) {
    return <p>参加者詳細を読み込んでいます...</p>;
  }

  if (error) {
    return (
      <div style={{ padding: "2em" }}>
        <p>{error}</p>
        <div style={{ marginTop: "1.5em" }}>
          <Link to={`/score-summary/${eventId}`}>← 集計結果に戻る</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "2em", maxWidth: "980px", margin: "0 auto" }}>
      <h2>{event?.name} - 参加者詳細</h2>
      <p style={{ marginBottom: "0.4em" }}>
        名前: <strong>{participant?.name || "-"}</strong>
      </p>
      <p style={{ marginTop: 0 }}>
        会員番号: {participant?.memberNo || "-"} / カテゴリ:
        {" "}
        {categories.find((c) => c.id === participant?.categoryId)?.name || "未設定"}
      </p>

      <div style={{ margin: "1em 0" }}>
        <label>
          表示シーズン:
          <select
            value={selectedSeasonId}
            onChange={(e) => setSelectedSeasonId(e.target.value)}
            style={{ marginLeft: "0.5em" }}
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

      <section style={{ border: "1px solid #ddd", borderRadius: "8px", padding: "1em" }}>
        <h3 style={{ marginTop: 0 }}>合計</h3>
        <p style={{ marginBottom: 0 }}>
          得点: <strong>{totalSummary.totalPoints}</strong> / 完登数: <strong>{totalSummary.totalClears}</strong>
        </p>
      </section>

      {calculating && <p style={{ marginTop: "1em" }}>内訳を計算中...</p>}

      <div style={{ marginTop: "1.2em" }}>
        {seasonSummaries.length === 0 ? (
          <p>採点データがありません。</p>
        ) : (
          seasonSummaries.map((season) => (
            <section
              key={season.seasonId}
              style={{ border: "1px solid #ddd", borderRadius: "8px", padding: "1em", marginBottom: "1em" }}
            >
              <h3 style={{ marginTop: 0 }}>
                {season.seasonName} / 得点 {season.totalPoints} / 完登 {season.totalClears}
              </h3>

              {season.categorySummaries.length === 0 ? (
                <p>このシーズンの採点データはありません。</p>
              ) : (
                season.categorySummaries.map((category) => (
                  <div key={`${season.seasonId}-${category.categoryId}`} style={{ marginTop: "1em" }}>
                    <h4 style={{ marginBottom: "0.4em" }}>
                      カテゴリ: {category.categoryName} / 得点 {category.totalPoints} / 完登 {category.clearCount}
                    </h4>
                    <p style={{ marginTop: 0, fontSize: "0.9em" }}>
                      最終更新: {category.updatedAtText}
                    </p>
                    {category.clearedRoutes.length === 0 ? (
                      <p>完登課題はありません。</p>
                    ) : (
                      <table style={{ borderCollapse: "collapse", width: "100%" }}>
                        <thead>
                          <tr>
                            <th style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>課題</th>
                            <th style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>グレード</th>
                            <th style={{ textAlign: "right", borderBottom: "1px solid #ccc" }}>点数</th>
                          </tr>
                        </thead>
                        <tbody>
                          {category.clearedRoutes.map((route) => (
                            <tr key={route.routeName}>
                              <td style={{ padding: "0.35em 0" }}>{route.routeName}</td>
                              <td>{route.grade}</td>
                              <td style={{ textAlign: "right" }}>{route.points}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                ))
              )}
            </section>
          ))
        )}
      </div>

      <div style={{ marginTop: "1.5em" }}>
        <Link to={`/score-summary/${eventId}`}>← 集計結果に戻る</Link>
      </div>
    </div>
  );
};

export default ParticipantScoreDetail;

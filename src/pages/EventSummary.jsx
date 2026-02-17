import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { db } from "../firebase";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";

const getTimestampMs = (value) => {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.seconds === "number") return value.seconds * 1000;
  return 0;
};

const buildInitialCategoryMap = (categories, participants) => {
  const result = {};

  for (const category of categories) {
    const byParticipantId = new Map();
    for (const participant of participants.filter((p) => p.categoryId === category.id)) {
      byParticipantId.set(participant.id, {
        participantId: participant.id,
        name: participant.name || "名無し",
        memberNo: participant.memberNo || "-",
        totalPoints: 0,
        clearCount: 0,
        latestUpdatedAt: 0,
      });
    }
    result[category.id] = byParticipantId;
  }

  return result;
};

const buildRankings = (categoryMap) => {
  const rankings = {};

  for (const [categoryId, participants] of Object.entries(categoryMap)) {
    const sorted = Array.from(participants.values()).sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      if (b.clearCount !== a.clearCount) return b.clearCount - a.clearCount;
      return a.name.localeCompare(b.name, "ja");
    });

    let prevPoints = null;
    let prevClears = null;
    let rank = 0;

    rankings[categoryId] = sorted.map((row, index) => {
      if (row.totalPoints !== prevPoints || row.clearCount !== prevClears) {
        rank = index + 1;
      }

      prevPoints = row.totalPoints;
      prevClears = row.clearCount;

      return { ...row, rank };
    });
  }

  return rankings;
};

const EventSummary = () => {
  const { eventId } = useParams();
  const [event, setEvent] = useState(null);
  const [seasons, setSeasons] = useState([]);
  const [categories, setCategories] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState("all");
  const [rankings, setRankings] = useState({});
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const fetchBaseData = async () => {
      setLoading(true);
      setError("");
      try {
        const eventDocSnap = await getDoc(doc(db, "events", eventId));
        if (!eventDocSnap.exists()) {
          if (!cancelled) setError("指定されたイベントが見つかりません。");
          return;
        }

        const [seasonSnap, categorySnap, participantSnap] = await Promise.all([
          getDocs(collection(db, "events", eventId, "seasons")),
          getDocs(collection(db, "events", eventId, "categories")),
          getDocs(collection(db, "events", eventId, "participants")),
        ]);

        if (cancelled) return;

        setEvent({ id: eventDocSnap.id, ...eventDocSnap.data() });
        setSeasons(
          seasonSnap.docs
            .map((s) => ({ id: s.id, ...s.data() }))
            .sort((a, b) => a.name.localeCompare(b.name, "ja"))
        );
        setCategories(
          categorySnap.docs
            .map((c) => ({ id: c.id, ...c.data() }))
            .sort((a, b) => a.name.localeCompare(b.name, "ja"))
        );
        setParticipants(participantSnap.docs.map((p) => ({ id: p.id, ...p.data() })));
      } catch (err) {
        console.error("集計用データの取得に失敗:", err);
        if (!cancelled) setError("集計データの読み込み中にエラーが発生しました。");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchBaseData();

    return () => {
      cancelled = true;
    };
  }, [eventId]);

  useEffect(() => {
    let cancelled = false;

    const calculateRankings = async () => {
      if (loading || !event || categories.length === 0) return;
      setError("");

      const targetSeasonIds =
        selectedSeasonId === "all"
          ? seasons.map((season) => season.id)
          : [selectedSeasonId].filter(Boolean);

      if (targetSeasonIds.length === 0) {
        setRankings(buildRankings(buildInitialCategoryMap(categories, participants)));
        return;
      }

      setCalculating(true);
      try {
        const categoryMap = buildInitialCategoryMap(categories, participants);
        const participantById = new Map(participants.map((p) => [p.id, p]));

        const fetchTasks = targetSeasonIds.flatMap((seasonId) =>
          categories.map(async (category) => {
            const [routeSnap, scoreSnap] = await Promise.all([
              getDocs(
                collection(
                  db,
                  "events",
                  eventId,
                  "seasons",
                  seasonId,
                  "categories",
                  category.id,
                  "routes"
                )
              ),
              getDocs(
                collection(
                  db,
                  "events",
                  eventId,
                  "seasons",
                  seasonId,
                  "categories",
                  category.id,
                  "participants"
                )
              ),
            ]);

            return { categoryId: category.id, routeSnap, scoreSnap };
          })
        );

        const results = await Promise.all(fetchTasks);

        for (const { categoryId, routeSnap, scoreSnap } of results) {
          const routePointMap = {};
          for (const routeDoc of routeSnap.docs) {
            const route = routeDoc.data();
            routePointMap[route.name] = Number(route.points) || 1;
          }

          for (const scoreDoc of scoreSnap.docs) {
            const data = scoreDoc.data();
            const scoreMap = data.scores || {};
            const participantId = scoreDoc.id;

            if (!categoryMap[categoryId].has(participantId)) {
              const fallback = participantById.get(participantId);
              categoryMap[categoryId].set(participantId, {
                participantId,
                name: fallback?.name || data.participantName || `ID:${participantId}`,
                memberNo: fallback?.memberNo || "-",
                totalPoints: 0,
                clearCount: 0,
                latestUpdatedAt: 0,
              });
            }

            const row = categoryMap[categoryId].get(participantId);

            for (const [routeName, isCleared] of Object.entries(scoreMap)) {
              if (!isCleared) continue;
              row.totalPoints += routePointMap[routeName] ?? 1;
              row.clearCount += 1;
            }

            row.latestUpdatedAt = Math.max(row.latestUpdatedAt, getTimestampMs(data.updatedAt));
          }
        }

        if (!cancelled) {
          setRankings(buildRankings(categoryMap));
        }
      } catch (err) {
        console.error("ランキング計算に失敗:", err);
        if (!cancelled) setError("ランキング計算中にエラーが発生しました。");
      } finally {
        if (!cancelled) setCalculating(false);
      }
    };

    calculateRankings();

    return () => {
      cancelled = true;
    };
  }, [loading, event, categories, participants, seasons, selectedSeasonId, eventId]);

  if (loading) {
    return <p>集計情報を読み込んでいます...</p>;
  }

  if (error) {
    return (
      <div style={{ padding: "2em" }}>
        <p>{error}</p>
        <div style={{ marginTop: "2em" }}>
          <Link to="/score-summary">← イベント選択に戻る</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "2em" }}>
      <h2>{event?.name} - 集計結果</h2>

      <div style={{ margin: "1em 0" }}>
        <label>
          表示対象:
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

      {calculating && <p>ランキングを計算中...</p>}

      {categories.length === 0 ? (
        <p>カテゴリが登録されていません。</p>
      ) : (
        categories.map((category) => {
          const rows = rankings[category.id] || [];

          return (
            <section key={category.id} style={{ marginBottom: "2em" }}>
              <h3>カテゴリ: {category.name}</h3>
              {rows.length === 0 ? (
                <p>参加者データがありません。</p>
              ) : (
                <table style={{ borderCollapse: "collapse", width: "100%" }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>順位</th>
                      <th style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>名前</th>
                      <th style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>会員番号</th>
                      <th style={{ textAlign: "right", borderBottom: "1px solid #ccc" }}>得点</th>
                      <th style={{ textAlign: "right", borderBottom: "1px solid #ccc" }}>完登数</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.participantId}>
                        <td style={{ padding: "0.4em 0" }}>{row.rank}</td>
                        <td>{row.name}</td>
                        <td>{row.memberNo}</td>
                        <td style={{ textAlign: "right" }}>{row.totalPoints}</td>
                        <td style={{ textAlign: "right" }}>{row.clearCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          );
        })
      )}

      <div style={{ marginTop: "2em" }}>
        <Link to="/score-summary">← イベント選択に戻る</Link>
      </div>
    </div>
  );
};

export default EventSummary;

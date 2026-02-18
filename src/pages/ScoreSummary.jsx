// src/pages/ScoreSummary.jsx
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";

const toDateText = (value) => {
  if (!value) return "-";
  if (typeof value.toDate === "function") return value.toDate().toLocaleDateString();
  if (typeof value.seconds === "number") return new Date(value.seconds * 1000).toLocaleDateString();
  return String(value);
};

const ScoreSummary = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const snapshot = await getDocs(collection(db, "events"));
        const data = snapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .sort((a, b) => {
            const aMs = a.endDate?.seconds ? a.endDate.seconds * 1000 : 0;
            const bMs = b.endDate?.seconds ? b.endDate.seconds * 1000 : 0;
            return bMs - aMs;
          });
        setEvents(data);
      } catch (err) {
        console.error("イベントの取得に失敗:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  if (loading) {
    return <p>イベントを読み込んでいます...</p>;
  }

  return (
    <div style={{ padding: "2em", maxWidth: "980px", margin: "0 auto" }}>
      <h2>🏆 クライマー向け結果ページ</h2>
      <p style={{ marginBottom: "0.4em" }}>確認したいイベントを選んでください。</p>
      <ol style={{ marginTop: 0, paddingLeft: "1.2em" }}>
        <li>イベントを選ぶ</li>
        <li>ランキングから自分を検索する</li>
        <li>「詳細を見る」でシーズン別の完登内訳を確認する</li>
      </ol>

      {events.length === 0 ? (
        <p>イベントがありません。</p>
      ) : (
        <div style={{ display: "grid", gap: "1em" }}>
          {events.map((event) => (
            <section
              key={event.id}
              style={{ border: "1px solid #ddd", borderRadius: "10px", padding: "1em" }}
            >
              <h3 style={{ marginTop: 0, marginBottom: "0.5em" }}>{event.name}</h3>
              <p style={{ marginTop: 0 }}>
                開催期間: {toDateText(event.startDate)} 〜 {toDateText(event.endDate)}
              </p>
              <Link to={`/score-summary/${event.id}`}>このイベントのランキングを見る</Link>
            </section>
          ))}
        </div>
      )}
      <div style={{ marginTop: "2em" }}>
        <Link to="/">← Homeに戻る</Link>
      </div>
    </div>
  );
};

export default ScoreSummary;

// src/pages/ScoreEventSelector.jsx
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";

const ScoreEventSelector = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const snapshot = await getDocs(collection(db, "events"));
        const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
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
    <div style={{ padding: "2em" }}>
      <h2>📋 スコア採点するイベントを選択</h2>
      {events.length === 0 ? (
        <p>採点可能なイベントがありません。</p>
      ) : (
        <ul>
          {events.map((event) => (
            <li key={event.id}>
              <Link to={`/events/${event.id}/edit`} state={{ tab: "scores" }}>
                {event.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div style={{ marginTop: "2em" }}>
        <Link to="/dashboard">← ダッシュボードに戻る</Link>
      </div>
    </div>
  );
};

export default ScoreEventSelector;

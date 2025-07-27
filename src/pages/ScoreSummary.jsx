// src/pages/ScoreSummary.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';

const ScoreSummary = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const eventsCollection = collection(db, 'events');
        const eventSnapshot = await getDocs(eventsCollection);
        const eventsList = eventSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setEvents(eventsList);
      } catch (err) {
        console.error("イベントの取得に失敗しました:", err);
        setError("イベントの読み込み中にエラーが発生しました。");
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  if (loading) {
    return <p>イベントを読み込んでいます...</p>;
  }

  if (error) {
    return <p>{error}</p>;
  }

  return (
    <div style={{ padding: '2em' }}>
      <h2>📊 イベント別集計</h2>
      <p>集計を見たいイベントを選択してください。</p>
      
      {events.length > 0 ? (
        <ul>
          {events.map(event => (
            <li key={event.id}>
              {/* TODO: このリンク先は次のステップで作成します */}
              <Link to={`/score-summary/${event.id}`}>
                {event.name || '名称未設定のイベント'}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p>表示できるイベントがありません。</p>
      )}

      <div style={{ marginTop: '2em' }}>
        <Link to="/">← Homeに戻る</Link>
      </div>
    </div>
  );
};

export default ScoreSummary;
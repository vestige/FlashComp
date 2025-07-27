// src/pages/EventSummary.jsx
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';

const EventSummary = () => {
  const { eventId } = useParams();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const eventDocRef = doc(db, 'events', eventId);
        const eventDocSnap = await getDoc(eventDocRef);

        if (eventDocSnap.exists()) {
          setEvent({ id: eventDocSnap.id, ...eventDocSnap.data() });
        } else {
          setError("指定されたイベントが見つかりません。");
        }
      } catch (err) {
        console.error("イベント情報の取得に失敗しました:", err);
        setError("イベント情報の読み込み中にエラーが発生しました。");
      } finally {
        setLoading(false);
      }
    };

    fetchEvent();
  }, [eventId]);

  if (loading) {
    return <p>イベント情報を読み込んでいます...</p>;
  }

  if (error) {
    return <p>{error}</p>;
  }

  return (
    <div style={{ padding: '2em' }}>
      <h2>{event?.name} - 集計結果</h2>
      
      {/* TODO: ここにタブ（総合/シーズン別）や検索機能、ランキング表示を実装します */}
      <p>ここに詳細な集計結果が表示されます。</p>

      <div style={{ marginTop: '2em' }}>
        <Link to="/score-summary">← イベント選択に戻る</Link>
      </div>
    </div>
  );
};

export default EventSummary;

// src/pages/ScoreEventSelector.jsx
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { usePageTitle } from "../hooks/usePageTitle";

const ScoreEventSelector = () => {
  usePageTitle("スコア採点イベント選択");

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
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <p className="text-sm text-slate-600">イベントを読み込んでいます...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#dbeafe_0%,_#f8fafc_45%,_#ecfeff_100%)]">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold text-slate-900">📋 スコア採点するイベントを選択</h2>
          {events.length === 0 ? (
            <p className="mt-4 text-sm text-slate-600">採点可能なイベントがありません。</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {events.map((event) => (
                <li key={event.id}>
                  <Link
                    to={`/events/${event.id}/scores`}
                    className="inline-flex items-center rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                  >
                    {event.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-6">
            <Link
              to="/dashboard"
              className="inline-flex items-center rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              ← ダッシュボードに戻る
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
};

export default ScoreEventSelector;

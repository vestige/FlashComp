import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import ScoreManager from "../components/ScoreManager";
import { useOwnerProfile } from "../hooks/useOwnerProfile";
import { usePageTitle } from "../hooks/usePageTitle";

const EventScores = () => {
  const { eventId } = useParams();
  const [eventName, setEventName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [accessDenied, setAccessDenied] = useState(false);
  const {
    gymIds,
    hasAllGymAccess,
    loading: profileLoading,
    error: profileError,
  } = useOwnerProfile();
  usePageTitle(eventName ? `スコア: ${eventName}` : "スコア");

  const quickLinkClass = (active) =>
    `inline-flex items-center rounded-lg border px-3 py-2 text-sm font-medium transition ${
      active
        ? "border-sky-300 bg-sky-50 text-sky-800"
        : "border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100"
    }`;

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
      } catch (err) {
        console.error("スコア画面データの取得に失敗:", err);
        setError("スコア画面データの取得に失敗しました。");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [eventId, gymIds, hasAllGymAccess, profileLoading, profileError]);

  if (loading || profileLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <p className="text-sm text-slate-600">スコア画面を読み込んでいます...</p>
      </div>
    );
  }

  if (error || profileError) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error || profileError}
        </p>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          このイベントを編集する権限がありません。
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#dbeafe_0%,_#f8fafc_45%,_#ecfeff_100%)]">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-sky-700">Score Management</p>
            <h2 className="text-2xl font-bold text-slate-900">📋 スコア：{eventName}</h2>
          </div>
          <Link
            to="/dashboard"
            className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            ↩ ダッシュボードへ戻る
          </Link>
        </div>

        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap gap-2">
            <Link to={`/events/${eventId}/edit`} className={quickLinkClass(false)}>
              🛠 イベント設定
            </Link>
            <Link to={`/events/${eventId}/climbers`} className={quickLinkClass(false)}>
              👤 クライマー管理
            </Link>
            <Link to={`/events/${eventId}/scores`} className={quickLinkClass(true)}>
              📋 スコア管理
            </Link>
            <Link to={`/events/${eventId}/data-io`} className={quickLinkClass(false)}>
              ⇅ CSV入出力
            </Link>
          </div>
        </section>

        <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm sm:p-2">
          <ScoreManager eventId={eventId} />
        </section>
      </div>
    </div>
  );
};

export default EventScores;

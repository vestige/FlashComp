import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import ScoreManager from "../components/ScoreManager";
import { useOwnerProfile } from "../hooks/useOwnerProfile";
import { usePageTitle } from "../hooks/usePageTitle";
import { downloadCsv } from "../lib/csvUtils";
import { calculateRankingRows } from "../lib/rankingCsv";

const EventScores = () => {
  const { eventId } = useParams();
  const [eventName, setEventName] = useState("");
  const [seasons, setSeasons] = useState([]);
  const [categories, setCategories] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState("all");
  const [exportStatus, setExportStatus] = useState("");
  const [exportingRank, setExportingRank] = useState(false);
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

        const [seasonSnap, categorySnap, participantSnap] = await Promise.all([
          getDocs(collection(db, "events", eventId, "seasons")),
          getDocs(collection(db, "events", eventId, "categories")),
          getDocs(collection(db, "events", eventId, "participants")),
        ]);
        const seasonRows = seasonSnap.docs
          .map((seasonDoc) => ({ id: seasonDoc.id, ...seasonDoc.data() }))
          .sort((a, b) => (a.name || "").localeCompare(b.name || "", "ja"));
        setSeasons(seasonRows);
        setCategories(
          categorySnap.docs
            .map((categoryDoc) => ({ id: categoryDoc.id, ...categoryDoc.data() }))
            .sort((a, b) => (a.name || "").localeCompare(b.name || "", "ja"))
        );
        setParticipants(
          participantSnap.docs
            .map((participantDoc) => ({ id: participantDoc.id, ...participantDoc.data() }))
            .sort((a, b) => (a.name || "").localeCompare(b.name || "", "ja"))
        );
      } catch (err) {
        console.error("スコア画面データの取得に失敗:", err);
        setError("スコア画面データの取得に失敗しました。");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [eventId, gymIds, hasAllGymAccess, profileLoading, profileError]);

  useEffect(() => {
    if (selectedSeasonId === "all") return;
    const exists = seasons.some((season) => season.id === selectedSeasonId);
    if (!exists) setSelectedSeasonId("all");
  }, [selectedSeasonId, seasons]);

  const exportRankingCsv = async () => {
    setExportStatus("");
    setExportingRank(true);
    try {
      const rows = await calculateRankingRows({
        db,
        eventId,
        seasons,
        categories,
        participants,
        selectedSeasonId,
      });
      const headers = [
        "seasonScope",
        "categoryId",
        "categoryName",
        "rank",
        "participantId",
        "participantName",
        "memberNo",
        "totalPoints",
        "clearCount",
      ];
      downloadCsv(`${eventId}-ranking.csv`, headers, rows);
      setExportStatus(`✅ 順位CSVを出力しました（${rows.length}件）。`);
    } catch (err) {
      console.error("順位CSV出力に失敗:", err);
      setExportStatus("❌ 順位CSV出力に失敗しました。");
    } finally {
      setExportingRank(false);
    }
  };

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
          </div>
        </section>

        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-base font-bold text-slate-900">スコアCSV</h3>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label className="text-sm text-slate-700">
              順位の対象:
              <select
                value={selectedSeasonId}
                onChange={(e) => setSelectedSeasonId(e.target.value)}
                className="ml-2 rounded-lg border border-slate-300 px-2 py-1 text-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              >
                <option value="all">総合（全シーズン）</option>
                {seasons.map((season) => (
                  <option key={season.id} value={season.id}>
                    {season.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={exportRankingCsv}
              disabled={exportingRank || seasons.length === 0 || categories.length === 0}
              className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {exportingRank ? "順位を計算中..." : "順位CSVを出力"}
            </button>
          </div>
          {exportStatus && <p className="mt-3 text-sm text-slate-600">{exportStatus}</p>}
        </section>

        <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm sm:p-2">
          <ScoreManager eventId={eventId} />
        </section>
      </div>
    </div>
  );
};

export default EventScores;

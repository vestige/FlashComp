import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import ScoreManager from "../components/ScoreManager";
import ManagementHero from "../components/ManagementHero";
import { useOwnerProfile } from "../hooks/useOwnerProfile";
import { usePageTitle } from "../hooks/usePageTitle";
import { downloadCsv } from "../lib/csvUtils";
import { calculateRankingRows } from "../lib/rankingCsv";
import {
  inputFieldClass,
  pageBackgroundClass,
  pageContainerClass,
  sectionCardClass,
  sectionCardDenseClass,
  sectionHeadingClass,
  subtleButtonClass,
} from "../components/uiStyles";

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

  const Icon = ({ children, className = "h-4 w-4" }) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );

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
      <div className={pageBackgroundClass}>
        <div className={pageContainerClass}>
          <p className="text-sm text-slate-600">スコア画面を読み込んでいます...</p>
        </div>
      </div>
    );
  }

  if (error || profileError) {
    return (
      <div className={pageBackgroundClass}>
        <div className={pageContainerClass}>
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error || profileError}
          </p>
        </div>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className={pageBackgroundClass}>
        <div className={pageContainerClass}>
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            このイベントを編集する権限がありません。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={pageBackgroundClass}>
      <div className={pageContainerClass}>
        <ManagementHero
          eyebrow="Score Management"
          title={`スコア管理：${eventName}`}
          description="シーズン別/総合のスコア入力と順位CSV出力を行います。"
          backTo="/dashboard"
          backLabel="↩ ダッシュボードへ戻る"
        />

        <section className={`mt-4 ${sectionCardClass}`}>
          <h2 className={sectionHeadingClass}>
            <Icon className="h-5 w-5 text-sky-600">
              <path d="M4 19h16" />
              <path d="M8 14h8" />
              <path d="M8 10h8" />
              <path d="M8 6h8" />
            </Icon>
            スコアCSV
          </h2>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label className="text-sm text-slate-700">
              順位の対象:
              <select
                value={selectedSeasonId}
                onChange={(e) => setSelectedSeasonId(e.target.value)}
                className={`ml-2 ${inputFieldClass}`}
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
              className={`${subtleButtonClass} disabled:cursor-not-allowed disabled:opacity-60`}
            >
              {exportingRank ? "順位を計算中..." : "順位CSVを出力"}
            </button>
          </div>
          {exportStatus && <p className="mt-3 text-sm text-slate-600">{exportStatus}</p>}
        </section>

        <section className={`mt-5 ${sectionCardDenseClass} sm:p-2`}>
          <ScoreManager eventId={eventId} />
        </section>
      </div>
    </div>
  );
};

export default EventScores;

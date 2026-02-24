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
    return <p style={{ padding: "2em" }}>スコア画面を読み込んでいます...</p>;
  }

  if (error || profileError) {
    return (
      <div style={{ padding: "2em" }}>
        <p>{error || profileError}</p>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div style={{ padding: "2em" }}>
        <p>このイベントを編集する権限がありません。</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "1.2em", maxWidth: "980px", margin: "0 auto" }}>
      <h2>📋 スコア：{eventName}</h2>
      <div style={{ marginBottom: "0.8em" }}>
        <Link
          to="/dashboard"
          style={{
            border: "1px solid #bbb",
            borderRadius: "8px",
            padding: "0.45em 0.7em",
            textDecoration: "none",
            color: "inherit",
            display: "inline-block",
          }}
        >
          ↩ 戻る
        </Link>
      </div>
      <ScoreManager eventId={eventId} />
    </div>
  );
};

export default EventScores;

// src/pages/EditEvent.jsx
import { useParams, Link, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { db } from "../firebase";
import {
  collection,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";

import SeasonManager from "../components/SeasonManager";
import CategoryManager from "../components/CategoryManager";
import ParticipantManager from "../components/ParticipantManager";
import RouteSelector from "../components/RouteSelector";
import ScoreManager from "../components/ScoreManager";
import { usePageTitle } from "../hooks/usePageTitle";
import { useOwnerProfile } from "../hooks/useOwnerProfile";

const EditEvent = () => {
  const { eventId } = useParams();
  const [eventName, setEventName] = useState("");
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(location.state?.tab || "seasons");

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [accessDenied, setAccessDenied] = useState(false);
  const { gymIds, loading: profileLoading, error: profileError } = useOwnerProfile();
  usePageTitle(eventName ? `イベント編集: ${eventName}` : "イベント編集");

  useEffect(() => {
    if (profileLoading) return;
    if (profileError) {
      setError(profileError);
      setLoading(false);
      return;
    }

    const fetchEventData = async () => {
      setLoading(true);
      setError("");
      setAccessDenied(false);
      try {
        const eventDocRef = doc(db, "events", eventId);
        const eventDocSnap = await getDoc(eventDocRef);
        if (!eventDocSnap.exists()) {
          setError("イベントが見つかりません。");
          return;
        }

        const eventData = eventDocSnap.data();
        setEventName(eventData.name || "");
        if (!gymIds.includes(eventData.gymId)) {
          setAccessDenied(true);
          return;
        }

        const snapshot = await getDocs(collection(db, "events", eventId, "categories"));
        const data = snapshot.docs.map((categoryDoc) => ({
          id: categoryDoc.id,
          ...categoryDoc.data(),
        }));
        setCategories(data);
      } catch (err) {
        console.error("イベント編集データの取得に失敗:", err);
        setError("イベント編集データの取得に失敗しました。");
      } finally {
        setLoading(false);
      }
    };

    fetchEventData();
  }, [eventId, gymIds, profileLoading, profileError]);

  if (loading || profileLoading) {
    return <p style={{ padding: "2em" }}>イベント編集データを読み込んでいます...</p>;
  }

  if (error || profileError) {
    return (
      <div style={{ padding: "2em" }}>
        <p>{error || profileError}</p>
        <Link to="/dashboard">← ダッシュボードに戻る</Link>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div style={{ padding: "2em" }}>
        <p>このイベントを編集する権限がありません。</p>
        <Link to="/dashboard">← ダッシュボードに戻る</Link>
      </div>
    );
  }

  return (
    <div style={{ padding: "2em" }}>
      <h2>🛠 イベント編集：{eventName}</h2>
      <Link to="/dashboard">← ダッシュボードに戻る</Link> |{" "}

      <div style={{ marginTop: "1em" }}>
        <button onClick={() => setActiveTab("seasons")}>📅 シーズン</button>
        <button onClick={() => setActiveTab("categories")}>🏷 カテゴリ</button>
        <button onClick={() => setActiveTab("routes")}>🧩 ルート設定</button>
        <button onClick={() => setActiveTab("participants")}>👤 参加者</button>
				<button onClick={() => setActiveTab("scores")}>📋 スコア採点</button>
      </div>

      {activeTab === "seasons" && <SeasonManager eventId={eventId} />}
      {activeTab === "categories" && (
        <CategoryManager
          eventId={eventId}
          categories={categories}
          setCategories={setCategories}
        />
      )}
      {activeTab === "routes" && (
        <RouteSelector
          eventId={eventId}
          categories={categories}
        />
      )}
      {activeTab === "participants" && (
        <ParticipantManager
          eventId={eventId}
          categories={categories}
        />
      )}
			{activeTab === "scores" && <ScoreManager eventId={eventId} />}
    </div>
  );
};

export default EditEvent;

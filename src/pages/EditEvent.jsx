// src/pages/EditEvent.jsx
import { useParams, Link, useLocation, useSearchParams } from "react-router-dom";
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

const TAB_CONFIG = [
  { id: "seasons", label: "📅 シーズン", hint: "開催期間の分割を設定" },
  { id: "categories", label: "🏷 カテゴリ", hint: "参加カテゴリを設定" },
  { id: "routes", label: "🧩 ルート設定", hint: "カテゴリ別の課題を設定" },
  { id: "participants", label: "👤 参加者", hint: "参加者情報を登録" },
  { id: "scores", label: "📋 スコア採点", hint: "完登課題を入力" },
];

const normalizeTab = (value) => {
  if (!value) return "seasons";
  return TAB_CONFIG.some((tab) => tab.id === value) ? value : "seasons";
};

const EditEvent = () => {
  const { eventId } = useParams();
  const [eventName, setEventName] = useState("");
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(
    normalizeTab(searchParams.get("tab") || location.state?.tab || "seasons")
  );

  const [categories, setCategories] = useState([]);
  const [seasonCount, setSeasonCount] = useState(0);
  const [participantCount, setParticipantCount] = useState(0);
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

        const [categorySnap, seasonSnap, participantSnap] = await Promise.all([
          getDocs(collection(db, "events", eventId, "categories")),
          getDocs(collection(db, "events", eventId, "seasons")),
          getDocs(collection(db, "events", eventId, "participants")),
        ]);
        const categoryRows = categorySnap.docs.map((categoryDoc) => ({
          id: categoryDoc.id,
          ...categoryDoc.data(),
        }));
        setCategories(categoryRows);
        setSeasonCount(seasonSnap.size);
        setParticipantCount(participantSnap.size);
      } catch (err) {
        console.error("イベント編集データの取得に失敗:", err);
        setError("イベント編集データの取得に失敗しました。");
      } finally {
        setLoading(false);
      }
    };

    fetchEventData();
  }, [eventId, gymIds, profileLoading, profileError]);

  useEffect(() => {
    const tabParam = normalizeTab(searchParams.get("tab"));
    if (tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (next.get("tab") !== activeTab) {
      next.set("tab", activeTab);
      setSearchParams(next, { replace: true });
    }
  }, [activeTab, searchParams, setSearchParams]);

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

  const activeTabConfig = TAB_CONFIG.find((tab) => tab.id === activeTab);
  const summaryItems = [
    { label: "シーズン", value: seasonCount },
    { label: "カテゴリ", value: categories.length },
    { label: "参加者", value: participantCount },
  ];

  return (
    <div style={{ padding: "1.2em", maxWidth: "980px", margin: "0 auto" }}>
      <h2>🛠 イベント編集：{eventName}</h2>
      <div>
        <Link to="/dashboard">← ダッシュボードに戻る</Link>
      </div>

      <section
        style={{
          marginTop: "1em",
          border: "1px solid #ddd",
          borderRadius: "10px",
          padding: "0.8em",
        }}
      >
        <p style={{ marginTop: 0, marginBottom: "0.6em" }}>
          現在の登録状況を見ながら、上から順に設定するとスムーズです。
        </p>
        <div style={{ display: "flex", gap: "0.6em", flexWrap: "wrap" }}>
          {summaryItems.map((item) => (
            <span
              key={item.label}
              style={{
                border: "1px solid #ccc",
                borderRadius: "999px",
                padding: "0.2em 0.7em",
              }}
            >
              {item.label}: {item.value}
            </span>
          ))}
        </div>
      </section>

      <div style={{ marginTop: "1em", display: "flex", gap: "0.5em", flexWrap: "wrap" }}>
        {TAB_CONFIG.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            style={{
              border: "1px solid #bbb",
              borderRadius: "8px",
              padding: "0.45em 0.7em",
              background: activeTab === tab.id ? "#f0f0f0" : "#fff",
              fontWeight: activeTab === tab.id ? "bold" : "normal",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <p style={{ marginTop: "0.7em", marginBottom: "0.4em", color: "#444" }}>
        {activeTabConfig?.hint}
      </p>

      {activeTab === "seasons" && <SeasonManager eventId={eventId} />}
      {activeTab === "categories" && (
        <CategoryManager
          eventId={eventId}
          categories={categories}
          setCategories={setCategories}
        />
      )}
      {activeTab === "routes" && (
        categories.length === 0 ? (
          <p>先にカテゴリを登録してください。</p>
        ) : (
          <RouteSelector
            eventId={eventId}
            categories={categories}
          />
        )
      )}
      {activeTab === "participants" && (
        <ParticipantManager
          eventId={eventId}
          categories={categories}
        />
      )}
      {activeTab === "scores" && (
        categories.length === 0 ? <p>先にカテゴリを登録してください。</p> : <ScoreManager eventId={eventId} />
      )}
    </div>
  );
};

export default EditEvent;

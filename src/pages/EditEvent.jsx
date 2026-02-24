// src/pages/EditEvent.jsx
import { Link, useParams, useLocation, useSearchParams } from "react-router-dom";
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
import RouteSelector from "../components/RouteSelector";
import { usePageTitle } from "../hooks/usePageTitle";
import { useOwnerProfile } from "../hooks/useOwnerProfile";

const TAB_CONFIG = [
  { id: "seasons", label: "📅 シーズン", hint: "開催期間の分割を設定" },
  { id: "categories", label: "🏷 カテゴリ", hint: "参加カテゴリを設定" },
  { id: "tasks", label: "🧩 課題設定", hint: "シーズン課題とカテゴリ採用を設定" },
];

const normalizeTab = (value) => {
  if (!value) return "seasons";
  if (value === "routes" || value === "participants" || value === "scores") return "seasons";
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
  const {
    gymIds,
    hasAllGymAccess,
    loading: profileLoading,
    error: profileError,
  } = useOwnerProfile();
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
        if (!hasAllGymAccess && !gymIds.includes(eventData.gymId)) {
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
  }, [eventId, gymIds, hasAllGymAccess, profileLoading, profileError]);

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

  const activeTabConfig = TAB_CONFIG.find((tab) => tab.id === activeTab);
  const summaryItems = [
    { label: "シーズン", value: seasonCount },
    { label: "カテゴリ", value: categories.length },
    { label: "クライマー", value: participantCount },
  ];

  return (
    <div style={{ padding: "1.2em", maxWidth: "980px", margin: "0 auto" }}>
      <h2>🛠 イベント設定：{eventName}</h2>

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

      <div style={{ marginTop: "1em", display: "flex", gap: "0.5em", flexWrap: "wrap", alignItems: "center" }}>
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
        <Link
          to="/dashboard"
          style={{
            border: "1px solid #bbb",
            borderRadius: "8px",
            padding: "0.45em 0.7em",
            textDecoration: "none",
            color: "inherit",
          }}
        >
          ↩ 戻る
        </Link>
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
      {activeTab === "tasks" && (
        categories.length === 0 ? (
          <p>先にカテゴリを登録してください。</p>
        ) : (
          <RouteSelector
            eventId={eventId}
            categories={categories}
          />
        )
      )}
    </div>
  );
};

export default EditEvent;

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

const EditEvent = () => {
  const { eventId } = useParams();
  const [eventName, setEventName] = useState("");
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(location.state?.tab || "seasons");

  const [participants, setParticipants] = useState([]);
  const [participantName, setParticipantName] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const snapshot = await getDocs(collection(db, "events", eventId, "categories"));
        const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setCategories(data);
      } catch (err) {
        console.error("カテゴリの取得に失敗:", err);
      }
    };

    fetchCategories();
  }, [eventId]);

  useEffect(() => {
    const fetchEventName = async () => {
      const docRef = doc(db, "events", eventId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setEventName(docSnap.data().name);
      }
    };
    fetchEventName();
  }, [eventId]);

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
          participants={participants}
          setParticipants={setParticipants}
          participantName={participantName}
          setParticipantName={setParticipantName}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
          categories={categories}
        />
      )}
			{activeTab === "scores" && <ScoreManager eventId={eventId} />}
    </div>
  );
};

export default EditEvent;
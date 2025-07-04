// src/pages/EditEvent.jsx
import { useParams, Link, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { db } from "../firebase";
import {
  collection,
  addDoc,
  getDocs,
  Timestamp,
  deleteDoc,
  doc,
  getDoc
} from "firebase/firestore";
import SeasonManager from "../components/SeasonManager";
import CategoryManager from "../components/CategoryManager";
import ParticipantManager from "../components/ParticipantManager";

const EditEvent = () => {
  const { eventId } = useParams();
  const [eventName, setEventName] = useState("");
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(location.state?.tab || "seasons");

  const [participants, setParticipants] = useState([]);
  const [participantName, setParticipantName] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [categories, setCategories] = useState([]); // ← 追加！

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
        <button onClick={() => setActiveTab("participants")}>👤 参加者</button>
      </div>

      {activeTab === "seasons" && <SeasonManager eventId={eventId} />}
      {activeTab === "categories" && (
        <CategoryManager
          eventId={eventId}
          categories={categories}
          setCategories={setCategories}
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
    </div>
  );
};

export default EditEvent;
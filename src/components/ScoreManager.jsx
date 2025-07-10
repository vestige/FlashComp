// src/components/ScoreManager.jsx
import { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, getDocs } from "firebase/firestore";
//import { Link } from "react-router-dom";
import { Link, useParams, useNavigate, useLocation } from "react-router-dom";

const ScoreManager = ({ eventId }) => {
  const [seasons, setSeasons] = useState([]);
  const [categories, setCategories] = useState([]);
  const [participants, setParticipants] = useState([]);
  //const [selectedSeason, setSelectedSeason] = useState("");
  //const [selectedCategory, setSelectedCategory] = useState("");
  const location = useLocation();

  const [selectedSeason, setSelectedSeason] = useState(location.state?.seasonId || "");
  const [selectedCategory, setSelectedCategory] = useState(location.state?.categoryId || "");

  useEffect(() => {
    const fetchSeasons = async () => {
      try {
        const snapshot = await getDocs(collection(db, "events", eventId, "seasons"));
        const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setSeasons(data);
      } catch (err) {
        console.error("シーズンの取得に失敗:", err);
      }
    };

    const fetchCategories = async () => {
      try {
        const snapshot = await getDocs(collection(db, "events", eventId, "categories"));
        const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setCategories(data);
      } catch (err) {
        console.error("カテゴリの取得に失敗:", err);
      }
    };

    fetchSeasons();
    fetchCategories();
  }, [eventId]);

  useEffect(() => {
    const fetchParticipants = async () => {
      if (!selectedCategory) return;
      try {
        const snapshot = await getDocs(collection(db, "events", eventId, "participants"));
        const all = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        const filtered = all.filter((p) => p.categoryId === selectedCategory);
        setParticipants(filtered);
      } catch (err) {
        console.error("参加者の取得に失敗:", err);
      }
    };

    fetchParticipants();
  }, [eventId, selectedCategory]);

   useEffect(() => {
      if (location.state?.seasonId) {
         setSelectedSeason(location.state.seasonId);
      }
      if (location.state?.categoryId) {
         setSelectedCategory(location.state.categoryId);
      }
   }, [location.state]);

  return (
    <div style={{ padding: "2em" }}>
      <h2>📋 スコア採点</h2>

      <div style={{ marginBottom: "1em" }}>
        <label>
          シーズン選択:
          <select
            value={selectedSeason}
            onChange={(e) => setSelectedSeason(e.target.value)}
          >
            <option value="">-- 選択してください --</option>
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div style={{ marginBottom: "1em" }}>
        <label>
          カテゴリ選択:
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="">-- 選択してください --</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {selectedSeason && selectedCategory && (
        <ul>
          {participants.map((p) => (
            <li key={p.id}>
              {p.name}
              <Link
                to={`/events/${eventId}/scoreinput/${selectedSeason}/${selectedCategory}/${p.id}`}
                style={{ marginLeft: "1em" }}
              >
                📝 採点へ
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ScoreManager;
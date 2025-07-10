import { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { Link, useParams } from "react-router-dom";

const ScoreManager = ({ eventId }) => {
  const [seasons, setSeasons] = useState([]);
  const [categories, setCategories] = useState([]);
  const [participants, setParticipants] = useState([]);

  const [selectedSeason, setSelectedSeason] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");

  useEffect(() => {
    const fetchSeasons = async () => {
      const snapshot = await getDocs(collection(db, "events", eventId, "seasons"));
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setSeasons(data);
    };
    const fetchCategories = async () => {
      const snapshot = await getDocs(collection(db, "events", eventId, "categories"));
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setCategories(data);
    };
    fetchSeasons();
    fetchCategories();
  }, [eventId]);

  useEffect(() => {
    const fetchParticipants = async () => {
      if (!selectedCategory) return;
      const snapshot = await getDocs(collection(db, "events", eventId, "participants"));
      const all = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const filtered = all.filter((p) => p.categoryId === selectedCategory);
      setParticipants(filtered);
    };
    fetchParticipants();
  }, [eventId, selectedCategory]);

  return (
    <div style={{ padding: "1em" }}>
      <h3>📋 スコア採点</h3>

      <label>
        シーズン選択：
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

      <label style={{ marginLeft: "1em" }}>
        カテゴリ選択：
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

      {selectedSeason && selectedCategory && (
        <>
          <h4 style={{ marginTop: "1em" }}>参加者一覧</h4>
          <ul>
            {participants.length === 0 && <li>該当カテゴリの参加者がいません</li>}
            {participants.map((p) => (
              <li key={p.id}>
                {p.name}{" "}
                <Link
                  to={`/events/${eventId}/scoreinput/${selectedSeason}/${selectedCategory}/${p.id}`}
                >
                  🔍 採点
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
};

export default ScoreManager;
// src/components/SeasonManager.jsx
import { useState, useEffect } from "react";
import { db } from "../firebase";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  Timestamp,
} from "firebase/firestore";

const SeasonManager = ({ eventId }) => {
  const [seasonName, setSeasonName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState("");
  const [seasons, setSeasons] = useState([]);

  useEffect(() => {
    fetchSeasons();
  }, [eventId]);

  const fetchSeasons = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "events", eventId, "seasons"));
      const data = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setSeasons(data);
    } catch (err) {
      console.error("シーズンの取得に失敗:", err);
    }
  };

  const handleAddSeason = async (e) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, "events", eventId, "seasons"), {
        name: seasonName,
        startDate: Timestamp.fromDate(new Date(startDate)),
        endDate: Timestamp.fromDate(new Date(endDate)),
      });
      setStatus("✅ シーズンを追加しました！");
      setSeasonName("");
      setStartDate("");
      setEndDate("");
      fetchSeasons();
    } catch (err) {
      console.error(err);
      setStatus("❌ シーズンの追加に失敗しました");
    }
  };

  const handleDeleteSeason = async (seasonId) => {
    const confirmDelete = window.confirm("本当にこのシーズンを削除しますか？");
    if (!confirmDelete) return;
    try {
      await deleteDoc(doc(db, "events", eventId, "seasons", seasonId));
      setSeasons((prev) => prev.filter((s) => s.id !== seasonId));
    } catch (err) {
      console.error("削除に失敗:", err);
    }
  };

  return (
    <div>
      <h3>📅 シーズン追加</h3>
      <form onSubmit={handleAddSeason}>
        <input type="text" placeholder="シーズン名" value={seasonName} onChange={(e) => setSeasonName(e.target.value)} required />
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
        <button type="submit">追加</button>
      </form>
      <p>{status}</p>
      <ul>
        {seasons.map((season) => (
          <li key={season.id}>
            {season.name}（{season.startDate.toDate().toLocaleDateString()}〜{season.endDate.toDate().toLocaleDateString()}）
            <button onClick={() => handleDeleteSeason(season.id)}>削除</button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default SeasonManager;
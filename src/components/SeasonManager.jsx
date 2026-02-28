// src/components/SeasonManager.jsx
import { useState, useEffect, useCallback } from "react";
import { db } from "../firebase";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  doc,
  Timestamp,
} from "firebase/firestore";

const toInputDate = (value) => {
  if (!value) return "";
  const date = typeof value.toDate === "function" ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const SeasonManager = ({ eventId, showCreateForm = true, refreshToken = 0 }) => {
  const [seasonName, setSeasonName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState("");
  const [seasons, setSeasons] = useState([]);
  const [editingSeasonId, setEditingSeasonId] = useState("");
  const [editForm, setEditForm] = useState({ name: "", startDate: "", endDate: "" });

  const fetchSeasons = useCallback(async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "events", eventId, "seasons"));
      const data = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setSeasons(data);
    } catch (err) {
      console.error("シーズンの取得に失敗:", err);
    }
  }, [eventId]);

  useEffect(() => {
    fetchSeasons();
  }, [fetchSeasons, refreshToken]);

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

  const handleStartEdit = (season) => {
    setEditingSeasonId(season.id);
    setEditForm({
      name: season.name || "",
      startDate: toInputDate(season.startDate),
      endDate: toInputDate(season.endDate),
    });
  };

  const handleCancelEdit = () => {
    setEditingSeasonId("");
    setEditForm({ name: "", startDate: "", endDate: "" });
  };

  const handleSaveEdit = async (seasonId) => {
    if (!editForm.name.trim() || !editForm.startDate || !editForm.endDate) {
      alert("シーズン名・開始日・終了日を入力してください。");
      return;
    }

    try {
      const payload = {
        name: editForm.name.trim(),
        startDate: Timestamp.fromDate(new Date(editForm.startDate)),
        endDate: Timestamp.fromDate(new Date(editForm.endDate)),
      };

      await updateDoc(doc(db, "events", eventId, "seasons", seasonId), payload);
      setSeasons((prev) =>
        prev.map((season) => (season.id === seasonId ? { ...season, ...payload } : season))
      );
      handleCancelEdit();
    } catch (err) {
      console.error("シーズン更新に失敗:", err);
      alert("シーズンの更新に失敗しました。");
    }
  };

  return (
    <div>
      <h3>{showCreateForm ? "📅 シーズン追加" : "📅 シーズン一覧"}</h3>
      {showCreateForm && (
        <>
          <form onSubmit={handleAddSeason}>
            <input type="text" placeholder="シーズン名" value={seasonName} onChange={(e) => setSeasonName(e.target.value)} required />
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
            <button type="submit">追加</button>
          </form>
          <p>{status}</p>
        </>
      )}
      <ul>
        {seasons.map((season) => (
          <li key={season.id}>
            {editingSeasonId === season.id ? (
              <>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                />
                <input
                  type="date"
                  value={editForm.startDate}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, startDate: e.target.value }))
                  }
                />
                <input
                  type="date"
                  value={editForm.endDate}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, endDate: e.target.value }))}
                />
                <button type="button" onClick={() => handleSaveEdit(season.id)}>保存</button>
                <button type="button" onClick={handleCancelEdit}>キャンセル</button>
              </>
            ) : (
              <>
                {season.name}
                （{season.startDate.toDate().toLocaleDateString()}〜
                {season.endDate.toDate().toLocaleDateString()}）
                <button type="button" onClick={() => handleStartEdit(season)}>編集</button>
                <button type="button" onClick={() => handleDeleteSeason(season.id)}>削除</button>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default SeasonManager;

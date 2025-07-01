// src/components/ParticipantManager.jsx
import { useState, useEffect } from "react";
import { collection, addDoc, getDocs, deleteDoc, doc } from "firebase/firestore";
import { db } from "../firebase";

const ParticipantManager = ({ eventId, categories }) => {
  const [participants, setParticipants] = useState([]);
  const [participantName, setParticipantName] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");

  useEffect(() => {
    fetchParticipants();
  }, [eventId]);

  const fetchParticipants = async () => {
    try {
      const snapshot = await getDocs(collection(db, "events", eventId, "participants"));
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setParticipants(data);
    } catch (err) {
      console.error("参加者の取得に失敗:", err);
    }
  };

  const handleAddParticipant = async (e) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, "events", eventId, "participants"), {
        name: participantName,
        categoryId: selectedCategory,
        createdAt: new Date(),
      });
      setParticipantName("");
      setSelectedCategory("");
      fetchParticipants();
    } catch (err) {
      console.error("参加者の登録に失敗:", err);
    }
  };

  const handleDeleteParticipant = async (participantId) => {
    const confirmDelete = window.confirm("この参加者を削除してもよいですか？");
    if (!confirmDelete) return;
    try {
      await deleteDoc(doc(db, "events", eventId, "participants", participantId));
      setParticipants((prev) => prev.filter((p) => p.id !== participantId));
    } catch (err) {
      console.error("参加者の削除に失敗:", err);
    }
  };

  return (
    <div>
      <h3>👤 参加者登録</h3>
      <form onSubmit={handleAddParticipant}>
        <input
          type="text"
          placeholder="参加者名"
          value={participantName}
          onChange={(e) => setParticipantName(e.target.value)}
          required
        />
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          required
        >
          <option value="">-- カテゴリ選択 --</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
        <button type="submit">追加</button>
      </form>
      <ul>
        {participants.map((p) => {
          const catName = categories.find((c) => c.id === p.categoryId)?.name || "未設定";
          return (
            <li key={p.id}>
              {p.name}（カテゴリ: {catName}）
              <button onClick={() => handleDeleteParticipant(p.id)}>削除</button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default ParticipantManager;
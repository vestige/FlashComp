// src/components/ParticipantManager.jsx
import { useState, useEffect } from "react";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";

const ParticipantManager = ({ eventId, categories }) => {
  const [participants, setParticipants] = useState([]);
  const [form, setForm] = useState({
    name: "",
    memberNo: "",
    age: "",
    gender: "",
    grade: "",
    categoryId: "",
  });

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
        name: form.name.trim(),
        memberNo: form.memberNo.trim(),
        age: Number(form.age),
        gender: form.gender,
        grade: form.grade,
        categoryId: form.categoryId,
        createdAt: serverTimestamp(),
      });
      setForm({
        name: "",
        memberNo: "",
        age: "",
        gender: "",
        grade: "",
        categoryId: "",
      });
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
          value={form.name}
          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          required
        />
        <input
          type="text"
          placeholder="会員番号"
          value={form.memberNo}
          onChange={(e) => setForm((prev) => ({ ...prev, memberNo: e.target.value }))}
          required
        />
        <input
          type="number"
          min="1"
          max="120"
          placeholder="年齢"
          value={form.age}
          onChange={(e) => setForm((prev) => ({ ...prev, age: e.target.value }))}
          required
        />
        <select
          value={form.gender}
          onChange={(e) => setForm((prev) => ({ ...prev, gender: e.target.value }))}
          required
        >
          <option value="">-- 性別 --</option>
          <option value="male">男性</option>
          <option value="female">女性</option>
          <option value="other">その他</option>
        </select>
        <select
          value={form.grade}
          onChange={(e) => setForm((prev) => ({ ...prev, grade: e.target.value }))}
          required
        >
          <option value="">-- 参加グレード --</option>
          <option value="9級">9級</option>
          <option value="8級">8級</option>
          <option value="7級">7級</option>
          <option value="6級">6級</option>
          <option value="5級">5級</option>
          <option value="4級">4級</option>
          <option value="3級">3級</option>
          <option value="2級">2級</option>
          <option value="1級">1級</option>
          <option value="初段">初段</option>
          <option value="2段">2段</option>
        </select>
        <select
          value={form.categoryId}
          onChange={(e) => setForm((prev) => ({ ...prev, categoryId: e.target.value }))}
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
          const genderLabel =
            p.gender === "male"
              ? "男性"
              : p.gender === "female"
              ? "女性"
              : p.gender === "other"
              ? "その他"
              : "未設定";
          return (
            <li key={p.id}>
              {p.name}
              {" / "}会員番号: {p.memberNo || "-"}
              {" / "}年齢: {p.age || "-"}
              {" / "}性別: {genderLabel}
              {" / "}参加グレード: {p.grade || "-"}
              {" / "}カテゴリ: {catName}
              <button onClick={() => handleDeleteParticipant(p.id)}>削除</button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default ParticipantManager;

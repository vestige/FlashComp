// src/components/ParticipantManager.jsx
import { useState, useEffect, useCallback } from "react";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";

const EMPTY_FORM = {
  name: "",
  memberNo: "",
  age: "",
  gender: "",
  categoryId: "",
};

const getGenderLabel = (gender) => {
  if (gender === "male") return "男性";
  if (gender === "female") return "女性";
  if (gender === "other") return "その他";
  return "未設定";
};

const ParticipantManager = ({ eventId, categories, refreshToken = 0 }) => {
  const [participants, setParticipants] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingParticipantId, setEditingParticipantId] = useState("");
  const [editForm, setEditForm] = useState(EMPTY_FORM);

  const fetchParticipants = useCallback(async () => {
    try {
      const snapshot = await getDocs(collection(db, "events", eventId, "participants"));
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setParticipants(data);
    } catch (err) {
      console.error("クライマーの取得に失敗:", err);
    }
  }, [eventId]);

  useEffect(() => {
    fetchParticipants();
  }, [fetchParticipants, refreshToken]);

  const handleAddParticipant = async (e) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, "events", eventId, "participants"), {
        name: form.name.trim(),
        memberNo: form.memberNo.trim(),
        age: Number(form.age),
        gender: form.gender,
        categoryId: form.categoryId,
        createdAt: serverTimestamp(),
      });
      setForm(EMPTY_FORM);
      fetchParticipants();
    } catch (err) {
      console.error("クライマーの登録に失敗:", err);
    }
  };

  const startEditParticipant = (participant) => {
    setEditingParticipantId(participant.id);
    setEditForm({
      name: participant.name || "",
      memberNo: participant.memberNo || "",
      age: participant.age ? String(participant.age) : "",
      gender: participant.gender || "",
      categoryId: participant.categoryId || "",
    });
  };

  const cancelEditParticipant = () => {
    setEditingParticipantId("");
    setEditForm(EMPTY_FORM);
  };

  const saveEditedParticipant = async (participantId) => {
    if (
      !editForm.name.trim() ||
      !editForm.memberNo.trim() ||
      !editForm.age ||
      !editForm.gender ||
      !editForm.categoryId
    ) {
      alert("必須項目をすべて入力してください。");
      return;
    }

    try {
      const payload = {
        name: editForm.name.trim(),
        memberNo: editForm.memberNo.trim(),
        age: Number(editForm.age),
        gender: editForm.gender,
        categoryId: editForm.categoryId,
        updatedAt: serverTimestamp(),
      };

      await updateDoc(doc(db, "events", eventId, "participants", participantId), payload);

      setParticipants((prev) =>
        prev.map((participant) =>
          participant.id === participantId
            ? { ...participant, ...payload, updatedAt: new Date() }
            : participant
        )
      );
      cancelEditParticipant();
    } catch (err) {
      console.error("クライマーの更新に失敗:", err);
      alert("クライマーの更新に失敗しました。");
    }
  };

  const handleDeleteParticipant = async (participantId) => {
    const confirmDelete = window.confirm("このクライマーを削除してもよいですか？");
    if (!confirmDelete) return;
    try {
      await deleteDoc(doc(db, "events", eventId, "participants", participantId));
      setParticipants((prev) => prev.filter((p) => p.id !== participantId));
    } catch (err) {
      console.error("クライマーの削除に失敗:", err);
    }
  };

  return (
    <div>
      <h3>👤 クライマー登録</h3>
      <form onSubmit={handleAddParticipant}>
        <input
          type="text"
          placeholder="クライマー名"
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
          const isEditing = editingParticipantId === p.id;
          return (
            <li key={p.id}>
              {isEditing ? (
                <>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                  />
                  <input
                    type="text"
                    value={editForm.memberNo}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, memberNo: e.target.value }))
                    }
                  />
                  <input
                    type="number"
                    min="1"
                    max="120"
                    value={editForm.age}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, age: e.target.value }))}
                  />
                  <select
                    value={editForm.gender}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, gender: e.target.value }))
                    }
                  >
                    <option value="">-- 性別 --</option>
                    <option value="male">男性</option>
                    <option value="female">女性</option>
                    <option value="other">その他</option>
                  </select>
                  <select
                    value={editForm.categoryId}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, categoryId: e.target.value }))
                    }
                  >
                    <option value="">-- カテゴリ選択 --</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                  <button type="button" onClick={() => saveEditedParticipant(p.id)}>
                    保存
                  </button>
                  <button type="button" onClick={cancelEditParticipant}>
                    キャンセル
                  </button>
                </>
              ) : (
                <>
                  {p.name}
                  {" / "}会員番号: {p.memberNo || "-"}
                  {" / "}年齢: {p.age || "-"}
                  {" / "}性別: {getGenderLabel(p.gender)}
                  {" / "}カテゴリ: {catName}
                  <button type="button" onClick={() => startEditParticipant(p)}>
                    編集
                  </button>
                  <button type="button" onClick={() => handleDeleteParticipant(p.id)}>
                    削除
                  </button>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default ParticipantManager;

// src/components/ParticipantManager.jsx
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import {
  cleanupParticipantScoresOutsideCategory,
  deleteParticipantCascade,
} from "../lib/eventDataCleanup";
import ConfirmDialog from "./ConfirmDialog";
import { inputFieldClass, sectionHeadingClass, subtleButtonClass } from "./uiStyles";

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
  const [keywordFilter, setKeywordFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [genderFilter, setGenderFilter] = useState("all");
  const [pendingDeleteParticipant, setPendingDeleteParticipant] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchParticipants = useCallback(async () => {
    try {
      const snapshot = await getDocs(collection(db, "events", eventId, "participants"));
      const data = snapshot.docs
        .map((entry) => ({ id: entry.id, ...entry.data() }))
        .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ja"));
      setParticipants(data);
    } catch (err) {
      console.error("クライマーの取得に失敗:", err);
    }
  }, [eventId]);

  useEffect(() => {
    fetchParticipants();
  }, [fetchParticipants, refreshToken]);

  const categoryById = useMemo(() => {
    return new Map(categories.map((category) => [category.id, category.name || category.id]));
  }, [categories]);

  const visibleParticipants = useMemo(() => {
    const normalized = keywordFilter.trim().toLowerCase();
    return participants.filter((participant) => {
      const hitKeyword = normalized
        ? String(participant.name || "").toLowerCase().includes(normalized)
          || String(participant.memberNo || "").toLowerCase().includes(normalized)
        : true;
      const hitCategory = categoryFilter === "all" || participant.categoryId === categoryFilter;
      const hitGender = genderFilter === "all" || participant.gender === genderFilter;
      return hitKeyword && hitCategory && hitGender;
    });
  }, [participants, keywordFilter, categoryFilter, genderFilter]);

  const handleAddParticipant = async (event) => {
    event.preventDefault();
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
      !editForm.name.trim()
      || !editForm.memberNo.trim()
      || !editForm.age
      || !editForm.gender
      || !editForm.categoryId
      || Number(editForm.age) <= 0
    ) {
      alert("必須項目をすべて入力してください。");
      return;
    }

    try {
      const before = participants.find((participant) => participant.id === participantId);
      const previousCategoryId = before?.categoryId || "";
      const payload = {
        name: editForm.name.trim(),
        memberNo: editForm.memberNo.trim(),
        age: Number(editForm.age),
        gender: editForm.gender,
        categoryId: editForm.categoryId,
        updatedAt: serverTimestamp(),
      };

      await updateDoc(doc(db, "events", eventId, "participants", participantId), payload);
      if (previousCategoryId && previousCategoryId !== payload.categoryId) {
        await cleanupParticipantScoresOutsideCategory({
          eventId,
          participantId,
          keepCategoryId: payload.categoryId,
        });
      }

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

  const handleDeleteParticipant = async () => {
    if (!pendingDeleteParticipant) return;
    const participantId = pendingDeleteParticipant.id;
    setIsDeleting(true);
    try {
      await deleteParticipantCascade({ eventId, participantId });
      setParticipants((prev) => prev.filter((participant) => participant.id !== participantId));
      setPendingDeleteParticipant(null);
    } catch (err) {
      console.error("クライマーの削除に失敗:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  const resetFilters = () => {
    setKeywordFilter("");
    setCategoryFilter("all");
    setGenderFilter("all");
  };

  return (
    <div>
      <h3 className={sectionHeadingClass}>👤 Registered Climbers</h3>

      <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <form onSubmit={handleAddParticipant} className="grid gap-3 md:grid-cols-[1.5fr_1fr_auto_auto_auto_auto] md:items-end">
          <input
            type="text"
            placeholder="クライマー名"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            required
            className={inputFieldClass}
          />
          <input
            type="text"
            placeholder="会員番号"
            value={form.memberNo}
            onChange={(e) => setForm((prev) => ({ ...prev, memberNo: e.target.value }))}
            required
            className={inputFieldClass}
          />
          <input
            type="number"
            min="1"
            max="120"
            placeholder="年齢"
            value={form.age}
            onChange={(e) => setForm((prev) => ({ ...prev, age: e.target.value }))}
            required
            className={`${inputFieldClass} w-24`}
          />
          <select
            value={form.gender}
            onChange={(e) => setForm((prev) => ({ ...prev, gender: e.target.value }))}
            required
            className={inputFieldClass}
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
            className={inputFieldClass}
          >
            <option value="">-- カテゴリ選択 --</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded-lg border border-emerald-300 bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800">
            追加
          </button>
        </form>
      </div>

      <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={keywordFilter}
            onChange={(e) => setKeywordFilter(e.target.value)}
            placeholder="クライマー名 / 会員番号で検索"
            className={`min-w-[240px] flex-1 ${inputFieldClass}`}
          />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className={inputFieldClass}
          >
            <option value="all">カテゴリ: すべて</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <select
            value={genderFilter}
            onChange={(e) => setGenderFilter(e.target.value)}
            className={inputFieldClass}
          >
            <option value="all">性別: すべて</option>
            <option value="male">男性</option>
            <option value="female">女性</option>
            <option value="other">その他</option>
          </select>
          <button type="button" onClick={resetFilters} className={subtleButtonClass}>
            フィルターをリセット
          </button>
          <span className="text-sm text-slate-500">
            表示: {visibleParticipants.length} / 全{participants.length}
          </span>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border-b border-slate-200 py-2 text-left">名前</th>
                <th className="border-b border-slate-200 py-2 text-left">会員番号</th>
                <th className="border-b border-slate-200 py-2 text-left">年齢</th>
                <th className="border-b border-slate-200 py-2 text-left">性別</th>
                <th className="border-b border-slate-200 py-2 text-left">カテゴリ</th>
                <th className="border-b border-slate-200 py-2 text-left">操作</th>
              </tr>
            </thead>
            <tbody>
              {visibleParticipants.map((participant) => {
                const isEditing = editingParticipantId === participant.id;
                if (isEditing) {
                  return (
                    <tr key={participant.id}>
                      <td className="py-2">
                        <input
                          type="text"
                          value={editForm.name}
                          onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                          className={inputFieldClass}
                        />
                      </td>
                      <td className="py-2">
                        <input
                          type="text"
                          value={editForm.memberNo}
                          onChange={(e) => setEditForm((prev) => ({ ...prev, memberNo: e.target.value }))}
                          className={inputFieldClass}
                        />
                      </td>
                      <td className="py-2">
                        <input
                          type="number"
                          min="1"
                          max="120"
                          value={editForm.age}
                          onChange={(e) => setEditForm((prev) => ({ ...prev, age: e.target.value }))}
                          className={`${inputFieldClass} w-24`}
                        />
                      </td>
                      <td className="py-2">
                        <select
                          value={editForm.gender}
                          onChange={(e) => setEditForm((prev) => ({ ...prev, gender: e.target.value }))}
                          className={inputFieldClass}
                        >
                          <option value="">-- 性別 --</option>
                          <option value="male">男性</option>
                          <option value="female">女性</option>
                          <option value="other">その他</option>
                        </select>
                      </td>
                      <td className="py-2">
                        <select
                          value={editForm.categoryId}
                          onChange={(e) => setEditForm((prev) => ({ ...prev, categoryId: e.target.value }))}
                          className={inputFieldClass}
                        >
                          <option value="">-- カテゴリ選択 --</option>
                          {categories.map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => saveEditedParticipant(participant.id)}
                            className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                          >
                            保存
                          </button>
                          <button type="button" onClick={cancelEditParticipant} className={subtleButtonClass}>
                            キャンセル
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={participant.id}>
                    <td className="py-2 text-slate-900">{participant.name}</td>
                    <td className="py-2 text-slate-700">{participant.memberNo || "-"}</td>
                    <td className="py-2 text-slate-700">{participant.age || "-"}</td>
                    <td className="py-2 text-slate-700">{getGenderLabel(participant.gender)}</td>
                    <td className="py-2 text-slate-700">{categoryById.get(participant.categoryId) || "未設定"}</td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => startEditParticipant(participant)} className={subtleButtonClass}>
                          編集
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingDeleteParticipant(participant)}
                          className="inline-flex items-center rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-100"
                        >
                          削除
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {visibleParticipants.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-4 text-sm text-slate-500">
                    条件に一致するクライマーがいません。
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(pendingDeleteParticipant)}
        title="クライマーを削除しますか？"
        message={`「${pendingDeleteParticipant?.name || "このクライマー"}」を削除します。元に戻せません。`}
        confirmLabel="削除する"
        onConfirm={handleDeleteParticipant}
        onCancel={() => setPendingDeleteParticipant(null)}
        busy={isDeleting}
      />
    </div>
  );
};

export default ParticipantManager;

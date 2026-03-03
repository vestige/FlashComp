// src/components/CategoryManager.jsx
import { useState, useEffect, useCallback } from "react";
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  doc,
} from "firebase/firestore";
import { db } from "../firebase";
import { deleteCategoryCascade } from "../lib/eventDataCleanup";
import ConfirmDialog from "./ConfirmDialog";
import {
  inputFieldClass,
  primaryButtonClass,
  sectionCardClass,
  sectionHeadingClass,
  subtleButtonClass,
} from "./uiStyles";

const CategoryManager = ({
  eventId,
  categories,
  setCategories,
  showCreateForm = true,
  refreshToken = 0,
}) => {
  const [categoryName, setCategoryName] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState("");
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [pendingDeleteCategory, setPendingDeleteCategory] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchCategories = useCallback(async () => {
    try {
      const snapshot = await getDocs(collection(db, "events", eventId, "categories"));
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setCategories(data);
    } catch (err) {
      console.error("カテゴリの取得に失敗:", err);
    }
  }, [eventId, setCategories]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories, refreshToken]);

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!categoryName) return;
    try {
      await addDoc(collection(db, "events", eventId, "categories"), {
        name: categoryName,
      });
      setCategoryName("");
      fetchCategories();
    } catch (err) {
      console.error("カテゴリ追加に失敗:", err);
    }
  };

  const handleDeleteCategory = async () => {
    if (!pendingDeleteCategory) return;
    const categoryId = pendingDeleteCategory.id;
    setIsDeleting(true);
    try {
      await deleteCategoryCascade({ eventId, categoryId });
      setCategories((prev) => prev.filter((c) => c.id !== categoryId));
      setPendingDeleteCategory(null);
    } catch (err) {
      console.error("削除に失敗:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleStartEdit = (category) => {
    setEditingCategoryId(category.id);
    setEditingCategoryName(category.name || "");
  };

  const handleCancelEdit = () => {
    setEditingCategoryId("");
    setEditingCategoryName("");
  };

  const handleSaveEdit = async (categoryId) => {
    const trimmedName = editingCategoryName.trim();
    if (!trimmedName) {
      alert("カテゴリ名を入力してください。");
      return;
    }

    try {
      await updateDoc(doc(db, "events", eventId, "categories", categoryId), {
        name: trimmedName,
      });
      setCategories((prev) =>
        prev.map((category) =>
          category.id === categoryId ? { ...category, name: trimmedName } : category
        )
      );
      handleCancelEdit();
    } catch (err) {
      console.error("カテゴリ更新に失敗:", err);
      alert("カテゴリの更新に失敗しました。");
    }
  };

  return (
    <div className={`mt-4 ${sectionCardClass}`}>
      <h3 className={sectionHeadingClass}>{showCreateForm ? "🏷 カテゴリ追加" : "🏷 カテゴリ一覧"}</h3>
      {showCreateForm && (
        <form onSubmit={handleAddCategory} className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="text"
            placeholder="カテゴリ名"
            value={categoryName}
            onChange={(e) => setCategoryName(e.target.value)}
            required
            className={inputFieldClass}
          />
          <button type="submit" className={primaryButtonClass}>
            追加
          </button>
        </form>
      )}
      {categories.length === 0 ? (
        <p className="mt-3 text-sm text-slate-600">カテゴリはまだ登録されていません。</p>
      ) : (
        <ul className="mt-4 grid gap-3">
          {categories.map((c) => (
            <li key={c.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              {editingCategoryId === c.id ? (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={editingCategoryName}
                    onChange={(e) => setEditingCategoryName(e.target.value)}
                    className={inputFieldClass}
                  />
                  <button type="button" onClick={() => handleSaveEdit(c.id)} className={primaryButtonClass}>
                    保存
                  </button>
                  <button type="button" onClick={handleCancelEdit} className={subtleButtonClass}>
                    キャンセル
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">{c.name}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => handleStartEdit(c)} className={subtleButtonClass}>
                      編集
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDeleteCategory(c)}
                      className="inline-flex items-center rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-100"
                    >
                      削除
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={Boolean(pendingDeleteCategory)}
        title="カテゴリを削除しますか？"
        message={`「${pendingDeleteCategory?.name || "このカテゴリ"}」を削除します。元に戻せません。`}
        confirmLabel="削除する"
        onConfirm={handleDeleteCategory}
        onCancel={() => setPendingDeleteCategory(null)}
        busy={isDeleting}
      />
    </div>
  );
};

export default CategoryManager;

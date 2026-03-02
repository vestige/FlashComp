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

  const handleDeleteCategory = async (categoryId) => {
    const confirmDelete = window.confirm("このカテゴリを削除してもよいですか？");
    if (!confirmDelete) return;
    try {
      await deleteCategoryCascade({ eventId, categoryId });
      setCategories((prev) => prev.filter((c) => c.id !== categoryId));
    } catch (err) {
      console.error("削除に失敗:", err);
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
    <div>
      <h3>{showCreateForm ? "🏷 カテゴリ追加" : "🏷 カテゴリ一覧"}</h3>
      {showCreateForm && (
        <form onSubmit={handleAddCategory}>
          <input
            type="text"
            placeholder="カテゴリ名"
            value={categoryName}
            onChange={(e) => setCategoryName(e.target.value)}
            required
          />
          <button type="submit">追加</button>
        </form>
      )}
      <ul>
        {categories.map((c) => (
          <li key={c.id}>
            {editingCategoryId === c.id ? (
              <>
                <input
                  type="text"
                  value={editingCategoryName}
                  onChange={(e) => setEditingCategoryName(e.target.value)}
                />
                <button type="button" onClick={() => handleSaveEdit(c.id)}>保存</button>
                <button type="button" onClick={handleCancelEdit}>キャンセル</button>
              </>
            ) : (
              <>
                {c.name}
                <button type="button" onClick={() => handleStartEdit(c)}>編集</button>
                <button type="button" onClick={() => handleDeleteCategory(c.id)}>削除</button>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default CategoryManager;

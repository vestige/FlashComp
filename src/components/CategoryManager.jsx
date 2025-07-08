// src/components/CategoryManager.jsx
import { useState, useEffect } from "react";
import { collection, addDoc, getDocs, deleteDoc, doc } from "firebase/firestore";
import { db } from "../firebase";

const CategoryManager = ({ eventId, categories, setCategories }) => {
  const [categoryName, setCategoryName] = useState("");

  useEffect(() => {
    fetchCategories();
  }, [eventId]);

  const fetchCategories = async () => {
    try {
      const snapshot = await getDocs(collection(db, "events", eventId, "categories"));
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setCategories(data);
    } catch (err) {
      console.error("カテゴリの取得に失敗:", err);
    }
  };

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
      await deleteDoc(doc(db, "events", eventId, "categories", categoryId));
      setCategories((prev) => prev.filter((c) => c.id !== categoryId));
    } catch (err) {
      console.error("削除に失敗:", err);
    }
  };

  return (
    <div>
      <h3>🏷 カテゴリ追加</h3>
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
      <ul>
        {categories.map((c) => (
          <li key={c.id}>
            {c.name}
            <button onClick={() => handleDeleteCategory(c.id)}>削除</button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default CategoryManager;
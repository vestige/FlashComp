import { useParams, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, addDoc, getDocs, Timestamp, deleteDoc, doc } from "firebase/firestore";

const EditEvent = () => {
  const { eventId } = useParams();
  const [seasonName, setSeasonName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState("");
  const [seasons, setSeasons] = useState([]);
  const [categoryName, setCategoryName] = useState("");
  const [categories, setCategories] = useState([]);

	const fetchCategories = async () => {
		try {
			const snapshot = await getDocs(collection(db, "events", eventId, "categories"));
			const data = snapshot.docs.map((doc) => ({
				id: doc.id,
				...doc.data(),
			}));
			setCategories(data);
		} catch (err) {
			console.error("カテゴリの取得に失敗:", err);
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
      fetchSeasons(); // 追加後に一覧を更新
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

  const fetchSeasons = async () => {
    try {
      const querySnapshot = await getDocs(
        collection(db, "events", eventId, "seasons")
      );
      const data = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setSeasons(data);
    } catch (err) {
      console.error("シーズンの取得に失敗:", err);
    }
  };

  useEffect(() => {
    fetchSeasons();
		fetchCategories();
  }, [eventId]);

  return (
    <div style={{ padding: "2em" }}>
      <h2>🛠 イベント編集</h2>
      <Link to="/dashboard">← ダッシュボードに戻る</Link>
      <p>イベントID: {eventId}</p>

      <h3>📅 シーズン追加</h3>
      <form onSubmit={handleAddSeason}>
        <input
          type="text"
          placeholder="シーズン名"
          value={seasonName}
          onChange={(e) => setSeasonName(e.target.value)}
          required
        />
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          required
        />
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          required
        />
        <button type="submit">シーズンを追加</button>
      </form>
      <p>{status}</p>

      <h3>📋 登録済みシーズン一覧</h3>
      <ul>
        {seasons.map((season) => (
          <li key={season.id}>
            {season.name}（
            {season.startDate.toDate().toLocaleDateString()}〜
            {season.endDate.toDate().toLocaleDateString()}）
            <button onClick={() => handleDeleteSeason(season.id)}>削除</button>
          </li>
        ))}
      </ul>

			<h3>🏷 カテゴリ追加</h3>
			<form onSubmit={handleAddCategory}>
				<input
					type="text"
					placeholder="カテゴリ名（例：U12男子）"
					value={categoryName}
					onChange={(e) => setCategoryName(e.target.value)}
					required
				/>
				<button type="submit">カテゴリを追加</button>
			</form>

			<h3>🏷 登録済みカテゴリ一覧</h3>
			<ul>
				{categories.map((category) => (
					<li key={category.id}>
						{category.name}
						<button onClick={() => handleDeleteCategory(category.id)}>削除</button>
					</li>
				))}
			</ul>
    </div>
  );
};

export default EditEvent;
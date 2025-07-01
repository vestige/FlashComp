// src/pages/RouteSetting.jsx
import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { db } from "../firebase";
import {
   collection,
   getDocs,
   doc,
   getDoc,
   setDoc,
   deleteDoc
} from "firebase/firestore";

const RouteSetting = () => {
   const { eventId, categoryId } = useParams();
   const [eventName, setEventName] = useState("");
   const [categoryName, setCategoryName] = useState("");
   const [seasons, setSeasons] = useState([]);
   const [selectedSeason, setSelectedSeason] = useState("");
   const [routes, setRoutes] = useState([]);
   const [status, setStatus] = useState("");
   const [isSaving, setIsSaving] = useState(false);

   useEffect(() => {
      const fetchData = async () => {
         try {
            const eventSnap = await getDoc(doc(db, "events", eventId));
            if (eventSnap.exists()) setEventName(eventSnap.data().name);

            const categorySnap = await getDoc(doc(db, "events", eventId, "categories", categoryId));
            if (categorySnap.exists()) setCategoryName(categorySnap.data().name);

            const seasonSnap = await getDocs(collection(db, "events", eventId, "seasons"));
            const seasonList = seasonSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
            setSeasons(seasonList);
         } catch (err) {
            console.error("データの取得に失敗:", err);
         }
      };

      fetchData();
   }, [eventId, categoryId]);

   useEffect(() => {
      const fetchSavedRoutes = async () => {
         if (!selectedSeason) return;
         try {
            const snapshot = await getDocs(
               collection(db, "events", eventId, "seasons", selectedSeason, "categories", categoryId, "routes")
            );
            const savedRoutes = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
               .sort((a, b) => a.name.localeCompare(b.name, "ja"));
            setRoutes(savedRoutes.map(route => ({ ...route, isEditing: false })));
         } catch (err) {
            console.error("ルートの取得に失敗:", err);
         }
      };
      fetchSavedRoutes();
   }, [selectedSeason]);

  const handleAddRoute = () => {
    if (!selectedSeason) {
      alert("シーズンを選択してください");
      return;
    }
    const nextIndex = routes.length + 1;
    const newRoute = {
      name: `No.${String(nextIndex).padStart(2, "0")}`,
      grade: "",
      isBonus: false,
      isEditing: true,
    };
    setRoutes([...routes, newRoute]);
  };

  const handleRouteChange = (index, field, value) => {
    setRoutes((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        [field]: field === "isBonus" ? value.target.checked : value,
      };
      return updated;
    });
  };

   const toggleEdit = (index) => {
      setRoutes((prev) =>
         prev.map((route, i) => ({
            ...route,
            isEditing: i === index ? !route.isEditing : false,
         }))
      );
   };

  const handleSaveRow = async (index) => {
    if (!selectedSeason) {
      alert("シーズンを選択してください");
      return;
    }

    const route = routes[index];

    if (!route.grade || typeof route.grade !== "string") {
      alert(`課題 ${route.name} のグレードが未設定です`);
      return;
    }

    try {
      const routeRef = doc(
        db,
        "events",
        eventId,
        "seasons",
        selectedSeason,
        "categories",
        categoryId,
        "routes",
        route.name
      );

      await setDoc(routeRef, {
        name: route.name,
        grade: route.grade,
        isBonus: route.isBonus,
      });

      setRoutes((prevRoutes) => {
        const updated = [...prevRoutes];
        updated[index].isEditing = false;
        return updated;
      });

      setStatus(`✅ ${route.name} を保存しました！`);
      setTimeout(() => setStatus(""), 3000);
    } catch (err) {
      console.error("保存失敗:", err);
      setStatus("❌ 保存に失敗しました");
    }
  };

  const handleDuplicate = async (index) => {
    if (!selectedSeason) return;
    const original = routes[index];
    const newName = `No.${String(routes.length + 1).padStart(2, "0")}`;
    const copy = {
      ...original,
      name: newName,
      isEditing: false,
    };
    try {
      const routeRef = doc(db, "events", eventId, "seasons", selectedSeason, "categories", categoryId, "routes", newName);
      await setDoc(routeRef, {
        name: newName,
        grade: copy.grade,
        isBonus: copy.isBonus,
      });
      const updated = [...routes];
      updated.splice(index + 1, 0, copy);
      setRoutes(updated);
      setStatus("✅ 複製しました");
      setTimeout(() => setStatus(""), 2000);
    } catch (err) {
      console.error("複製失敗:", err);
    }
  };

  const handleDelete = async (index) => {
    const route = routes[index];
    try {
      const routeRef = doc(db, "events", eventId, "seasons", selectedSeason, "categories", categoryId, "routes", route.name);
      await deleteDoc(routeRef);
      const updated = [...routes];
      updated.splice(index, 1);
      setRoutes(updated);
      setStatus("🗑️ 削除しました");
      setTimeout(() => setStatus(""), 2000);
    } catch (err) {
      console.error("削除失敗:", err);
    }
  };

  return (
    <div style={{ padding: "2em" }}>
      <h2>🧩 ルート設定</h2>
      {status && <p>{status}</p>}
      {isSaving && <p>保存中...</p>}
      <p>イベント: {eventName}</p>
      <p>カテゴリ: {categoryName}</p>
      <p><Link to={`/event/${eventId}/edit`}>← イベント編集に</Link></p>
      <p><Link to={`/event/${eventId}/edit`} state={{ tab: "categories" }}>← カテゴリ一覧に戻る</Link></p>

      <label>
        シーズン選択:
        <select
          value={selectedSeason}
          onChange={(e) => setSelectedSeason(e.target.value)}
        >
          <option value="">-- 選択してください --</option>
          {seasons.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </label>

      <div style={{ marginTop: "1em" }}>
        <button onClick={handleAddRoute}>＋ 課題を追加</button>
      </div>

      <table style={{ marginTop: "1em", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th>課題名</th>
            <th>グレード</th>
            <th>ボーナス</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {routes.map((route, i) => (
            <tr key={i}>
              <td>{route.name}</td>
              <td>
                {route.isEditing ? (
                  <select
                    value={route.grade}
                    onChange={(e) => handleRouteChange(i, "grade", e.target.value)}
                  >
                    <option value="">-- 選択 --</option>
                    <option value="6級">6級</option>
                    <option value="5級">5級</option>
                    <option value="4級">4級</option>
                    <option value="3級">3級</option>
                    <option value="2級">2級</option>
                    <option value="1級">1級</option>
                    <option value="初段">初段</option>
                    <option value="2段">2段</option>
                  </select>
                ) : (
                  route.grade
                )}
              </td>
              <td>
                {route.isEditing ? (
                  <input
                    type="checkbox"
                    checked={route.isBonus}
                    onChange={(e) => handleRouteChange(i, "isBonus", e)}
                  />
                ) : (
                  route.isBonus ? "✅" : "-"
                )}
              </td>
              <td>
                {route.isEditing ? (
                  <>
                    <button onClick={() => handleSaveRow(i)}>保存</button>
                    <button onClick={() => toggleEdit(i)}>キャンセル</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => toggleEdit(i)}>編集</button>
                    <button onClick={() => handleDuplicate(i)}>複製</button>
                    <button onClick={() => handleDelete(i)}>削除</button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default RouteSetting;
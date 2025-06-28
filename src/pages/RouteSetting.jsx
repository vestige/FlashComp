// src/pages/RouteSetting.jsx
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { db } from "../firebase";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
} from "firebase/firestore";

const RouteSetting = () => {
  const { eventId, categoryId } = useParams();
  const [eventName, setEventName] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [seasons, setSeasons] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState("");
  const [routes, setRoutes] = useState([]);
  const [status, setStatus] = useState("");
  const [editIndex, setEditIndex] = useState(null);
  const [editedRoute, setEditedRoute] = useState({ grade: "", isBonus: false });

  useEffect(() => {
    const fetchData = async () => {
      const eventSnap = await getDoc(doc(db, "events", eventId));
      if (eventSnap.exists()) setEventName(eventSnap.data().name);

      const categorySnap = await getDoc(doc(db, "events", eventId, "categories", categoryId));
      if (categorySnap.exists()) setCategoryName(categorySnap.data().name);

      const seasonSnap = await getDocs(collection(db, "events", eventId, "seasons"));
      setSeasons(seasonSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
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
        const savedRoutes = snapshot.docs
          .map((doc) => doc.data())
          .sort((a, b) => a.name.localeCompare(b.name, "ja"));
        setRoutes(savedRoutes);
      } catch (err) {
        console.error("ルートの取得に失敗:", err);
      }
    };
    fetchSavedRoutes();
  }, [selectedSeason]);

  const handleRouteEditChange = (field, value) => {
    setEditedRoute((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveEdit = async (index) => {
    try {
      const routeId = `route${String(index + 1).padStart(2, "0")}`;
      const routeRef = doc(
        db,
        "events",
        eventId,
        "seasons",
        selectedSeason,
        "categories",
        categoryId,
        "routes",
        routeId
      );
      const updated = {
        ...routes[index],
        grade: editedRoute.grade,
        isBonus: editedRoute.isBonus,
      };
      await setDoc(routeRef, updated);
      const updatedRoutes = [...routes];
      updatedRoutes[index] = updated;
      setRoutes(updatedRoutes);
      setEditIndex(null);
      setStatus("✅ 保存完了！");
      setTimeout(() => setStatus(""), 3000);
    } catch (err) {
      console.error("保存エラー:", err);
    }
  };

  const handleDelete = async (index) => {
    const routeId = `route${String(index + 1).padStart(2, "0")}`;
    try {
      await deleteDoc(doc(
        db,
        "events",
        eventId,
        "seasons",
        selectedSeason,
        "categories",
        categoryId,
        "routes",
        routeId
      ));
      const newRoutes = routes.filter((_, i) => i !== index);
      setRoutes(newRoutes);
    } catch (err) {
      console.error("削除失敗:", err);
    }
  };

  return (
    <div style={{ padding: "2em" }}>
      <h2>🧩 ルート設定</h2>
      {status && <p>{status}</p>}
      <p>イベント: {eventName}</p>
      <p>カテゴリ: {categoryName}</p>
      <p><Link to={`/event/${eventId}/edit`}>← イベント編集に</Link></p>
      <p><Link to={`/event/${eventId}/edit`} state={{ tab: "categories" }}>← カテゴリ一覧に戻る</Link></p>

      <div style={{ marginTop: "1em" }}>
        <label>
          シーズン選択:
          <select
            value={selectedSeason}
            onChange={(e) => setSelectedSeason(e.target.value)}
            required
          >
            <option value="">-- 選択してください --</option>
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>
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
            editIndex === i ? (
              <tr key={i}>
                <td>{route.name}</td>
                <td>
                  <select
                    value={editedRoute.grade}
                    onChange={(e) => handleRouteEditChange("grade", e.target.value)}
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
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={editedRoute.isBonus}
                    onChange={(e) => handleRouteEditChange("isBonus", e.target.checked)}
                  />
                </td>
                <td>
                  <button onClick={() => handleSaveEdit(i)}>💾</button>
                  <button onClick={() => setEditIndex(null)}>❌</button>
                </td>
              </tr>
            ) : (
              <tr key={i}>
                <td>{route.name}</td>
                <td>{route.grade || "未設定"}</td>
                <td>{route.isBonus ? "✅" : "❌"}</td>
                <td>
                  <button
                    onClick={() => {
                      setEditIndex(i);
                      setEditedRoute({ grade: route.grade, isBonus: route.isBonus });
                    }}
                  >✏️</button>
                  <button onClick={() => handleDelete(i)}>🗑️</button>
                </td>
              </tr>
            )
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default RouteSetting;
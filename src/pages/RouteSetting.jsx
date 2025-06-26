import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { db } from "../firebase";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc
} from "firebase/firestore";

const RouteSetting = () => {
  const { eventId, categoryId } = useParams();

  const [eventName, setEventName] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [seasons, setSeasons] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState("");
  const [routeCount, setRouteCount] = useState(5);
  const [routes, setRoutes] = useState(
    Array.from({ length: 5 }, (_, i) => ({
      name: `課題${i + 1}`,
      grade: "",
      isBonus: false,
    }))
  );

  useEffect(() => {
    const fetchData = async () => {
      try {
        const eventSnap = await getDoc(doc(db, "events", eventId));
        if (eventSnap.exists()) setEventName(eventSnap.data().name);

        const categorySnap = await getDoc(doc(db, "events", eventId, "categories", categoryId));
        if (categorySnap.exists()) setCategoryName(categorySnap.data().name);

        const seasonSnap = await getDocs(collection(db, "events", eventId, "seasons"));
        const seasonList = seasonSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setSeasons(seasonList);
      } catch (err) {
        console.error("データの取得に失敗:", err);
      }
    };

    fetchData();
  }, [eventId, categoryId]);

   const handleCountChange = (e) => {
      const count = parseInt(e.target.value, 10);
      setRouteCount(count);
      setRoutes((prev) => {
         const updated = [...prev]; // 元の値をコピー
         // 長さ調整（増減両方対応）
         if (updated.length < count) {
            for (let i = updated.length; i < count; i++) {
            updated.push({
               name: `課題${i + 1}`,
               grade: "",
               isBonus: false,
            });
            }
         } else if (updated.length > count) {
            updated.length = count;
         }
         return updated;
      });
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedSeason) {
      alert("シーズンを選択してください");
      return;
    }

    try {
      for (let i = 0; i < routes.length; i++) {
        const route = routes[i];
        const routeRef = doc(
          db,
          "events",
          eventId,
          "seasons",
          selectedSeason,
          "categories",
          categoryId,
          "routes",
          `route${i + 1}`
        );
        await setDoc(routeRef, {
          name: route.name,
          grade: route.grade,
          isBonus: route.isBonus,
        });
      }
      alert("ルート設定を保存しました！");
    } catch (err) {
      console.error("保存失敗:", err);
      alert("保存に失敗しました");
    }
  };

  return (
    <div style={{ padding: "2em" }}>
      <h2>🧩 ルート設定</h2>
      <p>イベント: {eventName}</p>
      <p>カテゴリ: {categoryName}</p>

      <p>
        <Link to={`/event/${eventId}/edit`}>← イベント編集に</Link>
      </p>
      <p>
        <Link to={`/event/${eventId}/edit`} state={{ tab: "categories" }}>
          ← カテゴリ一覧に戻る
        </Link>
      </p>

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
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div style={{ marginTop: "1em" }}>
         <label>
            課題数を選択:
            <select value={routeCount} onChange={handleCountChange} style={{ marginLeft: "0.5em" }}>
               {[...Array(20)].map((_, i) => (
               <option key={i + 1} value={i + 1}>
                  {i + 1} 課題
               </option>
               ))}
            </select>
         </label>
      </div>

      <form onSubmit={handleSubmit}>
        <table style={{ marginTop: "1em", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th>課題名</th>
              <th>グレード</th>
              <th>ボーナス</th>
            </tr>
          </thead>
          <tbody>
            {routes.map((route, i) => (
              <tr key={i}>
                <td>{route.name}</td>
                <td>
                  <select
                    value={route.grade}
                    onChange={(e) =>
                      handleRouteChange(i, "grade", e.target.value)
                    }
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
                    checked={route.isBonus}
                    onChange={(e) => handleRouteChange(i, "isBonus", e)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button type="submit" style={{ marginTop: "1em" }}>
          保存
        </button>
      </form>
    </div>
  );
};

export default RouteSetting;
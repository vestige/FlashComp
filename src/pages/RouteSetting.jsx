// src/pages/RouteSetting.jsx
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { db } from "../firebase";
import {
  doc,
  getDoc,
  collection,
  getDocs
} from "firebase/firestore";

const RouteSetting = () => {
  const { eventId, categoryId } = useParams();
  const [eventName, setEventName] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [seasons, setSeasons] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState("");
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const fetchMeta = async () => {
      const eventSnap = await getDoc(doc(db, "events", eventId));
      if (eventSnap.exists()) setEventName(eventSnap.data().name);

      const catSnap = await getDoc(doc(db, "events", eventId, "categories", categoryId));
      if (catSnap.exists()) setCategoryName(catSnap.data().name);

      const seasonSnap = await getDocs(collection(db, "events", eventId, "seasons"));
      setSeasons(seasonSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };
    fetchMeta();
  }, [eventId, categoryId]);

  const fetchRoutes = async (seasonId) => {
    if (!seasonId) return;
    setLoading(true);
    try {
      const snap = await getDocs(
        collection(db, "events", eventId, "seasons", seasonId, "categories", categoryId, "routes")
      );
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => a.name.localeCompare(b.name, "ja"));
      setRoutes(data);
      setStatus(`✅ ${data.length}件の課題を読み込みました`);
    } catch (err) {
      console.error("読み込み失敗:", err);
      setStatus("❌ 課題の読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "2em" }}>
      <h2>🧩 ルート設定</h2>
      {status && <p>{status}</p>}
      <p>イベント: {eventName}</p>
      <p>カテゴリ: {categoryName}</p>
      <p><Link to={`/event/${eventId}/edit`} state={{ tab: "categories" }}>← カテゴリ一覧に戻る</Link></p>

      <div style={{ marginTop: "1em" }}>
        <label>シーズン選択:{" "}
          <select value={selectedSeason} onChange={(e) => {
            setSelectedSeason(e.target.value);
            fetchRoutes(e.target.value);
          }}>
            <option value="">-- 選択してください --</option>
            {seasons.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>
      </div>

      {loading && <p>読み込み中...</p>}

      {routes.length > 0 ? (
        <table style={{ marginTop: "1em", borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th>No.</th>
              <th>グレード</th>
              <th>ボーナス</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {routes.map((route, index) => (
              <tr key={route.id}>
                <td>{route.name}</td>
                <td>{route.grade}</td>
                <td>{route.isBonus ? "✔" : ""}</td>
                <td>
                  <button>編集</button>{" "}
                  <button>削除</button> {/* 機能は後ほど追加 */}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        !loading && selectedSeason && <p>登録された課題はありません。</p>
      )}
    </div>
  );
};

export default RouteSetting;
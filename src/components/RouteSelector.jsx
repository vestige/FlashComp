// src/components/RouteSelector.jsx
import { useState, useEffect } from "react";
import { collection, getDocs, doc, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useParams } from "react-router-dom";

const RouteSelector = () => {
  const { eventId } = useParams();
  const [seasons, setSeasons] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState("");
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [routes, setRoutes] = useState([]);
  const [status, setStatus] = useState("");

  // 初期データの取得
  useEffect(() => {
    const fetchSeasons = async () => {
      const snapshot = await getDocs(collection(db, "events", eventId, "seasons"));
      setSeasons(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    };
    fetchSeasons();
  }, [eventId]);

  // シーズン選択時にカテゴリを取得
  useEffect(() => {
    if (!selectedSeason) return;
    const fetchCategories = async () => {
      const snapshot = await getDocs(collection(db, "events", eventId, "categories"));
      setCategories(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    };
    fetchCategories();
    setSelectedCategory(""); // リセット
    setRoutes([]); // リセット
  }, [selectedSeason]);

  // カテゴリ選択時にルート取得
  useEffect(() => {
    if (!selectedSeason || !selectedCategory) return;
    const fetchRoutes = async () => {
      const snapshot = await getDocs(collection(db, "events", eventId, "seasons", selectedSeason, "categories", selectedCategory, "routes"));
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data(), isEditing: false }));
      data.sort((a, b) => a.name.localeCompare(b.name, "ja"));
      setRoutes(data);
    };
    fetchRoutes();
  }, [selectedCategory]);

  const handleAddRoute = () => {
    const name = `No.${String(routes.length + 1).padStart(2, "0")}`;
    setRoutes([...routes, { name, grade: "", isBonus: false, isEditing: true }]);
  };

  const handleRouteChange = (index, field, value) => {
    setRoutes((prev) => {
      const updated = [...prev];
      updated[index][field] = field === "isBonus" ? value.target.checked : value;
      return updated;
    });
  };

  const toggleEdit = (index) => {
    setRoutes((prev) =>
      prev.map((r, i) => ({ ...r, isEditing: i === index ? !r.isEditing : false }))
    );
  };

  const handleSaveRow = async (index) => {
    const route = routes[index];
    if (!route.grade) {
      alert("グレードを設定してください");
      return;
    }

    const ref = doc(db, "events", eventId, "seasons", selectedSeason, "categories", selectedCategory, "routes", route.name);
    await setDoc(ref, {
      name: route.name,
      grade: route.grade,
      isBonus: route.isBonus,
    });

    setRoutes((prev) => {
      const updated = [...prev];
      updated[index].isEditing = false;
      return updated;
    });
    setStatus(`✅ ${route.name} を保存しました`);
    setTimeout(() => setStatus(""), 2000);
  };

  const handleDuplicate = async (index) => {
    const original = routes[index];
    const name = `No.${String(routes.length + 1).padStart(2, "0")}`;
    const ref = doc(db, "events", eventId, "seasons", selectedSeason, "categories", selectedCategory, "routes", name);
    await setDoc(ref, {
      name,
      grade: original.grade,
      isBonus: original.isBonus,
    });
    const copy = { ...original, name, isEditing: false };
    const updated = [...routes];
    updated.splice(index + 1, 0, copy);
    setRoutes(updated);
    setStatus("✅ 複製しました");
    setTimeout(() => setStatus(""), 2000);
  };

  const handleDelete = async (index) => {
    const name = routes[index].name;
    const ref = doc(db, "events", eventId, "seasons", selectedSeason, "categories", selectedCategory, "routes", name);
    await deleteDoc(ref);
    const updated = [...routes];
    updated.splice(index, 1);
    setRoutes(updated);
    setStatus("🗑️ 削除しました");
    setTimeout(() => setStatus(""), 2000);
  };

  return (
    <div>
      <h3>🧩 ルート設定</h3>
      {status && <p>{status}</p>}

      <label>
        シーズン選択：
        <select value={selectedSeason} onChange={(e) => setSelectedSeason(e.target.value)}>
          <option value="">-- 選択 --</option>
          {seasons.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </label>

      {selectedSeason && (
        <>
          <label>
            カテゴリ選択：
            <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
              <option value="">-- 選択 --</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>

          {selectedCategory && (
            <>
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
                          <select value={route.grade} onChange={(e) => handleRouteChange(i, "grade", e.target.value)}>
                            <option value="">-- 選択 --</option>
                            <option value="9級">9級</option>
                            <option value="8級">8級</option>
                            <option value="7級">7級</option>
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
            </>
          )}
        </>
      )}
    </div>
  );
};

export default RouteSelector;
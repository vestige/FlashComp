// src/pages/ScoreInput.jsx
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { usePageTitle } from "../hooks/usePageTitle";
import { useOwnerProfile } from "../hooks/useOwnerProfile";

const ScoreInput = () => {
  const { eventId, seasonId, categoryId, participantId } = useParams();
  const [routes, setRoutes] = useState([]);
  const [participantName, setParticipantName] = useState("");
  const [scores, setScores] = useState({});
  const [viewMode, setViewMode] = useState("simple");
  const [showOnlyUncleared, setShowOnlyUncleared] = useState(true);
  const [routeKeyword, setRouteKeyword] = useState("");
  const [status, setStatus] = useState("");
  const [updatedAt, setUpdatedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [accessDenied, setAccessDenied] = useState(false);
  const { gymIds, loading: profileLoading, error: profileError } = useOwnerProfile();
  usePageTitle(participantName ? `スコア入力: ${participantName}` : "スコア入力");

  useEffect(() => {
    if (profileLoading) return;
    if (profileError) {
      setError(profileError);
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError("");
      setAccessDenied(false);
      try {
        const eventSnap = await getDoc(doc(db, "events", eventId));
        if (!eventSnap.exists()) {
          setError("イベントが見つかりません。");
          return;
        }
        if (!gymIds.includes(eventSnap.data().gymId)) {
          setAccessDenied(true);
          return;
        }

        const participantSnap = await getDoc(
          doc(db, "events", eventId, "participants", participantId)
        );
        if (participantSnap.exists()) {
          setParticipantName(participantSnap.data().name || "");
        }

        const routeSnap = await getDocs(
          collection(
            db,
            "events",
            eventId,
            "seasons",
            seasonId,
            "categories",
            categoryId,
            "routes"
          )
        );
        const fetchedRoutes = routeSnap.docs
          .map((doc) => doc.data())
          .sort((a, b) => a.name.localeCompare(b.name, "ja"));
        setRoutes(fetchedRoutes);

        const scoresSnap = await getDoc(
          doc(
            db,
            "events",
            eventId,
            "seasons",
            seasonId,
            "categories",
            categoryId,
            "participants",
            participantId
          )
        );
        if (scoresSnap.exists()) {
          const data = scoresSnap.data();
          if (data.scores) setScores(data.scores);
          if (data.updatedAt) setUpdatedAt(data.updatedAt.toDate());
        }
      } catch (err) {
        console.error("データの取得に失敗:", err);
        setError("採点データの取得に失敗しました。");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [eventId, seasonId, categoryId, participantId, gymIds, profileLoading, profileError]);

  const handleToggleScore = (routeName) => {
    setScores((prev) => ({
      ...prev,
      [routeName]: !prev[routeName],
    }));
  };

  const normalizedKeyword = routeKeyword.trim().toLowerCase();
  const clearCount = routes.filter((route) => !!scores[route.name]).length;
  const remainingCount = routes.length - clearCount;
  const visibleRoutes = routes.filter((route) => {
    const matchesKeyword =
      normalizedKeyword.length === 0 || route.name.toLowerCase().includes(normalizedKeyword);
    if (!matchesKeyword) return false;
    if (!showOnlyUncleared) return true;
    return !scores[route.name];
  });

  const applyBulkToVisible = (isCleared) => {
    setScores((prev) => {
      const next = { ...prev };
      for (const route of visibleRoutes) {
        next[route.name] = isCleared;
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (accessDenied) return;

    try {
      await setDoc(
        doc(
          db,
          "events",
          eventId,
          "seasons",
          seasonId,
          "categories",
          categoryId,
          "participants",
          participantId
        ),
        {
          scores,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setStatus("✅ 保存しました");
      setTimeout(() => setStatus(""), 2000);
    } catch (err) {
      console.error("保存失敗:", err);
      setStatus("❌ 保存に失敗しました");
    }
  };

  if (loading || profileLoading) {
    return <p style={{ padding: "2em" }}>採点画面を読み込んでいます...</p>;
  }

  if (error || profileError) {
    return (
      <div style={{ padding: "2em" }}>
        <p>{error || profileError}</p>
        <Link to={`/events/${eventId}/edit`} state={{ tab: "scores", seasonId, categoryId }}>
          ← スコア採点に戻る
        </Link>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div style={{ padding: "2em" }}>
        <p>このイベントの採点を行う権限がありません。</p>
        <Link to="/dashboard">← ダッシュボードに戻る</Link>
      </div>
    );
  }

  return (
    <div style={{ padding: "1.2em", maxWidth: "920px", margin: "0 auto" }}>
      <h2>📝 スコア入力</h2>
      <p>
        <Link to={`/events/${eventId}/edit`} state={{ tab: "scores", seasonId, categoryId }}>
          ← スコア採点に戻る
        </Link>
      </p>
      <p style={{ marginBottom: "0.3em" }}>参加者: {participantName}</p>
      <p style={{ marginTop: 0, marginBottom: "0.6em" }}>
        完登 {clearCount} / 全{routes.length}（未完登 {remainingCount}）
      </p>
      {updatedAt && (
        <p style={{ fontStyle: "italic", fontSize: "0.9em", marginTop: 0 }}>
          最終更新: {updatedAt.toLocaleString()}
        </p>
      )}

      <section
        style={{
          marginTop: "0.8em",
          border: "1px solid #ddd",
          borderRadius: "8px",
          padding: "0.8em",
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6em", alignItems: "center" }}>
          <button
            type="button"
            onClick={() => setViewMode("simple")}
            style={{
              border: "1px solid #bbb",
              background: viewMode === "simple" ? "#f0f0f0" : "#fff",
              borderRadius: "999px",
              padding: "0.35em 0.8em",
              fontWeight: viewMode === "simple" ? "bold" : "normal",
            }}
          >
            簡易表示
          </button>
          <button
            type="button"
            onClick={() => setViewMode("detail")}
            style={{
              border: "1px solid #bbb",
              background: viewMode === "detail" ? "#f0f0f0" : "#fff",
              borderRadius: "999px",
              padding: "0.35em 0.8em",
              fontWeight: viewMode === "detail" ? "bold" : "normal",
            }}
          >
            詳細表示
          </button>
          <label>
            <input
              type="checkbox"
              checked={showOnlyUncleared}
              onChange={(e) => setShowOnlyUncleared(e.target.checked)}
              style={{ marginRight: "0.3em" }}
            />
            未完登のみ
          </label>
          <label>
            課題検索:
            <input
              type="text"
              value={routeKeyword}
              onChange={(e) => setRouteKeyword(e.target.value)}
              placeholder="No.01"
              style={{ marginLeft: "0.4em" }}
            />
          </label>
        </div>
        <div style={{ marginTop: "0.7em", display: "flex", gap: "0.6em", flexWrap: "wrap" }}>
          <button type="button" onClick={() => applyBulkToVisible(true)}>
            表示中をすべて完登
          </button>
          <button type="button" onClick={() => applyBulkToVisible(false)}>
            表示中をすべて未完登
          </button>
        </div>
      </section>

      <div style={{ marginTop: "0.9em" }}>
        {visibleRoutes.length === 0 ? (
          <p>表示条件に一致する課題がありません。</p>
        ) : viewMode === "simple" ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
              gap: "0.6em",
            }}
          >
            {visibleRoutes.map((route) => {
              const isCleared = !!scores[route.name];
              return (
                <button
                  key={route.name}
                  type="button"
                  onClick={() => handleToggleScore(route.name)}
                  style={{
                    textAlign: "left",
                    border: `1px solid ${isCleared ? "#7bbf8e" : "#ccc"}`,
                    background: isCleared ? "#eaf8ee" : "#fff",
                    borderRadius: "10px",
                    padding: "0.7em",
                    minHeight: "88px",
                  }}
                >
                  <div style={{ fontWeight: "bold" }}>{route.name}</div>
                  <div style={{ fontSize: "0.9em", marginTop: "0.25em" }}>
                    級: {route.grade || "-"} / 点: {route.points ?? "-"}
                  </div>
                  <div style={{ marginTop: "0.35em", fontWeight: "bold" }}>
                    {isCleared ? "完登" : "未完登"}
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", minWidth: "520px" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>課題</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>級</th>
                  <th style={{ textAlign: "right", borderBottom: "1px solid #ddd" }}>点数</th>
                  <th style={{ textAlign: "center", borderBottom: "1px solid #ddd" }}>完登</th>
                </tr>
              </thead>
              <tbody>
                {visibleRoutes.map((route) => (
                  <tr key={route.name}>
                    <td style={{ padding: "0.4em 0" }}>{route.name}</td>
                    <td>{route.grade || "-"}</td>
                    <td style={{ textAlign: "right" }}>{route.points ?? "-"}</td>
                    <td style={{ textAlign: "center" }}>
                      <input
                        type="checkbox"
                        checked={!!scores[route.name]}
                        onChange={() => handleToggleScore(route.name)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ marginTop: "1em" }}>
        <button type="button" onClick={handleSave}>💾 保存</button>
        <span style={{ marginLeft: "1em" }}>{status}</span>
      </div>
    </div>
  );
};

export default ScoreInput;

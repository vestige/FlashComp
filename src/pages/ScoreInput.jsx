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

const ScoreInput = () => {
  const { eventId, seasonId, categoryId, participantId } = useParams();
  const [routes, setRoutes] = useState([]);
  const [participantName, setParticipantName] = useState("");
  const [scores, setScores] = useState({});
  const [status, setStatus] = useState("");
  const [updatedAt, setUpdatedAt] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
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
      }
    };

    fetchData();
  }, [eventId, seasonId, categoryId, participantId]);

  const handleToggleScore = (routeName) => {
    setScores((prev) => ({
      ...prev,
      [routeName]: !prev[routeName],
    }));
  };

  const handleSave = async () => {
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

  return (
    <div style={{ padding: "2em" }}>
      <h2>📝 スコア入力</h2>
      <p>

      <Link to={`/events/${eventId}/edit`} state={{ tab: "scores", seasonId, categoryId }}>
      ← スコア採点に戻る
      </Link>

      </p>
      <p>参加者: {participantName}</p>
      {updatedAt && (
        <p style={{ fontStyle: "italic", fontSize: "0.9em" }}>
          最終更新: {updatedAt.toLocaleString()}
        </p>
      )}

      <div style={{ marginTop: "1em" }}>
        {routes.map((route) => (
          <div
            key={route.name}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0.5em 0",
              borderBottom: "1px solid #ddd",
            }}
          >
            <span>{route.name}</span>
            <input
              type="checkbox"
              checked={!!scores[route.name]}
              onChange={() => handleToggleScore(route.name)}
            />
          </div>
        ))}
      </div>

      <div style={{ marginTop: "1em" }}>
        <button onClick={handleSave}>💾 保存</button>
        <span style={{ marginLeft: "1em" }}>{status}</span>
      </div>
    </div>
  );
};

export default ScoreInput;
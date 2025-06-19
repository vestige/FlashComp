import { useState } from "react";
import { db } from "../firebase";
import { useNavigate, Link } from "react-router-dom";
import { collection, addDoc, serverTimestamp, Timestamp } from "firebase/firestore";

function CreateEvent() {
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      await addDoc(collection(db, "events"), {
        name,
        startDate: Timestamp.fromDate(new Date(startDate)),
        endDate: Timestamp.fromDate(new Date(endDate)),
        createdAt: serverTimestamp(),
      });
      setStatus("✅ イベントを作成しました！");
      setName("");
      setStartDate("");
      setEndDate("");
      navigate("/dashboard");
    } catch (err) {
      console.error(err);
      setStatus("❌ 作成に失敗しました");
    }
  };

  return (
    <div style={{ padding: "2em" }}>
      <h2>🗓 イベント作成</h2>

      <Link to="/dashboard">← ダッシュボードへ戻る</Link>

      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="イベント名"
          value={name}
          onChange={(e) => setName(e.target.value)}
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
        <button type="submit">作成</button>
      </form>
      <p>{status}</p>
    </div>
  );
}

export default CreateEvent;
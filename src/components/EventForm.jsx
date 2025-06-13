import { useState } from "react";
import { db } from "../firebase";
import { collection, addDoc, Timestamp } from "firebase/firestore";

export default function EventForm() {
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus("保存中...");

    try {
      await addDoc(collection(db, "events"), {
        name,
        startDate: Timestamp.fromDate(new Date(startDate)),
        endDate: Timestamp.fromDate(new Date(endDate)),
        createdAt: Timestamp.now()
      });
      setStatus("✅ イベントを保存しました！");
      setName(""); setStartDate(""); setEndDate("");
    } catch (error) {
      setStatus("❌ エラー: " + error.message);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: "500px", margin: "2em auto" }}>
      <h3>🗓️ イベント作成</h3>
      <input placeholder="イベント名" value={name} onChange={e => setName(e.target.value)} required />
      <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required />
      <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} required />
      <button type="submit">保存</button>
      <p>{status}</p>
    </form>
  );
}
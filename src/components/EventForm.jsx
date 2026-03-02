import { useState } from "react";
import { db } from "../firebase";
import { collection, addDoc, Timestamp } from "firebase/firestore";
import { parseDateInputAsLocalDate } from "../lib/dateInput";

export default function EventForm() {
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus("保存中...");

    try {
      const parsedStart = parseDateInputAsLocalDate(startDate);
      const parsedEnd = parseDateInputAsLocalDate(endDate);
      if (!parsedStart || !parsedEnd) {
        setStatus("❌ 日付の形式が不正です");
        return;
      }
      await addDoc(collection(db, "events"), {
        name,
        startDate: Timestamp.fromDate(parsedStart),
        endDate: Timestamp.fromDate(parsedEnd),
        createdAt: Timestamp.now()
      });
      setStatus("✅ イベントを保存しました！");
      setName(""); setStartDate(""); setEndDate("");
    } catch (error) {
      setStatus("❌ エラー: " + error.message);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mx-auto mt-8 grid max-w-xl gap-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-xl font-bold text-slate-900">🗓️ イベント作成</h3>
      <input
        placeholder="イベント名"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
      />
      <input
        type="date"
        value={startDate}
        onChange={(e) => setStartDate(e.target.value)}
        required
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
      />
      <input
        type="date"
        value={endDate}
        onChange={(e) => setEndDate(e.target.value)}
        required
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
      />
      <button
        type="submit"
        className="inline-flex items-center justify-center rounded-lg border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-800 transition hover:bg-sky-100"
      >
        保存
      </button>
      <p className="text-sm text-slate-600">{status}</p>
    </form>
  );
}

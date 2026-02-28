import { useEffect, useState } from "react";
import { collection, addDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "../firebase";
import { validateEventDraft } from "../lib/eventDraft";

const EventCreateForm = ({
  gyms,
  ownerUid,
  onCreated,
  onCancel,
  submitLabel = "Create Event",
}) => {
  const [name, setName] = useState("");
  const [gymId, setGymId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (gyms.length === 0) {
      setGymId("");
      return;
    }
    setGymId((current) => (current && gyms.some((gym) => gym.id === current) ? current : gyms[0].id));
  }, [gyms]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const error = validateEventDraft({ name, gymId, startDate, endDate });
    if (error) {
      setStatus(`❌ ${error}`);
      return;
    }

    setSubmitting(true);
    setStatus("");
    try {
      const start = Timestamp.fromDate(new Date(startDate));
      const end = Timestamp.fromDate(new Date(endDate));
      const ref = await addDoc(collection(db, "events"), {
        name: name.trim(),
        gymId,
        ownerUid: ownerUid || "",
        startDate: start,
        endDate: end,
        createdAt: serverTimestamp(),
      });

      const createdEvent = {
        id: ref.id,
        name: name.trim(),
        gymId,
        ownerUid: ownerUid || "",
        startDate: start,
        endDate: end,
      };

      setStatus("✅ イベントを作成しました！");
      setName("");
      setStartDate("");
      setEndDate("");

      if (onCreated) {
        onCreated(createdEvent);
      }
    } catch (err) {
      console.error("イベント作成に失敗:", err);
      setStatus("❌ 作成に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  if (gyms.length === 0) {
    return (
      <p className="text-sm text-slate-600">
        担当ジムが未設定のため、イベントを作成できません。システム管理者に設定を依頼してください。
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <div className="grid gap-2">
        <label className="text-sm font-semibold text-slate-700">イベント名</label>
        <input
          type="text"
          placeholder="例: FlashComp Live 2026"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
        />
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-semibold text-slate-700">開催ジム</label>
        <select
          value={gymId}
          onChange={(e) => setGymId(e.target.value)}
          required
          className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
        >
          {gyms.map((gym) => (
            <option key={gym.id} value={gym.id}>
              {gym.name || gym.id}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <label className="text-sm font-semibold text-slate-700">開始日</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
            className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-semibold text-slate-700">終了日</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            required
            className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center rounded-xl bg-emerald-800 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-900/15 transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "作成中..." : submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center rounded-lg border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            キャンセル
          </button>
        )}
      </div>

      {status && (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${
            status.startsWith("✅") ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
          }`}
        >
          {status}
        </p>
      )}
    </form>
  );
};

export default EventCreateForm;

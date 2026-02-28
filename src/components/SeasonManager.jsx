// src/components/SeasonManager.jsx
import { useState, useEffect, useCallback } from "react";
import { db } from "../firebase";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  doc,
  Timestamp,
} from "firebase/firestore";
import {
  formatSeasonDate,
  formatSeasonDay,
  formatSeasonMonth,
  getSeasonStatus,
  seasonStatusLabel,
  seasonStatusStyle,
} from "../lib/seasonStatus";

const toInputDate = (value) => {
  if (!value) return "";
  const date = typeof value.toDate === "function" ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const SeasonManager = ({ eventId, showCreateForm = true, refreshToken = 0 }) => {
  const [seasonName, setSeasonName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState("");
  const [seasons, setSeasons] = useState([]);
  const [editingSeasonId, setEditingSeasonId] = useState("");
  const [editForm, setEditForm] = useState({ name: "", startDate: "", endDate: "" });

  const fetchSeasons = useCallback(async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "events", eventId, "seasons"));
      const data = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setSeasons(data);
    } catch (err) {
      console.error("シーズンの取得に失敗:", err);
    }
  }, [eventId]);

  useEffect(() => {
    fetchSeasons();
  }, [fetchSeasons, refreshToken]);

  const handleAddSeason = async (e) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, "events", eventId, "seasons"), {
        name: seasonName,
        startDate: Timestamp.fromDate(new Date(startDate)),
        endDate: Timestamp.fromDate(new Date(endDate)),
      });
      setStatus("✅ シーズンを追加しました！");
      setSeasonName("");
      setStartDate("");
      setEndDate("");
      fetchSeasons();
    } catch (err) {
      console.error(err);
      setStatus("❌ シーズンの追加に失敗しました");
    }
  };

  const handleDeleteSeason = async (seasonId) => {
    const confirmDelete = window.confirm("本当にこのシーズンを削除しますか？");
    if (!confirmDelete) return;
    try {
      await deleteDoc(doc(db, "events", eventId, "seasons", seasonId));
      setSeasons((prev) => prev.filter((s) => s.id !== seasonId));
    } catch (err) {
      console.error("削除に失敗:", err);
    }
  };

  const handleStartEdit = (season) => {
    setEditingSeasonId(season.id);
    setEditForm({
      name: season.name || "",
      startDate: toInputDate(season.startDate),
      endDate: toInputDate(season.endDate),
    });
  };

  const handleCancelEdit = () => {
    setEditingSeasonId("");
    setEditForm({ name: "", startDate: "", endDate: "" });
  };

  const handleSaveEdit = async (seasonId) => {
    if (!editForm.name.trim() || !editForm.startDate || !editForm.endDate) {
      alert("シーズン名・開始日・終了日を入力してください。");
      return;
    }

    try {
      const payload = {
        name: editForm.name.trim(),
        startDate: Timestamp.fromDate(new Date(editForm.startDate)),
        endDate: Timestamp.fromDate(new Date(editForm.endDate)),
      };

      await updateDoc(doc(db, "events", eventId, "seasons", seasonId), payload);
      setSeasons((prev) =>
        prev.map((season) => (season.id === seasonId ? { ...season, ...payload } : season))
      );
      handleCancelEdit();
    } catch (err) {
      console.error("シーズン更新に失敗:", err);
      alert("シーズンの更新に失敗しました。");
    }
  };

  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-base font-bold text-slate-900">{showCreateForm ? "📅 シーズン追加" : "📅 シーズン一覧"}</h3>
      {showCreateForm && (
        <>
          <form onSubmit={handleAddSeason} className="mt-3 grid gap-3 md:grid-cols-[1fr_auto_auto_auto] md:items-end">
            <input
              type="text"
              placeholder="シーズン名"
              value={seasonName}
              onChange={(e) => setSeasonName(e.target.value)}
              required
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900"
            >
              追加
            </button>
          </form>
          {status && <p className="mt-3 text-sm text-slate-600">{status}</p>}
        </>
      )}
      <ul className="mt-4 grid gap-3">
        {seasons.map((season) => {
          const seasonStatus = getSeasonStatus(season);
          const statusClass = seasonStatusStyle[seasonStatus] || seasonStatusStyle.unknown;
          const statusLabel = seasonStatusLabel[seasonStatus] || seasonStatusLabel.unknown;

          return (
            <li
              key={season.id}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-sky-300"
            >
              {editingSeasonId === season.id ? (
                <div className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end">
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                  <input
                    type="date"
                    value={editForm.startDate}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, startDate: e.target.value }))}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                  <input
                    type="date"
                    value={editForm.endDate}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, endDate: e.target.value }))}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                  <div className="md:col-span-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleSaveEdit(season.id)}
                      className="inline-flex items-center rounded-lg bg-emerald-800 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900"
                    >
                      保存
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="inline-flex items-center rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                    >
                      キャンセル
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-14 w-14 rounded-lg bg-sky-50 text-center text-sky-800">
                      <p className="pt-1 text-[10px] font-bold tracking-wide">{formatSeasonMonth(season.startDate)}</p>
                      <p className="text-xl font-black">{formatSeasonDay(season.startDate)}</p>
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-base font-bold text-slate-900">{season.name || "無題シーズン"}</p>
                        <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusClass}`}>
                          {statusLabel}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-500">
                        {formatSeasonDate(season.startDate)} - {formatSeasonDate(season.endDate)}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 md:justify-end">
                    <button
                      type="button"
                      onClick={() => handleStartEdit(season)}
                      className="inline-flex items-center rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                    >
                      編集
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteSeason(season.id)}
                      className="inline-flex items-center rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-100"
                    >
                      削除
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default SeasonManager;

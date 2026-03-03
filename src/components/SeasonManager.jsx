// src/components/SeasonManager.jsx
import { useState, useEffect, useCallback } from "react";
import { db } from "../firebase";
import {
  collection,
  addDoc,
  getDocs,
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
import { validateSeasonInEventRange } from "../lib/seasonDraft";
import { parseDateInputAsLocalDate } from "../lib/dateInput";
import { deleteSeasonCascade } from "../lib/eventDataCleanup";
import ConfirmDialog from "./ConfirmDialog";
import {
  inputFieldClass,
  primaryButtonClass,
  sectionCardClass,
  sectionHeadingClass,
  subtleButtonClass,
} from "./uiStyles";

const toInputDate = (value) => {
  if (!value) return "";
  const date = typeof value.toDate === "function" ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const SeasonManager = ({
  eventId,
  showCreateForm = true,
  refreshToken = 0,
  onEditSeason = null,
  eventRange = null,
}) => {
  const [seasonName, setSeasonName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState("");
  const [seasons, setSeasons] = useState([]);
  const [editingSeasonId, setEditingSeasonId] = useState("");
  const [editForm, setEditForm] = useState({ name: "", startDate: "", endDate: "" });
  const [pendingDeleteSeason, setPendingDeleteSeason] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

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
      const parsedStart = parseDateInputAsLocalDate(startDate);
      const parsedEnd = parseDateInputAsLocalDate(endDate);
      if (!parsedStart || !parsedEnd) {
        setStatus("❌ 日付の形式が不正です");
        return;
      }
      await addDoc(collection(db, "events", eventId, "seasons"), {
        name: seasonName,
        startDate: Timestamp.fromDate(parsedStart),
        endDate: Timestamp.fromDate(parsedEnd),
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

  const handleDeleteSeason = async () => {
    if (!pendingDeleteSeason) return;
    const seasonId = pendingDeleteSeason.id;
    setIsDeleting(true);
    try {
      await deleteSeasonCascade({ eventId, seasonId });
      setSeasons((prev) => prev.filter((s) => s.id !== seasonId));
      setPendingDeleteSeason(null);
    } catch (err) {
      console.error("削除に失敗:", err);
    } finally {
      setIsDeleting(false);
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
      const parsedStart = parseDateInputAsLocalDate(editForm.startDate);
      const parsedEnd = parseDateInputAsLocalDate(editForm.endDate);
      if (!parsedStart || !parsedEnd) {
        alert("日付の形式が不正です。");
        return;
      }
      const payload = {
        name: editForm.name.trim(),
        startDate: Timestamp.fromDate(parsedStart),
        endDate: Timestamp.fromDate(parsedEnd),
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
    <div className={`mt-4 ${sectionCardClass}`}>
      <h3 className={sectionHeadingClass}>{showCreateForm ? "📅 シーズン追加" : "📅 シーズン一覧"}</h3>
      {showCreateForm && (
        <>
          <form onSubmit={handleAddSeason} className="mt-3 grid gap-3 md:grid-cols-[1fr_auto_auto_auto] md:items-end">
            <input
              type="text"
              placeholder="シーズン名"
              value={seasonName}
              onChange={(e) => setSeasonName(e.target.value)}
              required
              className={inputFieldClass}
            />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
              className={inputFieldClass}
            />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
              className={inputFieldClass}
            />
            <button
              type="submit"
              className={primaryButtonClass}
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
          const rangeError = validateSeasonInEventRange({
            startDate: season.startDate,
            endDate: season.endDate,
            eventStartDate: eventRange?.startDate,
            eventEndDate: eventRange?.endDate,
          });
          const hasRangeError = Boolean(rangeError);

          return (
            <li
              key={season.id}
              className={`rounded-xl border bg-white p-4 shadow-sm transition ${
                hasRangeError
                  ? "border-amber-300 hover:border-amber-400"
                  : "border-slate-200 hover:border-sky-300"
              }`}
            >
              {editingSeasonId === season.id && typeof onEditSeason !== "function" ? (
                <div className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end">
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                    className={inputFieldClass}
                  />
                  <input
                    type="date"
                    value={editForm.startDate}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, startDate: e.target.value }))}
                    className={inputFieldClass}
                  />
                  <input
                    type="date"
                    value={editForm.endDate}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, endDate: e.target.value }))}
                    className={inputFieldClass}
                  />
                  <div className="md:col-span-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleSaveEdit(season.id)}
                      className={primaryButtonClass}
                    >
                      保存
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className={subtleButtonClass}
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
                      {hasRangeError && (
                        <p className="mt-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800">
                          イベント期間外です。イベント期間またはシーズン期間を見直してください。
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 md:justify-end">
                    {typeof onEditSeason === "function" ? (
                      <button
                        type="button"
                        onClick={() => onEditSeason(season.id)}
                        className={subtleButtonClass}
                      >
                        編集
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleStartEdit(season)}
                        className={subtleButtonClass}
                      >
                        編集
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setPendingDeleteSeason(season)}
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
      <ConfirmDialog
        open={Boolean(pendingDeleteSeason)}
        title="シーズンを削除しますか？"
        message={`「${pendingDeleteSeason?.name || "このシーズン"}」を削除します。元に戻せません。`}
        confirmLabel="削除する"
        onConfirm={handleDeleteSeason}
        onCancel={() => setPendingDeleteSeason(null)}
        busy={isDeleting}
      />
    </div>
  );
};

export default SeasonManager;

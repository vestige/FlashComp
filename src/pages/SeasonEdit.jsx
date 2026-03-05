import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import { useOwnerProfile } from "../hooks/useOwnerProfile";
import { usePageTitle } from "../hooks/usePageTitle";
import { validateSeasonDraft, validateSeasonInEventRange } from "../lib/seasonDraft";
import { formatSeasonDate, getSeasonStatus, seasonStatusLabel, seasonStatusStyle } from "../lib/seasonStatus";
import RouteSelector from "../components/RouteSelector";
import ConfirmDialog from "../components/ConfirmDialog";
import ManagementHero from "../components/ManagementHero";
import { parseDateInputAsLocalDate } from "../lib/dateInput";
import { deleteSeasonCascade } from "../lib/eventDataCleanup";
import {
  inputFieldClass,
  pageBackgroundClass,
  pageContainerClass,
  sectionCardClass,
  sectionHeadingClass,
  subtleButtonClass,
} from "../components/uiStyles";

const toDate = (value) => {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (typeof value.seconds === "number") return new Date(value.seconds * 1000);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toInputDate = (value) => {
  const date = toDate(value);
  if (!date) return "";
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const SeasonEdit = () => {
  const { eventId, seasonId } = useParams();
  const navigate = useNavigate();
  const [eventName, setEventName] = useState("");
  const [seasonDraft, setSeasonDraft] = useState({ name: "", startDate: "", endDate: "" });
  const [savedSeason, setSavedSeason] = useState({ name: "", startDate: "", endDate: "" });
  const [eventRange, setEventRange] = useState({ startDate: "", endDate: "" });
  const [categories, setCategories] = useState([]);
  const [status, setStatus] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [accessDenied, setAccessDenied] = useState(false);
  const {
    gymIds,
    hasAllGymAccess,
    loading: profileLoading,
    error: profileError,
  } = useOwnerProfile();
  usePageTitle(seasonDraft.name ? `シーズン編集: ${seasonDraft.name}` : "シーズン編集");

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
        const eventRef = doc(db, "events", eventId);
        const seasonRef = doc(db, "events", eventId, "seasons", seasonId);
        const [eventSnap, seasonSnap, categorySnap] = await Promise.all([
          getDoc(eventRef),
          getDoc(seasonRef),
          getDocs(collection(db, "events", eventId, "categories")),
        ]);

        if (!eventSnap.exists()) {
          setError("イベントが見つかりません。");
          return;
        }
        if (!seasonSnap.exists()) {
          setError("シーズンが見つかりません。");
          return;
        }

        const eventData = eventSnap.data();
        setEventName(eventData.name || "");
        setEventRange({
          startDate: toInputDate(eventData.startDate),
          endDate: toInputDate(eventData.endDate),
        });
        if (!hasAllGymAccess && !gymIds.includes(eventData.gymId)) {
          setAccessDenied(true);
          return;
        }

        const seasonData = seasonSnap.data();
        setCategories(categorySnap.docs.map((categoryDoc) => ({ id: categoryDoc.id, ...categoryDoc.data() })));
        const nextDraft = {
          name: seasonData.name || "",
          startDate: toInputDate(seasonData.startDate),
          endDate: toInputDate(seasonData.endDate),
        };
        setSeasonDraft(nextDraft);
        setSavedSeason(nextDraft);
      } catch (err) {
        console.error("シーズン編集データの取得に失敗:", err);
        setError("シーズン編集データの取得に失敗しました。");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [eventId, seasonId, gymIds, hasAllGymAccess, profileLoading, profileError]);

  const handleSave = async (e) => {
    e.preventDefault();
    const normalizedDraft = {
      name: seasonDraft.name.trim(),
      startDate: seasonDraft.startDate,
      endDate: seasonDraft.endDate,
    };
    const validationError = validateSeasonDraft(normalizedDraft);
    if (validationError) {
      setStatus(`❌ ${validationError}`);
      return;
    }
    const rangeError = validateSeasonInEventRange({
      startDate: normalizedDraft.startDate,
      endDate: normalizedDraft.endDate,
      eventStartDate: eventRange.startDate,
      eventEndDate: eventRange.endDate,
    });
    if (rangeError) {
      setStatus(`❌ ${rangeError}`);
      return;
    }

    setIsSaving(true);
    setStatus("");
    try {
      const startLocalDate = parseDateInputAsLocalDate(normalizedDraft.startDate);
      const endLocalDate = parseDateInputAsLocalDate(normalizedDraft.endDate);
      if (!startLocalDate || !endLocalDate) {
        setStatus("❌ 日付の形式が不正です");
        return;
      }
      const payload = {
        name: normalizedDraft.name,
        startDate: Timestamp.fromDate(startLocalDate),
        endDate: Timestamp.fromDate(endLocalDate),
        updatedAt: serverTimestamp(),
      };
      await updateDoc(doc(db, "events", eventId, "seasons", seasonId), payload);
      setSavedSeason(normalizedDraft);
      setSeasonDraft(normalizedDraft);
      setIsEditing(false);
      setStatus("✅ シーズン情報を更新しました。");
    } catch (err) {
      console.error("シーズン更新に失敗:", err);
      setStatus("❌ シーズン更新に失敗しました。");
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDeleteSeason = async () => {
    setDeleteError("");
    setIsDeleting(true);
    try {
      await deleteSeasonCascade({ eventId, seasonId });
      navigate(`/events/${eventId}/edit`, { replace: true });
    } catch (err) {
      console.error("シーズン削除に失敗:", err);
      setDeleteError("シーズン削除に失敗しました。");
    } finally {
      setIsDeleting(false);
      setIsDeleteModalOpen(false);
    }
  };

  const seasonPrimaryButtonClass =
    "inline-flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-700 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-800/15 transition hover:bg-emerald-800";
  const seasonStatus = getSeasonStatus(savedSeason);
  const statusClass = seasonStatusStyle[seasonStatus] || seasonStatusStyle.unknown;
  const seasonStatusText = seasonStatusLabel[seasonStatus] || seasonStatusLabel.unknown;
  const formattedRange = useMemo(() => {
    return `${formatSeasonDate(savedSeason.startDate)} - ${formatSeasonDate(savedSeason.endDate)}`;
  }, [savedSeason.startDate, savedSeason.endDate]);
  const formattedEventRange = useMemo(() => {
    return `${formatSeasonDate(eventRange.startDate)} - ${formatSeasonDate(eventRange.endDate)}`;
  }, [eventRange.startDate, eventRange.endDate]);

  if (loading || profileLoading) {
    return (
      <div className={pageBackgroundClass}>
        <div className={pageContainerClass}>
          <p className="text-sm text-slate-600">シーズン編集データを読み込んでいます...</p>
        </div>
      </div>
    );
  }

  if (error || profileError) {
    return (
      <div className={pageBackgroundClass}>
        <div className={pageContainerClass}>
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error || profileError}
          </p>
        </div>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className={pageBackgroundClass}>
        <div className={pageContainerClass}>
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            このイベントを編集する権限がありません。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={pageBackgroundClass}>
      <div className={pageContainerClass}>
        <ManagementHero
          title="Season Settings"
          description={`Event: ${eventName} / Season: ${seasonDraft.name || "Untitled Season"}`}
          backTo={`/events/${eventId}/edit`}
          backLabel="↩ Event Settingsへ戻る"
          surface={false}
        />

        <section className="mt-4">
          <h2 className={sectionHeadingClass}>📚Summary</h2>
          <div className={sectionCardClass}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-slate-600">シーズン情報と開催期間を編集できます。</p>
              <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusClass}`}>
                {seasonStatusText}
              </span>
            </div>
            <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <p className="text-xs font-semibold tracking-wide text-emerald-700">イベント開催期間</p>
              <p className="mt-1 text-sm font-medium text-slate-900">{formattedEventRange}</p>
            </div>

            {!isEditing ? (
              <div className="mt-3 space-y-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold tracking-wide text-slate-500">シーズン名</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">{savedSeason.name || "-"}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold tracking-wide text-slate-500">開催期間</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">{formattedRange}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSeasonDraft(savedSeason);
                    setIsEditing(true);
                    setStatus("");
                  }}
                  className={subtleButtonClass}
                >
                  編集
                </button>
              </div>
            ) : (
              <form onSubmit={handleSave} className="mt-4 grid gap-4">
                <div className="grid gap-2">
                  <label className="text-sm font-semibold text-slate-700">シーズン名</label>
                  <input
                    type="text"
                    value={seasonDraft.name}
                    onChange={(e) => setSeasonDraft((prev) => ({ ...prev, name: e.target.value }))}
                    required
                    className={inputFieldClass}
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <label className="text-sm font-semibold text-slate-700">開始日</label>
                    <input
                      type="date"
                      value={seasonDraft.startDate}
                      onChange={(e) => setSeasonDraft((prev) => ({ ...prev, startDate: e.target.value }))}
                      required
                      className={inputFieldClass}
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-semibold text-slate-700">終了日</label>
                    <input
                      type="date"
                      value={seasonDraft.endDate}
                      onChange={(e) => setSeasonDraft((prev) => ({ ...prev, endDate: e.target.value }))}
                      required
                      className={inputFieldClass}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className={`${seasonPrimaryButtonClass} disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    {isSaving ? "更新中..." : "更新"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSeasonDraft(savedSeason);
                      setIsEditing(false);
                      setStatus("");
                    }}
                    className={subtleButtonClass}
                  >
                    キャンセル
                  </button>
                </div>
              </form>
            )}

            {status && (
              <p
                className={`mt-3 inline-flex rounded-lg px-3 py-2 text-sm ${
                  status.startsWith("✅") ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                }`}
              >
                {status}
              </p>
            )}
          </div>
        </section>

        <section className="mt-4">
          <h2 className={sectionHeadingClass}>💛Registered Routes</h2>
          <div className={sectionCardClass}>
            {categories.length === 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-sm text-amber-800">
                  カテゴリが未登録です。先にEvent Settingsでカテゴリを作成してください。
                </p>
                <Link
                  to={`/events/${eventId}/edit#registered-categories`}
                  className="inline-flex items-center rounded-lg border border-emerald-300 bg-white px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50"
                >
                  カテゴリを登録する
                </Link>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <RouteSelector
                  eventId={eventId}
                  categories={categories}
                  fixedSeasonId={seasonId}
                  hideSeasonSelector
                  title=""
                  description=""
                />
              </div>
            )}
          </div>
        </section>

        <section className="mt-8">
          <h2 className="mb-4 text-2xl font-bold text-rose-800">Danger Zone</h2>
          <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4 shadow-sm">
            <p className="text-sm text-rose-700">
              シーズンを削除するとシーズン本体は復元できません。実行前に必要なデータをCSV出力してください。
            </p>
            {deleteError && (
              <p className="mt-2 rounded-lg border border-rose-300 bg-white px-3 py-2 text-sm text-rose-700">
                {deleteError}
              </p>
            )}
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(true)}
                disabled={isDeleting}
                className="inline-flex items-center rounded-lg bg-rose-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeleting ? "削除中..." : "シーズンを削除"}
              </button>
            </div>
          </div>
        </section>
        <ConfirmDialog
          open={isDeleteModalOpen}
          title="シーズンを削除しますか？"
          message={`「${seasonDraft.name || "このシーズン"}」を削除します。元に戻せません。`}
          confirmLabel="シーズンを削除"
          onConfirm={confirmDeleteSeason}
          onCancel={() => setIsDeleteModalOpen(false)}
          busy={isDeleting}
        />
      </div>
    </div>
  );
};

export default SeasonEdit;

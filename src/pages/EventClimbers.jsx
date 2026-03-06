import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import ParticipantManager from "../components/ParticipantManager";
import { useOwnerProfile } from "../hooks/useOwnerProfile";
import { usePageTitle } from "../hooks/usePageTitle";
import { downloadCsv, parseCsv } from "../lib/csvUtils";
import { cleanupParticipantScoresOutsideCategory } from "../lib/eventDataCleanup";
import ManagementHero from "../components/ManagementHero";
import { pageBackgroundClass, pageContainerClass, sectionCardClass, sectionHeadingClass } from "../components/uiStyles";

const REQUIRED_IMPORT_COLUMNS = ["name", "memberNo", "age", "gender", "categoryId"];

const normalizeGender = (value) => {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  if (raw === "male" || raw === "m" || raw === "man" || raw === "男性") return "male";
  if (raw === "female" || raw === "f" || raw === "woman" || raw === "女性") return "female";
  if (raw === "other" || raw === "その他") return "other";
  return "";
};

const DownloadIcon = ({ className = "h-4 w-4" }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M12 3v10" />
    <path d="M9 10l3 3 3-3" />
    <path d="M4 17h16" />
  </svg>
);

const UploadIcon = ({ className = "h-4 w-4" }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M12 21V11" />
    <path d="M16 11 12 7 8 11" />
    <path d="M4 17h16" />
  </svg>
);

const EventClimbers = () => {
  const { eventId } = useParams();
  const [eventName, setEventName] = useState("");
  const [categories, setCategories] = useState([]);
  const [participantCount, setParticipantCount] = useState(0);
  const [csvStatus, setCsvStatus] = useState("");
  const [importingCsv, setImportingCsv] = useState(false);
  const [participantRefreshToken, setParticipantRefreshToken] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [accessDenied, setAccessDenied] = useState(false);
  const {
    gymIds,
    hasAllGymAccess,
    loading: profileLoading,
    error: profileError,
  } = useOwnerProfile();
  usePageTitle("Climber Settings");

  const Icon = ({ children, className = "h-4 w-4" }) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );

  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories]
  );

  const fetchParticipants = useCallback(async () => {
    const participantSnap = await getDocs(collection(db, "events", eventId, "participants"));
    const participants = participantSnap.docs
      .map((participantDoc) => ({ id: participantDoc.id, ...participantDoc.data() }))
      .sort((a, b) => (a.name || "").localeCompare(b.name || "", "ja"));
    setParticipantCount(participants.length);
    return participants;
  }, [eventId]);

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

        const eventData = eventSnap.data();
        setEventName(eventData.name || "");
        if (!hasAllGymAccess && !gymIds.includes(eventData.gymId)) {
          setAccessDenied(true);
          return;
        }

        const categorySnap = await getDocs(collection(db, "events", eventId, "categories"));
        setCategories(categorySnap.docs.map((categoryDoc) => ({ id: categoryDoc.id, ...categoryDoc.data() })));
        await fetchParticipants();
      } catch (err) {
        console.error("クライマーデータの取得に失敗:", err);
        setError("クライマーデータの取得に失敗しました。");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [eventId, gymIds, hasAllGymAccess, profileLoading, profileError, fetchParticipants]);

  const exportParticipantsCsv = async () => {
    setCsvStatus("");
    try {
      const participants = await fetchParticipants();
      const headers = [
        "id",
        "name",
        "memberNo",
        "age",
        "gender",
        "categoryId",
        "categoryName",
        "entrySeasonId",
        "participatingSeasonIds",
      ];
      const rows = participants.map((participant) => ({
        id: participant.id,
        name: participant.name || "",
        memberNo: participant.memberNo || "",
        age: participant.age ?? "",
        gender: participant.gender || "",
        categoryId: participant.categoryId || "",
        categoryName: categoryById.get(participant.categoryId)?.name || "",
        entrySeasonId: participant.entrySeasonId || "",
        participatingSeasonIds: Array.isArray(participant.participatingSeasonIds)
          ? participant.participatingSeasonIds.join("|")
          : "",
      }));

      downloadCsv(`${eventId}-participants.csv`, headers, rows);
      setCsvStatus(`✅ クライマーCSVを出力しました（${rows.length}件）。`);
    } catch (err) {
      console.error("クライマーCSV出力に失敗:", err);
      setCsvStatus("❌ クライマーCSV出力に失敗しました。");
    }
  };

  const handleImportParticipantsFile = async (eventInput) => {
    const file = eventInput.target.files?.[0];
    eventInput.target.value = "";
    if (!file) return;

    setImportingCsv(true);
    setCsvStatus("");
    try {
      const text = await file.text();
      const { headers, records } = parseCsv(text);
      if (headers.length === 0) {
        setCsvStatus("❌ CSVにヘッダー行がありません。");
        return;
      }

      const headerMap = new Map(headers.map((header) => [header.toLowerCase(), header]));
      const missingColumns = REQUIRED_IMPORT_COLUMNS.filter((column) => !headerMap.has(column.toLowerCase()));
      if (missingColumns.length > 0) {
        setCsvStatus(`❌ 必須列が不足しています: ${missingColumns.join(", ")}`);
        return;
      }

      const categoryNameToId = new Map(categories.map((category) => [category.name, category.id]));
      const importRows = [];
      const errors = [];

      records.forEach((record, index) => {
        const line = index + 2;
        const get = (key) => record[headerMap.get(key.toLowerCase()) || ""] || "";

        const id = String(get("id")).trim();
        const name = String(get("name")).trim();
        const memberNo = String(get("memberNo")).trim();
        const ageText = String(get("age")).trim();
        const gender = normalizeGender(get("gender"));
        const rawCategoryId = String(get("categoryId")).trim();
        const categoryName = String(get("categoryName")).trim();
        const categoryId = rawCategoryId || categoryNameToId.get(categoryName) || "";
        const entrySeasonId = String(get("entrySeasonId")).trim();
        const participatingSeasonIdsText = String(get("participatingSeasonIds")).trim();
        const participatingSeasonIds = participatingSeasonIdsText
          ? participatingSeasonIdsText
            .split("|")
            .map((value) => value.trim())
            .filter(Boolean)
          : [];

        const age = Number(ageText);
        if (!name || !memberNo || !Number.isFinite(age) || age <= 0 || !gender || !categoryId) {
          errors.push(`line ${line}: name/memberNo/age/gender/categoryId のいずれかが不正です`);
          return;
        }
        if (!categoryById.has(categoryId)) {
          errors.push(`line ${line}: categoryId "${categoryId}" が存在しません`);
          return;
        }

        importRows.push({
          id,
          payload: {
            name,
            memberNo,
            age,
            gender,
            categoryId,
            entrySeasonId: entrySeasonId || null,
            participatingSeasonIds,
          },
        });
      });

      if (errors.length > 0) {
        setCsvStatus(`❌ CSV検証エラー: ${errors.slice(0, 5).join(" / ")}`);
        return;
      }
      if (importRows.length === 0) {
        setCsvStatus("❌ 取り込み対象の行がありません。");
        return;
      }

      let batch = writeBatch(db);
      let opCount = 0;
      const participantsRef = collection(db, "events", eventId, "participants");
      const existingParticipants = await fetchParticipants();
      const existingById = new Map(existingParticipants.map((participant) => [participant.id, participant]));
      const categoryChangedParticipants = new Map();
      const commitBatchIfNeeded = async (force = false) => {
        if (opCount >= 400 || (force && opCount > 0)) {
          await batch.commit();
          batch = writeBatch(db);
          opCount = 0;
        }
      };

      for (const row of importRows) {
        const ref = row.id ? doc(db, "events", eventId, "participants", row.id) : doc(participantsRef);
        if (row.id) {
          const existing = existingById.get(row.id);
          if (existing && existing.categoryId !== row.payload.categoryId) {
            categoryChangedParticipants.set(row.id, row.payload.categoryId);
          }
          batch.set(ref, { ...row.payload, updatedAt: serverTimestamp() }, { merge: true });
        } else {
          batch.set(ref, {
            ...row.payload,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
        opCount += 1;
        await commitBatchIfNeeded();
      }

      await commitBatchIfNeeded(true);
      for (const [participantId, keepCategoryId] of categoryChangedParticipants.entries()) {
        await cleanupParticipantScoresOutsideCategory({
          eventId,
          participantId,
          keepCategoryId,
        });
      }
      setParticipantRefreshToken((prev) => prev + 1);
      setCsvStatus(`✅ クライマーCSVを取り込みました（${importRows.length}件）。`);
    } catch (err) {
      console.error("クライマーCSV取り込みに失敗:", err);
      setCsvStatus("❌ クライマーCSV取り込みに失敗しました。");
    } finally {
      setImportingCsv(false);
    }
  };

  if (loading || profileLoading) {
    return (
      <div className={pageBackgroundClass}>
        <div className={pageContainerClass}>
          <p className="text-sm text-slate-600">クライマーデータを読み込んでいます...</p>
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
        <div className="mb-8">
          <ManagementHero
            title="Climber Settings"
            description="参加者情報の登録・CSV入出力・カテゴリ管理を行います。"
            backTo="/dashboard"
            backLabel="↩ ダッシュボードへ戻る"
            surface={false}
          />
        </div>

        <section className="mt-4">
          <h2 className={sectionHeadingClass}>
            <Icon className="h-5 w-5 text-sky-600">
              <path d="M4 5h16v14H4z" />
              <path d="M8 10h8" />
              <path d="M8 14h5" />
            </Icon>
            Summary
          </h2>
          <div className={sectionCardClass}>
            <div className="grid gap-3 sm:grid-cols-2">
              <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Event Name</p>
                <p className="mt-1 text-lg font-bold text-slate-900">{eventName || "-"}</p>
              </article>
              <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Registered Climbers
                </p>
                <p className="mt-1 text-lg font-bold text-slate-900">{participantCount}</p>
              </article>
            </div>
          </div>
        </section>

        <section className="mt-5">
          <h2 className={sectionHeadingClass}>👤 Registered Climbers</h2>
          <div className={sectionCardClass}>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={exportParticipantsCsv}
                  className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800"
                  aria-label="クライマーCSVを出力"
                >
                  <DownloadIcon />
                  出力
                </button>
                <label
                  htmlFor="climber-csv-import"
                  className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border border-sky-300 bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 ${
                    importingCsv ? "pointer-events-none cursor-not-allowed opacity-70" : ""
                  }`}
                  aria-label="クライマーCSVを取り込み"
                >
                  <UploadIcon />
                  取り込み
                  <input
                    type="file"
                    id="climber-csv-import"
                    accept=".csv,text/csv"
                    onChange={handleImportParticipantsFile}
                    disabled={importingCsv}
                    className="sr-only"
                  />
                </label>
                  <span className="text-sm text-slate-600">{importingCsv ? "取り込み中..." : ""}</span>
              </div>
              <p className="mt-3 text-right text-sm text-slate-600">
                クライマーCSVの出力/取り込みを行います。必須列:
                <span className="font-mono"> name,memberNo,age,gender,categoryId</span>
              </p>
              {csvStatus && <p className="mt-3 text-sm text-slate-600">{csvStatus}</p>}
            </div>

            <ParticipantManager
              eventId={eventId}
              categories={categories}
              refreshToken={participantRefreshToken}
              showSectionHeader={false}
              onParticipantsCountChange={setParticipantCount}
            />
          </div>
        </section>
      </div>
    </div>
  );
};

export default EventClimbers;

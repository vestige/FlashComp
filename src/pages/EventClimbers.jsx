import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
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

const REQUIRED_IMPORT_COLUMNS = ["name", "memberNo", "age", "gender", "categoryId"];

const normalizeGender = (value) => {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  if (raw === "male" || raw === "m" || raw === "man" || raw === "男性") return "male";
  if (raw === "female" || raw === "f" || raw === "woman" || raw === "女性") return "female";
  if (raw === "other" || raw === "その他") return "other";
  return "";
};

const EventClimbers = () => {
  const { eventId } = useParams();
  const [eventName, setEventName] = useState("");
  const [categories, setCategories] = useState([]);
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
  usePageTitle(eventName ? `クライマー登録: ${eventName}` : "クライマー登録");

  const quickLinkClass = (active) =>
    `inline-flex items-center rounded-lg border px-3 py-2 text-sm font-medium transition ${
      active
        ? "border-sky-300 bg-sky-50 text-sky-800"
        : "border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100"
    }`;
  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories]
  );

  const fetchParticipants = useCallback(async () => {
    const participantSnap = await getDocs(collection(db, "events", eventId, "participants"));
    return participantSnap.docs
      .map((participantDoc) => ({ id: participantDoc.id, ...participantDoc.data() }))
      .sort((a, b) => (a.name || "").localeCompare(b.name || "", "ja"));
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
      } catch (err) {
        console.error("クライマーデータの取得に失敗:", err);
        setError("クライマーデータの取得に失敗しました。");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [eventId, gymIds, hasAllGymAccess, profileLoading, profileError]);

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

  const exportGenderRatioCsv = async () => {
    setCsvStatus("");
    try {
      const participants = await fetchParticipants();
      const headers = [
        "scope",
        "categoryId",
        "categoryName",
        "male",
        "female",
        "other",
        "unknown",
        "total",
        "maleRatioPct",
        "femaleRatioPct",
      ];
      const calcCounts = (rows) => {
        let male = 0;
        let female = 0;
        let other = 0;
        let unknown = 0;
        for (const row of rows) {
          if (row.gender === "male") male += 1;
          else if (row.gender === "female") female += 1;
          else if (row.gender === "other") other += 1;
          else unknown += 1;
        }
        const total = male + female + other + unknown;
        const maleRatioPct = total > 0 ? ((male / total) * 100).toFixed(1) : "0.0";
        const femaleRatioPct = total > 0 ? ((female / total) * 100).toFixed(1) : "0.0";
        return { male, female, other, unknown, total, maleRatioPct, femaleRatioPct };
      };

      const rows = [];
      rows.push({
        scope: "overall",
        categoryId: "all",
        categoryName: "全カテゴリ",
        ...calcCounts(participants),
      });
      for (const category of categories) {
        const byCategory = participants.filter((participant) => participant.categoryId === category.id);
        rows.push({
          scope: "category",
          categoryId: category.id,
          categoryName: category.name || category.id,
          ...calcCounts(byCategory),
        });
      }

      downloadCsv(`${eventId}-gender-ratio.csv`, headers, rows);
      setCsvStatus("✅ 男女比CSVを出力しました。");
    } catch (err) {
      console.error("男女比CSV出力に失敗:", err);
      setCsvStatus("❌ 男女比CSV出力に失敗しました。");
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
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <p className="text-sm text-slate-600">クライマーデータを読み込んでいます...</p>
      </div>
    );
  }

  if (error || profileError) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error || profileError}
        </p>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          このイベントを編集する権限がありません。
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#dbeafe_0%,_#f8fafc_45%,_#ecfeff_100%)]">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-sky-700">Climber Management</p>
            <h2 className="text-2xl font-bold text-slate-900">👤 クライマー登録：{eventName}</h2>
          </div>
          <Link
            to="/dashboard"
            className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            ↩ ダッシュボードへ戻る
          </Link>
        </div>

        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap gap-2">
            <Link to={`/events/${eventId}/edit`} className={quickLinkClass(false)}>
              🛠 イベント設定
            </Link>
            <Link to={`/events/${eventId}/climbers`} className={quickLinkClass(true)}>
              👤 クライマー管理
            </Link>
            <Link to={`/events/${eventId}/scores`} className={quickLinkClass(false)}>
              📋 スコア管理
            </Link>
          </div>
        </section>

        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-base font-bold text-slate-900">クライマーCSV</h3>
          <p className="mt-1 text-sm text-slate-600">
            クライマーCSVの出力/取り込みをこの画面で行います。必須列:
            <span className="font-mono"> name,memberNo,age,gender,categoryId</span>
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={exportParticipantsCsv}
              className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-800 transition hover:bg-sky-100"
            >
              クライマーCSVを出力
            </button>
            <button
              type="button"
              onClick={exportGenderRatioCsv}
              className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              男女比CSVを出力
            </button>
            <label className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700">
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleImportParticipantsFile}
                disabled={importingCsv}
                className="text-sm"
              />
            </label>
            <span className="text-sm text-slate-600">{importingCsv ? "取り込み中..." : ""}</span>
          </div>
          {csvStatus && <p className="mt-3 text-sm text-slate-600">{csvStatus}</p>}
        </section>

        <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
          <ParticipantManager
            eventId={eventId}
            categories={categories}
            refreshToken={participantRefreshToken}
          />
        </section>
      </div>
    </div>
  );
};

export default EventClimbers;

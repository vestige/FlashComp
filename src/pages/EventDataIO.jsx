import { useEffect, useMemo, useState } from "react";
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
import { useOwnerProfile } from "../hooks/useOwnerProfile";
import { usePageTitle } from "../hooks/usePageTitle";
import {
  buildAssignedTasks,
  buildTaskByScoreKey,
  fetchCategoryAssignments,
  fetchSeasonTasks,
} from "../lib/taskAssignments";

const REQUIRED_IMPORT_COLUMNS = ["name", "memberNo", "age", "gender"];

const normalizeGender = (value) => {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  if (raw === "male" || raw === "m" || raw === "man" || raw === "男性") return "male";
  if (raw === "female" || raw === "f" || raw === "woman" || raw === "女性") return "female";
  if (raw === "other" || raw === "その他") return "other";
  return "";
};

const csvEscape = (value) => {
  const text = value == null ? "" : String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

const buildCsv = (headers, rows) => {
  const lines = [headers.map(csvEscape).join(",")];
  for (const row of rows) {
    lines.push(headers.map((key) => csvEscape(row[key] ?? "")).join(","));
  }
  return `${lines.join("\r\n")}\r\n`;
};

const downloadCsv = (filename, headers, rows) => {
  const csv = buildCsv(headers, rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};

const parseCsv = (text) => {
  const rows = [];
  let current = "";
  let row = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        current += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === ",") {
      row.push(current);
      current = "";
      continue;
    }
    if (char === "\n") {
      row.push(current.replace(/\r$/, ""));
      current = "";
      if (row.some((value) => value !== "")) {
        rows.push(row);
      }
      row = [];
      continue;
    }
    current += char;
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current.replace(/\r$/, ""));
    if (row.some((value) => value !== "")) {
      rows.push(row);
    }
  }

  if (rows.length === 0) return { headers: [], records: [] };

  const headers = rows[0].map((header) => String(header || "").trim());
  const records = rows.slice(1).map((values) => {
    const record = {};
    headers.forEach((header, index) => {
      record[header] = values[index] ?? "";
    });
    return record;
  });

  return { headers, records };
};

const toTimestampMs = (value) => {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.seconds === "number") return value.seconds * 1000;
  return 0;
};

const buildInitialCategoryMap = (categories, participants) => {
  const result = {};
  for (const category of categories) {
    const byParticipantId = new Map();
    for (const participant of participants.filter((p) => p.categoryId === category.id)) {
      byParticipantId.set(participant.id, {
        participantId: participant.id,
        name: participant.name || "名無し",
        memberNo: participant.memberNo || "-",
        totalPoints: 0,
        clearCount: 0,
        latestUpdatedAt: 0,
      });
    }
    result[category.id] = byParticipantId;
  }
  return result;
};

const buildRankings = (categoryMap) => {
  const rankings = {};

  for (const [categoryId, participants] of Object.entries(categoryMap)) {
    const sorted = Array.from(participants.values()).sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      if (b.clearCount !== a.clearCount) return b.clearCount - a.clearCount;
      return a.name.localeCompare(b.name, "ja");
    });

    let prevPoints = null;
    let prevClears = null;
    let rank = 0;

    rankings[categoryId] = sorted.map((row, index) => {
      if (row.totalPoints !== prevPoints || row.clearCount !== prevClears) {
        rank = index + 1;
      }
      prevPoints = row.totalPoints;
      prevClears = row.clearCount;
      return { ...row, rank };
    });
  }

  return rankings;
};

const EventDataIO = () => {
  const { eventId } = useParams();
  const {
    gymIds,
    hasAllGymAccess,
    loading: profileLoading,
    error: profileError,
  } = useOwnerProfile();
  usePageTitle("CSV入出力");

  const [event, setEvent] = useState(null);
  const [seasons, setSeasons] = useState([]);
  const [categories, setCategories] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState("all");

  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [importing, setImporting] = useState(false);
  const [exportingRank, setExportingRank] = useState(false);

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

  const loadBaseData = async () => {
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
      if (!hasAllGymAccess && !gymIds.includes(eventData.gymId)) {
        setAccessDenied(true);
        return;
      }

      const [seasonSnap, categorySnap, participantSnap] = await Promise.all([
        getDocs(collection(db, "events", eventId, "seasons")),
        getDocs(collection(db, "events", eventId, "categories")),
        getDocs(collection(db, "events", eventId, "participants")),
      ]);

      setEvent({ id: eventSnap.id, ...eventData });
      setSeasons(
        seasonSnap.docs
          .map((seasonDoc) => ({ id: seasonDoc.id, ...seasonDoc.data() }))
          .sort((a, b) => (a.name || "").localeCompare(b.name || "", "ja"))
      );
      setCategories(
        categorySnap.docs
          .map((categoryDoc) => ({ id: categoryDoc.id, ...categoryDoc.data() }))
          .sort((a, b) => (a.name || "").localeCompare(b.name || "", "ja"))
      );
      setParticipants(
        participantSnap.docs
          .map((participantDoc) => ({ id: participantDoc.id, ...participantDoc.data() }))
          .sort((a, b) => (a.name || "").localeCompare(b.name || "", "ja"))
      );
    } catch (err) {
      console.error("CSV入出力データの取得に失敗:", err);
      setError("CSV入出力データの取得に失敗しました。");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profileLoading) return;
    if (profileError) {
      setError(profileError);
      setLoading(false);
      return;
    }
    loadBaseData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileLoading, profileError, eventId, hasAllGymAccess, gymIds.join(",")]);

  useEffect(() => {
    if (selectedSeasonId === "all") return;
    const exists = seasons.some((season) => season.id === selectedSeasonId);
    if (!exists) setSelectedSeasonId("all");
  }, [selectedSeasonId, seasons]);

  const exportParticipantsCsv = () => {
    if (!event) return;
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

    downloadCsv(`${event.id}-participants.csv`, headers, rows);
    setStatus(`✅ クライマーCSVを出力しました（${rows.length}件）。`);
  };

  const exportGenderRatioCsv = () => {
    if (!event) return;
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

    downloadCsv(`${event.id}-gender-ratio.csv`, headers, rows);
    setStatus("✅ 男女比CSVを出力しました。");
  };

  const calculateRankingRows = async () => {
    const targetSeasonIds =
      selectedSeasonId === "all"
        ? seasons.map((season) => season.id)
        : [selectedSeasonId].filter(Boolean);

    if (targetSeasonIds.length === 0) return [];

    const categoryMap = buildInitialCategoryMap(categories, participants);
    const participantById = new Map(participants.map((participant) => [participant.id, participant]));

    const seasonTasksBySeasonId = new Map(
      await Promise.all(
        targetSeasonIds.map(async (seasonId) => [seasonId, await fetchSeasonTasks(eventId, seasonId)])
      )
    );

    const fetchTasks = targetSeasonIds.flatMap((seasonId) =>
      categories.map(async (category) => {
        const [assignments, scoreSnap] = await Promise.all([
          fetchCategoryAssignments(eventId, seasonId, category.id),
          getDocs(
            collection(db, "events", eventId, "seasons", seasonId, "categories", category.id, "participants")
          ),
        ]);

        return {
          categoryId: category.id,
          assignedTasks: buildAssignedTasks(seasonTasksBySeasonId.get(seasonId) || [], assignments),
          scoreSnap,
        };
      })
    );

    const results = await Promise.all(fetchTasks);

    for (const { categoryId, assignedTasks, scoreSnap } of results) {
      const taskByScoreKey = buildTaskByScoreKey(assignedTasks);
      for (const scoreDoc of scoreSnap.docs) {
        const data = scoreDoc.data();
        const scoreMap = data.scores || {};
        const participantId = scoreDoc.id;

        if (!categoryMap[categoryId].has(participantId)) {
          const fallback = participantById.get(participantId);
          categoryMap[categoryId].set(participantId, {
            participantId,
            name: fallback?.name || data.participantName || `ID:${participantId}`,
            memberNo: fallback?.memberNo || "-",
            totalPoints: 0,
            clearCount: 0,
            latestUpdatedAt: 0,
          });
        }

        const row = categoryMap[categoryId].get(participantId);
        const countedTaskIds = new Set();
        for (const [scoreKey, isCleared] of Object.entries(scoreMap)) {
          if (!isCleared) continue;

          const task = taskByScoreKey.get(scoreKey);
          const canonicalTaskId = task?.id || scoreKey;
          if (countedTaskIds.has(canonicalTaskId)) continue;
          countedTaskIds.add(canonicalTaskId);

          row.totalPoints += Number(task?.points) || 1;
          row.clearCount += 1;
        }
        row.latestUpdatedAt = Math.max(row.latestUpdatedAt, toTimestampMs(data.updatedAt));
      }
    }

    const rankings = buildRankings(categoryMap);
    const seasonScope =
      selectedSeasonId === "all"
        ? "all"
        : seasons.find((season) => season.id === selectedSeasonId)?.name || selectedSeasonId;

    const rows = [];
    for (const category of categories) {
      const rankedRows = rankings[category.id] || [];
      for (const rankedRow of rankedRows) {
        rows.push({
          seasonScope,
          categoryId: category.id,
          categoryName: category.name || category.id,
          rank: rankedRow.rank,
          participantId: rankedRow.participantId,
          participantName: rankedRow.name,
          memberNo: rankedRow.memberNo,
          totalPoints: rankedRow.totalPoints,
          clearCount: rankedRow.clearCount,
        });
      }
    }

    return rows;
  };

  const exportRankingCsv = async () => {
    if (!event) return;
    setExportingRank(true);
    setStatus("");
    try {
      const rows = await calculateRankingRows();
      const headers = [
        "seasonScope",
        "categoryId",
        "categoryName",
        "rank",
        "participantId",
        "participantName",
        "memberNo",
        "totalPoints",
        "clearCount",
      ];
      downloadCsv(`${event.id}-ranking.csv`, headers, rows);
      setStatus(`✅ 順位CSVを出力しました（${rows.length}件）。`);
    } catch (err) {
      console.error("順位CSV出力に失敗:", err);
      setStatus("❌ 順位CSV出力に失敗しました。");
    } finally {
      setExportingRank(false);
    }
  };

  const handleImportParticipantsFile = async (eventInput) => {
    const file = eventInput.target.files?.[0];
    eventInput.target.value = "";
    if (!file) return;

    setImporting(true);
    setStatus("");
    try {
      const text = await file.text();
      const { headers, records } = parseCsv(text);
      if (headers.length === 0) {
        setStatus("❌ CSVにヘッダー行がありません。");
        return;
      }

      const headerMap = new Map(headers.map((header) => [header.toLowerCase(), header]));
      const missingColumns = REQUIRED_IMPORT_COLUMNS.filter(
        (column) => !headerMap.has(column.toLowerCase())
      );
      if (missingColumns.length > 0) {
        setStatus(`❌ 必須列が不足しています: ${missingColumns.join(", ")}`);
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
          errors.push(
            `line ${line}: name/memberNo/age/gender/categoryId のいずれかが不正です`
          );
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
        setStatus(`❌ CSV検証エラー: ${errors.slice(0, 5).join(" / ")}`);
        return;
      }

      if (importRows.length === 0) {
        setStatus("❌ 取り込み対象の行がありません。");
        return;
      }

      let batch = writeBatch(db);
      let opCount = 0;
      const participantsRef = collection(db, "events", eventId, "participants");

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
          batch.set(
            ref,
            {
              ...row.payload,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
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
      await loadBaseData();
      setStatus(`✅ クライマーCSVを取り込みました（${importRows.length}件）。`);
    } catch (err) {
      console.error("クライマーCSV取り込みに失敗:", err);
      setStatus("❌ クライマーCSV取り込みに失敗しました。");
    } finally {
      setImporting(false);
    }
  };

  if (loading || profileLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <p className="text-sm text-slate-600">CSV入出力画面を読み込んでいます...</p>
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
          このイベントのCSV入出力を行う権限がありません。
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#dbeafe_0%,_#f8fafc_45%,_#ecfeff_100%)]">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-sky-700">Data IO</p>
            <h2 className="text-2xl font-bold text-slate-900">⇅ CSV入出力：{event?.name || eventId}</h2>
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
            <Link to={`/events/${eventId}/climbers`} className={quickLinkClass(false)}>
              👤 クライマー管理
            </Link>
            <Link to={`/events/${eventId}/scores`} className={quickLinkClass(false)}>
              📋 スコア管理
            </Link>
            <Link to={`/events/${eventId}/data-io`} className={quickLinkClass(true)}>
              ⇅ CSV入出力
            </Link>
          </div>
        </section>

        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900">クライマーCSV</h3>
          <p className="mt-2 text-sm text-slate-600">
            クライマー一覧をCSVで出力・更新できます。必須列: `name,memberNo,age,gender,categoryId`
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={exportParticipantsCsv}
              className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-800 transition hover:bg-sky-100"
            >
              クライマーCSVを出力
            </button>
            <label className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700">
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleImportParticipantsFile}
                disabled={importing}
                className="text-sm"
              />
            </label>
            <span className="text-sm text-slate-600">
              {importing ? "取り込み中..." : `現在のクライマー: ${participants.length}件`}
            </span>
          </div>
        </section>

        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900">統計CSV（順位・男女比）</h3>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <label className="text-sm text-slate-700">
              順位の対象:
              <select
                value={selectedSeasonId}
                onChange={(e) => setSelectedSeasonId(e.target.value)}
                className="ml-2 rounded-lg border border-slate-300 px-2 py-1 text-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              >
                <option value="all">総合（全シーズン）</option>
                {seasons.map((season) => (
                  <option key={season.id} value={season.id}>
                    {season.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={exportRankingCsv}
              disabled={exportingRank}
              className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {exportingRank ? "順位を計算中..." : "順位CSVを出力"}
            </button>
            <button
              type="button"
              onClick={exportGenderRatioCsv}
              className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              男女比CSVを出力
            </button>
          </div>
        </section>

        {status && <p className="mt-4 text-sm text-slate-600">{status}</p>}
      </div>
    </div>
  );
};

export default EventDataIO;

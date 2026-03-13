import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import ManagementHero from "../components/ManagementHero";
import { usePageTitle } from "../hooks/usePageTitle";
import { calculateCategoryRankings } from "../lib/rankingCsv";
import { buildRankingBackLink } from "../lib/rankingNavigation";
import { formatSeasonDate } from "../lib/seasonStatus";
import {
  inputFieldClass,
  pageBackgroundClass,
  pageContainerClass,
  sectionCardClass,
  sectionHeadingClass,
} from "../components/uiStyles";

const rankRows = (rows = []) => {
  const sorted = [...rows].sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (b.clearCount !== a.clearCount) return b.clearCount - a.clearCount;
    return String(a.name || "").localeCompare(String(b.name || ""), "ja");
  });

  let prevPoints = null;
  let prevClears = null;
  let rank = 0;

  return sorted.map((row, index) => {
    if (row.totalPoints !== prevPoints || row.clearCount !== prevClears) {
      rank = index + 1;
    }
    prevPoints = row.totalPoints;
    prevClears = row.clearCount;
    return { ...row, rank };
  });
};

const EventRanking = () => {
  const { eventId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialMode = searchParams.get("mode") || "category";
  const initialSeason = searchParams.get("season") || "all";
  const initialCategory = searchParams.get("category") || "all";
  const initialKeyword = searchParams.get("q") || "";
  const source = searchParams.get("from") || "";

  const [event, setEvent] = useState(null);
  const [seasons, setSeasons] = useState([]);
  const [categories, setCategories] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [mode, setMode] = useState(initialMode);
  const [selectedSeasonId, setSelectedSeasonId] = useState(initialSeason);
  const [selectedCategoryId, setSelectedCategoryId] = useState(initialCategory);
  const [searchKeyword, setSearchKeyword] = useState(initialKeyword);
  const [rankingsByScope, setRankingsByScope] = useState({});
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState("");
  usePageTitle(event?.name ? `Ranking: ${event.name}` : "Ranking");

  const { backTo, backLabel } = useMemo(
    () => buildRankingBackLink({ source, eventId }),
    [source, eventId]
  );

  const eventPeriodText = useMemo(() => {
    if (!event) return "-";
    return formatSeasonDate(event.startDate);
  }, [event]);

  const eventEndDateText = useMemo(() => {
    if (!event) return "-";
    return formatSeasonDate(event.endDate);
  }, [event]);

  useEffect(() => {
    let cancelled = false;

    const fetchBaseData = async () => {
      setLoading(true);
      setError("");
      try {
        const eventSnap = await getDoc(doc(db, "events", eventId));
        if (!eventSnap.exists()) {
          if (!cancelled) setError("イベントが見つかりません。");
          return;
        }

        const [seasonSnap, categorySnap, participantSnap] = await Promise.all([
          getDocs(collection(db, "events", eventId, "seasons")),
          getDocs(collection(db, "events", eventId, "categories")),
          getDocs(collection(db, "events", eventId, "participants")),
        ]);

        if (cancelled) return;

        const seasonRows = seasonSnap.docs
          .map((seasonDoc) => ({ id: seasonDoc.id, ...seasonDoc.data() }))
          .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ja"));
        const categoryRows = categorySnap.docs
          .map((categoryDoc) => ({ id: categoryDoc.id, ...categoryDoc.data() }))
          .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ja"));
        const participantRows = participantSnap.docs.map((participantDoc) => ({
          id: participantDoc.id,
          ...participantDoc.data(),
        }));

        setEvent({ id: eventSnap.id, ...eventSnap.data() });
        setSeasons(seasonRows);
        setCategories(categoryRows);
        setParticipants(participantRows);
      } catch (err) {
        console.error("ランキング画面の初期データ取得に失敗:", err);
        if (!cancelled) setError("ランキングデータの読み込みに失敗しました。");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchBaseData();

    return () => {
      cancelled = true;
    };
  }, [eventId]);

  useEffect(() => {
    let cancelled = false;

    const fetchRankings = async () => {
      if (loading || categories.length === 0) return;
      setError("");
      setCalculating(true);
      try {
        const [allRankings, seasonRankings] = await Promise.all([
          calculateCategoryRankings({
            db,
            eventId,
            seasons,
            categories,
            participants,
            selectedSeasonId: "all",
          }),
          Promise.all(
            seasons.map(async (season) => [
              season.id,
              await calculateCategoryRankings({
                db,
                eventId,
                seasons,
                categories,
                participants,
                selectedSeasonId: season.id,
              }),
            ])
          ),
        ]);

        if (cancelled) return;

        setRankingsByScope({
          all: allRankings,
          ...Object.fromEntries(seasonRankings),
        });
      } catch (err) {
        console.error("ランキング計算に失敗:", err);
        if (!cancelled) setError("ランキング計算中にエラーが発生しました。");
      } finally {
        if (!cancelled) setCalculating(false);
      }
    };

    fetchRankings();

    return () => {
      cancelled = true;
    };
  }, [loading, categories, participants, seasons, eventId]);

  useEffect(() => {
    const modeExists = mode === "category" || mode === "season" || mode === "overall";
    if (!modeExists) setMode("category");
  }, [mode]);

  useEffect(() => {
    if (seasons.length === 0) return;
    const exists = selectedSeasonId === "all" || seasons.some((season) => season.id === selectedSeasonId);
    if (!exists) setSelectedSeasonId("all");
  }, [selectedSeasonId, seasons]);

  useEffect(() => {
    if (categories.length === 0) return;
    const exists =
      selectedCategoryId === "all" || categories.some((category) => category.id === selectedCategoryId);
    if (!exists) setSelectedCategoryId("all");
  }, [selectedCategoryId, categories]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (source) params.set("from", source);
    if (mode !== "category") params.set("mode", mode);
    if (selectedSeasonId !== "all") params.set("season", selectedSeasonId);
    if (selectedCategoryId !== "all") params.set("category", selectedCategoryId);
    const normalized = searchKeyword.trim();
    if (normalized) params.set("q", normalized);
    if (params.toString() !== searchParams.toString()) {
      setSearchParams(params, { replace: true });
    }
  }, [
    source,
    mode,
    selectedSeasonId,
    selectedCategoryId,
    searchKeyword,
    searchParams,
    setSearchParams,
  ]);

  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const normalizedKeyword = searchKeyword.trim().toLowerCase();

  const matchesKeyword = useCallback((row) => {
    if (!normalizedKeyword) return true;
    return (
      String(row.name || "").toLowerCase().includes(normalizedKeyword) ||
      String(row.memberNo || "").toLowerCase().includes(normalizedKeyword)
    );
  }, [normalizedKeyword]);

  const categoryRankings = useMemo(() => rankingsByScope[selectedSeasonId] || {}, [rankingsByScope, selectedSeasonId]);

  const visibleCategories = useMemo(
    () =>
      selectedCategoryId === "all"
        ? categories
        : categories.filter((category) => category.id === selectedCategoryId),
    [categories, selectedCategoryId]
  );

  const filteredCategorySections = useMemo(
    () =>
      visibleCategories.map((category) => {
        const rows = (categoryRankings[category.id] || []).filter(matchesKeyword);
        return { category, rows };
      }),
    [visibleCategories, categoryRankings, matchesKeyword]
  );

  const allowedParticipantIds = useMemo(() => {
    if (selectedCategoryId === "all") return new Set(participants.map((participant) => participant.id));
    return new Set(
      participants
        .filter((participant) => participant.categoryId === selectedCategoryId)
        .map((participant) => participant.id)
    );
  }, [participants, selectedCategoryId]);

  const aggregateRowsFromCategoryRankings = useCallback(
    (rankings) => {
      const merged = new Map(
        participants.map((participant) => [
          participant.id,
          {
            participantId: participant.id,
            name: participant.name || "名無し",
            memberNo: participant.memberNo || "-",
            categoryId: participant.categoryId || "",
            categoryName: categoryById.get(participant.categoryId)?.name || participant.categoryId || "-",
            totalPoints: 0,
            clearCount: 0,
            latestUpdatedAt: 0,
          },
        ])
      );

      for (const rows of Object.values(rankings || {})) {
        for (const row of rows) {
          const current = merged.get(row.participantId);
          if (!current) continue;
          current.totalPoints += Number(row.totalPoints) || 0;
          current.clearCount += Number(row.clearCount) || 0;
          current.latestUpdatedAt = Math.max(current.latestUpdatedAt, Number(row.latestUpdatedAt) || 0);
        }
      }

      const targetRows = Array.from(merged.values())
        .filter((row) => allowedParticipantIds.has(row.participantId))
        .filter(matchesKeyword);
      return rankRows(targetRows);
    },
    [participants, categoryById, allowedParticipantIds, matchesKeyword]
  );

  const seasonSections = useMemo(
    () =>
      seasons.map((season) => ({
        season,
        rows: aggregateRowsFromCategoryRankings(rankingsByScope[season.id] || {}),
      })),
    [seasons, rankingsByScope, aggregateRowsFromCategoryRankings]
  );

  const overallRows = useMemo(
    () => aggregateRowsFromCategoryRankings(rankingsByScope.all || {}),
    [rankingsByScope, aggregateRowsFromCategoryRankings]
  );

  const buildDetailLink = ({ participantId, seasonId = "all", categoryId = "all" }) => {
    const params = new URLSearchParams();
    params.set("return", "ranking");
    if (source) params.set("from", source);
    if (mode !== "category") params.set("mode", mode);
    if (seasonId !== "all") params.set("season", seasonId);
    if (categoryId !== "all") params.set("category", categoryId);
    if (searchKeyword.trim()) params.set("q", searchKeyword.trim());
    const query = params.toString();
    return `/score-summary/${eventId}/participants/${participantId}${query ? `?${query}` : ""}`;
  };

  const renderRowsTable = ({ rows = [], seasonId = "all", categoryId = "all", showCategory = false }) => {
    if (rows.length === 0) {
      return (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          条件に一致するクライマーがいません。
        </div>
      );
    }

    const totalPoints = rows.reduce((sum, row) => sum + (Number(row.totalPoints) || 0), 0);
    const totalClears = rows.reduce((sum, row) => sum + (Number(row.clearCount) || 0), 0);
    const averagePoints = Math.round((totalPoints / rows.length) * 10) / 10;
    const top = rows[0];

    return (
      <div className="mt-3">
        <div className="mb-3 grid gap-3 sm:grid-cols-3">
          <article className="rounded-xl border border-slate-200 bg-white px-3 py-2">
            <p className="text-xs font-semibold tracking-wide text-slate-500">クライマー数</p>
            <p className="mt-1 text-base font-bold text-slate-900">{rows.length}名</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white px-3 py-2">
            <p className="text-xs font-semibold tracking-wide text-slate-500">TOPポイント</p>
            <p className="mt-1 text-base font-bold text-slate-900">{top ? top.totalPoints : "-"}</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white px-3 py-2">
            <p className="text-xs font-semibold tracking-wide text-slate-500">平均ポイント / 合計完登</p>
            <p className="mt-1 text-base font-bold text-slate-900">
              {averagePoints.toFixed(1)} / {totalClears}
            </p>
          </article>
        </div>

        <div className="grid gap-2 md:hidden">
          {rows.map((row) => (
            <article
              key={row.participantId}
              className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-slate-900 px-2 text-xs font-bold text-white">
                    {row.rank}
                  </p>
                  <p className="truncate text-sm font-semibold text-slate-900 mt-2">{row.name}</p>
                  <p className="mt-1 text-xs text-slate-600">会員番号: {row.memberNo || "-"}</p>
                  {showCategory ? (
                    <p className="mt-0.5 text-xs text-slate-600">カテゴリ: {row.categoryName || "-"}</p>
                  ) : null}
                </div>
                <Link
                  to={buildDetailLink({ participantId: row.participantId, seasonId, categoryId })}
                  className="inline-flex shrink-0 items-center rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                >
                  詳細
                </Link>
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-md bg-slate-50 px-2 py-2">
                  <dt className="text-slate-500">Points</dt>
                  <dd className="font-semibold text-slate-900">{row.totalPoints}</dd>
                </div>
                <div className="rounded-md bg-slate-50 px-2 py-2">
                  <dt className="text-slate-500">Clears</dt>
                  <dd className="font-semibold text-slate-900">{row.clearCount}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
          <div className="hidden overflow-x-auto md:block">
            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <table className="min-w-[760px] w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-100/80">
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600">Rank</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600">Name</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600">Member No</th>
                  {showCategory ? (
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600">Category</th>
                  ) : null}
                  <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-600">Points</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-600">Clears</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600">Detail</th>
                </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr
                      key={row.participantId}
                      className={`${
                        index % 2 === 0 ? "bg-white" : "bg-slate-50/40"
                      } transition hover:bg-slate-100/60`}
                    >
                      <td className="px-3 py-2.5">
                        <span
                          className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full text-[11px] font-bold ${
                            row.rank === 1
                              ? "bg-amber-500 text-white"
                              : row.rank === 2
                                ? "bg-slate-300 text-slate-700"
                                : row.rank === 3
                                  ? "bg-amber-700/90 text-white"
                                  : "bg-slate-200 text-slate-700"
                          }`}
                        >
                          {row.rank}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-slate-900 font-medium">{row.name}</td>
                      <td className="px-3 py-2.5 text-slate-700">{row.memberNo || "-"}</td>
                      {showCategory ? (
                        <td className="px-3 py-2.5 text-slate-700">{row.categoryName || "-"}</td>
                      ) : null}
                      <td className="px-3 py-2.5 text-right font-semibold text-slate-900">{row.totalPoints}</td>
                      <td className="px-3 py-2.5 text-right text-slate-700">{row.clearCount}</td>
                      <td className="px-3 py-2.5">
                        <Link
                          to={buildDetailLink({ participantId: row.participantId, seasonId, categoryId })}
                          className="inline-flex items-center rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-white"
                        >
                          詳細
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className={pageBackgroundClass}>
        <div className={pageContainerClass}>
          <p className="text-sm text-slate-600">ランキングデータを読み込んでいます...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={pageBackgroundClass}>
        <div className={pageContainerClass}>
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={pageBackgroundClass}>
      <div className={pageContainerClass}>
        <ManagementHero
          title="Ranking"
          description="カテゴリ別・シーズン別・総合のランキングを確認します。"
          meta={`Event: ${event?.name || eventId}`}
          backTo={backTo}
          backLabel={backLabel}
          surface={false}
        />

        <section className="mt-4">
          <h2 className={sectionHeadingClass}>📚Summary</h2>
          <div className={sectionCardClass}>
            <div className="grid gap-3 md:grid-cols-2">
              <article className="rounded-xl border border-slate-200 bg-slate-50 p-4 md:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">イベント名</p>
                <p className="mt-1 text-lg font-bold text-slate-900">{event?.name || "-"}</p>
              </article>
              <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">開始日</p>
                <p className="mt-1 text-lg font-bold text-slate-900">{eventPeriodText}</p>
              </article>
              <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">終了日</p>
                <p className="mt-1 text-lg font-bold text-slate-900">{eventEndDateText}</p>
              </article>
            </div>
          </div>
        </section>

        <section className="mt-4">
          <div className={sectionCardClass}>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1">
                <button
                  type="button"
                  onClick={() => setMode("category")}
                  className={`rounded-full px-3 py-1 text-sm font-semibold transition ${
                    mode === "category" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  カテゴリ別
                </button>
                <button
                  type="button"
                  onClick={() => setMode("season")}
                  className={`rounded-full px-3 py-1 text-sm font-semibold transition ${
                    mode === "season" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  シーズン別
                </button>
                <button
                  type="button"
                  onClick={() => setMode("overall")}
                  className={`rounded-full px-3 py-1 text-sm font-semibold transition ${
                    mode === "overall" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  総合
                </button>
              </div>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <label className="text-sm text-slate-700">
                シーズン
                <select
                  value={selectedSeasonId}
                  onChange={(e) => setSelectedSeasonId(e.target.value)}
                  disabled={mode !== "category"}
                  className={`${inputFieldClass} mt-1 w-full ${mode !== "category" ? "opacity-60" : ""}`}
                >
                  <option value="all">総合（全シーズン）</option>
                  {seasons.map((season) => (
                    <option key={season.id} value={season.id}>
                      {season.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-slate-700">
                カテゴリ
                <select
                  value={selectedCategoryId}
                  onChange={(e) => setSelectedCategoryId(e.target.value)}
                  className={`${inputFieldClass} mt-1 w-full`}
                >
                  <option value="all">すべて</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-slate-700">
                名前/会員番号で検索
                <input
                  type="text"
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  placeholder="例: 山田 / M-1001"
                  className={`${inputFieldClass} mt-1 w-full`}
                />
              </label>
            </div>
            {calculating ? <p className="mt-3 text-sm text-slate-600">ランキングを計算中...</p> : null}
          </div>
        </section>

        {mode === "category" ? (
          <section className="mt-5">
            <h2 className={sectionHeadingClass}>🧩 Category Ranking</h2>
            <div className="grid gap-4">
              {filteredCategorySections.map(({ category, rows }) => (
                <article key={category.id} className={sectionCardClass}>
                  <h3 className="text-lg font-bold text-slate-900">{category.name}</h3>
                  {renderRowsTable({
                    rows,
                    seasonId: selectedSeasonId,
                    categoryId: category.id,
                  })}
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {mode === "season" ? (
          <section className="mt-5">
            <h2 className={sectionHeadingClass}>🗂️ Season Ranking</h2>
            <div className="grid gap-4">
              {seasonSections.map(({ season, rows }) => (
                <article key={season.id} className={sectionCardClass}>
                  <h3 className="text-lg font-bold text-slate-900">{season.name}</h3>
                  {renderRowsTable({
                    rows,
                    seasonId: season.id,
                    categoryId: selectedCategoryId,
                    showCategory: true,
                  })}
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {mode === "overall" ? (
          <section className="mt-5">
            <h2 className={sectionHeadingClass}>🏆 Overall Ranking</h2>
            <article className={sectionCardClass}>
              {renderRowsTable({
                rows: overallRows,
                showCategory: true,
              })}
            </article>
          </section>
        ) : null}
      </div>
    </div>
  );
};

export default EventRanking;

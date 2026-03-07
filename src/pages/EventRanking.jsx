import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import ManagementHero from "../components/ManagementHero";
import { usePageTitle } from "../hooks/usePageTitle";
import { calculateCategoryRankings } from "../lib/rankingCsv";
import {
  inputFieldClass,
  pageBackgroundClass,
  pageContainerClass,
  sectionCardClass,
  sectionHeadingClass,
  subtleButtonClass,
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

const buildBackLink = ({ source, eventId }) => {
  if (source === "portal") {
    return {
      backTo: `/score-summary/${eventId}`,
      backLabel: "↑ Back to Portal",
    };
  }
  if (source === "owner") {
    return {
      backTo: `/events/${eventId}/result`,
      backLabel: "↑ Back to Result",
    };
  }
  return {
    backTo: "/",
    backLabel: "↑ Back to TOP",
  };
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

  const { backTo, backLabel } = useMemo(() => buildBackLink({ source, eventId }), [source, eventId]);

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
    if (seasonId !== "all") params.set("season", seasonId);
    if (categoryId !== "all") params.set("category", categoryId);
    if (searchKeyword.trim()) params.set("q", searchKeyword.trim());
    const query = params.toString();
    return `/score-summary/${eventId}/participants/${participantId}${query ? `?${query}` : ""}`;
  };

  const renderRowsTable = ({ rows = [], seasonId = "all", categoryId = "all", showCategory = false }) => {
    if (rows.length === 0) {
      return <p className="mt-3 text-sm text-slate-600">条件に一致するクライマーがいません。</p>;
    }

    return (
      <div className="mt-3 overflow-x-auto">
        <table className="min-w-[760px] w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border-b border-slate-200 py-2 text-left">Rank</th>
              <th className="border-b border-slate-200 py-2 text-left">Name</th>
              <th className="border-b border-slate-200 py-2 text-left">Member No</th>
              {showCategory ? <th className="border-b border-slate-200 py-2 text-left">Category</th> : null}
              <th className="border-b border-slate-200 py-2 text-right">Points</th>
              <th className="border-b border-slate-200 py-2 text-right">Clears</th>
              <th className="border-b border-slate-200 py-2 text-left">Detail</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.participantId}>
                <td className="py-2">{row.rank}</td>
                <td className="py-2 text-slate-900">{row.name}</td>
                <td className="py-2 text-slate-700">{row.memberNo || "-"}</td>
                {showCategory ? <td className="py-2 text-slate-700">{row.categoryName || "-"}</td> : null}
                <td className="py-2 text-right font-semibold text-slate-900">{row.totalPoints}</td>
                <td className="py-2 text-right text-slate-700">{row.clearCount}</td>
                <td className="py-2">
                  <Link
                    to={buildDetailLink({ participantId: row.participantId, seasonId, categoryId })}
                    className="inline-flex items-center rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                  >
                    詳細を見る
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
        >
          <Link to={`/score-summary/${eventId}`} className={subtleButtonClass}>
            Open Public Ranking
          </Link>
        </ManagementHero>

        <section className="mt-4">
          <h2 className={sectionHeadingClass}>Filters</h2>
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
            <h2 className={sectionHeadingClass}>Category Ranking</h2>
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
            <h2 className={sectionHeadingClass}>Season Ranking</h2>
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
            <h2 className={sectionHeadingClass}>Overall Ranking</h2>
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

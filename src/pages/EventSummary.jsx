import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { db } from "../firebase";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { usePageTitle } from "../hooks/usePageTitle";
import {
  buildAssignedTasks,
  buildTaskByScoreKey,
  fetchCategoryAssignments,
  fetchSeasonTasks,
} from "../lib/taskAssignments";

const getTimestampMs = (value) => {
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

const EventSummary = () => {
  const { eventId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSeasonId = searchParams.get("season") || "all";
  const initialCategoryId = searchParams.get("category") || "all";
  const initialKeyword = searchParams.get("q") || "";
  const initialParticipantId = searchParams.get("pid") || "";
  const initialSelfOnly =
    searchParams.get("self") === "1" || searchParams.get("view") === "self";
  const [event, setEvent] = useState(null);
  const [seasons, setSeasons] = useState([]);
  const [categories, setCategories] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState(initialSeasonId);
  const [selectedCategoryId, setSelectedCategoryId] = useState(initialCategoryId);
  const [selectedParticipantId, setSelectedParticipantId] = useState(initialParticipantId);
  const [showOnlySelected, setShowOnlySelected] = useState(initialSelfOnly);
  const [searchKeyword, setSearchKeyword] = useState(initialKeyword);
  const [rankings, setRankings] = useState({});
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState("");
  usePageTitle(event?.name ? `ランキング: ${event.name}` : "イベントランキング");

  useEffect(() => {
    let cancelled = false;

    const fetchBaseData = async () => {
      setLoading(true);
      setError("");
      try {
        const eventDocSnap = await getDoc(doc(db, "events", eventId));
        if (!eventDocSnap.exists()) {
          if (!cancelled) setError("指定されたイベントが見つかりません。");
          return;
        }

        const [seasonSnap, categorySnap, participantSnap] = await Promise.all([
          getDocs(collection(db, "events", eventId, "seasons")),
          getDocs(collection(db, "events", eventId, "categories")),
          getDocs(collection(db, "events", eventId, "participants")),
        ]);

        if (cancelled) return;

        setEvent({ id: eventDocSnap.id, ...eventDocSnap.data() });
        setSeasons(
          seasonSnap.docs
            .map((s) => ({ id: s.id, ...s.data() }))
            .sort((a, b) => a.name.localeCompare(b.name, "ja"))
        );
        setCategories(
          categorySnap.docs
            .map((c) => ({ id: c.id, ...c.data() }))
            .sort((a, b) => a.name.localeCompare(b.name, "ja"))
        );
        setParticipants(participantSnap.docs.map((p) => ({ id: p.id, ...p.data() })));
      } catch (err) {
        console.error("集計用データの取得に失敗:", err);
        if (!cancelled) setError("集計データの読み込み中にエラーが発生しました。");
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

    const calculateRankings = async () => {
      if (loading || !event || categories.length === 0) return;
      setError("");

      const targetSeasonIds =
        selectedSeasonId === "all"
          ? seasons.map((season) => season.id)
          : [selectedSeasonId].filter(Boolean);

      if (targetSeasonIds.length === 0) {
        setRankings(buildRankings(buildInitialCategoryMap(categories, participants)));
        return;
      }

      setCalculating(true);
      try {
        const categoryMap = buildInitialCategoryMap(categories, participants);
        const participantById = new Map(participants.map((p) => [p.id, p]));

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
                collection(
                  db,
                  "events",
                  eventId,
                  "seasons",
                  seasonId,
                  "categories",
                  category.id,
                  "participants"
                )
              ),
            ]);

            return {
              categoryId: category.id,
              assignedTasks: buildAssignedTasks(
                seasonTasksBySeasonId.get(seasonId) || [],
                assignments
              ),
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

            row.latestUpdatedAt = Math.max(row.latestUpdatedAt, getTimestampMs(data.updatedAt));
          }
        }

        if (!cancelled) {
          setRankings(buildRankings(categoryMap));
        }
      } catch (err) {
        console.error("ランキング計算に失敗:", err);
        if (!cancelled) setError("ランキング計算中にエラーが発生しました。");
      } finally {
        if (!cancelled) setCalculating(false);
      }
    };

    calculateRankings();

    return () => {
      cancelled = true;
    };
  }, [loading, event, categories, participants, seasons, selectedSeasonId, eventId]);

  const visibleCategories = useMemo(
    () =>
      selectedCategoryId === "all"
        ? categories
        : categories.filter((category) => category.id === selectedCategoryId),
    [categories, selectedCategoryId]
  );

  const participantsForQuickSelect = useMemo(() => {
    const filtered =
      selectedCategoryId === "all"
        ? participants
        : participants.filter((participant) => participant.categoryId === selectedCategoryId);
    return [...filtered].sort((a, b) => (a.name || "").localeCompare(b.name || "", "ja"));
  }, [participants, selectedCategoryId]);

  useEffect(() => {
    if (!selectedParticipantId) return;
    if (participantsForQuickSelect.length === 0) return;
    const exists = participantsForQuickSelect.some(
      (participant) => participant.id === selectedParticipantId
    );
    if (!exists) setSelectedParticipantId("");
  }, [participantsForQuickSelect, selectedParticipantId]);

  useEffect(() => {
    if (showOnlySelected && !selectedParticipantId) {
      setShowOnlySelected(false);
    }
  }, [showOnlySelected, selectedParticipantId]);

  useEffect(() => {
    if (seasons.length === 0) return;
    if (selectedSeasonId !== "all" && !seasons.some((season) => season.id === selectedSeasonId)) {
      setSelectedSeasonId("all");
    }
  }, [seasons, selectedSeasonId]);

  useEffect(() => {
    if (categories.length === 0) return;
    if (
      selectedCategoryId !== "all" &&
      !categories.some((category) => category.id === selectedCategoryId)
    ) {
      setSelectedCategoryId("all");
    }
  }, [categories, selectedCategoryId]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedSeasonId !== "all") params.set("season", selectedSeasonId);
    if (selectedCategoryId !== "all") params.set("category", selectedCategoryId);
    const normalized = searchKeyword.trim();
    if (normalized) params.set("q", normalized);
    if (selectedParticipantId) params.set("pid", selectedParticipantId);
    if (showOnlySelected && selectedParticipantId) params.set("self", "1");
    if (params.toString() !== searchParams.toString()) {
      setSearchParams(params, { replace: true });
    }
  }, [
    selectedSeasonId,
    selectedCategoryId,
    searchKeyword,
    selectedParticipantId,
    showOnlySelected,
    searchParams,
    setSearchParams,
  ]);

  const normalizedKeyword = searchKeyword.trim().toLowerCase();
  const hasSearch = normalizedKeyword.length > 0;
  const selectedParticipant = participants.find((participant) => participant.id === selectedParticipantId) || null;

  const selectedParticipantRows = useMemo(() => {
    if (!selectedParticipantId) return [];
    const rows = [];
    for (const category of visibleCategories) {
      const row = (rankings[category.id] || []).find(
        (item) => item.participantId === selectedParticipantId
      );
      if (row) {
        rows.push({
          ...row,
          categoryName: category.name,
        });
      }
    }
    return rows;
  }, [selectedParticipantId, visibleCategories, rankings]);

  const buildDetailLink = (participantId) => {
    const params = new URLSearchParams();
    if (selectedSeasonId !== "all") params.set("season", selectedSeasonId);
    if (selectedCategoryId !== "all") params.set("category", selectedCategoryId);
    if (searchKeyword.trim()) params.set("q", searchKeyword.trim());
    if (selectedParticipantId) params.set("pid", selectedParticipantId);
    if (showOnlySelected && selectedParticipantId) params.set("self", "1");
    const query = params.toString();
    return `/score-summary/${eventId}/participants/${participantId}${query ? `?${query}` : ""}`;
  };

  const resetQuickFilters = () => {
    setSelectedCategoryId("all");
    setSelectedParticipantId("");
    setShowOnlySelected(false);
    setSearchKeyword("");
  };
  const matchedCount = visibleCategories.reduce((count, category) => {
    const rows = rankings[category.id] || [];
    return (
      count +
      rows.filter((row) => {
        const name = (row.name || "").toLowerCase();
        const memberNo = (row.memberNo || "").toLowerCase();
        return name.includes(normalizedKeyword) || memberNo.includes(normalizedKeyword);
      }).length
    );
  }, 0);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <p className="text-sm text-slate-600">集計情報を読み込んでいます...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
        <div className="mt-8">
          <Link
            to="/score-summary"
            className="inline-flex items-center rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            ← イベント選択に戻る
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#dbeafe_0%,_#f8fafc_45%,_#ecfeff_100%)]">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold text-slate-900">{event?.name} - 集計結果</h2>

        <div className="mt-4 flex flex-wrap gap-3">
          <label className="text-sm text-slate-700">
            表示対象:
            <select
              value={selectedSeasonId}
              onChange={(e) => setSelectedSeasonId(e.target.value)}
              className="ml-2 rounded-lg border border-slate-300 px-2 py-1 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            >
              <option value="all">総合（全シーズン）</option>
              {seasons.map((season) => (
                <option key={season.id} value={season.id}>
                  {season.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-3">
          <label className="text-sm text-slate-700">
            名前/会員番号で検索:
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder="例: 山田 / M-1001"
              className="ml-2 rounded-lg border border-slate-300 px-2 py-1 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            />
          </label>
          {hasSearch && <span className="ml-3 text-sm text-slate-600">該当 {matchedCount} 件</span>}
        </div>
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-700">自分のスコアをすぐ確認</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label className="text-sm text-slate-700">
              カテゴリ:
              <select
                value={selectedCategoryId}
                onChange={(e) => setSelectedCategoryId(e.target.value)}
                className="ml-2 rounded-lg border border-slate-300 px-2 py-1 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
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
              クライマー:
              <select
                value={selectedParticipantId}
                onChange={(e) => setSelectedParticipantId(e.target.value)}
                className="ml-2 rounded-lg border border-slate-300 px-2 py-1 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              >
                <option value="">-- 選択 --</option>
                {participantsForQuickSelect.map((participant) => (
                  <option key={participant.id} value={participant.id}>
                    {participant.name} ({participant.memberNo || "-"})
                  </option>
                ))}
              </select>
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={showOnlySelected}
                onChange={(e) => setShowOnlySelected(e.target.checked)}
                disabled={!selectedParticipantId}
                className="size-4 rounded border-slate-300"
              />
              自分だけ表示
            </label>
            <button
              type="button"
              onClick={resetQuickFilters}
              className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              フィルターをリセット
            </button>
            {selectedParticipantId && (
              <Link
                to={buildDetailLink(selectedParticipantId)}
                className="inline-flex items-center rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-800 transition hover:bg-sky-100"
              >
                詳細へ移動
              </Link>
            )}
          </div>
        </div>
        {selectedParticipant && (
          <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">
              選択中: {selectedParticipant.name} ({selectedParticipant.memberNo || "-"})
            </h3>
            {selectedParticipantRows.length === 0 ? (
              <p className="mt-2 text-sm text-slate-600">この条件では順位データがありません。</p>
            ) : (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                {selectedParticipantRows.map((row) => (
                  <li key={`${row.categoryName}-${row.participantId}`}>
                    {row.categoryName}: {row.rank}位 / 得点 {row.totalPoints} / 完登 {row.clearCount}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {calculating && <p className="mt-4 text-sm text-slate-600">ランキングを計算中...</p>}

        {visibleCategories.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">カテゴリが登録されていません。</p>
        ) : showOnlySelected && !selectedParticipantId ? (
          <p className="mt-4 text-sm text-slate-600">クライマーを選択すると、自分の順位とスコアを表示します。</p>
        ) : (
          visibleCategories.map((category) => {
            const allRows = rankings[category.id] || [];
            const rows = allRows.filter((row) => {
              if (
                showOnlySelected &&
                selectedParticipantId &&
                row.participantId !== selectedParticipantId
              ) {
                return false;
              }
              if (!hasSearch) return true;
              const name = (row.name || "").toLowerCase();
              const memberNo = (row.memberNo || "").toLowerCase();
              return name.includes(normalizedKeyword) || memberNo.includes(normalizedKeyword);
            });

            return (
              <section key={category.id} className="mt-6">
                <h3 className="text-lg font-bold text-slate-900">カテゴリ: {category.name}</h3>
                {rows.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-600">{hasSearch ? "検索条件に一致するクライマーがいません。" : "クライマーデータがありません。"}</p>
                ) : (
                  <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                    <table className="min-w-[650px] w-full border-collapse text-sm">
                      <thead>
                        <tr>
                          <th className="border-b border-slate-200 py-2 text-left">順位</th>
                          <th className="border-b border-slate-200 py-2 text-left">名前</th>
                          <th className="border-b border-slate-200 py-2 text-left">会員番号</th>
                          <th className="border-b border-slate-200 py-2 text-right">得点</th>
                          <th className="border-b border-slate-200 py-2 text-right">完登数</th>
                          <th className="border-b border-slate-200 py-2 text-left">詳細</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row) => (
                          <tr key={row.participantId}>
                            <td className="py-2">{row.rank}</td>
                            <td className="py-2">
                              {row.name}
                              {selectedParticipantId === row.participantId && (
                                <strong className="ml-2 text-xs text-slate-500">(選択中)</strong>
                              )}
                            </td>
                            <td className="py-2">{row.memberNo}</td>
                            <td className="py-2 text-right">{row.totalPoints}</td>
                            <td className="py-2 text-right">{row.clearCount}</td>
                            <td className="py-2">
                              <Link
                                to={buildDetailLink(row.participantId)}
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
                )}
              </section>
            );
          })
        )}

        <div className="mt-8">
          <Link
            to="/score-summary"
            className="inline-flex items-center rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            ← イベント選択に戻る
          </Link>
        </div>
      </div>
    </div>
  );
};

export default EventSummary;

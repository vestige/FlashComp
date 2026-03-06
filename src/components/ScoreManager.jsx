import { useCallback, useEffect, useMemo, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { db } from "../firebase";
import { fetchAssignedTasksForCategory, getScoreValueByTask } from "../lib/taskAssignments";
import { getSeasonStatus } from "../lib/seasonStatus";
import { inputFieldClass } from "./uiStyles";

const SCORE_SEASON_PARAM = "scoreSeason";
const SCORE_CATEGORY_PARAM = "scoreCategory";

const toDate = (value) => {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (typeof value.seconds === "number") return new Date(value.seconds * 1000);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toTimestamp = (value) => {
  const date = toDate(value);
  return date ? date.getTime() : null;
};

const sortByRegistrationOrder = (rows) => {
  return rows
    .map((row, index) => ({ ...row, __sortIndex: index }))
    .sort((a, b) => {
      const aAt = toTimestamp(a.createdAt);
      const bAt = toTimestamp(b.createdAt);
      if (aAt !== null && bAt !== null) return aAt - bAt;
      if (aAt !== null) return -1;
      if (bAt !== null) return 1;
      return a.__sortIndex - b.__sortIndex;
    })
    .map((row) => {
      const next = { ...row };
      delete next.__sortIndex;
      return next;
    });
};

const ScoreIcon = ({ className = "h-4 w-4" }) => (
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
    <path d="M4 12h16" />
    <path d="M8 12l4 4 4-4" />
  </svg>
);

const ScoreManager = ({ eventId }) => {
  const [seasons, setSeasons] = useState([]);
  const [categories, setCategories] = useState([]);
  const [participants, setParticipants] = useState([]);
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const selectedSeason = searchParams.get(SCORE_SEASON_PARAM) || "";
  const selectedCategory = searchParams.get(SCORE_CATEGORY_PARAM) || "";

  const activeSeasonId = useMemo(() => {
    const now = new Date();
    const nowSeason = seasons.find((season) => getSeasonStatus(season, now) === "live");
    return nowSeason?.id || (seasons[0] ? seasons[0].id : "");
  }, [seasons]);

  const updateScoreSearchParams = useCallback(
    ({ seasonId = selectedSeason, categoryId = selectedCategory }) => {
      const next = new URLSearchParams(searchParams);
      if (seasonId) next.set(SCORE_SEASON_PARAM, seasonId);
      else next.delete(SCORE_SEASON_PARAM);

      if (categoryId) next.set(SCORE_CATEGORY_PARAM, categoryId);
      else next.delete(SCORE_CATEGORY_PARAM);

      const hasDiff =
        next.get(SCORE_SEASON_PARAM) !== searchParams.get(SCORE_SEASON_PARAM) ||
        next.get(SCORE_CATEGORY_PARAM) !== searchParams.get(SCORE_CATEGORY_PARAM);
      if (!hasDiff) return;
      setSearchParams(next, { replace: true });
    },
    [searchParams, selectedSeason, selectedCategory, setSearchParams]
  );

  useEffect(() => {
    const fetchSeasons = async () => {
      try {
        const snapshot = await getDocs(collection(db, "events", eventId, "seasons"));
        const rows = snapshot.docs.map((doc) => ({
          ...doc.data(),
          id: doc.id,
        }));
        setSeasons(sortByRegistrationOrder(rows));
      } catch (err) {
        console.error("シーズンの取得に失敗:", err);
      }
    };

    const fetchCategories = async () => {
      try {
        const snapshot = await getDocs(collection(db, "events", eventId, "categories"));
        const rows = snapshot.docs.map((doc) => ({
          ...doc.data(),
          id: doc.id,
        }));
        setCategories(sortByRegistrationOrder(rows));
      } catch (err) {
        console.error("カテゴリの取得に失敗:", err);
      }
    };

    fetchSeasons();
    fetchCategories();
  }, [eventId]);

  useEffect(() => {
    const hasSelectedSeason = seasons.some((season) => season.id === selectedSeason);
    const hasSelectedCategory = categories.some((category) => category.id === selectedCategory);

    const nextSeason = selectedSeason || (hasSelectedSeason ? selectedSeason : location.state?.seasonId || activeSeasonId);
    const nextCategory = selectedCategory || (hasSelectedCategory ? selectedCategory : location.state?.categoryId || "");

    if (!nextSeason && !nextCategory) return;

    updateScoreSearchParams({ seasonId: nextSeason, categoryId: nextCategory });
  }, [
    seasons,
    categories,
    selectedSeason,
    selectedCategory,
    location.state,
    activeSeasonId,
    updateScoreSearchParams,
  ]);

  const fetchParticipants = useCallback(async () => {
    if (!selectedCategory || !selectedSeason) {
      setParticipants([]);
      return;
    }

    try {
      const [participantsSnapshot, scoreSnapshot, assignedTasks] = await Promise.all([
        getDocs(
          query(
            collection(db, "events", eventId, "participants"),
            where("categoryId", "==", selectedCategory)
          )
        ),
        getDocs(
          collection(
            db,
            "events",
            eventId,
            "seasons",
            selectedSeason,
            "categories",
            selectedCategory,
            "participants"
          )
        ),
        fetchAssignedTasksForCategory({
          eventId,
          seasonId: selectedSeason,
          categoryId: selectedCategory,
        }),
      ]);

      const solvedCountByParticipant = new Map();
      for (const scoreDoc of scoreSnapshot.docs) {
        const data = scoreDoc.data();
        const scores = data.scores || {};
        const solvedCount = assignedTasks.reduce((count, task) => {
          return count + (getScoreValueByTask(scores, task) ? 1 : 0);
        }, 0);
        solvedCountByParticipant.set(scoreDoc.id, solvedCount);
      }

      const participantRows = participantsSnapshot.docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        .map((participant) => ({
          ...participant,
          solvedCount: solvedCountByParticipant.get(participant.id) || 0,
        }))
        .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ja"));

      setParticipants(participantRows);
    } catch (err) {
      console.error("クライマーの取得に失敗:", err);
      setParticipants([]);
    }
  }, [eventId, selectedCategory, selectedSeason]);

  useEffect(() => {
    fetchParticipants();
  }, [fetchParticipants]);

  return (
    <div>
      <div className="mb-4">
        <Link
          to={`/score-summary/${eventId}`}
          className="inline-flex items-center rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
        >
          公開ランキング
        </Link>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm font-medium text-slate-700">
          シーズン選択:
          <select
            value={selectedSeason}
            onChange={(e) => updateScoreSearchParams({ seasonId: e.target.value })}
            className={`mt-1 block w-full ${inputFieldClass}`}
          >
            <option value="">-- 選択してください --</option>
            {seasons.map((season) => (
              <option key={season.id} value={season.id}>
                {season.name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-medium text-slate-700">
          カテゴリ選択:
          <select
            value={selectedCategory}
            onChange={(e) => updateScoreSearchParams({ categoryId: e.target.value })}
            className={`mt-1 block w-full ${inputFieldClass}`}
          >
            <option value="">-- 選択してください --</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {selectedSeason && selectedCategory ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border-b border-slate-200 py-2 text-left text-xs font-bold tracking-wider text-slate-500">Name</th>
                <th className="border-b border-slate-200 py-2 text-left text-xs font-bold tracking-wider text-slate-500">Member No.</th>
                <th className="border-b border-slate-200 py-2 text-center text-xs font-bold tracking-wider text-slate-500">Solved</th>
                <th className="border-b border-slate-200 py-2 text-center text-xs font-bold tracking-wider text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {participants.map((participant, index) => (
                <tr
                  key={participant.id}
                  className={`${index % 2 === 0 ? "bg-white" : "bg-slate-50"} hover:bg-sky-50 transition-colors`}
                >
                  <td className="py-3 text-slate-900">{participant.name || "-"}</td>
                  <td className="py-3 text-slate-700">{participant.memberNo || "-"}</td>
                  <td className="py-3 text-center text-slate-700">{participant.solvedCount || 0}</td>
                  <td className="py-3 text-center">
                    <Link
                      to={`/events/${eventId}/scoreinput/${selectedSeason}/${selectedCategory}/${participant.id}`}
                      state={{ seasonId: selectedSeason, categoryId: selectedCategory }}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-sky-200 bg-sky-50 text-sky-700 transition hover:bg-sky-100"
                      aria-label={`採点画面へ: ${participant.name || "クライマー"}`}
                    >
                      <ScoreIcon />
                      <span className="sr-only">採点へ</span>
                    </Link>
                  </td>
                </tr>
              ))}
              {participants.length === 0 ? (
                <tr>
                  <td className="py-4 text-sm text-slate-500" colSpan={4}>
                    条件に一致するクライマーがいません。
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
};

export default ScoreManager;

// src/components/ScoreManager.jsx
import { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
//import { Link } from "react-router-dom";
import { Link, useLocation } from "react-router-dom";

const ScoreManager = ({ eventId }) => {
  const [seasons, setSeasons] = useState([]);
  const [categories, setCategories] = useState([]);
  const [participants, setParticipants] = useState([]);
  //const [selectedSeason, setSelectedSeason] = useState("");
  //const [selectedCategory, setSelectedCategory] = useState("");
  const location = useLocation();

  const [selectedSeason, setSelectedSeason] = useState(location.state?.seasonId || "");
  const [selectedCategory, setSelectedCategory] = useState(location.state?.categoryId || "");

  useEffect(() => {
    const fetchSeasons = async () => {
      try {
        const snapshot = await getDocs(collection(db, "events", eventId, "seasons"));
        const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setSeasons(data);
      } catch (err) {
        console.error("シーズンの取得に失敗:", err);
      }
    };

    const fetchCategories = async () => {
      try {
        const snapshot = await getDocs(collection(db, "events", eventId, "categories"));
        const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setCategories(data);
      } catch (err) {
        console.error("カテゴリの取得に失敗:", err);
      }
    };

    fetchSeasons();
    fetchCategories();
  }, [eventId]);

  useEffect(() => {
    const fetchParticipants = async () => {
      if (!selectedCategory) {
        setParticipants([]);
        return;
      }
      try {
        const participantsQuery = query(
          collection(db, "events", eventId, "participants"),
          where("categoryId", "==", selectedCategory)
        );
        const snapshot = await getDocs(participantsQuery);
        const filtered = snapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .sort((a, b) => (a.name || "").localeCompare(b.name || "", "ja"));
        setParticipants(filtered);
      } catch (err) {
        console.error("クライマーの取得に失敗:", err);
      }
    };

    fetchParticipants();
  }, [eventId, selectedCategory]);

  useEffect(() => {
      if (location.state?.seasonId) {
         setSelectedSeason(location.state.seasonId);
      }
      if (location.state?.categoryId) {
         setSelectedCategory(location.state.categoryId);
      }
   }, [location.state]);

  return (
    <div className="p-4 sm:p-5">
      <h2 className="text-2xl font-bold text-slate-900">📋 スコア採点</h2>
      <div className="mt-3 mb-4 flex flex-wrap gap-2">
        <Link
          to={`/score-summary/${eventId}`}
          className="inline-flex items-center rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
        >
          公開ランキング
        </Link>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-slate-700">
          シーズン選択:
          <select
            value={selectedSeason}
            onChange={(e) => setSelectedSeason(e.target.value)}
            className="mt-1 block w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
          >
            <option value="">-- 選択してください --</option>
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-slate-700">
          カテゴリ選択:
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="mt-1 block w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
          >
            <option value="">-- 選択してください --</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {selectedSeason && selectedCategory && (
        <ul className="space-y-2">
          {participants.map((p) => (
            <li key={p.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-800">
              <span className="font-medium">{p.name}</span>
              <Link
                to={`/events/${eventId}/scoreinput/${selectedSeason}/${selectedCategory}/${p.id}`}
                className="ml-3 inline-flex items-center rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-800 transition hover:bg-sky-100"
              >
                📝 採点へ
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ScoreManager;

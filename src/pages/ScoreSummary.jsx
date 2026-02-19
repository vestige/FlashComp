import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { usePageTitle } from "../hooks/usePageTitle";

const toDateText = (value) => {
  if (!value) return "-";
  if (typeof value.toDate === "function") return value.toDate().toLocaleDateString();
  if (typeof value.seconds === "number") return new Date(value.seconds * 1000).toLocaleDateString();
  return String(value);
};

const toTimestampMs = (value) => {
  if (!value) return 0;
  if (typeof value.toDate === "function") return value.toDate().getTime();
  if (typeof value.seconds === "number") return value.seconds * 1000;
  return 0;
};

const getEventStatus = (event, nowMs) => {
  const startMs = toTimestampMs(event.startDate);
  const endMs = toTimestampMs(event.endDate);
  if (startMs && endMs && startMs <= nowMs && nowMs <= endMs) return "ongoing";
  if (startMs && nowMs < startMs) return "upcoming";
  return "ended";
};

const statusLabelMap = {
  ongoing: "開催中",
  upcoming: "開催予定",
  ended: "終了",
};
const statusOrderMap = {
  ongoing: 0,
  upcoming: 1,
  ended: 2,
};

const compareEventsForDisplay = (a, b, nowMs) => {
  const aStatus = getEventStatus(a, nowMs);
  const bStatus = getEventStatus(b, nowMs);
  const aOrder = statusOrderMap[aStatus] ?? 99;
  const bOrder = statusOrderMap[bStatus] ?? 99;
  if (aOrder !== bOrder) return aOrder - bOrder;

  const aStartMs = toTimestampMs(a.startDate);
  const bStartMs = toTimestampMs(b.startDate);
  const aEndMs = toTimestampMs(a.endDate);
  const bEndMs = toTimestampMs(b.endDate);

  if (aStatus === "ongoing") {
    if (aEndMs !== bEndMs) return aEndMs - bEndMs;
    if (aStartMs !== bStartMs) return bStartMs - aStartMs;
    return (a.name || "").localeCompare(b.name || "", "ja");
  }

  if (aStatus === "upcoming") {
    if (aStartMs !== bStartMs) return aStartMs - bStartMs;
    if (aEndMs !== bEndMs) return aEndMs - bEndMs;
    return (a.name || "").localeCompare(b.name || "", "ja");
  }

  if (aEndMs !== bEndMs) return bEndMs - aEndMs;
  if (aStartMs !== bStartMs) return bStartMs - aStartMs;
  return (a.name || "").localeCompare(b.name || "", "ja");
};

const ScoreSummary = () => {
  usePageTitle("クライマー向けイベント一覧");

  const [searchParams, setSearchParams] = useSearchParams();
  const initialKeyword = searchParams.get("q") || "";
  const initialStatus = searchParams.get("status") || "all";
  const [events, setEvents] = useState([]);
  const [keyword, setKeyword] = useState(initialKeyword);
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setError("");
        const snapshot = await getDocs(collection(db, "events"));
        const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setEvents(data);
      } catch (err) {
        console.error("イベントの取得に失敗:", err);
        setError("イベントの読み込みに失敗しました。");
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    const normalizedKeyword = keyword.trim();
    if (normalizedKeyword) params.set("q", normalizedKeyword);
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (params.toString() !== searchParams.toString()) {
      setSearchParams(params, { replace: true });
    }
  }, [keyword, statusFilter, searchParams, setSearchParams]);

  const filteredEvents = useMemo(() => {
    const nowMs = Date.now();
    const normalizedKeyword = keyword.trim().toLowerCase();

    return [...events]
      .sort((a, b) => compareEventsForDisplay(a, b, nowMs))
      .filter((event) => {
        const eventName = (event.name || "").toLowerCase();
        const eventStatus = getEventStatus(event, nowMs);
        const matchesKeyword = normalizedKeyword
          ? eventName.includes(normalizedKeyword)
          : true;
        const matchesStatus = statusFilter === "all" ? true : eventStatus === statusFilter;
        return matchesKeyword && matchesStatus;
      });
  }, [events, keyword, statusFilter]);

  const resetFilters = () => {
    setKeyword("");
    setStatusFilter("all");
  };

  if (loading) {
    return <p>イベントを読み込んでいます...</p>;
  }

  if (error) {
    return (
      <div style={{ padding: "2em" }}>
        <p>{error}</p>
        <div style={{ marginTop: "1.5em" }}>
          <Link to="/">← Homeに戻る</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "2em", maxWidth: "980px", margin: "0 auto" }}>
      <h2>🏆 クライマー向け結果ページ</h2>
      <p style={{ marginBottom: "0.4em" }}>確認したいイベントを選んでください。</p>
      <ol style={{ marginTop: 0, paddingLeft: "1.2em" }}>
        <li>イベントを選ぶ</li>
        <li>ランキングから自分を検索する</li>
        <li>「詳細を見る」でシーズン別の完登内訳を確認する</li>
      </ol>
      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: "10px",
          padding: "0.8em",
          marginBottom: "1em",
          display: "flex",
          flexWrap: "wrap",
          gap: "0.8em",
          alignItems: "center",
        }}
      >
        <label>
          イベント名:
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="例: Spring"
            style={{ marginLeft: "0.5em" }}
          />
        </label>
        <label>
          開催状況:
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ marginLeft: "0.5em" }}
          >
            <option value="all">すべて</option>
            <option value="ongoing">開催中</option>
            <option value="upcoming">開催予定</option>
            <option value="ended">終了</option>
          </select>
        </label>
        <button type="button" onClick={resetFilters}>
          フィルターをリセット
        </button>
        <span style={{ marginLeft: "auto" }}>
          表示 {filteredEvents.length} / {events.length} 件
        </span>
      </div>

      {events.length === 0 ? (
        <p>イベントがありません。</p>
      ) : filteredEvents.length === 0 ? (
        <p>条件に一致するイベントがありません。</p>
      ) : (
        <div style={{ display: "grid", gap: "1em" }}>
          {filteredEvents.map((event) => {
            const status = getEventStatus(event, Date.now());
            return (
              <section
                key={event.id}
                style={{ border: "1px solid #ddd", borderRadius: "10px", padding: "1em" }}
              >
                <h3 style={{ marginTop: 0, marginBottom: "0.5em" }}>
                  {event.name}
                  <span
                    style={{
                      marginLeft: "0.6em",
                      fontSize: "0.8em",
                      border: "1px solid #ccc",
                      borderRadius: "999px",
                      padding: "0.1em 0.5em",
                    }}
                  >
                    {statusLabelMap[status]}
                  </span>
                </h3>
                <p style={{ marginTop: 0 }}>
                  開催期間: {toDateText(event.startDate)} 〜 {toDateText(event.endDate)}
                </p>
                <Link to={`/score-summary/${event.id}`}>このイベントのランキングを見る</Link>
              </section>
            );
          })}
        </div>
      )}
      <div style={{ marginTop: "2em" }}>
        <Link to="/">← Homeに戻る</Link>
      </div>
    </div>
  );
};

export default ScoreSummary;

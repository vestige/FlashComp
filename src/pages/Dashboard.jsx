import { useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import { auth, db } from "../firebase";
import { useNavigate, Link } from "react-router-dom";
import { collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import { usePageTitle } from "../hooks/usePageTitle";
import { useOwnerProfile } from "../hooks/useOwnerProfile";

const Dashboard = () => {
  usePageTitle("ジムオーナー管理");

  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [gyms, setGyms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const {
    gymIds,
    role,
    hasAllGymAccess,
    loading: profileLoading,
    error: profileError,
  } = useOwnerProfile();

  const formatDate = (value) => {
    if (!value) return "-";
    if (value.seconds) return new Date(value.seconds * 1000).toLocaleDateString();
    return String(value);
  };

  const handleLogout = () => {
    signOut(auth)
      .then(() => navigate("/login"))
      .catch((error) => console.error("ログアウト失敗:", error));
  };

  useEffect(() => {
    if (profileLoading) return;
    if (profileError) {
      setError(profileError);
      setLoading(false);
      return;
    }

    const fetchEvents = async () => {
      setLoading(true);
      setError("");
      try {
        const [eventSnap, gymSnap] = await Promise.all([
          getDocs(collection(db, "events")),
          getDocs(collection(db, "gyms")),
        ]);
        const eventRows = eventSnap.docs
          .map((eventDoc) => ({ id: eventDoc.id, ...eventDoc.data() }))
          .filter((event) => hasAllGymAccess || gymIds.includes(event.gymId));
        const gymRows = gymSnap.docs
          .map((gymDoc) => ({ id: gymDoc.id, ...gymDoc.data() }))
          .filter((gym) => hasAllGymAccess || gymIds.includes(gym.id))
          .sort((a, b) => (a.name || "").localeCompare(b.name || "", "ja"));
        setEvents(eventRows);
        setGyms(gymRows);
      } catch (err) {
        console.error("イベント取得失敗:", err);
        setError("イベントの取得に失敗しました。");
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, [profileLoading, profileError, gymIds, hasAllGymAccess]);

  const handleDelete = async (id) => {
    if (!window.confirm("このイベントを削除してもよろしいですか？")) return;
    const target = events.find((event) => event.id === id);
    if (!target || (!hasAllGymAccess && !gymIds.includes(target.gymId))) {
      window.alert("このイベントを削除する権限がありません。");
      return;
    }

    try {
      await deleteDoc(doc(db, "events", id));
      setEvents(events.filter(event => event.id !== id));
    } catch (err) {
      console.error("削除に失敗しました:", err);
    }
  };

  const gymNameById = new Map(gyms.map((gym) => [gym.id, gym.name || gym.id]));

  if (loading || profileLoading) {
    return <p style={{ padding: "2em" }}>管理データを読み込んでいます...</p>;
  }

  if (error || profileError) {
    return (
      <div style={{ padding: "2em" }}>
        <p>{error || profileError}</p>
        <div style={{ marginTop: "1em" }}>
          <Link to="/">← Homeに戻る</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "2em", maxWidth: "980px", margin: "0 auto" }}>
      <h2>ジムオーナー管理画面</h2>
      <p>イベントの準備と開催時オペレーションをここから行います。</p>
      <p>
        担当ジム:{" "}
        {hasAllGymAccess
          ? "すべてのジム"
          : gyms.length > 0
            ? gyms.map((gym) => gym.name || gym.id).join(" / ")
            : "未割り当て"}
      </p>

      <section style={{ border: "1px solid #ddd", borderRadius: "10px", padding: "1em" }}>
        <h3 style={{ marginTop: 0 }}>準備フェーズ</h3>
        <p style={{ marginTop: 0 }}>
          まずイベントを作成し、イベントごとにシーズン・カテゴリ・課題を設定します。
        </p>
        {hasAllGymAccess || gymIds.length > 0 ? (
          <Link to="/create-event">📝 新しいイベントを作成</Link>
        ) : (
          <p style={{ marginBottom: 0 }}>
            担当ジムが未設定のため、イベントを作成できません。システム管理者に設定を依頼してください。
          </p>
        )}
      </section>

      {role === "admin" && (
        <section style={{ border: "1px solid #ddd", borderRadius: "10px", padding: "1em", marginTop: "1em" }}>
          <h3 style={{ marginTop: 0 }}>システム管理者メニュー</h3>
          <p style={{ marginTop: 0 }}>
            ジム管理とオーナー管理を行う場合は、管理者専用ページを利用してください。
          </p>
          <Link to="/system-admin">システム管理画面へ</Link>
        </section>
      )}

      <h3 style={{ marginTop: "1.6em" }}>📋 登録済みイベント</h3>
      {!hasAllGymAccess && gymIds.length === 0 ? (
        <p>担当ジムが未設定です。</p>
      ) : events.length === 0 ? (
        <p>イベントがまだ登録されていません。</p>
      ) : (
        <div style={{ display: "grid", gap: "1em" }}>
          {events.map((event) => (
            <section
              key={event.id}
              style={{ border: "1px solid #ddd", borderRadius: "10px", padding: "1em" }}
            >
              <h4 style={{ marginTop: 0, marginBottom: "0.4em" }}>{event.name}</h4>
              <p style={{ marginTop: 0 }}>
                開催期間: {formatDate(event.startDate)} 〜 {formatDate(event.endDate)}
              </p>
              <p style={{ marginTop: 0 }}>ジム: {gymNameById.get(event.gymId) || "未設定"}</p>

              <div style={{ display: "flex", gap: "0.8em", flexWrap: "wrap" }}>
                <Link to={`/events/${event.id}/edit`} state={{ tab: "seasons" }}>
                  シーズン / カテゴリ / 課題設定
                </Link>
                <Link to={`/events/${event.id}/edit`} state={{ tab: "participants" }}>
                  参加者登録
                </Link>
                <Link to={`/events/${event.id}/edit`} state={{ tab: "scores" }}>
                  採点入力
                </Link>
                <Link to={`/events/${event.id}/data-io`}>CSV入出力</Link>
                <Link to={`/score-summary/${event.id}`}>公開ランキング確認</Link>
                <button type="button" onClick={() => handleDelete(event.id)}>
                  🗑 イベント削除
                </button>
              </div>
            </section>
          ))}
        </div>
      )}

      <div style={{ marginTop: "2em" }}>
        <button type="button" onClick={handleLogout}>ログアウト</button>
      </div>
      <div style={{ marginTop: "1em" }}>
        <Link to="/">← Homeに戻る</Link>
      </div>
    </div>
  );
};

export default Dashboard;

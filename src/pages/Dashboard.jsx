import { useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import { auth, db } from "../firebase";
import { useNavigate, Link } from "react-router-dom";
import { collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import { usePageTitle } from "../hooks/usePageTitle";

const Dashboard = () => {
  usePageTitle("ジムオーナー管理");

  const navigate = useNavigate();
  const [events, setEvents] = useState([]);

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

  const fetchEvents = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "events"));
      const eventList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setEvents(eventList);
    } catch (err) {
      console.error("イベント取得失敗:", err);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm("このイベントを削除してもよろしいですか？")) return;
    try {
      await deleteDoc(doc(db, "events", id));
      setEvents(events.filter(event => event.id !== id));
    } catch (err) {
      console.error("削除に失敗しました:", err);
    }
  };

  return (
    <div style={{ padding: "2em", maxWidth: "980px", margin: "0 auto" }}>
      <h2>ジムオーナー管理画面</h2>
      <p>イベントの準備と開催時オペレーションをここから行います。</p>

      <section style={{ border: "1px solid #ddd", borderRadius: "10px", padding: "1em" }}>
        <h3 style={{ marginTop: 0 }}>準備フェーズ</h3>
        <p style={{ marginTop: 0 }}>
          まずイベントを作成し、イベントごとにシーズン・カテゴリ・課題を設定します。
        </p>
        <Link to="/create-event">📝 新しいイベントを作成</Link>
      </section>

      <h3 style={{ marginTop: "1.6em" }}>📋 登録済みイベント</h3>
      {events.length === 0 ? (
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

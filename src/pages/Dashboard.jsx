import { useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import { auth, db } from "../firebase";
import { useNavigate, Link } from "react-router-dom";
import { collection, getDocs, deleteDoc, doc } from "firebase/firestore";

const Dashboard = () => {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);

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
    <div style={{ padding: "2em" }}>
      <h2>ダッシュボード</h2>
      <Link to="/create-event">📝 イベント作成</Link>

      <h3>📋 登録済みイベント一覧</h3>
      <ul>
        {events.map((event) => (
          <li key={event.id}>
            {event.name}（
            {event.startDate?.seconds
              ? new Date(event.startDate.seconds * 1000).toLocaleDateString()
              : event.startDate}
            〜
            {event.endDate?.seconds
              ? new Date(event.endDate.seconds * 1000).toLocaleDateString()
              : event.endDate}
            ）
            <Link to={`/events/${event.id}/edit`} style={{ marginLeft: "1em" }}>✏️ 編集</Link>
            <button onClick={() => handleDelete(event.id)}>🗑 削除</button>
          </li>
        ))}
      </ul>

      <button onClick={handleLogout}>ログアウト</button>
      <div style={{ marginTop: '2em' }}>
        <Link to="/">← Homeに戻る</Link>
      </div>
      
    </div>
  );
};

export default Dashboard;
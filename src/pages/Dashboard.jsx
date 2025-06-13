// src/pages/Dashboard.jsx
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { useNavigate } from "react-router-dom";

const Dashboard = () => {
  const navigate = useNavigate();

  const handleLogout = () => {
    signOut(auth)
      .then(() => navigate("/login"))
      .catch((error) => console.error("ログアウト失敗:", error));
  };

  return (
    <div style={{ padding: "2em" }}>
      <h2>ダッシュボード</h2>
      <p>ここにイベント作成やポイント入力へのリンクを置きます。</p>
      <button onClick={handleLogout}>ログアウト</button>
    </div>
  );
};

export default Dashboard;
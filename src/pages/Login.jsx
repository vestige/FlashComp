// src/pages/Login.jsx
import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase"; 
import { useNavigate } from "react-router-dom";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const navigate = useNavigate();

  const handleLogin = async () => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setStatus("✅ ログイン成功！管理ページに移動します...");
      setTimeout(() => navigate("/dashboard"), 1000);
    } catch (error) {
      setStatus("❌ ログイン失敗: " + error.message);
    }
  };

  return (
    <div style={{ padding: "2em", maxWidth: "400px", margin: "auto" }}>
      <h2>管理者ログイン</h2>
      <input
        type="email"
        placeholder="メールアドレス"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        type="password"
        placeholder="パスワード"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button onClick={handleLogin}>ログイン</button>
      <div style={{ marginTop: "1em", color: "red" }}>{status}</div>
    </div>
  );
};

export default Login;
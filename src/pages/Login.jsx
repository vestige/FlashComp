import { useState } from "react";
import { auth } from "../firebase";
import { signInWithEmailAndPassword } from "firebase/auth";

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");

  const handleLogin = async () => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setStatus("✅ ログイン成功！");
      onLogin(); // App.jsxのログイン状態を切り替える
    } catch (error) {
      setStatus("❌ ログイン失敗: " + error.message);
    }
  };

  return (
    <div style={{ maxWidth: "400px", margin: "2em auto", padding: "2em", background: "#fff", borderRadius: "8px" }}>
      <h2>管理者ログイン</h2>
      <input type="email" placeholder="メールアドレス" value={email} onChange={e => setEmail(e.target.value)} />
      <input type="password" placeholder="パスワード" value={password} onChange={e => setPassword(e.target.value)} />
      <button onClick={handleLogin}>ログイン</button>
      <div style={{ marginTop: "1em", color: "red" }}>{status}</div>
    </div>
  );
}

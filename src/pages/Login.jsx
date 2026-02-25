// src/pages/Login.jsx
import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase"; 
import { Link, useLocation, useNavigate } from "react-router-dom";
import { usePageTitle } from "../hooks/usePageTitle";

const Login = () => {
  usePageTitle("管理者ログイン");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogin = async () => {
    const redirectPath = location.state?.from?.pathname || "/dashboard";
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setStatus("✅ ログイン成功！管理ページに移動します...");
      setTimeout(() => navigate(redirectPath, { replace: true }), 600);
    } catch (error) {
      setStatus("❌ ログイン失敗: " + error.message);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    await handleLogin();
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#dbeafe_0%,_#f8fafc_50%,_#eef2ff_100%)] px-4 py-10">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <Link
          to="/"
          className="inline-flex items-center text-sm font-medium text-slate-600 transition hover:text-slate-900"
        >
          ← Homeに戻る
        </Link>
        <h2 className="text-2xl font-bold text-slate-900">管理者ログイン</h2>
        <form className="mt-4 grid gap-3" onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="メールアドレス"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
          />
          <input
            type="password"
            placeholder="パスワード"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-lg border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-800 transition hover:bg-sky-100"
          >
            ログイン
          </button>
        </form>
        {status && (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {status}
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;

// src/pages/Login.jsx
import { useState } from "react";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from "../firebase"; 
import { Link, useLocation, useNavigate } from "react-router-dom";
import { usePageTitle } from "../hooks/usePageTitle";

const Login = () => {
  usePageTitle("Googleログイン");

  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleGoogleLogin = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    const redirectPath = location.state?.from?.pathname || "/dashboard";
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      setStatus("✅ Googleログイン成功。管理ページへ移動します...");
      setTimeout(() => navigate(redirectPath, { replace: true }), 600);
    } catch (error) {
      setStatus("❌ Googleログイン失敗: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
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
        <h2 className="text-2xl font-bold text-slate-900">運営ログイン</h2>
        <p className="mt-3 text-sm text-slate-600">
          管理画面はGoogleアカウントでログインしてください。
        </p>
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={isSubmitting}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
            <path
              fill="#EA4335"
              d="M12 10.2v3.9h5.5c-.2 1.2-.9 2.3-1.9 3l3.1 2.4c1.8-1.7 2.9-4.2 2.9-7.1 0-.7-.1-1.4-.2-2.1H12Z"
            />
            <path
              fill="#34A853"
              d="M6.6 14.3 5.9 14l-2.5 2c1.6 3.1 4.8 5.2 8.6 5.2 2.5 0 4.6-.8 6.1-2.3l-3.1-2.4c-.8.5-1.8.8-3 .8-2.3 0-4.2-1.5-4.9-3.6Z"
            />
            <path
              fill="#FBBC05"
              d="M3.4 8.1A9.5 9.5 0 0 0 3 10c0 1.4.3 2.7.9 3.9l3.2-2.5A5.6 5.6 0 0 1 7 10c0-.5.1-1.1.3-1.5L3.4 8.1Z"
            />
            <path
              fill="#4285F4"
              d="M12 4.5c1.4 0 2.7.5 3.7 1.4l2.7-2.7A9.6 9.6 0 0 0 12 1C8.2 1 4.9 3.2 3.4 6.3l3.9 3A5.5 5.5 0 0 1 12 4.5Z"
            />
          </svg>
          {isSubmitting ? "ログイン中..." : "Googleでログイン"}
        </button>
        {status && (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            {status}
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;

import { useEffect, useState } from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../firebase";

const MountainIcon = ({ className = "" }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M3 19h18" />
    <path d="m6 19 5.5-9.5L14 14l4-7 3 12" />
    <path d="m10.8 10.7 1.2-2 1.5 2.6" />
  </svg>
);

const navLinkClass =
  "inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50";

const ManagementLayout = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => setCurrentUser(user));
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login", { replace: true });
  };

  return (
    <div className="text-slate-900">
      <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/90 px-4 py-3 backdrop-blur sm:px-6 lg:px-10">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-700 text-white">
              <MountainIcon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-emerald-700">Climbing Competition</p>
              <p className="text-xs text-slate-500">Gym Management</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link to="/" className={navLinkClass}>TOP</Link>
            <Link to="/dashboard" className={navLinkClass}>ダッシュボード</Link>
            <Link to="/create-event" className={navLinkClass}>イベント作成</Link>
            {currentUser && (
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                ログアウト
              </button>
            )}
          </div>
        </div>
      </header>

      <Outlet />

      <footer className="border-t border-slate-100 bg-white py-8">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 text-slate-700">
            <MountainIcon className="h-5 w-5 text-emerald-700" />
            <span className="text-sm font-semibold">Climbing Competition</span>
          </div>
          <p className="text-xs text-slate-500">© 2026 Climbing Competition Systems. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default ManagementLayout;

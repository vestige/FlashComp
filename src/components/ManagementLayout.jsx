import { useEffect, useRef, useState } from "react";
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

const ManagementLayout = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const controlsRef = useRef(null);
  const navigate = useNavigate();
  const userLabel = currentUser?.displayName || currentUser?.email || "User";
  const userInitial = userLabel.trim().charAt(0).toUpperCase() || "U";

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (!user) setIsUserMenuOpen(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (controlsRef.current && !controlsRef.current.contains(event.target)) {
        setIsMenuOpen(false);
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    setIsUserMenuOpen(false);
    setIsMenuOpen(false);
    navigate("/", { replace: true });
  };

  const handlePortalNavigation = (path) => {
    setIsMenuOpen(false);
    navigate(path);
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

          <div className="relative flex items-center gap-2" ref={controlsRef}>
            {!currentUser && (
              <Link
                to="/login"
                className="inline-flex h-10 items-center justify-center rounded-lg border border-emerald-300 bg-emerald-50 px-3 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100"
              >
                ログイン
              </Link>
            )}
            {currentUser && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsUserMenuOpen((prev) => !prev)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  aria-label="user menu"
                  aria-expanded={isUserMenuOpen}
                >
                  {userInitial}
                </button>
                {isUserMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
                    <p className="truncate px-2 py-1 text-xs text-slate-500">{userLabel}</p>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="mt-1 block w-full rounded-lg px-2 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      ログアウト
                    </button>
                  </div>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={() => setIsMenuOpen((prev) => !prev)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-50"
              aria-label="menu"
              aria-expanded={isMenuOpen}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
            {isMenuOpen && (
              <div className="absolute right-0 top-12 z-50 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                <button
                  type="button"
                  onClick={() => handlePortalNavigation("/")}
                  className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  TOP
                </button>
                <button
                  type="button"
                  onClick={() => handlePortalNavigation("/dashboard")}
                  className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  ジムオーナー
                </button>
                <button
                  type="button"
                  onClick={() => handlePortalNavigation("/score-summary")}
                  className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  クライマー
                </button>
                <button
                  type="button"
                  onClick={() => handlePortalNavigation("/system-admin")}
                  className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  システム管理者
                </button>
              </div>
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

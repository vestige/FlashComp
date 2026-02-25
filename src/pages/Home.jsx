import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { usePageTitle } from "../hooks/usePageTitle";
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

const Home = () => {
  usePageTitle("Home");
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const userMenuRef = useRef(null);
  const cardClass =
    "group flex flex-col rounded-2xl border border-slate-200 bg-white p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl";
  const cardDescriptionClass = "mt-2 text-sm leading-relaxed text-slate-600";
  const cardListClass = "mt-4 flex-1 space-y-2 text-sm text-slate-700";
  const ownerPrimaryButtonClass =
    "inline-flex w-full items-center justify-center rounded-full border border-emerald-700 bg-emerald-700 px-4 py-3 text-sm font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-emerald-800 hover:shadow-lg hover:shadow-emerald-700/20";
  const climberButtonClass =
    "inline-flex w-full items-center justify-center rounded-full border border-emerald-400 bg-emerald-500 px-4 py-3 text-sm font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-emerald-600 hover:shadow-lg hover:shadow-emerald-500/20";
  const adminButtonClass =
    "inline-flex w-full items-center justify-center rounded-full border border-sky-300 bg-sky-500 px-4 py-3 text-sm font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-sky-600 hover:shadow-lg hover:shadow-sky-500/20";
  const userLabel = currentUser?.displayName || currentUser?.email || "User";
  const userInitial = userLabel.trim().charAt(0).toUpperCase() || "U";

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (!user) {
        setIsUserMenuOpen(false);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    setIsUserMenuOpen(false);
    navigate("/", { replace: true });
  };

  const handlePortalNavigation = (path, redirectAfterLoginPath) => {
    setIsMenuOpen(false);
    if (redirectAfterLoginPath && !currentUser) {
      navigate("/login", {
        state: { from: { pathname: redirectAfterLoginPath } },
      });
      return;
    }
    navigate(path);
  };

  return (
    <div className="min-h-screen scroll-smooth bg-white text-slate-900">
      <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/90 px-4 py-4 backdrop-blur sm:px-6 lg:px-10">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-700 text-white">
              <MountainIcon className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-emerald-700">Climbing Competition</h1>
          </div>
          <div className="relative flex items-center gap-2">
            {!currentUser && (
              <Link
                to="/login"
                className="inline-flex h-10 items-center justify-center rounded-lg border border-emerald-300 bg-emerald-50 px-3 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100"
              >
                ログイン
              </Link>
            )}
            {currentUser && (
              <div className="relative" ref={userMenuRef}>
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
                  onClick={() => handlePortalNavigation("/dashboard", "/dashboard")}
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
                  onClick={() => handlePortalNavigation("/system-admin", "/system-admin")}
                  className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  システム管理者
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="relative">
        <section className="relative overflow-hidden px-6 py-16 lg:py-24">
          <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(45%_45%_at_50%_50%,rgba(82,183,136,0.15)_0%,rgba(255,255,255,0)_100%)]" />
          <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(45%_45%_at_50%_50%,rgba(54,179,242,0.05)_0%,rgba(255,255,255,0)_100%)]" />
          <div className="relative z-10 mx-auto max-w-4xl text-center">
            <h2 className="mb-6 bg-gradient-to-r from-[#2D6A4F] via-[#52B788] to-[#36b3f2] bg-clip-text text-5xl font-bold tracking-tight text-transparent lg:text-7xl">
              Push Your Limits.
              <br />
              Track Your Flash.
            </h2>
            <p className="mx-auto max-w-2xl text-lg leading-relaxed text-slate-600 lg:text-xl">
              The ultimate climbing competition management platform designed for speed, fairness,
              and the community. Choose your portal to begin.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-10">
          <div className="grid gap-6 md:grid-cols-3">
            <section id="portal-owner" className={`${cardClass} hover:shadow-emerald-600/10`}>
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-2xl text-emerald-700 transition group-hover:bg-emerald-700 group-hover:text-white">
                🏢
              </div>
              <h3 className="text-2xl font-bold text-slate-900">ジムオーナー</h3>
              <p className="mt-1 text-sm text-slate-500">For Gym Owners</p>
              <p className={cardDescriptionClass}>
                大会運営の設定、採点オペレーション、ランキング公開までを一元管理します。
              </p>
              <ul className={cardListClass}>
                <li>大会・イベントの新規作成・管理</li>
                <li>リアルタイムでの集計・順位表示</li>
                <li>ジム内ランキングの統計分析</li>
              </ul>
              <div className="mt-6">
                <Link to="/dashboard" className={ownerPrimaryButtonClass}>ダッシュボードへ</Link>
              </div>
            </section>

            <section id="portal-climber" className={`${cardClass} hover:shadow-emerald-500/10`}>
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-2xl text-emerald-600 transition group-hover:bg-emerald-500 group-hover:text-white">
                🧍
              </div>
              <h3 className="text-2xl font-bold text-slate-900">クライマー</h3>
              <p className="mt-1 text-sm text-slate-500">For Climbers</p>
              <p className={cardDescriptionClass}>
                イベント結果の確認、個人スコアの追跡、カテゴリ内順位の比較ができます。
              </p>
              <ul className={cardListClass}>
                <li>イベントへの参加とスコア確認</li>
                <li>スマートフォンでの閲覧</li>
                <li>カテゴリ内での順位比較</li>
              </ul>
              <div className="mt-6">
                <Link to="/score-summary" className={climberButtonClass}>イベント結果を見る</Link>
              </div>
            </section>

            <section id="portal-admin" className={`${cardClass} hover:shadow-sky-500/10`}>
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-100 text-2xl text-sky-600 transition group-hover:bg-sky-500 group-hover:text-white">
                ⚙️
              </div>
              <h3 className="text-2xl font-bold text-slate-900">システム管理者</h3>
              <p className="mt-1 text-sm text-slate-500">For System Admins</p>
              <p className={cardDescriptionClass}>
                全体運用に必要なアカウント・ジム・権限設定を横断的に管理します。
              </p>
              <ul className={cardListClass}>
                <li>全ジム・ユーザーのアカウント管理</li>
                <li>システム設定の管理</li>
                <li>運用状況の確認</li>
              </ul>
              <div className="mt-6">
                <Link to="/system-admin" className={adminButtonClass}>管理コンソール</Link>
              </div>
            </section>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-100 bg-white py-10">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-10">
          <div className="mb-3 flex items-center justify-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center text-emerald-700">
              <MountainIcon className="h-5 w-5" />
            </span>
            <span className="font-bold text-slate-900">Climbing Competition</span>
          </div>
          <p className="text-sm text-slate-500">
            © 2026 Climbing Competition Systems. All rights reserved.
          </p>
          <div className="mt-4 flex justify-center text-sm text-slate-500">
            <a
              href="https://github.com/vestige/FlashComp/issues/new/choose"
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-emerald-700"
            >
              Contact
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;

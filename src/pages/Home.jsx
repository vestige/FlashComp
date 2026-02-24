import { Link } from "react-router-dom";
import { usePageTitle } from "../hooks/usePageTitle";

const Home = () => {
  usePageTitle("Home");
  const cardClass =
    "group flex flex-col rounded-2xl border border-slate-200 bg-white p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl";
  const ownerPrimaryButtonClass =
    "inline-flex w-full items-center justify-center rounded-full border border-emerald-700 bg-emerald-700 px-4 py-3 text-sm font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-emerald-800 hover:shadow-lg hover:shadow-emerald-700/20";
  const ownerSecondaryButtonClass =
    "inline-flex w-full items-center justify-center rounded-full border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 transition-all duration-300 hover:-translate-y-0.5 hover:bg-emerald-100";
  const climberButtonClass =
    "inline-flex w-full items-center justify-center rounded-full border border-emerald-400 bg-emerald-500 px-4 py-3 text-sm font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-emerald-600 hover:shadow-lg hover:shadow-emerald-500/20";
  const adminButtonClass =
    "inline-flex w-full items-center justify-center rounded-full border border-sky-300 bg-sky-500 px-4 py-3 text-sm font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-sky-600 hover:shadow-lg hover:shadow-sky-500/20";

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/90 px-4 py-4 backdrop-blur sm:px-6 lg:px-10">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-700 text-lg text-white">
              🧗
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-emerald-700">Climbing Competition</h1>
          </div>
        </div>
      </header>

      <main className="relative">
        <section className="relative overflow-hidden px-4 pb-16 pt-16 sm:px-6 lg:px-10 lg:pt-24">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(40%_50%_at_50%_20%,rgba(16,185,129,0.16)_0%,rgba(255,255,255,0)_100%)]" />
          <div className="mx-auto max-w-4xl text-center">
            <h2 className="bg-gradient-to-r from-emerald-800 via-emerald-500 to-sky-500 bg-clip-text text-4xl font-black tracking-tight text-transparent sm:text-5xl lg:text-6xl">
              Push Your Limits.
              <br />
              Track Your Flash.
            </h2>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-10">
          <div className="grid gap-6 md:grid-cols-3">
            <section className={`${cardClass} hover:shadow-emerald-600/10`}>
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-2xl text-emerald-700 transition group-hover:bg-emerald-700 group-hover:text-white">
                🏢
              </div>
              <h3 className="text-2xl font-bold text-slate-900">ジムオーナー向け</h3>
              <p className="mt-1 text-sm text-slate-500">For Gym Owners</p>
              <ul className="mt-5 flex-1 space-y-2 text-sm text-slate-700">
                <li>大会・イベントの新規作成・管理</li>
                <li>リアルタイムでの集計・順位表示</li>
                <li>ジム内ランキングの統計分析</li>
              </ul>
              <div className="mt-6 space-y-2">
                <Link to="/login" className={ownerPrimaryButtonClass}>オーナーとしてログイン</Link>
                <Link to="/dashboard" className={ownerSecondaryButtonClass}>ログイン済みなら管理画面へ</Link>
              </div>
            </section>

            <section className={`${cardClass} hover:shadow-emerald-500/10`}>
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-2xl text-emerald-600 transition group-hover:bg-emerald-500 group-hover:text-white">
                🧍
              </div>
              <h3 className="text-2xl font-bold text-slate-900">クライマー向け</h3>
              <p className="mt-1 text-sm text-slate-500">For Climbers</p>
              <ul className="mt-5 flex-1 space-y-2 text-sm text-slate-700">
                <li>イベントへの参加とスコア確認</li>
                <li>スマートフォンでの閲覧</li>
                <li>カテゴリ内での順位比較</li>
              </ul>
              <div className="mt-6">
                <Link to="/score-summary" className={climberButtonClass}>イベント結果を見る</Link>
              </div>
            </section>

            <section className={`${cardClass} hover:shadow-sky-500/10`}>
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-100 text-2xl text-sky-600 transition group-hover:bg-sky-500 group-hover:text-white">
                ⚙️
              </div>
              <h3 className="text-2xl font-bold text-slate-900">システム管理者向け</h3>
              <p className="mt-1 text-sm text-slate-500">For System Admins</p>
              <ul className="mt-5 flex-1 space-y-2 text-sm text-slate-700">
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
            <span className="text-emerald-700">🧗</span>
            <span className="font-bold text-slate-900">Climbing Competition</span>
          </div>
          <p className="text-sm text-slate-500">
            © 2026 Climbing Competition Systems. All rights reserved.
          </p>
          <div className="mt-4 flex justify-center gap-6 text-sm text-slate-500">
            <span className="cursor-default transition-colors hover:text-emerald-700">Terms</span>
            <span className="cursor-default transition-colors hover:text-emerald-700">Privacy</span>
            <span className="cursor-default transition-colors hover:text-emerald-700">Contact</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;

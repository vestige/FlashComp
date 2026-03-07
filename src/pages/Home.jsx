import { Link, useSearchParams } from "react-router-dom";
import { usePageTitle } from "../hooks/usePageTitle";

const Home = () => {
  usePageTitle("Home");
  const [searchParams] = useSearchParams();
  const showLegacyPortalNotice = searchParams.get("legacy") === "score-summary-event";
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

  return (
    <main className="relative">
      {showLegacyPortalNotice ? (
        <section className="mx-auto mt-4 max-w-4xl px-4 sm:px-6 lg:px-8">
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            旧URLです。クライマーポータルは「イベント結果を見る」からアクセスしてください。
          </p>
        </section>
      ) : null}
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
  );
};

export default Home;

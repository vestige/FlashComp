import { Link } from "react-router-dom";
import { usePageTitle } from "../hooks/usePageTitle";

const Home = () => {
  usePageTitle("Home");
  const cardClass =
    "rounded-2xl border border-slate-200 bg-white/95 p-6 shadow-sm backdrop-blur";
  const actionLinkClass =
    "inline-flex items-center rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100";

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#dbeafe_0%,_#f8fafc_40%,_#eef2ff_100%)]">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <header className="rounded-3xl border border-slate-200/80 bg-white/95 px-6 py-7 shadow-sm">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">FlashComp</p>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
            FLASH FLASH コンペサイト
          </h1>
          <p className="mt-3 text-sm text-slate-600 sm:text-base">
            使う人ごとに入口を分けています。目的に合う方から進んでください。
          </p>
        </header>

        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <section className={cardClass}>
            <h2 className="text-2xl font-bold text-slate-900">ジムオーナー向け</h2>
            <p className="mt-2 text-sm text-slate-600">
              イベント運営の設定・クライマー登録・採点入力を行います。
            </p>
            <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm text-slate-700">
            <li>ログイン</li>
            <li>イベント作成</li>
            <li>シーズン / カテゴリ / 課題の設定</li>
            <li>クライマー登録・採点入力</li>
          </ol>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link to="/login" className={actionLinkClass}>ジムオーナーログインへ</Link>
              <Link to="/dashboard" className={actionLinkClass}>ログイン済みなら管理画面へ</Link>
            </div>
          </section>

          <section className={cardClass}>
            <h2 className="text-2xl font-bold text-slate-900">クライマー向け</h2>
            <p className="mt-2 text-sm text-slate-600">
              イベントのスコアや順位を確認します（ログイン不要）。
            </p>
            <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm text-slate-700">
            <li>イベントを選ぶ</li>
            <li>自分のスコアを確認する</li>
            <li>カテゴリ順位や他クライマーの結果を確認する</li>
          </ol>
            <div className="mt-5">
              <Link to="/score-summary" className={actionLinkClass}>イベント結果を見る</Link>
            </div>
          </section>
        </div>

        <section className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white/80 p-6">
          <h3 className="text-lg font-bold text-slate-900">システム管理者向け</h3>
          <p className="mt-2 text-sm text-slate-600">
            ジム登録・オーナープロファイル管理を行います（admin権限が必要）。
          </p>
          <div className="mt-4">
            <Link to="/system-admin" className={actionLinkClass}>システム管理画面へ</Link>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Home;

import { Link } from "react-router-dom";

const Home = () => {
  return (
    <div style={{ padding: "2em", maxWidth: "960px", margin: "0 auto" }}>
      <h1>🧗 FLASH FLASH コンペサイト</h1>
      <p>使う人ごとに入口を分けています。目的に合う方から進んでください。</p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: "1.2em",
          marginTop: "1.4em",
        }}
      >
        <section style={{ border: "1px solid #ddd", borderRadius: "10px", padding: "1em" }}>
          <h2 style={{ marginTop: 0 }}>ジムオーナー向け</h2>
          <p style={{ marginTop: 0 }}>イベント運営の設定・参加者登録・採点入力を行います。</p>
          <ol style={{ paddingLeft: "1.2em" }}>
            <li>ログイン</li>
            <li>イベント作成</li>
            <li>シーズン / カテゴリ / 課題の設定</li>
            <li>参加者登録・採点入力</li>
          </ol>
          <p style={{ marginBottom: 0 }}>
            <Link to="/login">ジムオーナーログインへ</Link>
          </p>
          <p style={{ marginTop: "0.4em", marginBottom: 0 }}>
            <Link to="/dashboard">ログイン済みなら管理画面へ</Link>
          </p>
        </section>

        <section style={{ border: "1px solid #ddd", borderRadius: "10px", padding: "1em" }}>
          <h2 style={{ marginTop: 0 }}>クライマー向け</h2>
          <p style={{ marginTop: 0 }}>イベントのスコアや順位を確認します（ログイン不要）。</p>
          <ol style={{ paddingLeft: "1.2em" }}>
            <li>イベントを選ぶ</li>
            <li>自分のスコアを確認する</li>
            <li>カテゴリ順位や他参加者の結果を確認する</li>
          </ol>
          <p style={{ marginBottom: 0 }}>
            <Link to="/score-summary">イベント結果を見る</Link>
          </p>
        </section>
      </div>

      <section
        style={{
          border: "1px dashed #bbb",
          borderRadius: "10px",
          padding: "1em",
          marginTop: "1.2em",
        }}
      >
        <h3 style={{ marginTop: 0 }}>システム管理者向け（準備中）</h3>
        <p style={{ marginBottom: 0 }}>ジム登録などの管理機能は今後追加予定です。</p>
      </section>
    </div>
  );
};

export default Home;

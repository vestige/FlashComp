import { Link } from "react-router-dom";

const Home = () => {
  return (
    <div style={{ padding: "2em", textAlign: "center" }}>
      <h1>🧗‍♂️ FLASH FLASH コンペサイト</h1>
      <p>
        <Link to="/login">
          管理者ログインはこちら
        </Link>
      </p>
      <p>
        <Link to="/score-summary">
          得点集計はこちら
        </Link>
      </p>
    </div>
  );
};

export default Home;
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
    </div>
  );
};

export default Home;
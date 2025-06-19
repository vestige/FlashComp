import { useParams, Link } from "react-router-dom";

const EditEvent = () => {
  const { eventId } = useParams();

  return (
    <div style={{ padding: "2em" }}>
      <h2>イベント編集ページ</h2>
      <p>イベントID: {eventId}</p>

      <Link to="/dashboard">← ダッシュボードに戻る</Link>

      <h3>📆 シーズン一覧</h3>
      <p>ここにシーズン一覧と「追加」ボタンを表示します。</p>
    </div>
  );
};

export default EditEvent;
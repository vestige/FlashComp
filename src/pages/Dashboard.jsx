import EventForm from "../components/EventForm";

export default function Dashboard({ onLogout }) {
  return (
    <div style={{ padding: "2em" }}>
      <h2>管理画面</h2>
      <button onClick={onLogout}>ログアウト</button>

      <EventForm />
    </div>
  );
}

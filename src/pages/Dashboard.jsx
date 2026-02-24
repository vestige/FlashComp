import { useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import { auth, db } from "../firebase";
import { useNavigate, Link } from "react-router-dom";
import { collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import { usePageTitle } from "../hooks/usePageTitle";
import { useOwnerProfile } from "../hooks/useOwnerProfile";

const Dashboard = () => {
  usePageTitle("ジムオーナー管理");

  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [gyms, setGyms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const {
    gymIds,
    role,
    hasAllGymAccess,
    loading: profileLoading,
    error: profileError,
  } = useOwnerProfile();

  const formatDate = (value) => {
    if (!value) return "-";
    if (value.seconds) return new Date(value.seconds * 1000).toLocaleDateString();
    return String(value);
  };

  const handleLogout = () => {
    signOut(auth)
      .then(() => navigate("/login"))
      .catch((error) => console.error("ログアウト失敗:", error));
  };

  useEffect(() => {
    if (profileLoading) return;
    if (profileError) {
      setError(profileError);
      setLoading(false);
      return;
    }

    const fetchEvents = async () => {
      setLoading(true);
      setError("");
      try {
        const [eventSnap, gymSnap] = await Promise.all([
          getDocs(collection(db, "events")),
          getDocs(collection(db, "gyms")),
        ]);
        const eventRows = eventSnap.docs
          .map((eventDoc) => ({ id: eventDoc.id, ...eventDoc.data() }))
          .filter((event) => hasAllGymAccess || gymIds.includes(event.gymId));
        const gymRows = gymSnap.docs
          .map((gymDoc) => ({ id: gymDoc.id, ...gymDoc.data() }))
          .filter((gym) => hasAllGymAccess || gymIds.includes(gym.id))
          .sort((a, b) => (a.name || "").localeCompare(b.name || "", "ja"));
        setEvents(eventRows);
        setGyms(gymRows);
      } catch (err) {
        console.error("イベント取得失敗:", err);
        setError("イベントの取得に失敗しました。");
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, [profileLoading, profileError, gymIds, hasAllGymAccess]);

  const handleDelete = async (id) => {
    if (!window.confirm("このイベントを削除してもよろしいですか？")) return;
    const target = events.find((event) => event.id === id);
    if (!target || (!hasAllGymAccess && !gymIds.includes(target.gymId))) {
      window.alert("このイベントを削除する権限がありません。");
      return;
    }

    try {
      await deleteDoc(doc(db, "events", id));
      setEvents(events.filter(event => event.id !== id));
    } catch (err) {
      console.error("削除に失敗しました:", err);
    }
  };

  const gymNameById = new Map(gyms.map((gym) => [gym.id, gym.name || gym.id]));
  const sectionClass = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm";
  const subtleActionClass =
    "inline-flex items-center rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100";
  const primaryActionClass =
    "inline-flex items-center rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-800 transition hover:bg-sky-100";
  const dangerButtonClass =
    "rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-100";
  const plainButtonClass =
    "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50";

  if (loading || profileLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <p className="text-sm text-slate-600">管理データを読み込んでいます...</p>
      </div>
    );
  }

  if (error || profileError) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error || profileError}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#dbeafe_0%,_#f8fafc_45%,_#ecfeff_100%)]">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="rounded-3xl border border-slate-200 bg-white px-6 py-6 shadow-sm">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">Gym Owner Console</p>
          <h2 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">ジムオーナー管理画面</h2>
          <p className="mt-3 text-sm text-slate-600">
            イベントの設定と開催時オペレーションをここから行います。
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Link to="/" className={subtleActionClass}>← TOPに戻る</Link>
            <span className="text-sm text-slate-600">
              担当ジム:{" "}
              {hasAllGymAccess
                ? "すべてのジム"
                : gyms.length > 0
                  ? gyms.map((gym) => gym.name || gym.id).join(" / ")
                  : "未割り当て"}
            </span>
          </div>
        </header>

        <section className={`${sectionClass} mt-5`}>
          <h3 className="text-lg font-bold text-slate-900">設定</h3>
          <p className="mt-2 text-sm text-slate-600">
            まずイベントを作成し、イベントごとにシーズン・カテゴリ・課題を設定します。
          </p>
          <div className="mt-4">
            {hasAllGymAccess || gymIds.length > 0 ? (
              <Link to="/create-event" className={primaryActionClass}>📝 新しいイベントを作成</Link>
            ) : (
              <p className="text-sm text-slate-600">
                担当ジムが未設定のため、イベントを作成できません。システム管理者に設定を依頼してください。
              </p>
            )}
          </div>
        </section>

        {role === "admin" && (
          <section className={`${sectionClass} mt-4`}>
            <h3 className="text-lg font-bold text-slate-900">システム管理者メニュー</h3>
            <p className="mt-2 text-sm text-slate-600">
              ジム管理とオーナー管理を行う場合は、管理者専用ページを利用してください。
            </p>
            <div className="mt-4">
              <Link to="/system-admin" className={subtleActionClass}>システム管理画面へ</Link>
            </div>
          </section>
        )}

        <section className="mt-6">
          <h3 className="text-lg font-bold text-slate-900">📋 登録済みイベント</h3>
          {!hasAllGymAccess && gymIds.length === 0 ? (
            <p className="mt-2 text-sm text-slate-600">担当ジムが未設定です。</p>
          ) : events.length === 0 ? (
            <p className="mt-2 text-sm text-slate-600">イベントがまだ登録されていません。</p>
          ) : (
            <div className="mt-3 grid gap-4">
              {events.map((event) => (
                <section key={event.id} className={sectionClass}>
                  <h4 className="text-base font-bold text-slate-900">{event.name}</h4>
                  <p className="mt-2 text-sm text-slate-600">
                    開催期間: {formatDate(event.startDate)} 〜 {formatDate(event.endDate)}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">ジム: {gymNameById.get(event.gymId) || "未設定"}</p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link to={`/events/${event.id}/edit`} className={subtleActionClass}>設定</Link>
                    <Link to={`/events/${event.id}/climbers`} className={subtleActionClass}>クライマー</Link>
                    <Link to={`/events/${event.id}/scores`} className={subtleActionClass}>スコア</Link>
                    <button type="button" onClick={() => handleDelete(event.id)} className={dangerButtonClass}>
                      🗑 イベント削除
                    </button>
                  </div>
                </section>
              ))}
            </div>
          )}
        </section>

        <div className="mt-8">
          <button type="button" onClick={handleLogout} className={plainButtonClass}>
            ログアウト
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

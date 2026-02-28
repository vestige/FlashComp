import { useEffect, useState } from "react";
import { db } from "../firebase";
import { useNavigate, Link } from "react-router-dom";
import { collection, getDocs } from "firebase/firestore";
import { usePageTitle } from "../hooks/usePageTitle";
import { useOwnerProfile } from "../hooks/useOwnerProfile";
import EventCreateForm from "../components/EventCreateForm";

function CreateEvent() {
  usePageTitle("イベント作成");

  const [gyms, setGyms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const {
    authUser,
    gymIds,
    hasAllGymAccess,
    loading: profileLoading,
    error: profileError,
  } = useOwnerProfile();

  useEffect(() => {
    if (profileLoading) return;
    if (profileError) {
      setError(profileError);
      setLoading(false);
      return;
    }

    const fetchGyms = async () => {
      setLoading(true);
      setError("");
      try {
        const gymSnap = await getDocs(collection(db, "gyms"));
        const gymRows = gymSnap.docs
          .map((gymDoc) => ({ id: gymDoc.id, ...gymDoc.data() }))
          .filter((gym) => hasAllGymAccess || gymIds.includes(gym.id))
          .sort((a, b) => (a.name || "").localeCompare(b.name || "", "ja"));
        setGyms(gymRows);
      } catch (err) {
        console.error("ジム一覧の取得に失敗:", err);
        setError("ジム一覧の取得に失敗しました。");
      } finally {
        setLoading(false);
      }
    };

    fetchGyms();
  }, [profileLoading, profileError, gymIds, hasAllGymAccess]);

  if (loading || profileLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <p className="text-sm text-slate-600">作成フォームを読み込んでいます...</p>
      </div>
    );
  }

  if (error || profileError) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#dbeafe_0%,_#f8fafc_45%,_#ecfeff_100%)]">
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error || profileError}
          </p>
          <Link
            to="/dashboard"
            className="mt-4 inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            ← ダッシュボードへ戻る
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#dbeafe_0%,_#f8fafc_45%,_#ecfeff_100%)]">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">Create New Event</h1>
            <p className="mt-2 text-base text-slate-600">
              大会の基本情報を設定し、新しいイベントを開始します。
            </p>
          </div>
          <Link
            to="/dashboard"
            className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            ← ダッシュボードへ戻る
          </Link>
        </div>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <EventCreateForm
            gyms={gyms}
            ownerUid={authUser?.uid || ""}
            submitLabel="Create Event"
            onCreated={() => navigate("/dashboard")}
          />
        </section>
      </div>
    </div>
  );
}

export default CreateEvent;

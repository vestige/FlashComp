import { useEffect, useState } from "react";
import { db } from "../firebase";
import { useNavigate, Link } from "react-router-dom";
import { collection, getDocs } from "firebase/firestore";
import { usePageTitle } from "../hooks/usePageTitle";
import { useOwnerProfile } from "../hooks/useOwnerProfile";
import EventCreateForm from "../components/EventCreateForm";
import ManagementHero from "../components/ManagementHero";
import {
  pageBackgroundClass,
  pageContainerNarrowClass,
  sectionCardClass,
  subtleButtonClass,
} from "../components/uiStyles";

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
      <div className={pageBackgroundClass}>
        <div className={pageContainerNarrowClass}>
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error || profileError}
          </p>
          <Link to="/dashboard" className={`mt-4 ${subtleButtonClass}`}>
            ← ダッシュボードへ戻る
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={pageBackgroundClass}>
      <div className={pageContainerNarrowClass}>
        <ManagementHero
          eyebrow="Event Setup"
          title="Create New Event"
          description="大会の基本情報を設定し、新しいイベントを開始します。"
          backTo="/dashboard"
          backLabel="← ダッシュボードへ戻る"
        />

        <section className={`mt-4 ${sectionCardClass}`}>
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

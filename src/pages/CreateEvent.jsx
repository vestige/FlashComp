import { useEffect, useState } from "react";
import { db } from "../firebase";
import { useNavigate, Link } from "react-router-dom";
import { collection, addDoc, getDocs, serverTimestamp, Timestamp } from "firebase/firestore";
import { usePageTitle } from "../hooks/usePageTitle";
import { useOwnerProfile } from "../hooks/useOwnerProfile";

function CreateEvent() {
  usePageTitle("イベント作成");

  const [name, setName] = useState("");
  const [gymId, setGymId] = useState("");
  const [gyms, setGyms] = useState([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState("");
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
        if (gymRows.length > 0) {
          setGymId((current) => current || gymRows[0].id);
        } else {
          setGymId("");
        }
      } catch (err) {
        console.error("ジム一覧の取得に失敗:", err);
        setError("ジム一覧の取得に失敗しました。");
      } finally {
        setLoading(false);
      }
    };

    fetchGyms();
  }, [profileLoading, profileError, gymIds, hasAllGymAccess]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!gymId) {
      setStatus("❌ 担当ジムを選択してください");
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      setStatus("❌ 開始日は終了日以前にしてください");
      return;
    }

    try {
      await addDoc(collection(db, "events"), {
        name,
        gymId,
        ownerUid: authUser?.uid || "",
        startDate: Timestamp.fromDate(new Date(startDate)),
        endDate: Timestamp.fromDate(new Date(endDate)),
        createdAt: serverTimestamp(),
      });
      setStatus("✅ イベントを作成しました！");
      setName("");
      navigate("/dashboard");
    } catch (err) {
      console.error(err);
      setStatus("❌ 作成に失敗しました");
    }
  };

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
          {gyms.length === 0 ? (
            <p className="text-sm text-slate-600">
              担当ジムが未設定のため、イベントを作成できません。システム管理者に設定を依頼してください。
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="grid gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-semibold text-slate-700">イベント名</label>
                <input
                  type="text"
                  placeholder="例: FlashComp Live 2026"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-semibold text-slate-700">開催ジム</label>
                <select
                  value={gymId}
                  onChange={(e) => setGymId(e.target.value)}
                  required
                  className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                >
                  {gyms.map((gym) => (
                    <option key={gym.id} value={gym.id}>
                      {gym.name || gym.id}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <label className="text-sm font-semibold text-slate-700">開始日</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                    className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-semibold text-slate-700">終了日</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                    className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="inline-flex items-center rounded-xl bg-emerald-800 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-900/15 transition hover:bg-emerald-900"
                >
                  Create Event
                </button>
              </div>
            </form>
          )}

          {status && (
            <p className={`mt-4 rounded-lg px-3 py-2 text-sm ${status.startsWith("✅") ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
              {status}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

export default CreateEvent;

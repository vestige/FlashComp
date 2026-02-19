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
  const { authUser, gymIds, loading: profileLoading, error: profileError } = useOwnerProfile();

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
          .filter((gym) => gymIds.includes(gym.id))
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
  }, [profileLoading, profileError, gymIds]);

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
    return <p style={{ padding: "2em" }}>作成フォームを読み込んでいます...</p>;
  }

  if (error || profileError) {
    return (
      <div style={{ padding: "2em" }}>
        <p>{error || profileError}</p>
        <Link to="/dashboard">← ダッシュボードへ戻る</Link>
      </div>
    );
  }

  return (
    <div style={{ padding: "2em" }}>
      <h2>🗓 イベント作成</h2>

      <Link to="/dashboard">← ダッシュボードへ戻る</Link>

      {gyms.length === 0 ? (
        <p style={{ marginTop: "1em" }}>
          担当ジムが未設定のため、イベントを作成できません。システム管理者に設定を依頼してください。
        </p>
      ) : (
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="イベント名"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <select
          value={gymId}
          onChange={(e) => setGymId(e.target.value)}
          required
        >
          {gyms.map((gym) => (
            <option key={gym.id} value={gym.id}>
              {gym.name || gym.id}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          required
        />
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          required
        />
        <button type="submit">作成</button>
      </form>
      )}
      <p>{status}</p>
    </div>
  );
}

export default CreateEvent;

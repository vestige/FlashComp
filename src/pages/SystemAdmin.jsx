import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import { usePageTitle } from "../hooks/usePageTitle";
import { useOwnerProfile } from "../hooks/useOwnerProfile";

const normalizeGymIds = (value) => {
  if (!Array.isArray(value)) return [];
  return value.filter((id) => typeof id === "string" && id.trim().length > 0);
};

const defaultGymForm = {
  id: "",
  name: "",
  city: "",
  prefecture: "",
};

const defaultOwnerForm = {
  id: "",
  email: "",
  name: "",
  role: "owner",
  gymIds: [],
};

const profileDocIdFromEmail = (email) => {
  return (email || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

const SystemAdmin = () => {
  usePageTitle("システム管理者");

  const { authUser, role, loading: profileLoading, error: profileError } = useOwnerProfile();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const [gyms, setGyms] = useState([]);
  const [events, setEvents] = useState([]);
  const [users, setUsers] = useState([]);

  const [gymForm, setGymForm] = useState(defaultGymForm);
  const [gymDrafts, setGymDrafts] = useState({});

  const [ownerForm, setOwnerForm] = useState(defaultOwnerForm);
  const [editingOwnerId, setEditingOwnerId] = useState("");

  const eventCountByGym = useMemo(() => {
    const map = new Map();
    for (const event of events) {
      const gymId = event.gymId || "";
      if (!gymId) continue;
      map.set(gymId, (map.get(gymId) || 0) + 1);
    }
    return map;
  }, [events]);

  const loadAdminData = async () => {
    setLoading(true);
    setError("");
    try {
      const [gymSnap, eventSnap, userSnap] = await Promise.all([
        getDocs(collection(db, "gyms")),
        getDocs(collection(db, "events")),
        getDocs(collection(db, "users")),
      ]);

      const gymRows = gymSnap.docs
        .map((gymDoc) => ({ id: gymDoc.id, ...gymDoc.data() }))
        .sort((a, b) => (a.name || "").localeCompare(b.name || "", "ja"));
      const eventRows = eventSnap.docs.map((eventDoc) => ({ id: eventDoc.id, ...eventDoc.data() }));
      const userRows = userSnap.docs
        .map((userDoc) => ({ id: userDoc.id, ...userDoc.data() }))
        .sort((a, b) => {
          const roleA = a.role || "";
          const roleB = b.role || "";
          if (roleA !== roleB) return roleA.localeCompare(roleB, "ja");
          return (a.email || a.id || "").localeCompare(b.email || b.id || "", "ja");
        });

      setGyms(gymRows);
      setEvents(eventRows);
      setUsers(userRows);

      const nextGymDrafts = {};
      for (const gym of gymRows) {
        nextGymDrafts[gym.id] = {
          name: gym.name || "",
          city: gym.city || "",
          prefecture: gym.prefecture || "",
        };
      }
      setGymDrafts(nextGymDrafts);
    } catch (err) {
      console.error("管理データの取得に失敗:", err);
      setError("管理データの取得に失敗しました。");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profileLoading) return;
    if (profileError) {
      setError(profileError);
      setLoading(false);
      return;
    }
    if (role !== "admin") {
      setLoading(false);
      return;
    }
    loadAdminData();
  }, [profileLoading, profileError, role]);

  const resetOwnerForm = () => {
    setOwnerForm(defaultOwnerForm);
    setEditingOwnerId("");
  };

  const handleCreateGym = async (e) => {
    e.preventDefault();
    const gymId = gymForm.id.trim();
    if (!gymId || !gymForm.name.trim()) {
      setStatus("❌ ジムIDとジム名は必須です。");
      return;
    }
    if (gyms.some((gym) => gym.id === gymId)) {
      setStatus("❌ そのジムIDはすでに使われています。");
      return;
    }

    try {
      await setDoc(doc(db, "gyms", gymId), {
        name: gymForm.name.trim(),
        city: gymForm.city.trim(),
        prefecture: gymForm.prefecture.trim(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setGymForm(defaultGymForm);
      setStatus("✅ ジムを登録しました。");
      await loadAdminData();
    } catch (err) {
      console.error("ジム登録に失敗:", err);
      setStatus("❌ ジム登録に失敗しました。");
    }
  };

  const handleUpdateGym = async (gymId) => {
    const draft = gymDrafts[gymId];
    if (!draft || !draft.name.trim()) {
      setStatus("❌ ジム名は必須です。");
      return;
    }

    try {
      await setDoc(
        doc(db, "gyms", gymId),
        {
          name: draft.name.trim(),
          city: draft.city.trim(),
          prefecture: draft.prefecture.trim(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setStatus(`✅ ジム(${gymId})を更新しました。`);
      await loadAdminData();
    } catch (err) {
      console.error("ジム更新に失敗:", err);
      setStatus("❌ ジム更新に失敗しました。");
    }
  };

  const handleDeleteGym = async (gymId) => {
    const relatedEvents = eventCountByGym.get(gymId) || 0;
    if (relatedEvents > 0) {
      setStatus(`❌ このジムにはイベントが ${relatedEvents} 件あるため削除できません。`);
      return;
    }
    if (!window.confirm(`ジム(${gymId})を削除します。よろしいですか？`)) return;

    try {
      await deleteDoc(doc(db, "gyms", gymId));
      setStatus(`✅ ジム(${gymId})を削除しました。`);
      await loadAdminData();
    } catch (err) {
      console.error("ジム削除に失敗:", err);
      setStatus("❌ ジム削除に失敗しました。");
    }
  };

  const handleSelectOwnerForEdit = (ownerProfile) => {
    setEditingOwnerId(ownerProfile.id);
    setOwnerForm({
      id: ownerProfile.id,
      email: ownerProfile.email || "",
      name: ownerProfile.name || "",
      role: ownerProfile.role === "admin" ? "admin" : "owner",
      gymIds: normalizeGymIds(ownerProfile.gymIds),
    });
  };

  const toggleOwnerGym = (gymId) => {
    setOwnerForm((prev) => {
      const hasGym = prev.gymIds.includes(gymId);
      return {
        ...prev,
        gymIds: hasGym ? prev.gymIds.filter((id) => id !== gymId) : [...prev.gymIds, gymId],
      };
    });
  };

  const handleSaveOwner = async (e) => {
    e.preventDefault();
    const email = ownerForm.email.trim().toLowerCase();
    if (!email) {
      setStatus("❌ オーナーのメールアドレスは必須です。");
      return;
    }

    const profileId = ownerForm.id.trim() || profileDocIdFromEmail(email);
    if (!profileId) {
      setStatus("❌ プロファイルIDを作成できませんでした。");
      return;
    }

    const roleValue = ownerForm.role === "admin" ? "admin" : "owner";
    const gymIdsValue = roleValue === "admin" ? ["*"] : normalizeGymIds(ownerForm.gymIds);
    if (roleValue === "owner" && gymIdsValue.length === 0) {
      setStatus("❌ owner の場合は担当ジムを1つ以上選択してください。");
      return;
    }

    const existing = users.find((user) => user.id === profileId);
    const payload = {
      email,
      name: ownerForm.name.trim(),
      role: roleValue,
      gymIds: gymIdsValue,
      updatedAt: serverTimestamp(),
    };
    if (existing?.uid) {
      payload.uid = existing.uid;
    }
    if (!existing) {
      payload.createdAt = serverTimestamp();
    }

    try {
      await setDoc(doc(db, "users", profileId), payload, { merge: true });
      setStatus(`✅ オーナープロファイル(${profileId})を保存しました。`);
      setEditingOwnerId(profileId);
      setOwnerForm((prev) => ({ ...prev, id: profileId }));
      await loadAdminData();
    } catch (err) {
      console.error("オーナープロファイル保存に失敗:", err);
      setStatus("❌ オーナープロファイル保存に失敗しました。");
    }
  };

  const handleDeleteOwner = async (ownerProfile) => {
    if (ownerProfile.id === authUser?.uid) {
      setStatus("❌ ログイン中の自分自身のプロファイルは削除できません。");
      return;
    }
    if (!window.confirm(`オーナープロファイル(${ownerProfile.id})を削除します。よろしいですか？`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, "users", ownerProfile.id));
      if (editingOwnerId === ownerProfile.id) {
        resetOwnerForm();
      }
      setStatus(`✅ オーナープロファイル(${ownerProfile.id})を削除しました。`);
      await loadAdminData();
    } catch (err) {
      console.error("オーナープロファイル削除に失敗:", err);
      setStatus("❌ オーナープロファイル削除に失敗しました。");
    }
  };

  if (profileLoading || loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <p className="text-sm text-slate-600">システム管理データを読み込んでいます...</p>
      </div>
    );
  }

  if (error || profileError) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error || profileError}
        </p>
        <Link
          to="/dashboard"
          className="mt-4 inline-flex items-center rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
        >
          ← ダッシュボードに戻る
        </Link>
      </div>
    );
  }

  if (role !== "admin") {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          このページはシステム管理者専用です。
        </p>
        <Link
          to="/dashboard"
          className="mt-4 inline-flex items-center rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
        >
          ← ダッシュボードに戻る
        </Link>
      </div>
    );
  }

  const sectionClass = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm";
  const inputClass =
    "w-full max-w-[560px] rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100";
  const actionButtonClass =
    "rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100";
  const primaryButtonClass =
    "rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-800 transition hover:bg-sky-100";
  const dangerButtonClass =
    "rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-100";

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#dbeafe_0%,_#f8fafc_45%,_#ecfeff_100%)]">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold text-slate-900">システム管理者</h2>
        <p className="mt-2 text-sm text-slate-600">ジム管理とオーナープロファイル管理を行います。</p>
        <p className="mt-2">
          <Link
            to="/dashboard"
            className="inline-flex items-center rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            ← オーナーダッシュボードに戻る
          </Link>
        </p>

        {status && <p className="mt-4 text-sm text-slate-700">{status}</p>}

        <section className={`${sectionClass} mt-4`}>
          <h3 className="text-lg font-semibold text-slate-900">ジム登録</h3>
          <form onSubmit={handleCreateGym} className="mt-3 grid gap-2">
            <input
              type="text"
              placeholder="ジムID (例: gym-shibuya)"
              value={gymForm.id}
              onChange={(e) => setGymForm((prev) => ({ ...prev, id: e.target.value }))}
              required
              className={inputClass}
            />
            <input
              type="text"
              placeholder="ジム名"
              value={gymForm.name}
              onChange={(e) => setGymForm((prev) => ({ ...prev, name: e.target.value }))}
              required
              className={inputClass}
            />
            <input
              type="text"
              placeholder="市区町村"
              value={gymForm.city}
              onChange={(e) => setGymForm((prev) => ({ ...prev, city: e.target.value }))}
              className={inputClass}
            />
            <input
              type="text"
              placeholder="都道府県"
              value={gymForm.prefecture}
              onChange={(e) => setGymForm((prev) => ({ ...prev, prefecture: e.target.value }))}
              className={inputClass}
            />
            <div>
              <button type="submit" className={primaryButtonClass}>ジムを登録</button>
            </div>
          </form>
        </section>

        <section className={`${sectionClass} mt-4`}>
          <h3 className="text-lg font-semibold text-slate-900">登録済みジム</h3>
          {gyms.length === 0 ? (
            <p className="mt-2 text-sm text-slate-600">ジムが未登録です。</p>
          ) : (
            <div className="mt-3 grid gap-3">
              {gyms.map((gym) => (
                <div key={gym.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="font-semibold text-slate-800">{gym.id}</p>
                  <div className="mt-2 grid gap-2">
                    <input
                      type="text"
                      value={gymDrafts[gym.id]?.name || ""}
                      onChange={(e) => setGymDrafts((prev) => ({
                        ...prev,
                        [gym.id]: { ...prev[gym.id], name: e.target.value },
                      }))}
                      placeholder="ジム名"
                      className={inputClass}
                    />
                    <input
                      type="text"
                      value={gymDrafts[gym.id]?.city || ""}
                      onChange={(e) => setGymDrafts((prev) => ({
                        ...prev,
                        [gym.id]: { ...prev[gym.id], city: e.target.value },
                      }))}
                      placeholder="市区町村"
                      className={inputClass}
                    />
                    <input
                      type="text"
                      value={gymDrafts[gym.id]?.prefecture || ""}
                      onChange={(e) => setGymDrafts((prev) => ({
                        ...prev,
                        [gym.id]: { ...prev[gym.id], prefecture: e.target.value },
                      }))}
                      placeholder="都道府県"
                      className={inputClass}
                    />
                  </div>
                  <p className="mt-3 text-sm text-slate-600">
                    関連イベント数: {eventCountByGym.get(gym.id) || 0}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button type="button" onClick={() => handleUpdateGym(gym.id)} className={actionButtonClass}>更新</button>
                    <button type="button" onClick={() => handleDeleteGym(gym.id)} className={dangerButtonClass}>削除</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className={`${sectionClass} mt-4`}>
          <h3 className="text-lg font-semibold text-slate-900">ジムオーナープロファイル管理</h3>
          <form onSubmit={handleSaveOwner} className="mt-3 grid gap-2">
            <input
              type="text"
              placeholder="プロファイルID（空欄ならメールから自動生成）"
              value={ownerForm.id}
              onChange={(e) => setOwnerForm((prev) => ({ ...prev, id: e.target.value }))}
              className="w-full max-w-[700px] rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            />
            <input
              type="email"
              placeholder="メールアドレス"
              value={ownerForm.email}
              onChange={(e) => setOwnerForm((prev) => ({ ...prev, email: e.target.value }))}
              required
              className="w-full max-w-[700px] rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            />
            <input
              type="text"
              placeholder="表示名"
              value={ownerForm.name}
              onChange={(e) => setOwnerForm((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full max-w-[700px] rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            />
            <div className="flex flex-wrap gap-4">
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="radio"
                  name="owner-role"
                  checked={ownerForm.role === "owner"}
                  onChange={() => setOwnerForm((prev) => ({ ...prev, role: "owner" }))}
                />
                owner（担当ジムのみ）
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="radio"
                  name="owner-role"
                  checked={ownerForm.role === "admin"}
                  onChange={() => setOwnerForm((prev) => ({ ...prev, role: "admin", gymIds: ["*"] }))}
                />
                admin（全ジム）
              </label>
            </div>

            {ownerForm.role === "owner" && (
              <div>
                <p className="mb-2 text-sm text-slate-700">担当ジム（複数可）</p>
                <div className="flex flex-wrap gap-3">
                  {gyms.map((gym) => (
                    <label key={gym.id} className="inline-flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={ownerForm.gymIds.includes(gym.id)}
                        onChange={() => toggleOwnerGym(gym.id)}
                      />
                      {gym.name || gym.id}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button type="submit" className={primaryButtonClass}>
                {editingOwnerId ? `プロファイルを更新 (${editingOwnerId})` : "新規プロファイルを保存"}
              </button>
              <button type="button" onClick={resetOwnerForm} className={actionButtonClass}>フォームをリセット</button>
            </div>
          </form>

          <h4 className="mt-5 text-base font-semibold text-slate-900">登録済みオーナープロファイル</h4>
          {users.length === 0 ? (
            <p className="mt-2 text-sm text-slate-600">プロファイルがありません。</p>
          ) : (
            <div className="mt-3 grid gap-3">
              {users.map((userProfile) => (
                <div
                  key={userProfile.id}
                  className={`rounded-xl border p-4 ${
                    editingOwnerId === userProfile.id
                      ? "border-sky-200 bg-sky-50"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <p className="text-sm text-slate-800">
                    <strong>{userProfile.email || "(no email)"}</strong> / role: {userProfile.role || "-"}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    profileId: {userProfile.id} / gymIds: {JSON.stringify(normalizeGymIds(userProfile.gymIds))}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button type="button" onClick={() => handleSelectOwnerForEdit(userProfile)} className={actionButtonClass}>編集</button>
                    <button type="button" onClick={() => handleDeleteOwner(userProfile)} className={dangerButtonClass}>削除</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default SystemAdmin;

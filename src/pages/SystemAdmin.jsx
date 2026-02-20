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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    return <p style={{ padding: "2em" }}>システム管理データを読み込んでいます...</p>;
  }

  if (error || profileError) {
    return (
      <div style={{ padding: "2em" }}>
        <p>{error || profileError}</p>
        <Link to="/dashboard">← ダッシュボードに戻る</Link>
      </div>
    );
  }

  if (role !== "admin") {
    return (
      <div style={{ padding: "2em" }}>
        <p>このページはシステム管理者専用です。</p>
        <Link to="/dashboard">← ダッシュボードに戻る</Link>
      </div>
    );
  }

  return (
    <div style={{ padding: "1.5em", maxWidth: "1100px", margin: "0 auto" }}>
      <h2>システム管理者</h2>
      <p>ジム管理とオーナープロファイル管理を行います。</p>
      <p style={{ marginTop: 0 }}>
        <Link to="/dashboard">← オーナーダッシュボードに戻る</Link>
      </p>

      <p style={{ marginTop: "1em" }}>{status}</p>

      <section style={{ border: "1px solid #ddd", borderRadius: "10px", padding: "1em" }}>
        <h3 style={{ marginTop: 0 }}>ジム登録</h3>
        <form onSubmit={handleCreateGym} style={{ display: "grid", gap: "0.6em", maxWidth: "560px" }}>
          <input
            type="text"
            placeholder="ジムID (例: gym-shibuya)"
            value={gymForm.id}
            onChange={(e) => setGymForm((prev) => ({ ...prev, id: e.target.value }))}
            required
          />
          <input
            type="text"
            placeholder="ジム名"
            value={gymForm.name}
            onChange={(e) => setGymForm((prev) => ({ ...prev, name: e.target.value }))}
            required
          />
          <input
            type="text"
            placeholder="市区町村"
            value={gymForm.city}
            onChange={(e) => setGymForm((prev) => ({ ...prev, city: e.target.value }))}
          />
          <input
            type="text"
            placeholder="都道府県"
            value={gymForm.prefecture}
            onChange={(e) => setGymForm((prev) => ({ ...prev, prefecture: e.target.value }))}
          />
          <button type="submit">ジムを登録</button>
        </form>
      </section>

      <section style={{ border: "1px solid #ddd", borderRadius: "10px", padding: "1em", marginTop: "1em" }}>
        <h3 style={{ marginTop: 0 }}>登録済みジム</h3>
        {gyms.length === 0 ? (
          <p>ジムが未登録です。</p>
        ) : (
          <div style={{ display: "grid", gap: "0.8em" }}>
            {gyms.map((gym) => (
              <div key={gym.id} style={{ border: "1px solid #eee", borderRadius: "8px", padding: "0.8em" }}>
                <p style={{ marginTop: 0, marginBottom: "0.5em", fontWeight: "bold" }}>{gym.id}</p>
                <div style={{ display: "grid", gap: "0.5em", maxWidth: "560px" }}>
                  <input
                    type="text"
                    value={gymDrafts[gym.id]?.name || ""}
                    onChange={(e) => setGymDrafts((prev) => ({
                      ...prev,
                      [gym.id]: { ...prev[gym.id], name: e.target.value },
                    }))}
                    placeholder="ジム名"
                  />
                  <input
                    type="text"
                    value={gymDrafts[gym.id]?.city || ""}
                    onChange={(e) => setGymDrafts((prev) => ({
                      ...prev,
                      [gym.id]: { ...prev[gym.id], city: e.target.value },
                    }))}
                    placeholder="市区町村"
                  />
                  <input
                    type="text"
                    value={gymDrafts[gym.id]?.prefecture || ""}
                    onChange={(e) => setGymDrafts((prev) => ({
                      ...prev,
                      [gym.id]: { ...prev[gym.id], prefecture: e.target.value },
                    }))}
                    placeholder="都道府県"
                  />
                </div>
                <p style={{ marginBottom: "0.6em" }}>
                  関連イベント数: {eventCountByGym.get(gym.id) || 0}
                </p>
                <div style={{ display: "flex", gap: "0.6em", flexWrap: "wrap" }}>
                  <button type="button" onClick={() => handleUpdateGym(gym.id)}>更新</button>
                  <button type="button" onClick={() => handleDeleteGym(gym.id)}>削除</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={{ border: "1px solid #ddd", borderRadius: "10px", padding: "1em", marginTop: "1em" }}>
        <h3 style={{ marginTop: 0 }}>ジムオーナープロファイル管理</h3>
        <form onSubmit={handleSaveOwner} style={{ display: "grid", gap: "0.6em", maxWidth: "700px" }}>
          <input
            type="text"
            placeholder="プロファイルID（空欄ならメールから自動生成）"
            value={ownerForm.id}
            onChange={(e) => setOwnerForm((prev) => ({ ...prev, id: e.target.value }))}
          />
          <input
            type="email"
            placeholder="メールアドレス"
            value={ownerForm.email}
            onChange={(e) => setOwnerForm((prev) => ({ ...prev, email: e.target.value }))}
            required
          />
          <input
            type="text"
            placeholder="表示名"
            value={ownerForm.name}
            onChange={(e) => setOwnerForm((prev) => ({ ...prev, name: e.target.value }))}
          />
          <div style={{ display: "flex", gap: "1em", flexWrap: "wrap" }}>
            <label>
              <input
                type="radio"
                name="owner-role"
                checked={ownerForm.role === "owner"}
                onChange={() => setOwnerForm((prev) => ({ ...prev, role: "owner" }))}
              />
              owner（担当ジムのみ）
            </label>
            <label>
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
              <p style={{ marginBottom: "0.4em" }}>担当ジム（複数可）</p>
              <div style={{ display: "flex", gap: "0.8em", flexWrap: "wrap" }}>
                {gyms.map((gym) => (
                  <label key={gym.id}>
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

          <div style={{ display: "flex", gap: "0.6em", flexWrap: "wrap" }}>
            <button type="submit">
              {editingOwnerId ? `プロファイルを更新 (${editingOwnerId})` : "新規プロファイルを保存"}
            </button>
            <button type="button" onClick={resetOwnerForm}>フォームをリセット</button>
          </div>
        </form>

        <h4 style={{ marginTop: "1.2em" }}>登録済みオーナープロファイル</h4>
        {users.length === 0 ? (
          <p>プロファイルがありません。</p>
        ) : (
          <div style={{ display: "grid", gap: "0.7em" }}>
            {users.map((userProfile) => (
              <div
                key={userProfile.id}
                style={{
                  border: "1px solid #eee",
                  borderRadius: "8px",
                  padding: "0.8em",
                  background: editingOwnerId === userProfile.id ? "#f8f8f8" : "#fff",
                }}
              >
                <p style={{ marginTop: 0, marginBottom: "0.3em" }}>
                  <strong>{userProfile.email || "(no email)"}</strong> / role: {userProfile.role || "-"}
                </p>
                <p style={{ marginTop: 0, marginBottom: "0.5em" }}>
                  profileId: {userProfile.id} / gymIds: {JSON.stringify(normalizeGymIds(userProfile.gymIds))}
                </p>
                <div style={{ display: "flex", gap: "0.6em", flexWrap: "wrap" }}>
                  <button type="button" onClick={() => handleSelectOwnerForEdit(userProfile)}>編集</button>
                  <button type="button" onClick={() => handleDeleteOwner(userProfile)}>削除</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default SystemAdmin;

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

const normalizeGymIds = (value) => {
  if (!Array.isArray(value)) return [];
  return value.filter((id) => typeof id === "string" && id.trim().length > 0);
};

export const useOwnerProfile = () => {
  const [authUser, setAuthUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        if (!cancelled) {
          setAuthUser(null);
          setProfile(null);
          setError("");
          setLoading(false);
        }
        return;
      }

      if (!cancelled) {
        setAuthUser(user);
        setLoading(true);
        setError("");
      }

      try {
        const profileRef = doc(db, "users", user.uid);
        const profileSnap = await getDoc(profileRef);

        if (profileSnap.exists()) {
          if (!cancelled) {
            setProfile({ id: profileSnap.id, ...profileSnap.data() });
            setLoading(false);
          }
          return;
        }
        if (!cancelled) {
          setProfile(null);
          setLoading(false);
        }
      } catch (err) {
        console.error("オーナープロファイルの取得に失敗:", err);
        if (!cancelled) {
          setError("オーナープロファイルの取得に失敗しました。");
          setProfile(null);
          setLoading(false);
        }
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const gymIds = useMemo(() => normalizeGymIds(profile?.gymIds), [profile]);
  const role = typeof profile?.role === "string" ? profile.role : "";
  const hasAllGymAccess = useMemo(
    () => role === "admin" || gymIds.includes("*"),
    [role, gymIds]
  );

  const canAccessGym = (gymId) => hasAllGymAccess || gymIds.includes(gymId);

  return {
    authUser,
    profile,
    gymIds,
    role,
    hasAllGymAccess,
    canAccessGym,
    loading,
    error,
  };
};

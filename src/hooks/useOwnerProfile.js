import { useCallback, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";
import {
  ensureOwnerProfile,
  normalizeGymIds,
  getOwnerProfileSnapshot,
  subscribeOwnerProfile,
} from "../lib/ownerProfileService";

export const useOwnerProfile = () => {
  const [authUser, setAuthUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refreshProfile = useCallback(async () => {
    if (!authUser?.uid) return;
    try {
      const nextProfile = await getOwnerProfileSnapshot(authUser.uid);
      if (nextProfile?.id) {
        setError("");
      } else {
        setError("ユーザープロファイルが見つかりません。");
      }
      setProfile(nextProfile);
    } catch (err) {
      console.error("オーナープロファイルの再取得に失敗:", err);
      setError("オーナープロファイルの取得に失敗しました。");
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [authUser?.uid]);

  useEffect(() => {
    let cancelled = false;
    let unsubscribeProfile = null;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        if (!cancelled) {
          setAuthUser(null);
          setProfile(null);
          setError("");
          setLoading(false);
        }
        if (unsubscribeProfile) {
          unsubscribeProfile();
          unsubscribeProfile = null;
        }
        return;
      }

      if (!cancelled) {
        setAuthUser(user);
        setLoading(true);
        setError("");
      }

      try {
        await ensureOwnerProfile(user);
      } catch (err) {
        if (!cancelled) {
          setError(
            "ユーザープロファイルの初期化に失敗しました。権限がある管理者アカウントで `users/{uid}` を先に登録してください。"
          );
        }
      }

      if (unsubscribeProfile) {
        unsubscribeProfile();
      }

      unsubscribeProfile = subscribeOwnerProfile(
        user.uid,
        (nextProfile) => {
          if (cancelled) return;
          if (nextProfile?.id) {
            setError("");
          }
          setProfile(nextProfile);
          setLoading(false);
        },
        (err) => {
          console.error("オーナープロファイルの取得に失敗:", err);
          if (cancelled) return;
          setError("オーナープロファイルの取得に失敗しました。");
          setProfile(null);
          setLoading(false);
        }
      );
    });

    return () => {
      cancelled = true;
      unsubscribe();
      if (unsubscribeProfile) {
        unsubscribeProfile();
      }
    };
  }, []);

  const gymIds = useMemo(() => normalizeGymIds(profile?.gymIds), [profile]);
  const role = typeof profile?.role === "string" ? profile.role : "";
  const canManageEvents = role === "owner" || role === "admin";
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
    canManageEvents,
    hasAllGymAccess,
    canAccessGym,
    refreshProfile,
    loading,
    error,
  };
};

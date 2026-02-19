import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
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

        // Fallback for existing projects where profile doc key is not uid.
        const byEmail = user.email
          ? await getDocs(query(collection(db, "users"), where("email", "==", user.email)))
          : null;

        if (!cancelled) {
          if (byEmail && !byEmail.empty) {
            const first = byEmail.docs[0];
            setProfile({ id: first.id, ...first.data() });
          } else {
            setProfile({
              id: user.uid,
              uid: user.uid,
              email: user.email || "",
              role: "owner",
              gymIds: [],
            });
          }
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

  return {
    authUser,
    profile,
    gymIds,
    loading,
    error,
  };
};


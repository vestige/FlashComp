import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../firebase";

export const normalizeGymIds = (value) => {
  if (!Array.isArray(value)) return [];
  return value.filter((id) => typeof id === "string" && id.trim().length > 0);
};

export const pickProfileFromDoc = (snapshot) => {
  if (!snapshot?.exists || !snapshot.exists()) return null;

  const raw = snapshot.data() || {};
  return {
    id: snapshot.id,
    role: typeof raw.role === "string" ? raw.role : "",
    email: typeof raw.email === "string" ? raw.email : "",
    name: typeof raw.name === "string" ? raw.name : "",
    gymIds: normalizeGymIds(raw.gymIds),
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    raw,
  };
};

export const userProfileRef = (uid) => doc(db, "users", uid);

export const getOwnerProfileSnapshot = async (uid) => {
  const snapshot = await getDoc(userProfileRef(uid));
  return pickProfileFromDoc(snapshot);
};

export const subscribeOwnerProfile = (uid, onChange, onError) =>
  onSnapshot(
    userProfileRef(uid),
    (snapshot) => onChange(pickProfileFromDoc(snapshot)),
    onError
  );

export const ensureOwnerProfile = async (authUser, options = {}) => {
  const { fallbackRole = "viewer", fallbackGymIds = [] } = options;
  if (!authUser?.uid) return;

  const ref = userProfileRef(authUser.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return;

  await setDoc(
    ref,
    {
      role: fallbackRole,
      gymIds: normalizeGymIds(fallbackGymIds),
      email: authUser.email || "",
      name: authUser.displayName || "",
      uid: authUser.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
};

import { deleteApp, initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, signOut } from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  setDoc,
  terminate,
  where,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "AIzaSyBIfGyeHMc_0LPtX5qbeqQrabX6wXvs_kI",
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || "flashcompauth.firebaseapp.com",
  projectId: process.env.FIREBASE_PROJECT_ID || "flashcompauth",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "flashcompauth.appspot.com",
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "466092936876",
  appId: process.env.FIREBASE_APP_ID || "1:466092936876:web:0ab1780cc4fc96327a5909",
};

const app = initializeApp(firebaseConfig, "verify-owner-access");
const auth = getAuth(app);
const db = getFirestore(app);

const ownerEmail = process.env.OWNER_EMAIL || "";
const ownerPassword = process.env.OWNER_PASSWORD || "";
const explicitAllowedGymId = process.env.ALLOWED_GYM_ID || "";
const explicitDeniedGymId = process.env.DENIED_GYM_ID || "";
const explicitGymIdsRaw = process.env.OWNER_GYM_IDS || "";

const sampleProfilesByEmail = {
  "owner.shibuya@example.com": { role: "owner", gymIds: ["gym-shibuya"] },
  "owner.yokohama@example.com": { role: "owner", gymIds: ["gym-yokohama"] },
  "owner.multi@example.com": { role: "admin", gymIds: ["*"] },
  "vestige_sync@me.com": { role: "admin", gymIds: ["*"] },
};

function pickDeniedGymId(gymIds, preferred) {
  if (preferred && !gymIds.includes(preferred)) return preferred;
  const candidates = ["gym-shibuya", "gym-yokohama"];
  for (const candidate of candidates) {
    if (!gymIds.includes(candidate)) return candidate;
  }
  return "gym-denied-sample";
}

function normalizeGymIds(raw) {
  if (!raw) return [];
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function getGymIdsFromProfile(profile) {
  return Array.isArray(profile?.gymIds)
    ? profile.gymIds.filter((id) => typeof id === "string" && id.trim().length > 0)
    : [];
}

function hasAllGymAccess(profile, gymIds) {
  return profile?.role === "admin" || gymIds.includes("*");
}

async function verifyWriteScope(uid, profile) {
  const gymIds = getGymIdsFromProfile(profile);
  const allGymAccess = hasAllGymAccess(profile, gymIds);

  if (!allGymAccess && gymIds.length === 0) {
    console.log("[fail] gymIds is empty. Owner cannot manage events.");
    process.exit(1);
  }

  const allowedGymId = explicitAllowedGymId || (allGymAccess ? "gym-shibuya" : gymIds[0]);
  console.log(`[step] create event in allowed gym (${allowedGymId}) should succeed`);
  const allowedDoc = await addDoc(collection(db, "events"), {
    name: `verify-allowed-${Date.now()}`,
    gymId: allowedGymId,
    ownerUid: uid,
    startDate: new Date(),
    endDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });
  console.log(`[ok] allowed write success docId=${allowedDoc.id}`);

  await deleteDoc(allowedDoc);
  console.log("[ok] cleanup for allowed event done");

  if (allGymAccess) {
    const extraGymId = explicitDeniedGymId || "gym-yokohama";
    console.log(`[step] full gym access check (${extraGymId}) should succeed`);
    const fullDoc = await addDoc(collection(db, "events"), {
      name: `verify-full-access-${Date.now()}`,
      gymId: extraGymId,
      ownerUid: uid,
      startDate: new Date(),
      endDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    console.log(`[ok] full access write success docId=${fullDoc.id}`);
    await deleteDoc(fullDoc);
    console.log("[ok] cleanup for full access event done");
    console.log("Owner access verification passed.");
    return;
  }

  const deniedGymId = pickDeniedGymId(gymIds, explicitDeniedGymId);
  console.log(`[step] create event in denied gym (${deniedGymId}) should fail`);
  let deniedWriteBlocked = false;
  try {
    const deniedDoc = await addDoc(collection(db, "events"), {
      name: `verify-denied-${Date.now()}`,
      gymId: deniedGymId,
      ownerUid: uid,
      startDate: new Date(),
      endDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    console.log(`[warn] denied write unexpectedly succeeded docId=${deniedDoc.id}`);
    await deleteDoc(deniedDoc);
  } catch (err) {
    if (err?.code === "permission-denied") {
      deniedWriteBlocked = true;
      console.log("[ok] denied write was blocked by Firestore rules");
    } else {
      console.log(`[fail] unexpected error: ${err?.code || err?.message || err}`);
      process.exit(1);
    }
  }

  if (!deniedWriteBlocked) {
    console.log("[fail] denied write was not blocked. Rules may not be deployed yet.");
    process.exit(1);
  }

  console.log("Owner access verification passed.");
}

async function run() {
  if (!ownerEmail || !ownerPassword) {
    console.log("Missing OWNER_EMAIL / OWNER_PASSWORD");
    console.log("Example:");
    console.log(
      "$env:OWNER_EMAIL='owner.shibuya@example.com'; $env:OWNER_PASSWORD='YOUR_PASSWORD'; npm run verify:owner-access"
    );
    process.exit(1);
  }

  console.log(`[step] sign in as ${ownerEmail}`);
  const credential = await signInWithEmailAndPassword(auth, ownerEmail, ownerPassword);
  const uid = credential.user.uid;
  console.log(`[ok] signed in uid=${uid}`);

  console.log("[step] check users/{uid}");
  const profileRef = doc(db, "users", uid);
  let profileSnap = await getDoc(profileRef);

  if (!profileSnap.exists()) {
    console.log("[warn] users/{uid} does not exist. try migration from users by email...");
    const emailQuery = query(collection(db, "users"), where("email", "==", ownerEmail));
    const byEmail = await getDocs(emailQuery);
    if (byEmail.empty) {
      const envGymIds = normalizeGymIds(explicitGymIdsRaw);
      const fallbackProfile = sampleProfilesByEmail[ownerEmail] || { role: "owner", gymIds: [] };
      const bootstrapGymIds = envGymIds.length > 0 ? envGymIds : fallbackProfile.gymIds;
      const bootstrapRole = fallbackProfile.role || "owner";
      const canBootstrap = bootstrapRole === "admin" || bootstrapGymIds.length > 0;

      if (!canBootstrap) {
        console.log("[fail] email matching profile not found in users collection.");
        console.log("Set OWNER_GYM_IDS then run again. Example:");
        console.log(
          "$env:OWNER_GYM_IDS='gym-shibuya'; npm run verify:owner-access"
        );
        process.exit(1);
      }

      await setDoc(
        profileRef,
        {
          uid,
          email: ownerEmail,
          role: bootstrapRole,
          gymIds: bootstrapGymIds,
          bootstrapSource: "verify-script",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        { merge: true }
      );
      profileSnap = await getDoc(profileRef);
      if (!profileSnap.exists()) {
        console.log("[fail] bootstrap users/{uid} failed.");
        process.exit(1);
      }
      console.log(`[ok] users/{uid} bootstrapped with gymIds=${JSON.stringify(bootstrapGymIds)}`);
      await verifyWriteScope(uid, profileSnap.data());
      return;
    }

    const legacy = byEmail.docs[0];
    const legacyData = legacy.data();
    const migratedGymIds = Array.isArray(legacyData.gymIds)
      ? legacyData.gymIds.filter((id) => typeof id === "string" && id.trim().length > 0)
      : [];
    await setDoc(
      profileRef,
      {
        ...legacyData,
        uid,
        email: ownerEmail,
        gymIds: migratedGymIds,
        migratedFromProfileId: legacy.id,
        updatedAt: new Date(),
      },
      { merge: true }
    );
    profileSnap = await getDoc(profileRef);
    if (!profileSnap.exists()) {
      console.log("[fail] migration to users/{uid} failed.");
      process.exit(1);
    }
    console.log("[ok] users/{uid} migrated from email profile");
  }

  const profile = profileSnap.data();
  const gymIds = getGymIdsFromProfile(profile);
  console.log(`[ok] users/{uid} exists role=${profile.role || "-"} gymIds=${JSON.stringify(gymIds)}`);
  await verifyWriteScope(uid, profile);
}

run()
  .catch((error) => {
    console.error("Owner access verification failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      if (auth.currentUser) {
        await signOut(auth);
      }
    } catch {
      // Best effort cleanup.
    }

    try {
      await terminate(db);
    } catch {
      // Best effort cleanup.
    }

    try {
      await deleteApp(app);
    } catch {
      // Best effort cleanup.
    }

    process.exit(process.exitCode ?? 0);
  });

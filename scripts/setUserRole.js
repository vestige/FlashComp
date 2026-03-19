import { getDoc, getDocs, query, setDoc, serverTimestamp, where, collection, doc } from "firebase/firestore";
import { cleanupScriptFirebase, db, signInForScripts } from "./firestoreClient.js";

function readArgValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index < 0 || index + 1 >= process.argv.length) return "";
  return process.argv[index + 1] || "";
}

function hasArg(flag) {
  return process.argv.includes(flag);
}

function splitCsv(value) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function parseGymIds(raw) {
  if (!raw) {
    return [];
  }

  const normalized = raw.trim();
  if (normalized === "*") {
    return ["*"];
  }

  const ids = splitCsv(normalized);
  return ids.length > 0 ? ids : ["*"];
}

function parseGymIdsForRole(role, raw) {
  if (role === "admin") {
    return parseGymIds(raw || "*");
  }

  const values = splitCsv(raw || "");
  return values;
}

function printUsage() {
  console.log("Usage:");
  console.log(
    "node scripts/setUserRole.js --env <demo|prod> --uid <userUid> --role admin --gym-ids '*'"
  );
  console.log("or");
  console.log("node scripts/setUserRole.js --env demo --email <userEmail> --uid <userUid> --role admin --gym-ids '*'"
  );
  console.log(
    "or if Firestore already has users/{uid} with email field:"
  );
  console.log("node scripts/setUserRole.js --env demo --email <userEmail> --role admin --gym-ids '*'" );
}

async function resolveTargetUid(db, email, explicitUid) {
  if (explicitUid) {
    return explicitUid;
  }

  if (!email) {
    return "";
  }

  const users = await getDocs(
    query(collection(db, "users"), where("email", "==", email))
  );

  if (users.empty) {
    return "";
  }

  if (users.size > 1) {
    console.warn(
      `Multiple users found for email=${email}. Using first match (${users.docs[0].id}).`
    );
  }

  return users.docs[0].id;
}

async function run() {
  const role = readArgValue("--role") || "admin";
  const envUid = readArgValue("--uid");
  const email = readArgValue("--email");
  const gymIdsRaw = readArgValue("--gym-ids");
  const createIfMissing = hasArg("--create");

  if (!role) {
    console.error("--role is required (admin|owner|viewer). Use --role admin to run format-safe flow.");
    printUsage();
    process.exit(1);
  }

  if (role !== "admin" && role !== "owner" && role !== "viewer") {
    console.error(`Unsupported role: ${role}. Use admin, owner, or viewer.`);
    printUsage();
    process.exit(1);
  }

  if (!envUid && !email) {
    console.error("Either --uid or --email is required.");
    printUsage();
    process.exit(1);
  }

  const uid = await resolveTargetUid(db, email, envUid);
  if (!uid) {
    console.error(
      `Cannot resolve target uid for email=${email || "(empty)"}. Provide --uid explicitly or create users/{uid} document first.`
    );
    console.error(
      "Tip: Firebase Console > Authentication > Users で uid をコピーして --uid へ渡すと確実です。"
    );
    process.exit(1);
  }

  const targetRef = doc(db, "users", uid);
  const targetSnap = await getDoc(targetRef);

  const actor = await signInForScripts();
  if (!actor) {
    console.error("Script auth required. Set SCRIPT_AUTH_EMAIL / SCRIPT_AUTH_PASSWORD and try again.");
    process.exit(1);
  }

  if (bootstrapSelf && actor.uid !== uid) {
    console.error("--bootstrap-self can only be used when target uid equals signed-in uid.");
    console.error(`actor=${actor.uid}, target=${uid}`);
    process.exit(1);
  }

  const actorRef = doc(db, "users", actor.uid);
  const actorSnap = await getDoc(actorRef);
  const actorData = actorSnap.exists() ? actorSnap.data() : {};
  const actorRole = actorData.role;
  const actorGymIds = Array.isArray(actorData.gymIds)
    ? actorData.gymIds.filter((id) => typeof id === "string" && id.trim().length > 0)
    : [];

  if (actorRole !== "admin" && !actorGymIds.includes("*")) {
    console.error(`Actor users/${actor.uid} is not admin. role=${actorRole || "unset"}`);
    process.exit(1);
  }

  if (!targetSnap.exists() && !createIfMissing) {
    console.error(`users/${uid} does not exist. Add --create to create this document first.`);
    process.exit(1);
  }

  const targetGymIds = parseGymIdsForRole(role, gymIdsRaw);
  if (role !== "admin" && targetGymIds.length === 0) {
    console.error(`role=${role} requires --gym-ids for non-admin users.`);
    process.exit(1);
  }

  if (createIfMissing && targetGymIds.length === 0) {
    console.error("gymIds must be provided for create path.");
    process.exit(1);
  }

  const payload = {
    uid,
    role,
    gymIds: targetGymIds,
    updatedAt: serverTimestamp(),
    updatedBy: actor.email || actor.uid,
  };

  if (email) {
    payload.email = email;
  }

  if (!targetSnap.exists()) {
    payload.createdAt = serverTimestamp();
  }

  await setDoc(targetRef, payload, { merge: true });

  console.log("Upserted users document successfully.");
  console.log(`uid=${uid}`);
  console.log(`role=${role}`);
  console.log(`gymIds=${JSON.stringify(targetGymIds)}`);
}

run()
  .catch((error) => {
    if (error?.code === "permission-denied") {
      console.error("Failed to set user role due permission-denied.");
      console.error(
        "This means the target users document is not writable under current Firestore rules."
      );
      console.error(
        "A self-bootstrap admin change is not permitted unless rules allow it, or you already run this from an existing admin account."
      );
      console.error(
        "Recommended recovery: create users/<SCRIPT_AUTH_UID> as admin and gymIds ['*'] once in Firebase Console, then rerun this command."
      );
    } else {
      console.error("Failed to set user role:", error);
    }
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanupScriptFirebase();
    process.exit(process.exitCode ?? 0);
  });

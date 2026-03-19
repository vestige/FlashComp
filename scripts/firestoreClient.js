import { existsSync, readFileSync } from "node:fs";
import { deleteApp, initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { getFirestore, terminate } from "firebase/firestore";

function readArgValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index < 0 || index + 1 >= process.argv.length) return "";
  return process.argv[index + 1] || "";
}

function resolveScriptEnv() {
  const envArg = readArgValue("--env");
  const modeArg = readArgValue("--mode");
  const explicit = String(envArg || modeArg || "").trim().toLowerCase();

  if (explicit === "prod" || explicit === "production") return "prod";
  if (explicit === "demo") return "demo";
  if (explicit === "stg" || explicit === "staging") return "staging";

  return "";
}

function normalizeEnvValue(rawValue) {
  if (typeof rawValue !== "string") return "";
  const value = rawValue.trim();
  if (
    (value.startsWith("\"") && value.endsWith("\"")) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1).trim();
  }
  return value;
}

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;

  const raw = readFileSync(filePath, "utf8");
  const lines = raw.split(/\r?\n/);

  for (const line of lines) {
    const text = line.trim();
    if (!text || text.startsWith("#")) continue;

    const matches = text.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!matches) continue;

    const key = matches[1];
    const value = normalizeEnvValue(matches[2]);

    if (!Object.prototype.hasOwnProperty.call(process.env, key)) {
      process.env[key] = value;
    }
  }
}

function loadScriptEnv(scriptEnv) {
  const envSuffix = scriptEnv ? scriptEnv.toLowerCase() : "";
  const explicit = envSuffix;
  const candidates = [];

  if (envSuffix) {
    candidates.push(`.env.${envSuffix}.local`);
    candidates.push(`.env.${envSuffix}`);
    candidates.push(`.env.${envSuffix.toUpperCase()}.local`);
    candidates.push(`.env.${envSuffix.toUpperCase()}`);
    if (envSuffix === "prod") {
      candidates.push(".env.staging.local");
      candidates.push(".env.staging");
      candidates.push(".env.stg.local");
      candidates.push(".env.stg");
    }
    if (envSuffix === "demo") {
      candidates.push(".env.dev.local");
      candidates.push(".env.dev");
    }
  }

  candidates.push(".env.local");
  candidates.push(".env");

  for (const filePath of candidates) {
    loadEnvFile(filePath);
  }

  if (explicit) {
    const suffixUpper = explicit.toUpperCase();
    const legacySuffixGroups = {
      PROD: ["PROD", "PRODUCTION", "STAGING", "STG"],
      PRODUCTION: ["PROD", "PRODUCTION", "STAGING", "STG"],
      STAGING: ["STAGING", "STG", "PROD", "PRODUCTION"],
      STG: ["STG", "STAGING", "PROD", "PRODUCTION"],
      DEMO: ["DEMO", "DEV"],
      DEV: ["DEMO", "DEV"],
    };
    const candidateSuffixes = Array.from(
      new Set(legacySuffixGroups[suffixUpper] || [suffixUpper])
    );

    const aliasTargets = [
      ["FIREBASE_API_KEY", "VITE_FIREBASE_API_KEY"],
      ["FIREBASE_AUTH_DOMAIN", "VITE_FIREBASE_AUTH_DOMAIN"],
      ["FIREBASE_PROJECT_ID", "VITE_FIREBASE_PROJECT_ID"],
      ["FIREBASE_STORAGE_BUCKET", "VITE_FIREBASE_STORAGE_BUCKET"],
      ["FIREBASE_MESSAGING_SENDER_ID", "VITE_FIREBASE_MESSAGING_SENDER_ID"],
      ["FIREBASE_APP_ID", "VITE_FIREBASE_APP_ID"],
    ];

    for (const [primary, fallback] of aliasTargets) {
      for (const suffix of candidateSuffixes) {
        const primaryEnv = `${primary}_${suffix}`;
        const fallbackEnv = `${fallback}_${suffix}`;
        if (!process.env[primary] && process.env[primaryEnv]) {
          process.env[primary] = process.env[primaryEnv];
        }
        if (!process.env[fallback] && process.env[fallbackEnv]) {
          process.env[fallback] = process.env[fallbackEnv];
        }
      }
    }
  }
}

loadScriptEnv(resolveScriptEnv());

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId:
    process.env.FIREBASE_MESSAGING_SENDER_ID || process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID || process.env.VITE_FIREBASE_APP_ID,
};

const requiredEnvPairs = [
  ["FIREBASE_API_KEY", "VITE_FIREBASE_API_KEY"],
  ["FIREBASE_AUTH_DOMAIN", "VITE_FIREBASE_AUTH_DOMAIN"],
  ["FIREBASE_PROJECT_ID", "VITE_FIREBASE_PROJECT_ID"],
  ["FIREBASE_STORAGE_BUCKET", "VITE_FIREBASE_STORAGE_BUCKET"],
  ["FIREBASE_MESSAGING_SENDER_ID", "VITE_FIREBASE_MESSAGING_SENDER_ID"],
  ["FIREBASE_APP_ID", "VITE_FIREBASE_APP_ID"],
];

const missingClientEnv = requiredEnvPairs
  .map(([primaryKey, fallbackKey]) => {
    const resolved = process.env[primaryKey] || process.env[fallbackKey];
    if (typeof resolved === "string" && resolved.trim().length > 0) return "";
    return `${primaryKey}/${fallbackKey}`;
  })
  .filter(Boolean);
if (missingClientEnv.length > 0) {
  throw new Error(`Missing required env vars: ${missingClientEnv.join(", ")}`);
}

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);

export async function signInForScripts() {
  const email = process.env.SCRIPT_AUTH_EMAIL || process.env.OWNER_EMAIL || "";
  const password = process.env.SCRIPT_AUTH_PASSWORD || process.env.OWNER_PASSWORD || "";

  if (!email || !password) {
    return null;
  }

  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

export async function cleanupScriptFirebase() {
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
}

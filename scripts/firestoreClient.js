import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
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

  const baseCwd = (process.env.INIT_CWD || process.cwd()).toLowerCase().replace(/\\/g, "/");
  const cwd = baseCwd;
  const fallbackCandidates = [
    { path: "/backups/prod/", env: "prod" },
    { path: "/prod/", env: "prod" },
    { path: "/backups/demo/", env: "demo" },
    { path: "/demo/", env: "demo" },
    { path: "/backups/staging/", env: "staging" },
    { path: "/staging/", env: "staging" },
    { path: "/backups/stg/", env: "staging" },
    { path: "/stg/", env: "staging" },
  ];

  for (const candidate of fallbackCandidates) {
    const normalizedPath = candidate.path.replace(/\/$/, "");
    if (cwd === normalizedPath || cwd.endsWith(normalizedPath)) {
      return candidate.env;
    }
    if (cwd.includes(candidate.path)) {
      return candidate.env;
    }
  }

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

    if (
      !Object.prototype.hasOwnProperty.call(process.env, key) ||
      String(process.env[key]).trim() === ""
    ) {
      process.env[key] = value;
    }
  }
}

function collectCandidateProjectRoots() {
  const candidateRoots = new Set();
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const resolvedScriptDir = path.resolve(scriptDir);
  candidateRoots.add(resolvedScriptDir);
  candidateRoots.add(path.resolve(resolvedScriptDir, ".."));

  const npmPackageJson = process.env.npm_package_json;
  if (typeof npmPackageJson === "string" && npmPackageJson.trim()) {
    candidateRoots.add(path.resolve(path.dirname(npmPackageJson)));
  }

  let currentDir = path.resolve(process.env.INIT_CWD || process.cwd());
  while (true) {
    candidateRoots.add(currentDir);
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) break;
    currentDir = parentDir;
  }

  return Array.from(candidateRoots);
}

function loadScriptEnv(scriptEnv) {
  const projectRoots = collectCandidateProjectRoots();
  const envSuffix = scriptEnv ? scriptEnv.toLowerCase() : "";
  const explicit = envSuffix;
  const candidateFiles = [];
  const addCandidate = (candidateName) => {
    if (!candidateName) return;
    for (const root of projectRoots) {
      candidateFiles.push(path.resolve(root, candidateName));
    }
  };

  if (envSuffix) {
    addCandidate(`.env.${envSuffix}.local`);
    addCandidate(`.env.${envSuffix}`);
    addCandidate(`.env.${envSuffix.toUpperCase()}.local`);
    addCandidate(`.env.${envSuffix.toUpperCase()}`);
    if (envSuffix === "prod") {
      addCandidate(".env.staging.local");
      addCandidate(".env.staging");
      addCandidate(".env.stg.local");
      addCandidate(".env.stg");
    }
    if (envSuffix === "demo") {
      addCandidate(".env.dev.local");
      addCandidate(".env.dev");
    }
  }

  addCandidate(".env.local");
  addCandidate(".env");

  const candidates = Array.from(new Set(candidateFiles));
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
  const email = String(process.env.SCRIPT_AUTH_EMAIL || process.env.OWNER_EMAIL || "").trim();
  const password = String(process.env.SCRIPT_AUTH_PASSWORD || process.env.OWNER_PASSWORD || "").trim();

  if (!email || !password) {
    return null;
  }

  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    return credential.user;
  } catch (error) {
    const code = error?.code || "";
    if (code === "auth/operation-not-allowed") {
      console.error(`Script auth failed for ${email}.`);
      console.error("Email/Password sign-in is not enabled for the selected Firebase project.");
      console.error("Enable: Firebase Console > Authentication > Sign-in method > Email/Password.");
      console.error("If you prefer Google-only auth in this project, script-based operations will need another auth mechanism.");
    } else if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") {
      console.error(`Script auth failed for ${email}.`);
      console.error("Check that this user exists as a Password Sign-In account in Firebase Console.");
      console.error("Ensure Email/Password sign-in method is enabled for the target project.");
      console.error("If only Google auth is configured for this project, scripts will fail here.");
    }
    throw error;
  }
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

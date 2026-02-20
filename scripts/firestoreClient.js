import { deleteApp, initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { getFirestore, terminate } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "AIzaSyBIfGyeHMc_0LPtX5qbeqQrabX6wXvs_kI",
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || "flashcompauth.firebaseapp.com",
  projectId: process.env.FIREBASE_PROJECT_ID || "flashcompauth",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "flashcompauth.appspot.com",
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "466092936876",
  appId: process.env.FIREBASE_APP_ID || "1:466092936876:web:0ab1780cc4fc96327a5909",
};

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

// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const fallbackFirebaseConfig = {
  apiKey: "AIzaSyBIfGyeHMc_0LPtX5qbeqQrabX6wXvs_kI",
  authDomain: "flashcompauth.firebaseapp.com",
  projectId: "flashcompauth",
  storageBucket: "flashcompauth.appspot.com",
  messagingSenderId: "466092936876",
  appId: "1:466092936876:web:0ab1780cc4fc96327a5909",
};

const requiredEnvKeys = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
];

const readConfigFromEnv = () => {
  const envConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };

  const hasAll = requiredEnvKeys.every((key) => typeof import.meta.env[key] === "string" && import.meta.env[key].trim().length > 0);
  if (!hasAll) {
    console.warn(
      "[Firebase] 環境変数が不足しているため、デフォルト設定（flashcompauth）を使用します。ステージング/本番分離を行う場合は .env ファイルを設定してください。"
    );
    return fallbackFirebaseConfig;
  }

  return envConfig;
};

const firebaseConfig = readConfigFromEnv();

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

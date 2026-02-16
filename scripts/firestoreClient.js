import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

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

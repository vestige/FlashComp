// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBIfGyeHMc_0LPtX5qbeqQrabX6wXvs_kI",
  authDomain: "flashcompauth.firebaseapp.com",
  projectId: "flashcompauth",
  storageBucket: "flashcompauth.firebasestorage.app",
  messagingSenderId: "466092936876",
  appId: "1:466092936876:web:0ab1780cc4fc96327a5909"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
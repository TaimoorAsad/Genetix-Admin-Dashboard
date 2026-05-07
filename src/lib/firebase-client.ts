"use client";

import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";

function getApp(): FirebaseApp | null {
  if (typeof window === "undefined") return null;
  if (getApps().length === 0) {
    const config = {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    };
    if (!config.apiKey) return null;
    return initializeApp(config);
  }
  return getApps()[0] as FirebaseApp;
}

export function getClientAuth(): Auth | null {
  const app = getApp();
  return app ? getAuth(app) : null;
}

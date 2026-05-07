"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import {
  User,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  signInWithPhoneNumber,
  RecaptchaVerifier,
  type ConfirmationResult,
} from "firebase/auth";
import { getClientAuth } from "@/lib/firebase-client";
import type { DashboardRole, StaffPermissions } from "@/lib/dashboard-roles";

export type RoleInfo = {
  role: DashboardRole;
  permissions: StaffPermissions;
  franchiseId: string | null;
  userId: string | null;
};

type AuthContextType = {
  user: User | null;
  idToken: string | null;
  roleInfo: RoleInfo | null;
  roleLoading: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  /** Send OTP to phone (E.164, e.g. +923001234567). Requires a DOM element id for reCAPTCHA. */
  sendPhoneOtp: (phoneNumber: string, recaptchaContainerId: string) => Promise<void>;
  /** Complete sign-in with the OTP code from SMS. Call after sendPhoneOtp. */
  confirmPhoneOtp: (code: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshToken: () => Promise<string | null>;
  refreshRoleInfo: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [roleInfo, setRoleInfo] = useState<RoleInfo | null>(null);
  const [roleLoading, setRoleLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const phoneConfirmationRef = useRef<ConfirmationResult | null>(null);
  const auth = getClientAuth();

  const fetchRoleInfo = useCallback(async (token: string) => {
    const res = await fetch("/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      setRoleInfo(null);
      return;
    }
    const data = await res.json();
    setRoleInfo({
      role: data.role ?? "user",
      permissions: data.permissions ?? {},
      franchiseId: data.franchiseId ?? null,
      userId: data.userId ?? null,
    });
  }, []);

  const refreshToken = async (): Promise<string | null> => {
    if (!auth) return null;
    const u = auth.currentUser;
    if (!u) return null;
    const token = await u.getIdToken(true);
    setIdToken(token);
    await fetchRoleInfo(token);
    return token;
  };

  const refreshRoleInfo = useCallback(async () => {
    if (!idToken) return;
    setRoleLoading(true);
    await fetchRoleInfo(idToken);
    setRoleLoading(false);
  }, [idToken, fetchRoleInfo]);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    const unsub = auth.onAuthStateChanged(async (u) => {
      setUser(u);
      if (u) {
        const token = await u.getIdToken();
        setIdToken(token);
        setRoleLoading(true);
        await fetchRoleInfo(token);
        setRoleLoading(false);
      } else {
        setIdToken(null);
        setRoleInfo(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [auth, fetchRoleInfo]);

  const signIn = async (email: string, password: string) => {
    if (!auth) throw new Error("Firebase isn’t loaded. Add NEXT_PUBLIC_FIREBASE_* vars to .env.local and restart the dev server (npm run dev).");
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const token = await cred.user.getIdToken();
    setIdToken(token);
    setRoleLoading(true);
    await fetchRoleInfo(token);
    setRoleLoading(false);
  };

  const signInWithGoogle = async () => {
    if (!auth) throw new Error("Firebase is not loaded. Add NEXT_PUBLIC_FIREBASE_* vars to .env.local and restart the dev server (npm run dev).");
    const provider = new GoogleAuthProvider();
    const cred = await signInWithPopup(auth, provider);
    const token = await cred.user.getIdToken();
    setIdToken(token);
    setRoleLoading(true);
    await fetchRoleInfo(token);
    setRoleLoading(false);
  };

  const sendPhoneOtp = async (phoneNumber: string, recaptchaContainerId: string) => {
    if (!auth) throw new Error("Firebase is not loaded. Add NEXT_PUBLIC_FIREBASE_* vars to .env.local and restart the dev server (npm run dev).");
    const container = typeof document !== "undefined" ? document.getElementById(recaptchaContainerId) : null;
    if (container) container.innerHTML = "";
    const normalized = phoneNumber.trim().startsWith("+") ? phoneNumber.trim() : `+${phoneNumber.trim()}`;
    // Optional: skip reCAPTCHA for testing. Only works with Firebase Console "Phone numbers for testing" (fictional numbers + code).
    const disableRecaptchaForTesting = typeof process !== "undefined" && process.env.NEXT_PUBLIC_PHONE_AUTH_DISABLE_RECAPTCHA_FOR_TESTING === "true";
    if (disableRecaptchaForTesting && auth.settings) {
      (auth.settings as { appVerificationDisabledForTesting?: boolean }).appVerificationDisabledForTesting = true;
    }
    const verifier = new RecaptchaVerifier(auth, recaptchaContainerId, {
      size: "normal",
      callback: () => {},
      "expired-callback": () => {},
    });
    const result = await signInWithPhoneNumber(auth, normalized, verifier);
    phoneConfirmationRef.current = result;
  };

  const confirmPhoneOtp = async (code: string) => {
    const confirmation = phoneConfirmationRef.current;
    if (!confirmation) throw new Error("No verification in progress. Request a new code.");
    const cred = await confirmation.confirm(code.trim());
    phoneConfirmationRef.current = null;
    const token = await cred.user.getIdToken();
    setIdToken(token);
    setRoleLoading(true);
    await fetchRoleInfo(token);
    setRoleLoading(false);
  };

  const signOut = async () => {
    if (auth) await firebaseSignOut(auth);
    phoneConfirmationRef.current = null;
    setUser(null);
    setIdToken(null);
    setRoleInfo(null);
  };

  return (
    <AuthContext.Provider value={{ user, idToken, roleInfo, roleLoading, loading, signIn, signInWithGoogle, sendPhoneOtp, confirmPhoneOtp, signOut, refreshToken, refreshRoleInfo }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

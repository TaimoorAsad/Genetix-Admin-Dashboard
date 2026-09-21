"use client";

import type React from "react";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { AppInput } from "@/components/ui/login-1";
import { Mail, Lock, Phone, AlertCircle, CheckCircle2 } from "lucide-react";

export default function LoginPage() {
  const [authTab, setAuthTab] = useState<"email" | "phone">("email");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [resetSuccess, setResetSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const { signIn, signInWithGoogle, sendPhoneOtp, confirmPhoneOtp, signOut, resetPassword, user, roleInfo, roleLoading } = useAuth();
  const [phoneStep, setPhoneStep] = useState<"phone" | "otp">("phone");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const router = useRouter();

  const [cardMouse, setCardMouse] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [cardHover, setCardHover] = useState(false);

  if (user && !roleLoading && roleInfo === null) {
    return (
      <div className="h-screen min-h-[568px] flex items-center justify-center p-3 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-[#eef4ff] to-[#e0eef8]" />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <Image src="/logo.png" alt="" width={480} height={480} className="w-[min(90vw,480px)] h-auto object-contain opacity-[0.08]" aria-hidden />
        </div>
        <div className="w-full max-w-sm rounded-3xl bg-white/90 backdrop-blur-xl border border-white/60 shadow-2xl shadow-slate-300/30 p-8 text-center relative z-10 login-card">
          <p className="text-amber-700 mb-4 font-medium">You don’t have access to this dashboard.</p>
          <button
            onClick={() => signOut().then(() => router.replace("/login"))}
            className="w-full py-3 rounded-xl bg-[#4059ad] hover:bg-[#344a8a] text-white font-medium shadow-lg hover:shadow-xl transition-all duration-200"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  if (user && roleInfo && !roleLoading) {
    if (roleInfo.role === "user") router.replace("/dashboard/me");
    else if (roleInfo.role === "franchise") router.replace("/dashboard/my-franchise");
    else router.replace("/dashboard");
    return null;
  }

  const handleGoogleSignIn = async () => {
    setError("");
    setResetSuccess("");
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      router.push("/dashboard");
    } catch (err: unknown) {
      const code = err && typeof err === "object" && "code" in err ? String((err as { code: string }).code) : "";
      const msg = err instanceof Error ? err.message : "Google sign-in failed.";
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
        return;
      }
      if (code === "auth/unauthorized-domain" || msg.includes("unauthorized-domain")) {
        setError(
          "This domain is not authorized in Firebase Console. In Firebase Console → Authentication → Settings → Authorized domains, add this domain (e.g. genetix-admin-dashboard-rtns.vercel.app or localhost)."
        );
      } else if (code === "auth/popup-blocked") {
        setError("Sign-in popup was blocked by your browser. Please allow popups for this site and try again.");
      } else {
        setError(msg || "Failed to sign in with Google.");
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setResetSuccess("");
    setLoading(true);
    try {
      let emailToUse = identifier.trim();
      if (!emailToUse.includes("@")) {
        setLookupLoading(true);
        const res = await fetch("/api/auth/lookup-user", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier: emailToUse }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "User not found. Make sure you're using the email or phone number from your app account.");
        }
        const data = await res.json();
        emailToUse = data.email;
        setLookupLoading(false);
      }
      await signIn(emailToUse, password);
      router.push("/dashboard");
    } catch (err: unknown) {
      const code = err && typeof err === "object" && "code" in err ? String((err as { code: string }).code) : "";
      const rawMsg = err instanceof Error ? err.message : "";
      if (code === "auth/invalid-credential" || code === "auth/wrong-password" || rawMsg.includes("invalid-credential")) {
        if (identifier.toLowerCase().includes("@gmail.com") || identifier.toLowerCase().includes("@googlemail.com")) {
          setError("Invalid password. Since this is a Google account, please click the 'Sign in with Google' button above (1-click sign-in without a separate password).");
        } else {
          setError("Invalid email or password. Please check your credentials or click 'Forgot Password?' below.");
        }
      } else if (code === "auth/too-many-requests" || rawMsg.includes("too-many-requests")) {
        setError("Access has been temporarily protected by Firebase due to repeated failed login attempts. You can immediately sign in with 1 click using 'Sign in with Google' above, or click 'Forgot Password?' below to reset.");
      } else if (code === "auth/user-not-found" || rawMsg.includes("user-not-found")) {
        setError("No account found with this email. Check spelling or contact the administrator.");
      } else {
        setError(rawMsg || "Login failed. Use the same email or phone as in the app.");
      }
    } finally {
      setLoading(false);
      setLookupLoading(false);
    }
  };

  const handleResetPassword = async () => {
    setError("");
    setResetSuccess("");
    const email = identifier.trim();
    if (!email || !email.includes("@")) {
      setError("Please enter your valid email address in the field above first.");
      return;
    }
    setResetLoading(true);
    try {
      await resetPassword(email);
      setResetSuccess(`Password reset email sent to ${email}! Please check your inbox (and spam folder) to set your password.`);
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : "Failed to send reset email.";
      setError(rawMsg);
    } finally {
      setResetLoading(false);
    }
  };

  const handleSendPhoneOtp = async () => {
    setError("");
    setResetSuccess("");
    setPhoneLoading(true);
    try {
      await sendPhoneOtp(phoneNumber, "recaptcha-container");
      setPhoneStep("otp");
      setOtpCode("");
    } catch (err: unknown) {
      const code = err && typeof err === "object" && "code" in err ? String((err as { code: string }).code) : "";
      const msg = err instanceof Error ? err.message : "Failed to send OTP.";
      if (code === "auth/unauthorized-domain" || msg.includes("unauthorized-domain")) {
        setError(
          "This domain is not authorized. In Firebase Console → Authentication → Settings → Authorized domains, add exactly: genetix-admin-dashboard-rtns.vercel.app (no https://, no path). Use the same Firebase project as your app."
        );
      } else if (code === "auth/invalid-app-credential" || msg.includes("invalid-app-credential")) {
        setError(
          "Phone sign-in doesn’t work on localhost. Either: (1) Add 127.0.0.1 to Firebase → Authentication → Settings → Authorized domains, then open this site at http://127.0.0.1:3000. Or (2) Use the deployed website URL."
        );
      } else {
        setError(msg || "Failed to send OTP. Enable Phone sign-in in Firebase Console.");
      }
    } finally {
      setPhoneLoading(false);
    }
  };

  const handleConfirmPhoneOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setResetSuccess("");
    setOtpLoading(true);
    try {
      await confirmPhoneOtp(otpCode);
      router.push("/dashboard");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Invalid or expired code. Request a new OTP.";
      setError(msg);
    } finally {
      setOtpLoading(false);
    }
  };

  const inputBase =
    "w-full rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 transition-all duration-200 focus:border-[#4059ad] focus:ring-2 focus:ring-[#4059ad]/25 focus:bg-white outline-none";

  const handleCardMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setCardMouse({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  return (
    <div className="h-screen min-h-[568px] flex items-center justify-center p-3 relative overflow-hidden">
      {/* Layered gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-[#eef4ff] to-[#e0eef8]" />
      {/* Soft gradient orbs */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] rounded-full bg-[#4059ad]/8 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full bg-[#97d8c4]/15 blur-[80px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 w-[600px] h-[600px] rounded-full bg-slate-200/20 blur-[120px] pointer-events-none -translate-x-1/2 -translate-y-1/2" />

      {/* Large background logo — layered for depth */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <Image src="/logo.png" alt="" width={640} height={640} className="w-[min(100vw,640px)] h-auto object-contain login-bg-logo" aria-hidden priority />
      </div>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <Image src="/logo.png" alt="" width={420} height={420} className="w-[min(70vw,420px)] h-auto object-contain opacity-[0.05]" aria-hidden />
      </div>

      <div
        className={`w-full max-w-md rounded-2xl bg-white/90 backdrop-blur-xl border border-white/60 shadow-2xl shadow-slate-300/30 p-5 relative z-10 login-card hover:shadow-[0_25px_50px_-12px_rgba(64,89,173,0.15)] transition-shadow duration-300 ${error ? "ring-2 ring-red-200/50" : ""}`}
        onMouseMove={handleCardMouseMove}
        onMouseEnter={() => setCardHover(true)}
        onMouseLeave={() => setCardHover(false)}
      >
        <div
          className={`pointer-events-none absolute w-[420px] h-[420px] bg-gradient-to-r from-purple-300/35 via-blue-300/30 to-pink-300/35 rounded-full blur-3xl transition-opacity duration-200 ${
            cardHover ? "opacity-100" : "opacity-0"
          }`}
          style={{
            transform: `translate(${cardMouse.x - 210}px, ${cardMouse.y - 210}px)`,
            transition: "transform 0.1s ease-out",
          }}
        />

        {/* Header Branding */}
        <div className="flex justify-center mb-2">
          <div className="rounded-xl bg-white p-1.5 shadow-md ring-1 ring-slate-200/60">
            <Image src="/logo.png" alt="Genetix" width={48} height={48} className="h-11 w-11 object-contain" priority />
          </div>
        </div>
        <h1 className="text-xl font-bold text-center text-slate-800 mb-0.5 tracking-tight">Genetix Dashboard</h1>
        <p className="text-slate-500 text-center text-xs mb-3.5">Sign in to manage the Genetix platform</p>

        {/* Primary 1-Click Sign-in: Google */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={googleLoading || loading || phoneLoading || otpLoading}
          className="w-full py-2.5 px-4 rounded-xl border border-slate-200/90 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-sm hover:shadow transition-all duration-200 flex items-center justify-center gap-2.5 disabled:opacity-50 hover:scale-[1.01] active:scale-[0.99]"
        >
          {googleLoading ? (
            <div className="flex items-center gap-2 text-slate-500">
              <div className="w-4 h-4 border-2 border-[#4059ad] border-t-transparent rounded-full animate-spin" />
              <span>Connecting to Google…</span>
            </div>
          ) : (
            <>
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>Sign in with Google</span>
            </>
          )}
        </button>

        {/* Divider */}
        <div className="relative my-3">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200/80" />
          </div>
          <div className="relative flex justify-center text-[11px]">
            <span className="px-2 bg-white/90 text-slate-400 font-medium">or continue with</span>
          </div>
        </div>

        {/* Method Toggle Tabs */}
        <div className="flex rounded-xl bg-slate-100/90 p-1 mb-3 border border-slate-200/60">
          <button
            type="button"
            onClick={() => { setAuthTab("email"); setError(""); setResetSuccess(""); }}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 flex items-center justify-center gap-1.5 ${
              authTab === "email"
                ? "bg-white text-slate-800 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Email & Password</span>
          </button>
          <button
            type="button"
            onClick={() => { setAuthTab("phone"); setError(""); setResetSuccess(""); }}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 flex items-center justify-center gap-1.5 ${
              authTab === "phone"
                ? "bg-white text-slate-800 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Phone className="w-3.5 h-3.5" />
            <span>Phone OTP</span>
          </button>
        </div>

        {/* Feedback Notifications */}
        {error && (
          <div className="mb-3 flex items-start gap-2 text-xs text-red-700 bg-red-50/95 border border-red-200 rounded-xl p-2.5 animate-[login-fade-in-up_0.3s_ease-out]">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}
        {resetSuccess && (
          <div className="mb-3 flex items-start gap-2 text-xs text-emerald-800 bg-emerald-50/95 border border-emerald-200 rounded-xl p-2.5 animate-[login-fade-in-up_0.3s_ease-out]">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            <span className="leading-relaxed">{resetSuccess}</span>
          </div>
        )}

        {/* Tab 1: Email & Password */}
        {authTab === "email" && (
          <form onSubmit={handleSubmit} className="space-y-2.5">
            <div>
              <AppInput
                id="identifier"
                label="Email or phone"
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="your@email.com or +91..."
                required
                icon={<Mail className="h-4 w-4" />}
              />
            </div>
            <div>
              <AppInput
                id="password"
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                icon={<Lock className="h-4 w-4" />}
              />
            </div>
            <button
              type="submit"
              disabled={loading || lookupLoading}
              className="w-full py-2.5 rounded-xl bg-[#4059ad] hover:bg-[#344a8a] text-white text-xs font-semibold shadow-lg shadow-[#4059ad]/25 hover:shadow-xl hover:shadow-[#4059ad]/30 hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 disabled:opacity-50"
            >
              {lookupLoading ? "Looking up account…" : loading ? "Signing in…" : "Sign in with email"}
            </button>

            <div className="flex items-center justify-between pt-2 text-xs">
              <Link href="/request-franchise" className="text-[#4059ad] hover:text-[#344a8a] font-medium transition-colors">
                Make a new franchise
              </Link>
              <button
                type="button"
                disabled={resetLoading}
                onClick={handleResetPassword}
                className="text-slate-500 hover:text-slate-800 font-medium transition-colors disabled:opacity-50"
              >
                {resetLoading ? "Sending link…" : "Forgot Password?"}
              </button>
            </div>
          </form>
        )}

        {/* Tab 2: Phone OTP */}
        {authTab === "phone" && (
          <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/80">
            <p className="text-[11px] text-slate-500 mb-2">Same phone number as in the app. We’ll send an SMS verification code.</p>
            {process.env.NEXT_PUBLIC_PHONE_AUTH_DISABLE_RECAPTCHA_FOR_TESTING === "true" && (
              <p className="text-[11px] text-amber-600 mb-1.5">Testing: reCAPTCHA disabled. Use Firebase test numbers only.</p>
            )}
            <div id="recaptcha-container" className="mb-2 min-h-[36px]" />
            {phoneStep === "phone" ? (
              <div className="flex gap-1.5">
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+919876543210"
                  className={`flex-1 ${inputBase}`}
                />
                <button
                  type="button"
                  onClick={handleSendPhoneOtp}
                  disabled={phoneLoading || !phoneNumber.trim()}
                  className="px-3 py-2 rounded-lg bg-[#4059ad] hover:bg-[#344a8a] text-white text-xs font-medium shadow hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-50"
                >
                  {phoneLoading ? "Sending…" : "Send OTP"}
                </button>
              </div>
            ) : (
              <form onSubmit={handleConfirmPhoneOtp} className="space-y-2">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="6-digit code"
                  className={inputBase}
                />
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => { setPhoneStep("phone"); setError(""); setResetSuccess(""); }}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs hover:bg-white transition-all duration-200"
                  >
                    Change number
                  </button>
                  <button
                    type="submit"
                    disabled={otpLoading || otpCode.length < 6}
                    className="flex-1 py-1.5 rounded-lg bg-[#4059ad] hover:bg-[#344a8a] text-white text-xs font-medium shadow hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-50"
                  >
                    {otpLoading ? "Verifying…" : "Verify and sign in"}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

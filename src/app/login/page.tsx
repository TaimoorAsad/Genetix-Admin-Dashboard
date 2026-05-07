 "use client";

import type React from "react";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { AppInput } from "@/components/ui/login-1";
import { Mail, Lock } from "lucide-react";

export default function LoginPage() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const { signIn, sendPhoneOtp, confirmPhoneOtp, signOut, user, roleInfo, roleLoading } = useAuth();
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
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
      const message = err instanceof Error ? err.message : "Login failed. Use the same email or phone as in the app. If you use phone only, set a password via Forgot password with your app email.";
      setError(message);
    } finally {
      setLoading(false);
      setLookupLoading(false);
    }
  };

  const handleSendPhoneOtp = async () => {
    setError("");
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
          "This domain is not authorized. In Firebase Console → Authentication → Settings → Authorized domains, add exactly: genetix-admin-dashboard-rtns.vercel.app (no https://, no path). Use the same Firebase project as your app. If the domain is already listed there, check in Vercel that NEXT_PUBLIC_FIREBASE_PROJECT_ID (and other Firebase env vars) match this project, then redeploy."
        );
      } else if (code === "auth/invalid-app-credential" || msg.includes("invalid-app-credential")) {
        setError(
          "Phone sign-in doesn’t work on localhost. Either: (1) Add 127.0.0.1 to Firebase → Authentication → Settings → Authorized domains, then open this site at http://127.0.0.1:3000 (not localhost). Or (2) Use the deployed website URL and add that domain to Authorized domains."
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
        <div className="flex justify-center mb-2">
          <div className="rounded-xl bg-white p-1.5 shadow-md ring-1 ring-slate-200/60">
            <Image src="/logo.png" alt="Genetix" width={48} height={48} className="h-12 w-12 object-contain" priority />
          </div>
        </div>
        <h1 className="text-xl font-bold text-center text-slate-800 mb-0.5 tracking-tight">Genetix Admin</h1>
        <p className="text-slate-500 text-center text-xs mb-3">Sign in with your app account</p>

        <div className="relative my-3">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200/80" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="px-2 bg-white/90 text-slate-500">choose a login method</span>
          </div>
        </div>

        {/* Phone OTP */}
        <div className="mb-3 p-3 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100/80 border border-slate-200/80 shadow-inner">
          <p className="text-xs font-semibold text-slate-700 mb-0.5">User & Staff Login (Phone)</p>
          <p className="text-[11px] text-slate-500 mb-2">Same phone as in the app. We’ll send a code by SMS.</p>
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
                placeholder="+923001234567"
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
                  onClick={() => { setPhoneStep("phone"); setError(""); }}
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

        <div className="mb-1">
          <p className="text-xs font-semibold text-slate-700">Admin & Franchise Login (Credentials)</p>
          <p className="text-[11px] text-slate-500">Use your email/phone + password.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-2.5">
          <div>
            <AppInput
              id="identifier"
              label="Email or phone"
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="your@email.com or +1234567890"
              required
              icon={<Mail className="h-4 w-4" />}
            />
            <p className="text-[11px] text-slate-500 mt-0.5">Use the same email as in the app.</p>
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
          {error && (
            <p className="text-xs text-red-700 bg-red-50/90 border border-red-200 rounded-lg px-2.5 py-2 animate-[login-fade-in-up_0.3s_ease-out]">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading || lookupLoading}
            className="w-full py-2.5 rounded-xl bg-[#4059ad] hover:bg-[#344a8a] text-white text-sm font-semibold shadow-lg shadow-[#4059ad]/25 hover:shadow-xl hover:shadow-[#4059ad]/30 hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 disabled:opacity-50"
          >
            {lookupLoading ? "Looking up…" : loading ? "Signing in…" : "Sign in with email"}
          </button>
          <p className="text-center mt-4">
            <Link href="/request-franchise" className="text-sm text-[#4059ad] hover:text-[#344a8a] font-medium">
              Make a new franchise
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

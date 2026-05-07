"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";

export default function RequestFranchisePage() {
  const countryCode = "+91";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [franchiseName, setFranchiseName] = useState("");
  const [phone, setPhone] = useState(countryCode);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const inputBase =
    "w-full rounded-lg border border-slate-200 bg-white/80 px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 transition-all duration-200 focus:border-[#4059ad] focus:ring-2 focus:ring-[#4059ad]/25 focus:bg-white outline-none";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const trimmed = phone.trim();
      if (!trimmed.startsWith(countryCode)) {
        setError(`Phone number must start with ${countryCode}.`);
        setLoading(false);
        return;
      }
      const digits = trimmed.slice(countryCode.length).replace(/\D/g, "");
      if (!digits) {
        setError("Please enter your phone number.");
        setLoading(false);
        return;
      }
      const trimmedPhone = `${countryCode}${digits}`;
      const res = await fetch("/api/franchise-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          franchiseName: franchiseName.trim(),
          phone: trimmedPhone,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data.error as string) || "Request failed");
      }
      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-[#eef4ff] to-[#e0eef8]" />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <Image src="/logo.png" alt="" width={480} height={480} className="w-[min(90vw,480px)] h-auto object-contain opacity-[0.08]" aria-hidden />
        </div>
        <div className="w-full max-w-md rounded-2xl bg-white/95 backdrop-blur-xl border border-white/60 shadow-xl p-8 relative z-10 text-center">
          <h1 className="text-xl font-bold text-slate-800 mb-2">Request submitted</h1>
          <p className="text-slate-600 text-sm mb-6">
            Your franchise request has been sent. An admin will review it. Once approved, you can log in with your email and password.
          </p>
          <Link
            href="/login"
            className="inline-block px-6 py-2.5 rounded-xl bg-[#4059ad] hover:bg-[#344a8a] text-white text-sm font-medium transition"
          >
            Back to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-[#eef4ff] to-[#e0eef8]" />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <Image src="/logo.png" alt="" width={480} height={480} className="w-[min(90vw,480px)] h-auto object-contain opacity-[0.08]" aria-hidden />
      </div>
      <div className="w-full max-w-md rounded-2xl bg-white/95 backdrop-blur-xl border border-white/60 shadow-xl p-6 relative z-10">
        <div className="flex justify-center mb-4">
          <Image src="/logo.png" alt="Genetix" width={48} height={48} className="h-12 w-12 object-contain" />
        </div>
        <h1 className="text-xl font-bold text-slate-800 text-center mb-1">Request a new franchise</h1>
        <p className="text-slate-500 text-center text-sm mb-6">Fill the form below. After admin approval you can log in with your email and password.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-0.5">Email *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={inputBase}
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-0.5">Password * (min 6 characters)</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className={inputBase}
              placeholder="••••••••"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-0.5">Franchise name *</label>
            <input
              type="text"
              value={franchiseName}
              onChange={(e) => setFranchiseName(e.target.value)}
              required
              className={inputBase}
              placeholder="Your franchise or business name"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-0.5">Phone number (also your referral code) *</label>
            <input
              type="tel"
              inputMode="numeric"
              value={phone}
              onChange={(e) => {
                const raw = e.target.value ?? "";
                // Keep +91 locked at the start, and only allow digits after it.
                const withPrefix = raw.startsWith(countryCode) ? raw : `${countryCode}${raw.replace(/^\+?91/, "")}`;
                const localDigits = withPrefix.slice(countryCode.length).replace(/\D/g, "");
                setPhone(`${countryCode}${localDigits}`);
              }}
              onFocus={(e) => {
                // If user focuses before the prefix, move cursor to the end.
                const el = e.currentTarget;
                const pos = el.selectionStart ?? 0;
                if (pos < countryCode.length) {
                  queueMicrotask(() => {
                    try {
                      el.setSelectionRange(el.value.length, el.value.length);
                    } catch {
                      // ignore
                    }
                  });
                }
              }}
              required
              className={`${inputBase} font-mono`}
              placeholder="+91XXXXXXXXXX"
            />
            <p className="mt-1 text-[11px] text-slate-400">
              Country code is locked to {countryCode}. This full number will be your unique referral code.
            </p>
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-[#4059ad] hover:bg-[#344a8a] text-white text-sm font-semibold transition disabled:opacity-50"
          >
            {loading ? "Submitting…" : "Submit request"}
          </button>
        </form>
        <p className="text-center mt-4">
          <Link href="/login" className="text-sm text-[#4059ad] hover:text-[#344a8a] font-medium">
            Back to login
          </Link>
        </p>
      </div>
    </div>
  );
}

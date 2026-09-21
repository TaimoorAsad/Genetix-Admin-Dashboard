"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

interface ShareClientProps {
  referralCode: string;
  playStoreUrl: string;
  appStoreUrl: string;
}

export default function ShareClient({
  referralCode,
  playStoreUrl,
  appStoreUrl,
}: ShareClientProps) {
  const [copied, setCopied] = useState(false);
  const [redirecting, setRedirecting] = useState(true);

  // Formulate the Play Store URL with Google Play Install Referrer parameter
  const playStoreUrlWithReferrer = (() => {
    if (!referralCode) return playStoreUrl;
    const separator = playStoreUrl.includes("?") ? "&" : "?";
    // Play Store install referrer format: referrer=referralCode%3D<CODE>
    return `${playStoreUrl}${separator}referrer=${encodeURIComponent(
      `referralCode=${referralCode}`
    )}`;
  })();

  const appSchemeUrl = referralCode
    ? `genetix://share?referralCode=${encodeURIComponent(referralCode)}`
    : `genetix://share`;

  // Chrome Intent URI: if app is installed, open app; if not, navigate to browser_fallback_url (Play Store with referrer)
  const androidIntentUrl = (() => {
    const fallbackEncoded = encodeURIComponent(playStoreUrlWithReferrer);
    const codeParam = referralCode ? `referralCode=${encodeURIComponent(referralCode)}` : "";
    return `intent://dashboard.genetix.in/share?${codeParam}#Intent;scheme=https;package=com.brainvita.dmit;S.browser_fallback_url=${fallbackEncoded};end`;
  })();

  const copyCode = async () => {
    if (!referralCode) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(referralCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch {
      // Ignore clipboard write errors
    }
  };

  useEffect(() => {
    // Attempt to copy referral code to clipboard immediately
    if (referralCode && navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(referralCode).catch(() => {});
    }

    const userAgent =
      typeof window !== "undefined"
        ? navigator.userAgent || navigator.vendor || ""
        : "";

    const isAndroid = /android/i.test(userAgent);
    const isIOS =
      /iPad|iPhone|iPod/.test(userAgent) &&
      !(window as Window & { MSStream?: unknown }).MSStream;

    if (isAndroid) {
      // Chrome Intent automatically tries to open the installed app.
      // If the app is NOT installed, Chrome automatically falls back to S.browser_fallback_url (Play Store with referrer).
      window.location.href = androidIntentUrl;
    } else if (isIOS) {
      // On iOS, attempt custom scheme, then fallback to App Store
      window.location.href = appSchemeUrl;
      const timer = setTimeout(() => {
        window.location.href = appStoreUrl;
      }, 1500);
      return () => clearTimeout(timer);
    } else {
      // Desktop or unsupported platform: don't auto-redirect, show landing card
      setRedirecting(false);
    }

    const redirectTimer = setTimeout(() => {
      setRedirecting(false);
    }, 2000);

    return () => clearTimeout(redirectTimer);
  }, [androidIntentUrl, appSchemeUrl, appStoreUrl, referralCode]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#f0f4ff] via-[#fafbff] to-[#f5f7fa] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-[#e2e8f0] p-6 text-center space-y-6">
        {/* Brand Logo & Header */}
        <div className="flex flex-col items-center space-y-2">
          <div className="w-20 h-20 relative rounded-2xl overflow-hidden shadow-md border border-[#e2e8f0] bg-white p-2 flex items-center justify-center">
            <Image
              src="/logo.png"
              alt="Genetix"
              width={72}
              height={72}
              className="object-contain"
              priority
            />
          </div>
          <h1 className="text-2xl font-bold text-[#1a202c] tracking-tight">Genetix</h1>
          <p className="text-xs text-[#4059ad] font-semibold uppercase tracking-wider">
            Know Your Inborn Talents
          </p>
        </div>

        {/* Status Message */}
        <div className="py-2">
          {redirecting ? (
            <div className="flex items-center justify-center space-x-2 text-sm text-[#4a5568]">
              <svg
                className="animate-spin h-5 w-5 text-[#4059ad]"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              <span>Connecting you to Genetix...</span>
            </div>
          ) : (
            <p className="text-sm text-[#4a5568]">
              Tap below to open the app or download it from Google Play.
            </p>
          )}
        </div>

        {/* Referral Code Card */}
        {referralCode && (
          <div className="bg-[#f7fafc] border border-[#e2e8f0] rounded-xl p-4 space-y-2">
            <span className="text-xs font-medium text-[#718096] uppercase tracking-wider block">
              Referral Code
            </span>
            <div className="flex items-center justify-center space-x-2">
              <span className="text-xl font-mono font-bold text-[#2d3748] tracking-wider bg-white px-3 py-1 rounded-lg border border-[#cbd5e0]">
                {referralCode}
              </span>
              <button
                type="button"
                onClick={copyCode}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#4059ad] hover:bg-[#344a8a] text-white transition shadow-sm"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <p className="text-[11px] text-[#a0aec0]">
              This referral code is automatically saved and applied when you log in.
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3 pt-2">
          <a
            href={androidIntentUrl}
            className="block w-full py-3 px-4 rounded-xl bg-[#4059ad] hover:bg-[#344a8a] text-white font-medium text-sm transition shadow-md hover:shadow-lg"
          >
            Open in Genetix App
          </a>

          <a
            href={playStoreUrlWithReferrer}
            className="block w-full py-3 px-4 rounded-xl bg-white hover:bg-[#f8f9fa] border border-[#cbd5e0] text-[#2d3748] font-medium text-sm transition shadow-sm"
          >
            Download on Google Play
          </a>

          {appStoreUrl && (
            <a
              href={appStoreUrl}
              className="block w-full py-2.5 px-4 rounded-xl bg-transparent hover:bg-gray-100 text-[#4a5568] text-xs transition"
            >
              Download on Apple App Store
            </a>
          )}
        </div>

        {/* Footer info */}
        <div className="pt-2 text-[11px] text-[#a0aec0]">
          Scientifically Proven & Clinically Tested Methodology
        </div>
      </div>
    </main>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";

type ReferredUser = { id: string; fullName?: string; phone?: string };
type Profile = Record<string, unknown> & { id?: string; referredByMe?: ReferredUser[] };
type HandData = Record<string, { Left: { image: string }; Center: { image: string }; Right: { image: string } }>;

export default function MePage() {
  const { idToken, roleInfo, loading, roleLoading } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [fingerprints, setFingerprints] = useState<{ leftHand: HandData; rightHand: HandData } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (roleInfo?.role !== "user" && !loading && !roleLoading) {
      router.replace("/dashboard");
      return;
    }
  }, [roleInfo, loading, roleLoading, router]);

  useEffect(() => {
    if (!idToken || roleInfo?.role !== "user") return;
    setError(null);
    fetch("/api/me/profile", { headers: { Authorization: `Bearer ${idToken}` } })
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load profile");
        return r.json();
      })
      .then(setProfile)
      .catch((e: Error) => setError(e.message));
  }, [idToken, roleInfo?.role]);

  useEffect(() => {
    if (!idToken || roleInfo?.role !== "user") return;
    fetch("/api/me/fingerprints", { headers: { Authorization: `Bearer ${idToken}` } })
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load images");
        return r.json();
      })
      .then((data) => setFingerprints({ leftHand: data.leftHand, rightHand: data.rightHand }))
      .catch(() => setFingerprints(null));
  }, [idToken, roleInfo?.role]);

  if (roleInfo?.role !== "user") return null;

  return (
    <div>
      <h1 className="text-3xl font-bold text-[#2d3748] mb-6">Profile and data</h1>
      <p className="text-[#718096] text-sm mb-6">You only see your own profile and uploaded data.</p>
      {error && <div className="mb-6 p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">{error}</div>}
      {profile && (
        <div className="rounded-lg bg-white border border-[#e2e8f0] shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-[#2d3748] mb-4">Profile</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-[#718096] font-medium mb-1">Full name</dt>
              <dd className="text-[#2d3748]">{String(profile["Full Name"] ?? "-")}</dd>
            </div>
            <div>
              <dt className="text-[#718096] font-medium mb-1">Email</dt>
              <dd className="text-[#2d3748]">{String(profile.Email ?? "-")}</dd>
            </div>
            <div>
              <dt className="text-[#718096] font-medium mb-1">Phone</dt>
              <dd className="text-[#2d3748]">{String(profile["Phone Number"] ?? "-")}</dd>
            </div>
            <div>
              <dt className="text-[#718096] font-medium mb-1">Franchise</dt>
              <dd className="text-[#2d3748]">{String(profile.Franchise ?? "-")}</dd>
            </div>
          </dl>
          <div className="mt-6 border-t border-[#edf2f7] pt-4">
            <h3 className="text-base font-semibold text-[#2d3748] mb-2">U Share V Care (Referral)</h3>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm mb-4">
              <div>
                <dt className="text-[#718096] font-medium mb-1">Your referral code</dt>
                <dd className="text-[#2d3748]">
                  {String(profile["Phone Number"] ?? "-")}
                </dd>
              </div>
              <div>
                <dt className="text-[#718096] font-medium mb-1">Referred by (phone)</dt>
                <dd className="text-[#2d3748]">
                  {String(profile["ReferralCode"] ?? "-")}
                </dd>
              </div>
              <div>
                <dt className="text-[#718096] font-medium mb-1">Total people you referred</dt>
                <dd className="text-[#2d3748]">
                  {Number(profile["ReferralCount"] ?? 0)}
                </dd>
              </div>
              <div>
                <dt className="text-[#718096] font-medium mb-1">Referral points</dt>
                <dd className="text-[#2d3748]">
                  {Number(profile["ReferralPoints"] ?? 0)}
                </dd>
              </div>
            </dl>
            {Array.isArray(profile.referredByMe) && profile.referredByMe.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-[#4a5568] mb-2">People referred by you</h4>
                <ul className="space-y-1 text-sm text-[#4a5568]">
                  {profile.referredByMe.map((u) => (
                    <li key={u.id} className="flex items-center justify-between">
                      <span className="truncate">
                        {u.fullName || "Unnamed user"}
                      </span>
                      <span className="ml-3 text-xs text-[#a0aec0]">
                        {u.phone || ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
      <div className="rounded-lg bg-white border border-[#e2e8f0] shadow-sm p-6">
        <h2 className="text-lg font-semibold text-[#2d3748] mb-4">Uploaded images (fingerprints)</h2>
        {fingerprints ? (
          <div className="space-y-6">
            <div>
              <h3 className="text-[#718096] text-sm font-medium mb-3">Left hand</h3>
              <div className="flex flex-wrap gap-3">
                {Object.entries(fingerprints.leftHand || {}).map(([finger, pos]) => (
                  <div key={finger} className="flex flex-col gap-2">
                    <span className="text-xs text-[#a0aec0] font-medium">{finger}</span>
                    <div className="flex gap-1">
                      {[pos.Left, pos.Center, pos.Right].map(
                        (p, i) =>
                          p?.image && (
                            <a
                              key={i}
                              href={p.image}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block w-16 h-16 rounded border border-[#e2e8f0] shadow-sm overflow-hidden cursor-pointer hover:ring-2 hover:ring-[#4059ad] hover:ring-offset-1 transition"
                              title="Click to open full size"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={p.image}
                                alt={`${finger} ${i}`}
                                className="w-full h-full object-cover"
                              />
                            </a>
                          )
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-[#718096] text-sm font-medium mb-3">Right hand</h3>
              <div className="flex flex-wrap gap-3">
                {Object.entries(fingerprints.rightHand || {}).map(([finger, pos]) => (
                  <div key={finger} className="flex flex-col gap-2">
                    <span className="text-xs text-[#a0aec0] font-medium">{finger}</span>
                    <div className="flex gap-1">
                      {[pos.Left, pos.Center, pos.Right].map(
                        (p, i) =>
                          p?.image && (
                            <a
                              key={i}
                              href={p.image}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block w-16 h-16 rounded border border-[#e2e8f0] shadow-sm overflow-hidden cursor-pointer hover:ring-2 hover:ring-[#4059ad] hover:ring-offset-1 transition"
                              title="Click to open full size"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={p.image}
                                alt={`${finger} ${i}`}
                                className="w-full h-full object-cover"
                              />
                            </a>
                          )
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-[#718096]">No fingerprint images uploaded yet.</p>
        )}
      </div>
    </div>
  );
}

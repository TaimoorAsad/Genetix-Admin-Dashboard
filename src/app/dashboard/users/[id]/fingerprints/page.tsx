"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";

const FINGERS = ["Thumb", "Index", "Middle", "Ring", "Little"] as const;

type PositionData = { image: string };
type FingerData = { Left: PositionData; Center: PositionData; Right: PositionData };
type HandData = Record<string, FingerData>;

type FingerprintsData = {
  leftHand: HandData;
  rightHand: HandData;
};

type UserInfo = {
  "Full Name"?: string;
  "Phone Number"?: string;
  Email?: string;
  "Father's Name"?: string;
  "Mother's Name"?: string;
  Gender?: string;
  Education?: string;
  "Place of Birth"?: string;
  "Date of Birth"?: string;
  "Time of Birth"?: string;
  "Registered On"?: string;
  Franchise?: string;
  ReferralCode?: string;
  ReferralCount?: number;
  ReferralPoints?: number;
  isEliteMember?: boolean;
  isSubmitted?: boolean;
  [key: string]: unknown;
};

function FingerCell({
  label,
  image,
}: {
  label: string;
  image: string;
}) {
  const [lightbox, setLightbox] = useState(false);
  const hasImage = image && image.trim().length > 0;

  return (
    <div className="flex flex-col items-center">
      <span className="text-xs text-[#a0aec0] mb-1 font-medium">{label}</span>
      {hasImage ? (
        <>
          <button
            type="button"
            onClick={() => setLightbox(true)}
            className="w-16 h-16 rounded-lg border border-[#e2e8f0] overflow-hidden bg-white hover:ring-2 hover:ring-[#4059ad] focus:outline-none focus:ring-2 focus:ring-[#4059ad] shadow-sm transition"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image}
              alt={label}
              className="w-full h-full object-cover"
            />
          </button>
          {lightbox && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
              onClick={() => setLightbox(false)}
              role="dialog"
              aria-modal="true"
              aria-label="View image"
            >
              <button
                type="button"
                onClick={() => setLightbox(false)}
                className="absolute top-4 right-4 text-white hover:text-gray-300 text-2xl"
              >
                ×
              </button>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image}
                alt={label}
                className="max-w-full max-h-full object-contain"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}
        </>
      ) : (
        <div className="w-16 h-16 rounded-lg border border-dashed border-[#e2e8f0] bg-[#f8f9fa] flex items-center justify-center">
          <span className="text-xs text-[#a0aec0]">Not uploaded</span>
        </div>
      )}
    </div>
  );
}

function HandSection({
  title,
  hand,
}: {
  title: string;
  hand: HandData;
}) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold text-[#2d3748] mb-4">{title}</h2>
      <div className="bg-white rounded-lg border border-[#e2e8f0] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="bg-[#f8f9fa]">
              <tr className="border-b border-[#e2e8f0]">
                <th className="text-left py-3 px-6 text-[#2d3748] font-semibold text-sm">Finger</th>
                <th className="py-3 px-2 text-[#2d3748] font-semibold text-sm">Left</th>
                <th className="py-3 px-2 text-[#2d3748] font-semibold text-sm">Center</th>
                <th className="py-3 px-2 text-[#2d3748] font-semibold text-sm">Right</th>
              </tr>
            </thead>
            <tbody>
              {FINGERS.map((finger) => {
                const data = hand[finger] || {
                  Left: { image: "" },
                  Center: { image: "" },
                  Right: { image: "" },
                };
                return (
                  <tr key={finger} className="border-b border-[#e2e8f0] hover:bg-[#f8f9fa] transition">
                    <td className="py-4 px-6 text-[#2d3748] font-medium">{finger}</td>
                    <td className="py-4 px-2">
                      <FingerCell label={`${finger} Left`} image={data.Left?.image ?? ""} />
                    </td>
                    <td className="py-4 px-2">
                      <FingerCell label={`${finger} Center`} image={data.Center?.image ?? ""} />
                    </td>
                    <td className="py-4 px-2">
                      <FingerCell label={`${finger} Right`} image={data.Right?.image ?? ""} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-medium text-[#a0aec0] uppercase tracking-wide">{label}</span>
      <span className="text-sm text-[#2d3748] break-all">{value || <span className="text-[#cbd5e0]">—</span>}</span>
    </div>
  );
}

export default function UserFingerprintsPage() {
  const params = useParams();
  const id = params.id as string;
  const { idToken } = useAuth();
  const [data, setData] = useState<FingerprintsData | null>(null);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!idToken) return;
    Promise.all([
      fetch(`/api/users/${id}/fingerprints`, {
        headers: { Authorization: `Bearer ${idToken}` },
      }),
      fetch(`/api/users/${id}`, { headers: { Authorization: `Bearer ${idToken}` } }),
    ])
      .then(async ([fpRes, userRes]) => {
        if (!fpRes.ok) {
          const body = await fpRes.json().catch(() => ({}));
          throw new Error((body.error as string) || "Failed to load fingerprints");
        }
        const fpData = await fpRes.json();
        setData({ leftHand: fpData.leftHand || {}, rightHand: fpData.rightHand || {} });
        if (userRes.ok) {
          const userData = await userRes.json() as UserInfo;
          setUserInfo(userData);
        }
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id, idToken]);

  if (loading) {
    return (
      <div>
        <p className="text-[#718096]">Loading fingerprint data…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div>
        <p className="text-red-600">{error || "Failed to load"}</p>
        <Link href={`/dashboard/users/${id}`} className="mt-4 inline-block text-[#4059ad] hover:underline font-medium">
          Back to user
        </Link>
      </div>
    );
  }

  const countUploaded = (hand: HandData) => {
    let n = 0;
    FINGERS.forEach((finger) => {
      (["Left", "Center", "Right"] as const).forEach((pos) => {
        const img = hand[finger]?.[pos]?.image;
        if (img && img.trim()) n++;
      });
    });
    return n;
  };
  const leftTotal = countUploaded(data.leftHand);
  const rightTotal = countUploaded(data.rightHand);

  const userName = userInfo?.["Full Name"] || "";

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link href={`/dashboard/users/${id}`} className="text-[#718096] hover:text-[#2d3748] text-sm font-medium">
          ← Back to edit user
        </Link>
        <Link href="/dashboard/users" className="text-[#718096] hover:text-[#2d3748] text-sm font-medium">
          ← All users
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-[#2d3748] mb-2">
        {userName ? userName : "User"} — Fingerprint data
      </h1>
      <p className="text-[#718096] text-sm mb-6">
        Left hand: {leftTotal}/15 uploaded · Right hand: {rightTotal}/15 uploaded
      </p>

      {userInfo && (
        <div className="bg-white rounded-lg border border-[#e2e8f0] shadow-sm p-5 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-[#2d3748]">User information</h2>
            <div className="flex items-center gap-2">
              {userInfo.isEliteMember && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">Elite</span>
              )}
              {userInfo.isSubmitted && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">Submitted</span>
              )}
              <Link
                href={`/dashboard/users/${id}`}
                className="text-xs text-[#4059ad] hover:underline font-medium"
              >
                Edit →
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-4">
            <InfoRow label="Full Name" value={userInfo["Full Name"]} />
            <InfoRow label="Phone Number" value={userInfo["Phone Number"]} />
            <InfoRow label="Email" value={userInfo.Email} />
            <InfoRow label="Gender" value={typeof userInfo.Gender === "string" ? userInfo.Gender : undefined} />
            <InfoRow label="Franchise" value={typeof userInfo.Franchise === "string" && userInfo.Franchise ? userInfo.Franchise : undefined} />
            <InfoRow label="Referral Code Used" value={typeof userInfo.ReferralCode === "string" && userInfo.ReferralCode ? userInfo.ReferralCode : undefined} />
            <InfoRow label="Referral Count" value={userInfo.ReferralCount !== undefined ? String(userInfo.ReferralCount) : undefined} />
            <InfoRow label="Referral Points" value={userInfo.ReferralPoints !== undefined ? String(userInfo.ReferralPoints) : undefined} />
            <InfoRow
              label="Registered On"
              value={userInfo["Registered On"] ? new Date(userInfo["Registered On"] as string).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : undefined}
            />
          </div>
        </div>
      )}

      <HandSection title="Left hand" hand={data.leftHand} />
      <HandSection title="Right hand" hand={data.rightHand} />
    </div>
  );
}

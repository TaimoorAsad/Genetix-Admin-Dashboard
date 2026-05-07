"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";

export default function HomePage() {
  const { user, loading, roleInfo, roleLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading || roleLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!roleInfo) {
      router.replace("/login");
      return;
    }
    if (roleInfo.role === "user") router.replace("/dashboard/me");
    else if (roleInfo.role === "franchise") router.replace("/dashboard/my-franchise");
    else router.replace("/dashboard");
  }, [user, loading, roleInfo, roleLoading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-pulse text-slate-400">Loading...</div>
        <Link href="/login" className="mt-4 inline-block text-blue-400 hover:underline">
          Go to login
        </Link>
      </div>
    </div>
  );
}

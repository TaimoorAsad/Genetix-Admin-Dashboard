import { NextRequest, NextResponse } from "next/server";
import { getFirestore, getAuth } from "@/lib/firebase-admin";
import { requireDashboardAuth } from "@/lib/api-auth";

const COLLECTION = "franchiseRequests";

/** Public: submit a new franchise request. Creates Firebase Auth user and a pending request. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const franchiseName = typeof body.franchiseName === "string" ? body.franchiseName.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }
  if (!password || password.length < 6) {
    return NextResponse.json({ error: "Password is required (at least 6 characters)" }, { status: 400 });
  }
  if (!franchiseName) {
    return NextResponse.json({ error: "Franchise name is required" }, { status: 400 });
  }
  if (!phone || !phone.startsWith("+")) {
    return NextResponse.json({ error: "Phone number is required and must start with + (e.g. +923001234567)" }, { status: 400 });
  }

  const auth = getAuth();
  const db = getFirestore();

  try {
    const userRecord = await auth.createUser({
      email,
      password,
      emailVerified: false,
    });
    const uid = userRecord.uid;

    await db.collection(COLLECTION).add({
      uid,
      email,
      franchiseName,
      phone,
      number: phone,
      status: "pending",
      createdAt: new Date(),
    });

    return NextResponse.json({ success: true, message: "Request submitted. You can log in after an admin approves your franchise." });
  } catch (e: unknown) {
    const err = e as { code?: string; message?: string };
    if (err.code === "auth/email-already-exists" || err.message?.toLowerCase().includes("already exists")) {
      return NextResponse.json({ error: "This email is already registered. Use login or a different email." }, { status: 409 });
    }
    if (err.code === "auth/invalid-password") {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: "Failed to submit request. Try again." }, { status: 500 });
  }
}

/** Admin only: list all franchise requests */
export async function GET(req: NextRequest) {
  const authResult = await requireDashboardAuth(req);
  if ("error" in authResult) return authResult.error;
  if (authResult.auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden: admin only" }, { status: 403 });
  }
  const statusFilter = req.nextUrl.searchParams.get("status") || "pending";
  const db = getFirestore();
  try {
    let query = db.collection(COLLECTION).orderBy("createdAt", "desc");
    if (statusFilter !== "all") {
      query = query.where("status", "==", statusFilter) as ReturnType<typeof db.collection>;
    }
    const snapshot = await query.get();
    const requests = snapshot.docs.map((doc) => {
      const d = doc.data();
      const createdAt = d.createdAt && typeof (d.createdAt as { toDate?: () => Date }).toDate === "function" ? (d.createdAt as { toDate: () => Date }).toDate().toISOString() : null;
      return { id: doc.id, ...d, createdAt };
    });
    return NextResponse.json({ requests });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to fetch requests" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getFirestore, getAuth } from "@/lib/firebase-admin";
import { requireDashboardAuth, requireView, requirePermission } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const authResult = await requireDashboardAuth(req);
  if ("error" in authResult) return authResult.error;
  if (authResult.auth.role === "user") {
    return NextResponse.json({ error: "You can only access your own data. Use My profile." }, { status: 403 });
  }
  const db = getFirestore();
  try {
    if (authResult.auth.role === "franchise" && authResult.auth.franchiseId) {
      const doc = await db.collection("Franchises").doc(authResult.auth.franchiseId).get();
      if (!doc.exists) return NextResponse.json({ error: "Franchise not found" }, { status: 404 });
      const data = doc.data()!;
      const freeScanUserIds = Array.isArray(data.freeScanUserIds) ? data.freeScanUserIds : [];
      const usedCredits = freeScanUserIds.length > 0 ? freeScanUserIds.length : (typeof data.usedCredits === "number" ? data.usedCredits : 0);
      const creditLimit = typeof data.creditLimit === "number" ? data.creditLimit : 5;
      return NextResponse.json({
        franchises: [{
          id: doc.id,
          ...data,
          creditLimit,
          usedCredits,
        }]
      });
    }
    const viewErr = requireView(authResult.auth, "franchises");
    if (viewErr) return viewErr;
    const snapshot = await db.collection("Franchises").get();
    const franchises = snapshot.docs.map((doc) => {
      const data = doc.data();
      const freeScanUserIds = Array.isArray(data.freeScanUserIds) ? data.freeScanUserIds : [];
      const usedCredits = freeScanUserIds.length > 0 ? freeScanUserIds.length : (typeof data.usedCredits === "number" ? data.usedCredits : 0);
      const creditLimit = typeof data.creditLimit === "number" ? data.creditLimit : 5;
      return {
        id: doc.id,
        ...data,
        creditLimit,
        usedCredits,
      };
    });
    return NextResponse.json({ franchises });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to fetch franchises" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const authResult = await requireDashboardAuth(req);
  if ("error" in authResult) return authResult.error;
  const permErr = requirePermission(authResult.auth, "canEditFranchises");
  if (permErr) return permErr;
  const db = getFirestore();
  const body = await req.json();
  const { number, name, email, password, creditLimit, ...rest } = body;
  if (!number) return NextResponse.json({ error: "number is required" }, { status: 400 });

  const cleanPassword = typeof password === "string" ? password.trim() : "";
  const cleanEmail = typeof email === "string" ? email.trim() : "";

  if (cleanPassword && !cleanEmail) {
    return NextResponse.json({ error: "Email is required to create a login account for this franchise." }, { status: 400 });
  }

  const parsedCreditLimit = typeof creditLimit === "number" && !isNaN(creditLimit) && creditLimit >= 0
    ? creditLimit
    : (parseInt(String(creditLimit), 10) >= 0 ? parseInt(String(creditLimit), 10) : 5);

  try {
    const franchiseData = {
      number: String(number),
      name: name || "",
      email: cleanEmail || null,
      creditLimit: parsedCreditLimit,
      freeScanUserIds: [],
      usedCredits: 0,
      ...rest
    };

    const ref = await db.collection("Franchises").add(franchiseData);
    const doc = await ref.get();

    if (cleanPassword && cleanEmail) {
      const auth = getAuth();
      const userRecord = await auth.createUser({
        email: cleanEmail,
        password: cleanPassword,
        displayName: name || undefined,
      });

      await db.collection("dashboardRoles").doc(userRecord.uid).set({
        role: "franchise",
        franchiseId: doc.id,
        email: cleanEmail,
      });
    }

    return NextResponse.json({ id: doc.id, ...doc.data() });
  } catch (e: unknown) {
    console.error(e);
    const msg = e instanceof Error ? e.message : "Failed to create franchise";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

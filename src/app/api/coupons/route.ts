import { NextRequest, NextResponse } from "next/server";
import { getFirestore } from "@/lib/firebase-admin";
import { requireDashboardAuth, requirePermission, requireView } from "@/lib/api-auth";

type Coupon = {
  code: string;
  discountPercent: number;
  active: boolean;
  expiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

function normalizeCode(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.trim().toUpperCase();
}

function randomCode(length = 7): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }
  return result;
}

function isValidCouponCode(code: string): boolean {
  // Relaxed verification to support arbitrary custom coupon codes.
  return /^[A-Z0-9]{3,20}$/.test(code);
}

export async function GET(req: NextRequest) {
  const authResult = await requireDashboardAuth(req);
  if ("error" in authResult) return authResult.error;
  const viewErr = requireView(authResult.auth, "appData");
  if (viewErr) return viewErr;

  const db = getFirestore();
  const onlyActive = req.nextUrl.searchParams.get("active") === "1";

  try {
    let query = db.collection("coupons").orderBy("createdAt", "desc");
    if (onlyActive) {
      query = query.where("active", "==", true);
    }
    const snap = await query.limit(200).get();
    const coupons: Coupon[] = snap.docs.map((d) => {
      const data = d.data() as Partial<Coupon> | undefined;
      return {
        code: String(data?.code || d.id).toUpperCase(),
        discountPercent: Number(data?.discountPercent || 0),
        active: Boolean(data?.active ?? true),
        expiresAt: (data?.expiresAt as string | null | undefined) ?? null,
        createdAt: data?.createdAt || "",
        updatedAt: data?.updatedAt || "",
      };
    });
    return NextResponse.json({ coupons });
  } catch (e) {
    console.error("Failed to list coupons", e);
    return NextResponse.json({ error: "Failed to list coupons" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const authResult = await requireDashboardAuth(req);
  if ("error" in authResult) return authResult.error;
  const permErr = requirePermission(authResult.auth, "canEditAppData");
  if (permErr) return permErr;

  const db = getFirestore();

  try {
    const body = await req.json();
    const requestedCode = normalizeCode(body.code);
    const discountPercent = Number(body.discountPercent);
    const expiresAtRaw = body.expiresAt as string | null | undefined;

    if (!Number.isFinite(discountPercent) || discountPercent <= 0 || discountPercent > 100) {
      return NextResponse.json({ error: "discountPercent must be between 1 and 100" }, { status: 400 });
    }

    let code = requestedCode;
    if (code) {
      if (!isValidCouponCode(code)) {
        return NextResponse.json(
          { error: "Invalid code. Use 4–12 chars: A–Z (excluding I/O) and 2–9." },
          { status: 400 }
        );
      }
    } else {
      // Auto-generate 7–8 chars if not provided.
      for (let attempt = 0; attempt < 10; attempt++) {
        const candidate = randomCode(7 + (attempt % 2));
        const exists = await db.collection("coupons").doc(candidate).get();
        if (!exists.exists) {
          code = candidate;
          break;
        }
      }
      if (!code) {
        return NextResponse.json({ error: "Failed to generate unique coupon code" }, { status: 500 });
      }
    }

    const nowIso = new Date().toISOString();
    let expiresAt: string | null = null;
    if (typeof expiresAtRaw === "string" && expiresAtRaw.trim()) {
      const d = new Date(expiresAtRaw);
      if (isNaN(d.getTime())) {
        return NextResponse.json({ error: "Invalid expiresAt date" }, { status: 400 });
      }
      expiresAt = d.toISOString();
    }

    const docRef = db.collection("coupons").doc(code);
    const docSnap = await docRef.get();
    if (docSnap.exists) {
      return NextResponse.json({ error: "Coupon with this code already exists" }, { status: 409 });
    }

    const coupon: Coupon = {
      code,
      discountPercent,
      active: true,
      expiresAt,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    await docRef.set(coupon);
    return NextResponse.json(coupon, { status: 201 });
  } catch (e) {
    console.error("Failed to create coupon", e);
    return NextResponse.json({ error: "Failed to create coupon" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const authResult = await requireDashboardAuth(req);
  if ("error" in authResult) return authResult.error;
  const permErr = requirePermission(authResult.auth, "canEditAppData");
  if (permErr) return permErr;

  const db = getFirestore();

  try {
    const body = await req.json();
    const code = normalizeCode(body.code);
    if (!code) {
      return NextResponse.json({ error: "code is required" }, { status: 400 });
    }

    const updates: Partial<Coupon> & { updatedAt?: string } = {};
    if (typeof body.active === "boolean") updates.active = body.active;
    if (body.discountPercent !== undefined) {
      const discountPercent = Number(body.discountPercent);
      if (!Number.isFinite(discountPercent) || discountPercent <= 0 || discountPercent > 100) {
        return NextResponse.json({ error: "discountPercent must be between 1 and 100" }, { status: 400 });
      }
      updates.discountPercent = discountPercent;
    }
    if (body.expiresAt !== undefined) {
      const expiresAtRaw = body.expiresAt as string | null;
      if (expiresAtRaw === null || expiresAtRaw === "") {
        updates.expiresAt = null;
      } else if (typeof expiresAtRaw === "string") {
        const d = new Date(expiresAtRaw);
        if (isNaN(d.getTime())) {
          return NextResponse.json({ error: "Invalid expiresAt date" }, { status: 400 });
        }
        updates.expiresAt = d.toISOString();
      }
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }
    updates.updatedAt = new Date().toISOString();

    const docRef = db.collection("coupons").doc(code);
    const snap = await docRef.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Coupon not found" }, { status: 404 });
    }
    await docRef.set(updates, { merge: true });
    const updated = await docRef.get();
    return NextResponse.json(updated.data());
  } catch (e) {
    console.error("Failed to update coupon", e);
    return NextResponse.json({ error: "Failed to update coupon" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const authResult = await requireDashboardAuth(req);
  if ("error" in authResult) return authResult.error;
  const permErr = requirePermission(authResult.auth, "canEditAppData");
  if (permErr) return permErr;

  const db = getFirestore();
  try {
    const code = normalizeCode(req.nextUrl.searchParams.get("code"));
    if (!code) {
      return NextResponse.json({ error: "code query param is required" }, { status: 400 });
    }
    const docRef = db.collection("coupons").doc(code);
    const snap = await docRef.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Coupon not found" }, { status: 404 });
    }
    await docRef.delete();
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Failed to delete coupon", e);
    return NextResponse.json({ error: "Failed to delete coupon" }, { status: 500 });
  }
}


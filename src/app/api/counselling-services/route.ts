import { NextRequest, NextResponse } from "next/server";
import { getFirestore } from "@/lib/firebase-admin";
import { requireDashboardAuth, requireView, requirePermission } from "@/lib/api-auth";

const COLLECTION = "counsellingServices";

export async function GET(req: NextRequest) {
  const authResult = await requireDashboardAuth(req);
  if ("error" in authResult) return authResult.error;
  if (authResult.auth.role === "user") {
    return NextResponse.json({ error: "You can only access your own data. Use My profile." }, { status: 403 });
  }
  const viewErr = requireView(authResult.auth, "appData");
  if (viewErr) return viewErr;
  const db = getFirestore();
  try {
    const snapshot = await db.collection(COLLECTION).orderBy("order", "asc").get();
    const services = snapshot.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        name: String(d.name ?? ""),
        description: d.description != null ? String(d.description) : undefined,
        price: Number(d.price ?? 0),
        order: Number(d.order ?? 0),
      };
    });
    return NextResponse.json({ services });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to fetch counselling services" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const authResult = await requireDashboardAuth(req);
  if ("error" in authResult) return authResult.error;
  const permErr = requirePermission(authResult.auth, "canEditAppData");
  if (permErr) return permErr;
  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
  const price = typeof body.price === "number" ? body.price : Number(body.price) || 0;
  const order = typeof body.order === "number" ? body.order : Number(body.order) || 0;
  const description = body.description != null ? String(body.description).trim() : undefined;
  const db = getFirestore();
  try {
    const ref = await db.collection(COLLECTION).add({
      name,
      description: description || null,
      price,
      order,
    });
    const doc = await ref.get();
    const d = doc.data()!;
    return NextResponse.json({
      id: doc.id,
      name: String(d.name ?? ""),
      description: d.description != null ? String(d.description) : undefined,
      price: Number(d.price ?? 0),
      order: Number(d.order ?? 0),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to create counselling service" }, { status: 500 });
  }
}

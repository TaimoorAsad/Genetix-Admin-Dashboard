import { NextRequest, NextResponse } from "next/server";
import { verifyTokenAndGetRole } from "@/lib/firebase-admin";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 401 });
  }
  const parsed = await verifyTokenAndGetRole(token);
  if (!parsed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const { decoded, roleInfo } = parsed;
  return NextResponse.json({
    uid: decoded.uid,
    email: decoded.email,
    role: roleInfo.role,
    permissions: roleInfo.permissions ?? {},
    franchiseId: roleInfo.franchiseId ?? null,
    userId: roleInfo.userId ?? null,
  });
}

import * as admin from "firebase-admin";
import { NextResponse } from "next/server";
import type { AuthResult } from "./api-auth";

export type FranchiseUserAction = "read" | "edit" | "delete";

/**
 * When a franchise user has dashboard permission flags on their Franchise doc,
 * allow read/edit/delete only for app users whose `Franchise` field matches the franchise `number`.
 */
export async function assertFranchiseCanManageUser(
  db: admin.firestore.Firestore,
  auth: AuthResult,
  targetUserId: string,
  action: FranchiseUserAction
): Promise<NextResponse | null> {
  if (auth.role !== "franchise" || !auth.franchiseId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const franchiseDoc = await db.collection("Franchises").doc(auth.franchiseId).get();
  if (!franchiseDoc.exists) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const fd = franchiseDoc.data() ?? {};
  const canEdit = Boolean(fd.canEditFranchiseUsers);
  const canDelete = Boolean(fd.canDeleteFranchiseUsers);

  if (action === "read" && !canEdit && !canDelete) {
    return NextResponse.json({ error: "Forbidden: franchise user management not enabled" }, { status: 403 });
  }
  if (action === "edit" && !canEdit) {
    return NextResponse.json({ error: "Forbidden: edit not enabled for this franchise" }, { status: 403 });
  }
  if (action === "delete" && !canDelete) {
    return NextResponse.json({ error: "Forbidden: delete not enabled for this franchise" }, { status: 403 });
  }

  const franchiseNumber = String(fd.number ?? "").trim();
  if (!franchiseNumber) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const userDoc = await db.collection("users").doc(targetUserId).get();
  if (!userDoc.exists) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const userFranchise = String(userDoc.data()?.Franchise ?? "").trim();
  if (userFranchise !== franchiseNumber) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return null;
}

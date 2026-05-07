import { NextRequest, NextResponse } from "next/server";
import { getFirestore } from "@/lib/firebase-admin";

/**
 * Look up a user by email or phone number.
 * Returns their email (for Firebase Auth login) and UID.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const identifier = (body.identifier as string)?.trim();
  if (!identifier) {
    return NextResponse.json({ error: "identifier (email or phone) required" }, { status: 400 });
  }
  const db = getFirestore();
  try {
    let userDoc: { id: string; email?: string; phone?: string } | null = null;
    if (identifier.includes("@")) {
      const snapshot = await db.collection("users").where("Email", "==", identifier).limit(1).get();
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        userDoc = {
          id: doc.id,
          email: doc.data().Email as string | undefined,
          phone: doc.data()["Phone Number"] as string | undefined,
        };
      }
    } else {
      const snapshot = await db.collection("users").where("Phone Number", "==", identifier).limit(1).get();
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        userDoc = {
          id: doc.id,
          email: doc.data().Email as string | undefined,
          phone: doc.data()["Phone Number"] as string | undefined,
        };
      }
    }
    if (!userDoc || !userDoc.email) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    return NextResponse.json({ email: userDoc.email, uid: userDoc.id, phone: userDoc.phone });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to lookup user" }, { status: 500 });
  }
}

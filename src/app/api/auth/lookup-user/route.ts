import { NextRequest, NextResponse } from "next/server";
import { getFirestore, getAuth } from "@/lib/firebase-admin";

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
  const auth = getAuth();

  try {
    let userDoc: { id: string; email?: string; phone?: string } | null = null;

    if (identifier.includes("@")) {
      const lower = identifier.toLowerCase();
      // Try lowercase 'email' and uppercase 'Email'
      const candidates = [
        db.collection("users").where("email", "==", lower).limit(1),
        db.collection("users").where("Email", "==", identifier).limit(1),
        db.collection("users").where("email", "==", identifier).limit(1),
        db.collection("users").where("Email", "==", lower).limit(1),
      ];

      for (const query of candidates) {
        const snap = await query.get();
        if (!snap.empty) {
          const doc = snap.docs[0];
          const data = doc.data();
          userDoc = {
            id: doc.id,
            email: (data.email || data.Email) as string | undefined,
            phone: (data["Phone Number"] || data.phoneNumber || data.phone) as string | undefined,
          };
          break;
        }
      }

      // If not in Firestore users, check Firebase Auth directly
      if (!userDoc || !userDoc.email) {
        const authUser = await auth.getUserByEmail(lower).catch(() => null);
        if (authUser && authUser.email) {
          userDoc = {
            id: authUser.uid,
            email: authUser.email,
            phone: authUser.phoneNumber,
          };
        }
      }
    } else {
      // Phone search: normalize variations
      const rawDigits = identifier.replace(/\D/g, "");
      const variations = Array.from(
        new Set(
          [
            identifier,
            `+${rawDigits}`,
            rawDigits,
            rawDigits.length === 10 ? `+91${rawDigits}` : null,
            rawDigits.startsWith("91") && rawDigits.length === 12 ? `+${rawDigits}` : null,
          ].filter(Boolean)
        )
      ) as string[];

      for (const phoneVal of variations) {
        for (const field of ["Phone Number", "phoneNumber", "phone", "Number"]) {
          const snap = await db.collection("users").where(field, "==", phoneVal).limit(1).get();
          if (!snap.empty) {
            const doc = snap.docs[0];
            const data = doc.data();
            userDoc = {
              id: doc.id,
              email: (data.email || data.Email) as string | undefined,
              phone: (data["Phone Number"] || data.phoneNumber || data.phone) as string | undefined,
            };
            break;
          }
        }
        if (userDoc) break;
      }

      // If not in Firestore, check Firebase Auth by phone
      if (!userDoc || !userDoc.email) {
        for (const phoneVal of variations) {
          const normalizedPhone = phoneVal.startsWith("+") ? phoneVal : `+${phoneVal}`;
          const authUser = await auth.getUserByPhoneNumber(normalizedPhone).catch(() => null);
          if (authUser && authUser.email) {
            userDoc = {
              id: authUser.uid,
              email: authUser.email,
              phone: authUser.phoneNumber,
            };
            break;
          }
        }
      }
    }

    if (!userDoc || !userDoc.email) {
      return NextResponse.json(
        { error: "User not found. Make sure you're using the email or phone from your account." },
        { status: 404 }
      );
    }

    return NextResponse.json({ email: userDoc.email, uid: userDoc.id, phone: userDoc.phone });
  } catch (e) {
    console.error("Lookup user error:", e);
    return NextResponse.json({ error: "Failed to lookup user" }, { status: 500 });
  }
}


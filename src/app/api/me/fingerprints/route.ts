import * as admin from "firebase-admin";
import { NextRequest, NextResponse } from "next/server";
import { getFirestore } from "@/lib/firebase-admin";
import { requireDashboardAuth } from "@/lib/api-auth";

const FINGERS = ["Thumb", "Index", "Middle", "Ring", "Little"] as const;
type PositionData = { image: string; ABC?: string; XYZ?: string };
type FingerData = { Left: PositionData; Center: PositionData; Right: PositionData };
type HandData = Record<string, FingerData>;

function parseHandSnapshot(
  docs: admin.firestore.QueryDocumentSnapshot<admin.firestore.DocumentData>[]
): HandData {
  const hand: HandData = {};
  for (const finger of FINGERS) {
    const doc = docs.find((d) => d.id === finger);
    const data = doc?.data();
    const left = (data?.Left as PositionData) || { image: "" };
    const center = (data?.Center as PositionData) || { image: "" };
    const right = (data?.Right as PositionData) || { image: "" };
    hand[finger] = {
      Left: { image: left.image || "", ABC: left.ABC, XYZ: left.XYZ },
      Center: { image: center.image || "", ABC: center.ABC, XYZ: center.XYZ },
      Right: { image: right.image || "", ABC: right.ABC, XYZ: right.XYZ },
    };
  }
  return hand;
}

/** User role only: return own fingerprints. */
export async function GET(req: NextRequest) {
  const authResult = await requireDashboardAuth(req);
  if ("error" in authResult) return authResult.error;
  if (authResult.auth.role !== "user" || !authResult.auth.userId) {
    return NextResponse.json({ error: "Forbidden: user role required" }, { status: 403 });
  }
  const db = getFirestore();
  const userRef = db.collection("users").doc(authResult.auth.userId);
  try {
    const [leftSnap, rightSnap] = await Promise.all([
      userRef.collection("LeftHandFingerprints").get(),
      userRef.collection("RightHandFingerprints").get(),
    ]);
    const leftHand = parseHandSnapshot(leftSnap.docs);
    const rightHand = parseHandSnapshot(rightSnap.docs);
    return NextResponse.json({ leftHand, rightHand });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to fetch fingerprints" }, { status: 500 });
  }
}

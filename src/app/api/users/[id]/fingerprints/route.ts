import * as admin from "firebase-admin";
import { NextRequest, NextResponse } from "next/server";
import { getFirestore } from "@/lib/firebase-admin";
import { requireDashboardAuth, requireUserAccess } from "@/lib/api-auth";

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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireDashboardAuth(req);
    if ("error" in authResult) return authResult.error;
    const { id } = await params;
    const accessErr = requireUserAccess(authResult.auth, id);
    if (accessErr) return accessErr;
    const db = getFirestore();
    const userRef = db.collection("users").doc(id);
    const [leftSnap, rightSnap] = await Promise.all([
      userRef.collection("LeftHandFingerprints").get(),
      userRef.collection("RightHandFingerprints").get(),
    ]);
    const leftHand = parseHandSnapshot(leftSnap.docs);
    const rightHand = parseHandSnapshot(rightSnap.docs);
    return NextResponse.json({ leftHand, rightHand });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to fetch fingerprints";
    console.error(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

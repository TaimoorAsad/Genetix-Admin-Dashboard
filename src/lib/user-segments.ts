import type admin from "firebase-admin";

export type ImageStatus = "all" | "none" | "partial";

const FINGERS = ["Thumb", "Index", "Middle", "Ring", "Little"] as const;
const TOTAL_IMAGES = 5 * 3 * 2; // 5 fingers × 3 positions × 2 hands = 30

export async function getImageStatus(
  db: admin.firestore.Firestore,
  userId: string
): Promise<ImageStatus> {
  try {
    const userRef = db.collection("users").doc(userId);
    const [leftSnap, rightSnap] = await Promise.all([
      userRef.collection("LeftHandFingerprints").get(),
      userRef.collection("RightHandFingerprints").get(),
    ]);
    let imageCount = 0;
    for (const finger of FINGERS) {
      const leftDoc = leftSnap.docs.find((d) => d.id === finger);
      const rightDoc = rightSnap.docs.find((d) => d.id === finger);
      if (leftDoc) {
        const data = leftDoc.data();
        if (data.Left?.image) imageCount++;
        if (data.Center?.image) imageCount++;
        if (data.Right?.image) imageCount++;
      }
      if (rightDoc) {
        const data = rightDoc.data();
        if (data.Left?.image) imageCount++;
        if (data.Center?.image) imageCount++;
        if (data.Right?.image) imageCount++;
      }
    }
    if (imageCount === 0) return "none";
    if (imageCount === TOTAL_IMAGES) return "all";
    return "partial";
  } catch {
    return "none";
  }
}

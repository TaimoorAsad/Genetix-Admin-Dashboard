import * as admin from "firebase-admin";
import { NextRequest, NextResponse } from "next/server";
import { getFirestore } from "@/lib/firebase-admin";
import { requireDashboardAuth, requireView } from "@/lib/api-auth";

const BATCH_SIZE = 500;
const MAX_SCAN = 10000;
const FINGERS = ["Thumb", "Index", "Middle", "Ring", "Little"] as const;
const TOTAL_IMAGES = 5 * 3 * 2; // 5 fingers × 3 positions × 2 hands = 30

type ImageStatus = "all" | "none" | "partial";

async function getImageStatus(db: admin.firestore.Firestore, userId: string): Promise<ImageStatus> {
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

function userMatchesSearch(data: Record<string, unknown>, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const name = String(data["Full Name"] ?? "").toLowerCase();
  const email = String(data.Email ?? "").toLowerCase();
  const phone = String(data["Phone Number"] ?? "").toLowerCase();
  return name.includes(q) || email.includes(q) || phone.includes(q);
}

export async function GET(req: NextRequest) {
  try {
    const authResult = await requireDashboardAuth(req);
    if ("error" in authResult) return authResult.error;
    if (authResult.auth.role === "user") {
      return NextResponse.json({ error: "You can only access your own data. Use My profile." }, { status: 403 });
    }
    const viewErr = requireView(authResult.auth, "users");
    if (viewErr) return viewErr;
    const db = getFirestore();
    const search = req.nextUrl.searchParams.get("search")?.trim();

    if (search) {
      const results: { id: string; imageStatus?: ImageStatus; [key: string]: unknown }[] = [];
      let lastDoc: admin.firestore.DocumentSnapshot | null = null;
      let totalScanned = 0;
      while (totalScanned < MAX_SCAN) {
        let q: admin.firestore.Query = db.collection("users").limit(BATCH_SIZE);
        if (lastDoc) q = q.startAfter(lastDoc);
        const snapshot = await q.get();
        if (snapshot.empty) break;
        const statusPromises = snapshot.docs.map((doc) => getImageStatus(db, doc.id));
        const statuses = await Promise.all(statusPromises);
        for (let i = 0; i < snapshot.docs.length; i++) {
          totalScanned++;
          const doc = snapshot.docs[i];
          const data = doc.data();
          if (userMatchesSearch(data, search)) {
            results.push({ id: doc.id, imageStatus: statuses[i], ...data });
          }
        }
        lastDoc = snapshot.docs[snapshot.docs.length - 1];
        if (snapshot.docs.length < BATCH_SIZE) break;
      }
      return NextResponse.json({ users: results, nextLastId: null, fromSearch: true });
    }

    const limit = 50;
    const page = Math.max(1, Number(req.nextUrl.searchParams.get("page") || 1));
    const offset = (page - 1) * limit;
    const imageStatusParam = req.nextUrl.searchParams.get("imageStatus");
    const imageStatusFilter: ImageStatus | null =
      imageStatusParam && imageStatusParam !== "all-users" && ["all", "none", "partial"].includes(imageStatusParam)
        ? (imageStatusParam as ImageStatus)
        : null;

    if (imageStatusFilter) {
      const allFiltered: { id: string; imageStatus: ImageStatus; [key: string]: unknown }[] = [];
      let lastDoc: admin.firestore.DocumentSnapshot | null = null;
      let totalScanned = 0;
      const MAX_SCAN_FOR_FILTER = 10000;
      while (allFiltered.length < offset + limit && totalScanned < MAX_SCAN_FOR_FILTER) {
        let q: admin.firestore.Query = db.collection("users").limit(BATCH_SIZE);
        if (lastDoc) q = q.startAfter(lastDoc);
        const snapshot = await q.get();
        if (snapshot.empty) break;
        const statusPromises = snapshot.docs.map((doc) => getImageStatus(db, doc.id));
        const statuses = await Promise.all(statusPromises);
        for (let i = 0; i < snapshot.docs.length; i++) {
          totalScanned++;
          const doc = snapshot.docs[i];
          if (statuses[i] === imageStatusFilter) {
            allFiltered.push({ id: doc.id, imageStatus: statuses[i], ...doc.data() });
          }
        }
        lastDoc = snapshot.docs[snapshot.docs.length - 1];
        if (snapshot.docs.length < BATCH_SIZE) break;
      }
      const results = allFiltered.slice(offset, offset + limit);
      const totalPages = Math.ceil(allFiltered.length / limit);
      return NextResponse.json({
        users: results,
        page,
        totalPages,
        totalUsers: allFiltered.length,
        hasMore: offset + limit < allFiltered.length,
      });
    }

    const allUsers: { id: string; imageStatus: ImageStatus; [key: string]: unknown }[] = [];
    let lastDoc: admin.firestore.DocumentSnapshot | null = null;
    let totalScanned = 0;
    while (allUsers.length < offset + limit && totalScanned < MAX_SCAN) {
      let q: admin.firestore.Query = db.collection("users").limit(BATCH_SIZE);
      if (lastDoc) q = q.startAfter(lastDoc);
      const snapshot = await q.get();
      if (snapshot.empty) break;
      const statusPromises = snapshot.docs.map((doc) => getImageStatus(db, doc.id));
      const statuses = await Promise.all(statusPromises);
      for (let i = 0; i < snapshot.docs.length; i++) {
        totalScanned++;
        const doc = snapshot.docs[i];
        allUsers.push({ id: doc.id, imageStatus: statuses[i], ...doc.data() });
      }
      lastDoc = snapshot.docs[snapshot.docs.length - 1];
      if (snapshot.docs.length < BATCH_SIZE) break;
    }
    const results = allUsers.slice(offset, offset + limit);
    const totalPages = Math.ceil(allUsers.length / limit);
    return NextResponse.json({
      users: results,
      page,
      totalPages,
      totalUsers: allUsers.length,
      hasMore: offset + limit < allUsers.length,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to fetch users";
    console.error(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

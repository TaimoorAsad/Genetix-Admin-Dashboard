import * as admin from "firebase-admin";
import { NextRequest, NextResponse } from "next/server";
import { getFirestore, getMessaging } from "@/lib/firebase-admin";
import { requireDashboardAuth } from "@/lib/api-auth";
import { getImageStatus, type ImageStatus } from "@/lib/user-segments";
import type { NotificationAudience } from "@/lib/notifications";

const FCM_BATCH_SIZE = 500;

const BATCH_SIZE = 500;
const MAX_USERS = 5000;

function audienceToImageStatus(audience: NotificationAudience): ImageStatus | "all" | null {
  if (audience === "all") return "all";
  if (audience === "no_images") return "none";
  if (audience === "partial_images") return "partial";
  if (audience === "all_images") return "all";
  return null;
}

export async function POST(req: NextRequest) {
  const authResult = await requireDashboardAuth(req);
  if ("error" in authResult) return authResult.error;
  if (authResult.auth.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  let body: { message?: string; audience?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  const audience = (body.audience === "all" || body.audience === "no_images" ||
    body.audience === "partial_images" || body.audience === "all_images" || body.audience === "elite")
    ? (body.audience as NotificationAudience)
    : "all";

  const db = getFirestore();
  const now = new Date();
  const targetUserIds: string[] = [];

  try {
    if (audience === "elite") {
      const eliteSnap = await db.collection("users").where("isEliteMember", "==", true).limit(MAX_USERS).get();
      eliteSnap.docs.forEach((d) => targetUserIds.push(d.id));
    } else {
      const imageFilter = audienceToImageStatus(audience);
      let lastDoc: admin.firestore.DocumentSnapshot | null = null;
      while (targetUserIds.length < MAX_USERS) {
        let q: admin.firestore.Query = db.collection("users").limit(BATCH_SIZE);
        if (lastDoc) q = q.startAfter(lastDoc);
        const snapshot = await q.get();
        if (snapshot.empty) break;
        const statusPromises = snapshot.docs.map((d) => getImageStatus(db, d.id));
        const statuses = await Promise.all(statusPromises);
        for (let i = 0; i < snapshot.docs.length; i++) {
          if (targetUserIds.length >= MAX_USERS) break;
          const status = statuses[i];
          if (imageFilter === "all" || status === imageFilter) {
            targetUserIds.push(snapshot.docs[i].id);
          }
        }
        lastDoc = snapshot.docs[snapshot.docs.length - 1];
        if (snapshot.docs.length < BATCH_SIZE) break;
      }
    }

    const userNotificationsRef = db.collection("userNotifications");
    let written = 0;
    for (let i = 0; i < targetUserIds.length; i += BATCH_SIZE) {
      const chunk = targetUserIds.slice(i, i + BATCH_SIZE);
      const batch = db.batch();
      for (const userId of chunk) {
        const ref = userNotificationsRef.doc();
        batch.set(ref, {
          userId,
          message,
          audience,
          read: false,
          createdAt: now,
        });
        written++;
      }
      await batch.commit();
    }

    await db.collection("dashboardNotifications").add({
      type: "other",
      message: `Broadcast to app users (${audience}): ${message.slice(0, 80)}${message.length > 80 ? "…" : ""}`,
      createdAt: now,
      metadata: { audience, sentCount: written, broadcast: true },
    });

    // Send FCM push so notifications appear in the phone's notification bar
    const tokenSet = new Set<string>();
    const GET_ALL_BATCH = 100;
    for (let i = 0; i < targetUserIds.length; i += GET_ALL_BATCH) {
      const chunk = targetUserIds.slice(i, i + GET_ALL_BATCH);
      const refs = chunk.map((id) => db.collection("users").doc(id));
      const docs = await db.getAll(...refs);
      docs.forEach((doc) => {
        if (doc.exists) {
          const token = doc.data()?.fcmToken;
          if (typeof token === "string" && token.trim()) tokenSet.add(token.trim());
        }
      });
    }
    const allTokens = Array.from(tokenSet);
    let pushSent = 0;
    if (allTokens.length > 0) {
      const messaging = getMessaging();
      for (let i = 0; i < allTokens.length; i += FCM_BATCH_SIZE) {
        const batchTokens = allTokens.slice(i, i + FCM_BATCH_SIZE);
        const multicast = {
          tokens: batchTokens,
          notification: {
            title: "Genetix",
            body: message.slice(0, 256),
          },
          android: { priority: "high" as const },
          apns: { payload: { aps: { contentAvailable: true } }, fcmOptions: {} },
        };
        const result = await messaging.sendEachForMulticast(multicast);
        pushSent += result.successCount;
      }
    }

    return NextResponse.json({
      success: true,
      sent: written,
      pushSent,
      message: pushSent > 0
        ? `Saved for ${written} user(s) and sent ${pushSent} push notification(s) to the phone notification bar.`
        : `Saved for ${written} user(s). Enable notifications in the app so push can be sent next time.`,
    });
  } catch (e) {
    console.error("Send app notifications error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to send notifications" },
      { status: 500 }
    );
  }
}

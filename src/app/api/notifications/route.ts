import { NextRequest, NextResponse } from "next/server";
import { getFirestore } from "@/lib/firebase-admin";
import { requireDashboardAuth, requireView } from "@/lib/api-auth";
import type { NotificationType, DashboardNotification } from "@/lib/notifications";

export async function GET(req: NextRequest) {
  const authResult = await requireDashboardAuth(req);
  if ("error" in authResult) return authResult.error;
  if (authResult.auth.role === "user") {
    return NextResponse.json(
      { error: "You can only access your own data. Use My profile." },
      { status: 403 }
    );
  }
  const viewErr = requireView(authResult.auth, "stats");
  if (viewErr) return viewErr;

  const db = getFirestore();
  const searchParams = req.nextUrl.searchParams;
  const type = (searchParams.get("type") || "all") as NotificationType | "all";
  const limit = Math.min(Number(searchParams.get("limit") || "50"), 200);

  try {
    let query: FirebaseFirestore.Query = db
      .collection("dashboardNotifications")
      .orderBy("createdAt", "desc")
      .limit(limit);

    if (type !== "all") {
      query = query.where("type", "==", type);
    }

    const snap = await query.get();

    type RawNotificationDoc = {
      createdAt?: unknown;
      type?: NotificationType;
      message?: string;
      userId?: string;
      userEmail?: string;
      userName?: string;
      metadata?: Record<string, unknown>;
    };

    const notifications: DashboardNotification[] = snap.docs.map((doc) => {
      const data = doc.data() as RawNotificationDoc;
      const createdSource = data.createdAt as { toDate?: () => Date } | string | undefined;
      let createdAtIso: string | null = null;
      if (createdSource && typeof (createdSource as { toDate?: () => Date }).toDate === "function") {
        createdAtIso = (createdSource as { toDate: () => Date }).toDate().toISOString();
      } else if (typeof createdSource === "string") {
        createdAtIso = createdSource;
      } else {
        createdAtIso = new Date().toISOString();
      }

      const fallbackType: NotificationType = "other";
      const type = data.type ?? fallbackType;

      const autoMessage =
        type === "image_upload"
          ? "User uploaded an image"
          : type === "sign_in"
            ? "User signed in"
            : type === "elite_purchase"
              ? "User purchased Elite membership"
              : "Activity";

      return {
        id: doc.id,
        type,
        message: data.message || autoMessage,
        createdAt: createdAtIso,
        userId: data.userId,
        userEmail: data.userEmail,
        userName: data.userName,
        metadata: data.metadata,
      };
    });

    return NextResponse.json({ notifications });
  } catch (e) {
    console.error("Failed to load dashboard notifications", e);
    return NextResponse.json(
      { error: "Failed to load notifications" },
      { status: 500 }
    );
  }
}


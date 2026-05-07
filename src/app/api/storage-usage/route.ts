import { NextRequest, NextResponse } from "next/server";
import { getFirestore } from "@/lib/firebase-admin";
import { requireDashboardAuth, requireView } from "@/lib/api-auth";

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

  try {
    const doc = await db.doc("adminStats/storageUsage").get();
    const data = (doc.exists ? doc.data() : null) as
      | {
          totalBytes?: number;
          adminBytes?: number;
          franchiseBytes?: number;
          clientBytes?: number;
        }
      | null;

    const adminBytes = data?.adminBytes ?? 0;
    const franchiseBytes = data?.franchiseBytes ?? 0;
    const clientBytes = data?.clientBytes ?? 0;
    const totalBytes =
      data?.totalBytes ?? adminBytes + franchiseBytes + clientBytes;

    return NextResponse.json({
      totalBytes,
      adminBytes,
      franchiseBytes,
      clientBytes,
    });
  } catch (e) {
    console.error("Failed to fetch storage usage", e);
    return NextResponse.json(
      { error: "Failed to fetch storage usage" },
      { status: 500 }
    );
  }
}


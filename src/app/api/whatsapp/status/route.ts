import { NextResponse } from "next/server";
import {
  getWhatsAppStatus,
  ensureWhatsAppConnected,
  restartWhatsApp,
  logoutWhatsApp,
} from "@/lib/whatsapp";
import { getAuth } from "@/lib/firebase-admin";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const token = authHeader.split("Bearer ")[1];
    await getAuth().verifyIdToken(token);

    // Auto-connect on Vercel: if not connected, ensure connection with saved credentials
    await ensureWhatsAppConnected(4000);

    return NextResponse.json(await getWhatsAppStatus());
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: Request) {
  let token: string | undefined;
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    token = authHeader.split("Bearer ")[1];
    await getAuth().verifyIdToken(token);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { action } = await req.json();

    if (action === "restart") {
      await restartWhatsApp();
    } else if (action === "reset") {
      await restartWhatsApp(true);
    } else if (action === "logout") {
      await logoutWhatsApp();
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    return NextResponse.json({ success: true, ...(await getWhatsAppStatus()) });
  } catch (error) {
    console.error("Error processing WhatsApp status action:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

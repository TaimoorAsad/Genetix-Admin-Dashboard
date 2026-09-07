import { NextResponse } from "next/server";
import { getWhatsAppStatus, startWhatsApp, logoutWhatsApp } from "@/lib/whatsapp";
import { getAuth } from "@/lib/firebase-admin";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const token = authHeader.split("Bearer ")[1];
    await getAuth().verifyIdToken(token);

    // If it's disconnected, try to start it lazily on first access
    const status = getWhatsAppStatus();
    if (status.status === "disconnected" && !status.error) {
      startWhatsApp();
    }

    return NextResponse.json(getWhatsAppStatus());
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const token = authHeader.split("Bearer ")[1];
    await getAuth().verifyIdToken(token);

    const { action } = await req.json();

    if (action === "restart") {
      await startWhatsApp();
    } else if (action === "logout") {
      await logoutWhatsApp();
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

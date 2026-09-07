import { NextResponse } from "next/server";
import { getFirestore, getAuth } from "@/lib/firebase-admin";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const token = authHeader.split("Bearer ")[1];
    await getAuth().verifyIdToken(token);

    const doc = await getFirestore().collection("appData").doc("whatsappConfig").get();
    if (!doc.exists) {
      return NextResponse.json({ welcomeMessage: "" });
    }

    return NextResponse.json(doc.data());
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

    const { welcomeMessage } = await req.json();

    await getFirestore().collection("appData").doc("whatsappConfig").set({ welcomeMessage }, { merge: true });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

import { NextResponse } from "next/server";
import { getFirestore, getAuth } from "@/lib/firebase-admin";
import { getWASocket } from "@/lib/whatsapp";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const token = authHeader.split("Bearer ")[1];
    await getAuth().verifyIdToken(token);

    const { message, target } = await req.json();

    if (!message || !target) {
      return NextResponse.json({ error: "Message and target are required" }, { status: 400 });
    }

    const sock = await getWASocket();
    const db = getFirestore();

    // Fetch users based on target
    const usersQuery = db.collection("users");
    const snapshot = await usersQuery.get();

    let targetPhones: string[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      if (!data["Phone Number"]) return;

      const phone = data["Phone Number"].replace(/[^0-9]/g, ""); // Normalize phone
      
      const isComplete = data.ReportPremium === true || data.ReportNormal === true;
      const isPartial = data.isSubmitted === true && !isComplete;
      const noImages = !data.isSubmitted && !isComplete;

      if (target === "all") {
        targetPhones.push(phone);
      } else if (target === "no-images" && noImages) {
        targetPhones.push(phone);
      } else if (target === "partial" && isPartial) {
        targetPhones.push(phone);
      } else if (target === "completed" && isComplete) {
        targetPhones.push(phone);
      }
    });

    // Deduplicate
    targetPhones = Array.from(new Set(targetPhones));

    // Send messages asynchronously so we don't block the request
    (async () => {
      for (const phone of targetPhones) {
        try {
          // Check if number exists on WA
          const jid = `${phone}@s.whatsapp.net`;
          const [result] = await sock.onWhatsApp(jid);
          if (result?.exists) {
            await sock.sendMessage(jid, { text: message });
            // Add a small delay to avoid rate limiting
            await new Promise(r => setTimeout(r, 1000));
          }
        } catch (error) {
          console.error(`Failed to send message to ${phone}`, error);
        }
      }
    })();

    return NextResponse.json({ success: true, count: targetPhones.length });
  } catch (error: unknown) {
    console.error("Error sending broadcast:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed" }, { status: 500 });
  }
}

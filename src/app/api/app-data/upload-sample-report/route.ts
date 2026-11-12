import { NextRequest, NextResponse } from "next/server";
import { getFirestore, getStorage } from "@/lib/firebase-admin";
import { requireDashboardAuth, requirePermission } from "@/lib/api-auth";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  const authResult = await requireDashboardAuth(req);
  if ("error" in authResult) return authResult.error;

  const permErr = requirePermission(authResult.auth, "canEditAppData");
  if (permErr) return permErr;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const title = (formData.get("title") as string | null)?.trim() || "Sample Report";

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "Only PDF files are supported" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length === 0) {
      return NextResponse.json({ error: "File is empty" }, { status: 400 });
    }

    const bucket = getStorage().bucket();
    const token = crypto.randomUUID();
    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const destination = `sample-reports/${Date.now()}_${safeFileName}`;
    const fileUpload = bucket.file(destination);

    await fileUpload.save(buffer, {
      contentType: "application/pdf",
      metadata: {
        metadata: {
          firebaseStorageDownloadTokens: token,
        },
      },
    });

    // Make public if supported, and generate resilient Firebase Storage URL with token
    await fileUpload.makePublic().catch(() => {});
    const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(destination)}?alt=media&token=${token}`;

    const db = getFirestore();
    await db.collection("appData").doc("Settings").set(
      {
        sampleReportUrl: publicUrl,
        sampleReportTitle: title,
        sampleReportFileName: file.name,
        sampleReportUpdatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    return NextResponse.json({
      success: true,
      sampleReportUrl: publicUrl,
      sampleReportTitle: title,
      sampleReportFileName: file.name,
    });
  } catch (error) {
    console.error("Failed to upload sample report:", error);
    const message = error instanceof Error ? error.message : "Failed to upload sample report";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


import { NextRequest, NextResponse } from "next/server";
import { getFirestore } from "@/lib/firebase-admin";
import { requireDashboardAuth, requirePermission } from "@/lib/api-auth";

const COLLECTION = "appContent";
const SECTION = "aboutUs";

const DEFAULT_BLOCKS = [
  {
    type: "text" as const,
    content: `Scale Ability's professionally trained employees, psychologists, counsellors and DMIT experts who help Franchise's, Students and Parents by providing them hand holding support via live chat, email and phone to achieve desired goals.

Less than 10% of Indian Students undergo any form of career counselling! 85% students are unhappy with their career choices after 5 years! 17% of world's suicide's (age fewer than 21) happens in India! Less than 5 students in 100 undergo career counselling in T2 & T3 Cities in India!

For this a tried and tested with help of 90+ Franchisee Pan India level & till now we all have served DMIT reports more than 6000+ families

Even you can Learn & Join for educating our near & dear once's

Join us in bringing the change required!!`,
    order: 0,
  },
  {
    type: "text" as const,
    content: "Dr Bijal Viral Dalal\nMentor | Trainer | Counsellor\n\nVisit: genetix.in",
    order: 1,
  },
  {
    type: "video" as const,
    content: "https://genetix.in/",
    order: 2,
  },
];

export async function POST(req: NextRequest) {
  const authResult = await requireDashboardAuth(req);
  if ("error" in authResult) return authResult.error;
  const permErr = requirePermission(authResult.auth, "canEditAppData");
  if (permErr) return permErr;

  const db = getFirestore();
  try {
    const existing = await db
      .collection(COLLECTION)
      .where("section", "==", SECTION)
      .limit(1)
      .get();

    if (!existing.empty) {
      return NextResponse.json(
        { error: "About Us content already exists. Delete existing blocks first if you want to re-import." },
        { status: 400 }
      );
    }

    const batch = db.batch();
    for (let i = 0; i < DEFAULT_BLOCKS.length; i++) {
      const block = DEFAULT_BLOCKS[i];
      const ref = db.collection(COLLECTION).doc();
      batch.set(ref, {
        section: SECTION,
        type: block.type,
        content: block.content,
        order: block.order,
      });
    }
    await batch.commit();

    return NextResponse.json({ success: true, count: DEFAULT_BLOCKS.length });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to seed About Us content" }, { status: 500 });
  }
}

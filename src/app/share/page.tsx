import { getFirestore } from "@/lib/firebase-admin";
import ShareClient from "./ShareClient";

export const dynamic = "force-dynamic";

interface SharePageProps {
  searchParams: { [key: string]: string | string[] | undefined };
}

export default async function SharePage({ searchParams }: SharePageProps) {
  const codeRaw = searchParams?.referralCode;
  const referralCode =
    typeof codeRaw === "string"
      ? codeRaw.trim()
      : Array.isArray(codeRaw) && typeof codeRaw[0] === "string"
      ? codeRaw[0].trim()
      : "";

  let playStoreUrl = "https://play.google.com/store/apps/details?id=com.brainvita.dmit";
  let appStoreUrl = "https://apps.apple.com/app/id1498909115";

  try {
    const db = getFirestore();
    const doc = await db.collection("appData").doc("AppLink").get();
    if (doc.exists) {
      const data = doc.data();
      if (typeof data?.playStoreLink === "string" && data.playStoreLink.trim()) {
        playStoreUrl = data.playStoreLink.trim();
      }
      if (typeof data?.appStoreLink === "string" && data.appStoreLink.trim()) {
        appStoreUrl = data.appStoreLink.trim();
      }
    }
  } catch (err) {
    console.warn("Failed to fetch AppLink from firestore in /share page:", err);
  }

  return (
    <ShareClient
      referralCode={referralCode}
      playStoreUrl={playStoreUrl}
      appStoreUrl={appStoreUrl}
    />
  );
}

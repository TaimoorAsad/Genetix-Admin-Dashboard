import admin from "firebase-admin";
import fs from "node:fs";
import path from "node:path";

function loadEnvLocalIfNeeded() {
  // `node scripts/...` does not automatically load `.env.local` like Next.js does.
  const p = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(p)) return;
  const raw = fs.readFileSync(p, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1);
    if (!key) continue;
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v || !String(v).trim()) {
    throw new Error(`${name} is not set`);
  }
  return String(v);
}

function getAdminApp() {
  if (admin.apps.length > 0) return admin.app();
  loadEnvLocalIfNeeded();
  const raw = requireEnv("FIREBASE_SERVICE_ACCOUNT_JSON");
  let serviceAccount;
  try {
    serviceAccount = JSON.parse(raw);
  } catch (e) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is invalid JSON");
  }
  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

function nowIso() {
  return new Date().toISOString();
}

async function ensureDoc(db, collection, id, data) {
  const ref = db.collection(collection).doc(id);
  const snap = await ref.get();
  if (snap.exists) return { created: false, id };
  await ref.set(data, { merge: true });
  return { created: true, id };
}

async function main() {
  const app = getAdminApp();
  const db = app.firestore();

  const results = [];

  // Required for mobile app + dashboard (safe defaults).
  results.push(
    await ensureDoc(db, "appData", "Settings", {
      googleReviewUrl: "",
      notificationEmail: "",
      chatbotApiUrl: "",
      elitePromoCode: "ELITE23",
      referralShareMessage: "",
      fingerprintQualityTitle: "",
      fingerprintQualityBody: "",
      fingerprintQualityImageUrls: [],
      supportHelpVideos: [],
      fingerprintHelpVideos: [],
      updatedAt: nowIso(),
    })
  );

  // Used by Flutter (Home + Referral).
  results.push(
    await ensureDoc(db, "appData", "AppLink", {
      link: "https://genetix.in",
      updatedAt: nowIso(),
    })
  );

  // Used by Flutter (Client Feedback / testimonials videos).
  results.push(
    await ensureDoc(db, "appData", "Youtube", {
      "Client Playlist": ["GdRn5ShMgu0", "lkdfcL_-mTM"],
      updatedAt: nowIso(),
    })
  );

  // Used by Admin Dashboard → YouTube Help (dashboard has fallback, but we create it anyway).
  results.push(
    await ensureDoc(db, "appData", "YoutubeHelp", {
      videos: [
        { title: "DMIT Help", videoId: "GbgYzN1zoWI" },
        { title: "DMIT Course", videoId: "jWxV99aaG1I" },
        { title: "What is DMIT Test?", videoId: "LUv7_3nvlW8" }
      ],
      updatedAt: nowIso(),
    })
  );

  console.log("Bootstrap complete.");
  console.table(results);
}

main().catch((e) => {
  console.error("Bootstrap failed:", e?.message || e);
  process.exitCode = 1;
});


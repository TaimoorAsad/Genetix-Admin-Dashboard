import * as admin from "firebase-admin";
import type { DashboardRoleInfo, DashboardRoleDoc } from "./dashboard-roles";

const DASHBOARD_ROLES_COLLECTION = "dashboardRoles";

function getAdminApp(): admin.app.App {
  if (admin.apps.length > 0) {
    return admin.app() as admin.app.App;
  }
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON is not set. Add your Firebase service account JSON (minified) to .env.local"
    );
  }
  let serviceAccount: admin.ServiceAccount;
  try {
    serviceAccount = JSON.parse(serviceAccountJson) as admin.ServiceAccount;
  } catch (parseErr) {
    const msg = parseErr instanceof Error ? parseErr.message : "Invalid JSON";
    throw new Error(
      `FIREBASE_SERVICE_ACCOUNT_JSON is invalid (${msg}). Paste the full JSON on one line in .env.local with no ... or truncation.`
    );
  }
  return admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

export function getFirebaseAdmin(): admin.app.App {
  return getAdminApp();
}

export function getFirestore(): admin.firestore.Firestore {
  return getFirebaseAdmin().firestore();
}

export function getAuth(): admin.auth.Auth {
  return getFirebaseAdmin().auth();
}

export function getMessaging(): admin.messaging.Messaging {
  return getFirebaseAdmin().messaging();
}

/** Legacy: only allows UID/email in env. Use verifyTokenAndGetRole for role-based access. */
export async function verifyAdminToken(idToken: string): Promise<admin.auth.DecodedIdToken | null> {
  const auth = getAuth();
  const allowedUids = (process.env.ADMIN_UIDS || "").split(",").map((s) => s.trim()).filter(Boolean);
  const allowedEmails = (process.env.ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (allowedUids.length === 0 && allowedEmails.length === 0) {
    console.warn("ADMIN_UIDS and ADMIN_EMAILS are both empty – no admin access allowed.");
    return null;
  }
  try {
    const decoded = await auth.verifyIdToken(idToken);
    const allowed = allowedUids.includes(decoded.uid) || allowedEmails.includes((decoded.email || "").toLowerCase());
    return allowed ? decoded : null;
  } catch {
    return null;
  }
}

/**
 * Verify token and resolve dashboard role from Firestore (dashboardRoles/{uid}) or env (ADMIN_*).
 * Returns null if token invalid or user not allowed to use dashboard.
 */
export async function verifyTokenAndGetRole(
  idToken: string
): Promise<{ decoded: admin.auth.DecodedIdToken; roleInfo: DashboardRoleInfo } | null> {
  const auth = getAuth();
  const db = getFirestore();
  try {
    const decoded = await auth.verifyIdToken(idToken);
    const uid = decoded.uid;
    const email = (decoded.email || "").toLowerCase();

    // Env admins always get admin role (so .env.local takes precedence over Firestore)
    const allowedUids = (process.env.ADMIN_UIDS || "").split(",").map((s) => s.trim()).filter(Boolean);
    const allowedEmails = (process.env.ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    const isEnvAdmin = allowedUids.includes(uid) || allowedEmails.includes(email);
    if (isEnvAdmin) {
      return {
        decoded,
        roleInfo: { role: "admin", email: decoded.email || undefined },
      };
    }

    const roleDoc = await db.collection(DASHBOARD_ROLES_COLLECTION).doc(uid).get();
    if (roleDoc.exists) {
      const data = roleDoc.data() as DashboardRoleDoc | undefined;
      if (!data || !data.role) return null;
      const roleInfo: DashboardRoleInfo = {
        role: data.role,
        email: data.email || decoded.email || undefined,
        permissions: data.permissions,
        franchiseId: data.franchiseId,
        userId: data.userId,
      };
      return { decoded, roleInfo };
    }

    // No dashboard role doc: if this Firebase user exists as an app user, grant "user" role so they can see Profile and data
    const phone = (decoded as { phone_number?: string }).phone_number;
    const appEmail = (decoded.email || "").trim();
    let appUserId: string | undefined;
    const userByUid = await db.collection("users").doc(uid).get();
    if (userByUid.exists) {
      appUserId = uid;
    } else if (phone) {
      const byPhone = await db.collection("users").where("Phone Number", "==", phone).limit(1).get();
      if (!byPhone.empty) appUserId = byPhone.docs[0].id;
    }
    if (!appUserId && appEmail) {
      const byEmail = await db.collection("users").where("Email", "==", appEmail).limit(1).get();
      if (!byEmail.empty) appUserId = byEmail.docs[0].id;
    }
    if (appUserId) {
      return {
        decoded,
        roleInfo: {
          role: "user",
          email: decoded.email || undefined,
          userId: appUserId,
        },
      };
    }

    return null;
  } catch {
    return null;
  }
}

export { DASHBOARD_ROLES_COLLECTION };

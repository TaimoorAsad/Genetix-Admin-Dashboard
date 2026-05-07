import { NextRequest, NextResponse } from "next/server";
import { verifyTokenAndGetRole } from "@/lib/firebase-admin";
import type { DashboardRole, StaffPermissionKey } from "./dashboard-roles";

export interface AuthResult {
  uid: string;
  email: string | undefined;
  role: DashboardRole;
  permissions: Record<string, boolean>;
  franchiseId: string | undefined;
  userId: string | undefined;
}

function getToken(req: NextRequest): string | null {
  const authHeader = req.headers.get("authorization");
  return authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
}

/**
 * Require valid token and dashboard role. Returns error response or null; on success populates res with auth result in a header or we return the result.
 * Use parseAuthResult to read the result from the response we attach (we'll use a different pattern: return the result so route can use it).
 */
export async function requireDashboardAuth(
  req: NextRequest
): Promise<{ error: NextResponse } | { auth: AuthResult }> {
  const token = getToken(req);
  if (!token) return { error: NextResponse.json({ error: "Missing token" }, { status: 401 }) };
  const parsed = await verifyTokenAndGetRole(token);
  if (!parsed) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 403 }) };
  const { decoded, roleInfo } = parsed;
  const permissions =
    roleInfo.role === "admin"
      ? ({} as Record<string, boolean>) // admin has all; we check "admin || permissions.x" in routes
      : (roleInfo.permissions || {});

  const auth: AuthResult = {
    uid: decoded.uid,
    email: decoded.email,
    role: roleInfo.role,
    permissions: permissions as Record<string, boolean>,
    franchiseId: roleInfo.franchiseId,
    userId: roleInfo.userId,
  };
  return { auth };
}

/**
 * Require one of the given roles. Call after requireDashboardAuth.
 */
export function requireRole(auth: AuthResult, allowedRoles: DashboardRole[]): NextResponse | null {
  if (allowedRoles.includes(auth.role)) return null;
  return NextResponse.json({ error: "Forbidden: insufficient role" }, { status: 403 });
}

/**
 * Require admin or staff with the given permission. Use for actions (edit, delete, etc.).
 */
export function requirePermission(
  auth: AuthResult,
  permission: StaffPermissionKey
): NextResponse | null {
  if (auth.role === "admin") return null;
  if (auth.role === "staff" && auth.permissions[permission]) return null;
  return NextResponse.json({ error: "Forbidden: permission required" }, { status: 403 });
}

/**
 * Require admin or staff with view permission for the resource type. Maps to canView*.
 */
export function requireView(
  auth: AuthResult,
  resource: "stats" | "users" | "franchises" | "appData"
): NextResponse | null {
  if (auth.role === "admin") return null;
  if (auth.role !== "staff") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const key: StaffPermissionKey =
    resource === "stats"
      ? "canViewStats"
      : resource === "users"
        ? "canViewUsers"
        : resource === "franchises"
          ? "canViewFranchises"
          : "canViewAppData";
  if (auth.permissions[key]) return null;
  return NextResponse.json({ error: "Forbidden: view permission required" }, { status: 403 });
}

/**
 * Require that the request is for the current user's own userId (role user) or allow admin/staff with view.
 */
export function requireUserAccess(
  auth: AuthResult,
  requestedUserId: string
): NextResponse | null {
  if (auth.role === "admin") return null;
  if (auth.role === "staff" && auth.permissions["canViewUsers"]) return null;
  if (auth.role === "user" && auth.userId === requestedUserId) return null;
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

/**
 * Require that the request is for the current franchise's data (role franchise) or allow admin/staff.
 */
export function requireFranchiseAccess(
  auth: AuthResult,
  requestedFranchiseId: string
): NextResponse | null {
  if (auth.role === "admin") return null;
  if (auth.role === "staff" && auth.permissions["canViewFranchises"]) return null;
  if (auth.role === "franchise" && auth.franchiseId === requestedFranchiseId) return null;
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

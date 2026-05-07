/**
 * Dashboard roles and permissions.
 * - admin: full access; can manage staff permissions.
 * - staff: access gated by permissions (set by admin).
 * - franchise: can only view their own franchise (referral code etc.).
 * - user: can only view their own profile and uploaded images.
 */

export type DashboardRole = "admin" | "staff" | "franchise" | "user";

export const STAFF_PERMISSION_KEYS = [
  "canViewStats",
  "canViewUsers",
  "canEditUsers",
  "canDeleteUsers",
  "canViewFranchises",
  "canEditFranchises",
  "canDeleteFranchises",
  "canViewAppData",
  "canEditAppData",
] as const;

export type StaffPermissionKey = (typeof STAFF_PERMISSION_KEYS)[number];

export type StaffPermissions = Partial<Record<StaffPermissionKey, boolean>>;

export interface DashboardRoleInfo {
  role: DashboardRole;
  /** Set for staff; admin is treated as having all permissions. */
  permissions?: StaffPermissions;
  /** Set for franchise: Firestore Franchises document ID. */
  franchiseId?: string;
  /** Set for user: Firestore users document ID (app user to view). */
  userId?: string;
  /** Email from role doc or auth (for display). */
  email?: string;
}

export const DEFAULT_STAFF_PERMISSIONS: Record<StaffPermissionKey, boolean> = {
  canViewStats: false,
  canViewUsers: false,
  canEditUsers: false,
  canDeleteUsers: false,
  canViewFranchises: false,
  canEditFranchises: false,
  canDeleteFranchises: false,
  canViewAppData: false,
  canEditAppData: false,
};

/** Firestore document in dashboardRoles collection. */
export interface DashboardRoleDoc {
  role: DashboardRole;
  permissions?: StaffPermissions;
  franchiseId?: string;
  userId?: string;
  email?: string;
  updatedAt?: { _seconds: number } | unknown;
}

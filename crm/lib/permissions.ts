export type CrmRole =
  | "super_admin"
  | "admin"
  | "manager"
  | "salesperson"
  | "marketing"
  | "finance"
  | "viewer";

export type CrmModule =
  | "dashboard"
  | "leads"
  | "customers"
  | "pipeline"
  | "tasks"
  | "marketing"
  | "reports"
  | "staff"
  | "settings";

export const ROLE_MODULES: Record<CrmRole, CrmModule[]> = {
  /*
   * SUPER ADMIN
   * Full CRM and system administration access.
   */
  super_admin: [
    "dashboard",
    "leads",
    "customers",
    "pipeline",
    "tasks",
    "marketing",
    "reports",
    "staff",
    "settings",
  ],

  /*
   * ADMIN
   * Full operational access, but NO system administration.
   */
  admin: [
    "dashboard",
    "leads",
    "customers",
    "pipeline",
    "tasks",
    "marketing",
    "reports",
  ],

  /*
   * MANAGER
   * Operational management access.
   * No system settings or staff administration.
   */
  manager: [
    "dashboard",
    "leads",
    "customers",
    "pipeline",
    "tasks",
    "reports",
  ],

  /*
   * SALESPERSON
   * Own work only.
   * The individual pages will filter records
   * using the logged-in user's ID.
   */
  salesperson: [
    "dashboard",
    "leads",
    "customers",
    "pipeline",
    "tasks",
    "reports",
  ],

  /*
   * MARKETING
   */
  marketing: [
    "dashboard",
    "leads",
    "marketing",
    "reports",
  ],

  /*
   * FINANCE
   */
  finance: [
    "dashboard",
    "customers",
    "pipeline",
    "reports",
  ],

  /*
   * VIEWER
   */
  viewer: [
    "dashboard",
    "leads",
    "customers",
    "pipeline",
    "reports",
  ],
};

export function hasModuleAccess(
  role: string | null | undefined,
  module: CrmModule
): boolean {
  if (!role) return false;

  return ROLE_MODULES[role as CrmRole]?.includes(module) ?? false;
}

export function getRoleModules(
  role: string | null | undefined
): CrmModule[] {
  if (!role) return [];

  return ROLE_MODULES[role as CrmRole] ?? [];
}

export function isValidCrmRole(
  role: string | null | undefined
): role is CrmRole {
  return (
    role === "super_admin" ||
    role === "admin" ||
    role === "manager" ||
    role === "salesperson" ||
    role === "marketing" ||
    role === "finance" ||
    role === "viewer"
  );
}

/*
 * Roles that can see all operational records.
 */
export function canViewAllRecords(
  role: string | null | undefined
): boolean {
  return role === "super_admin" || role === "admin";
}

/*
 * Roles that are allowed to access Settings.
 */
export function canAccessSettings(
  role: string | null | undefined
): boolean {
  return role === "super_admin";
}

/*
 * Salespeople should see only their own assigned records.
 */
export function shouldRestrictToOwnRecords(
  role: string | null | undefined
): boolean {
  return role === "salesperson";
}

/*
 * Staff management is a Super Admin function.
 */
export function canManageStaff(
  role: string | null | undefined
): boolean {
  return role === "super_admin";
}

/*
 * User and role management is a Super Admin function.
 */
export function canManageUsers(
  role: string | null | undefined
): boolean {
  return role === "super_admin";
}
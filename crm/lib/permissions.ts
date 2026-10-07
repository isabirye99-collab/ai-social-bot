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
  | "advanced"
  | "settings";

export const ROLE_MODULES: Record<CrmRole, CrmModule[]> = {
  super_admin: ["dashboard","leads","customers","pipeline","tasks","marketing","reports","staff","advanced","settings"],
  admin: ["dashboard","leads","customers","pipeline","tasks","marketing","reports","advanced"],
  manager: ["dashboard","leads","customers","pipeline","tasks","reports","advanced"],
  salesperson: ["dashboard","leads","customers","pipeline","tasks","reports","advanced"],
  marketing: ["dashboard","leads","marketing","reports","advanced"],
  finance: ["dashboard","customers","pipeline","reports","advanced"],
  viewer: ["dashboard","leads","customers","pipeline","reports"],
};

export function hasModuleAccess(role: string | null | undefined, module: CrmModule): boolean {
  if (!role) return false;
  return ROLE_MODULES[role as CrmRole]?.includes(module) ?? false;
}

export function getRoleModules(role: string | null | undefined): CrmModule[] {
  if (!role) return [];
  return ROLE_MODULES[role as CrmRole] ?? [];
}

export function isValidCrmRole(role: string | null | undefined): role is CrmRole {
  return role === "super_admin" || role === "admin" || role === "manager" || role === "salesperson" || role === "marketing" || role === "finance" || role === "viewer";
}

export function canViewAllRecords(role: string | null | undefined): boolean {
  return role === "super_admin" || role === "admin";
}

export function canAccessSettings(role: string | null | undefined): boolean {
  return role === "super_admin";
}

export function shouldRestrictToOwnRecords(role: string | null | undefined): boolean {
  return role === "salesperson";
}

export function canManageStaff(role: string | null | undefined): boolean {
  return role === "super_admin";
}

export function canManageUsers(role: string | null | undefined): boolean {
  return role === "super_admin";
}

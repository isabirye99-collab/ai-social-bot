
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

export const ALL_CRM_MODULES: CrmModule[] = [
  "dashboard",
  "leads",
  "customers",
  "pipeline",
  "tasks",
  "marketing",
  "reports",
  "staff",
  "advanced",
  "settings",
];

export const MODULE_LABELS: Record<CrmModule, string> = {
  dashboard: "Dashboard",
  leads: "Leads",
  customers: "Customers",
  pipeline: "Pipeline",
  tasks: "Tasks",
  marketing: "Marketing",
  reports: "Reports",
  staff: "Staff",
  advanced: "Advanced",
  settings: "Settings",
};

export const ROLE_MODULES: Record<CrmRole, CrmModule[]> = {
  super_admin: [...ALL_CRM_MODULES],
  admin: [
    "dashboard",
    "leads",
    "customers",
    "pipeline",
    "tasks",
    "marketing",
    "reports",
    "staff",
    "advanced",
  ],
  manager: [
    "dashboard",
    "leads",
    "customers",
    "pipeline",
    "tasks",
    "reports",
    "advanced",
  ],
  salesperson: [
    "dashboard",
    "leads",
    "customers",
    "pipeline",
    "tasks",
    "reports",
    "advanced",
  ],
  marketing: ["dashboard", "leads", "marketing", "reports", "advanced"],
  finance: ["dashboard", "customers", "pipeline", "reports", "advanced"],
  viewer: ["dashboard", "leads", "customers", "pipeline", "reports"],
};

export function isValidCrmRole(
  role: string | null | undefined,
): role is CrmRole {
  return !!role && Object.prototype.hasOwnProperty.call(ROLE_MODULES, role);
}

/**
 * NULL/undefined means use role defaults.
 * An explicit array, including an empty array, overrides role defaults.
 * Super Admin always retains all modules.
 */
export function getEffectiveModules(
  role: string | null | undefined,
  modulePermissions?: string[] | null,
): CrmModule[] {
  if (!isValidCrmRole(role)) return [];

  if (role === "super_admin") {
    return [...ALL_CRM_MODULES];
  }

  const modules =
    modulePermissions == null
      ? ROLE_MODULES[role]
      : modulePermissions.filter(
          (module): module is CrmModule =>
            ALL_CRM_MODULES.includes(module as CrmModule),
        );

  return [...new Set(modules)];
}

export function hasModuleAccess(
  role: string | null | undefined,
  module: CrmModule,
  modulePermissions?: string[] | null,
): boolean {
  return getEffectiveModules(role, modulePermissions).includes(module);
}

export function getRoleModules(
  role: string | null | undefined,
): CrmModule[] {
  if (!isValidCrmRole(role)) return [];
  return [...ROLE_MODULES[role]];
}

export function canViewAllRecords(
  role: string | null | undefined,
): boolean {
  return role === "super_admin" || role === "admin";
}

export function canAccessSettings(
  role: string | null | undefined,
): boolean {
  return role === "super_admin";
}

export function shouldRestrictToOwnRecords(
  role: string | null | undefined,
): boolean {
  return role === "salesperson";
}

export function canManageStaff(
  role: string | null | undefined,
): boolean {
  return role === "super_admin";
}

export function canManageUsers(
  role: string | null | undefined,
): boolean {
  return role === "super_admin";
}

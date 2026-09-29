export const EMPLOYEE_PERMISSION_MODULES = [
  { key: "ledger", label: "နေ့စဉ် ရွှေစာရင်း" },
  { key: "finance", label: "ငွေစာရင်း / ဘဏ္ဍာရေး" },
  { key: "shopBook", label: "ဆိုင်စာရင်းအုပ်" },
] as const;

export const EMPLOYEE_PERMISSION_LEVELS = [
  "none",
  "view",
  "write",
  "manage",
] as const;

export type EmployeePermissionModule =
  (typeof EMPLOYEE_PERMISSION_MODULES)[number]["key"];
export type EmployeePermissionLevel =
  (typeof EMPLOYEE_PERMISSION_LEVELS)[number];
export type EmployeePermissions = Record<
  EmployeePermissionModule,
  EmployeePermissionLevel
>;

export const DEFAULT_EMPLOYEE_PERMISSIONS: EmployeePermissions = {
  ledger: "none",
  finance: "none",
  shopBook: "none",
};

const permissionRank: Record<EmployeePermissionLevel, number> = {
  none: 0,
  view: 1,
  write: 2,
  manage: 3,
};

export function hasEmployeePermission(
  user:
    | {
        role?: string | null;
        permissions?: EmployeePermissions | null;
        isActive?: boolean;
      }
    | null
    | undefined,
  module: EmployeePermissionModule,
  required: Exclude<EmployeePermissionLevel, "none">
): boolean {
  if (!user || user.isActive === false) return false;
  if (user.role === "admin") return true;
  const assigned = user.permissions?.[module] ?? "none";
  return permissionRank[assigned] >= permissionRank[required];
}

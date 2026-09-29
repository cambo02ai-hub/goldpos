import { describe, expect, it } from "vitest";
import {
  DEFAULT_EMPLOYEE_PERMISSIONS,
  hasEmployeePermission,
} from "../shared/permissions";

describe("employee permissions", () => {
  it("denies access by default", () => {
    expect(
      hasEmployeePermission(
        { role: "user", permissions: DEFAULT_EMPLOYEE_PERMISSIONS },
        "ledger",
        "view"
      )
    ).toBe(false);
  });

  it("grants view for write and manage levels", () => {
    expect(
      hasEmployeePermission(
        {
          role: "user",
          permissions: { ...DEFAULT_EMPLOYEE_PERMISSIONS, ledger: "write" },
        },
        "ledger",
        "view"
      )
    ).toBe(true);
    expect(
      hasEmployeePermission(
        {
          role: "user",
          permissions: { ...DEFAULT_EMPLOYEE_PERMISSIONS, ledger: "manage" },
        },
        "ledger",
        "write"
      )
    ).toBe(true);
  });

  it("does not grant write or manage from view-only access", () => {
    const user = {
      role: "user",
      permissions: { ...DEFAULT_EMPLOYEE_PERMISSIONS, finance: "view" },
    };
    expect(hasEmployeePermission(user, "finance", "view")).toBe(true);
    expect(hasEmployeePermission(user, "finance", "write")).toBe(false);
    expect(hasEmployeePermission(user, "finance", "manage")).toBe(false);
  });

  it("grants all module access to active admins only", () => {
    expect(
      hasEmployeePermission(
        { role: "admin", permissions: DEFAULT_EMPLOYEE_PERMISSIONS },
        "shopBook",
        "manage"
      )
    ).toBe(true);
    expect(
      hasEmployeePermission(
        {
          role: "admin",
          isActive: false,
          permissions: DEFAULT_EMPLOYEE_PERMISSIONS,
        },
        "shopBook",
        "manage"
      )
    ).toBe(false);
  });

  it("denies all permissions to disabled employees", () => {
    expect(
      hasEmployeePermission(
        {
          role: "user",
          isActive: false,
          permissions: { ...DEFAULT_EMPLOYEE_PERMISSIONS, ledger: "manage" },
        },
        "ledger",
        "view"
      )
    ).toBe(false);
  });
});

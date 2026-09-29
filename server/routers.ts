import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import {
  adminProcedure,
  permissionProcedure,
  publicProcedure,
  router,
} from "./_core/trpc";
import {
  createCashEntry,
  createGoldTransaction,
  createPaymentSettlement,
  deleteCashEntry,
  deleteGoldTransaction,
  getCashBook,
  getFinancialSummary,
  getGoldSummary,
  listCashEntries,
  listGoldTransactions,
  listOutstandingTransactions,
  listUsers,
  updateUserRole,
  listEmployees,
  createEmployee,
  updateEmployee,
  SHOP_ACCOUNTS,
  createShopJournalEntry,
  saveShopDailyClosing,
  createHlawOoEntry,
  createStaffLeaveEntry,
  deleteShopJournalEntry,
  deleteHlawOoEntry,
  deleteStaffLeaveEntry,
  getShopDailyOverview,
  listShopJournalEntries,
  listHlawOoEntries,
  listStaffLeaveEntries,
} from "./db";
import { authenticateLocalUser, hashPassword } from "./localAuth";
import { sdk } from "./_core/sdk";
import {
  EMPLOYEE_PERMISSION_LEVELS,
  type EmployeePermissions,
} from "@shared/permissions";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const transactionSchema = z.object({
  tradeDate: dateSchema,
  transactionType: z.enum(["sell", "buy"]),
  partyName: z.string().min(1).max(255),
  itemName: z.string().max(255).optional(),
  kyat: z.number().int().min(0).default(0),
  pae: z.number().int().min(0).max(15).default(0),
  yway: z.number().min(0).max(127).default(0),
  rate: z.number().int().min(0),
  paymentMethod: z
    .enum(["cash", "bank", "kbzpay", "wavepay", "other"])
    .default("cash"),
  paidAmount: z.number().int().min(0).optional(),
  note: z.string().max(500).optional(),
});

const dateRangeSchema = z
  .object({ from: dateSchema.optional(), to: dateSchema.optional() })
  .optional();
const cashEntrySchema = z.object({
  entryDate: dateSchema,
  entryType: z.enum(["income", "expense", "capital", "drawing"]),
  category: z.string().trim().min(1).max(100),
  counterparty: z.string().trim().max(255).optional(),
  amount: z.number().int().positive(),
  paymentMethod: z
    .enum(["cash", "bank", "kbzpay", "wavepay", "other"])
    .default("cash"),
  note: z.string().trim().max(500).optional(),
});
const settlementSchema = z.object({
  transactionId: z.number().int().positive(),
  settlementDate: dateSchema,
  settlementType: z.enum(["collection", "payment"]),
  amount: z.number().int().positive(),
  paymentMethod: z
    .enum(["cash", "bank", "kbzpay", "wavepay", "other"])
    .default("cash"),
  note: z.string().trim().max(500).optional(),
});

const shopJournalSchema = z.object({
  entryDate: dateSchema,
  side: z.enum(["debit", "credit"]),
  accountCode: z.string().regex(/^\d{4}$/),
  details: z.string().trim().min(1).max(255),
  kyat: z.number().int().min(0).default(0),
  pae: z.number().int().min(0).max(15).default(0),
  yway: z.number().min(0).max(127).default(0),
  rate: z.number().int().min(0).default(0),
  price: z.number().int().min(0).default(0),
  amount: z.number().int().positive(),
});
const dailyClosingSchema = z.object({
  closingDate: dateSchema,
  openingCash: z.number().int().min(0),
  openingGoldKyat: z.number().int().min(0),
  openingGoldPae: z.number().int().min(0).max(15),
  openingGoldYway: z.number().min(0).max(127),
  openingGoldValue: z.number().int().min(0),
  closingGoldKyat: z.number().int().min(0),
  closingGoldPae: z.number().int().min(0).max(15),
  closingGoldYway: z.number().min(0).max(127),
  closingGoldRate: z.number().int().min(0),
  countedCash: z.number().int().min(0).nullable().optional(),
  note: z.string().trim().max(500).nullable().optional(),
});
const hlawOoSchema = z.object({
  serviceDate: dateSchema,
  customerName: z.string().trim().min(1).max(255),
  hlawKyat: z.number().int().min(0).default(0),
  hlawPae: z.number().int().min(0).max(15).default(0),
  hlawYway: z.number().min(0).max(7.5).default(0),
  tinKyat: z.number().int().min(0).default(0),
  tinPae: z.number().int().min(0).max(15).default(0),
  tinHtwe: z.number().min(0).max(7.5).default(0),
  serviceFee: z.number().int().min(0).default(0),
  note: z.string().trim().max(500).optional(),
});
const staffLeaveSchema = z.object({
  leaveDate: dateSchema,
  employeeName: z.string().trim().min(1).max(255),
  leaveType: z.enum(["leave", "absent", "late", "other"]).default("leave"),
  dayUnits: z.number().positive().max(1).default(1),
  note: z.string().trim().max(500).optional(),
});

const employeePermissionsSchema = z.object({
  ledger: z.enum(EMPLOYEE_PERMISSION_LEVELS),
  finance: z.enum(EMPLOYEE_PERMISSION_LEVELS),
  shopBook: z.enum(EMPLOYEE_PERMISSION_LEVELS),
});
const employeeCreateSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3)
    .max(64)
    .regex(/^[A-Za-z0-9._@+-]+$/),
  name: z.string().trim().min(2).max(255),
  email: z.string().trim().email().max(320).nullable(),
  password: z.string().min(10).max(200),
  permissions: employeePermissionsSchema,
});
const employeeUpdateSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().trim().min(2).max(255),
  email: z.string().trim().email().max(320).nullable(),
  permissions: employeePermissionsSchema,
  isActive: z.boolean(),
  password: z.string().min(10).max(200).optional(),
});

const adminOnlyProcedure = adminProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Admin access required",
    });
  }
  return next({ ctx });
});

function isDuplicateKeyError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "ER_DUP_ENTRY"
  );
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => {
      if (!opts.ctx.user || opts.ctx.user.isActive === false) return null;
      const { passwordHash: _passwordHash, ...safeUser } = opts.ctx.user;
      return safeUser;
    }),
    login: publicProcedure
      .input(
        z.object({
          username: z.string().min(1).max(64),
          password: z.string().min(1).max(200),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const user = await authenticateLocalUser(
          input.username,
          input.password
        );
        if (!user)
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Invalid username or password",
          });
        const token = await sdk.createSessionToken(user.openId, {
          name: user.name ?? user.openId,
        });
        ctx.res.cookie(COOKIE_NAME, token, getSessionCookieOptions(ctx.req));
        return { success: true } as const;
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  ledger: router({
    list: permissionProcedure("ledger", "view")
      .input(
        z
          .object({
            from: dateSchema.optional(),
            to: dateSchema.optional(),
            type: z.enum(["sell", "buy"]).optional(),
          })
          .optional()
      )
      .query(({ input }) => listGoldTransactions(input)),
    summary: permissionProcedure("ledger", "view")
      .input(dateRangeSchema)
      .query(({ input }) => getGoldSummary(input)),
    create: permissionProcedure("ledger", "write")
      .input(transactionSchema)
      .mutation(({ input, ctx }) => {
        const weight = input.kyat + input.pae / 16 + input.yway / 128;
        const amount = Math.round(weight * input.rate);
        const paidAmount = input.paidAmount ?? amount;
        if (amount <= 0)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "အလေးချိန်နှင့် Rate ကို မှန်ကန်စွာ ဖြည့်ပေးပါ",
          });
        if (paidAmount > amount)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "လက်ခံ/ပေးချေပြီးငွေသည် စုစုပေါင်းထက် မကျော်ရပါ",
          });
        return createGoldTransaction({
          ...input,
          amount,
          paidAmount,
          createdBy: ctx.user.id,
        });
      }),
    remove: permissionProcedure("ledger", "manage")
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(({ input }) => deleteGoldTransaction(input.id)),
  }),
  finance: router({
    summary: permissionProcedure("finance", "view")
      .input(dateRangeSchema)
      .query(({ input }) => getFinancialSummary(input)),
    cashBook: permissionProcedure("finance", "view")
      .input(dateRangeSchema)
      .query(({ input }) => getCashBook(input)),
    entries: permissionProcedure("finance", "view")
      .input(dateRangeSchema)
      .query(({ input }) => listCashEntries(input)),
    createEntry: permissionProcedure("finance", "write")
      .input(cashEntrySchema)
      .mutation(({ input, ctx }) =>
        createCashEntry({ ...input, createdBy: ctx.user.id })
      ),
    removeEntry: permissionProcedure("finance", "manage")
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(({ input }) => deleteCashEntry(input.id)),
    outstanding: permissionProcedure("finance", "view").query(() =>
      listOutstandingTransactions()
    ),
    settle: permissionProcedure("finance", "write")
      .input(settlementSchema)
      .mutation(async ({ input, ctx }) => {
        try {
          return await createPaymentSettlement({
            ...input,
            createdBy: ctx.user.id,
          });
        } catch (error) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              error instanceof Error
                ? error.message
                : "အကြွေးစာရင်းရှင်းရာတွင် အမှားရှိပါသည်",
          });
        }
      }),
  }),
  shopBook: router({
    accounts: permissionProcedure("shopBook", "view").query(
      () => SHOP_ACCOUNTS
    ),
    daily: permissionProcedure("shopBook", "view")
      .input(z.object({ date: dateSchema }))
      .query(({ input }) => getShopDailyOverview(input.date)),
    saveDaily: permissionProcedure("shopBook", "write")
      .input(dailyClosingSchema)
      .mutation(({ input, ctx }) =>
        saveShopDailyClosing({
          ...input,
          countedCash: input.countedCash ?? null,
          note: input.note ?? null,
          createdBy: ctx.user.id,
        })
      ),
    journal: permissionProcedure("shopBook", "view")
      .input(
        z
          .object({
            from: dateSchema.optional(),
            to: dateSchema.optional(),
            side: z.enum(["debit", "credit"]).optional(),
          })
          .optional()
      )
      .query(({ input }) => listShopJournalEntries(input)),
    createJournal: permissionProcedure("shopBook", "write")
      .input(shopJournalSchema)
      .mutation(({ input, ctx }) =>
        createShopJournalEntry({
          ...input,
          sourceType: null,
          sourceId: null,
          createdBy: ctx.user.id,
        })
      ),
    removeJournal: permissionProcedure("shopBook", "manage")
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(({ input }) => deleteShopJournalEntry(input.id)),
    hlawOo: permissionProcedure("shopBook", "view")
      .input(dateRangeSchema)
      .query(({ input }) => listHlawOoEntries(input)),
    createHlawOo: permissionProcedure("shopBook", "write")
      .input(hlawOoSchema)
      .mutation(({ input, ctx }) =>
        createHlawOoEntry({ ...input, createdBy: ctx.user.id })
      ),
    removeHlawOo: permissionProcedure("shopBook", "manage")
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(({ input }) => deleteHlawOoEntry(input.id)),
    leaves: permissionProcedure("shopBook", "view")
      .input(dateRangeSchema)
      .query(({ input }) => listStaffLeaveEntries(input)),
    createLeave: permissionProcedure("shopBook", "write")
      .input(staffLeaveSchema)
      .mutation(({ input, ctx }) =>
        createStaffLeaveEntry({ ...input, createdBy: ctx.user.id })
      ),
    removeLeave: permissionProcedure("shopBook", "manage")
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(({ input }) => deleteStaffLeaveEntry(input.id)),
  }),
  admin: router({
    employees: adminOnlyProcedure.query(() => listEmployees()),
    createEmployee: adminOnlyProcedure
      .input(employeeCreateSchema)
      .mutation(async ({ input }) => {
        try {
          await createEmployee({
            username: input.username.toLowerCase(),
            name: input.name,
            email: input.email?.toLowerCase() ?? null,
            passwordHash: hashPassword(input.password),
            permissions: input.permissions as EmployeePermissions,
          });
          return { success: true } as const;
        } catch (error) {
          if (isDuplicateKeyError(error)) {
            throw new TRPCError({
              code: "CONFLICT",
              message: "ဤ username ဖြင့် account ရှိပြီးသားဖြစ်ပါသည်",
            });
          }
          throw error;
        }
      }),
    updateEmployee: adminOnlyProcedure
      .input(employeeUpdateSchema)
      .mutation(async ({ input }) => {
        try {
          await updateEmployee(input.id, {
            name: input.name,
            email: input.email?.toLowerCase() ?? null,
            permissions: input.permissions as EmployeePermissions,
            isActive: input.isActive,
            ...(input.password
              ? { passwordHash: hashPassword(input.password) }
              : {}),
          });
          return { success: true } as const;
        } catch (error) {
          if (
            error instanceof Error &&
            error.message === "Employee account not found"
          ) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Employee account မတွေ့ပါ",
            });
          }
          throw error;
        }
      }),
    users: adminOnlyProcedure.query(() => listUsers()),
    setRole: adminOnlyProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          role: z.enum(["user", "admin"]),
        })
      )
      .mutation(({ input }) => updateUserRole(input.id, input.role)),
  }),
});

export type AppRouter = typeof appRouter;

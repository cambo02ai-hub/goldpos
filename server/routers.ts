import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
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
  createLocalEmployee,
  updateUserPermissions,
  updateUserRole,
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
  confirmAgentAction,
  getAgentMessages,
  sendAgentMessage,
  startAgentTask,
} from "./manusAgent";

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
const permissionSchema = z.enum([
  "dashboard",
  "ledger",
  "finance",
  "shopBook",
  "hlawOo",
]);
const employeePermissionsSchema = z.array(permissionSchema).min(1).max(5);

const adminOnlyProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Admin access required",
    });
  }
  return next({ ctx });
});
const permissionProcedure = (permission: z.infer<typeof permissionSchema>) =>
  protectedProcedure.use(({ ctx, next }) => {
    if (ctx.user.role === "admin" || !ctx.user.permissions)
      return next({ ctx });
    let permissions: string[] = [];
    try {
      permissions = JSON.parse(ctx.user.permissions);
    } catch {
      permissions = [];
    }
    if (!permissions.includes(permission)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "ဤစာရင်းကို အသုံးပြုခွင့် မရှိပါ",
      });
    }
    return next({ ctx });
  });

export const appRouter = router({
  system: systemRouter,
  agent: router({
    start: adminOnlyProcedure
      .input(z.object({ message: z.string().trim().min(1).max(4000) }))
      .mutation(({ input, ctx }) => startAgentTask(ctx.user.id, input.message)),
    send: adminOnlyProcedure
      .input(z.object({ message: z.string().trim().min(1).max(4000) }))
      .mutation(({ input, ctx }) =>
        sendAgentMessage(ctx.user.id, input.message)
      ),
    messages: adminOnlyProcedure.query(({ ctx }) =>
      getAgentMessages(ctx.user.id)
    ),
    confirm: adminOnlyProcedure
      .input(
        z.object({
          eventId: z.string().min(1),
          input: z.record(z.string(), z.unknown()),
        })
      )
      .mutation(({ input, ctx }) =>
        confirmAgentAction(ctx.user.id, input.eventId, input.input)
      ),
  }),
  auth: router({
    me: publicProcedure.query(opts => {
      if (!opts.ctx.user) return null;
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
    list: permissionProcedure("ledger")
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
    summary: permissionProcedure("dashboard")
      .input(dateRangeSchema)
      .query(({ input }) => getGoldSummary(input)),
    create: permissionProcedure("ledger")
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
    remove: adminOnlyProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(({ input }) => deleteGoldTransaction(input.id)),
  }),
  finance: router({
    summary: permissionProcedure("finance")
      .input(dateRangeSchema)
      .query(({ input }) => getFinancialSummary(input)),
    cashBook: permissionProcedure("finance")
      .input(dateRangeSchema)
      .query(({ input }) => getCashBook(input)),
    entries: permissionProcedure("finance")
      .input(dateRangeSchema)
      .query(({ input }) => listCashEntries(input)),
    createEntry: permissionProcedure("finance")
      .input(cashEntrySchema)
      .mutation(({ input, ctx }) =>
        createCashEntry({ ...input, createdBy: ctx.user.id })
      ),
    removeEntry: adminOnlyProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(({ input }) => deleteCashEntry(input.id)),
    outstanding: permissionProcedure("finance").query(() =>
      listOutstandingTransactions()
    ),
    settle: permissionProcedure("finance")
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
    accounts: permissionProcedure("shopBook").query(() => SHOP_ACCOUNTS),
    daily: permissionProcedure("shopBook")
      .input(z.object({ date: dateSchema }))
      .query(({ input }) => getShopDailyOverview(input.date)),
    saveDaily: permissionProcedure("shopBook")
      .input(dailyClosingSchema)
      .mutation(({ input, ctx }) =>
        saveShopDailyClosing({
          ...input,
          countedCash: input.countedCash ?? null,
          note: input.note ?? null,
          createdBy: ctx.user.id,
        })
      ),
    journal: permissionProcedure("shopBook")
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
    createJournal: permissionProcedure("shopBook")
      .input(shopJournalSchema)
      .mutation(({ input, ctx }) =>
        createShopJournalEntry({
          ...input,
          sourceType: null,
          sourceId: null,
          createdBy: ctx.user.id,
        })
      ),
    removeJournal: adminOnlyProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(({ input }) => deleteShopJournalEntry(input.id)),
    hlawOo: permissionProcedure("hlawOo")
      .input(dateRangeSchema)
      .query(({ input }) => listHlawOoEntries(input)),
    createHlawOo: permissionProcedure("hlawOo")
      .input(hlawOoSchema)
      .mutation(({ input, ctx }) =>
        createHlawOoEntry({ ...input, createdBy: ctx.user.id })
      ),
    removeHlawOo: adminOnlyProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(({ input }) => deleteHlawOoEntry(input.id)),
    leaves: permissionProcedure("shopBook")
      .input(dateRangeSchema)
      .query(({ input }) => listStaffLeaveEntries(input)),
    createLeave: permissionProcedure("shopBook")
      .input(staffLeaveSchema)
      .mutation(({ input, ctx }) =>
        createStaffLeaveEntry({ ...input, createdBy: ctx.user.id })
      ),
    removeLeave: adminOnlyProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(({ input }) => deleteStaffLeaveEntry(input.id)),
  }),
  admin: router({
    users: adminOnlyProcedure.query(() => listUsers()),
    createEmployee: adminOnlyProcedure
      .input(
        z.object({
          username: z
            .string()
            .trim()
            .min(3)
            .max(64)
            .regex(/^[a-zA-Z0-9._-]+$/),
          name: z.string().trim().min(1).max(255),
          password: z.string().min(8).max(200),
          permissions: employeePermissionsSchema,
        })
      )
      .mutation(({ input }) =>
        createLocalEmployee({
          username: input.username,
          name: input.name,
          passwordHash: hashPassword(input.password),
          permissions: JSON.stringify(input.permissions),
        })
      ),
    setPermissions: adminOnlyProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          permissions: employeePermissionsSchema,
        })
      )
      .mutation(({ input }) =>
        updateUserPermissions(input.id, JSON.stringify(input.permissions))
      ),
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

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
  updateUserRole,
} from "./db";

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

const adminOnlyProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Admin access required",
    });
  }
  return next({ ctx });
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  ledger: router({
    list: protectedProcedure
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
    summary: protectedProcedure
      .input(dateRangeSchema)
      .query(({ input }) => getGoldSummary(input)),
    create: protectedProcedure
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
    summary: protectedProcedure
      .input(dateRangeSchema)
      .query(({ input }) => getFinancialSummary(input)),
    cashBook: protectedProcedure
      .input(dateRangeSchema)
      .query(({ input }) => getCashBook(input)),
    entries: protectedProcedure
      .input(dateRangeSchema)
      .query(({ input }) => listCashEntries(input)),
    createEntry: protectedProcedure
      .input(cashEntrySchema)
      .mutation(({ input, ctx }) =>
        createCashEntry({ ...input, createdBy: ctx.user.id })
      ),
    removeEntry: adminOnlyProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(({ input }) => deleteCashEntry(input.id)),
    outstanding: protectedProcedure.query(() => listOutstandingTransactions()),
    settle: protectedProcedure
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
  admin: router({
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

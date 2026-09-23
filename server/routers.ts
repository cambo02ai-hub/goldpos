import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  createGoldTransaction,
  deleteGoldTransaction,
  getGoldSummary,
  listGoldTransactions,
  listUsers,
  updateUserRole,
} from "./db";
import { authenticateLocalUser } from "./localAuth";
import { sdk } from "./_core/sdk";

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
  note: z.string().max(500).optional(),
});

const adminOnlyProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    login: publicProcedure
      .input(z.object({ username: z.string().min(1).max(64), password: z.string().min(1).max(200) }))
      .mutation(async ({ input, ctx }) => {
        const user = await authenticateLocalUser(input.username, input.password);
        if (!user) throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid username or password" });
        const token = await sdk.createSessionToken(user.openId, { name: user.name ?? user.openId });
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
    list: protectedProcedure
      .input(z.object({ from: dateSchema.optional(), to: dateSchema.optional(), type: z.enum(["sell", "buy"]).optional() }).optional())
      .query(({ input }) => listGoldTransactions(input)),
    summary: protectedProcedure
      .input(z.object({ from: dateSchema.optional(), to: dateSchema.optional() }).optional())
      .query(({ input }) => getGoldSummary(input)),
    create: protectedProcedure.input(transactionSchema).mutation(({ input, ctx }) => {
      const weight = input.kyat + input.pae / 16 + input.yway / 128;
      const amount = Math.round(weight * input.rate);
      return createGoldTransaction({ ...input, amount, createdBy: ctx.user.id });
    }),
    remove: adminOnlyProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ input }) => deleteGoldTransaction(input.id)),
  }),
  admin: router({
    users: adminOnlyProcedure.query(() => listUsers()),
    setRole: adminOnlyProcedure.input(z.object({ id: z.number().int().positive(), role: z.enum(["user", "admin"]) })).mutation(({ input }) => updateUserRole(input.id, input.role)),
  }),
});

export type AppRouter = typeof appRouter;

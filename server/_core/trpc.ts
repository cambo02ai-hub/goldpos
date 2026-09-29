import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from "@shared/const";
import {
  hasEmployeePermission,
  type EmployeePermissionLevel,
  type EmployeePermissionModule,
} from "@shared/permissions";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user || ctx.user.isActive === false) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export function permissionProcedure(
  module: EmployeePermissionModule,
  level: Exclude<EmployeePermissionLevel, "none">
) {
  return protectedProcedure.use(({ ctx, next }) => {
    if (!hasEmployeePermission(ctx.user, module, level)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "ဤလုပ်ဆောင်ချက်အတွက် ခွင့်ပြုချက် မလုံလောက်ပါ။",
      });
    }
    return next({ ctx });
  });
}

export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
  }

  return next({ ctx });
});

import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  goldTransactions,
  InsertGoldTransaction,
  InsertUser,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  values.lastSignedIn ??= new Date();
  updateSet.lastSignedIn ??= new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function upsertLocalAdmin(username: string, passwordHash: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.insert(users).values({
    openId: username,
    name: username,
    loginMethod: "local",
    passwordHash,
    role: "admin",
    lastSignedIn: new Date(),
  }).onDuplicateKeyUpdate({
    set: { name: username, loginMethod: "local", passwordHash, role: "admin" },
  });
}

export async function listGoldTransactions(filters?: { from?: string; to?: string; type?: "sell" | "buy" }) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filters?.from) conditions.push(gte(goldTransactions.tradeDate, filters.from));
  if (filters?.to) conditions.push(lte(goldTransactions.tradeDate, filters.to));
  if (filters?.type) conditions.push(eq(goldTransactions.transactionType, filters.type));
  return db
    .select()
    .from(goldTransactions)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(goldTransactions.tradeDate), desc(goldTransactions.id));
}

export async function createGoldTransaction(input: InsertGoldTransaction) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.insert(goldTransactions).values(input);
  return result;
}

export async function deleteGoldTransaction(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.delete(goldTransactions).where(eq(goldTransactions.id, id));
}

export async function getGoldSummary(filters?: { from?: string; to?: string }) {
  const db = await getDb();
  if (!db) return { sellCount: 0, buyCount: 0, sellAmount: 0, buyAmount: 0, sellWeight: 0, buyWeight: 0 };
  const conditions = [];
  if (filters?.from) conditions.push(gte(goldTransactions.tradeDate, filters.from));
  if (filters?.to) conditions.push(lte(goldTransactions.tradeDate, filters.to));
  const [row] = await db
    .select({
      sellCount: sql<number>`sum(case when ${goldTransactions.transactionType} = 'sell' then 1 else 0 end)`,
      buyCount: sql<number>`sum(case when ${goldTransactions.transactionType} = 'buy' then 1 else 0 end)`,
      sellAmount: sql<number>`coalesce(sum(case when ${goldTransactions.transactionType} = 'sell' then ${goldTransactions.amount} else 0 end), 0)`,
      buyAmount: sql<number>`coalesce(sum(case when ${goldTransactions.transactionType} = 'buy' then ${goldTransactions.amount} else 0 end), 0)`,
      sellWeight: sql<number>`coalesce(sum(case when ${goldTransactions.transactionType} = 'sell' then (${goldTransactions.kyat} + ${goldTransactions.pae} / 16 + ${goldTransactions.yway} / 128) else 0 end), 0)`,
      buyWeight: sql<number>`coalesce(sum(case when ${goldTransactions.transactionType} = 'buy' then (${goldTransactions.kyat} + ${goldTransactions.pae} / 16 + ${goldTransactions.yway} / 128) else 0 end), 0)`,
    })
    .from(goldTransactions)
    .where(conditions.length ? and(...conditions) : undefined);
  return {
    sellCount: Number(row?.sellCount ?? 0), buyCount: Number(row?.buyCount ?? 0),
    sellAmount: Number(row?.sellAmount ?? 0), buyAmount: Number(row?.buyAmount ?? 0),
    sellWeight: Number(row?.sellWeight ?? 0), buyWeight: Number(row?.buyWeight ?? 0),
  };
}

export async function listUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select({ id: users.id, name: users.name, email: users.email, role: users.role, lastSignedIn: users.lastSignedIn }).from(users).orderBy(desc(users.lastSignedIn));
}

export async function updateUserRole(id: number, role: "user" | "admin") {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.update(users).set({ role }).where(eq(users.id, id));
}

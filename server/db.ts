import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  cashEntries,
  goldTransactions,
  InsertCashEntry,
  InsertGoldTransaction,
  InsertPaymentSettlement,
  InsertUser,
  paymentSettlements,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

type DateFilters = { from?: string; to?: string };
type PaymentMethod = "cash" | "bank" | "kbzpay" | "wavepay" | "other";
type SettlementType = "collection" | "payment";

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
  await db
    .insert(users)
    .values(values)
    .onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);
  return result[0];
}

function dateConditions(
  column:
    | typeof goldTransactions.tradeDate
    | typeof cashEntries.entryDate
    | typeof paymentSettlements.settlementDate,
  filters?: DateFilters
) {
  const conditions = [];
  if (filters?.from) conditions.push(gte(column, filters.from));
  if (filters?.to) conditions.push(lte(column, filters.to));
  return conditions;
}

export async function listGoldTransactions(
  filters?: DateFilters & { type?: "sell" | "buy" }
) {
  const db = await getDb();
  if (!db) return [];
  const conditions = dateConditions(goldTransactions.tradeDate, filters);
  if (filters?.type)
    conditions.push(eq(goldTransactions.transactionType, filters.type));
  return db
    .select()
    .from(goldTransactions)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(goldTransactions.tradeDate), desc(goldTransactions.id));
}

export async function createGoldTransaction(input: InsertGoldTransaction) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const amount = Number(input.amount ?? 0);
  const paidAmount = Number(input.paidAmount ?? amount);
  if (paidAmount < 0 || paidAmount > amount)
    throw new Error(
      "Paid amount must be between zero and the transaction total"
    );
  const values = {
    ...input,
    paidAmount,
    paymentMethod: input.paymentMethod ?? "cash",
  };
  const result = await db.insert(goldTransactions).values(values);
  return result;
}

export async function deleteGoldTransaction(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.delete(goldTransactions).where(eq(goldTransactions.id, id));
}

export async function getGoldSummary(filters?: DateFilters) {
  const db = await getDb();
  if (!db)
    return {
      sellCount: 0,
      buyCount: 0,
      sellAmount: 0,
      buyAmount: 0,
      sellWeight: 0,
      buyWeight: 0,
    };
  const conditions = dateConditions(goldTransactions.tradeDate, filters);
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
    sellCount: Number(row?.sellCount ?? 0),
    buyCount: Number(row?.buyCount ?? 0),
    sellAmount: Number(row?.sellAmount ?? 0),
    buyAmount: Number(row?.buyAmount ?? 0),
    sellWeight: Number(row?.sellWeight ?? 0),
    buyWeight: Number(row?.buyWeight ?? 0),
  };
}

export async function listCashEntries(filters?: DateFilters) {
  const db = await getDb();
  if (!db) return [];
  const conditions = dateConditions(cashEntries.entryDate, filters);
  return db
    .select()
    .from(cashEntries)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(cashEntries.entryDate), desc(cashEntries.id));
}

export async function createCashEntry(input: InsertCashEntry) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  if (Number(input.amount) <= 0)
    throw new Error("Amount must be greater than zero");
  return db
    .insert(cashEntries)
    .values({ ...input, paymentMethod: input.paymentMethod ?? "cash" });
}

export async function deleteCashEntry(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.delete(cashEntries).where(eq(cashEntries.id, id));
}

export async function listPaymentSettlements(filters?: DateFilters) {
  const db = await getDb();
  if (!db) return [];
  const conditions = dateConditions(paymentSettlements.settlementDate, filters);
  return db
    .select()
    .from(paymentSettlements)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(
      desc(paymentSettlements.settlementDate),
      desc(paymentSettlements.id)
    );
}

async function settlementTotals() {
  const settlements = await listPaymentSettlements();
  return settlements.reduce<Map<number, number>>((totals, settlement) => {
    totals.set(
      settlement.transactionId,
      (totals.get(settlement.transactionId) ?? 0) + Number(settlement.amount)
    );
    return totals;
  }, new Map());
}

export async function listOutstandingTransactions() {
  const [transactions, totals] = await Promise.all([
    listGoldTransactions(),
    settlementTotals(),
  ]);
  return transactions
    .map(transaction => {
      const settledAmount = totals.get(transaction.id) ?? 0;
      const outstandingAmount = Math.max(
        0,
        Number(transaction.amount) -
          Number(transaction.paidAmount) -
          settledAmount
      );
      return { ...transaction, settledAmount, outstandingAmount };
    })
    .filter(transaction => transaction.outstandingAmount > 0);
}

export async function createPaymentSettlement(input: InsertPaymentSettlement) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const [transaction] = await db
    .select()
    .from(goldTransactions)
    .where(eq(goldTransactions.id, input.transactionId))
    .limit(1);
  if (!transaction) throw new Error("Transaction was not found");

  const expectedType: SettlementType =
    transaction.transactionType === "sell" ? "collection" : "payment";
  if (input.settlementType !== expectedType)
    throw new Error(
      "Settlement direction does not match the selected transaction"
    );
  const allSettlements = await db
    .select()
    .from(paymentSettlements)
    .where(eq(paymentSettlements.transactionId, input.transactionId));
  const settledAmount = allSettlements.reduce(
    (total, settlement) => total + Number(settlement.amount),
    0
  );
  const remaining =
    Number(transaction.amount) - Number(transaction.paidAmount) - settledAmount;
  if (Number(input.amount) <= 0 || Number(input.amount) > remaining)
    throw new Error("Settlement amount exceeds the remaining balance");
  return db
    .insert(paymentSettlements)
    .values({ ...input, paymentMethod: input.paymentMethod ?? "cash" });
}

export async function getFinancialSummary(filters?: DateFilters) {
  const [
    periodTransactions,
    periodCashEntries,
    periodSettlements,
    allOutstanding,
  ] = await Promise.all([
    listGoldTransactions(filters),
    listCashEntries(filters),
    listPaymentSettlements(filters),
    listOutstandingTransactions(),
  ]);

  const sum = (values: Array<{ amount: number }>) =>
    values.reduce((total, value) => total + Number(value.amount), 0);
  const sales = sum(
    periodTransactions.filter(
      transaction => transaction.transactionType === "sell"
    )
  );
  const purchases = sum(
    periodTransactions.filter(
      transaction => transaction.transactionType === "buy"
    )
  );
  const salesCollected = periodTransactions
    .filter(transaction => transaction.transactionType === "sell")
    .reduce((total, transaction) => total + Number(transaction.paidAmount), 0);
  const purchasesPaid = periodTransactions
    .filter(transaction => transaction.transactionType === "buy")
    .reduce((total, transaction) => total + Number(transaction.paidAmount), 0);
  const otherIncome = sum(
    periodCashEntries.filter(entry => entry.entryType === "income")
  );
  const expenses = sum(
    periodCashEntries.filter(entry => entry.entryType === "expense")
  );
  const capital = sum(
    periodCashEntries.filter(entry => entry.entryType === "capital")
  );
  const drawings = sum(
    periodCashEntries.filter(entry => entry.entryType === "drawing")
  );
  const collections = sum(
    periodSettlements.filter(
      settlement => settlement.settlementType === "collection"
    )
  );
  const supplierPayments = sum(
    periodSettlements.filter(
      settlement => settlement.settlementType === "payment"
    )
  );
  const cashIn = salesCollected + collections + otherIncome + capital;
  const cashOut = purchasesPaid + supplierPayments + expenses + drawings;
  const receivables = allOutstanding
    .filter(transaction => transaction.transactionType === "sell")
    .reduce((total, transaction) => total + transaction.outstandingAmount, 0);
  const payables = allOutstanding
    .filter(transaction => transaction.transactionType === "buy")
    .reduce((total, transaction) => total + transaction.outstandingAmount, 0);

  return {
    sales,
    purchases,
    salesCollected,
    purchasesPaid,
    otherIncome,
    expenses,
    capital,
    drawings,
    collections,
    supplierPayments,
    cashIn,
    cashOut,
    netCashMovement: cashIn - cashOut,
    receivables,
    payables,
    receivableCount: allOutstanding.filter(
      transaction => transaction.transactionType === "sell"
    ).length,
    payableCount: allOutstanding.filter(
      transaction => transaction.transactionType === "buy"
    ).length,
  };
}

export async function getCashBook(filters?: DateFilters) {
  const [transactions, entries, settlements, allTransactions] =
    await Promise.all([
      listGoldTransactions(filters),
      listCashEntries(filters),
      listPaymentSettlements(filters),
      listGoldTransactions(),
    ]);
  const transactionNames = new Map(
    allTransactions.map(transaction => [transaction.id, transaction.partyName])
  );
  const items = [
    ...transactions
      .filter(transaction => Number(transaction.paidAmount) > 0)
      .map(transaction => ({
        id: `trade-${transaction.id}`,
        date: transaction.tradeDate,
        source:
          transaction.transactionType === "sell" ? "အရောင်းငွေ" : "အဝယ်ငွေ",
        description: `${transaction.partyName}${transaction.itemName ? ` • ${transaction.itemName}` : ""}`,
        paymentMethod: transaction.paymentMethod as PaymentMethod,
        cashIn:
          transaction.transactionType === "sell"
            ? Number(transaction.paidAmount)
            : 0,
        cashOut:
          transaction.transactionType === "buy"
            ? Number(transaction.paidAmount)
            : 0,
        note: transaction.note,
        createdAt: transaction.createdAt,
      })),
    ...entries.map(entry => ({
      id: `entry-${entry.id}`,
      date: entry.entryDate,
      source: (
        {
          income: "အခြားဝင်ငွေ",
          expense: "အသုံးစရိတ်",
          capital: "မတည်ငွေ",
          drawing: "ကိုယ်ပိုင်ထုတ်ငွေ",
        } as const
      )[entry.entryType],
      description: entry.counterparty
        ? `${entry.category} • ${entry.counterparty}`
        : entry.category,
      paymentMethod: entry.paymentMethod as PaymentMethod,
      cashIn:
        entry.entryType === "income" || entry.entryType === "capital"
          ? Number(entry.amount)
          : 0,
      cashOut:
        entry.entryType === "expense" || entry.entryType === "drawing"
          ? Number(entry.amount)
          : 0,
      note: entry.note,
      createdAt: entry.createdAt,
    })),
    ...settlements.map(settlement => ({
      id: `settlement-${settlement.id}`,
      date: settlement.settlementDate,
      source:
        settlement.settlementType === "collection"
          ? "အကြွေးလက်ခံ"
          : "အကြွေးပေးချေ",
      description:
        transactionNames.get(settlement.transactionId) ??
        `စာရင်း #${settlement.transactionId}`,
      paymentMethod: settlement.paymentMethod as PaymentMethod,
      cashIn:
        settlement.settlementType === "collection"
          ? Number(settlement.amount)
          : 0,
      cashOut:
        settlement.settlementType === "payment" ? Number(settlement.amount) : 0,
      note: settlement.note,
      createdAt: settlement.createdAt,
    })),
  ];
  return items.sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      Number(new Date(b.createdAt)) - Number(new Date(a.createdAt))
  );
}

export async function listUsers() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      lastSignedIn: users.lastSignedIn,
    })
    .from(users)
    .orderBy(desc(users.lastSignedIn));
}

export async function updateUserRole(id: number, role: "user" | "admin") {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.update(users).set({ role }).where(eq(users.id, id));
}

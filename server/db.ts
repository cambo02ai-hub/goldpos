import { and, desc, eq, gte, lt, lte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  cashEntries,
  goldTransactions,
  hlawOoEntries,
  InsertCashEntry,
  InsertHlawOoEntry,
  InsertGoldTransaction,
  InsertPaymentSettlement,
  InsertShopDailyClosing,
  InsertShopJournalEntry,
  InsertStaffLeaveEntry,
  InsertUser,
  paymentSettlements,
  shopDailyClosings,
  shopJournalEntries,
  staffLeaveEntries,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import {
  calculateHlawKyoot,
  calculateNo2Weight,
  calculateStockBalance,
  estimateDailyGoldProfit,
  goldWeight,
  goldWeightParts,
} from "../shared/shop-calculations";

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
    | typeof paymentSettlements.settlementDate
    | typeof shopJournalEntries.entryDate
    | typeof shopDailyClosings.closingDate
    | typeof hlawOoEntries.serviceDate
    | typeof staffLeaveEntries.leaveDate,
  filters?: DateFilters
) {
  const conditions = [];
  if (filters?.from) conditions.push(gte(column, filters.from));
  if (filters?.to) conditions.push(lte(column, filters.to));
  return conditions;
}

export async function upsertLocalAdmin(
  username: string,
  passwordHash: string
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db
    .insert(users)
    .values({
      openId: username,
      name: username,
      loginMethod: "local",
      passwordHash,
      role: "admin",
      lastSignedIn: new Date(),
    })
    .onDuplicateKeyUpdate({
      set: {
        name: username,
        loginMethod: "local",
        passwordHash,
        role: "admin",
      },
    });
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
  const transactionId = Number((result as any)[0]?.insertId ?? 0);
  if (transactionId && paidAmount > 0) {
    await db.insert(shopJournalEntries).values({
      entryDate: input.tradeDate,
      side: input.transactionType === "sell" ? "debit" : "credit",
      accountCode: input.transactionType === "sell" ? "1001" : "2001",
      details: `${input.transactionType === "sell" ? "အရောင်း" : "အဝယ်"} · ${input.partyName}${input.itemName ? ` · ${input.itemName}` : ""}`,
      kyat: input.kyat,
      pae: input.pae,
      yway: input.yway,
      rate: input.rate,
      price: amount,
      amount: paidAmount,
      sourceType: "gold_transaction",
      sourceId: transactionId,
      createdBy: input.createdBy,
    });
  }
  return result;
}

export async function deleteGoldTransaction(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const linkedSettlements = await db
    .select({ id: paymentSettlements.id })
    .from(paymentSettlements)
    .where(eq(paymentSettlements.transactionId, id));
  for (const settlement of linkedSettlements) {
    await db
      .delete(shopJournalEntries)
      .where(
        and(
          eq(shopJournalEntries.sourceType, "settlement"),
          eq(shopJournalEntries.sourceId, settlement.id)
        )
      );
  }
  await db
    .delete(paymentSettlements)
    .where(eq(paymentSettlements.transactionId, id));
  await db
    .delete(shopJournalEntries)
    .where(
      and(
        eq(shopJournalEntries.sourceType, "gold_transaction"),
        eq(shopJournalEntries.sourceId, id)
      )
    );
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
  const result = await db
    .insert(cashEntries)
    .values({ ...input, paymentMethod: input.paymentMethod ?? "cash" });
  const entryId = Number((result as any)[0]?.insertId ?? 0);
  const posting = {
    income: { side: "debit" as const, accountCode: "1004" },
    expense: { side: "credit" as const, accountCode: "2010" },
    capital: { side: "debit" as const, accountCode: "1006" },
    drawing: { side: "credit" as const, accountCode: "2006" },
  }[input.entryType];
  if (entryId)
    await db.insert(shopJournalEntries).values({
      entryDate: input.entryDate,
      ...posting,
      details: `${input.category}${input.counterparty ? ` · ${input.counterparty}` : ""}`,
      kyat: 0,
      pae: 0,
      yway: 0,
      rate: 0,
      price: 0,
      amount: input.amount,
      sourceType: "cash_entry",
      sourceId: entryId,
      createdBy: input.createdBy,
    });
  return result;
}

export async function deleteCashEntry(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db
    .delete(shopJournalEntries)
    .where(
      and(
        eq(shopJournalEntries.sourceType, "cash_entry"),
        eq(shopJournalEntries.sourceId, id)
      )
    );
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
  const paymentMethod = input.paymentMethod ?? "cash";
  const result = await db
    .insert(paymentSettlements)
    .values({ ...input, paymentMethod });
  const settlementId = Number((result as any)[0]?.insertId ?? 0);
  if (settlementId)
    await db.insert(shopJournalEntries).values({
      entryDate: input.settlementDate,
      side: input.settlementType === "collection" ? "debit" : "credit",
      accountCode:
        input.settlementType === "collection"
          ? paymentMethod === "cash"
            ? "1006"
            : "1005"
          : paymentMethod === "cash"
            ? "2006"
            : "2005",
      details: `${input.settlementType === "collection" ? "အကြွေးလက်ခံ" : "အကြွေးပေးချေ"} · ${transaction.partyName}`,
      kyat: 0,
      pae: 0,
      yway: 0,
      rate: 0,
      price: 0,
      amount: input.amount,
      sourceType: "settlement",
      sourceId: settlementId,
      createdBy: input.createdBy,
    });
  return result;
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

export const SHOP_ACCOUNTS = [
  { code: "1001", name: "အရောင်းစာရင်း", side: "debit", group: "နေ့စဉ်စာရင်း" },
  { code: "1002", name: "လှော်ခ", side: "debit", group: "ဝန်ဆောင်မှု" },
  { code: "1003", name: "AC အလဲစီးရီး", side: "debit", group: "စာရင်းညှိ" },
  {
    code: "1004",
    name: "Other Income / အခြားဝင်ငွေ",
    side: "debit",
    group: "ဝင်ငွေ",
  },
  { code: "1005", name: "Banking In", side: "debit", group: "ဘဏ်ဝင်" },
  { code: "1006", name: "စာရင်းညှိ (အဝင်)", side: "debit", group: "စာရင်းညှိ" },
  { code: "1007", name: "No-2 အဝယ်", side: "debit", group: "No-2 စာရင်း" },
  { code: "1008", name: "UMHO-In", side: "debit", group: "အခြားစာရင်း" },
  { code: "1009", name: "DSH-In", side: "debit", group: "အခြားစာရင်း" },
  { code: "2001", name: "အဝယ်စာရင်း", side: "credit", group: "နေ့စဉ်စာရင်း" },
  {
    code: "2002",
    name: "လုပ်ငန်းသုံးပစ္စည်း",
    side: "credit",
    group: "လုပ်ငန်းစရိတ်",
  },
  { code: "2003", name: "လဲခ", side: "credit", group: "လုပ်ငန်းစရိတ်" },
  { code: "2004", name: "ရရန်စာရင်း", side: "credit", group: "အကြွေး/ညှိ" },
  { code: "2005", name: "Banking-Out", side: "credit", group: "ဘဏ်ထွက်" },
  {
    code: "2006",
    name: "စာရင်းညှိ (အထွက်)",
    side: "credit",
    group: "စာရင်းညှိ",
  },
  {
    code: "2007",
    name: "No-2 အရောင်းစာရင်း",
    side: "credit",
    group: "No-2 စာရင်း",
  },
  { code: "2008", name: "စက်သုံးဆီ", side: "credit", group: "လုပ်ငန်းစရိတ်" },
  { code: "2009", name: "Profit / အမြတ်", side: "credit", group: "အမြတ်" },
  {
    code: "2010",
    name: "အထွေထွေစရိတ်",
    side: "credit",
    group: "လုပ်ငန်းစရိတ်",
  },
  {
    code: "2011",
    name: "ရွှေတော + UMHO",
    side: "credit",
    group: "အခြားစာရင်း",
  },
  { code: "2012", name: "DSH-Out", side: "credit", group: "အခြားစာရင်း" },
  { code: "2013", name: "အခွန် / အခ", side: "credit", group: "အခွန်" },
] as const;

export async function listShopJournalEntries(
  filters?: DateFilters & { side?: "debit" | "credit" }
) {
  const db = await getDb();
  if (!db) return [];
  const conditions = dateConditions(shopJournalEntries.entryDate, filters);
  if (filters?.side) conditions.push(eq(shopJournalEntries.side, filters.side));
  return db
    .select()
    .from(shopJournalEntries)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(shopJournalEntries.entryDate), desc(shopJournalEntries.id));
}

export async function createShopJournalEntry(input: InsertShopJournalEntry) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const account = SHOP_ACCOUNTS.find(item => item.code === input.accountCode);
  if (!account) throw new Error("Account code was not found");
  if (account.side !== input.side)
    throw new Error(
      "Debit/Credit side does not match the selected account code"
    );
  if (Number(input.amount) <= 0)
    throw new Error("Amount must be greater than zero");
  return db.insert(shopJournalEntries).values(input);
}

export async function deleteShopJournalEntry(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const [row] = await db
    .select({ sourceType: shopJournalEntries.sourceType })
    .from(shopJournalEntries)
    .where(eq(shopJournalEntries.id, id))
    .limit(1);
  if (!row || row.sourceType)
    throw new Error("Only manual journal entries can be removed here");
  return db.delete(shopJournalEntries).where(eq(shopJournalEntries.id, id));
}

async function getBookTotals(date: string) {
  const db = await getDb();
  if (!db) return { debit: 0, credit: 0 };
  const [row] = await db
    .select({
      debit: sql<number>`coalesce(sum(case when ${shopJournalEntries.side} = 'debit' then ${shopJournalEntries.amount} else 0 end), 0)`,
      credit: sql<number>`coalesce(sum(case when ${shopJournalEntries.side} = 'credit' then ${shopJournalEntries.amount} else 0 end), 0)`,
    })
    .from(shopJournalEntries)
    .where(eq(shopJournalEntries.entryDate, date));
  return { debit: Number(row?.debit ?? 0), credit: Number(row?.credit ?? 0) };
}

export async function getShopDailyOverview(date: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const [currentRows, priorRows, goldSummary, journal] = await Promise.all([
    db
      .select()
      .from(shopDailyClosings)
      .where(eq(shopDailyClosings.closingDate, date))
      .limit(1),
    db
      .select()
      .from(shopDailyClosings)
      .where(lt(shopDailyClosings.closingDate, date))
      .orderBy(desc(shopDailyClosings.closingDate))
      .limit(1),
    getGoldSummary({ from: date, to: date }),
    listShopJournalEntries({ from: date, to: date }),
  ]);
  const current = currentRows[0];
  // Always use the latest close strictly before the selected date.
  // This keeps a saved day's opening linked to the prior day's closing.
  const previous = priorRows[0];
  const previousDate = previous?.closingDate;
  const previousTotals = previousDate
    ? await getBookTotals(previousDate)
    : { debit: 0, credit: 0 };
  const [betweenTrades, betweenJournal] = previousDate
    ? await Promise.all([
        listGoldTransactions({ from: previousDate, to: date }),
        listShopJournalEntries({ from: previousDate, to: date }),
      ])
    : [[], []];
  const interveningTrades = betweenTrades.filter(
    transaction =>
      transaction.tradeDate > previousDate! && transaction.tradeDate < date
  );
  const interveningJournal = betweenJournal.filter(
    entry => entry.entryDate > previousDate! && entry.entryDate < date
  );
  const interimCashMovement = interveningJournal.reduce(
    (balance, entry) =>
      balance + (entry.side === "debit" ? 1 : -1) * Number(entry.amount),
    0
  );
  const previousCash = previous
    ? previous.countedCash === null
      ? Number(previous.openingCash) +
        previousTotals.debit -
        previousTotals.credit +
        interimCashMovement
      : Number(previous.countedCash) + interimCashMovement
    : 0;
  const previousGoldWeight = previous
    ? goldWeight({
        kyat: Number(previous.closingGoldKyat),
        pae: Number(previous.closingGoldPae),
        yway: Number(previous.closingGoldYway),
      }) +
      interveningTrades.reduce(
        (weight, transaction) =>
          weight +
          (transaction.transactionType === "buy" ? 1 : -1) *
            goldWeight({
              kyat: Number(transaction.kyat),
              pae: Number(transaction.pae),
              yway: Number(transaction.yway),
            }),
        0
      )
    : 0;
  const previousGoldValue = previous
    ? Math.round(
        (Number(previous.closingGoldKyat) +
          Number(previous.closingGoldPae) / 16 +
          Number(previous.closingGoldYway) / 128) *
          Number(previous.closingGoldRate)
      ) +
      interveningTrades.reduce(
        (value, transaction) =>
          value +
          (transaction.transactionType === "buy" ? 1 : -1) *
            Number(transaction.amount),
        0
      )
    : 0;
  const opening = previous
    ? {
        cash: previousCash,
        ...(() => {
          const parts = goldWeightParts(previousGoldWeight);
          return {
            goldKyat: parts.kyat,
            goldPae: parts.pae,
            goldYway: parts.yway,
          };
        })(),
        goldValue: previousGoldValue,
      }
    : current
      ? {
          cash: Number(current.openingCash),
          goldKyat: Number(current.openingGoldKyat),
          goldPae: Number(current.openingGoldPae),
          goldYway: Number(current.openingGoldYway),
          goldValue: Number(current.openingGoldValue),
        }
      : {
          cash: 0,
          goldKyat: 0,
          goldPae: 0,
          goldYway: 0,
          goldValue: 0,
        };
  const stockBalance = calculateStockBalance({
    opening: {
      kyat: opening.goldKyat,
      pae: opening.goldPae,
      yway: opening.goldYway,
    },
    boughtWeight: goldSummary.buyWeight,
    soldWeight: goldSummary.sellWeight,
  });
  const totals = journal.reduce(
    (result, entry) => {
      result[entry.side] += Number(entry.amount);
      return result;
    },
    { debit: 0, credit: 0 }
  );
  const expectedCash = opening.cash + totals.debit - totals.credit;
  const closing = current
    ? {
        goldKyat: Number(current.closingGoldKyat),
        goldPae: Number(current.closingGoldPae),
        goldYway: Number(current.closingGoldYway),
        goldRate: Number(current.closingGoldRate),
        countedCash:
          current.countedCash === null ? null : Number(current.countedCash),
        note: current.note,
      }
    : null;
  const closingValue = closing
    ? Math.round(
        goldWeight({
          kyat: closing.goldKyat,
          pae: closing.goldPae,
          yway: closing.goldYway,
        }) * closing.goldRate
      )
    : 0;
  return {
    date,
    opening,
    openingSource: previous ? "previous_closing" : "manual",
    previousClosingDate: previous?.closingDate ?? null,
    closing,
    sales: goldSummary.sellAmount,
    purchases: goldSummary.buyAmount,
    soldWeight: goldSummary.sellWeight,
    boughtWeight: goldSummary.buyWeight,
    stockBalance,
    debit: totals.debit,
    credit: totals.credit,
    expectedCash,
    cashVariance:
      closing?.countedCash === null || closing?.countedCash === undefined
        ? null
        : closing.countedCash - expectedCash,
    closingValue,
    estimatedGoldProfit: closing
      ? estimateDailyGoldProfit({
          sales: goldSummary.sellAmount,
          purchases: goldSummary.buyAmount,
          openingValue: opening.goldValue,
          closingWeight: {
            kyat: closing.goldKyat,
            pae: closing.goldPae,
            yway: closing.goldYway,
          },
          closingRate: closing.goldRate,
        })
      : null,
    isClosed: Boolean(current),
  };
}

export async function saveShopDailyClosing(input: InsertShopDailyClosing) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const overview = await getShopDailyOverview(input.closingDate);
  const opening =
    overview.openingSource === "manual" && !overview.isClosed
      ? {
          cash: Number(input.openingCash),
          goldKyat: Number(input.openingGoldKyat),
          goldPae: Number(input.openingGoldPae),
          goldYway: Number(input.openingGoldYway),
          goldValue: Number(input.openingGoldValue),
        }
      : overview.opening;
  const openingGold = {
    kyat: opening.goldKyat,
    pae: opening.goldPae,
    yway: opening.goldYway,
  };
  const calculatedStock = calculateStockBalance({
    opening: openingGold,
    boughtWeight: overview.boughtWeight,
    soldWeight: overview.soldWeight,
  });
  if (calculatedStock.expectedClosingWeight < 0)
    throw new Error(
      "ရွှေလက်ကျန် အနုတ်ဖြစ်နေပါသည်။ အဖွင့်လက်ကျန်နှင့် ဝယ်/ရောင်းစာရင်းကို ပြန်စစ်ပြီးမှ နေ့ပိတ်ပါ"
    );
  const calculatedClosing = calculatedStock.expectedClosing;
  const weightNumbers = [
    opening.goldKyat,
    opening.goldPae,
    opening.goldYway,
    calculatedClosing.kyat,
    calculatedClosing.pae,
    calculatedClosing.yway,
  ];
  if (weightNumbers.some(value => Number(value) < 0))
    throw new Error("Gold weight cannot be negative");
  if (Number(input.openingCash) < 0 || Number(input.closingGoldRate) < 0)
    throw new Error("Opening cash and gold rate cannot be negative");
  const values = {
    ...input,
    openingCash: opening.cash,
    openingGoldKyat: opening.goldKyat,
    openingGoldPae: opening.goldPae,
    openingGoldYway: opening.goldYway,
    openingGoldValue: opening.goldValue,
    closingGoldKyat: calculatedClosing.kyat,
    closingGoldPae: calculatedClosing.pae,
    closingGoldYway: calculatedClosing.yway,
  };
  return db
    .insert(shopDailyClosings)
    .values(values)
    .onDuplicateKeyUpdate({
      set: {
        openingCash: input.openingCash,
        openingGoldKyat: input.openingGoldKyat,
        openingGoldPae: input.openingGoldPae,
        openingGoldYway: input.openingGoldYway,
        openingGoldValue: input.openingGoldValue,
        closingGoldKyat: input.closingGoldKyat,
        closingGoldPae: input.closingGoldPae,
        closingGoldYway: input.closingGoldYway,
        closingGoldRate: input.closingGoldRate,
        countedCash: input.countedCash,
        note: input.note,
        createdBy: input.createdBy,
      },
    });
}

export async function listHlawOoEntries(filters?: DateFilters) {
  const db = await getDb();
  if (!db) return [];
  const conditions = dateConditions(hlawOoEntries.serviceDate, filters);
  const rows = await db
    .select()
    .from(hlawOoEntries)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(hlawOoEntries.serviceDate), desc(hlawOoEntries.id));
  return rows.map(row => {
    const no2 = calculateNo2Weight({
      kyat: Number(row.hlawKyat),
      pae: Number(row.hlawPae),
      yway: Number(row.hlawYway),
    });
    const kyoot = calculateHlawKyoot(
      {
        kyat: Number(row.hlawKyat),
        pae: Number(row.hlawPae),
        yway: Number(row.hlawYway),
      },
      {
        kyat: Number(row.tinKyat),
        pae: Number(row.tinPae),
        htwe: Number(row.tinHtwe),
      }
    );
    return {
      ...row,
      no2Kyat: no2.kyat,
      no2Pae: no2.pae,
      no2Yway: no2.yway,
      kyoot,
    };
  });
}

export async function createHlawOoEntry(input: InsertHlawOoEntry) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  if (!input.customerName.trim()) throw new Error("Customer name is required");
  if (
    [
      input.hlawKyat,
      input.hlawPae,
      input.hlawYway,
      input.tinKyat,
      input.tinPae,
      input.tinHtwe,
      input.serviceFee,
    ].some(value => Number(value) < 0)
  )
    throw new Error("Weight and fee cannot be negative");
  const result = await db.insert(hlawOoEntries).values(input);
  const entryId = Number((result as any)[0]?.insertId ?? 0);
  if (entryId && Number(input.serviceFee) > 0) {
    await db.insert(shopJournalEntries).values({
      entryDate: input.serviceDate,
      side: "debit",
      accountCode: "1002",
      details: `လှော်ခ · ${input.customerName}`,
      kyat: input.hlawKyat ?? 0,
      pae: input.hlawPae ?? 0,
      yway: input.hlawYway ?? 0,
      rate: 0,
      price: 0,
      amount: input.serviceFee ?? 0,
      sourceType: "hlaw_oo",
      sourceId: entryId,
      createdBy: input.createdBy,
    });
  }
  return result;
}

export async function deleteHlawOoEntry(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db
    .delete(shopJournalEntries)
    .where(
      and(
        eq(shopJournalEntries.sourceType, "hlaw_oo"),
        eq(shopJournalEntries.sourceId, id)
      )
    );
  return db.delete(hlawOoEntries).where(eq(hlawOoEntries.id, id));
}

export async function listStaffLeaveEntries(filters?: DateFilters) {
  const db = await getDb();
  if (!db) return [];
  const conditions = dateConditions(staffLeaveEntries.leaveDate, filters);
  return db
    .select()
    .from(staffLeaveEntries)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(staffLeaveEntries.leaveDate), staffLeaveEntries.employeeName);
}

export async function createStaffLeaveEntry(input: InsertStaffLeaveEntry) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  if (
    !input.employeeName.trim() ||
    Number(input.dayUnits) <= 0 ||
    Number(input.dayUnits) > 1
  )
    throw new Error("Employee name and leave units (0–1 day) are required");
  return db.insert(staffLeaveEntries).values(input);
}

export async function deleteStaffLeaveEntry(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.delete(staffLeaveEntries).where(eq(staffLeaveEntries.id, id));
}

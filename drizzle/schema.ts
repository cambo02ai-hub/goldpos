import {
  bigint,
  int,
  mysqlEnum,
  mysqlTable,
  timestamp,
  varchar,
  double,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const goldTransactions = mysqlTable("gold_transactions", {
  id: int("id").autoincrement().primaryKey(),
  tradeDate: varchar("tradeDate", { length: 10 }).notNull(),
  transactionType: mysqlEnum("transactionType", ["sell", "buy"]).notNull(),
  partyName: varchar("partyName", { length: 255 }).notNull(),
  itemName: varchar("itemName", { length: 255 }),
  kyat: int("kyat").default(0).notNull(),
  pae: int("pae").default(0).notNull(),
  yway: double("yway").default(0).notNull(),
  rate: bigint("rate", { mode: "number" }).default(0).notNull(),
  amount: bigint("amount", { mode: "number" }).default(0).notNull(),
  paymentMethod: mysqlEnum("paymentMethod", [
    "cash",
    "bank",
    "kbzpay",
    "wavepay",
    "other",
  ])
    .default("cash")
    .notNull(),
  paidAmount: bigint("paidAmount", { mode: "number" }).default(0).notNull(),
  note: varchar("note", { length: 500 }),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const cashEntries = mysqlTable("cash_entries", {
  id: int("id").autoincrement().primaryKey(),
  entryDate: varchar("entryDate", { length: 10 }).notNull(),
  entryType: mysqlEnum("entryType", [
    "income",
    "expense",
    "capital",
    "drawing",
  ]).notNull(),
  category: varchar("category", { length: 100 }).notNull(),
  counterparty: varchar("counterparty", { length: 255 }),
  amount: bigint("amount", { mode: "number" }).notNull(),
  paymentMethod: mysqlEnum("paymentMethod", [
    "cash",
    "bank",
    "kbzpay",
    "wavepay",
    "other",
  ])
    .default("cash")
    .notNull(),
  note: varchar("note", { length: 500 }),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const paymentSettlements = mysqlTable("payment_settlements", {
  id: int("id").autoincrement().primaryKey(),
  transactionId: int("transactionId").notNull(),
  settlementDate: varchar("settlementDate", { length: 10 }).notNull(),
  settlementType: mysqlEnum("settlementType", [
    "collection",
    "payment",
  ]).notNull(),
  amount: bigint("amount", { mode: "number" }).notNull(),
  paymentMethod: mysqlEnum("paymentMethod", [
    "cash",
    "bank",
    "kbzpay",
    "wavepay",
    "other",
  ])
    .default("cash")
    .notNull(),
  note: varchar("note", { length: 500 }),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type GoldTransaction = typeof goldTransactions.$inferSelect;
export type InsertGoldTransaction = typeof goldTransactions.$inferInsert;
export type CashEntry = typeof cashEntries.$inferSelect;
export type InsertCashEntry = typeof cashEntries.$inferInsert;
export type PaymentSettlement = typeof paymentSettlements.$inferSelect;
export type InsertPaymentSettlement = typeof paymentSettlements.$inferInsert;

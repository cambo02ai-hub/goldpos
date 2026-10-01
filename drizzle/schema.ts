import {
  bigint,
  int,
  mysqlEnum,
  mysqlTable,
  timestamp,
  varchar,
  double,
  json,
  uniqueIndex,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  passwordHash: varchar("passwordHash", { length: 255 }),
  permissions: json("permissions").$type<string[]>(),
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

export const shopJournalEntries = mysqlTable("shop_journal_entries", {
  id: int("id").autoincrement().primaryKey(),
  entryDate: varchar("entryDate", { length: 10 }).notNull(),
  side: mysqlEnum("side", ["debit", "credit"]).notNull(),
  accountCode: varchar("accountCode", { length: 20 }).notNull(),
  details: varchar("details", { length: 255 }).notNull(),
  kyat: int("kyat").default(0).notNull(),
  pae: int("pae").default(0).notNull(),
  yway: double("yway").default(0).notNull(),
  rate: bigint("rate", { mode: "number" }).default(0).notNull(),
  price: bigint("price", { mode: "number" }).default(0).notNull(),
  amount: bigint("amount", { mode: "number" }).notNull(),
  sourceType: varchar("sourceType", { length: 32 }),
  sourceId: int("sourceId"),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const shopDailyClosings = mysqlTable(
  "shop_daily_closings",
  {
    id: int("id").autoincrement().primaryKey(),
    closingDate: varchar("closingDate", { length: 10 }).notNull(),
    openingCash: bigint("openingCash", { mode: "number" }).default(0).notNull(),
    openingGoldKyat: int("openingGoldKyat").default(0).notNull(),
    openingGoldPae: int("openingGoldPae").default(0).notNull(),
    openingGoldYway: double("openingGoldYway").default(0).notNull(),
    openingGoldValue: bigint("openingGoldValue", { mode: "number" })
      .default(0)
      .notNull(),
    closingGoldKyat: int("closingGoldKyat").default(0).notNull(),
    closingGoldPae: int("closingGoldPae").default(0).notNull(),
    closingGoldYway: double("closingGoldYway").default(0).notNull(),
    closingGoldRate: bigint("closingGoldRate", { mode: "number" })
      .default(0)
      .notNull(),
    countedCash: bigint("countedCash", { mode: "number" }),
    note: varchar("note", { length: 500 }),
    createdBy: int("createdBy").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    closingDateUnique: uniqueIndex("shop_daily_closings_date_unique").on(
      table.closingDate
    ),
  })
);

export const hlawOoEntries = mysqlTable("hlaw_oo_entries", {
  id: int("id").autoincrement().primaryKey(),
  serviceDate: varchar("serviceDate", { length: 10 }).notNull(),
  customerName: varchar("customerName", { length: 255 }).notNull(),
  hlawKyat: int("hlawKyat").default(0).notNull(),
  hlawPae: int("hlawPae").default(0).notNull(),
  hlawYway: double("hlawYway").default(0).notNull(),
  tinKyat: int("tinKyat").default(0).notNull(),
  tinPae: int("tinPae").default(0).notNull(),
  tinHtwe: double("tinHtwe").default(0).notNull(),
  serviceFee: bigint("serviceFee", { mode: "number" }).default(0).notNull(),
  note: varchar("note", { length: 500 }),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const staffLeaveEntries = mysqlTable("staff_leave_entries", {
  id: int("id").autoincrement().primaryKey(),
  leaveDate: varchar("leaveDate", { length: 10 }).notNull(),
  employeeName: varchar("employeeName", { length: 255 }).notNull(),
  leaveType: mysqlEnum("leaveType", ["leave", "absent", "late", "other"])
    .default("leave")
    .notNull(),
  dayUnits: double("dayUnits").default(1).notNull(),
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
export type ShopJournalEntry = typeof shopJournalEntries.$inferSelect;
export type InsertShopJournalEntry = typeof shopJournalEntries.$inferInsert;
export type ShopDailyClosing = typeof shopDailyClosings.$inferSelect;
export type InsertShopDailyClosing = typeof shopDailyClosings.$inferInsert;
export type HlawOoEntry = typeof hlawOoEntries.$inferSelect;
export type InsertHlawOoEntry = typeof hlawOoEntries.$inferInsert;
export type StaffLeaveEntry = typeof staffLeaveEntries.$inferSelect;
export type InsertStaffLeaveEntry = typeof staffLeaveEntries.$inferInsert;

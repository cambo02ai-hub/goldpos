# Shop workflow mapped from `Sept-2026-Copy.xlsx`

The workbook contains six sheets. The implementation adds a **Shop Book** workspace (`/shop-book`) that covers the operational workflows without importing the workbook's customer, staff, or financial records into the application.

## Sheet-to-feature map

| Workbook sheet | Observed workflow                                                                                                   | Gold POS feature                                                                                                                                                                        |
| -------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Gold`         | Daily sell and buy rows, weight/rate/amount, opening stock carried into the day, daily totals and close/profit line | Existing POS sell/buy entries feed the new daily closing view. Opening/closing stock, opening value, close rate, actual counted cash, cash variance and an estimate are saved per date. |
| `Dr` / `Cr`    | Separate debit/credit event lists with date, detail, gold weight, rate, amount and account code                     | A coded journal. New paid sell/buy transactions, cash entries, debt settlements and HlawOo service fees post into this journal automatically; staff may add manual coded entries.       |
| `Bd`           | Account-code descriptions and a running opening + debit − credit balance                                            | Account-code selector uses the 1001–1009 and 2001–2013 codes found in the workbook. Daily cash/book movement is calculated from the coded journal and a saved opening balance.          |
| `HlawOo`       | Customer/date, Hlaw weight, No.2 output, Tin weight, Kyoot yield and Hlaw Kha fee                                   | HlawOo service ledger with calculated No.2 weight, calculated Kyoot, manual fee, and fee posting to debit code 1002.                                                                    |
| `Sheet1`       | Employee roster and daily leave/absence marks with a monthly total                                                  | Monthly staff leave log with leave/absent/late/other, partial-day units, notes and employee totals.                                                                                     |

## Formula and operational assumptions

- Gold weights use **1 kyat = 16 pae = 128 yway** for the main gold ledger.
- HlawOo No.2 weight is calculated as **three times Hlaw input weight**, using the worksheet's weight rounding into kyat/pae/yway.
- HlawOo Kyoot uses the workbook's **7.5-unit Htwe conversion** and its `((Tin / Hlaw) − 1) × 120` formula. The fee remains entered by the operator because the workbook does not show one universal fee schedule.
- Daily estimated gold profit follows the worksheet logic: **sales − purchases + closing inventory value − opening inventory value**. Closing inventory is valued at the entered close rate. This is a mark-to-close estimate, not a substitute for a formally costed inventory or audited profit statement.
- The cash close defaults from the prior saved close and journal activity since that close. Operators can save a counted cash amount to show a variance. The first date starts at zero and its opening cash/stock/value should be entered from the shop's actual opening balance.
- Workbook staff marks such as `1111` are not self-explanatory; the POS uses explicit leave types and numeric day fractions instead of reproducing ambiguous marks.
- Historical app transactions are backfilled into the new journal by migration. The supplied workbook itself is used as a workflow reference; its rows are not bulk imported.

## Deployment

Apply the new Drizzle migration in the deployment environment (`drizzle/0003_financial_accounting_shop_workflow.sql`) using the repository's normal database migration process (currently `pnpm db:push`). The migration creates the accounting and workflow tables, treats pre-existing trades as fully settled (as they predate payment tracking), and backfills existing POS trades, cash entries and settlements into the shop journal.

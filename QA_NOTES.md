# Visual QA notes

- Captured `/` and `/admin` at 1440x1000 from the active dev preview.
- The ledger renders in a Burmese-first layout with sidebar navigation, summary cards, quick-entry form, searchable/filterable journal, and imported transaction rows.
- The admin dashboard renders correctly for the current owner account, with account counts and role management table.
- The imported data is visible in the journal; the full-page home capture is intentionally tall because it includes all 217 imported rows.
- Database verification returned 81 sell records and 136 buy records, matching the Gold Sheet extraction.

## Final capture

The final 1280x820 viewport shows the ledger hierarchy clearly: sidebar, summary cards, entry form, and transaction journal are readable with good spacing. The owner dashboard shows the expected current-owner counts and role-management controls. Burmese text renders correctly with the selected Noto Sans Myanmar font. The remaining build output is only a non-blocking bundle-size warning from Vite.

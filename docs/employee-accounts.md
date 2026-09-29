# Employee accounts and permissions

Gold POS supports local employee accounts managed by an administrator from **Admin Dashboard** (`/admin`). Employees sign in with the username and password created there; an email address is optional.

## Permission levels

Each permission is scoped to one module. Higher levels include lower-level access.

| Level     | Access                                                                      |
| --------- | --------------------------------------------------------------------------- |
| No access | Module endpoints and pages are unavailable.                                 |
| View      | Read module reports and records.                                            |
| Write     | View and add entries, settle eligible balances, or save daily closing data. |
| Manage    | Write access plus deletion of eligible records.                             |

Modules:

- **Daily gold ledger** — review transactions and summaries; write access permits creating trades; manage access permits deleting trades.
- **Finance** — review reports, cash book, and outstanding balances; write access permits adding cash entries and settling balances; manage access permits deleting cash entries.
- **Shop book** — review daily closing, coded Dr/Cr journal, HlawOo, and leave records; write access permits adding/updating daily close and adding records; manage access permits deleting eligible records.

Admin dashboard access, employee account administration, and role changes remain administrator-only. Employees cannot grant permissions to themselves or create accounts.

## Account lifecycle

- New employees start with no module access unless the administrator explicitly grants it.
- The username is normalized to lowercase; it must be unique. Initial and replacement passwords must be at least 10 characters.
- Passwords are stored as scrypt hashes, not plain text.
- Admins can update module permissions, reset passwords, and deactivate/reactivate an employee. Deactivation blocks API access and local sign-in; employee records are retained for audit/history.
- Account changes take effect on subsequent API requests.

## Database rollout

Apply the additive Drizzle migration `drizzle/0004_employee_permissions.sql` before starting the updated application. It adds only `permissions` and `isActive` to `users`; existing user rows default to active, and existing POS/shop records are not rewritten.

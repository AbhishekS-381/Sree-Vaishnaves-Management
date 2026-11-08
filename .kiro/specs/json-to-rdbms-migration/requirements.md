# Requirements Document

## Introduction

This feature replaces the Sree Vaishnaves Management application's current JSON blob store (a single PostgreSQL table `json_store(filename, data text)` holding all collections as serialized JSON arrays) with a fully normalized relational PostgreSQL schema using Drizzle ORM. Every collection — POS/KOT/Billing, Staff, Attendance, Payroll, EOD, Expenses, Vendors, Inventory, Menu, Branches, Settings, and Audit Logs — gains its own typed SQL table with indexes and referential integrity enforced in code (not via SQL foreign keys, to preserve the existing logical-relationship pattern). All Next.js Server Actions are rewritten to use Drizzle queries while preserving the existing action contract shape, branch-scoping rules, soft-delete conventions, and behavioral invariants exactly. A final phase migrates to Aiven PostgreSQL using a single `postgres-js` driver and `DATABASE_URL` connection string (replacing the prior tri-driver architecture), then runs a one-shot data migration script to move live data.

## Glossary

- **JSON_Store**: The current `json_store(filename PK, data text)` table holding all collections as serialized JSON blobs.
- **RDBMS_Schema**: The new set of normalized Drizzle ORM table definitions in `db/schema.ts` that replace JSON_Store.
- **Action_File**: A `'use server'` file under `src/app/actions/*.ts` that contains Next.js Server Actions.
- **Server_Action**: A Next.js Server Action function following the contract: authorize → validate → scope → mutate → audit → revalidate → return `{ error }` | `{ success }`.
- **`SERIALIZABLE`**: A PostgreSQL transaction isolation level that prevents phantom reads; required for the takeaway order number counter pattern to guarantee no two concurrent transactions assign the same `T-N` number to orders on the same branch and date.
- **DB_Layer**: The `src/lib/db.ts` module; currently exports `readJSON`, `writeJSON`, `withTransaction`, and `DB_FILES`.
- **Drizzle**: The Drizzle ORM library already present in the project (`drizzle-orm`).
- **Branch_Scoping**: The rule that a manager can only read or write records whose `branchId` matches their session `branchId`; enforced by `requireBranchAccess()` in every action.
- **Soft_Delete**: Marking a record inactive via `isActive = false` and setting `deletedAt` rather than removing the row.
- **Hard_Delete**: Physical row removal from the database.
- **IST_Date**: A date string in `YYYY-MM-DD` format derived using `Asia/Kolkata` timezone (`new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })`).
- **Integer_Rupees**: All monetary amounts stored and validated as integer rupees (no decimals).
- **Aiven**: The PostgreSQL service used for all environments (local dev via `DATABASE_URL`, production via `DATABASE_URL` + `AIVEN_CA_CERT`). No per-environment driver switching exists after RDBMS cutover.
- **Migration_Script**: The one-shot TypeScript script at `scripts/migrate-from-json-store.ts` that exports the live JSON_Store, transforms it, and inserts into the RDBMS_Schema.
- **POS**: Point-of-Sale subsystem covering tables, orders, KOTs, and billing.
- **`pk`**: The `bigserial` surrogate primary key column present on every new RDBMS table. Used as the conflict target for rolling-cap DELETE operations (audit logs, price history) because integer primary key lookups are O(1) vs O(log n) for varchar.
- **KOT**: Kitchen Order Ticket — a delta record of items sent to the kitchen for a given order fire.
- **EOD**: End-of-Day entry capturing daily revenue, float, billing summary, and ops notes per branch.
- **Takeaway_Number**: A sequential identifier in `T-N` format assigned to takeaway orders, unique per branch per date.
- **`Validation_Script`**: The script at `scripts/validate-migration.ts` that compares row counts between `json_store` and the new RDBMS tables to confirm data completeness before dropping the legacy table.
- **Effective_Price**: The branch-overridden price from `branch_menu_items` if set, otherwise `basePrice` from the menu item (or variant).
- **Mutex**: The in-process per-file lock in the current DB_Layer; replaced by database-level transaction semantics in the new schema.
- **Rolling_Cap**: A maximum row count enforced by trimming the oldest entries when the cap is exceeded (used for audit logs at 3000 and menu price history at 5000).
- **Idempotent_Migration**: A migration run that can be executed multiple times without duplicating data, achieved via upsert / ON CONFLICT strategies.
- **JSONB**: PostgreSQL's binary JSON column type, used for embedding complex sub-objects (e.g., order items, bill snapshot) where normalization provides no query benefit.

---

## Requirements

### Requirement 1: Normalized RDBMS Schema Design

**User Story:** As a developer, I want every current JSON collection mapped to a proper relational table in Drizzle ORM, so that data is queryable with indexes and type-safe access instead of full-array JSON reads.

#### Acceptance Criteria

1. THE RDBMS_Schema SHALL define one Drizzle table for each of the following 27 collections: `branches`, `departments`, `roles`, `staff`, `staff_requirements`, `attendance`, `payroll`, `eod`, `expenses`, `categories`, `menu_items`, `menu_categories`, `branch_menu_items`, `branch_categories`, `menu_item_variants`, `menu_price_history`, `inventory`, `stock_adjustments`, `vendors`, `pos_tables`, `pos_orders`, `pos_kots`, `config`, `users`, `audit_logs`, `advances`, `daily_tally`.
2. THE RDBMS_Schema SHALL preserve every field present in the current TypeScript type definitions for each collection without dropping or renaming any field.
3. WHEN a collection field is a primitive scalar (string, integer, boolean, timestamp), THE RDBMS_Schema SHALL map it to the corresponding Drizzle column type (`varchar`, `integer`, `boolean`, `timestamp`).
4. WHEN a collection field is a complex nested object or an embedded array of objects that is never queried by sub-field (e.g., `PosOrder.items`, `PosOrder.bill`, `PosOrder.payment`, `PosOrder.void`, `PosKot.items`, `EODEntry.income`, `EODEntry.billing`, `EODEntry.ops`, `MenuItem.availability`, `MenuItem.dietary`, `MenuItem.allergens`), THE RDBMS_Schema SHALL store that field as a `jsonb` column.
5. THE RDBMS_Schema SHALL add a `bigserial` or `bigint` surrogate primary key on every table that currently uses a string `id` field, retaining the application-level string id in a `varchar` column with a unique constraint.
6. THE RDBMS_Schema SHALL define indexes on the most common query predicates: `branch_id` on every branch-scoped table (`staff`, `attendance`, `payroll`, `eod`, `expenses`, `inventory`, `stock_adjustments`, `vendors`, `pos_tables`, `pos_orders`, `pos_kots`, `staff_requirements`); `date` on `attendance`, `eod`, `expenses`, `stock_adjustments`, `pos_orders`; `(month, year, staff_id)` composite index on `payroll`; `staff_id` on `attendance`; `menu_item_id` on `branch_menu_items`, `menu_item_variants`, `menu_price_history`; `order_id` on `pos_kots`; `status` on `pos_orders`.
7. THE RDBMS_Schema SHALL be written in `db/schema.ts` and exported so that all Action_Files can import table definitions directly.
8. THE RDBMS_Schema SHALL include Drizzle migration files generated via `drizzle-kit generate`, stored in `netlify/database/migrations/` alongside existing migrations.
9. WHERE a collection uses soft-delete (branches, departments, roles, staff, menu_items, menu_categories, menu_item_variants, inventory, pos_tables, users, categories), THE RDBMS_Schema SHALL include `is_active boolean NOT NULL DEFAULT true` and `deleted_at timestamp` columns.
10. WHEN a collection field is typed as `string` in TypeScript, THE RDBMS_Schema SHALL set the `varchar` length to match the maximum length constraint in the corresponding Zod schema for that field; WHERE no Zod constraint exists, the default SHALL be `varchar(255)`. WHEN a collection field is typed as an ISO timestamp string (`createdAt`, `updatedAt`, `deletedAt`, `firedAt`, `paidAt`), THE RDBMS_Schema SHALL use `timestamptz` instead of `varchar`.
11. WHEN a collection field is marked optional in its TypeScript type (`field?: Type`), THE RDBMS_Schema SHALL define the corresponding column as nullable.

---

### Requirement 2: DB Layer Replacement

**User Story:** As a developer, I want the `src/lib/db.ts` module rewritten to expose Drizzle-based query helpers, so that Action_Files can migrate off `readJSON`/`writeJSON`/`withTransaction` to typed SQL operations.

#### Acceptance Criteria

1. THE DB_Layer SHALL remove `readJSON`, `writeJSON`, `withTransaction`, `DB_FILES`, `branchMenuItemsFile`, `readBranchMenuItems`, and `withBranchMenuTransaction` exports after all Action_Files have been migrated.
2. THE DB_Layer SHALL expose the Drizzle `db` client instance for direct use in Action_Files.
3. WHEN an Action_File needs to run multiple related mutations atomically, THE DB_Layer SHALL provide a `withDbTransaction<T>(callback, options?)` helper that wraps the callback in a Drizzle `db.transaction()` call and returns the callback result. THE `options` parameter SHALL accept an optional `isolationLevel` field with values `'read committed'`, `'repeatable read'`, or `'serializable'`, which SHALL be forwarded to `db.transaction()`. WHERE no `isolationLevel` is specified, the database default (`READ COMMITTED`) SHALL be used.
4. THE DB_Layer SHALL use a single `postgres` (postgres-js) driver initialized from the `DATABASE_URL` environment variable. IF `DATABASE_URL` is not set at startup, THE DB_Layer SHALL throw an error and terminate the process. There SHALL be no Netlify DB driver path, no Neon serverless driver path, and no `NETLIFY` environment flag logic in `db/index.ts` after the RDBMS migration is complete.
5. IF a database query throws, THEN THE DB_Layer SHALL re-throw the error so that the calling Action_File can catch it and return `{ error: 'Transaction failed' }`.
6. THE DB_Layer SHALL export the Drizzle table definitions re-exported from `db/schema.ts` so that Action_Files need only import from `@/lib/db`.

---

### Requirement 3: Branch and Settings Module Migration

**User Story:** As a developer, I want the Branches, Settings (departments, roles, categories, users, config), and Users action files rewritten to use Drizzle queries, so that these foundational entities are stored in SQL tables with proper indexes.

#### Acceptance Criteria

1. WHEN `addBranch`, `updateBranch`, or `deleteBranch` is called, THE Branch_Action SHALL execute Drizzle `insert`/`update` statements against the `branches` table instead of `withTransaction`.
2. WHEN `deleteBranch` is called, THE Branch_Action SHALL issue a SQL `SELECT COUNT(*)` against `staff` where `branchId = id AND isActive = true` to guard deletion, preserving the existing active-staff guard.
3. THE Settings_Action SHALL migrate `addDepartment`, `updateDepartment`, `deleteDepartment`, `addRole`, `updateRole`, `deleteRole` to use Drizzle queries against `departments` and `roles` tables.
4. WHEN `deleteRole` is called, THE Settings_Action SHALL check `staff` and `staff_requirements` tables via SQL `COUNT` queries for active usage before permitting deletion, preserving the existing guard behavior.
5. THE Categories_Action SHALL migrate expense category CRUD to use Drizzle queries against the `categories` table.
6. THE Users_Action SHALL migrate `addUser`, `updateUser`, `deleteUser` to use Drizzle queries against the `users` table, preserving the `role='admin'` undeletable/undemotable guard.
7. THE Config_Action SHALL migrate `toggleModule` and `updatePosGstRate` to use Drizzle `upsert` (ON CONFLICT on `id='global'`) against the `config` table.
8. WHEN any Settings or Branch mutation is attempted by a non-authorized session, THE Action SHALL return `{ error: 'Forbidden' }` exactly as before, with no change to the authorization check logic.

---

### Requirement 4: Staff and Attendance Module Migration

**User Story:** As a developer, I want the Staff and Attendance action files rewritten to use Drizzle queries, so that staff records and daily attendance logs are stored in indexed SQL tables.

#### Acceptance Criteria

1. THE Staff_Action SHALL migrate `addStaff`, `updateStaff`, `toggleStaffStatus`, `deleteStaff` to Drizzle queries against the `staff` table.
2. WHEN `addStaff` or `updateStaff` is called, THE Staff_Action SHALL enforce the duplicate-name+phone+branch guard using a SQL `SELECT` with `WHERE name ILIKE $1 AND phone = $2 AND branch_id = $3 AND is_active = true`.
3. THE Staff_Action SHALL preserve the `positionIndex` auto-assignment logic: WHEN a staff member is assigned a `positionId`, THE Staff_Action SHALL compute the next available integer index via a SQL `SELECT MAX(position_index)` scoped to that `positionId`.
4. THE Attendance_Action SHALL migrate `saveAttendance` to use Drizzle `insert ... ON CONFLICT (date, staff_id) DO UPDATE` (upsert) against the `attendance` table, replacing the current find-and-splice pattern.
5. WHEN `saveAttendance` is called with a date older than 7 days and the session is not `isGlobalAdmin`, THE Attendance_Action SHALL return `{ error: 'Cannot save attendance older than 7 days without Owner privileges.' }` without executing any write.
6. WHEN `saveAttendance` is called with a future date, THE Attendance_Action SHALL return `{ error: 'Cannot mark attendance for future dates' }` without executing any write.
7. THE Attendance_Action SHALL preserve Branch_Scoping: WHEN the session is not `isGlobalAdmin`, THE Attendance_Action SHALL enforce `branchId = session.branchId` on all reads and writes.
8. THE Staff_Requirements_Action SHALL migrate position definition CRUD to Drizzle queries against `staff_requirements`, preserving hard-delete behavior.

---

### Requirement 5: Payroll Module Migration

**User Story:** As a developer, I want the Payroll action file rewritten to use Drizzle queries, so that monthly salary records are stored in an indexed SQL table.

#### Acceptance Criteria

1. THE Payroll_Action SHALL migrate `savePayroll` to use Drizzle `insert ... ON CONFLICT (id) DO UPDATE` against the `payroll` table, preserving the `pay_{month}_{year}_{staffId}` idempotent ID pattern.
2. WHEN `savePayroll` is called, THE Payroll_Action SHALL first `SELECT` from the `staff` table (filtered by `branchId` for non-global-admin sessions) to resolve staff names and base salaries, replacing the current `readJSON(STAFF)` call.
3. THE Payroll_Action SHALL migrate `markAsPaid` to a Drizzle `UPDATE ... SET status = 'PAID', paid_at = NOW() WHERE id = $1`.
4. WHEN `markAsPaid` is called by a session that is not `isGlobalAdmin`, THE Payroll_Action SHALL return `{ error: 'Forbidden: Only admin and owner can mark payroll as paid' }`.

---

### Requirement 6: EOD and Expenses Module Migration

**User Story:** As a developer, I want the EOD and Expenses action files rewritten to use Drizzle queries, so that end-of-day entries and expense records are stored in properly indexed SQL tables.

#### Acceptance Criteria

1. WHEN `saveEODEntry` is called for a `(branchId, date)` combination that has no existing record, THE EOD_Action SHALL insert a new row into the `eod` table with `status = 'submitted'`.
2. WHEN `saveEODEntry` is called for a `(branchId, date)` combination that already has a record, THE EOD_Action SHALL update that record's `income`, `openingFloat`, `actualClosingFloat`, `billing`, `ops`, and `notes` columns.
3. WHEN `saveEODEntry` is called and an existing record for the same `(branchId, date)` has `status = 'locked'` OR its `createdAt` is more than 24 hours before the current server time, AND the session `isGlobalAdmin` is false, THE EOD_Action SHALL return `{ error: 'EOD for this date is already locked.' }` without executing any database write.
4. THE EOD_Action SHALL execute the EOD row upsert and all EOD-sourced expense writes within a single Drizzle `db.transaction()` call, so that a failure in either rolls back both.
5. WITHIN the same transaction as criterion 4, THE EOD_Action SHALL first delete all rows from `expenses` WHERE `branch_id = branchId AND date = date AND source = 'eod'`, then insert the new expense set provided in `expensesOut`.
6. WHEN `updateExpense` is called, THE Expenses_Action SHALL update `amount`, `notes`, and `date` columns of the matching `expenses` row, and SHALL NOT permit the caller to change the `branch_id` column; IF a `branchId` change is attempted, THE Expenses_Action SHALL return `{ error: 'Cannot change the branch of an existing expense.' }`.
7. WHEN `deleteExpense` is called, THE Expenses_Action SHALL permanently delete the matching row from `expenses` (hard delete).
8. WHEN `saveEODEntry` is called and the session `isGlobalAdmin` is false AND the session role is not `manager`, THE EOD_Action SHALL return `{ error: 'Forbidden' }` without executing any database write.
9. WHEN `updateExpense` or `deleteExpense` is called and the session `isGlobalAdmin` is false, THE Expenses_Action SHALL return `{ error: 'Only admin and owner can edit ledger expenses.' }` or `{ error: 'Unauthorized' }` respectively.
10. WHEN any Drizzle query within `saveEODEntry`, `updateExpense`, or `deleteExpense` throws, THE Action SHALL roll back the transaction (if applicable) and return `{ error: 'Transaction failed' }`.

---

### Requirement 7: Vendors and Inventory Module Migration

**User Story:** As a developer, I want the Vendors and Inventory action files rewritten to use Drizzle queries, so that vendor records, inventory items, and stock adjustments are stored in SQL tables.

#### Acceptance Criteria

1. THE Vendors_Action SHALL migrate `addVendor`, `addVendorBill`, `markVendorBillAsPaid` to Drizzle queries against the `vendors` and `expenses` tables.
2. WHEN `addVendorBill` is called, THE Vendors_Action SHALL insert into `expenses` with `source = 'vendor'` and enforce Branch_Scoping via `requireBranchAccess`.
3. THE Inventory_Action SHALL migrate `addInventoryItem`, `adjustStock`, `updateInventoryItem`, `deleteInventoryItem` to Drizzle queries against the `inventory` and `stock_adjustments` tables.
4. WHEN `adjustStock` is called with `type = 'decrease'` and the current `currentQuantity` is less than `amount`, THE Inventory_Action SHALL return `{ error: 'Not enough stock to decrease' }` without executing any write.
5. WHEN `addInventoryItem` sets an initial `quantity > 0`, THE Inventory_Action SHALL insert an initial `stock_adjustments` record with `reason = 'Initial Stock'` within the same transaction.
6. THE Inventory_Action SHALL migrate the soft-delete pattern for inventory items, setting `is_active = false` and `deleted_at` on delete.

---

### Requirement 8: Menu Module Migration

**User Story:** As a developer, I want the Menu action files rewritten to use Drizzle queries, so that menu items, variants, branch overrides, and price history are stored in indexed SQL tables.

#### Acceptance Criteria

1. THE Menu_Action SHALL migrate `addMenuItem`, `updateMenuItem`, `deleteMenuItem`, `restoreMenuItem`, `reorderMenuItems` to Drizzle queries against the `menu_items` table.
2. WHEN `addMenuItem` is called, THE Menu_Action SHALL insert a `branch_menu_items` row for every active branch within the same database transaction, seeding `price = null` and `is_available = <isAvailableGlobally>`.
3. THE Menu_Action SHALL migrate variant CRUD (`addVariant`, `updateVariant`, `deleteVariant`) to Drizzle queries against `menu_item_variants`.
4. THE Menu_Action SHALL migrate branch config operations (`setBranchItemAvailability`, `updateBranchMenuItemPrice`, `bulkSetBranchAvailability`, `bulkUpdateBranchPrices`, `cloneBranchMenuConfig`) to Drizzle queries against `branch_menu_items`.
5. WHEN `recordPriceChange` is called, THE Menu_Action SHALL insert into `menu_price_history` and, WHEN the total row count exceeds 5000, THE Menu_Action SHALL delete exactly `(count - 5000)` oldest rows using `DELETE FROM menu_price_history WHERE pk IN (SELECT pk FROM menu_price_history ORDER BY changed_at ASC LIMIT (count - 5000))` where `pk` is the `bigserial` surrogate primary key. This operation SHALL run outside any transaction (same fail-safe pattern as audit log trimming).
6. THE Menu_Categories_Action SHALL migrate menu category CRUD to Drizzle queries against `menu_categories`.
7. THE Menu_Action SHALL eliminate the `branchMenuItemsFile` sharding pattern; branch overrides SHALL be queried via `SELECT ... WHERE branch_id = $1` on a single `branch_menu_items` table.
8. WHEN any menu mutation is attempted by a session that is not `isGlobalAdmin`, THE Menu_Action SHALL return `{ error: 'Forbidden: Admin or Owner access required' }`.

---

### Requirement 9: POS Module Migration

**User Story:** As a developer, I want the POS action files rewritten to use Drizzle queries against normalized tables, so that tables, orders, and KOTs are stored with proper indexes and transactional consistency.

#### Acceptance Criteria

1. THE POS_Action SHALL migrate POS table management (create, update, soft-delete) to Drizzle queries against `pos_tables`. Soft-delete SHALL set `is_active = false` and `deleted_at` to the current IST timestamp.
2. THE POS_Action SHALL migrate order creation, item addition, KOT firing, billing, payment, and void to Drizzle queries against `pos_orders` and `pos_kots`.
3. WHEN a new order is created with `orderType = 'takeaway'`, THE POS_Action SHALL, within the same database transaction as the order insert, execute `SELECT COUNT(*) FROM pos_orders WHERE branch_id = $1 AND date = $2 AND order_type = 'takeaway' AND status != 'voided'` and assign `takeawayNumber = 'T-' + (count + 1)` to prevent duplicate takeaway numbers under concurrent inserts.
4. WHEN a KOT is fired, THE POS_Action SHALL increment `kot_count` on the parent `pos_orders` row within the same transaction as the KOT insert.
5. THE POS_Action SHALL store `PosOrder.items` (array of `OrderItem`) as a `jsonb` column on `pos_orders`, preserving the embedded document model. The `items` jsonb column SHALL be initialized as an empty JSON array `[]` on order creation.
6. THE POS_Action SHALL store `PosOrder.bill` (`BillSnapshot`), `PosOrder.payment` (`PaymentSnapshot`), and `PosOrder.void` (`VoidInfo`) as `jsonb` columns on `pos_orders`. The `bill`, `payment`, and `void` jsonb columns SHALL be nullable and default to `null`; they are set only when the corresponding status transition occurs.
7. THE POS_Action SHALL store `PosKot.items` (array of `KotItem`) as a `jsonb` column on `pos_kots`.
8. IF a KOT fire is attempted with an empty `kotItems` array (no delta items), THE POS_Action SHALL return `{ error: 'No new items to send to kitchen' }` without inserting any KOT row.
9. WHEN `canVoidOrder` is checked and `status = 'paid'`, THE POS_Action SHALL permit only sessions with role `owner` or `admin`; IF the session role is neither `owner` nor `admin`, THE POS_Action SHALL return `{ error: 'Forbidden' }` with no audit log entry created and no database write executed.
10. WHEN any Drizzle query within a POS Server_Action throws, THE POS_Action SHALL roll back the enclosing transaction and return `{ error: 'Database operation failed' }` without executing partial writes.
11. THE POS_Action SHALL enforce Branch_Scoping on all POS reads and writes via `requireBranchAccess`.

---

### Requirement 10: Audit Log Migration

**User Story:** As a developer, I want audit log writes to use Drizzle queries against the `audit_logs` table, so that log entries are individually queryable rows rather than a serialized JSON array.

#### Acceptance Criteria

1. THE Audit_Action SHALL migrate `logAction` in `src/lib/audit.ts` to use a Drizzle `INSERT INTO audit_logs` statement.
2. WHEN the total row count in `audit_logs` exceeds 3000 after an insert, THE Audit_Action SHALL delete exactly `(count - 3000)` oldest rows so that the table is trimmed to exactly 3000 rows, using `DELETE FROM audit_logs WHERE pk IN (SELECT pk FROM audit_logs ORDER BY timestamp ASC LIMIT (count - 3000))` where `pk` is the `bigserial` surrogate primary key column. The `pk` column SHALL be used (not the `id` varchar column) to ensure O(1) primary key lookups per deleted row.
3. IF the `INSERT` or cleanup query throws, THEN THE Audit_Action SHALL catch the error, log it to `console.error`, and return without propagating the error to the calling Server_Action.
4. THE Audit_Action SHALL preserve the `AuditLogEntry` shape: `id`, `timestamp`, `userId`, `userName`, `action`, `entityType`, `entityId?`, `details`.

---

### Requirement 11: Aiven PostgreSQL — Single Driver Architecture

**User Story:** As a developer, I want `db/index.ts` simplified to a single postgres-js driver pointed at Aiven via `DATABASE_URL`, so that the connection logic is trivial, testable, and carries no legacy driver branches after RDBMS cutover.

#### Acceptance Criteria

1. THE DB_Layer SHALL read the `DATABASE_URL` environment variable at startup. IF `DATABASE_URL` is not set, THE DB_Layer SHALL throw an error synchronously so that the Next.js process terminates immediately before serving any requests.
2. THE DB_Layer SHALL initialize the Drizzle client using the `postgres` (postgres-js) driver with `DATABASE_URL` as the connection string.
3. THE DB_Layer SHALL configure the postgres driver with `ssl: { rejectUnauthorized: true, ca: process.env.AIVEN_CA_CERT }` when `AIVEN_CA_CERT` is set. IF `DATABASE_URL` is set but `AIVEN_CA_CERT` is not set, THE DB_Layer SHALL connect without a custom CA certificate (allowing local development against a non-Aiven PostgreSQL instance without SSL).
4. THE DB_Layer SHALL configure connection pool settings: `max: 2` (serverless-safe), `idle_timeout: 20` (seconds), `max_lifetime: 1800` (seconds), `connect_timeout: 10` (seconds).
5. THE DB_Layer SHALL NOT contain any reference to `@netlify/database`, `drizzle-orm/netlify-db`, `@neondatabase/serverless`, `drizzle-orm/neon-http`, or the `NETLIFY` environment flag after the RDBMS migration is complete.
6. THE DB_Layer SHALL NOT expose `DATABASE_URL` or `AIVEN_CA_CERT` in any log, error message, or HTTP response.
7. IF the postgres driver cannot establish a connection during synchronous module initialization, THE DB_Layer SHALL throw the error synchronously so that the Next.js process fails immediately at startup before serving any requests.

---

### Requirement 12: Data Migration Script

**User Story:** As a developer, I want a one-shot migration script that exports data from the current live database, saves a local backup, and imports it into the new Aiven RDBMS schema, so that no data is lost during the cutover.

#### Acceptance Criteria

1. WHEN the Migration_Script is invoked, THE Migration_Script SHALL read the `SOURCE_DATABASE_URL` environment variable (pointing to the current Neon/Netlify database). IF `SOURCE_DATABASE_URL` is not set, THE Migration_Script SHALL print an error to stderr and exit with code 1 before connecting to any database. IF `DATABASE_URL` is not set, THE Migration_Script SHALL print an error to stderr and exit with code 1.
2. THE Migration_Script SHALL parse each `json_store` row's `data` field as a JSON array. THE Migration_Script SHALL create the `migration-backup/` directory if it does not exist, then write each parsed array as a UTF-8 JSON file at `migration-backup/{filename}` (one file per `json_store` row), overwriting any existing backup file with the same name.
3. THE `migration-backup/` directory SHALL be listed in `.gitignore` so that no live data is committed to the repository.
4. WHEN the backup phase is complete, THE Migration_Script SHALL connect to the Aiven database using `DATABASE_URL` and insert each collection's records into the corresponding RDBMS table.
5. THE Migration_Script SHALL use `INSERT ... ON CONFLICT (id) DO UPDATE SET ...` on the application-level string `id` varchar column for every collection so that re-running the script updates existing rows rather than creating duplicates.
6. WHEN a JSON parse error occurs while reading a `json_store` row's `data` field, THE Migration_Script SHALL log the error to stderr with the collection filename and continue to the next collection. WHEN a row fails to insert into the RDBMS table (due to a constraint violation or type mismatch), THE Migration_Script SHALL log the failure to stderr with the collection name, the record `id`, and the error message, skip that record, and continue processing remaining records.
7. WHEN the Migration_Script completes, THE Migration_Script SHALL print a summary report listing: total records read per collection, records successfully inserted, records skipped due to errors.
8. THE Migration_Script SHALL read all `json_store` rows WHERE `filename LIKE 'branch_menu_items_%'` to collect the sharded per-branch files. THE Migration_Script SHALL also explicitly read the row with `filename = 'branch_menu_items.json'` (the legacy non-sharded row) if it exists. WHEN the same record `id` appears in both the legacy row and a sharded row with different field values, the sharded per-branch row SHALL take precedence. THE Migration_Script SHALL merge records from all matched rows and insert them into the unified `branch_menu_items` table using upsert, processing sharded rows after the legacy row so that sharded values overwrite legacy values on conflict.
9. THE Migration_Script SHALL be runnable via `npx ts-node scripts/migrate-from-json-store.ts` or an equivalent `npm run` script entry.
10. WHEN the Migration_Script completes, THE Migration_Script SHALL exit with code 0 IF zero records were skipped across all collections. THE Migration_Script SHALL exit with code 1 IF one or more records were skipped or any collection encountered an error, so that the script result is detectable by CI/CD tooling.

---

### Requirement 13: Server Action Contract Preservation

**User Story:** As a developer, I want every migrated Server Action to preserve its existing external contract, so that no client component or hook requires changes as a result of this migration.

#### Acceptance Criteria

1. THE Server_Action SHALL preserve the return type signature `{ error: string } | { success: true } | { success: true, warning: string } | { success: true, message: string }` for every function that currently returns those shapes.
2. THE Server_Action SHALL preserve the `(prevState: any, formData: FormData)` signature for all form-bound actions that currently use `useActionState`.
3. THE Server_Action SHALL preserve the `requireBranchAccess(targetBranchId)` call for every branch-scoped mutation, ensuring that the function still throws on branch mismatch and returns the enforced `branchId` on success.
4. THE Server_Action SHALL call `revalidatePath` with the same path arguments as the pre-migration version after every successful mutation.
5. THE Server_Action SHALL call `logAction` for every sensitive mutation that currently calls it, passing identical action name, entity type, details, and entity id arguments.
6. WHEN a Server_Action encounters a database error during a mutation, THE Server_Action SHALL return `{ error: 'Transaction failed' }` to the client without exposing internal error details.
7. THE Server_Action SHALL validate all inputs with Zod before executing any database write, exactly as in the pre-migration version.

---

### Requirement 14: Test Coverage

**User Story:** As a developer, I want every rewritten action, lib function, and hook to be covered by Vitest unit tests at the same coverage thresholds as before, so that the migration does not regress quality.

#### Acceptance Criteria

1. THE Test_Suite SHALL provide Vitest unit tests for every rewritten Server_Action, mocking the Drizzle `db` client via `vi.mock('@/lib/db')`.
2. THE Test_Suite SHALL achieve ≥90% line coverage on all backend action files and lib functions, as measured by `npm run test:coverage`.
3. THE Test_Suite SHALL cover the following edge cases for each action: (a) unauthorized session returns `{ error: 'Forbidden' }`, (b) invalid input returns `{ error: <zod message> }`, (c) not-found entity returns `{ error: 'Not found' }` or equivalent, (d) successful mutation returns `{ success: true }`.
4. THE Test_Suite SHALL cover the EOD lock invariant: a request to `saveEODEntry` for a locked or >24-hour-old entry by a non-owner session returns `{ error: 'EOD for this date is already locked.' }`.
5. THE Test_Suite SHALL cover the attendance time-lock invariant: a request to `saveAttendance` for a date >7 days ago by a non-owner session returns `{ error: 'Cannot save attendance older than 7 days without Owner privileges.' }`.
6. THE Test_Suite SHALL cover the audit log rolling cap: WHEN `logAction` is called and the row count would exceed 3000, THE Test_Suite SHALL verify that the oldest rows are deleted.
7. THE Test_Suite SHALL include Playwright integration tests for: full POS order lifecycle (create order → add items → fire KOT → bill → pay), EOD save (submit new entry, re-save locked entry as non-owner), and attendance save (mark present, attempt past-7-day as non-owner).
8. THE Test_Suite SHALL maintain the existing `test/unit/` directory structure, adding new test files alongside modified ones rather than replacing the existing test layout.
9. THE Test_Suite SHALL provide a shared Drizzle mock helper (`test/unit/drizzleMock.ts`) that exports a `buildMockDb()` function returning a chainable mock of the Drizzle `db` object. All action test files SHALL import from this shared helper rather than duplicating the mock inline, to ensure consistent mock behavior across the test suite.

---

### Requirement 15: Behavioral Invariant Preservation

**User Story:** As a developer, I want all critical behavioral invariants from the current JSON store implementation preserved exactly in the new relational schema, so that no user-facing functionality changes as a result of the migration.

#### Acceptance Criteria

1. THE System SHALL preserve the payroll idempotent ID pattern: WHEN `savePayroll` is called, records SHALL be upserted using the composite key `pay_{month}_{year}_{staffId}` so that re-saving a month replaces all records for that month.
2. THE System SHALL preserve the admin account guard: WHEN `deleteUser` or `updateUser` is called with `id` of a user whose `role = 'admin'`, THE Users_Action SHALL return `{ error: 'Cannot delete the admin account' }` or `{ error: 'Cannot demote the admin account' }` respectively.
3. THE System SHALL preserve the `config` single-row invariant: THE Config_Action SHALL always upsert on `id = 'global'` so that exactly one config row exists.
4. THE System SHALL preserve the sequential `takeawayNumber` invariant: WHEN a takeaway order is created, THE POS_Action SHALL assign `T-{n}` where `n` is the count of existing takeaway orders for the same branch and date plus one.
5. THE System SHALL preserve the `kotCount` cache invariant: WHEN a KOT is successfully inserted, THE POS_Action SHALL atomically increment `kot_count` on the parent order row in the same transaction.
6. THE System SHALL preserve the branch menu override resolution: WHEN a menu item's Effective_Price is resolved, THE System SHALL use the `branch_menu_items.price` if non-null, otherwise fall back to `menu_items.base_price` (or variant `base_price`).
7. THE System SHALL preserve IST_Date derivation: WHEN any action computes "today" for a date field or comparison, THE Action SHALL use `new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })`.
8. THE System SHALL preserve Integer_Rupees: WHEN any monetary value is read from the database or written to it, THE Action SHALL validate and store it as an integer with no decimal component.
9. WHEN `deleteDepartment` is called and any active role has that department as its only `departmentId`, THE Settings_Action SHALL return `{ error: 'Cannot delete — <role names> would become unassignable. Relink them first.' }` without deleting the department.
10. WHEN `deleteBranch` is called and active staff are assigned to that branch, THE Branch_Action SHALL return `{ error: 'Cannot delete — <n> active staff member(s) are assigned to this branch. Reassign or deactivate them first.' }` without deleting the branch.

---

### Requirement 16: Non-Action Files Migration

**User Story:** As a developer, I want all non-action source files that currently import from the JSON store helper layer updated to use Drizzle queries, so that no file in the codebase depends on `readJSON`, `writeJSON`, `withTransaction`, or `DB_FILES` after the migration is complete.

#### Acceptance Criteria

1. THE `src/proxy.ts` module SHALL replace its `readJSON(DB_FILES.CONFIG)` call with a Drizzle `SELECT` query against the `config` table to read the single global config row; IF the row is missing, THE proxy SHALL fall back to default feature flag values (`attendance: true`, `payroll: true`, `vendors: true`, `inventory: true`, `menu: true`, `reports: true`).
2. THE `src/app/management/layout.tsx` server component SHALL replace its `readJSON(DB_FILES.CONFIG)` call with a Drizzle `SELECT` query against the `config` table; IF the row is missing, THE layout SHALL fall back to the same default feature flags as criterion 1.
3. THE `src/app/actions/auth.ts` SHALL replace its `readJSON(DB_FILES.USERS)` call (used in `login`) and `readJSON`/`writeJSON` calls (used in `migratePasswordsToHash`) with Drizzle `SELECT` and `UPDATE` queries against the `users` table; no change SHALL be made to the JWT signing, cookie handling, `getSession`, or `requireBranchAccess` logic.
4. THE `src/lib/menuMigration.ts` module SHALL be deleted after the RDBMS migration is complete; its `migrateBranchMenuItemsToShards` function is permanently superseded by the unified `branch_menu_items` SQL table and direct `WHERE branch_id = $1` queries.
5. WHEN the migration is complete, THERE SHALL be zero imports of `readJSON`, `writeJSON`, `withTransaction`, `DB_FILES`, `branchMenuItemsFile`, `readBranchMenuItems`, or `withBranchMenuTransaction` anywhere in the `src/` directory.

---

### Requirement 17: Cutover Validation Script

**User Story:** As a developer, I want a validation script that compares row counts between the legacy `json_store` and the new RDBMS tables after cutover, so that data completeness can be confirmed before the `json_store` table is dropped.

#### Acceptance Criteria

1. THE Validation_Script (`scripts/validate-migration.ts`) SHALL connect to the Aiven database and, for each of the 27 collections, compare: (a) the length of the JSON array in the corresponding `json_store` row (if it still exists), and (b) the `SELECT COUNT(*)` from the new RDBMS table.
2. WHEN the counts match for all collections, THE Validation_Script SHALL print a success summary and exit with code 0.
3. WHEN one or more counts do not match, THE Validation_Script SHALL print each mismatch with collection name, expected count, and actual count, then exit with code 1.
4. THE Validation_Script SHALL be runnable via `npm run db:validate`.

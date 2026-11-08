# Implementation Plan: JSON Store to RDBMS Migration

## Overview

Replace the JSON blob store (`json_store` table + `readJSON`/`withTransaction` helpers) with 27
normalized Drizzle ORM tables. Every Server Action is rewritten to use typed Drizzle queries while
preserving the existing action contract, branch-scoping rules, soft-delete conventions, and all
behavioral invariants. `db/index.ts` is simplified to a single `postgres-js` driver using
`DATABASE_URL`, eliminating the Netlify DB and Neon serverless paths entirely after RDBMS cutover.
A one-shot migration script moves live data. Tests are updated to mock the new `db` object instead
of `readJSON`/`withTransaction`.

The implementation language is **TypeScript** (already used throughout the project).

---

## Tasks

- [x] 1. Extend `db/schema.ts` with all 27 RDBMS tables
  - [x] 1.1 Add the 14 core entity tables: `branches`, `departments`, `roles`, `staff`, `staff_requirements`, `attendance`, `payroll`, `eod`, `expenses`, `categories`, `users`, `config`, `advances`, `daily_tally`
    - Follow the exact column types from the design: `bigserial` surrogate PK, `varchar` app-level `id` with `unique`, `timestamptz` for ISO timestamps, `varchar(10)` for IST date-only strings, `integer` for money, `jsonb` for embedded arrays/objects never queried by sub-field
    - Include all indexes specified in the design (branch_id, date, composite month/year, unique constraints)
    - Keep existing `json_store` and `rate_limit` tables untouched
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.9, 1.10, 1.11_
  - [x] 1.2 Add the 13 menu/POS tables: `menu_items`, `menu_categories`, `branch_menu_items`, `branch_categories`, `menu_item_variants`, `menu_price_history`, `inventory`, `stock_adjustments`, `vendors`, `pos_tables`, `pos_orders`, `pos_kots`, `audit_logs`
    - `pos_orders.items` / `bill` / `payment` / `void` as `jsonb` with correct defaults (`'[]'::jsonb` for items, nullable for bill/payment/void)
    - Partial unique index `pos_orders_open_table_uniq` on `(table_id) WHERE status = 'open' AND table_id IS NOT NULL`
    - Partial unique index `bmi_branch_item_variant_uniq` on `(branch_id, menu_item_id, variant_id)`
    - `staff_req_branch_dept_role_uniq` partial unique index on `(branch_id, department_id, role_id) WHERE is_active = true`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.9, 1.10, 1.11_
  - [x] 1.3 Create `drizzle.config.ts` at project root and add `postgres` + `drizzle-kit` dev dependencies
    - Config: `schema: './db/schema.ts'`, `out: './netlify/database/migrations'`, `dialect: 'postgresql'`
    - Add `"db:generate": "drizzle-kit generate --name rdbms_schema"` to `package.json` scripts
    - Install `postgres` as a production dependency: `npm install postgres`
    - Install `drizzle-kit` as a dev dependency: `npm install -D drizzle-kit`
    - Run `npm run db:generate` to produce `netlify/database/migrations/..._rdbms_schema.sql`
    - After generation, open the produced SQL file and confirm: (a) all 27 new tables are present, (b) all unique indexes and partial indexes appear, (c) `json_store` and `rate_limit` tables are NOT in the new migration (they are pre-existing)
    - _Requirements: 1.7, 1.8_

- [x] 2. Rewrite `db/index.ts` — single postgres-js driver
  - [x] 2.1 Replace `db/index.ts` with a single postgres-js driver using `DATABASE_URL`
    - Remove all conditional driver logic: delete the `NETLIFY=true` path, the `@netlify/database` import, the Neon fallback path, and the `@neondatabase/serverless` import
    - Implement: `if (!DATABASE_URL) throw new Error(...)` fail-fast guard; `postgres(DATABASE_URL, { ssl: AIVEN_CA_CERT ? { rejectUnauthorized: true, ca: AIVEN_CA_CERT } : undefined, max: 2, idle_timeout: 20, max_lifetime: 1800, connect_timeout: 10 })`; `export const db = drizzle(sql, { schema })`
    - `AIVEN_CA_CERT` is optional — when absent (local dev), SSL is skipped; when set (Aiven prod), strict cert validation is enforced
    - Remove `@netlify/database`, `drizzle-orm/netlify-db`, `@neondatabase/serverless`, `drizzle-orm/neon-http` from `package.json` dependencies after confirming no other file imports them
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7_
  - [x] 2.2 Write unit test for `db/index.ts` in `test/unit/lib/db.test.ts`
    - Cover: throws when `DATABASE_URL` is missing; initializes with SSL when `AIVEN_CA_CERT` is set; initializes without SSL when `AIVEN_CA_CERT` is absent
    - Do NOT test Netlify or Neon paths — they no longer exist
    - _Requirements: 11.1, 11.3, 11.7_

- [x] 3. Rewrite `src/lib/db.ts` — expose `db` + `withDbTransaction`, remove JSON helpers
  - [x] 3.1 Replace the module body with: re-export `db` from `../../db/index`; implement `withDbTransaction<T>(callback, options?)` wrapping `db.transaction()`; re-export all 27 table objects from `../../db/schema`
    - `withDbTransaction` accepts optional `{ isolationLevel?: 'read committed' | 'repeatable read' | 'serializable' }` and passes it to `db.transaction()`
    - Remove `readJSON`, `writeJSON`, `withTransaction`, `DB_FILES`, `Mutex`, `branchMenuItemsFile`, `readBranchMenuItems`, `withBranchMenuTransaction`
    - All other modules import tables from `@/lib/db` (single import point)
    - _Requirements: 2.1, 2.2, 2.3, 2.5, 2.6_
  - [ ]* 3.2 Update `test/unit/lib/db.test.ts` to test `withDbTransaction` — success path, rollback on thrown error, isolation level forwarding
    - _Requirements: 2.3, 2.5_

- [x] 4. Rewrite `src/lib/audit.ts` to use Drizzle
  - [x] 4.1 Replace `readJSON`/`writeJSON` calls with `db.insert(auditLogs)` + rolling cap trim using `pk` bigserial column
    - Trim: `DELETE FROM audit_logs WHERE pk IN (SELECT pk FROM audit_logs ORDER BY timestamp ASC LIMIT ${count - 3000})`
    - Never wrap in `withDbTransaction` — errors must be caught and logged to `console.error` only, never propagated
    - Preserve `AuditLogEntry` shape; `id` is `randomUUID()`, `timestamp` is `new Date()` (timestamptz)
    - _Requirements: 10.1, 10.2, 10.3, 10.4_
  - [ ]* 4.2 Update `test/unit/lib/audit.test.ts` to mock the Drizzle `db` object
    - Cover: successful insert, rolling cap trim (count > 3000 triggers delete), DB error is swallowed
    - _Requirements: 10.2, 10.3, 14.6_

- [x] 5. Migrate Branches and Settings action files
  - [x] 5.1 Rewrite `src/app/actions/branches.ts` — Drizzle queries against `branches` table
    - `addBranch`: `ilike` duplicate check, then `db.insert(branches)`
    - `updateBranch`: `db.update(branches).set(...).where(eq(branches.id, id))`
    - `deleteBranch`: `SELECT COUNT(*) FROM staff WHERE branch_id=$1 AND is_active=true` guard before `db.update` soft-delete
    - _Requirements: 3.1, 3.2, 3.8, 13.1–13.7, 15.10_
  - [x] 5.2 Rewrite `src/app/actions/settings.ts` — departments and roles
    - `addDepartment`/`updateDepartment`/`deleteDepartment`: Drizzle queries against `departments`; `deleteDepartment` fetches active roles and checks `departmentIds` membership in application code (select all active roles, filter in memory)
    - `addRole`/`updateRole`/`deleteRole`: Drizzle queries against `roles`; `deleteRole` uses `SELECT COUNT(*)` on `staff` and `staff_requirements`
    - _Requirements: 3.3, 3.4, 3.8, 13.1–13.7, 15.9_
  - [x] 5.3 Rewrite `src/app/actions/categories.ts`, `src/app/actions/users.ts`, `src/app/actions/config.ts`
    - `categories.ts`: Drizzle CRUD against `categories`
    - `users.ts`: Drizzle CRUD against `users`; preserve `role='admin'` undeletable/undemotable guard in application code
    - `config.ts`: `db.insert(config).values({id:'global',...}).onConflictDoUpdate(...)` always upsert on `id='global'`
    - _Requirements: 3.5, 3.6, 3.7, 3.8, 13.1–13.7, 15.2, 15.3_
  - [x] 5.5 Update `src/app/actions/auth.ts` — replace `readJSON(DB_FILES.USERS)` with Drizzle queries against the `users` table
    - `login`: `db.select().from(users).where(and(ilike(users.name, name), eq(users.isActive, true))).limit(1)` to fetch the user for bcrypt compare
    - `migratePasswordsToHash`: `db.select().from(users)` → iterate → `db.update(users).set({ password: hash }).where(eq(users.id, u.id))` for unhashed records
    - No change to JWT signing, cookie logic, `requireBranchAccess`, or `getSession` (those do not touch the DB)
    - _Requirements: 2.1, 2.6, 13.1_
  - [ ]* 5.4 Update unit tests: `branches.test.ts`, `settings.test.ts`, `categories.test.ts`, `users.test.ts`, `config.test.ts`
    - Replace `vi.mock('@/lib/db')` with the chainable Drizzle mock pattern from the design (mockReturnThis on builder methods, mockResolvedValue on terminal methods)
    - Cover four baseline cases per action + module-specific guards (active-staff guard for deleteBranch, admin guard for deleteUser/updateUser, single-row config invariant)
    - _Requirements: 14.1, 14.2, 14.3_

- [x] 6. Migrate Staff and Attendance action files
  - [x] 6.1 Rewrite `src/app/actions/staff.ts` — Drizzle queries against `staff` table
    - Duplicate check: `SELECT ... WHERE name ILIKE $1 AND phone=$2 AND branch_id=$3 AND is_active=true LIMIT 1`
    - `positionIndex` auto-assign: `SELECT COALESCE(MAX(position_index), -1) FROM staff WHERE position_id=$1 AND is_active=true`
    - Soft-delete: `db.update(staff).set({ isActive: false, deletedAt: new Date() })`
    - _Requirements: 4.1, 4.2, 4.3, 13.1–13.7_
  - [x] 6.2 Rewrite `src/app/actions/staff_requirements.ts` — Drizzle queries against `staff_requirements` table
    - Hard-delete: `db.delete(staffRequirements).where(eq(staffRequirements.id, id))`
    - _Requirements: 4.8, 13.1–13.7_
  - [x] 6.3 Rewrite `src/app/actions/attendance.ts` — upsert pattern against `attendance` table
    - Replace find-and-splice with `db.insert(attendance).values(...).onConflictDoUpdate({ target: [attendance.date, attendance.staffId], set: { status, shiftsWorked, updatedAt } })` per log entry
    - Date validation (future date, 7-day lock) must execute before any write
    - `getAttendanceByDate`: `SELECT FROM attendance WHERE date=$1 AND branch_id=$2`
    - _Requirements: 4.4, 4.5, 4.6, 4.7, 13.1–13.7_
  - [ ]* 6.4 Update unit tests: `staff.test.ts`, `staff_requirements.test.ts`, `attendance.test.ts`
    - Mock chainable Drizzle db; cover 7-day lock, future-date guard, branch-scoping enforcement
    - _Requirements: 14.1, 14.2, 14.3, 14.5_

- [x] 7. Migrate Payroll, EOD, and Expenses action files
  - [x] 7.1 Rewrite `src/app/actions/salary.ts` — Drizzle queries against `payroll` table
    - `savePayroll`: `SELECT FROM staff WHERE is_active=true` (filtered by `branchId` for non-global-admin), then `db.insert(payroll).values(...).onConflictDoUpdate({ target: payroll.id, set: {...} })` per entry — preserves `pay_{month}_{year}_{staffId}` idempotent ID
    - `markAsPaid`: `db.update(payroll).set({ status: 'PAID', paidAt: new Date() }).where(eq(payroll.id, id))`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 13.1–13.7, 15.1_
  - [x] 7.2 Rewrite `src/app/actions/eod.ts` — atomic `withDbTransaction` wrapping EOD upsert + expenses replace
    - Single `withDbTransaction` call: (1) `INSERT INTO eod ... ON CONFLICT (branch_id, date) DO UPDATE`, (2) `DELETE FROM expenses WHERE branch_id=$1 AND date=$2 AND source='eod'`, (3) `INSERT INTO expenses` for new expense set
    - Lock check: `SELECT FROM eod WHERE branch_id=$1 AND date=$2 LIMIT 1` before transaction; check `status='locked'` OR `createdAt` > 24h + non-global-admin → return `{ error: 'EOD for this date is already locked.' }`
    - Eliminate the `warning` path — transaction guarantees atomicity so partial success is impossible
    - `getEODByDate`, `getExpensesByDate`: replace `readJSON` with `SELECT` queries
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.8, 6.10, 13.1–13.7_
  - [x] 7.3 Rewrite `src/app/actions/expenses.ts` — Drizzle queries against `expenses` table
    - `updateExpense`: `db.update(expenses).set({ amount, notes, date }).where(eq(expenses.id, id))`; return `{ error: 'Cannot change the branch of an existing expense.' }` if `branchId` differs
    - `deleteExpense`: `db.delete(expenses).where(eq(expenses.id, id))` (hard delete)
    - _Requirements: 6.6, 6.7, 6.9, 6.10, 13.1–13.7_
  - [ ]* 7.4 Update unit tests: `salary.test.ts`, `eod.test.ts`, `expenses.test.ts`
    - `eod.test.ts`: cover EOD lock invariant (locked entry by non-owner → error), atomic transaction (expense insert fails → EOD rolled back), `getEODByDate` branch-scoping
    - Use `mockResolvedValueOnce` ordering for multi-query EOD transaction tests
    - _Requirements: 14.1, 14.2, 14.3, 14.4_

- [x] 8. Checkpoint — core modules
  - Ensure all tests pass for tasks 1–7, ask the user if questions arise.

- [x] 9. Migrate Vendors, Inventory, and Menu action files
  - [x] 9.1 Rewrite `src/app/actions/vendors.ts` — Drizzle queries against `vendors` + `expenses` tables
    - `addVendor`: `db.insert(vendors).values(...)`
    - `addVendorBill`: `db.insert(expenses).values({ ..., source: 'vendor' })` with `requireBranchAccess`
    - `markVendorBillAsPaid`: `db.update(expenses).set({ isPaid: true }).where(eq(expenses.id, id))`
    - _Requirements: 7.1, 7.2, 13.1–13.7_
  - [x] 9.2 Rewrite `src/app/actions/inventory.ts` — Drizzle queries against `inventory` + `stock_adjustments`
    - `addInventoryItem`: if `quantity > 0`, wrap item insert + initial stock_adjustment insert in `withDbTransaction`
    - `adjustStock`: use outer-scope flag pattern (`notFound`, `notEnough`) — do NOT throw as control flow; wrap item update + adjustment insert in `withDbTransaction`
    - `deleteInventoryItem`: soft-delete with `is_active=false`, `deleted_at`
    - _Requirements: 7.3, 7.4, 7.5, 7.6, 13.1–13.7_
  - [x] 9.3 Rewrite `src/app/actions/menu.ts` — Drizzle queries against menu tables
    - `addMenuItem`: `withDbTransaction` wrapping `INSERT INTO menu_items` + bulk `INSERT INTO branch_menu_items` for all active branches (fetched via `SELECT FROM branches WHERE is_active=true` inside transaction)
    - `updateMenuItem`/`deleteMenuItem`/`restoreMenuItem`/`reorderMenuItems`: direct `db.update(menuItems)`
    - `setBranchItemAvailability`/`updateBranchMenuItemPrice`/`bulkSetBranchAvailability`/`bulkUpdateBranchPrices`/`cloneBranchMenuConfig`: `db.insert(branchMenuItems).values(...).onConflictDoUpdate(...)` — eliminates all sharding
    - `recordPriceChange`: `db.insert(menuPriceHistory)` then count-and-trim using `pk` (not `id`) for the DELETE predicate; run outside any transaction (same pattern as audit)
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.7, 8.8, 13.1–13.7, 15.5_
  - [x] 9.4 Rewrite `src/app/actions/menu_categories.ts` — Drizzle queries against `menu_categories`
    - _Requirements: 8.6, 13.1–13.7_
  - [ ]* 9.5 Update unit tests: `vendors.test.ts`, `inventory.test.ts`, `menu.test.ts`, `menu_categories.test.ts`
    - `inventory.test.ts`: cover not-found flag, not-enough-stock flag, initial stock adjustment transaction atomicity
    - `menu.test.ts`: cover addMenuItem transaction (menu item + all branch rows), price history rolling cap (row count > 5000 → oldest deleted using pk), branch scoping on availability/price ops
    - _Requirements: 14.1, 14.2, 14.3_
  - [x] 9.6 Delete `src/lib/menuMigration.ts` — this file is permanently superseded by the unified `branch_menu_items` SQL table
    - The `migrateBranchMenuItemsToShards` function it exports is dead code after the RDBMS migration
    - Remove any imports of this file from other modules (search for `menuMigration` across the codebase)
    - Remove corresponding test file `test/unit/lib/menuMigration.test.ts` if it exists, or update it to confirm the function no longer exists
    - _Requirements: 2.1, 8.7_

- [x] 10. Migrate POS action file (`src/app/actions/pos.ts`)
  - [x] 10.1 Rewrite POS table management — `createTable`, `renameTable`, `deactivateTable`
    - `createTable`: `db.insert(posTables).values(...)` with duplicate name check via `SELECT`
    - `deactivateTable`: `SELECT FROM pos_orders WHERE table_id=$1 AND status='open' LIMIT 1` guard, then soft-delete
    - _Requirements: 9.1, 9.11, 13.1–13.7_
  - [x] 10.2 Rewrite `createOrder` with `SERIALIZABLE` takeaway number
    - Takeaway orders: wrap in `withDbTransaction(async (tx) => { COUNT(*) from pos_orders where branch+date+type+not-voided; insert order with T-{n+1} }, { isolationLevel: 'serializable' })`
    - Dine-in orders: check `pos_orders_open_table_uniq` partial index (catches concurrent table conflicts via DB constraint); wrap in `withDbTransaction`
    - _Requirements: 9.2, 9.3, 9.10, 9.11, 13.1–13.7, 15.4_
  - [x] 10.3 Rewrite `addOrUpdateOrderItem`, `removeOrderItem`, `updateOrderNote`, `reopenOrder`, `voidOrder`
    - Each reads order via `db.select().from(posOrders).where(eq(posOrders.id, orderId)).limit(1)`, applies business checks, then `db.update(posOrders).set({ items: updatedItems, updatedAt })` 
    - `voidOrder`: paid-order void requires `isGlobalAdmin`; cross-day check still computed in application code from `payment.paidAt`
    - _Requirements: 9.2, 9.9, 9.10, 9.11, 13.1–13.7_
  - [x] 10.4 Rewrite `fireKot` — atomic KOT insert + kotCount increment
    - Single `withDbTransaction`: fetch order, fetch prior KOTs, compute delta, insert `pos_kots`, `UPDATE pos_orders SET kot_count=newKotNumber, updated_at=now WHERE id=orderId` — all in same transaction
    - Return `{ error: 'No new items to send to kitchen' }` before entering transaction if delta is empty
    - _Requirements: 9.4, 9.8, 9.10, 15.5_
  - [x] 10.5 Rewrite `generateBill`, `recordPayment`, `advanceKotStatus`, and all read actions (`getTodayPosData`, `getKitchenKots`, `getPosOrderHistory`, `getDailySummary`, `getPosDataForEOD`)
    - Read actions: replace `readJSON(DB_FILES.POS_ORDERS)` etc. with `db.select().from(...).where(...)`
    - `getTodayPosData`: fetch tables, orders, kots, menu, variants, branch overrides from their respective tables
    - _Requirements: 9.2, 9.5, 9.6, 9.7, 9.10, 9.11, 13.1–13.7_
  - [ ]* 10.6 Update POS unit tests: `posOrders.test.ts`, `posTables.test.ts`, `posBilling.test.ts`, `posAuth.test.ts`, `posEdgeCases.test.ts`, `posConcurrency.test.ts`, `posActionsComprehensive.test.ts`, `posSettings.test.tsx`, `posVariantsPricing.test.ts`, `posReadActions.test.ts`, `posEodPreFill.test.ts`
    - Replace all `withTransaction`/`readJSON` mocks with chainable Drizzle db mock
    - `posConcurrency.test.ts`: verify `withDbTransaction` is called with `{ isolationLevel: 'serializable' }` for takeaway order creation
    - Cover KOT atomicity: verify both KOT insert and kotCount update run inside the same `withDbTransaction` call
    - _Requirements: 14.1, 14.2, 14.3_

- [x] 11. Update dashboard server component
  - [x] 11.1 Rewrite `src/app/management/page.tsx` — replace all `readJSON` calls with `db.select()` queries
    - Each `readJSON(DB_FILES.X)` becomes `db.select().from(xTable).where(...)` with appropriate branch scoping for non-global sessions
    - No `withDbTransaction` needed for read-only dashboard
    - _Requirements: 13.1–13.7_
  - [x] 11.2 Update `src/proxy.ts` — replace `readJSON(DB_FILES.CONFIG)` with `db.select().from(config).where(eq(config.id, 'global')).limit(1)`
    - Import `db` and `config` table from `@/lib/db`
    - The query result is `configRow[0]` — fall back to default feature flags if the row is missing
    - No transaction needed (read-only)
    - _Requirements: 2.1, 2.6, 13.1_
  - [x] 11.3 Update `src/app/management/layout.tsx` — replace `readJSON(DB_FILES.CONFIG)` with `db.select().from(config).limit(1)`
    - Import `db` and `config` table from `@/lib/db`
    - Fall back to default feature flags (`{ attendance: true, payroll: true, vendors: true, inventory: true, menu: true, reports: true }`) when the config row is missing
    - _Requirements: 2.1, 2.6, 13.1_

- [x] 12. Checkpoint — all action files and dashboard
  - Ensure all tests pass after completing task groups 9 (Vendors/Inventory/Menu), 10 (POS), and 11 (Dashboard/Proxy/Layout), ask the user if questions arise.

- [x] 13. Rewrite `db/seed.ts` with typed table inserts
  - [x] 13.1 Replace `json_store` upserts with Drizzle typed inserts for all seed collections
    - `config`: `db.insert(config).values({id:'global',...}).onConflictDoUpdate({ target: config.id, set: {id:'global'} })` (no-op if exists)
    - `branches`, `departments`, `roles`: `db.insert(...).values(...).onConflictDoNothing()` per record
    - Admin user: read password from `ADMIN_PASSWORD` env var, bcrypt hash, `onConflictDoNothing()`
    - `advances` and `daily_tally`: no seed data needed (empty collections) — remove their entries from the old `seed-data.ts` json_store upserts; do NOT add them to the typed seed inserts (empty tables are the correct initial state)
    - _Requirements: 12.4, 12.5_

- [x] 14. Create `scripts/migrate-from-json-store.ts` — data migration script
  - [x] 14.1 Implement Phase 0 (env validation) + Phase 1 (backup)
    - Validate `SOURCE_DATABASE_URL`, `DATABASE_URL`, `AIVEN_CA_CERT` — exit code 1 if `SOURCE_DATABASE_URL` or `DATABASE_URL` is missing; `AIVEN_CA_CERT` is optional (required only for Aiven SSL, not for local dev)
    - Read all `json_store` rows from source DB; parse each `data` field; write to `migration-backup/{filename}` (create dir if not exists)
    - Log parse errors to stderr, continue to next collection
    - _Requirements: 12.1, 12.2, 12.3_
  - [x] 14.2 Implement Phase 2+3 (transform + upsert) for all 27 collections
    - Build `CollectionMigrator[]` covering all collections; `transform` handles camelCase → snake_case and ISO string → `Date` conversion for timestamptz columns
    - `branch_menu_items` sharding: query `SELECT filename FROM json_store WHERE filename LIKE 'branch_menu_items%'`; process legacy blob first, shards second so sharded rows win on conflict
    - Upsert all records via `INSERT ... ON CONFLICT (id) DO UPDATE SET ...` on the app-level `id` varchar column
    - Log per-record failures to stderr; increment skip counter; continue
    - _Requirements: 12.4, 12.5, 12.6, 12.8_
  - [x] 14.3 Implement Phase 4 (report + exit) and add npm script
    - Print summary table: collection name, records read, inserted, skipped
    - Exit code 0 if zero skipped, code 1 if any skipped
    - Add `"db:migrate": "ts-node scripts/migrate-from-json-store.ts"` to `package.json`
    - Add `migration-backup/` to `.gitignore`
    - _Requirements: 12.7, 12.9, 12.10, 12.3_

- [x] 15. Update all Vitest unit test mocks from `readJSON`/`withTransaction` to Drizzle `db` object
  - [x] 15.1 Create shared Drizzle mock helper in `test/unit/` (e.g., `drizzleMock.ts`) providing the chainable mock builder
    - Export `buildMockDb()` returning the `mockDb` object with `select`, `from`, `where`, `limit`, `insert`, `values`, `onConflictDoUpdate`, `update`, `set`, `delete`, `execute`, `transaction` methods, all `vi.fn().mockReturnThis()` except terminal resolvers
    - Export `buildMockWithDbTransaction()` returning a `vi.fn()` that invokes the callback with `mockDb`
    - _Requirements: 14.1_
  - [x] 15.2 Update remaining lib test files: `test/unit/lib/db.test.ts`, `test/unit/lib/audit.test.ts`, `test/unit/lib/menuMigration.test.ts`
    - `db.test.ts`: test `withDbTransaction` wrapper using the new mock; remove tests for deleted exports (`readJSON`, `withTransaction`, `DB_FILES`)
    - _Requirements: 14.1, 14.2, 14.8_
  - [x] 15.3 Verify coverage thresholds pass: `npm run test:coverage`
    - All backend action files and lib functions ≥ 90% line coverage
    - Fix any coverage gaps exposed by the migration (removed branches, new code paths)
    - _Requirements: 14.2_

- [ ] 16. Write Playwright integration tests for critical paths
  - [ ] 16.1 Full POS order lifecycle: create dine-in order → add items → fire KOT → generate bill → record payment
    - Verify order status transitions: open → billed → paid
    - Verify KOT row exists in `pos_kots` and `kot_count` on the order equals 1
    - _Requirements: 14.7_
  - [ ] 16.2 EOD save flow: submit new EOD entry → verify expenses written → attempt re-save as non-owner after 24h lock (expect `{ error: 'EOD for this date is already locked.' }`)
    - _Requirements: 14.7_
  - [ ] 16.3 Attendance save flow: mark present for today as manager → attempt to save for a date 10 days ago as manager (expect `{ error: 'Cannot save attendance older than 7 days without Owner privileges.' }`)
    - _Requirements: 14.7_

- [ ] 17. Aiven integration — environment setup and schema push
  - [x] 17.1 Set up required environment variables for all environments
    - Production (Netlify/Aiven): set `DATABASE_URL` to the Aiven connection string, `AIVEN_CA_CERT` to the full PEM string downloaded from the Aiven service console
    - Local dev: set `DATABASE_URL` to a local PostgreSQL connection string; `AIVEN_CA_CERT` is NOT needed
    - Add `.env.local.example` with placeholders for `DATABASE_URL`, `AIVEN_CA_CERT`, `ADMIN_PASSWORD`
    - Remove `NETLIFY_DB_URL`, `NETLIFY`, and `AIVEN_DATABASE_URL` from any `.env*` files and Netlify dashboard env var configs — they are no longer used
    - _Requirements: 11.1, 11.2, 11.3_
  - [ ] 17.2 Push schema to Aiven and validate
    - Set `DATABASE_URL` to the Aiven connection string locally, run `npm run db:generate` to produce the migration SQL, then apply it via the Aiven console query runner or `drizzle-kit push`
    - Confirm all 29 tables exist in the Aiven DB: 27 new RDBMS tables + `json_store` (kept until task 18.2) + `rate_limit`
    - _Requirements: 11.2, 1.8_

- [ ] 18. Cutover — dual-write validation and `json_store` drop migration
  - [x] 18.1 Deploy and validate with spot-check row count comparison
    - After deploying rewritten action files, compare row counts: for each collection, `SELECT data FROM json_store WHERE filename=$1` → parse length; `SELECT COUNT(*) FROM {table}` — log mismatches, exit 1 on any mismatch
    - Add this as `scripts/validate-migration.ts` runnable via `npm run db:validate`
    - _Requirements: 12.5_
  - [x] 18.2 Create `netlify/database/migrations/..._drop_json_store.sql` — run ONLY after cutover confirmed
    - Contents: `DROP TABLE IF EXISTS json_store;`
    - Add a prominent warning comment at the top: `-- Run ONLY after dual-write validation passes and 48h stable operation`
    - Remove `json_store` and its Drizzle definition from `db/schema.ts` only after this migration runs
    - _Requirements: 1.8_

- [ ] 19. Final checkpoint — full test suite and lint
  - Run `npm run test`, `npm run test:coverage`, `npm run test:integration`, and `npm run lint`; fix any remaining failures. Run `npm run test:integration` to confirm all Playwright tests pass after the Aiven connection is live. Ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster initial rollout; run `npm run test:coverage` afterward to confirm coverage thresholds still pass
- The `withDbTransaction` isolation level option is only used in two places: `createOrder` (takeaway, `serializable`) and potentially future counter patterns — all other transactions use the default `READ COMMITTED`
- The outer-scope flag pattern (set `notFound`/`notEnough` variables before the transaction, check after) is required for `adjustStock` and similar multi-condition mutations in task 9.2 (adjustStock) — do not throw inside a transaction callback as error control flow
- `audit.ts` and `recordPriceChange` in `menu.ts` intentionally run outside transactions and swallow errors — this behavior must be preserved
- All date-only fields (`attendance.date`, `eod.date`, `expenses.date`, `stock_adjustments.date`) remain `varchar(10)` (IST YYYY-MM-DD string), never `timestamptz`
- The `migration-backup/` directory must be in `.gitignore` before the migration script is ever run
- The `json_store` table and its Drizzle definition remain until `drop_json_store.sql` is explicitly applied after stable dual-write validation
- The final `db/index.ts` has zero conditional driver branching — one `DATABASE_URL`, one driver, one SSL config
- `AIVEN_CA_CERT` is the only optional env var: set it in production (Aiven), omit it for local dev against a plain PostgreSQL instance
- After task 2.1, remove `@netlify/database` and `@neondatabase/serverless` from `package.json` and run `npm install` to confirm the packages are gone

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "2.1", "3.1", "4.1"] },
    { "id": 2, "tasks": ["2.2", "3.2", "4.2", "5.1", "5.2", "5.3"] },
    { "id": 3, "tasks": ["5.4", "6.1", "6.2", "6.3"] },
    { "id": 4, "tasks": ["6.4", "7.1", "7.2", "7.3"] },
    { "id": 5, "tasks": ["7.4", "9.1", "9.2", "9.3", "9.4"] },
    { "id": 6, "tasks": ["9.5", "9.6", "10.1", "10.2", "10.3", "10.4", "10.5"] },
    { "id": 7, "tasks": ["10.6", "11.1", "11.2", "11.3", "5.5"] },
    { "id": 8, "tasks": ["13.1", "14.1", "15.1"] },
    { "id": 9, "tasks": ["14.2", "14.3", "15.2", "16.1", "16.2", "16.3"] },
    { "id": 10, "tasks": ["15.3", "17.1", "17.2"] },
    { "id": 11, "tasks": ["18.1", "18.2"] }
  ]
}
```

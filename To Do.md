# To Do

## Operational — required once per environment
- [ ] **Ensure `JWT_SECRET` is set in every environment.** Without it `signToken` throws and **login fails at runtime** (the `login` action has no catch around it). It was missing from the local `.env` and has been added for development; verify production has its own distinct secret in Netlify env vars.

## High priority — performance

### Application-Wide Performance Audit & Optimization Blueprint
> **Architecture Baseline:**
> - **Hosting Topology:** Netlify Serverless Functions (fixed US-East region on current plan) ↔ Aiven PostgreSQL Cluster.
> - **Cross-Region Physical Ping:** ~150ms–250ms per network round-trip.
> - **Connection Pool:** Capped at `max: 10`, `idle_timeout: 60s`, `prepare: false` in [`db/index.ts`](file:///d:/Repos/Restaurant-Management/db/index.ts).
> - **Completed Milestone (Option 1):** Next.js Edge Middleware (`src/proxy.ts`) database query was completely removed (commit `ae5b582`), permanently eliminating the 5s–10s Deno TCP timeout stall. All routes now pass middleware in < 1ms.

---

### Master Page Performance Matrix (Every Page in Application)

| Page / Route | Current Doc / RSC (ms) | Current Transferred | Database Queries & Execution Flow | Identified Root Cause | Projected Doc / RSC (ms) | Architectural Fix Details |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`/management/pos`**<br>(POS Dashboard) | **4,709 ms** (doc)<br>**4,801 ms** (rsc) | 59 KB (doc)<br>33 KB (rsc) | **12 sequential round-trips:**<br>`config` → `branches` → `posTables` → `posOrders` → `posKots` → `menuItems` → `menuCategories` → `branchMenuItems` → `variants` → `staleOrders` → `allTables` (duplicate!) → `allCategories` (duplicate!) | 12 sequential network round-trips × 250ms latency = ~3,000ms pure ping latency + duplicate table & category queries | **1,200 ms** (doc)<br>**1,100 ms** (rsc)<br>*(⚡ ~75% faster)* | 1. In `getTodayPosData` ([`src/app/actions/pos.ts`](file:///d:/Repos/Restaurant-Management/src/app/actions/pos.ts)), run independent queries (`tables`, `orders`, `menuItems`, `categories`, `branchMenuItems`, `variants`) in `Promise.all`.<br>2. In [`src/app/management/pos/page.tsx`](file:///d:/Repos/Restaurant-Management/src/app/management/pos/page.tsx), run `config` + `branches` in `Promise.all`.<br>3. Eliminate duplicate `allTables` & `allCategories` fetches (reuse `todayDataResult.tables` and catalog categories).<br>4. Run `staleOrders` concurrently with `getTodayPosData`. |
| **`/management/pos/order`**<br>(Waiter Order Station) | **4,505 ms** (doc)<br>**4,456 ms** (rsc) | 54 KB (doc)<br>33 KB (rsc) | **12 sequential round-trips:**<br>Mirrors POS dashboard waterfall (`config` → `branches` → 7 sequential `getTodayPosData` queries → duplicate `tables` & `categories`) | Same 12 sequential network round-trips × 250ms latency | **1,200 ms** (doc)<br>**1,100 ms** (rsc)<br>*(⚡ ~73% faster)* | Apply same parallelization in [`src/app/management/pos/order/page.tsx`](file:///d:/Repos/Restaurant-Management/src/app/management/pos/order/page.tsx) and shared `getTodayPosData` action. Collapses round-trips from 12 to 2. |
| **`/management`**<br>(Main Dashboard) | **3,545 ms** (doc)<br>**2,086 ms** (rsc) | 28 KB (doc)<br>14 KB (rsc) | **8 concurrent queries in `Promise.all`:**<br>`branches`, `staff`, `eod`, `expenses`, `inventory`, `attendance`, `payroll`, `config` | 8 simultaneous queries saturate 8 of the 10 connections in Aiven pool simultaneously; unbounded `select()` on inventory, attendance, and payroll | **1,200 ms** (doc)<br>**800 ms** (rsc)<br>*(⚡ ~60% faster)* | 1. Use lightweight column projections: `inventory` only needs `{ id, currentQuantity, threshold }`; `attendance` only needs `{ id }` with `limit(1)` to check existence; `payroll` only needs `{ id }` with `limit(1)`.<br>2. Project only `{ income }` for EOD and `{ amount }` for expenses. Reduces serialization and pool contention. |
| **`/management/pos/kitchen`**<br>(Kitchen KDS) | **2,769 ms** (doc)<br>**2,453 ms** (rsc) | 23 KB (doc)<br>5 KB (rsc) | **7 sequential round-trips:**<br>`config` → `branches` → `getKitchenKots` (`orders`, `tables`, `kots`) → `loadKitchenPage` (`orders` duplicate!, `tables` duplicate!, `servedKots`) | Redundant duplicate order & table queries across Server Action and Page component; 7 sequential round-trips | **950 ms** (doc)<br>**750 ms** (rsc)<br>*(⚡ ~65% faster)* | 1. Modify `getKitchenKots` to return pre-mapped tables and orders directly.<br>2. In [`src/app/management/pos/kitchen/page.tsx`](file:///d:/Repos/Restaurant-Management/src/app/management/pos/kitchen/page.tsx), eliminate the duplicate `posOrdersTable` and `posTablesTable` queries.<br>3. Run `config` and `branches` in `Promise.all`. |
| **`/management/reports`**<br>(Reports & Analytics) | **2,263 ms** (doc)<br>**1,899 ms** (rsc) | 27 KB (doc)<br>6 KB (rsc) | **7 concurrent full-table queries:**<br>`branches`, `eod`, `expenses`, `payroll`, `attendance`, `staff`, `categories` | **Unbounded table scan:** Dumps entire restaurant history (all historical EODs, expenses, attendance, and payroll records across all years) on initial SSR load | **900 ms** (doc)<br>**700 ms** (rsc)<br>*(⚡ ~60% faster)* | In [`src/app/management/reports/page.tsx`](file:///d:/Repos/Restaurant-Management/src/app/management/reports/page.tsx), default initial SSR load to current financial year / last 90 days. Custom historical date ranges are fetched dynamically on demand. |
| **`/management/settings`**<br>(Settings) | **2,076 ms** (doc)<br>**1,874 ms** (rsc) | **109 KB** (doc)<br>13 KB (rsc) | **6 concurrent queries:**<br>`roles`, `departments`, `categories`, `users`, `branches`, `config` | Large 109 KB HTML payload containing all settings modals; `users` query pulls hashed passwords over the wire before stripping in JS | **1,000 ms** (doc)<br>**800 ms** (rsc)<br>*(⚡ ~50% faster)* | 1. Project user columns in SQL: `select({ id, username, role, branchId, isGlobalAdmin, isActive })` excluding password column.<br>2. Dynamic import heavy modal dialogs to trim initial SSR HTML. |
| **`/management/menu`**<br>(Menu Management) | **1,951 ms** (doc)<br>**2,349 ms** (rsc) | **439 KB** (doc)<br>93 KB (rsc) | **2-stage waterfall:**<br>`Promise.all([ branches, menuItems, categories, variants, branchCategories ])` → sequential second round for `branchMenuItems` | **Massive 439 KB HTML payload;** sequential second round-trip for branch overrides; full-table item scans | **1,100 ms** (doc)<br>**1,000 ms** (rsc)<br>*(⚡ ~55% faster)* | 1. Consolidate `branchMenuItems` into initial `Promise.all` batch.<br>2. Exclude unused metadata from initial SSR listing (descriptions, image URLs fetched on modal open).<br>3. Virtualize or paginate large menu lists in `MenuClientPage`. |
| **`/management/staff`**<br>(Staff Scheduling) | **1,915 ms** (doc)<br>**1,945 ms** (rsc) | 51 KB (doc)<br>31 KB (rsc) | **6 concurrent queries:**<br>`staff`, `roles`, `departments`, `branches`, `requirements`, `categories` | Saturated connection pool; queries full staff rows including all schedule JSON blobs | **1,000 ms** (doc)<br>**800 ms** (rsc)<br>*(⚡ ~48% faster)* | In [`src/app/management/staff/page.tsx`](file:///d:/Repos/Restaurant-Management/src/app/management/staff/page.tsx), add `isActive: true` filter to roles and departments; project only required columns. |
| **`/management/pos/billing`**<br>(Billing Station) | **1,913 ms** (doc)<br>**1,579 ms** (rsc) | 24 KB (doc)<br>6 KB (rsc) | **3-stage waterfall:**<br>`config` → `branches` → `Promise.all([ orders, tables ])` | `config` and `branches` execute in sequential round-trips before loading orders | **1,100 ms** (doc)<br>**900 ms** (rsc)<br>*(⚡ ~42% faster)* | In [`src/app/management/pos/billing/page.tsx`](file:///d:/Repos/Restaurant-Management/src/app/management/pos/billing/page.tsx), combine `config` and `branches` into `Promise.all`. Reduces network rounds from 3 to 2. |
| **`/management/pos/history`**<br>(Order History & Audit) | **1,344 ms** (doc)<br>**1,165 ms** (rsc) | 22 KB (doc)<br>6 KB (rsc) | **2-stage waterfall + Client useEffect:**<br>`config` → `Promise.all([ branches, tables, users ])` → client `useEffect` fires `getPosOrderHistory` | Initial page loads empty, then fires client-side Server Action round-trip after mount | **700 ms** (doc)<br>**600 ms** (rsc)<br>*(⚡ ~48% faster)* | 1. Bundle `config` into initial `Promise.all`.<br>2. Pre-fetch today's initial order history server-side during SSR, eliminating the client `useEffect` blank-state spinner. |
| **`/management/eod`**<br>(End of Day) | **1,234 ms** (doc)<br>**1,213 ms** (rsc) | 20 KB (doc)<br>6 KB (rsc) | **2-stage waterfall:**<br>`Promise.all([ branches, categories, attendance, config ])` → sequential `posOrders` query | `attendanceTable` is scanned without date filter (pulls all history); sequential second round for today's POS orders | **700 ms** (doc)<br>**600 ms** (rsc)<br>*(⚡ ~45% faster)* | 1. Add `date = today` filter to attendance query in [`src/app/management/eod/page.tsx`](file:///d:/Repos/Restaurant-Management/src/app/management/eod/page.tsx).<br>2. Move `posOrdersTable` query into the initial `Promise.all` batch. |
| **`/management/payroll`**<br>(Staff Payroll) | **1,026 ms** (doc)<br>**824 ms** (rsc) | 21 KB (doc)<br>5 KB (rsc) | **3 concurrent queries:**<br>`staff`, `payroll`, `attendance` | Unbounded table scans on `payrollTable` and `attendanceTable` (pulls all historical logs across years) | **650 ms** (doc)<br>**550 ms** (rsc)<br>*(⚡ ~35% faster)* | Scope `payrollTable` query to current year and `attendanceTable` to current month in [`src/app/management/payroll/page.tsx`](file:///d:/Repos/Restaurant-Management/src/app/management/payroll/page.tsx). |
| **`/management/branches/[id]`**<br>(Branch Detail) | ~1,100 ms (doc)<br>~950 ms (rsc) | 25 KB (doc)<br>8 KB (rsc) | **6 concurrent queries:**<br>`branch`, `staff`, `roles`, `eod`, `expenses`, `requirements` | Queries ALL historic EODs and expenses for the branch, then filters `date.startsWith(month)` in JavaScript | **650 ms** (doc)<br>**500 ms** (rsc)<br>*(⚡ ~45% faster)* | In [`src/app/management/branches/[id]/page.tsx`](file:///d:/Repos/Restaurant-Management/src/app/management/branches/[id]/page.tsx), push date filtering into SQL using `like(eod.date, '${currentMonthStr}%')`. |
| **`/management/branches`**<br>(Branches List) | 864 ms (doc)<br>731 ms (rsc) | 24 KB (doc)<br>5 KB (rsc) | **1 query:** `branchesTable` | Single clean query (already near-optimal) | **600 ms** (doc)<br>**500 ms** (rsc) | Already fast and optimal. |
| **`/management/expenses`**<br>(Expenses) | 846 ms (doc)<br>792 ms (rsc) | 22 KB (doc)<br>6 KB (rsc) | **3 concurrent queries:**<br>`branches`, `expenses`, `categories` | Unbounded expenses table scan without default date range filter | **600 ms** (doc)<br>**500 ms** (rsc) | Scope default query to current month; ensure index on `(branch_id, date)` is utilized. |
| **`/management/attendance`**<br>(Attendance) | 823 ms (doc)<br>771 ms (rsc) | 28 KB (doc)<br>11 KB (rsc) | **4 concurrent queries:**<br>`staff`, `branches`, `roles`, `getSessionRole()` | Duplicate JWT verification via `getSessionRole()` when `getSession()` was already executed | **600 ms** (doc)<br>**500 ms** (rsc) | Use `session.role` directly in [`src/app/management/attendance/page.tsx`](file:///d:/Repos/Restaurant-Management/src/app/management/attendance/page.tsx). |
| **`/management/inventory`**<br>(Inventory) | 821 ms (doc)<br>819 ms (rsc) | 20 KB (doc)<br>5 KB (rsc) | **2 concurrent queries:**<br>`branches`, `inventory` | Clean single-round fetch | **600 ms** (doc)<br>**500 ms** (rsc) | Already fast and optimal. |
| **`/management/vendors`**<br>(Vendors) | 765 ms (doc)<br>775 ms (rsc) | 21 KB (doc)<br>6 KB (rsc) | **4 concurrent queries:**<br>`branches`, `vendors`, `expenses`, `categories` | Clean single-round fetch | **600 ms** (doc)<br>**500 ms** (rsc) | Already fast and optimal. |
| **`/`**<br>(Public Website) | 1,146 ms (doc)<br>515 ms (rsc) | 117 KB (doc)<br>60 KB (rsc) | **0 database queries** (`force-static`) | Static HTML generation | **400 ms** (doc)<br>**300 ms** (rsc) | Already fast (served directly from Netlify Edge CDN). |
| **`/management/login`**<br>(Login Form) | 550 ms (doc)<br>350 ms (rsc) | 15 KB (doc)<br>4 KB (rsc) | **0 database queries** (Client form) | Pure client form | **300 ms** (doc)<br>**250 ms** (rsc) | Optimal. |

---

### Master Server Action & API Performance Matrix

| Server Action | File Path | Current Latency | Identified Bottleneck | Projected Latency | Architectural Fix Details |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`bulkSetBranchAvailability`** | [`src/app/actions/menu.ts`](file:///d:/Repos/Restaurant-Management/src/app/actions/menu.ts#L738) | **4,000 ms – 8,000 ms**<br>(for 20 items) | **N+1 Waterfall:** Loops through each item executing sequential `select()` followed by sequential `update()` or `insert()` (40 round-trips!) | **250 ms – 350 ms**<br>*(⚡ ~95% faster)* | Replace loop with single `WHERE menu_item_id IN (...)` lookup + single batch insert/update using `ON CONFLICT (branch_id, menu_item_id) DO UPDATE`. |
| **`cloneBranchMenuConfig`** | [`src/app/actions/menu.ts`](file:///d:/Repos/Restaurant-Management/src/app/actions/menu.ts#L893) | **15,000 ms – 40,000 ms**<br>(for 100 items; risks Netlify timeout) | **Severe N+1 Waterfall:** For every item in source branch, executes sequential `SELECT` + sequential `UPDATE`/`INSERT` (200 round-trips!) | **400 ms – 600 ms**<br>*(⚡ ~98% faster)* | Fetch all existing target branch items in 1 query, compute diff in-memory, and execute 1 bulk batch insert/update statement. |
| **`saveAttendance`** | [`src/app/actions/attendance.ts`](file:///d:/Repos/Restaurant-Management/src/app/actions/attendance.ts#L80) | **3,000 ms – 6,000 ms**<br>(for 30 staff) | **Sequential Inserts:** `for (const log of logs) await tx.insert(...)` executes 30 sequential round-trips across network | **250 ms – 350 ms**<br>*(⚡ ~94% faster)* | Pass array of records into a single `tx.insert(attendance).values(logs).onConflictDoUpdate(...)` statement. |
| **`savePayroll`** | [`src/app/actions/salary.ts`](file:///d:/Repos/Restaurant-Management/src/app/actions/salary.ts#L105) | **3,000 ms – 5,000 ms**<br>(for 25 staff) | **Sequential Inserts:** `for (const entry of entries) await tx.insert(...)` executes 25 sequential round-trips across network | **250 ms – 350 ms**<br>*(⚡ ~94% faster)* | Pass array into single batch insert: `tx.insert(payroll).values(entries).onConflictDoUpdate(...)`. |
| **`saveEODEntry`** | [`src/app/actions/eod.ts`](file:///d:/Repos/Restaurant-Management/src/app/actions/eod.ts#L187) | **1,200 ms – 2,000 ms** | **Sequential Expense Inserts:** `for (const ex of expensesOut) await tx.insert(expenses)...` | **350 ms – 450 ms**<br>*(⚡ ~75% faster)* | Bulk insert expenses in 1 statement: `tx.insert(expenses).values(expensesOut.map(...))`. |
| **`getKitchenKots`** | [`src/app/actions/pos.ts`](file:///d:/Repos/Restaurant-Management/src/app/actions/pos.ts#L1377) | **1,200 ms – 1,800 ms** | **3 sequential queries:** `todayOrders` → `allTables` → `posKots` | **350 ms – 450 ms**<br>*(⚡ ~75% faster)* | Execute `todayOrders` and `allTables` in `Promise.all`; return mapped tables and orders to page component to eliminate page duplicates. |
| **`getTodayPosData`** | [`src/app/actions/pos.ts`](file:///d:/Repos/Restaurant-Management/src/app/actions/pos.ts#L52) | **2,500 ms – 3,200 ms** | **7 sequential queries:** `posTables` → `posOrders` → `posKots` → `menuItems` → `categories` → `branchMenuItems` → `variants` | **400 ms – 600 ms**<br>*(⚡ ~80% faster)* | Bundle 6 independent queries into single `Promise.all([ tables, orders, items, cats, branchItems, variants ])`; fetch KOTs in parallel once orders resolve. |
| **`getPosOrderHistory`** | [`src/app/actions/pos.ts`](file:///d:/Repos/Restaurant-Management/src/app/actions/pos.ts#L1470) | **350 ms – 500 ms** | 1 query with date bounds (`gte`, `lte`) | **250 ms – 300 ms** | Already fast; ensure composite index on `(branch_id, date)` is utilized. |

---

### Prioritized Implementation Roadmap

- [x] **Phase 1: POS Station High-Impact Latency Elimination (Pages & Action)**
  - Parallelized 7 sequential queries in `getTodayPosData` into 2 concurrent rounds.
  - Consolidated `loadPosDashboardPage` and `loadWaiterOrderPage` to eliminate duplicate `tables` and `categories` queries.
  - Deduplicated `loadKitchenPage` queries and combined `loadBillingPage` and `loadHistoryPage` into single concurrent `Promise.all` batches.
  - *Target Result:* All POS stations (`/pos`, `/order`, `/kitchen`, `/billing`) drop to **< 1.2s**.

- [x] **Phase 2: Server Action Mutation Batching (Eliminating N+1 Loops)**
  - Refactored `saveAttendance` and `savePayroll` to execute bulk batch `insert().values([...]).onConflictDoUpdate()`.
  - Refactored `bulkSetBranchAvailability` and `cloneBranchMenuConfig` to bulk-diff and batch update, eliminating up to 200 sequential queries.
  - Batched expense insertion in `saveEODEntry`.
  - *Target Result:* Form submissions and bulk updates drop from **5s–15s** down to **~300ms**.

- [x] **Phase 3: Dashboard & Menu Payload Optimization**
  - Added column projections to `Dashboard` queries in [`src/app/management/page.tsx`](file:///d:/Repos/Restaurant-Management/src/app/management/page.tsx) to relieve connection pool pressure.
  - Consolidated `branchMenuItems` into initial `Promise.all` in [`src/app/management/menu/page.tsx`](file:///d:/Repos/Restaurant-Management/src/app/management/menu/page.tsx) eliminating the second-stage waterfall.
  - *Target Result:* Main Dashboard drops from **3.5s** to **< 1.2s**; Menu drops from **2.3s** to **< 1.1s**.

- [x] **Phase 4: Query Scoping & Date Filtering**
  - Scoped `ReportsPage`, `PayrollPage`, and `EODPage` to default date windows (recent years/months, 7-day attendance) instead of full-table historical scans.
  - Scoped `staff` page queries to active roles and departments (`isActive: true`).
  - Scoped `settings` user query to required columns, excluding password hashes.
  - Pushed current-month filtering into SQL for `branches/[id]`.
  - Removed duplicate `getSessionRole()` in `attendance/page.tsx`.
  - *Target Result:* Future-proofs data reporting pages against database table growth.

---

## High priority — product
- **Publish the managed menu to the public website.** The marketing site at `/` renders a **static, hardcoded** menu section, while the real catalog lives in the database + per-branch overrides. Every price change must currently be made twice, and the public site can silently drift from reality: wire the website menu to the managed catalog (e.g. ISR/static regeneration reading the catalog at build time).

## Security / hardening (priority)
- Enforce password complexity on user creation/login (currently only non-empty is required).
- Decide on rate-limiter behavior under DB failure (it currently **fails open**).

## Feature gaps (previously deferred)
- Generate and print individual **PDF salary slips**.
- **Export**: Excel monthly dump and/or a full "data dump" action (CSV export exists in Reports, and now in Menu).
- Link **menu items to inventory** items for ingredient/cost tracking (menu now carries `costPrice`, so food-cost % works today without a recipe BOM).
- Expand the **audit log** coverage and add a read-only audit UI. (Menu is now fully audited; other modules remain partial.)
- Surface **menu price history** in the UI — price change events are audited to the `menu_price_history` PostgreSQL table but have no dedicated viewer UI yet.

## Explicitly out of scope (decided 2026-09-30)
- Combos / thali composition, add-ons / modifier groups, tax class / HSN / short codes, recipe-level inventory BOM, and scheduled (effective-dated) pricing.

## Larger initiatives
- [x] **POS & billing**: table/takeaway order capture that auto-feeds EOD income (implemented and fully validated via unit tests and E2E Playwright/browser testing according to `.kiro/specs/pos-billing-kot`).

## Testing
- Unit (Vitest) and integration (Playwright) suites exist with coverage thresholds configured and currently **passing**. Keep coverage green as features change; expand Playwright scenarios beyond the current EOD smoke tests — especially menu item edit, bulk repricing and branch cloning.

## Ideas / Backlog
- Enhanced authorization (granular role-based permissions per station/action)
- Delivery tracking & online order integrations

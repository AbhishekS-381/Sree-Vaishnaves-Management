# Design — Application Baseline

**Spec:** `app-baseline`
**Type:** Baseline / reference design (the whole system as-built).
**Companion:** `requirements.md` (same folder). Steering: `../../steering/{product,tech,structure}.md`.

> This document is the architectural foundation future feature specs build on. It describes the real design decisions in the code — not an idealized plan.

---

## 1. Overview

One Next.js 16 application serves a **static public marketing site** (`/`) and a **management portal** (`/management/*`). The portal is a server-rendered React app whose entire backend is **Next.js Server Actions** — there is no REST API. State is persisted as **JSON blobs in a single PostgreSQL table** (`json_store`), plus a `rate_limit` table. Access control is JWT + role flags + branch scoping, enforced in both the action layer and the page loaders.

---

## 2. Architecture

### 2.1 Layers

```
┌───────────────────────────────────────────────────────────┐
│ UI  — React Server Components (page.tsx loaders)           │
│      + Client Components (XxxClientPage.tsx, modals)       │
│      calls Server Actions directly (no fetch/REST)         │
├───────────────────────────────────────────────────────────┤
│ Server Actions — src/app/actions/*.ts ('use server')      │
│   authorize (session flags) → validate (Zod)              │
│   → scope (requireBranchAccess) → mutate (withTransaction)│
│   → audit (logAction) → revalidatePath → { success|error }│
├───────────────────────────────────────────────────────────┤
│ Persistence — src/lib/db.ts over Drizzle/Postgres         │
│   json_store (1 row per collection)  +  rate_limit table  │
└───────────────────────────────────────────────────────────┘
```

### 2.2 Request/protection flow

- `src/proxy.ts` verifies the `session` cookie for `/management/*` (redirects logged-out → login, logged-in → dashboard on the login route). `/` and static assets pass through.
- Each protected `page.tsx` runs `getSession()`, fetches collections via `readJSON`, filters by `session.branchId` for non-global users, and may redirect (Settings → non-admins; EOD → readonly).
- Each Server Action independently re-checks authorization and re-scopes — the UI is never trusted.

### 2.3 Persistence model

- `readJSON<T>(file)` → parse the row's `data`; `writeJSON<T>(file, data)` → upsert; `withTransaction<T>(file, cb)` → read-modify-write under a **per-file in-process mutex**.
- Relationships are logical (id matching). IDs are prefixed UUIDs (`st_`, `br_`, `role_`, `req_`, `ven_`, `inv_`, `exp_`, `venexp_`, `mn_`, `mcat_`, `bmi_`, `bcat_`, `adj_`, `u_`) except deterministic ones (payroll `pay_{m}_{y}_{staffId}`, config `global`).
- **Trade-off:** whole-array writes + per-instance mutex ⇒ multi-instance concurrency is last-write-wins. Acceptable at this scale; revisit for write-heavy additions (see §7).

### 2.4 Driver selection

`db/index.ts`: `NETLIFY !== 'true' && DATABASE_URL` → Neon HTTP driver (dev); else native Netlify DB driver (prod).

---

## 3. Security design

- **Login:** dual sliding-window rate limit (IP 10/min, username 20/hr, 5-min block, fails open) → bcrypt compare → 2-hour HS256 JWT (jose) → HttpOnly/SameSite=strict cookie.
- **Authorization flags** (in JWT): `isRootAdmin` (admin), `isGlobalAdmin` (admin|owner), `isGlobalOwner` (owner). Managers carry `branchId`.
- **Scoping:** `requireBranchAccess(target)` returns the enforced branch or throws `Forbidden`; loaders re-filter.
- **Headers:** `next.config.ts` sets HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy, `Cache-Control: no-store`, and a strict CSP.
- **Audit:** `logAction()` → capped `audit_logs.json`; partial coverage; never throws.
- **Known gaps (tracked):** no password-complexity; rate limiter fails open; migrations contain committed plaintext credentials to rotate.

---

## 4. Data model

Collections in `json_store` (see `Documentations/Technical/DOC-03` for exhaustive field lists; summarized here).

### 4.1 Core entities
- **Branch** `{ id, name, address, phone, status: operational|closed|maintenance, internal/customer start/end times, isActive?, deletedAt? }`
- **User** `{ id, name (login), password (bcrypt), role, branchId?, isActive?, deletedAt? }` — no email.
- **Department** `{ id, name, isActive?, deletedAt? }`
- **Role** `{ id, name, isChef?, departmentIds[], isActive?, deletedAt? }`
- **Staff** `{ id, name, branchId, departmentId, roleId, phone, label?, monthlySalary?, isActive, joinedAt, exitDate?, shiftType?, specialtyId?, positionId?, positionIndex?, startTime?, endTime?, deletedAt? }`

### 4.2 Positions & scheduling
- **StaffRequirement** `{ id, branchId, departmentId, roleId, specialtyId?, requiredCount, defaultSalary?, startTime?, endTime?, responsibility?, schedules?: PositionSchedule[] }`
- **PositionSchedule** `{ positionIndex, shifts: Shift[] }`; **Shift** `{ id, start "HH:MM", end "HH:MM" }`

### 4.3 Operations
- **AttendanceLog** `{ id, date, staffId, branchId, status: present|absent|half-day|holiday|unmarked, shiftsWorked?, updatedAt }`
- **SalaryRecord** `{ id: pay_{m}_{y}_{staffId}, staffId, branchId?, name, month, year, monthlySalary, daysWorked, advances, payableAmount, status: PENDING|PAID, notes?, paidAt? }`
- **EODEntry** `{ id, branchId, date, income{dineInCash,dineInUpi,takeawayCash,takeawayUpi}, openingFloat?, actualClosingFloat?, notes, status: draft|submitted|locked, createdAt, updatedAt, billing?{...9 fields}, ops?{staffOnDuty,powerCutHours,unusualEvent,kitchenIssue,zeroRevenueConfirmed} }`
- **Expense** `{ id, branchId, amount, categoryId, source: eod|vendor, date, notes?, createdAt, isPaid? }`
- **ExpenseCategory** `{ id, name, color? }` (global; hard-deleted)

### 4.4 Catalog & supply
- **MenuItem** `{ id, name, categoryId, basePrice, sortOrder, isActive, createdAt, updatedAt }` (global)
- **MenuCategory** `{ id, name, sortOrder?, isActive? }` (global; also chef specialties)
- **BranchMenuItem** `{ id, branchId, menuItemId, price: number|null, isAvailable }`
- **BranchMenuCategory** `{ id, branchId, categoryId, isAvailable }`
- **InventoryItem** `{ id, branchId, name, unit, currentQuantity (int), threshold, updatedAt, isActive?, deletedAt? }`
- **StockAdjustment** `{ id, itemId, branchId, type: increase|decrease, amount (int≥1), reason, date }`
- **Vendor** `{ id, branchId, name, phone, supplyType, createdAt }`

### 4.5 System
- **Config** (single `global` row) `{ id:'global', attendance, payroll, vendors, inventory, menu, reports }` (booleans)
- **AuditLogEntry** `{ id, timestamp, userId, userName, action, entityType, entityId?, details }` (capped 3000)
- Unused-but-seeded: `advances`, `daily_tally`.
- Real tables: `json_store`, `rate_limit { key, attempts, window_start, blocked_until }`.

### 4.6 Logical relationships

```
Branch 1─* Staff *─1 Role *─* Department
Branch 1─* StaffRequirement (position);  Staff *─0..1 StaffRequirement (positionId + positionIndex)
Staff 1─* AttendanceLog (by date);  Staff 1─* SalaryRecord (by month/year)
Branch 1─* EODEntry (1 per date);   EODEntry ~ Expense (source=eod, same date+branch)
Vendor ~ Expense (source=vendor, name embedded in notes)
MenuItem *─1 MenuCategory;  MenuItem 1─* BranchMenuItem;  MenuCategory 1─* BranchMenuCategory
Role.isChef → Staff.specialtyId / StaffRequirement.specialtyId → MenuCategory
Branch 1─* InventoryItem 1─* StockAdjustment
```

---

## 5. Module design summary

| Module | Server component (loader) | Client | Actions | Notable logic |
|--------|---------------------------|--------|---------|---------------|
| Dashboard | `management/page.tsx` | inline | reads | today's KPIs (IST), config-gated pending actions |
| Staff & Positions | `staff/page.tsx` | `StaffClientPage` | `staff.ts`, `staff_requirements.ts` | position slot indexing, schedule validation, coverage timeline (`ScheduleTimeline`, `scheduleGenerator`, `positionsSummary`) |
| Attendance | `attendance/page.tsx` | `AttendanceClientPage` | `attendance.ts` | bulk upsert, future/7-day guards |
| Payroll | `payroll/page.tsx` | `PayrollClientPage` | `salary.ts` | attendance-prefill, `round(salary/30×days)−advances`, PENDING→PAID |
| EOD | `eod/page.tsx` | `EODClientPage` (`useEODSave`) | `eod.ts` | income+float+billing+ops, zero-rev confirm, 24h lock, expense replace |
| Expenses | `expenses/page.tsx` | `ExpensesClientPage` | `expenses.ts` | admin/owner edit/delete, hard delete |
| Vendors | `vendors/page.tsx` | `VendorsClientPage` | `vendors.ts` | bills → ledger (source=vendor), paid flag |
| Inventory | `inventory/page.tsx` | `InventoryClientPage` | `inventory.ts` | integer adjustments + log, low-stock |
| Menu | `menu/page.tsx` | `MenuClientPage` (`useMenuFilters`) | `menu.ts`, `menu_categories.ts` | global catalog + per-branch overrides |
| Reports | `reports/page.tsx` | `ReportsClientPage` | reads | browser-computed P&L, CSV export |
| Branches | `branches/page.tsx`, `branches/[id]` | `BranchesClientPage` | `branches.ts` | CRUD, delete blocked if active staff |
| Settings | `settings/page.tsx` | `SettingsClientPage` | `settings.ts`,`categories.ts`,`menu_categories.ts`,`config.ts`,`users.ts` | admin master data, module toggles, user sanitization |

---

## 6. Representative flows

### 6.1 EOD save
```
Client (useEODSave) → saveEODEntry(entryData, expensesOut)
  Zod validate income/billing/ops/date
  if income==0 && !ops.zeroRevenueConfirmed → { error: ZERO_REVENUE_UNCONFIRMED }
  requireBranchAccess(entryData.branchId)
  if date > todayIST → { error }
  withTransaction(EOD): upsert (date,branchId); if existing locked/>24h && !isGlobalAdmin → block
  withTransaction(EXPENSES): remove this day's source=eod rows, insert new eod expenses
  logAction(SAVE_EOD); revalidate /eod,/expenses,/ → { success | warning }
```

### 6.2 Payroll save
```
Client → savePayroll(formData: staff_{id}_days/_advances/_notes, month, year)
  validate month/year; load staff (branch-scoped for managers)
  per staff: payable = max(0, round(monthlySalary/30 × days) − advances)
  withTransaction(PAYROLL): drop rows for month/year, insert new (status PENDING)
  revalidate /payroll → { success }
markAsPaid(id): isGlobalAdmin → status PAID + paidAt
```

### 6.3 Branch scoping (every branch-bound action)
```
requireBranchAccess(target):
  no session → throw Unauthorized
  !isGlobalAdmin && target !== session.branchId → throw Forbidden
  return isGlobalAdmin ? (target || session.branchId || '') : session.branchId
```

---

## 7. Key decisions & rationale

| # | Decision | Rationale | Trade-off / follow-up |
|---|----------|-----------|-----------------------|
| D1 | Server Actions, no REST | Colocate auth+validation+persistence per op; less boilerplate; no client fetch layer | No external API surface; every action must self-authorize |
| D2 | JSON-blob store in one table | Simple, migration-light, fits small dataset | Whole-array writes; per-instance mutex only ⇒ last-write-wins across instances (revisit for high-write features) |
| D3 | Branch scoping in action + loader | Defense in depth; UI never trusted | Two places to keep in sync |
| D4 | Soft delete for core entities | Preserve history, recoverable | Inconsistent: expenses/categories/requirements hard-delete — match the collection's existing pattern |
| D5 | Module toggles via `config.json` | Let the business grow into complexity | Toggles hide UI + alerts, not data — data still exists |
| D6 | Menu = global catalog + per-branch overrides | One catalog, per-branch price/availability | Effective price/availability computed at read time |
| D7 | Payroll `/30` divisor, advances inline | Simple, matches owner's mental model | No configurable working-days, no advances ledger, no approval-lock; re-save overwrites the month |
| D8 | Reports computed client-side | No server aggregation infra needed | Larger client payload; CSV-only export |

---

## 8. What a future feature spec should reference here

- The **Server Action contract** (§2.1, tech steering) — every new action follows it.
- The **data model** (§4) — extend types in the owning action file; add to `DB_FILES`; seed a default.
- The **scoping rule** (§6.3) — any branch-bound feature must call `requireBranchAccess` and filter in its loader.
- The **decisions table** (§7) — if a feature must break a decision (e.g. needs a real relational table, or an external API), record that as a new decision in that feature's own `design.md`.

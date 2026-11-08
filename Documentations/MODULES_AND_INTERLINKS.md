# Application Modules & Architecture Interlinks

This document describes the modules implemented in the Sree Vaishnaves Management portal and how their data interlinks. It reflects the **current codebase** (Next.js Server Actions over a normalized PostgreSQL database managed by Drizzle ORM; seven roles; module toggles including POS). Technical detail per module is in `Technical/DOC-01..DOC-14`.

## 📦 Core Modules Implemented

1. **Dashboard** — read-only snapshot: KPI cards, pending-action alerts, branch status.
2. **Staff & Positions** — staff profiles, budgeted position slots, and shift schedules with a coverage timeline.
3. **Attendance** *(toggleable)* — daily present/absent/half-day/holiday marking.
4. **Payroll** *(toggleable)* — monthly payable from days-worked and advances.
5. **Day-End (EOD) Entry** — daily income (dine-in/takeaway × cash/UPI), optional float/billing/ops, daily expenses, and POS prefill.
6. **Expense Ledger** — the shared ledger aggregating EOD and vendor expenses.
7. **Menu Management** *(toggleable)* — global item/category catalog with per-branch overrides, variants, and price history.
8. **Inventory & Stock** *(toggleable)* — items, thresholds, and logged adjustments.
9. **Vendors & Bills** *(toggleable)* — supplier profiles and bills recorded into the ledger.
10. **POS / Billing / KOT** *(toggleable)* — real-time table layout, takeaway ordering, incremental KOT firing, live billing, payment splits, receipt printing, and order history.
11. **Reports & Analytics** *(toggleable)* — browser-computed P&L, salary %, and CSV export.
12. **Branches & Settings** — master data (branches, roles, departments, categories, users) and module toggles (admin-only Settings).

There is also a **public marketing website** (`/`) served by the same app; it has no dynamic data and no login.

---

## 🔗 How Modules are Interlinked

Modules share data through normalized relational tables in PostgreSQL to avoid double entry and enforce operational logic.

**1. Staff & Positions ↔ Attendance ↔ Payroll**
- Attendance is marked against active `Staff`.
- `Payroll` pre-fills each staff member's days-worked by reading that month's `Attendance` (present = 1, half-day = 0.5), then applies **payable = max(0, round(monthlySalary/30 × daysWorked) − advances)**. Days-worked and advances remain editable before saving.

**2. Day-End Entry ↔ Expense Ledger**
- Expenses entered during the day-end flow are written into the shared `expenses` table with `source: 'eod'`. On each EOD save, that day's `eod`-sourced rows are replaced atomically via `withDbTransaction`.

**3. Vendors & Bills ↔ Expense Ledger**
- Recording a vendor bill writes an `expenses` row with `source: 'vendor'`, the vendor/invoice embedded in `notes`, and a paid/unpaid flag (`isPaid`). Vendor bills therefore live in the same ledger as day-end expenses.

**4. POS / Billing ↔ Day-End Entry (EOD)**
- Settled POS orders automatically feed Day-End revenue prefill via `getPosDataForEOD`: dine-in vs takeaway splits, cash vs UPI breakdowns, GST collected, and customer covers.

**5. Menu Management ↔ POS / Billing & Staff**
- Menu items, categories, variants, and branch overrides directly feed the POS order stations (`/pos`, `/pos/order`, `/pos/billing`).
- Menu categories also double as **chef specialties**: a chef role's position/staff `specialtyId` points at a `menu_categories` entry.

**6. Everything ↔ Reports & Analytics**
- Reports compute (in the browser) **Net Profit = Total Revenue (EOD income) − Total Expenses (ledger) − Payroll payable**, plus revenue splits, salary-as-%-of-revenue, and billing-derived metrics. Export is CSV only.

**7. Everything ↔ Dashboard**
- The dashboard reads EOD (today's collection), expenses (today's spend → net), staff (active count), attendance (missing-marks alert), inventory (low-stock alert), and payroll (due alert), gated by the module toggles.

---

## 🏝️ Decoupled / Independent Modules

**1. Menu Management** — feeds POS order stations, variant pricing, and chef specialties. Does not yet perform automatic recipe-level inventory deductions.

**2. Inventory & Stock** — items and manual adjustments; quantities change only through logged adjustments. Automatic deduction from POS sales is slated for a future recipe-mapping phase.

**3. Settings / Config** — dictates master data (branches, roles, departments, categories, users) and module toggles; other modules read these but Settings does not consume live operational data.

---

## 🎛️ Module Feature Toggling

An **admin** controls which modules are active from **Settings → Module Features**, persisted in the `config` table (a single row with `id = 'global'`). When a module is toggled off, it disappears from the navigation sidebar and its dashboard alerts are suppressed.

### 🔴 Core (always available)
- **Settings/Branches** — master data and configuration (Settings itself is admin-only).
- **Staff & Positions** — required to operate the app.
- **Day-End Entry** — records revenue ("money in").
- **Expense Ledger** — records spending ("money out").
- **Dashboard** — the visual anchor.

### 🟡 Toggleable
1. **Attendance** — layers onto Staff.
2. **Payroll** — layers onto Attendance.
3. **Vendors & Bills** — layers onto the Expense Ledger.
4. **Inventory & Stock** — supply operations.
5. **Menu Management** — catalog reference (also feeds chef specialties and POS).
6. **POS / Billing / KOT** — real-time order-taking, kitchen ticket dispatch, and billing.
7. **Reports & Analytics** — layers onto EOD, ledger, and payroll output.

> The toggle flags in the `config` table are: `attendance`, `payroll`, `vendors`, `inventory`, `menu`, `reports`, `pos` (along with `posDefaultGstPercent`). (Dashboard, Staff, EOD, Expenses, Branches, and Settings are not toggleable.)

---

## Architecture note

All server logic runs as **Next.js Server Actions** (`src/app/actions/*.ts`) — there is no REST API. Persistence is a **normalized relational database (RDBMS)**: 27 PostgreSQL tables defined in `db/schema.ts` managed by Drizzle ORM, connected via a single `postgres-js` client (`db/index.ts`). Multi-step operations execute atomically with `withDbTransaction<T>`. Branch scoping is enforced in both the actions (`requireBranchAccess`) and the page loaders/proxy. See `Technical/DOC-02` and `DOC-03`.

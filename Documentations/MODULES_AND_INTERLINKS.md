# Application Modules & Architecture Interlinks

This document describes the modules implemented in the Sree Vaishnaves Management portal and how their data interlinks. It reflects the **current codebase** (Next.js Server Actions over a JSON-blob store; four roles; module toggles). Technical detail per module is in `Technical/DOC-01..DOC-14`.

## 📦 Core Modules Implemented

1. **Dashboard** — read-only snapshot: KPI cards, pending-action alerts, branch status.
2. **Staff & Positions** — staff profiles, budgeted position slots, and shift schedules with a coverage timeline.
3. **Attendance** *(toggleable)* — daily present/absent/half-day/holiday marking.
4. **Payroll** *(toggleable)* — monthly payable from days-worked and advances.
5. **Day-End (EOD) Entry** — daily income (dine-in/takeaway × cash/UPI), optional float/billing/ops, and daily expenses.
6. **Expense Ledger** — the shared ledger aggregating EOD and vendor expenses.
7. **Menu Management** *(toggleable)* — global item/category catalog with per-branch overrides.
8. **Inventory & Stock** *(toggleable)* — items, thresholds, and logged adjustments.
9. **Vendors & Bills** *(toggleable)* — supplier profiles and bills recorded into the ledger.
10. **Reports & Analytics** *(toggleable)* — browser-computed P&L, salary %, and CSV export.
11. **Branches & Settings** — master data (branches, roles, departments, categories, users) and module toggles (admin-only Settings).

There is also a **public marketing website** (`/`) served by the same app; it has no dynamic data and no login.

---

## 🔗 How Modules are Interlinked

Modules share data through the JSON-blob store to avoid double entry and enforce operational logic.

**1. Staff & Positions ↔ Attendance ↔ Payroll**
- Attendance is marked against active `Staff`.
- `Payroll` pre-fills each staff member's days-worked by reading that month's `Attendance` (present = 1, half-day = 0.5), then applies **payable = max(0, round(monthlySalary/30 × daysWorked) − advances)**. Days-worked and advances remain editable before saving.

**2. Day-End Entry ↔ Expense Ledger**
- Expenses entered during the day-end flow are written into the shared `expenses.json` with `source: 'eod'`. On each EOD save, that day's `eod`-sourced rows are replaced.

**3. Vendors & Bills ↔ Expense Ledger**
- Recording a vendor bill writes an `expenses.json` row with `source: 'vendor'`, the vendor/invoice embedded in `notes`, and a paid/unpaid flag. Vendor bills therefore live in the same ledger as day-end expenses.

**4. Menu ↔ Staff (specialties)**
- Menu categories double as **chef specialties**: a chef role's position/staff `specialtyId` points at a `menu_categories` entry.

**5. Everything ↔ Reports & Analytics**
- Reports compute (in the browser) **Net Profit = Total Revenue (EOD income) − Total Expenses (ledger) − Payroll payable**, plus revenue splits, salary-as-%-of-revenue, and billing-derived metrics. Export is CSV only.

**6. Everything ↔ Dashboard**
- The dashboard reads EOD (today's collection), expenses (today's spend → net), staff (active count), attendance (missing-marks alert), inventory (low-stock alert), and payroll (due alert), gated by the module toggles.

---

## 🏝️ Decoupled / Independent Modules

**1. Menu Management** — a catalog of items/prices/availability. It does not yet feed billing or inventory automatically (no POS in this build).

**2. Inventory & Stock** — items and manual adjustments; quantities change only through logged adjustments. No automatic deduction from sales.

**3. Settings / Config** — dictates master data (branches, roles, departments, categories, users) and module toggles; other modules read these but Settings does not consume live operational data.

---

## 🎛️ Module Feature Toggling

An **admin** controls which modules are active from **Settings → Module Features**, persisted in `config.json` (a single `global` row). When a module is toggled off, it disappears from the navigation sidebar and its dashboard alerts are suppressed.

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
5. **Menu Management** — catalog reference (also feeds chef specialties).
6. **Reports & Analytics** — layers onto EOD, ledger, and payroll output.

> The toggle flags in `config.json` are: `attendance`, `payroll`, `vendors`, `inventory`, `menu`, `reports`. (Dashboard, Staff, EOD, Expenses, Branches, and Settings are not toggleable.)

---

## Architecture note

All server logic runs as **Next.js Server Actions** (`src/app/actions/*.ts`) — there is no REST API. Persistence is a **JSON-blob store**: one `json_store` Postgres table (one row per collection) plus a `rate_limit` table. Branch scoping is enforced in both the actions (`requireBranchAccess`) and the page loaders. See `Technical/DOC-02` and `DOC-03`.

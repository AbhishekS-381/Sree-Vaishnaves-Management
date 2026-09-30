# Sree Vaishnaves Management — Module Guide
**Document type:** Product · High Level
**Audience:** Product owner, stakeholders, developers onboarding
**Version:** v2.0 | Last updated: 2026-09-30

---

## How to read this document

Every module described here is **implemented and shipped**. For each module this guide covers the problem it solves, what it does, what the operator experiences, and how it connects to the rest of the system. Technical detail lives in the matching `DOC-XX` under `Documentations/Technical/`.

Modules marked *(toggleable)* can be switched on/off globally by an admin in Settings; when off, they vanish from navigation and their dashboard alerts are silenced. Toggleable modules: attendance, payroll, vendors, inventory, menu, reports.

---

# MODULE 1 — Dashboard

**Problem:** No single place to see how each branch is doing right now.

**What it does:** The landing screen after login. Shows four KPI cards (Total Branches, Active Staff, Today's Collection, Net Balance), a "Pending Actions" panel, and a branch-status list. Managers see only their branch; admins/owners/analysts see all branches.

**Experience:** Open the app → see today's collection and net, plus nudges like "Attendance not marked for today" or "N low stock alerts." Pending actions respect the module toggles.

**Connects to:** Reads staff, EOD, expenses, attendance, inventory, payroll, and config. Writes nothing. (Technical: DOC-13.)

---

# MODULE 2 — Staff & Positions

**Problem:** Staff records lived in memory and scattered notes.

**What it does:** Maintains staff profiles (role, department, salary, branch, shift). Adds a **positions** layer: budgeted headcount "slots" per branch/department/role, which staff are mapped into. Includes a drag-to-draw **shift-schedule timeline** and an **auto-scheduler**.

**Experience:** Add a staff member in about a minute; optionally map them to an open position (which locks their branch/role to that slot). Deactivating or deleting frees the slot. A timeline view shows who is working at any hour and compares required vs. actual coverage per role.

### Shift scheduling constraints (as enforced)
- Up to **3 shift segments** per position (max 2 breaks).
- Minimum **1-hour break** between segments.
- Total worked time **≤ 10 hours** per position.
- All shifts fall within **05:00–23:00**.

**Connects to:** Staff feed attendance and payroll; positions feed the coverage timeline and summary cards. (Technical: DOC-05.)

---

# MODULE 3 — Attendance *(toggleable)*

**Problem:** A paper register, manually counted at month end.

**What it does:** Digital daily marking optimized for large teams — tap "mark all present," then set the few exceptions. Statuses are **present, absent, half-day, holiday** (and **unmarked** as the default). There is no "leave" status.

**Experience:** Under a minute for 35 staff. Managers can edit up to **7 days** back; older edits require an owner/admin. Future dates are blocked.

**Connects to:** Days worked pre-fill the payroll screen (present = 1, half-day = 0.5). (Technical: DOC-06.)

---

# MODULE 4 — Payroll *(toggleable)*

**Problem:** 35 salaries calculated by hand, with no paper trail.

**What it does:** For a chosen month/year, shows every staff member with days-worked (pre-filled from attendance, editable), advances, and notes, and computes the payable.

### The salary formula (as implemented)
> **payable = max(0, round(monthlySalary ÷ 30 × daysWorked) − advances)**

The owner reviews, saves (which stores all rows as **PENDING**), and later marks records **PAID**.

**What it does *not* do (yet):** no PDF salary slips, no separate advances ledger (advances are a number on the record), no approval step that freezes attendance, and no configurable "working days" (the divisor is a fixed 30). Re-saving a month overwrites that month's records.

**Connects to:** Reads staff + attendance; payroll totals feed Reports. (Technical: DOC-05.)

---

# MODULE 5 — Day-End (EOD) Entry *(core)*

**Problem:** No structured daily income/expense record.

**What it does:** One entry per branch per day capturing:
- **Income** — dine-in and takeaway, each split cash/UPI.
- **Cash float** (optional) — opening and actual closing float, with a live expected-vs-actual discrepancy.
- **Billing** (optional) — bill count, covers, GST, discounts, voids, etc.
- **Ops** (optional) — staff on duty (auto-fillable from attendance), power-cut hours, notes, zero-revenue confirmation.
- **Expenses** — category-tagged rows written into the shared ledger.

**Experience:** Under two minutes. Live totals for income, expenses, and net. Zero-revenue days must be explicitly confirmed. Entries lock after **24 hours** (or when marked locked); only owners/admins can edit past that. Read-only analysts cannot open this screen.

**Connects to:** Income feeds Reports and the dashboard; expenses feed the shared ledger. (Technical: DOC-07.)

---

# MODULE 6 — Expense Ledger *(core)*

**Problem:** Expenses recorded inconsistently and never categorized.

**What it does:** One shared ledger fed from two places — the day-end screen (`source: eod`) and vendor bills (`source: vendor`). Editing and deleting ledger rows is restricted to **owners/admins**; the day-end screen only inserts (and replaces its own day's rows on save).

**Experience:** Filter by branch/date, see a running total, and (as an owner/admin) correct or remove entries. Expense categories are **global** and shared across branches.

**Connects to:** Feeds Reports' expense breakdown and net profit. (Technical: DOC-08.)

---

# MODULE 7 — Menu Management *(toggleable)*

**Problem:** No single source of truth for items and prices across branches.

**What it does:** A **global** catalog of items and categories, with **per-branch overrides** for availability and price. Global admins manage the catalog; managers only flip their own branch's availability/price.

**Experience:** Add an item once (it auto-creates availability mappings for every active branch), then each branch tweaks price/availability as needed. Menu categories double as **chef specialties** in the Staff module.

**Connects to:** Reference catalog; specialties link to chef positions. (Technical: DOC-09.)

---

# MODULE 8 — Inventory & Stock *(toggleable)*

**Problem:** Stock managed by eye, with no early warning.

**What it does:** Per-branch stock items with an integer quantity and a low-stock threshold. Quantities change only through **adjustments** (increase/decrease with a reason), each logged. Items below threshold raise a dashboard alert.

**Experience:** Set a threshold per item; when stock dips to/below it, the dashboard warns. Decreases can't push a quantity below zero.

**Connects to:** Low-stock feeds dashboard alerts. No automatic deduction (no POS). (Technical: DOC-10.)

---

# MODULE 9 — Vendor & Supplier Management *(toggleable)*

**Problem:** Supplier bills untracked; payment status forgotten.

**What it does:** Supplier profiles plus **vendor bills**, which are written straight into the shared expense ledger (`source: vendor`) with the vendor/invoice embedded in the notes and a paid/unpaid flag.

**Experience:** Record a bill against a vendor; it appears in the ledger and the day's expenses. Mark bills paid inline. Correcting a bill's amount/category (beyond the paid flag) is done in the Expenses module by an owner/admin.

**Connects to:** Vendor bills are ledger expenses; feed Reports. (Technical: DOC-11.)

---

# MODULE 10 — Reports & Analytics *(toggleable)*

**Problem:** No trend data, no P&L, no cost visibility.

**What it does:** A read-only analytics screen computed in the browser from server-loaded data, for a selected branch + month/year:
- Revenue (with dine-in/takeaway and cash/UPI splits) and month-on-month change.
- Expenses by category and total.
- Payroll payable and **salary as % of revenue**.
- **Net profit = revenue − expenses − payroll payable**.
- Billing-derived metrics (GST collected, covers, average cover value, discounts, voids).
- **CSV export** of the summary.

**What it does *not* do:** no Excel or PDF export, no separate server-side consolidated report (consolidation is achieved by an admin/owner selecting across the data they can see).

**Connects to:** Consumes EOD, expenses, payroll, attendance, staff. (Technical: DOC-12.)

---

# System-wide features

## Multi-branch architecture
Most records carry a `branchId`. Managers are sandboxed to one branch in both the action layer and the page loaders; admins/owners/analysts see all branches. Adding a branch is a data operation, not a code change.

## Module toggles
Admins switch modules on/off globally (`config.json`). Off modules disappear from navigation and stop raising dashboard alerts.

## Audit trail (partial)
Sensitive mutations (staff create/delete, attendance save, day-end save, expense edit/delete) append to a capped audit log. Coverage is not universal and there is no audit-log UI.

## In-app reminders
The dashboard computes gentle nudges (attendance/EOD not done, payroll due, low stock). They inform; they never block. No external messaging.

## Data safety
Core entities use soft deletion (hidden but preserved). Some collections (expenses, categories, staff requirements) are hard-removed on delete.

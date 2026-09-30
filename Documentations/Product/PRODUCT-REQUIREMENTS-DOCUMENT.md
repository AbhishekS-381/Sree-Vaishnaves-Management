# Sree Vaishnaves Management — Product Requirements Document
**Document type:** Product Requirements Document (PRD)
**Version:** v2.0
**Date:** 2026-09-30
**Status:** Reflects the delivered product

---

# Part 1 — The Problem

## 1.1 What was happening

Hotel Sree Vaishnaves — a vegetarian restaurant business in Kannur with ~35 staff per branch and multiple branches — ran on manual processes: handwritten attendance, mental salary arithmetic, a cash-book for expenses, and business knowledge held in one person's head. That is fragile against three transitions the business faces: appointing branch managers, opening additional branches, and eventually handing over ownership.

## 1.2 The core problems

1. **No reliable daily income record** — no dine-in/takeaway or cash/UPI split; no way to compare days.
2. **Error-prone salary calculation** — 35 salaries by hand, advances forgotten, no paper trail, disputes hard to resolve.
3. **Invisible expenses** — purchases remembered or lost; no category breakdown; no cost trends.
4. **Hard to run more than one branch** — no way to oversee and compare branches.
5. **The business cannot be handed over** — no system to inherit, only habits.

## 1.3 What success looks like

The operator opens the app and sees, without asking anyone, how each branch performed, whether staff were marked, whether payroll is due, and how the month compares. When ownership transfers, the data and processes transfer with it.

---

# Part 2 — The Product

## 2.1 What this application is

**Sree Vaishnaves Management** is one Next.js application that serves:
- a **public marketing website** at `/` (static), and
- a **private management portal** at `/management/*` used by the business.

It is not a customer ordering app, delivery platform, POS, or accounting package. It is a focused management tool built for how this business actually operates. **All portal modules are implemented.**

## 2.2 Who uses it — four roles

| Role | What they can do |
|------|------------------|
| **Admin** | Root/system account. Only role that can open Settings (branches' master data, roles, departments, categories, users, module toggles). Full cross-branch access. |
| **Owner** | Full cross-branch operations: mark payroll paid, edit/delete ledger expenses, override day-end locks, delete staff, manage branches. No Settings. |
| **Manager** | One assigned branch only: staff, attendance, day-end, expenses (add), vendors, inventory, menu availability. |
| **Read-only** | View dashboards and reports across branches; cannot change anything; cannot open the day-end screen. |

Staff and customers do not log in.

## 2.3 How the app is structured

The portal is a set of modules, each solving one management problem. Admins can toggle several modules on/off globally, so the business can start minimal and expand.

| Module | Problem it solves | Toggleable? |
|--------|-------------------|-------------|
| Dashboard | No at-a-glance business view | core |
| Staff & Positions | Salary/roster records, position budgeting, schedules | core |
| Day-End (EOD) Entry | No daily income/expense record | core |
| Expense Ledger | Untracked, uncategorized spending | core |
| Attendance | Manual register | yes |
| Payroll | Manual salary calculation | yes |
| Vendors | Untracked supplier bills | yes |
| Inventory | No stock visibility/early warning | yes |
| Menu | No single source of truth for items/prices | yes |
| Reports | No trends, no P&L | yes |
| Branches / Settings | Master data & configuration | admin |

---

# Part 3 — Module Requirements (as delivered)

## Module 1 — Staff & Positions
Maintains staff profiles (branch, department, role, salary, phone, shift, join/exit dates, optional label and chef specialty). Adds a **positions** layer: budgeted headcount slots (`staff_requirements`) per branch/department/role, with per-position **shift schedules** (max 3 segments, ≥1h break, ≤10h total, within 05:00–23:00) and an auto-scheduler. Staff can be mapped to open slots (locking their branch/role to the slot). Only global admins delete staff.

## Module 2 — Attendance *(toggleable)*
One-tap "mark all present" plus per-person exceptions. Statuses: **present, absent, half-day, holiday** (default **unmarked**). Managers edit up to 7 days back; global admins beyond that; future dates blocked. One record per staff per day.

## Module 3 — Payroll *(toggleable)*
Per month/year, days-worked pre-fill from attendance (present = 1, half-day = 0.5) and are editable. Payable = **max(0, round(monthlySalary ÷ 30 × daysWorked) − advances)**. Records save as PENDING; owners/admins mark them PAID. No PDF slips, no separate advances ledger, no attendance-freezing approval, no configurable working-days divisor. Re-saving a month overwrites it.

## Module 4 — Day-End (EOD) Entry *(core)*
One entry per branch per day: income (dine-in/takeaway × cash/UPI), optional cash-float reconciliation, optional detailed billing (bill count, covers, GST, discounts, voids…), optional ops (staff on duty, power-cut hours, notes, zero-revenue confirmation). Live net computation. Locks after 24 hours (owners/admins can still edit). Zero-revenue days must be confirmed. Its expenses flow into the shared ledger and are replaced on each save.

## Module 5 — Expense Ledger *(core)*
One shared ledger with `source` = `eod` | `vendor`. Categories are global. Editing/deleting rows is owner/admin-only; the day-end screen only inserts/replaces its own day's rows.

## Module 6 — Menu Management *(toggleable)*
A **global** catalog of items and categories with **per-branch** price and availability overrides. Global admins manage the catalog; managers flip their branch's availability/price. Categories double as chef specialties.

## Module 7 — Inventory & Stock *(toggleable)*
Per-branch items with integer quantity and a low-stock threshold. Quantity changes only via logged adjustments (increase/decrease with reason); decreases can't go below zero. Items at/below threshold raise a dashboard alert. No automatic deduction.

## Module 8 — Vendor & Supplier Management *(toggleable)*
Supplier profiles plus vendor bills, written into the shared ledger (`source: vendor`) with vendor/invoice embedded in notes and a paid/unpaid flag.

## Module 9 — Reports & Analytics *(toggleable)*
Read-only, computed in the browser for a selected branch + month/year: revenue with splits and month-on-month change, expenses by category, payroll payable, salary-as-%-of-revenue, net profit, and billing-derived metrics (GST, covers, average cover value). **CSV export only** (no Excel/PDF, no separate server-side consolidated report).

## Module 10 — Dashboard *(core)*
KPI cards (branches, active staff, today's collection, net balance), computed pending-action alerts (attendance/EOD not done, payroll due, low stock — each gated by its module toggle), and a branch-status panel. Read-only.

---

# Part 4 — How the Modules Connect

```
Attendance ───────────────► Payroll (days-worked prefill)
Day-End income ───────────► Reports & Dashboard
Day-End + Vendor bills ───► Shared Expense Ledger ───► Reports
Menu (global) + overrides ─► per-branch price/availability
Inventory thresholds ─────► Dashboard low-stock alerts
Everything ───────────────► Dashboard snapshot & Reports
```
Menu categories also feed chef specialties in Staff. Module visibility follows the global config toggles.

---

# Part 5 — Non-Negotiable Principles

1. **Management-only.** No staff or customer logins to the portal.
2. **Mobile-first.** The primary user is on a phone.
3. **Branch scoping.** Managers never see or touch another branch's data; enforced in actions and loaders.
4. **The operator stays in control.** Days can be re-saved; global admins can edit locked/aged records.
5. **Preserve history where it matters.** Core entities are soft-deleted; a partial audit log records sensitive changes.
6. **Simple over clever.** Routine screens are quick to complete on a phone.

---

# Part 6 — What This App Is Not

- Not a POS / order-taking or KOT system (day-end billing is entered manually).
- Not a customer ordering, reservation, loyalty, or delivery-aggregator app.
- Not a full accounting package (CSV export serves the accountant).
- Not an HR self-service system (no staff portal, no leave workflow).
- No SMS/WhatsApp/email; no PDF/Excel export; no payment gateway.

---

# Part 7 — Known Gaps & Follow-ups

- No PDF salary slips; no Excel/"data dump" export (CSV only, from Reports).
- Payroll advances are a plain number on the record (no advances ledger); no approval-lock.
- Audit logging is partial and has no UI.
- JSON-blob writes are last-write-wins across serverless instances (single-instance mutex only).
- Migrations commit a plaintext bootstrap admin password and a hardcoded Postgres role password — rotate and remove from source before wider rollout.

---

*End of Product Requirements Document.*
*Related: HIGH-LEVEL-DESIGN.md, ../Technical/DOC-01 … DOC-14.*

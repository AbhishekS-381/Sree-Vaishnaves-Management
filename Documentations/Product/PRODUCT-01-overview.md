# Sree Vaishnaves Management — Product Overview
**Document type:** Product · High Level
**Audience:** Product owner, stakeholders, developers onboarding
**Version:** v2.0 | Last updated: 2026-09-30

---

## The problem we are solving

Hotel Sree Vaishnaves is a vegetarian restaurant business in Kannur, Kerala with 35+ staff and multiple branches, historically run on paper and memory.

Every day, the owner manually:
- Tracked who came to work in a register
- Calculated salaries by hand at month end
- Wrote expenses in a cash book
- Had no reliable way to know if a day was profitable
- Could not easily compare this month to last month
- Had no structured record of stock levels or vendor payments

This creates three risks: the **takeover risk** (business knowledge locked in one person's head), the **scale risk** (managing multiple branches manually), and the **insight risk** (no data to answer basic business questions).

This application is the digital operations layer that solves all three.

---

## What this application is

The repository ships **two surfaces** from one Next.js app:

1. **A public marketing website** (`/`) — a static single-page site (hero, about, menu, gallery, contact) for customers and search engines. It has no login and no dynamic data.
2. **A private management portal** (`/management/*`) — the operations tool this document set is about. Only staff with accounts use it.

The management portal is **not** a customer ordering app, a delivery platform, or a full accounting package. It is a structured, reliable, searchable replacement for notebooks and mental arithmetic — designed for how this specific business runs.

---

## Who uses the portal

The portal has **four account types** (roles):

### Admin (system administrator)
The technical/root account. The only role that can open **Settings** to manage branches' master data — departments, roles, expense categories, system users, and which modules are switched on. The seeded owner account "Abhishek" holds this level of trust. Full cross-branch visibility.

### Owner
Full cross-branch operational control. Marks payroll as paid, edits/deletes ledger expenses, overrides day-end locks, deletes staff, and manages branches — everything except the admin-only Settings screen.

### Manager
Runs one branch. Marks attendance, fills the day-end entry, manages that branch's staff, vendors, inventory, and menu availability. Cannot see other branches, cannot mark payroll paid, cannot edit the ledger, cannot open Settings.

### Read-only analyst
Views dashboards and reports across branches but cannot change anything (and cannot open the day-end entry screen).

The owner is on a phone most of the day; the UI is mobile-first with a collapsible sidebar. Staff and customers do **not** log in.

---

## What the portal does today (all modules shipped)

Unlike an early phased plan, the portal is **fully built**. It includes:

- **Dashboard** — today's collection, net balance, active staff, branch status, and pending-action nudges.
- **Staff & Positions** — staff profiles, budgeted "position" slots per branch/role, and a visual shift-schedule timeline with an auto-scheduler.
- **Attendance** — one-tap "mark all present" plus per-person exceptions; a 7-day edit window for managers.
- **Payroll** — days-worked (pre-filled from attendance) × salary, minus advances, marked paid by the owner.
- **Day-End (EOD) Entry** — income by dine-in/takeaway and cash/UPI, optional cash-float reconciliation, optional detailed billing/ops figures, and daily expenses.
- **Expenses** — one shared ledger fed by both day-end entries and vendor bills.
- **Vendors** — supplier profiles and bills, with paid/unpaid tracking.
- **Inventory** — stock items with quantities, thresholds, and an adjustment log.
- **Menu** — a global item/category catalog with per-branch availability and price overrides.
- **Reports** — P&L, revenue splits, salary-as-%-of-revenue, month-on-month, GST/covers, with CSV export.
- **Branches** and **Settings** — master data and module toggles.

Admins can switch modules (attendance, payroll, vendors, inventory, menu, reports) **on or off** globally, so the business can start simple and grow into complexity.

---

## Core design principles

### 1. Speed on a phone
Every routine screen is designed to be completed quickly on a phone at the end of a long day.

### 2. Data with a purpose
Attendance feeds payroll; day-end entries feed reports; expenses feed P&L. Nothing is collected without a downstream use.

### 3. The operator stays in control
The system assists judgment, it does not replace it — days can be re-saved, payroll days-worked can be overridden before saving, and global admins can edit locked/aged records.

### 4. Forgiving, not rigid
Cash float, billing, and ops details are optional. Reminders nudge; they never block.

### 5. Built to be handed over
Soft deletes, a partial audit trail, module toggles, and this documentation set exist so the business — and its history — can be transferred.

---

## Honest scope notes

Some things people often expect are **deliberately absent** in the current build:
- No POS/order-taking (the day-end billing block is entered manually).
- No PDF salary slips and no Excel export (Reports exports **CSV** only).
- No staff self-service, no customer accounts, no delivery integrations.
- No SMS/WhatsApp/email — alerts are in-app only.
- No tax-filing or accounting-software integration.

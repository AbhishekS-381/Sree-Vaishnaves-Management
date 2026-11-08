# Sree Vaishnaves Management — Product Overview
**Document type:** Product · High Level
**Audience:** Product owner, stakeholders, developers onboarding
**Version:** v3.0 | Last updated: 2026-11-02

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

The management portal is **not** a customer ordering app or a delivery platform. It is a structured, reliable, searchable replacement for notebooks, paper KOTs, and mental arithmetic — designed for how this specific business runs.

---

## Who uses the portal

The portal has **seven account types** (roles):

### Admin (system administrator)
The technical/root account. The only role that can open **Settings** to manage branches' master data — departments, roles, expense categories, system users, and which modules are switched on. The seeded owner account "Abhishek" holds this level of trust. Full cross-branch visibility.

### Owner
Full cross-branch operational control. Marks payroll as paid, edits/deletes ledger expenses, overrides day-end locks, deletes staff, and manages branches — everything except the admin-only Settings screen.

### Manager
Runs one branch. Marks attendance, manages POS orders and billing, fills the day-end entry, manages that branch's staff, vendors, inventory, and menu availability. Cannot see other branches, cannot mark payroll paid, cannot edit the ledger, cannot open Settings.

### Read-only analyst
Views dashboards and reports across branches but cannot change anything (and cannot open the day-end entry screen or POS billing).

### Waiter (posRole)
Front-of-house staff using mobile devices on the dining floor. Page-locked to `/management/pos/order`. Selects tables, configures items with variants and notes, and fires KOTs directly to the kitchen. Cannot see financial totals, billing, or ledger data.

### Kitchen Staff (posRole)
Back-of-house culinary team. Page-locked to the live Kitchen Display System at `/management/pos/kitchen`. Displays active KOT tickets in FIFO order, with buttons to advance tickets from PENDING to PREPARING to READY. Financial figures and prices are hidden.

### Billing Clerk (posRole)
Front counter cashiers. Page-locked to `/management/pos/billing`. Selects active orders, applies approved discounts and GST, processes cash/UPI/split payments, calculates change due, and prints customer thermal receipts.

The owner and managers are on phones/tablets most of the day; the UI is mobile-first with a collapsible sidebar and clean, uncluttered dedicated screens for floor roles. Staff and customers do **not** log in to customer-facing apps.

---

## What the portal does today (all modules shipped)

Unlike an early phased plan, the portal is **fully built**. It includes:

- **Dashboard** — today's collection, net balance, active staff, branch status, and pending-action nudges.
- **Staff & Positions** — staff profiles, budgeted "position" slots per branch/role, and a visual shift-schedule timeline with an auto-scheduler.
- **Attendance** — one-tap "mark all present" plus per-person exceptions; a 7-day edit window for managers.
- **Payroll** — days-worked (pre-filled from attendance) × salary, minus advances, marked paid by the owner.
- **POS / Billing / KOT** — real-time table layout grid, serializable takeaway queues (`T-1`, `T-2`), incremental KOT firing, live billing, payment splits, receipt printing, and order history.
- **Day-End (EOD) Entry** — income by dine-in/takeaway and cash/UPI (with automated POS prefill), optional cash-float reconciliation, optional detailed billing/ops figures, and daily expenses.
- **Expenses** — one shared ledger fed by both day-end entries and vendor bills.
- **Vendors** — supplier profiles and bills, with paid/unpaid tracking.
- **Inventory** — stock items with quantities, thresholds, and an adjustment log.
- **Menu** — a global item/category catalog with per-branch availability, variants, price history, and price overrides.
- **Reports** — P&L, revenue splits, salary-as-%-of-revenue, month-on-month, GST/covers, with CSV export.
- **Branches** and **Settings** — master data and module toggles.

Admins can switch modules (attendance, payroll, vendors, inventory, menu, reports, pos) **on or off** globally in the `config` table, so the business can start simple and grow into complexity.

---

## Core design principles

### 1. Speed on a phone
Every routine screen is designed to be completed quickly on a phone or tablet at the front counter or dining floor.

### 2. Data with a purpose
Attendance feeds payroll; POS feeds day-end prefill; day-end entries feed reports; expenses feed P&L. Nothing is collected without a downstream use.

### 3. The operator stays in control
The system assists judgment, it does not replace it — days can be re-saved, payroll days-worked can be overridden before saving, and global admins can edit locked/aged records.

### 4. Forgiving, not rigid
Cash float, billing, and ops details are optional. Reminders nudge; they never block.

### 5. Built to be handed over
Soft deletes, an audit trail, module toggles, and this documentation set exist so the business — and its history — can be transferred.

---

## Honest scope notes

Some things people often expect are **deliberately absent** in the current build:
- POS sales do not yet trigger automatic recipe-level inventory deductions (inventory adjustments are logged manually).
- No PDF salary slips and no Excel export (Reports and POS history export **CSV** only).
- No staff self-service, no customer accounts, no delivery platform integrations (Swiggy/Zomato).
- No SMS/WhatsApp/email — alerts are in-app only.
- No tax-filing or external accounting-software integration.

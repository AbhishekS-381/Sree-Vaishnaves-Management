# Sree Vaishnaves Management — System Map & Data Flow
**Document type:** Product · High Level
**Audience:** Product owner, architects, developers onboarding
**Version:** v3.0 | Last updated: 2026-11-02

---

## The big picture

One Next.js app serves a public marketing website (`/`) and a private management portal (`/management/*`). The portal's logic runs entirely as **Server Actions** (no REST API); data lives in a **normalized PostgreSQL relational database (27 tables)** managed by Drizzle ORM plus a `rate_limit` table. Every module below is implemented.

---

## The data hierarchy

```
BRANCHES
  └── each branch scopes its staff, operations, POS orders, and finances

STAFF
  └── belong to a branch, map to budgeted POSITION slots
  └── generate ATTENDANCE
  └── attendance pre-fills PAYROLL

POS / BILLING / KOT
  └── branch-scoped active tables and takeaway queues
  └── orders generate incremental kitchen tickets (pos_kots)
  └── settlements record cash, UPI, or split payments (pos_payments)
  └── settled orders prefill DAY-END (EOD) ENTRIES

DAY-END (EOD) ENTRIES
  └── one per branch per day
  └── income (prefilled by POS) + optional float/billing/ops
  └── lock after 24h
  └── EOD expenses flow into the shared EXPENSE LEDGER
```

---

## Module dependency map (all live)

```
STAFF ─────────► ATTENDANCE ─────────► PAYROLL
(profiles,        (present/absent/      (round(salary/30 × days)
 positions)        half-day/holiday)     − advances)

POS / BILLING ──► EOD ENTRY ─────────► EXPENSE LEDGER ◄────── VENDOR BILLS
(tables, KOTs,    (income + float       (one shared table,      (source = vendor)
 bills, payments)  + billing/ops)        source = eod|vendor)

MENU (global catalog + per-branch price/availability overrides) ──► POS (stations)

INVENTORY ──────► DASHBOARD alerts (low stock)

REPORTS ◄──────── EOD + EXPENSES + PAYROLL (+ attendance, staff)
(computed in browser; CSV export)

DASHBOARD ◄────── everything (read-only snapshot + pending actions)
```

Menu categories are reused as **chef specialties** in Staff. Module visibility is controlled by `config` table toggles.

---

## How data flows

### Income
```
POS Orders (dine-in / takeaway)
      │
      ▼
Bill Settlement (cash / UPI / split payments)
      │
      ▼  (automated prefill via getPosDataForEOD)
Day-End Entry (dine-in cash/UPI, takeaway cash/UPI, GST, covers)
      ▼
Dashboard "Today's Collection"  and  Reports revenue/P&L
```
Live POS settlements automatically feed Day-End income and billing fields, eliminating manual end-of-day re-entry.

### Expenses
```
Day-End expense chips (source: eod)     Vendor bills (source: vendor)
        └───────────────┬──────────────────────┘
                        ▼
            Shared Expense Ledger (expenses table)
                        ▼
        Reports (category breakdown, net profit)
```
EOD-sourced expenses for a day are replaced wholesale inside an atomic database transaction (`withDbTransaction`) on each EOD save; vendor expenses are independent. Editing/deleting ledger rows is owner/admin-only.

### Payroll
```
Staff exist → Attendance marked (present/absent/half-day/holiday)
      ▼
Payroll screen pre-fills days-worked from attendance (editable)
      ▼
payable = max(0, round(monthlySalary/30 × daysWorked) − advances)
      ▼
Save (status PENDING) → later Mark PAID (owner/admin)
```

---

## The shared expense ledger

```
Day-End screen              Vendor screen
(insert; replaces its       (insert vendor bills;
 own day's eod rows)         mark paid)
        │                          │
        └────────────┬─────────────┘
                     ▼
        expenses table (one shared collection)
                     │
     ┌───────────────┼───────────────┐
     ▼               ▼               ▼
  Expenses view   Reports        Dashboard net
  (edit/delete =  (breakdown)    (today's expenses)
   owner/admin)
```

---

## The menu model (global + overrides)

```
menu_items table (items)    menu_categories table (categories)
        │                          │
        └────────────┬─────────────┘   global catalog (admin/owner managed)
                     ▼
   branch_menu_items / branch_categories tables
   (per-branch price + availability; managers manage own branch)
                     │
                     ▼
   POS Order Stations (/pos, /pos/order, /pos/billing)
```

---

## Multi-branch scoping

```
BRANCH A                         BRANCH B
 staff, attendance, payroll,      staff, attendance, payroll,
 POS, EOD, expenses, menu,        POS, EOD, expenses, menu,
 inventory, vendors               inventory, vendors
        │                                 │
        └────────────────┬────────────────┘
                         ▼
     Admin / Owner / Read-only  →  see all branches
     Manager                    →  own branch only
     Waiter / Kitchen / Billing →  own branch only (page-locked)
```
Enforced in both the Server Action (`requireBranchAccess`) and each page loader / proxy route guard.

---

## What the dashboard pulls together

```
Dashboard (server component) reads:
├── eod        → today's collection, EOD-not-filled alert
├── expenses   → today's expenses → net balance
├── staff      → active staff count
├── attendance → attendance-not-marked alert
├── inventory  → low-stock alerts
├── payroll    → payroll-due alert
├── branches   → branch status panel
└── config     → which alerts/modules are active
Writes: nothing
```

---

## What is deliberately NOT connected / not built

| Not present | Why |
|-------------|-----|
| Auto stock deduction | No sales pipeline recipe mapping feeds inventory; adjustments remain manual. |
| Staff self-service | Management-only tool; staff are managed, not users. |
| Delivery aggregator integration | Not in scope (Swiggy / Zomato). |
| Accounting-software sync | The CSV export serves the accountant. |
| SMS/WhatsApp/email alerts | In-app pending actions only. |
| PDF/Excel export | Reports and POS history export CSV only. |

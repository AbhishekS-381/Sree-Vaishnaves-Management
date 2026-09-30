# Sree Vaishnaves Management — System Map & Data Flow
**Document type:** Product · High Level
**Audience:** Product owner, architects, developers onboarding
**Version:** v2.0 | Last updated: 2026-09-30

---

## The big picture

One Next.js app serves a public marketing website (`/`) and a private management portal (`/management/*`). The portal's logic runs entirely as **Server Actions** (no REST API); data lives as **JSON blobs in one Postgres table** (`json_store`) plus a `rate_limit` table. Every module below is implemented.

---

## The data hierarchy

```
BRANCHES
  └── each branch scopes its staff, operations, and finances

STAFF
  └── belong to a branch, map to budgeted POSITION slots
  └── generate ATTENDANCE
  └── attendance pre-fills PAYROLL

DAY-END (EOD) ENTRIES
  └── one per branch per day
  └── income + optional float/billing/ops
  └── lock after 24h
  └── EOD expenses flow into the shared EXPENSE LEDGER
```

---

## Module dependency map (all live)

```
STAFF ─────────► ATTENDANCE ─────────► PAYROLL
(profiles,        (present/absent/      (round(salary/30 × days)
 positions)        half-day/holiday)     − advances)

EOD ENTRY ──────► EXPENSE LEDGER ◄────── VENDOR BILLS
(income + float    (one shared table,      (source = vendor)
 + billing/ops)     source = eod|vendor)

MENU (global catalog + per-branch price/availability overrides)

INVENTORY ──────► DASHBOARD alerts (low stock)

REPORTS ◄──────── EOD + EXPENSES + PAYROLL (+ attendance, staff)
(computed in browser; CSV export)

DASHBOARD ◄────── everything (read-only snapshot + pending actions)
```

Menu categories are reused as **chef specialties** in Staff. Module visibility is controlled by `config.json` toggles.

---

## How data flows

### Income
```
Cash/UPI taken during the day
      │  (entered manually each evening)
      ▼
Day-End Entry (dine-in cash/UPI, takeaway cash/UPI, + optional billing)
      ▼
Dashboard "Today's Collection"  and  Reports revenue/P&L
```
There is no POS auto-feed — income is entered by the operator.

### Expenses
```
Day-End expense chips (source: eod)     Vendor bills (source: vendor)
        └───────────────┬──────────────────────┘
                        ▼
              Shared Expense Ledger (expenses.json)
                        ▼
        Reports (category breakdown, net profit)
```
EOD-sourced expenses for a day are replaced wholesale on each EOD save; vendor expenses are independent. Editing/deleting ledger rows is owner/admin-only.

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
        expenses.json (one shared collection)
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
menu.json (items)         menu_categories.json (categories)
        │                          │
        └────────────┬─────────────┘   global catalog (admin/owner managed)
                     ▼
   branch_menu_items.json / branch_categories.json
   (per-branch price + availability; managers manage own branch)
```

---

## Multi-branch scoping

```
BRANCH A                         BRANCH B
 staff, attendance, payroll,      staff, attendance, payroll,
 EOD, expenses, menu overrides,   EOD, expenses, menu overrides,
 inventory, vendors               inventory, vendors
        │                                 │
        └────────────────┬────────────────┘
                         ▼
     Admin / Owner / Read-only  →  see all branches
     Manager                    →  own branch only
```
Enforced in both the Server Action (`requireBranchAccess`) and each page loader.

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
| POS / order taking | Out of scope in this build; day-end billing is entered manually. |
| Staff logins | Management-only tool; staff are managed, not users. |
| Delivery aggregator integration | Not in scope. |
| Accounting-software sync | The CSV export serves the accountant. |
| SMS/WhatsApp/email alerts | In-app pending actions only. |
| PDF/Excel export | Reports export CSV only. |
| Auto stock deduction | No sales pipeline feeds inventory. |

# Restaurant Management App — System Map & Data Flow
**Document type:** Product · High Level  
**Audience:** Product owner, architects, developers onboarding  
**Version:** v1.0 | Last updated: 2026-03-15

---

## The big picture — how everything connects

This document explains how the modules relate to each other, what data flows between them, and why the phased approach works the way it does.

---

## The data hierarchy

Everything in this system flows from three foundational entities:

```
BRANCHES
  └── Each branch has its own staff, operations, and finances

STAFF
  └── Staff belong to a branch
  └── Staff generate attendance records
  └── Attendance feeds payroll

DAILY ENTRIES (EOD)
  └── One per branch per day
  └── Captures income and expenses
  └── Locks after 24 hours
  └── Feeds all financial reporting
```

Every other module either feeds these three or is built on top of them.

---

## Module dependency map

```
Phase 1 — Foundation layer
┌─────────────────────────────────────────────────────────┐
│                                                          │
│  STAFF PROFILES ──────────► ATTENDANCE ──────────► PAYROLL
│  (who works here)            (who showed up)       (what they're paid)
│                                                          │
│  EOD ENTRY ─────────────► EXPENSE LEDGER               │
│  (daily income)              (daily spending)            │
│                                                          │
│  MENU ─────────────── (reference for Phase 4)           │
│                                                          │
└──────────────────────┬───────────────────────────────────┘
                       │ all Phase 1 data feeds ↓
Phase 2 — Supply layer │
┌──────────────────────▼───────────────────────────────────┐
│                                                          │
│  INVENTORY ◄──────── VENDOR BILLS ────► EXPENSE LEDGER  │
│  (what we have)       (what we bought)   (shared)        │
│                                                          │
└──────────────────────┬───────────────────────────────────┘
                       │ all Phase 1+2 data feeds ↓
Phase 3 — Insight layer│
┌──────────────────────▼───────────────────────────────────┐
│                                                          │
│  REPORTS ◄────────── ALL MODULES                        │
│  ANALYTICS           P&L, trends, salary analytics       │
│  EXPORT              PDF, CSV, Excel                     │
│                                                          │
└──────────────────────┬───────────────────────────────────┘
                       │ POS replaces manual income entry ↓
Phase 4 — Billing layer│
┌──────────────────────▼───────────────────────────────────┐
│                                                          │
│  POS / BILLING ────► EOD INCOME (auto-filled)           │
│  (real-time orders)   INVENTORY (auto-deducted)          │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## How data flows through the system

### The income flow

```
Customer pays at restaurant
         │
         ▼ (Phase 1: manually entered at EOD)
         ▼ (Phase 4: automatically captured by POS)
         │
   Daily EOD Entry
   ├── Dine-in cash
   ├── Dine-in UPI
   ├── Takeaway cash
   └── Takeaway UPI
         │
         ▼
   Monthly income totals (per branch)
         │
         ▼
   Reports: P&L, trend charts, branch comparison
```

### The expense flow

```
Money goes out of the business
         │
         ├── Quick entry during EOD (source: eod)
         └── Vendor bill recorded in vendor screen (source: vendor)
                       │
                       ▼
              Shared Expense Ledger
              (single table, both sources)
                       │
                       ▼
         Monthly expense totals by category
                       │
                       ▼
         Reports: expense breakdown, raw material cost trend
```

### The payroll flow

```
Staff member exists in system
         │
         ▼
Daily attendance marked (present / absent / half-day / holiday)
         │
         ▼
Month-end: payroll generated
├── Reads all attendance for the month
├── Applies salary formula
├── Subtracts recorded advances
└── Produces calculated net payable
         │
         ▼
Owner reviews and overrides if needed
         │
         ▼
Owner approves → payroll locked
├── Advances marked as deducted
├── Salary slips available as PDF
└── Payroll cost feeds into P&L and analytics
```

---

## The shared expense ledger — explained

This is the most important architectural concept to understand. There is **one expense table** that two different screens write to.

```
EOD Entry Screen                 Vendor Management Screen
(quick evening entry)            (full management interface)
        │                                    │
        │ INSERT only                        │ INSERT + EDIT + DELETE
        │ source = 'eod'                     │ source = 'vendor'
        │                                    │
        └────────────────┬───────────────────┘
                         ▼
              Single Expense Ledger
              (one table in the database)
                         │
              ┌──────────┼──────────┐
              ▼          ▼          ▼
         EOD view    Vendor view   Reports
         (read)      (read/write)  (read)
```

Why this matters: If the owner records a vegetable bill through vendor management at 2pm, when the manager fills in the EOD entry at 10pm that bill already appears in the expenses section — clearly labelled "from vendor." The manager does not enter it again. No double counting. No reconciliation needed.

---

## The multi-branch architecture — explained

Every piece of data has a branch label on it. This is like every document in a filing cabinet having a colour-coded tab.

```
BRANCH 1                          BRANCH 2
┌──────────────────────┐          ┌──────────────────────┐
│ Staff (35)           │          │ Staff (35)           │
│ Attendance (daily)   │          │ Attendance (daily)   │
│ Payroll (monthly)    │          │ Payroll (monthly)    │
│ EOD entries (daily)  │          │ EOD entries (daily)  │
│ Expenses (daily)     │          │ Expenses (daily)     │
│ Menu items           │          │ Menu items           │
│ Inventory            │          │ Inventory            │
└──────────┬───────────┘          └───────────┬──────────┘
           │                                  │
           └──────────────┬───────────────────┘
                          ▼
               OWNER'S CONSOLIDATED VIEW
               (sees both branches together
                or either branch individually)
```

The branch manager at Branch 1 only ever sees the left box. The owner sees both plus the combined total. This is not a permission trick — it is a fundamental design decision baked into every query, every API call, every report.

---

## What the dashboard pulls together

The dashboard is the one screen that reads from every module simultaneously. It is a summary of the current state of the business, not a module in its own right.

```
Dashboard reads from:
├── daily_entries → today's income
├── expenses → today's expenses
├── attendance_logs → today's headcount
├── payroll_records → payroll status this month
├── stock_items (Phase 2) → low stock alerts
└── daily_entries (last 30 days) → month-to-date income

Dashboard writes to: nothing
(it is a read-only summary layer)
```

---

## Phase by phase — what becomes possible

### After Phase 1 (6 months of data)
- ✓ Know today's income and net for any day going back 6 months
- ✓ Approve monthly payroll in 15 minutes instead of 2 hours
- ✓ Answer "was this month better than last month?"
- ✓ Check any staff member's attendance history instantly
- ✓ Know total expenses by category for any month

### After Phase 2 (12 months of data)
- ✓ Everything from Phase 1, plus:
- ✓ Know current stock levels at each branch
- ✓ See payment history per vendor
- ✓ Get early warnings before running out of ingredients
- ✓ See raw material cost broken down by supplier category

### After Phase 3 (18 months of data)
- ✓ Everything from Phases 1 & 2, plus:
- ✓ Full P&L with trends across 18 months
- ✓ Salary as percentage of revenue — is it sustainable?
- ✓ Month-on-month comparison with visual charts
- ✓ Monthly PDF report for accountant
- ✓ Data export for external analysis
- ✓ Which branch is more profitable and why

### After Phase 4 (24 months)
- ✓ Everything from all phases, plus:
- ✓ Real-time billing integrated with management
- ✓ EOD income fills automatically from POS
- ✓ Item-level sales data (what sells best, when, at which branch)
- ✓ Automatic stock deduction from sales

---

## What is deliberately NOT connected

Some things are intentionally kept separate to maintain simplicity:

| Not connected | Why |
|---------------|-----|
| Staff cannot log in | The app is management-only. Adding staff login adds massive complexity (passwords, permissions, disputes) with low value in Phase 1. |
| No integration with Swiggy/Zomato | Delivery platform integrations are complex and constantly changing APIs. Manual entry of delivery income is fine for Phase 1. |
| No accounting software sync | Tally/Zoho integration requires significant effort and introduces a dependency. The monthly PDF export serves the accountant's needs adequately. |
| No SMS/WhatsApp alerts | In-app reminders are sufficient for Phase 1. The cost and complexity of messaging APIs is not justified yet. |
| No GST filing | Tax compliance is handled by the accountant using the exported data. Building a GST filing integration would require ongoing maintenance as regulations change. |

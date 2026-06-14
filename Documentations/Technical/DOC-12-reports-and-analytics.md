# DOC-12 · Reports & Analytics
**Version:** v1.0  
**Last updated:** 2026-03-15  
**Phase:** 3 (12–18 months)  
**Depends on:** DOC-01, DOC-02, DOC-03, DOC-07, DOC-08, DOC-05

---

## Overview

Reports and analytics are built on top of the data accumulated in Phases 1 and 2. This module is read-only — no data is created here. It provides P&L summaries, income/expense trends, salary analytics, and exportable reports.

---

## API routes

### Financial reports
| Method | Route | Role | Description |
|--------|-------|------|-------------|
| GET | `/api/v1/branches/:branchId/reports/daily` | owner, branch_manager | Daily P&L for a date range |
| GET | `/api/v1/branches/:branchId/reports/monthly` | owner, branch_manager | Monthly P&L summary |
| GET | `/api/v1/branches/:branchId/reports/monthly/compare` | owner, branch_manager | This month vs last month |
| GET | `/api/v1/reports/consolidated` | owner only | Cross-branch monthly summary |

### Salary analytics
| Method | Route | Role | Description |
|--------|-------|------|-------------|
| GET | `/api/v1/branches/:branchId/reports/payroll` | owner, branch_manager | Monthly salary cost trend |
| GET | `/api/v1/branches/:branchId/reports/payroll/breakdown` | owner, branch_manager | Cost by role |
| GET | `/api/v1/branches/:branchId/reports/staff/:staffId/attendance` | owner, branch_manager | Staff attendance analytics |

### Export
| Method | Route | Role | Description |
|--------|-------|------|-------------|
| GET | `/api/v1/branches/:branchId/export/csv/:module` | owner only | CSV export per module |
| GET | `/api/v1/branches/:branchId/export/excel/:month` | owner only | Full monthly Excel dump |
| GET | `/api/v1/branches/:branchId/reports/monthly/:month/pdf` | owner only | Monthly summary PDF |

---

## Monthly P&L response

```json
{
  "month": "2026-03",
  "branchId": "uuid",
  "income": {
    "dineinCash": 180000,
    "dineinUpi": 240000,
    "takeawayCash": 60000,
    "takeawayUpi": 90000,
    "totalDinein": 420000,
    "totalTakeaway": 150000,
    "total": 570000
  },
  "expenses": {
    "byCategory": [
      { "category": "Raw materials", "amount": 180000 },
      { "category": "Gas / fuel", "amount": 12000 },
      { "category": "Electricity", "amount": 8000 },
      { "category": "Rent", "amount": 50000 },
      { "category": "Miscellaneous", "amount": 5000 }
    ],
    "total": 255000
  },
  "payroll": {
    "total": 310000,
    "asPercentOfRevenue": 54.4
  },
  "netProfit": 5000,
  "workingDays": 26,
  "holidayDays": 2,
  "averageDailyIncome": 21923
}
```

---

## Month-on-month comparison response

```json
{
  "currentMonth": "2026-03",
  "previousMonth": "2026-02",
  "income": {
    "current": 570000,
    "previous": 510000,
    "delta": 60000,
    "deltaPercent": 11.8
  },
  "expenses": {
    "current": 255000,
    "previous": 240000,
    "delta": 15000,
    "deltaPercent": 6.3
  },
  "netProfit": {
    "current": 5000,
    "previous": -20000,
    "delta": 25000
  }
}
```

---

## Salary analytics response

```json
{
  "branchId": "uuid",
  "months": ["2026-01", "2026-02", "2026-03"],
  "monthlyCost": [285000, 295000, 310000],
  "asPercentOfRevenue": [52.1, 57.8, 54.4],
  "byRole": [
    { "role": "head_cook", "monthlyCost": 18000, "headcount": 1 },
    { "role": "waiter", "monthlyCost": 88000, "headcount": 8 },
    { "role": "assistant_cook", "monthlyCost": 42000, "headcount": 3 }
  ],
  "advanceFrequency": [
    { "staffId": "uuid", "name": "Ravi S", "advancesLast3Months": 3, "totalAmount": 6000 }
  ]
}
```

---

## Data export

### CSV export — per module
Modules available: `staff`, `attendance`, `expenses`, `income`, `payroll`

Each produces a single CSV file. Column headers use human-readable labels. Dates in DD-MM-YYYY format (Indian convention). Amounts in plain integers with ₹ prefix in header.

### Excel monthly dump
One `.xlsx` file per month. Sheets:
1. Summary (P&L overview)
2. Daily income log
3. Expense ledger
4. Attendance summary
5. Payroll records

### Monthly PDF report
Single-page PDF for accountant / physical filing. Contains:
- Restaurant name, branch, month
- Total income (with cash/UPI breakdown)
- Expense breakdown by category
- Payroll cost and net payable total
- Net profit / loss
- Signed "Approved by" section (owner name + approval date)

---

## Business rules

1. Reports only show locked EOD entries — draft or in-progress entries are excluded from P&L
2. Deleted expenses (`deleted_at IS NOT NULL`) are excluded from all totals
3. Cross-branch consolidated report is owner-only
4. All exports are owner-only — branch manager has read-only access to report screens but cannot export
5. Absenteeism rate = (days absent + days leave) / (working_days - days_holiday) × 100 per staff over a rolling period

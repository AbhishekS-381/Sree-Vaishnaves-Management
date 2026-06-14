# DOC-13 · Dashboard
**Version:** v1.0  
**Last updated:** 2026-03-15  
**Phase:** 1  
**Depends on:** DOC-01, DOC-02, DOC-03, DOC-07, DOC-06, DOC-05

---

## Overview

The home screen after login. Designed to answer the owner's first question every morning: "How are things going today?" The owner sees all branches at once; the branch manager sees only their branch. All data is today-focused with a glance at the current month.

---

## API routes

| Method | Route | Role | Description |
|--------|-------|------|-------------|
| GET | `/api/v1/dashboard` | owner | Consolidated dashboard across all branches |
| GET | `/api/v1/branches/:branchId/dashboard` | owner, branch_manager | Single branch dashboard |

Both routes return the same structure. The consolidated route returns an array of branch summaries plus a totals row.

---

## Single branch dashboard response

```json
{
  "branchId": "uuid",
  "branchName": "Branch 1 - Main",
  "date": "2026-03-15",
  "today": {
    "income": {
      "total": 18500,
      "dinein": 12000,
      "takeaway": 6500
    },
    "expenses": {
      "total": 6800
    },
    "netSoFar": 11700,
    "eodStatus": "draft",
    "isHoliday": false
  },
  "attendance": {
    "total": 35,
    "present": 32,
    "absent": 1,
    "halfDay": 1,
    "leave": 1,
    "notMarked": 0,
    "marked": true
  },
  "pendingActions": [
    {
      "type": "EOD_NOT_FILLED",
      "message": "Today's EOD entry has not been filled yet.",
      "severity": "warning",
      "actionRoute": "/branches/uuid/eod/2026-03-15"
    }
  ],
  "thisMonth": {
    "totalIncome": 380000,
    "totalExpenses": 142000,
    "netProfit": 238000,
    "vsLastMonth": {
      "income": { "delta": 25000, "deltaPercent": 7.0 },
      "net": { "delta": 18000, "deltaPercent": 8.2 }
    },
    "payrollDue": true,
    "payrollMonth": "2026-03"
  }
}
```

---

## Consolidated owner dashboard response

```json
{
  "date": "2026-03-15",
  "branches": [
    { "branchId": "uuid-1", "branchName": "Branch 1", "today": {...}, "attendance": {...}, "pendingActions": [...] },
    { "branchId": "uuid-2", "branchName": "Branch 2", "today": {...}, "attendance": {...}, "pendingActions": [...] }
  ],
  "totals": {
    "today": {
      "income": 42000,
      "expenses": 14500,
      "net": 27500
    },
    "thisMonth": {
      "totalIncome": 760000,
      "totalExpenses": 284000,
      "netProfit": 476000
    },
    "pendingActions": [
      { "type": "EOD_NOT_FILLED", "branchName": "Branch 2", "severity": "warning" }
    ]
  }
}
```

---

## Pending actions

Pending actions are generated server-side by checking conditions. They appear as alert banners on the dashboard.

| Type | Condition | Severity | Who sees it |
|------|-----------|----------|-------------|
| `EOD_NOT_FILLED` | No EOD entry for today by 10pm | warning | Both |
| `ATTENDANCE_NOT_MARKED` | No attendance records for today | warning | Both |
| `PAYROLL_DUE` | Last 3 days of month, payroll not approved | info | Owner only |
| `LOW_STOCK` | Any item below threshold (Phase 2) | warning | Both |

Severity levels: `info` (blue), `warning` (amber), `urgent` (red)

---

## Quick action buttons

The dashboard includes quick-action buttons for the most common next steps:

| Button | Route | Shown when |
|--------|-------|-----------|
| Mark attendance | `/branches/:id/attendance` | Attendance not marked today |
| Fill EOD entry | `/branches/:id/eod/today` | EOD not filled today |
| Review payroll | `/branches/:id/payroll/:month` | Payroll due this month |
| View all alerts | `/alerts` | Any pending actions exist |

---

## Frontend layout

### Owner view
```
[Branch 1 card]          [Branch 2 card]
Today: ₹18,500           Today: ₹23,500
Attendance: 32/35        Attendance: 28/30
⚠ EOD not filled         ✓ All good

[Combined totals bar]
Total today: ₹42,000 | Net: ₹27,500

[This month summary]
Revenue: ₹7,60,000 | +7% vs last month
```

### Branch manager view
```
[Single branch full-width]
Today's income: ₹18,500
  Dine-in: ₹12,000 | Takeaway: ₹6,500

Attendance: 32 of 35 present
  1 absent · 1 half-day · 1 leave

[Pending actions]
⚠ EOD entry not filled yet

[This month]
Revenue: ₹3,80,000 | Expenses: ₹1,42,000
Net: ₹2,38,000 (+8.2% vs last month)
```

---

## Performance notes

The dashboard API should be fast — this screen loads on every app open. Use a single optimised SQL query with JOINs rather than N+1 queries. Cache today's summary for 5 minutes (invalidate on EOD save or attendance mark).

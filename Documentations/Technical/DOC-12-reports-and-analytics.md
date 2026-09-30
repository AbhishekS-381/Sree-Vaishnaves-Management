# DOC-12 · Reports & Analytics
**Version:** v2.0
**Last updated:** 2026-09-30
**Status:** Implemented
**Depends on:** DOC-01, DOC-02, DOC-03, DOC-04, DOC-05, DOC-07, DOC-08

---

## Overview

Reports at `/management/reports` (`ReportsClientPage.tsx`). This is a **read-only, client-side analytics screen** — the page loader (`page.tsx`) reads all relevant collections server-side (branch-scoped for managers) and passes them to the client, which computes every metric in-browser for a selected branch + month + year. There are no report Server Actions and no server-side aggregation endpoints.

Data passed to the client: `branches`, `eodData`, `expensesData`, `payrollData`, `attendanceData`, `staffData`, `categories`.

---

## Selection & scoping

- Controls: branch selector (defaults to first available; managers pinned), month, and year.
- For non-global users, the loader pre-filters every collection to the user's `branchId`. `readonly` and global admins see all branches.
- Metrics are computed over EOD/expense/payroll rows matching the selected branch and month/year.

---

## Computed metrics (in `ReportsClientPage.tsx`)

**Revenue**
- `totalIncome` = Σ over filtered EOD of `dineInCash + dineInUpi + takeawayCash + takeawayUpi`.
- `prevTotalIncome` = same for the previous month; `momChangeValue` and `momChangePercent` give month-on-month change (100% if previous was 0 and current > 0).
- Dine-in vs takeaway split and cash vs UPI split with percentages.

**Expenses**
- `totalExpenses` = Σ of filtered expense `amount` (both sources).
- Breakdown by category (resolved via `categories`).

**Payroll**
- `totalSalaryPayable` = Σ of filtered payroll `payableAmount`.
- `salaryPercentOfRevenue` = `totalSalaryPayable / totalIncome * 100` (guarded for zero revenue).

**Net profit**
- `netProfit = totalIncome − totalExpenses − totalSalaryPayable`.

**Billing/ops-derived (from EOD `billing`)**
- `totalGSTCollected` = Σ `billing.gstCollected`.
- `totalCovers` = Σ `billing.dineInCovers`; `totalTakeawayOrders` = Σ `billing.takeawayOrders`.
- `avgCoverValue` = `round(totalIncome / totalCovers)` when covers > 0.
- `totalDiscounts` = Σ `billing.discounts`; `totalVoids` = Σ `billing.voids`.

---

## Export

- **CSV export** is built client-side and downloaded. It includes the summary lines (Total Revenue, Total Ledger Expenses, salary, Net Profit) and the relevant breakdowns for the selected period.
- There is **no** Excel (`.xlsx`) export and **no** PDF report generation in the codebase.
- There is no separate "consolidated cross-branch" report action; consolidation is achieved by an admin/owner selecting branches in the UI over the data they can already see.

---

## Access

- Visible to admin, owner, readonly, and managers (own branch).
- Gated in navigation by the `reports` module toggle in `config.json`.

---

## Business rules summary
1. Reports are computed in the browser from server-loaded collections; nothing is written.
2. Managers only ever receive their own branch's data from the loader.
3. Net profit = revenue − ledger expenses − payroll payable for the selected period.
4. Billing-derived metrics only reflect EOD entries where the optional `billing` block was filled.
5. Export is CSV only.

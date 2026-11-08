# DOC-07 · EOD Daily Entry
**Version:** v3.0
**Last updated:** 2026-11-02
**Depends on:** DOC-01, DOC-02, DOC-03, DOC-04, DOC-08

---

## Overview

The End-of-Day entry is filled once per branch per day at `/management/eod` (`EODClientPage.tsx`), backed by `src/app/actions/eod.ts` and the `useEODSave` hook over normalized PostgreSQL tables (`eod`, `expenses`). It captures income (dine-in/takeaway × cash/UPI), an optional cash-float reconciliation, an optional detailed **billing** breakdown, optional **ops** metadata, and daily expenses (written into the shared ledger). Settled orders from the POS module automatically prefill income, tax, and cover fields. `readonly` and floor staff (`waiter`, `kitchen`, `billing`) are redirected away from this page. There are no REST routes.

---

## Actions (`src/app/actions/eod.ts`)

| Action | Signature | Notes |
|--------|-----------|-------|
| `saveEODEntry` | `(entryData, expensesOut)` | validates, enforces branch, atomically upserts the EOD row and replaces that day's `source:'eod'` expenses inside `withDbTransaction` |
| `getEODByDate` | `(date, branchId)` | branch-enforced fetch of a single day's entry |
| `getExpensesByDate` | `(date, branchId)` | branch-enforced fetch of that day's expenses |

`entryData` is `Omit<EODEntry, 'id' | 'createdAt' | 'updatedAt' | 'status'>`; `expensesOut` is a list of `{ branchId, date, amount, categoryId, notes }`.

---

## POS Integration & Automated Prefill (`getPosDataForEOD`)

When opening `/management/eod`, the server queries settled POS orders for that `(branchId, date)` using `getPosDataForEOD` (from `src/app/actions/pos.ts`):
- Aggregates settled dine-in cash and UPI collections.
- Aggregates settled takeaway cash and UPI collections.
- Computes billing totals: total bill amount, bill count, dine-in covers, takeaway orders, cash/UPI collected, GST collected, discounts, and voids.
- If an EOD entry has not yet been submitted for the date, these figures automatically populate the form fields, eliminating manual end-of-day calculations.

---

## Data captured (see DOC-03 → `eod` table)

- **income** (required JSONB): `dineInCash`, `dineInUpi`, `takeawayCash`, `takeawayUpi` — integers ≥ 0.
- **openingFloat**, **actualClosingFloat** (optional integers): cash-drawer reconciliation.
- **billing** (optional JSONB): `totalBillAmount`, `billCount`, `dineInCovers`, `takeawayOrders`, `cashCollectedAsBilled`, `upiCollectedAsBilled`, `voids`, `discounts`, `gstCollected`.
- **ops** (optional JSONB): `staffOnDuty`, `powerCutHours` (0–24), `unusualEvent` (≤100 chars), `kitchenIssue`, `zeroRevenueConfirmed`.
- **notes** (optional, ≤2000 chars).
- **status:** `submitted` on save. Owners/admins can overwrite `locked`/aged entries.

---

## Validation (Zod, in `saveEODEntry`)

- `income`: four integer fields ≥ 0.
- `billing`/`ops`: optional objects with the integer/bounded fields above.
- `date`: must match `YYYY-MM-DD`.
- `notes`: ≤ 2000 chars.
- **Zero-revenue guard:** if total income is 0 and `ops.zeroRevenueConfirmed` is not true, returns `{ error: 'ZERO_REVENUE_UNCONFIRMED' }`.
- **Future-date guard:** `date` may not be after today (IST) → `EOD entry cannot be submitted for a future date`.

---

## Locking rules (as enforced)

Inside the transaction, when an entry already exists for `(date, branchId)`:
- It is considered locked if `status === 'locked'` **or** it is more than **24 hours** past its `createdAt`.
- A locked/aged entry can only be updated by a **global admin** (admin/owner). A manager attempting this gets `EOD for this date is already locked.`
- New entries are created with `status: 'submitted'`.

There is no separate manual "lock" / "unlock" action — locking is implicit (status or the 24-hour age check), and global admins bypass it.

---

## Atomic Expense Synchronization

Both the EOD entry and its associated day-end expenses are saved inside a single atomic database transaction via `withDbTransaction`:
1. Upsert the `eod` record on unique constraint `(branchId, date)` (`eod_branch_date_uniq`).
2. Delete existing expenses in the `expenses` table where `branchId === entryData.branchId AND date === entryData.date AND source === 'eod'`.
3. Insert submitted `expensesOut` as new rows with `source: 'eod'`.
4. Vendor-sourced expenses (`source: 'vendor'`) for the day are preserved untouched.
5. Log `SAVE_EOD` to the `audit_logs` table and revalidate `/management/eod`, `/management/expenses`, and `/`.

---

## Client behaviour (`EODClientPage.tsx`, `useEODSave`)

- Branch selector (managers pinned) and date picker (defaults to today).
- Live computed figures: total income, total cash/UPI split, total expenses, net income, `expectedClosingFloat = openingFloat + totalCashIncome − totalExpenses`, and `cashDiscrepancy = actualClosingFloat − expectedClosingFloat`.
- Shows `billingVsCollectionGap = totalIncome − netBilledAmount` and derived metrics (avg cover value, revenue per staff).
- Expenses are added as category-tagged chips (categories from `categories` table).
- `staffOnDuty` in ops can be auto-filled from that day's attendance count.

---

## Business rules summary
1. One EOD entry per branch per day (unique constraint `eod_branch_date_uniq`).
2. No future-dated entries.
3. Entries lock after 24 hours (or when status is `locked`); only global admins can edit past that.
4. Zero-revenue days must be explicitly confirmed.
5. Settled POS orders auto-prefill income and billing data.
6. EOD-sourced expenses for a day are atomically replaced; vendor expenses are preserved.
7. All monetary inputs are integers.
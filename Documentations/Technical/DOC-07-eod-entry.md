# DOC-07 · EOD Daily Entry
**Version:** v2.0
**Last updated:** 2026-09-30
**Depends on:** DOC-01, DOC-02, DOC-03, DOC-04, DOC-08

---

## Overview

The End-of-Day entry is filled once per branch per day at `/management/eod` (`EODClientPage.tsx`), backed by `src/app/actions/eod.ts` and the `useEODSave` hook. It captures income (dine-in/takeaway × cash/UPI), an optional cash-float reconciliation, an optional detailed **billing** breakdown, optional **ops** metadata, and any daily expenses (written into the shared ledger). `readonly` users are redirected away from this page. There are no REST routes.

---

## Actions (`src/app/actions/eod.ts`)

| Action | Signature | Notes |
|--------|-----------|-------|
| `saveEODEntry` | `(entryData, expensesOut)` | validates, enforces branch, upserts the EOD row, then replaces that day's `source:'eod'` expenses |
| `getEODByDate` | `(date, branchId)` | branch-enforced fetch of a single day's entry |
| `getExpensesByDate` | `(date, branchId)` | branch-enforced fetch of that day's expenses |

`entryData` is `Omit<EODEntry, 'id' | 'createdAt' | 'updatedAt' | 'status'>`; `expensesOut` is a list of `{ branchId, date, amount, categoryId, notes }`.

---

## Data captured (see DOC-03 → `EODEntry`)

- **income** (required): `dineInCash`, `dineInUpi`, `takeawayCash`, `takeawayUpi` — integers ≥ 0.
- **openingFloat**, **actualClosingFloat** (optional): cash-drawer reconciliation.
- **billing** (optional): `totalBillAmount`, `billCount`, `dineInCovers`, `takeawayOrders`, `cashCollectedAsBilled`, `upiCollectedAsBilled`, `voids`, `discounts`, `gstCollected`.
- **ops** (optional): `staffOnDuty`, `powerCutHours` (0–24), `unusualEvent` (≤100 chars), `kitchenIssue`, `zeroRevenueConfirmed`.
- **notes** (optional, ≤2000 chars).
- **status:** `submitted` on save (there is no separate draft persisted server-side; drafts are client-side only). Owners can overwrite `locked`/aged entries.

---

## Validation (Zod, in `saveEODEntry`)

- `income`: four integer fields ≥ 0.
- `billing`/`ops`: optional objects with the integer/bounded fields above.
- `date`: must match `YYYY-MM-DD`.
- `notes`: ≤ 2000 chars.
- **Zero-revenue guard:** if total income is 0 and `ops.zeroRevenueConfirmed` is not true, returns `{ error: 'ZERO_REVENUE_UNCONFIRMED' }`.
- **Future-date guard:** `date` may not be after today (IST) → `EOD entry cannot be submitted for a future date`.

---

## Locking rules (as implemented)

Inside the transaction, when an entry already exists for `(date, branchId)`:
- It is considered locked if `status === 'locked'` **or** it is more than **24 hours** past its `createdAt`.
- A locked/aged entry can only be updated by a **global admin** (admin/owner). A manager attempting this gets `EOD for this date is already locked.`
- New entries are created with `status: 'submitted'`.

There is no separate manual "lock" / "unlock" action — locking is implicit (status or the 24-hour age check), and global admins bypass it.

---

## Expense synchronization

After the EOD row is saved, `saveEODEntry` rewrites that day's EOD-sourced expenses in a **separate** `withTransaction` on `expenses.json`:
1. Remove all existing expenses where `date === entryData.date && branchId === entryData.branchId && source === 'eod'`.
2. Insert the submitted `expensesOut` as new `source: 'eod'` rows (id `exp_<uuid>`, `createdAt = now`).

If the expense write fails, the action still returns `{ success: true, warning: 'EOD saved, but failed to write expenses.' }`. Vendor-sourced expenses for the day are untouched (they are owned by the Vendors module — DOC-11).

The EOD save also `logAction('SAVE_EOD', …)` and revalidates `/management/eod`, `/management/expenses`, and `/`.

---

## Client behaviour (`EODClientPage.tsx`, `useEODSave`)

- Branch selector (managers pinned) and date picker (defaults to today).
- Live computed figures: total income, total cash/UPI split, total expenses, net income, `expectedClosingFloat = openingFloat + totalCashIncome − totalExpenses`, and `cashDiscrepancy = actualClosingFloat − expectedClosingFloat` (flagged as shortage/overage).
- If billing is enabled, shows `billingVsCollectionGap = totalIncome − netBilledAmount` and derived metrics (avg cover value, revenue per staff).
- Expenses are added as category-tagged rows (categories come from `categories.json`).
- `staffOnDuty` in ops can be auto-filled from that day's attendance count (attendance is passed into the page).
- The hook returns `{ error }` / `{ success }` / `{ warning }`; the client renders feedback and never relies on server-side `alert()`.

---

## Business rules summary
1. One EOD entry per branch per day (upsert on `(date, branchId)`).
2. No future-dated entries.
3. Entries lock after 24 hours (or when status is `locked`); only global admins can edit past that.
4. Zero-revenue days must be explicitly confirmed.
5. EOD-sourced expenses for a day are fully replaced on each save; vendor expenses are preserved.
6. All monetary inputs are integers.

# DOC-08 · Expense Ledger
**Version:** v3.0
**Last updated:** 2026-11-02
**Depends on:** DOC-01, DOC-02, DOC-03, DOC-04, DOC-07, DOC-11

---

## Overview

A single shared relational table `expenses` in PostgreSQL is the source of truth for all expenses. Rows are created from two places and distinguished by a `source` field:

- **EOD entry** (`source: 'eod'`) — written by `saveEODEntry` (DOC-07). Insert/replace only from the EOD screen within an atomic database transaction.
- **Vendor bills** (`source: 'vendor'`) — written by `addVendorBill` (DOC-11).

Direct ledger management (edit/delete) lives in `src/app/actions/expenses.ts` and is surfaced on `/management/expenses` (`ExpensesClientPage.tsx`).

---

## Actions

| Source file | Action | Signature | Auth |
|-------------|--------|-----------|------|
| `eod.ts` | `saveEODEntry` | `(entryData, expensesOut)` | session; branch enforced |
| `vendors.ts` | `addVendorBill` | `(prevState, formData)` | session; branch enforced |
| `vendors.ts` | `markVendorBillAsPaid` | `(id)` | session; branch-checked |
| `expenses.ts` | `updateExpense` | `(id, updates)` | **`isGlobalAdmin` only** |
| `expenses.ts` | `deleteExpense` | `(id)` | **`isGlobalAdmin` only** |

There is no dedicated `addExpense` action on the expenses screen — expenses are created only via EOD or vendor flows. The expenses screen is for viewing, editing, and deleting (admins/owners only).

---

## Expense shape (see DOC-03 → `expenses` table)
```ts
type Expense = {
  id: string;            // exp_<uuid> (eod) | venexp_<uuid> (vendor)
  branchId: string;
  amount: number;        // integer
  categoryId: string;    // -> categories table (ExpenseCategory)
  source: 'eod' | 'vendor';
  date: string;          // YYYY-MM-DD
  notes?: string;        // vendor bills embed "Vendor: <name> | Invoice: <ref>"
  createdAt: string;
  isPaid?: boolean;      // vendor bills only
}
```
Expenses reference a foreign `categoryId`. Deletions permanently remove the row via SQL `DELETE`.

---

## `updateExpense` (admins/owners only)

- Rejects non-global-admins with `Only admin and owner can edit ledger expenses.`
- Validates the patch with Zod: `amount` (int ≥ 0), `notes` (≤500), `date` (`YYYY-MM-DD`), `category` (≤100) — all optional.
- Preserves `id` and `branchId` (branch cannot be reassigned).
- Executes Drizzle `update(expenses)` query.
- Audit-logs `UPDATE_EXPENSE` to `audit_logs` table with before/after amounts and revalidates `/management/expenses` and `/management/reports`.

## `deleteExpense` (admins/owners only)

- Deletes the row via Drizzle `delete(expenses)`.
- Audit-logs `DELETE_EXPENSE` to `audit_logs` table and revalidates expenses + reports.

---

## Permissions matrix

| Action | admin | owner | manager | readonly | waiter | kitchen | billing |
|--------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Create via EOD | ✓ | ✓ | ✓ (own branch) | ✗ | ✗ | ✗ | ✗ |
| Create via vendor bill | ✓ | ✓ | ✓ (own branch) | ✗ | ✗ | ✗ | ✗ |
| Mark vendor bill paid | ✓ | ✓ | ✓ (own branch) | ✗ | ✗ | ✗ | ✗ |
| Edit ledger expense | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Delete ledger expense | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| View ledger | ✓ | ✓ | ✓ (own branch) | ✓ | ✗ | ✗ | ✗ |

The EOD screen never edits or deletes expenses directly — it replaces its own day's `source:'eod'` rows atomically on save (DOC-07). Corrections to individual expenses happen on the Expenses screen (global admins) or, for vendor bills, via the Vendors screen.

---

## Expense categories (`categories` table, `src/app/actions/categories.ts`)

Categories are **global** (not branch-scoped). Managed by global admins (`addCategory`, `updateCategory`, `deleteCategory` all check `isGlobalAdmin`).

```ts
type ExpenseCategory = { id: string; name: string; color?: string }  // cat_<uuid>, default color #64748b
```

Seeded defaults: **Maintenance, Raw materials, Packaging, Gas / fuel, Rent, Electricity** (each with a color).

---

## Client behaviour (`ExpensesClientPage.tsx`)
- Branch filter (managers pinned), date filter, and a running `totalFiltered` sum.
- Category names/colors resolved from `categories` table.
- Edit/delete controls render only for global admins (`isGlobalAdmin`).

---

## Business rules summary
1. One shared ledger, two sources (`eod`, `vendor`).
2. EOD expenses for a day are replaced wholesale on EOD save inside `withDbTransaction`; vendor expenses are independent.
3. Only global admins edit/delete ledger rows; deletes are permanent.
4. Categories are global and referenced by id.
5. All amounts are integers.
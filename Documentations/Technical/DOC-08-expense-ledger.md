# DOC-08 · Expense Ledger
**Version:** v2.0
**Last updated:** 2026-09-30
**Depends on:** DOC-01, DOC-02, DOC-03, DOC-04, DOC-07, DOC-11

---

## Overview

A single shared collection `expenses.json` is the source of truth for all expenses. Rows are created from two places and distinguished by a `source` field:

- **EOD entry** (`source: 'eod'`) — written by `saveEODEntry` (DOC-07). Insert/replace only from the EOD screen.
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

## Expense shape (see DOC-03)
```ts
type Expense = {
  id: string;            // exp_<uuid> (eod) | venexp_<uuid> (vendor)
  branchId: string;
  amount: number;        // integer
  categoryId: string;    // -> categories.json (ExpenseCategory)
  source: 'eod' | 'vendor';
  date: string;          // YYYY-MM-DD
  notes?: string;        // vendor bills embed "Vendor: <name> | Invoice: <ref>"
  createdAt: string;
  isPaid?: boolean;      // vendor bills only
}
```
Expenses reference a **category id**, not an embedded category object. There is no `dailyEntryId`, no `vendorName`/`invoiceRef` column, and no soft-delete flag — deletes are hard array removals.

---

## `updateExpense` (admins/owners only)

- Rejects non-global-admins with `Only admin and owner can edit ledger expenses.`
- Validates the patch with Zod: `amount` (int ≥ 0), `notes` (≤500), `date` (`YYYY-MM-DD`), `category` (≤100) — all optional.
- Preserves `id` and `branchId` (branch cannot be reassigned).
- Audit-logs `UPDATE_EXPENSE` with before/after amounts and revalidates `/management/expenses` and `/management/reports`.

## `deleteExpense` (admins/owners only)

- Splices the expense out of the array (hard delete).
- Audit-logs `DELETE_EXPENSE` and revalidates expenses + reports.

---

## Permissions matrix

| Action | admin | owner | manager | readonly |
|--------|:---:|:---:|:---:|:---:|
| Create via EOD | ✓ | ✓ | ✓ (own branch) | ✗ |
| Create via vendor bill | ✓ | ✓ | ✓ (own branch) | ✗ |
| Mark vendor bill paid | ✓ | ✓ | ✓ (own branch) | ✗ |
| Edit ledger expense | ✓ | ✓ | ✗ | ✗ |
| Delete ledger expense | ✓ | ✓ | ✗ | ✗ |
| View ledger | ✓ | ✓ | ✓ (own branch) | ✓ |

The EOD screen never edits or deletes expenses — it rewrites its own day's `source:'eod'` rows on save (DOC-07). Corrections to individual expenses happen on the Expenses screen (global admins) or, for vendor bills, via the Vendors screen.

---

## Expense categories (`categories.json`, `src/app/actions/categories.ts`)

Categories are **global** (not branch-scoped). Managed by global admins (`addCategory`, `updateCategory`, `deleteCategory` all check `isGlobalAdmin`).

```ts
type ExpenseCategory = { id: string; name: string; color?: string }  // cat_<uuid>, default color #64748b
```

Seeded defaults: **Maintenance, Raw materials, Packaging, Gas / fuel, Rent, Electricity** (each with a color). Categories are hard-deleted; because expenses store only `categoryId`, deleting a category leaves historical expense rows pointing at a missing id (the UI shows the id/"Unknown" if unresolved).

---

## Client behaviour (`ExpensesClientPage.tsx`)
- Branch filter (managers pinned), date filter, and a running `totalFiltered` sum.
- Category names/colors resolved from `categories`.
- Edit/delete controls render only for global admins (`isGlobalAdmin`).

---

## Business rules summary
1. One shared ledger, two sources (`eod`, `vendor`).
2. EOD expenses for a day are replaced wholesale on EOD save; vendor expenses are independent.
3. Only global admins edit/delete ledger rows; deletes are permanent.
4. Categories are global and referenced by id.
5. All amounts are integers.

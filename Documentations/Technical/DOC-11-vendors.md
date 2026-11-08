# DOC-11 · Vendor & Supplier Management
**Version:** v3.0
**Last updated:** 2026-11-02
**Status:** Implemented
**Depends on:** DOC-01, DOC-02, DOC-03, DOC-04, DOC-08

---

## Overview

Vendor management at `/management/vendors` (`VendorsClientPage.tsx`), backed by `src/app/actions/vendors.ts` over normalized PostgreSQL tables (`vendors`, `expenses`). It maintains supplier profiles and records **vendor bills**, which are written directly into the shared `expenses` table with `source: 'vendor'`. There is no separate "bills" collection and no separate purchase-order entity. There are no REST routes.

---

## Actions (`src/app/actions/vendors.ts`)

| Action | Signature | Notes |
|--------|-----------|-------|
| `addVendor` | `(prevState, formData)` | creates a vendor profile in `vendors` table; branch enforced; dedupe by name+branch |
| `addVendorBill` | `(prevState, formData)` | writes an `Expense` (`source: 'vendor'`) into the `expenses` table |
| `markVendorBillAsPaid` | `(id)` | sets `isPaid = true` on the expense; managers restricted to own branch |

Note: the Vendors module does **not** provide generic edit/delete of ledger expenses — that is the Expenses module and is admin/owner-only (DOC-08). Vendors only creates bills and flips their paid flag.

---

## Data shapes (see DOC-03 → `vendors` & `expenses` tables)
```ts
type Vendor = {
  id: string;        // ven_<uuid>
  branchId: string;
  name: string;
  phone: string;
  supplyType: string;
  createdAt: string;
}
```
A vendor bill is an `Expense` row in the `expenses` table:
```ts
{
  id: 'venexp_<uuid>',
  branchId, amount, categoryId,
  source: 'vendor',
  date,                       // YYYY-MM-DD
  notes: 'Vendor: <name> | Invoice: <ref>' | 'Vendor: <name>',
  isPaid: boolean,
  createdAt,
}
```
The vendor name and optional invoice reference are embedded into the expense `notes` string.

---

## Validation (Zod)

- `addVendorSchema`: `name` (1..100), `phone` (7..15, `/^[0-9+\-\s()]+$/`), `supplyType` (1..100), `branchId` (min 1).
- `addVendorBillSchema`: `vendorId` (min 1), `amount` (int ≥ 1), `categoryId` (min 1), `date` (`YYYY-MM-DD`), `branchId` (min 1), `invoiceRef?` (≤100).

`addVendorBill` accepts either `categoryId` or a legacy `category` form field, and reads `isPaid` from a checkbox (`on`). It revalidates `/management/vendors` and `/management/expenses`.

---

## Permissions

- Add vendor / add bill / mark paid: admin, owner, or manager (own branch).
- Editing or deleting the resulting ledger expense is admin/owner-only via the Expenses module (DOC-08).
- `readonly` and floor staff (`waiter`, `kitchen`, `billing`) cannot mutate.

---

## Client behaviour (`VendorsClientPage.tsx`)
- Branch selector (managers pinned), vendor search.
- Per vendor, bills are pulled from `expenses` where `source==='vendor'` and matched by the embedded vendor name; the UI computes `totalPaid` and `totalUnpaid` from `isPaid`.
- Unpaid bills can be marked paid inline.

---

## Business rules summary
1. Vendor profiles are per-branch.
2. Vendor bills are ordinary expense-ledger rows (`source: 'vendor'`) in the `expenses` table, keeping one shared ledger with the EOD flow.
3. Paid/unpaid is tracked via `isPaid` on the expense.
4. Correcting a vendor bill's amount/category (beyond paid flag) is done in the Expenses module by a global admin.
5. All amounts are integers; bill amount must be ≥ 1.
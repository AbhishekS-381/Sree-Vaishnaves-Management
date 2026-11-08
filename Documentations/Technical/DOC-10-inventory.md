# DOC-10 · Inventory & Stock
**Version:** v3.0
**Last updated:** 2026-11-02
**Status:** Implemented
**Depends on:** DOC-01, DOC-02, DOC-03, DOC-04

---

## Overview

Per-branch stock tracking at `/management/inventory` (`InventoryClientPage.tsx`), backed by `src/app/actions/inventory.ts` over normalized PostgreSQL tables (`inventory`, `stock_adjustments`). Tracks items with current integer quantities and low-stock thresholds, supported by an adjustment log. All updates are logged adjustments. There are no REST routes.

---

## Actions (`src/app/actions/inventory.ts`)

| Action | Signature | Notes |
|--------|-----------|-------|
| `addInventoryItem` | `(prevState, formData)` | creates an item; if starting quantity > 0, logs an "Initial Stock" increase adjustment inside `withDbTransaction` |
| `adjustStock` | `(prevState, formData)` | increase/decrease current quantity + atomic insert into `stock_adjustments` |
| `updateInventoryItem` | `(prevState, formData)` | edit name/unit/threshold (not quantity) |
| `deleteInventoryItem` | `(id)` | soft delete (`isActive=false`, `deletedAt = now`) |

All branch-bound actions run `requireBranchAccess`, so managers are confined to their branch.

---

## Validation (Zod)

- `addInventorySchema`: `name` (1..100), `unit` (1..20), `quantity` (int ≥ 0), `threshold` (int ≥ 0), `branchId` (min 1).
- `adjustStockSchema`: `itemId`, `branchId`, `type` (`'increase' | 'decrease'`), `amount` (int ≥ 1), `reason` (1..200).
- `updateInventorySchema`: `id`, `name`, `unit`, `threshold`, `branchId` (quantity is not editable directly — only via adjustments).

Suggested units: `kg, litre, packet, piece, gram, ml, box, bottle`. **Quantities are integers** (not decimals).

---

## Data shapes (see DOC-03 → `inventory` & `stock_adjustments` tables)
```ts
type InventoryItem = {
  id; branchId; name; unit;
  currentQuantity: number;  // integer
  threshold: number;
  updatedAt; isActive?; deletedAt?;
}
type StockAdjustment = {
  id; itemId; branchId;
  type: 'increase' | 'decrease';
  amount: number;           // integer >= 1
  reason: string;
  date: string;             // ISO timestamp
}
```

---

## Adjustment logic (`adjustStock`)

1. Validate input; enforce branch access.
2. Inside an atomic database transaction (`withDbTransaction`):
   - Find item in `inventory` table.
   - For a `decrease`, reject if `currentQuantity < amount` with `Not enough stock to decrease`.
   - Update `inventory.current_quantity` with `+amount` / `-amount` and update `updatedAt`.
   - Insert row into `stock_adjustments` recording item, branch, amount, type, reason, and date.

Duplicate guard on create/update: same lowercased `name` + `unit` within the same branch.

---

## Low-stock signal

An item is "low" when `currentQuantity <= threshold`. This is surfaced on the dashboard's pending actions (`⚠ N Low stock alert(s)`) when the inventory module is enabled (see DOC-13/DOC-14).

---

## Client behaviour (`InventoryClientPage.tsx`)
- Branch selector (managers pinned), search, add-item and adjust-stock modals.
- Low-stock rows are visually flagged with warning indicators.

---

## Business rules summary
1. Quantities are integers and only change through adjustments (audit trail in `stock_adjustments` table).
2. Decreases cannot take a quantity below zero.
3. Soft delete preserves the item and its adjustment history.
4. Branch scoping is enforced for managers.
5. Inventory adjustments remain logged manually (automatic deduction via POS recipe mapping is planned for a future phase).
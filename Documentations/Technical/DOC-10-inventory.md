# DOC-10 · Inventory & Stock
**Version:** v2.0
**Last updated:** 2026-09-30
**Status:** Implemented
**Depends on:** DOC-01, DOC-02, DOC-03, DOC-04

---

## Overview

Manual per-branch stock tracking at `/management/inventory` (`InventoryClientPage.tsx`), backed by `src/app/actions/inventory.ts`. Tracks items with a current quantity and a low-stock threshold, plus an adjustment log. All updates are manual — there is no auto-deduction. There are no REST routes.

---

## Actions (`src/app/actions/inventory.ts`)

| Action | Signature | Notes |
|--------|-----------|-------|
| `addInventoryItem` | `(prevState, formData)` | creates an item; if starting quantity > 0, logs an "Initial Stock" increase adjustment |
| `adjustStock` | `(prevState, formData)` | increase/decrease current quantity + writes a `stock_adjustments` row |
| `updateInventoryItem` | `(prevState, formData)` | edit name/unit/threshold (not quantity) |
| `deleteInventoryItem` | `(id)` | soft delete (`isActive=false`, `deletedAt`) |

All branch-bound actions run `requireBranchAccess`, so managers are confined to their branch.

---

## Validation (Zod)

- `addInventorySchema`: `name` (1..100), `unit` (1..20), `quantity` (int ≥ 0), `threshold` (int ≥ 0), `branchId` (min 1).
- `adjustStockSchema`: `itemId`, `branchId`, `type` (`'increase' | 'decrease'`), `amount` (int ≥ 1), `reason` (1..200).
- `updateInventorySchema`: `id`, `name`, `unit`, `threshold`, `branchId` (quantity is not editable directly — only via adjustments).

Suggested units: `kg, litre, packet, piece, gram, ml, box, bottle`. **Quantities are integers** (not decimals).

---

## Data shapes (see DOC-03)
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

1. Validate; enforce branch.
2. Under a lock on `inventory.json`: find the item; for a `decrease`, reject if `currentQuantity < amount` (`Not enough stock to decrease`); otherwise apply `+amount` / `-amount` and bump `updatedAt`.
3. In a second transaction, append a `stock_adjustments` row recording the change and reason.

Duplicate guard on create/update: same lowercased `name` + `unit` within the same branch.

---

## Low-stock signal

An item is "low" when `currentQuantity <= threshold`. This is surfaced on the dashboard's pending actions (`⚠ N Low stock alert(s)`) when the inventory module is enabled (see DOC-13/DOC-14). A threshold behaviour of "no alert" can be approximated with a threshold of 0 only if quantity is also 0; there is no explicit disable flag.

---

## Client behaviour (`InventoryClientPage.tsx`)
- Branch selector (managers pinned), search, add-item and adjust-stock modals.
- Low-stock rows are visually flagged.

---

## Business rules summary
1. Quantities are integers and only change through adjustments (audit trail via `stock_adjustments`).
2. Decreases cannot take a quantity below zero.
3. Soft delete preserves the item and its adjustment history.
4. Branch scoping is enforced for managers.
5. No automatic deduction from sales/menu (no POS in this codebase).

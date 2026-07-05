# DOC-10 · Inventory & Stock
**Version:** v1.0  
**Last updated:** 2026-03-15  
**Phase:** 2 (6–12 months)  
**Depends on:** DOC-01, DOC-02, DOC-03

---

## Overview

Manual stock tracking per branch. Tracks ingredients and supplies with current quantity and low-stock thresholds. No auto-deduction in Phase 2 — all updates are manual. Auto-deduction from POS orders is Phase 4.

---

## API routes

| Method | Route | Role | Description |
|--------|-------|------|-------------|
| GET | `/api/v1/branches/:branchId/inventory` | owner, branch_manager | List all stock items |
| GET | `/api/v1/branches/:branchId/inventory/:id` | owner, branch_manager | Get single item with history |
| POST | `/api/v1/branches/:branchId/inventory` | owner, branch_manager | Add new stock item |
| PUT | `/api/v1/branches/:branchId/inventory/:id` | owner, branch_manager | Update item details |
| POST | `/api/v1/branches/:branchId/inventory/:id/adjust` | owner, branch_manager | Add or reduce stock quantity |
| DELETE | `/api/v1/branches/:branchId/inventory/:id` | owner | Soft delete item |

### Query params
- `?lowStock=true` — return only items below threshold
- `?search=tomato` — search by name

---

## Database tables (Phase 2 additions)

```sql
CREATE TABLE stock_items (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id         UUID NOT NULL REFERENCES branches(id),
  name              VARCHAR(150) NOT NULL,
  unit              VARCHAR(20) NOT NULL,
  -- e.g. 'kg', 'litres', 'pieces', 'packets'
  current_quantity  NUMERIC(10,2) NOT NULL DEFAULT 0,
  low_stock_threshold NUMERIC(10,2) NOT NULL DEFAULT 0,
  isActive         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deletedAt        TIMESTAMPTZ DEFAULT NULL
);

CREATE TABLE stock_adjustments (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id     UUID NOT NULL REFERENCES branches(id),
  stock_item_id UUID NOT NULL REFERENCES stock_items(id),
  type          VARCHAR(10) NOT NULL CHECK (type IN ('add', 'reduce')),
  quantity      NUMERIC(10,2) NOT NULL CHECK (quantity > 0),
  reason        VARCHAR(255),
  -- e.g. 'purchased from vendor', 'daily usage', 'spoilage'
  created_by    UUID NOT NULL REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## Stock adjustment logic

When an adjustment is recorded:
1. Insert row into `stock_adjustments`
2. Update `stock_items.current_quantity`:
   - `add` → `current_quantity + quantity`
   - `reduce` → `current_quantity - quantity` (floor at 0, warn if going negative)
3. If `current_quantity` drops below `low_stock_threshold` after adjustment → trigger in-app low-stock alert (DOC-14)

---

## Low stock alert rules

- Alert is shown on the dashboard when any item's `current_quantity <= low_stock_threshold`
- Alert is per-branch — branch manager sees alerts for their branch, owner sees alerts for all branches
- Alert resolves automatically when quantity is updated above threshold

---

## Business rules

1. Quantities use `NUMERIC(10,2)` to support items measured in decimals (e.g. 2.5 kg)
2. Quantity cannot be manually set to a value — it is always changed via adjustments (audit trail)
3. Low stock threshold of 0 means "no alert" — effectively disabled for that item
4. Soft delete only — deleted items preserve their adjustment history

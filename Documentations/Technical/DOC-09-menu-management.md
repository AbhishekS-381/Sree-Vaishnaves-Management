# DOC-09 · Menu Management
**Version:** v4.0 (RDBMS Normalized)
**Last updated:** 2026-11-02
**Depends on:** DOC-01, DOC-02, DOC-03, DOC-04

---

## Overview

Menu management operates on a **global catalog with per-branch overrides** persisted across 6 normalized PostgreSQL relational tables (`menu_items`, `menu_categories`, `menu_item_variants`, `branch_menu_items`, `branch_categories`, `menu_price_history`). Managed at `/management/menu` (`MenuClientPage.tsx`) via `src/app/actions/menu.ts` and `src/app/actions/menu_categories.ts`. All server logic runs as Server Actions — no REST.

Menu categories are also reused as **chef specialties** in the Staff module, and the catalog directly feeds live order-taking in the **POS module**.

---

## Storage: Normalized Relational Tables

Legacy file sharding and `menuMigration.ts` have been fully retired in favor of native PostgreSQL tables:

| Table | Purpose & Key Columns |
|---|---|
| `menu_items` | Global items catalog: `id`, `name`, `categoryId`, `basePrice`, `sortOrder`, `isActive`, metadata (JSONB `dietary`, `allergens`, `availability`, etc.) |
| `menu_categories` | Global item categories: `id`, `name`, `sortOrder`, `isActive` |
| `menu_item_variants` | Size/portion variants: `id`, `menuItemId`, `name`, `basePrice`, `sortOrder`, `isActive` |
| `branch_menu_items` | Per-branch overrides: `id`, `branchId`, `menuItemId`, `variantId`, `price` (null = inherit base), `isAvailable` (unique index `bmi_branch_item_variant_uniq`) |
| `branch_categories` | Per-branch category availability: `id`, `branchId`, `categoryId`, `isAvailable` |
| `menu_price_history` | Audit log of price changes: `id`, `menuItemId`, `variantId`, `branchId`, `scope`, `oldPrice`, `newPrice`, `changedBy`, `changedAt` |

Database-level indexes (`bmi_branch_idx`, `bmi_menu_item_idx`, `bmi_branch_item_variant_uniq`) guarantee fast lookups and prevent duplicate overrides. Multi-table writes (such as creating an item and seeding its branch mappings) execute atomically via `withDbTransaction`.

---

## Resolution semantics (`src/lib/menuResolver.ts`)

**Effective price**
```
base  = variant.basePrice ?? item.basePrice
price = branchOverride.price ?? base      // null override = inherit, not free
```
Writing a branch price equal to the base stores `null`, reverting to inheriting the base catalog price.

**Effective availability** — a conjunction; any false wins:
```
item.isActive AND branchCategory.isAvailable AND branchItem.isAvailable
AND withinWindow(item.availability, now)
```
`withinWindow` returns **true when no window is set** (opt-in), matches on day-of-week, and supports **overnight wrap-around** (e.g. 22:00 → 02:00). `start === end` is treated as all-day.

**Margin** — `computeMargin(price, costPrice)` → `{ profit, foodCostPct }`, or `null` when cost is unknown or price ≤ 0.

**Bulk price maths** — `applyPriceChange(current, 'percent'|'flat'|'set', value)`, rounded to whole rupees and floored at 0.

---

## Actions

### Catalog (global admins only — `isGlobalAdmin`)
| Action | Notes |
|---|---|
| `addMenuItem(prevState, formData)` | creates item and seeds mappings in `branch_menu_items` for all active branches inside `withDbTransaction` |
| `updateMenuItem(prevState, formData)` | edit name/category/basePrice + metadata; logs price history on change; returns warning if category changed |
| `deleteMenuItem(id)` | soft delete (`isActive: false`, `deletedAt = now`); branch mappings preserved |
| `restoreMenuItem(id)` | un-archives soft-deleted items |
| `reorderMenuItems(categoryId, orderedIds)` | atomic write updating `sortOrder` across items |
| `addVariant` / `updateVariant` / `deleteVariant` | portion variants; duplicate names per item rejected; soft delete |

### Category (global admins only)
`addMenuCategory`, `updateMenuCategory`, `deleteMenuCategory` (soft delete), and **`reorderMenuCategories(orderedIds)`** — single atomic write.

### Branch config (managers may edit own branch, global admins any)
| Action | Notes |
|---|---|
| `setBranchItemAvailability(branchId, menuItemId, isAvailable, variantId?)` | upserts branch override row |
| `updateBranchMenuItemPrice(branchId, menuItemId, price\|null, variantId?)` | upserts branch price + logs to `menu_price_history` |
| `bulkSetBranchAvailability(branchId, itemIds[], isAvailable)` | batch upsert inside `withDbTransaction` |
| `bulkUpdateBranchPrices(branchId, itemIds[], mode, value)` | batch price updates + history logs |
| `cloneBranchMenuConfig(from, to, { prices, availability })` | copies source branch config to target branch |

All branch actions run `requireBranchAccess`, returning `Forbidden` if a manager targets another branch.

### Audit
Every menu mutation calls `logAction` to write an audit entry to the `audit_logs` table.

---

## Permissions

| Capability | admin | owner | manager | readonly | waiter | kitchen | billing |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Catalog CRUD, variants, categories, reorder, restore | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Cost price / margin (view & edit) | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Branch price + availability (incl. bulk, clone) | ✓ | ✓ | ✓ own | ✗ | ✗ | ✗ | ✗ |
| View menu catalog | ✓ | ✓ | ✓ own | ✓ | ✓ own | ✓ own | ✓ own |
| Export CSV (cost columns for global admins only) | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |

---

## UI (`MenuClientPage.tsx`)

Four tabs (Matrix / Categories / Archive are admin-only):

1. **Menu** — branch selector, search, filter panel, sort, collapsible category sections, multi-select `BulkActionBar`. Cards display Base/Override badge, On/Off toggle, variant rows, and badges for Timed / Signature / dietary / food-cost %.
2. **Price Matrix** — item × branch grid with price and availability indicator, sticky first column.
3. **Categories** — add/edit/archive + atomic reordering.
4. **Archive** — soft-deleted items with **Restore** action.

Supporting behaviour:
- **Optimistic updates** (`useMenuResolver` + optimistic overlay) apply instantly with toast rollback on failure.
- **`PriceEditor` commits on blur** as well as Enter.
- **Export** — browser-built CSV; cost columns restricted to global admins.
- **Performance** — when catalog exceeds 150 items, unexpanded categories auto-collapse to optimize rendering.

---

## Business rules summary
1. Items and categories are **global**; price and availability are **per-branch overrides** stored in `branch_menu_items` / `branch_categories`.
2. Creating an item seeds availability mappings for every active branch.
3. Deleting is a soft delete and preserves branch mappings; restore is available in the Archive tab.
4. Only global admins manage the catalog; managers manage their own branch's price/availability.
5. A branch price equal to base is stored as `null` (inherit).
6. Availability windows are opt-in and support overnight ranges.
7. Cost price and margin are restricted to global admins.
8. Every mutation is audited; every price change is written to `menu_price_history`.
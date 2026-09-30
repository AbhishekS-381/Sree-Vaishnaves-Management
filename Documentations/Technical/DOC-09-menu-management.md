# DOC-09 · Menu Management
**Version:** v3.0 (Menu v2)
**Last updated:** 2026-09-30
**Depends on:** DOC-01, DOC-02, DOC-03, DOC-04

---

## Overview

Menu management uses a **global catalog with per-branch overrides**. Two global collections (items, categories) plus optional **variants**, and two per-branch override collections (item availability/price, category availability). Managed at `/management/menu` (`MenuClientPage.tsx`) via `src/app/actions/menu.ts` and `src/app/actions/menu_categories.ts`. All server logic is Server Actions — no REST.

Menu categories are also reused as **chef specialties** in the Staff module.

---

## Storage: per-branch sharding

Branch overrides are **sharded per branch**: `branch_menu_items_<branchId>.json` (one `json_store` row per branch), instead of one combined blob.

Rationale: flipping a single availability flag previously rewrote the entire item × branch cross-product. Sharding cuts write volume proportionally to branch count and gives each branch **its own mutex**, so two managers editing different branches can no longer clobber each other.

Helpers in `src/lib/db.ts`:
| Helper | Purpose |
|---|---|
| `branchMenuItemsFile(branchId)` | shard filename |
| `readBranchMenuItems(branchId)` | shard-first read, **falls back to the legacy blob** for unmigrated branches |
| `withBranchMenuTransaction(branchId, cb)` | transaction on one shard; **lazily seeds** the shard from legacy on first write |

**Migration** — `src/lib/menuMigration.ts` → `migrateBranchMenuItemsToShards()` (admin/owner only):
- Groups the legacy blob by branch and writes each shard, verifying row counts.
- **Idempotent:** a branch whose shard already has rows is *skipped*, never overwritten.
- **Non-destructive:** the legacy blob is retained so the read-through fallback and rollback both keep working.
- Audit-logged as `MIGRATE_BRANCH_MENU_SHARDS`.

---

## Collections (see DOC-03)

| File | Shape |
|---|---|
| `menu.json` | global `MenuItem` + optional metadata (below) |
| `menu_categories.json` | global `MenuCategory` |
| `menu_item_variants.json` | `MenuItemVariant { id, menuItemId, name, basePrice, sortOrder, isActive }` |
| `branch_menu_items_<branchId>.json` | `BranchMenuItem { id, branchId, menuItemId, variantId?, price\|null, isAvailable }` |
| `branch_categories.json` | `BranchMenuCategory { id, branchId, categoryId, isAvailable }` |
| `menu_price_history.json` | `MenuPriceChange` (append-only, capped at 5000) |

### Optional item metadata (all nullable — existing items unaffected)
`description`, `imageUrl`, `costPrice`, `dietary[]` (`jain` / `no-onion-garlic` / `vegan` / `contains-dairy`), `spiceLevel` (0–3), `allergens[]`, `isSignature`, `prepTimeMins`, `availability { days?, startTime?, endTime? }`.

---

## Resolution semantics (`src/lib/menuResolver.ts` — pure, 100% test coverage)

**Effective price**
```
base  = variant.basePrice ?? item.basePrice
price = branchOverride.price ?? base      // null override = inherit, not free
```
Writing a branch price equal to the base stores `null`, i.e. it reverts to inheriting.

**Effective availability** — a conjunction; any false wins:
```
item.isActive AND branchCategory.isAvailable AND branchItem.isAvailable
AND withinWindow(item.availability, now)
```
`withinWindow` returns **true when no window is set** (opt-in), matches on day-of-week, and supports **overnight wrap-around** (e.g. 22:00 → 02:00). `start === end` is treated as all-day.

**Margin** — `computeMargin(price, costPrice)` → `{ profit, foodCostPct }`, or `null` when cost is unknown or price ≤ 0.

**Bulk price maths** — `applyPriceChange(current, 'percent'|'flat'|'set', value)`, rounded to whole rupees and floored at 0.

> **Not implemented:** scheduled / effective-dated pricing was explicitly descoped. Price *history* is recorded, but there is no future-dated price.

---

## Actions

### Catalog (global admins only — `isGlobalAdmin`)
| Action | Notes |
|---|---|
| `addMenuItem(prevState, formData)` | creates the item, then seeds a mapping in **each active branch's shard** |
| `updateMenuItem(prevState, formData)` | **new in v2** — edit name/category/basePrice + all optional metadata; records base price history; returns a `warning` when the category changed (chef specialty may need review) |
| `deleteMenuItem(id)` | soft delete; branch mappings deliberately preserved |
| `restoreMenuItem(id)` | **new** — un-archives |
| `reorderMenuItems(categoryId, orderedIds)` | **new** — one atomic write, `sortOrder = index` |
| `addVariant` / `updateVariant` / `deleteVariant` | **new** — optional portions; duplicate names per item rejected; delete is soft |

### Category (global admins only)
`addMenuCategory`, `updateMenuCategory`, `deleteMenuCategory` (soft), and **`reorderMenuCategories(orderedIds)`** — a single atomic write that replaces the previous two-call `sortOrder` swap (which could corrupt ordering if the second call failed).

### Branch config (**managers may edit their own branch**, global admins any)
| Action | Notes |
|---|---|
| `setBranchItemAvailability(branchId, menuItemId, isAvailable, variantId?)` | shard write |
| `updateBranchMenuItemPrice(branchId, menuItemId, price\|null, variantId?)` | shard write + price history |
| `bulkSetBranchAvailability(branchId, itemIds[], isAvailable)` | **new** — one transaction, returns `changed` count |
| `bulkUpdateBranchPrices(branchId, itemIds[], mode, value)` | **new** — `percent`/`flat`/`set` off each item's effective base |
| `cloneBranchMenuConfig(from, to, { prices, availability })` | **new** — copy one branch's config onto another (access is checked against the **target**) |

All branch actions run `requireBranchAccess`, so a manager targeting another branch gets `Forbidden`.

### Contract change
`setBranchItemAvailability`, `updateBranchMenuItemPrice` and `setBranchCategoryAvailability` previously returned `void` on success, so failures were invisible. They now return **`{ success: true } | { error }`**, and the UI surfaces errors via a toast.

### Audit
**Every** menu mutation now calls `logAction` (`CREATE_MENU_ITEM`, `UPDATE_MENU_ITEM`, `DELETE_MENU_ITEM`, `RESTORE_MENU_ITEM`, `REORDER_MENU_ITEMS`, `*_MENU_VARIANT`, `SET_MENU_AVAILABILITY`, `UPDATE_BRANCH_PRICE`, `BULK_*`, `CLONE_BRANCH_MENU_CONFIG`, `*_MENU_CATEGORY`, `SET_CATEGORY_AVAILABILITY`). Previously none did.

---

## Permissions

| Capability | admin | owner | manager | readonly |
|---|:-:|:-:|:-:|:-:|
| Catalog CRUD, variants, categories, reorder, restore | ✓ | ✓ | ✗ | ✗ |
| **Cost price / margin (view & edit)** | ✓ | ✓ | ✗ | ✗ |
| Branch price + availability (incl. bulk, clone) | ✓ | ✓ | ✓ own branch | ✗ |
| Export CSV (cost columns only for global admins) | ✓ | ✓ | ✓ | ✓ |

---

## UI (`MenuClientPage.tsx`)

Four tabs (Matrix / Categories / Archive are admin-only):

1. **Menu** — branch selector, search, filter panel (availability, category, overridden-only), sort (menu order / name / price), collapsible category sections, multi-select → `BulkActionBar`. Cards show price with Base/Override badge, On/Off, variant rows with their own price editors, and badges for Timed / Signature / dietary / food-cost %.
2. **Price Matrix** — item × branch grid with **price *and* an availability dot** per cell, sticky first column.
3. **Categories** — add/edit/archive + reorder (atomic).
4. **Archive** — soft-deleted items with **Restore**.

Supporting behaviour:
- **Optimistic updates** (`useMenuResolver` + a local optimistic overlay): toggles and price edits apply instantly and **revert with a toast** if the action fails. Toggles no longer trigger a full-page revalidate.
- **`PriceEditor` commits on blur** as well as Enter (it previously discarded the edit silently).
- **Export** — CSV built in-browser (no new dependency); cost columns included only for global admins.
- **Performance** — when the catalog exceeds 150 items, all categories except the first auto-collapse; collapsed sections don't render cards.

---

## Business rules summary
1. Items and categories are **global**; price and availability are **per-branch overrides** stored in per-branch shards.
2. Creating an item seeds availability mappings for every active branch.
3. Deleting is a soft delete and preserves branch mappings; restore is available in the Archive tab.
4. Only global admins manage the catalog; managers manage their own branch's price/availability, including bulk and clone.
5. A branch price equal to the base is stored as `null` (inherit).
6. Availability windows are opt-in and support overnight ranges.
7. Cost price and margin are restricted to global admins.
8. Every mutation is audited; every price change is also written to price history.

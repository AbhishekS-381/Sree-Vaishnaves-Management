# DOC-09 · Menu Management
**Version:** v2.0
**Last updated:** 2026-09-30
**Depends on:** DOC-01, DOC-02, DOC-03, DOC-04

---

## Overview

Menu management uses a **global catalog with per-branch overrides**, not a per-branch menu. There are two global collections (menu items and menu categories) and two per-branch override collections (availability + price). Managed at `/management/menu` (`MenuClientPage.tsx`) via `src/app/actions/menu.ts` and `src/app/actions/menu_categories.ts`. There are no REST routes.

Menu categories are also reused as **chef specialties** in the Staff module (a chef role's `specialtyId` points at a menu category).

---

## Collections (see DOC-03)

- `menu.json` — global `MenuItem` (name, `categoryId`, `basePrice`, `sortOrder`, `isActive`).
- `menu_categories.json` — global `MenuCategory` (name, `sortOrder`, `isActive`).
- `branch_menu_items.json` — per-branch `BranchMenuItem` (`price: number|null`, `isAvailable`).
- `branch_categories.json` — per-branch `BranchMenuCategory` (`isAvailable`).

Effective price for a branch = the branch override `price` if set, else the item's `basePrice`. Effective availability = the branch mapping's `isAvailable` if a mapping exists, else defaults to available.

---

## Menu item actions (`src/app/actions/menu.ts`)

| Action | Signature | Auth | Notes |
|--------|-----------|------|-------|
| `addMenuItem` | `(prevState, formData)` | `isGlobalAdmin` | creates the global item, then auto-creates `branch_menu_items` mappings for every active branch |
| `deleteMenuItem` | `(id)` | `isGlobalAdmin` | soft delete (`isActive=false`); branch mappings are **kept** to preserve history |
| `setBranchItemAvailability` | `(branchId, menuItemId, isAvailable)` | session; managers scoped to own branch | upserts the branch mapping |
| `updateBranchMenuItemPrice` | `(branchId, menuItemId, price\|null)` | session; managers scoped to own branch | upserts the branch mapping's price |

`addMenuItemSchema` (Zod): `name` (1..150, trimmed), `categoryId` (min 1), `basePrice` (int ≥ 0). Duplicate guard: same lowercased name within the same category (active items).

When an item is created, a `BranchMenuItem` is inserted for each active branch with `price: null` and `isAvailable` following the `isAvailableGlobally` flag from the form.

---

## Menu category actions (`src/app/actions/menu_categories.ts`)

| Action | Signature | Auth | Notes |
|--------|-----------|------|-------|
| `addMenuCategory` | `(prevState, formData)` | `isGlobalAdmin` | dedupe on active name |
| `updateMenuCategory` | `(prevState, formData)` | `isGlobalAdmin` | rename / reorder |
| `deleteMenuCategory` | `(id)` | `isGlobalAdmin` | soft delete |
| `setBranchCategoryAvailability` | `(branchId, categoryId, isAvailable)` | session; managers scoped to own branch | upserts branch category mapping |

Category mutations revalidate `/management/settings`, `/management/menu`, and `/management/staff` (because categories double as chef specialties).

---

## Permissions

- **Global catalog** (create/edit/delete items and categories): global admins only (`isGlobalAdmin`).
- **Per-branch availability & price overrides:** any authenticated user, but managers are restricted to their own `branchId` (`Forbidden` otherwise).
- `readonly` users can view but not mutate.

---

## Client behaviour (`MenuClientPage.tsx`, `useMenuFilters`)
- Branch selector determines which override set is applied.
- `useMenuFilters` enriches each active menu item with its branch price/availability, groups items by category name, and supports text search over item + category names.
- Managers receive only their branch's override mappings from the page loader; the global item/category lists remain visible.

---

## Business rules summary
1. Menu items and categories are **global**; price and availability are **per-branch overrides**.
2. Creating an item seeds availability mappings for all active branches.
3. Deleting an item is a soft delete; branch mappings are intentionally preserved.
4. Only global admins manage the catalog; managers only flip their branch's availability/price.
5. Menu categories are reused as chef specialties in the Staff module.
6. `basePrice` and override prices are integers (price may be `null` to fall back to base).

# DOC-09 · Menu Management
**Version:** v1.0  
**Last updated:** 2026-03-15  
**Phase:** 1  
**Depends on:** DOC-01, DOC-02, DOC-03

---

## Overview

Simple per-branch menu management. Items have a name, category, price, and availability toggle. No modifiers, variants, or combos in Phase 1. Menu data is primarily used as a reference and will feed into POS (Phase 4) and inventory cost tracking (Phase 2).

---

## API routes

| Method | Route | Role | Description |
|--------|-------|------|-------------|
| GET | `/api/v1/branches/:branchId/menu` | owner, branch_manager | List all menu items |
| GET | `/api/v1/branches/:branchId/menu/:id` | owner, branch_manager | Get single menu item |
| POST | `/api/v1/branches/:branchId/menu` | owner, branch_manager | Add new item |
| PUT | `/api/v1/branches/:branchId/menu/:id` | owner, branch_manager | Update item |
| PATCH | `/api/v1/branches/:branchId/menu/:id/availability` | owner, branch_manager | Toggle availability |
| DELETE | `/api/v1/branches/:branchId/menu/:id` | owner | Soft delete item |

### Query params for GET menu
- `?category=lunch` — filter by category
- `?available=true` — show only available items
- `?search=dosa` — search by name

---

## Menu item request body

```json
{
  "name": "Masala Dosa",
  "category": "breakfast",
  "price": 60,
  "isAvailable": true
}
```

---

## Menu item response

```json
{
  "id": "uuid",
  "branchId": "uuid",
  "name": "Masala Dosa",
  "category": "breakfast",
  "price": 60,
  "isAvailable": true,
  "createdAt": "2026-01-01T10:00:00Z",
  "updatedAt": "2026-03-10T08:00:00Z"
}
```

---

## Menu categories

Categories are free-text strings stored on the item — not a separate lookup table in Phase 1. Suggested values:

`breakfast`, `lunch`, `dinner`, `beverages`, `specials`, `sides`, `desserts`

The frontend provides these as suggestions but allows custom values.

---

## Availability toggle

`PATCH /menu/:id/availability` toggles `is_available` to the opposite of its current value. Fast endpoint for the common action of marking items as sold out.

```json
PATCH /api/v1/branches/:branchId/menu/:id/availability
{}  // No body needed — just flips the current value
```

Response includes the new `isAvailable` value.

---

## Grouped response (for frontend display)

When listing menu items, the API can optionally return items grouped by category:

`?grouped=true`

```json
{
  "success": true,
  "data": {
    "breakfast": [
      { "id": "uuid", "name": "Masala Dosa", "price": 60, "isAvailable": true },
      { "id": "uuid", "name": "Idli Sambar", "price": 40, "isAvailable": true }
    ],
    "lunch": [
      { "id": "uuid", "name": "Meals", "price": 120, "isAvailable": true }
    ]
  }
}
```

---

## Validation schema (Zod)

```js
const menuItemSchema = z.object({
  name: z.string().min(2).max(150),
  category: z.string().min(2).max(100),
  price: z.number().int().min(0),
  isAvailable: z.boolean().default(true)
})
```

---

## Business rules

1. Items are per-branch — Branch 1 and Branch 2 can have different menus and prices
2. Soft delete only — deleted items are hidden from all views but preserved in DB
3. Price of 0 is allowed — for complimentary items
4. `isAvailable = false` means the item is temporarily sold out — it appears greyed out in the menu list with a clear indicator
5. No limit on number of items per branch

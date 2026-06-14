# DOC-08 · Expense Ledger
**Version:** v1.0  
**Last updated:** 2026-03-15  
**Phase:** 1  
**Depends on:** DOC-01, DOC-02, DOC-03

---

## Overview

A single shared `expenses` table is the source of truth for all expenses. Expenses can be entered from two places:

- **EOD entry screen** — quick daily logging, insert only, source = `'eod'`
- **Vendor management screen** (Phase 2) — full CRUD, source = `'vendor'`

Both screens read from and write to the same table. No syncing needed — it's one table.

---

## API routes

| Method | Route | Role | Description |
|--------|-------|------|-------------|
| GET | `/api/v1/branches/:branchId/expenses` | owner, branch_manager | List expenses with filters |
| GET | `/api/v1/branches/:branchId/expenses/:id` | owner, branch_manager | Get single expense |
| POST | `/api/v1/branches/:branchId/expenses` | owner, branch_manager | Add expense (EOD or vendor) |
| PUT | `/api/v1/branches/:branchId/expenses/:id` | owner, branch_manager | Update expense |
| DELETE | `/api/v1/branches/:branchId/expenses/:id` | owner | Soft delete |
| GET | `/api/v1/expense-categories` | owner, branch_manager | List all active categories |
| POST | `/api/v1/expense-categories` | owner | Add custom category |

### Expense list query params
- `?date=2026-03-15` — expenses for a specific date
- `?month=2026-03` — expenses for a month
- `?categoryId=uuid` — filter by category
- `?source=eod` or `?source=vendor` — filter by origin

---

## Create expense request body

```json
{
  "date": "2026-03-15",
  "dailyEntryId": "uuid-or-null",
  "categoryId": "uuid",
  "amount": 4500,
  "vendorName": null,
  "invoiceRef": null,
  "source": "eod",
  "notes": null
}
```

- `dailyEntryId` — link to the day's EOD entry. Should be provided when creating from EOD screen. Can be null for vendor-side entries that don't yet have an EOD entry.
- `source` — must be `'eod'` when called from EOD screen, `'vendor'` when called from vendor screen. The API does not restrict operations by source — it is metadata only.
- `vendorName` and `invoiceRef` are null for EOD quick entries, populated in vendor management

---

## Expense response

```json
{
  "id": "uuid",
  "branchId": "uuid",
  "dailyEntryId": "uuid",
  "date": "2026-03-15",
  "category": {
    "id": "uuid",
    "name": "Raw materials",
    "color": "#2D7A4F"
  },
  "amount": 4500,
  "vendorName": null,
  "invoiceRef": null,
  "source": "eod",
  "notes": null,
  "createdBy": "Owner Name",
  "createdAt": "2026-03-15T17:30:00Z",
  "updatedAt": "2026-03-15T17:30:00Z",
  "deletedAt": null
}
```

---

## Permissions matrix

| Action | EOD screen | Vendor screen | Owner | Branch manager |
|--------|-----------|---------------|-------|---------------|
| Insert | Yes | Yes | Yes | Yes |
| Update | No | Yes | Yes | Yes |
| Soft delete | No | Yes | Yes | No |

The frontend enforces "insert only" on the EOD screen by not rendering edit/delete controls. The API does not restrict by source — it trusts the frontend separation. If needed in future, add source-based middleware.

---

## EOD screen shows vendor expenses too

When the EOD screen loads for a date, it fetches **all expenses for that date** (regardless of source) and displays them. This prevents double entry — if a vendor bill was already recorded, it appears in the EOD expense list.

The EOD screen clearly labels the source:
- `source = 'eod'` → no label (normal)
- `source = 'vendor'` → badge "From vendor"

Expenses from vendor source shown in EOD are read-only on the EOD screen. User is shown "Edit in vendor management" if they try to change it.

---

## Expense categories

Default categories are seeded on first deployment. Owner can add custom categories.

Categories are **global** — not branch-scoped. All branches share the same category list.

### Default categories
| Name | Color | is_default |
|------|-------|-----------|
| Raw materials | #2D7A4F | true |
| Gas / fuel | #C85C1A | true |
| Electricity | #1A6BC8 | true |
| Rent | #7A2D6A | true |
| Salary advance | #C8991A | true |
| Maintenance | #4A7A2D | true |
| Miscellaneous | #5F5E5A | true |

`is_default = true` means the category appears as a quick-tap tag on the EOD screen.

---

## Validation schema (Zod)

```js
const createExpenseSchema = z.object({
  date: z.string().date(),
  dailyEntryId: z.string().uuid().optional().nullable(),
  categoryId: z.string().uuid(),
  amount: z.number().int().positive(),
  vendorName: z.string().max(100).optional().nullable(),
  invoiceRef: z.string().max(100).optional().nullable(),
  source: z.enum(['eod', 'vendor']),
  notes: z.string().max(500).optional().nullable()
})

const createCategorySchema = z.object({
  name: z.string().min(2).max(100),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  isDefault: z.boolean().default(false),
  sortOrder: z.number().int().min(0).default(99)
})
```

---

## Error codes specific to expenses

| Code | Meaning |
|------|---------|
| `EXPENSE_NOT_FOUND` | Expense ID not found or already deleted |
| `CATEGORY_NOT_FOUND` | Category ID not found or inactive |
| `ENTRY_LOCKED` | Trying to add/edit expense linked to a locked EOD entry |

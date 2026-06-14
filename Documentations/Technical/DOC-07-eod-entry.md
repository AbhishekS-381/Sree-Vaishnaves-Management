# DOC-07 · EOD Daily Entry
**Version:** v1.0  
**Last updated:** 2026-03-15  
**Phase:** 1  
**Depends on:** DOC-01, DOC-02, DOC-03, DOC-08

---

## Overview

The End-of-Day entry is filled once per day per branch, typically by the owner or manager after closing. It captures income (split by dine-in/takeaway and cash/UPI), expenses (shared with vendor ledger), and an optional petty cash reconciliation. It must be fast to fill — designed to take under 2 minutes on a phone.

---

## API routes

| Method | Route | Role | Description |
|--------|-------|------|-------------|
| GET | `/api/v1/branches/:branchId/eod` | owner, branch_manager | List EOD entries (paginated, filtered by month) |
| GET | `/api/v1/branches/:branchId/eod/:date` | owner, branch_manager | Get a single day's EOD entry with expenses |
| POST | `/api/v1/branches/:branchId/eod` | owner, branch_manager | Create EOD entry for a date |
| PUT | `/api/v1/branches/:branchId/eod/:date` | owner, branch_manager | Update EOD entry (within edit window) |
| POST | `/api/v1/branches/:branchId/eod/:date/lock` | owner | Manually lock an entry before 24hr window |
| POST | `/api/v1/branches/:branchId/eod/:date/unlock` | owner | Unlock a locked entry |

---

## Create / update request body

```json
{
  "date": "2026-03-15",
  "dineinCash": 8500,
  "dineinUpi": 12000,
  "takeawayCash": 3200,
  "takeawayUpi": 4800,
  "pettyCashOpening": 2000,
  "pettyCashClosing": 1350,
  "notes": "Power cut for 2 hours in the evening. Took longer than usual to close.",
  "isHoliday": false
}
```

**Rules:**
- `date` must not be in the future
- All income fields default to 0 if omitted
- `pettyCashOpening` and `pettyCashClosing` are optional — omit to skip petty cash tracking for the day
- `isHoliday = true` sets income expectation to 0 — all income fields should be 0. Validate and warn if non-zero income is submitted with `isHoliday = true`

---

## EOD entry response

```json
{
  "id": "uuid",
  "branchId": "uuid",
  "date": "2026-03-15",
  "dineinCash": 8500,
  "dineinUpi": 12000,
  "takeawayCash": 3200,
  "takeawayUpi": 4800,
  "totalIncome": 28500,
  "pettyCashOpening": 2000,
  "pettyCashClosing": 1350,
  "pettyCashDifference": -650,
  "notes": "Power cut for 2 hours...",
  "isHoliday": false,
  "isLocked": false,
  "lockedAt": null,
  "expenses": [
    {
      "id": "uuid",
      "categoryName": "Raw materials",
      "amount": 4500,
      "vendorName": null,
      "source": "eod",
      "notes": null
    }
  ],
  "totalExpenses": 6800,
  "netForDay": 21700,
  "createdBy": "Owner Name",
  "createdAt": "2026-03-15T17:30:00Z"
}
```

`pettyCashDifference` = `pettyCashClosing - pettyCashOpening`. Negative means cash is short. Computed by API, not stored.

---

## Locking rules

- An EOD entry is auto-locked 24 hours after `created_at`
- Locking is enforced on PUT requests: if `is_locked = true`, return error `ENTRY_LOCKED`
- Auto-locking is implemented as a check on every PUT request (compare `NOW()` vs `created_at + interval '24 hours'`) — no background job needed
- Owner can manually lock early via the lock route
- Owner can unlock any entry via the unlock route — this is an exception flow, not the normal path
- Branch manager cannot lock or unlock

---

## Offline draft (frontend only)

The EOD form saves a draft to `localStorage` every time any field changes. This ensures no data loss if the network drops.

### localStorage key
```
rms_eod_draft_{branchId}_{date}
```
e.g. `rms_eod_draft_uuid-branch-1_2026-03-15`

### Draft structure (mirrors request body)
```json
{
  "date": "2026-03-15",
  "dineinCash": 8500,
  "dineinUpi": 12000,
  "takeawayCash": 3200,
  "takeawayUpi": 4800,
  "pettyCashOpening": 2000,
  "pettyCashClosing": null,
  "notes": "",
  "savedAt": "2026-03-15T17:45:23.000Z"
}
```

### Draft behaviour
1. On page load — check for existing draft for today's date + branch
2. If draft exists and no saved entry on server — restore draft and show banner: "Draft restored from [time]. Your last save was not submitted."
3. If draft exists and server entry also exists — discard draft, show server data
4. On successful save — clear the draft from localStorage
5. Draft older than 48 hours — auto-discard on load

---

## Frontend UX rules

1. Income section is always shown first and prominently
2. Cash/UPI split is shown per service type (dine-in and takeaway each have two inputs)
3. Running total updates live as user types — show: Total income, Total expenses, Net for today
4. Expense categories are shown as tap-to-add tags. Tapping adds an expense row with an amount input. Tapping a selected category's × removes it.
5. Default expense categories shown as tags: Raw materials, Gas/fuel, Electricity, Rent, Salary advance, Maintenance, Miscellaneous
6. Petty cash section is collapsible — collapsed by default, user expands if needed
7. Notes field is at the bottom — optional, placeholder gives examples
8. Save button is always visible (sticky footer on mobile)
9. Show "Entry locked" state clearly if `is_locked = true` — read-only view with unlock button for owner

---

## Validation schema (Zod)

```js
const eodEntrySchema = z.object({
  date: z.string().date(),
  dineinCash: z.number().int().min(0).default(0),
  dineinUpi: z.number().int().min(0).default(0),
  takeawayCash: z.number().int().min(0).default(0),
  takeawayUpi: z.number().int().min(0).default(0),
  pettyCashOpening: z.number().int().min(0).optional().nullable(),
  pettyCashClosing: z.number().int().min(0).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  isHoliday: z.boolean().default(false)
})
```

---

## Error codes specific to EOD

| Code | Meaning |
|------|---------|
| `ENTRY_LOCKED` | Attempting to edit a locked entry |
| `ENTRY_ALREADY_EXISTS` | Trying to POST when an entry for that date+branch already exists |
| `FUTURE_DATE` | Attempting to create an entry for a future date |

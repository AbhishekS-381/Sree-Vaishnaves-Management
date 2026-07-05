# DOC-11 · Vendor & Supplier Management
**Version:** v1.0  
**Last updated:** 2026-03-15  
**Phase:** 2 (6–12 months)  
**Depends on:** DOC-01, DOC-02, DOC-03, DOC-08

---

## Overview

Vendor management provides the full CRUD interface for the shared expense ledger. While EOD entry allows quick-add only, this screen allows adding, editing, and deleting any expense record (including EOD-sourced ones). It also manages vendor profiles and tracks outstanding bills.

---

## API routes

### Vendor profiles
| Method | Route | Role | Description |
|--------|-------|------|-------------|
| GET | `/api/v1/branches/:branchId/vendors` | owner, branch_manager | List vendors |
| POST | `/api/v1/branches/:branchId/vendors` | owner, branch_manager | Add vendor |
| PUT | `/api/v1/branches/:branchId/vendors/:id` | owner, branch_manager | Update vendor |
| DELETE | `/api/v1/branches/:branchId/vendors/:id` | owner | Soft delete vendor |

### Purchase bills (expense records via vendor screen)
| Method | Route | Role | Description |
|--------|-------|------|-------------|
| GET | `/api/v1/branches/:branchId/expenses?source=vendor` | owner, branch_manager | List vendor-entered expenses |
| POST | `/api/v1/branches/:branchId/expenses` | owner, branch_manager | Add bill (source = 'vendor') |
| PUT | `/api/v1/branches/:branchId/expenses/:id` | owner, branch_manager | Edit any expense (any source) |
| DELETE | `/api/v1/branches/:branchId/expenses/:id` | owner | Soft delete any expense |

---

## Database table (Phase 2 addition)

```sql
CREATE TABLE vendors (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id     UUID NOT NULL REFERENCES branches(id),
  name          VARCHAR(100) NOT NULL,
  phone         VARCHAR(20),
  supply_type   VARCHAR(100),
  -- e.g. 'vegetables', 'dairy', 'gas', 'packaging'
  notes         TEXT,
  isActive     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deletedAt    TIMESTAMPTZ DEFAULT NULL
);
```

Also add `vendor_id UUID REFERENCES vendors(id) DEFAULT NULL` to the `expenses` table as a Phase 2 migration.

---

## Vendor response

```json
{
  "id": "uuid",
  "branchId": "uuid",
  "name": "Kumar Vegetables",
  "phone": "9876543210",
  "supplyType": "vegetables",
  "notes": "Delivers every morning before 7am",
  "isActive": true
}
```

---

## Outstanding bills (nice to have)

Add `is_paid BOOLEAN DEFAULT TRUE` and `due_date DATE DEFAULT NULL` to the `expenses` table as a Phase 2 migration.

- `is_paid = false` means the bill is outstanding
- Dashboard shows count of unpaid bills for the branch
- Vendor screen shows unpaid bills highlighted

---

## Business rules

1. Vendor profiles are per-branch
2. Expenses can be entered without a vendor (vendorName as free text is sufficient)
3. Linking to a vendor profile (via vendor_id) is optional but enables better reporting
4. Editing an EOD-sourced expense from the vendor screen changes `updated_by` and `updated_at` but does NOT change `source` — source tracks origin, not last editor
5. Deleted expenses (soft) are excluded from all totals and reports

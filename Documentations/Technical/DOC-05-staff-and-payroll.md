# DOC-05 · Staff & Payroll
**Version:** v1.0  
**Last updated:** 2026-03-15  
**Phase:** 1  
**Depends on:** DOC-01, DOC-02, DOC-03

---

## Overview

Staff management covers employee profiles scoped per branch. Payroll covers monthly salary calculation based on attendance, advance deductions, and owner approval. All staff data is soft-deleted only.

---

## Staff API routes

| Method | Route | Role | Description |
|--------|-------|------|-------------|
| GET | `/api/v1/branches/:branchId/staff` | owner, branch_manager | List all active staff for a branch |
| GET | `/api/v1/branches/:branchId/staff/:id` | owner, branch_manager | Get single staff profile with history |
| POST | `/api/v1/branches/:branchId/staff` | owner, branch_manager | Add new staff member |
| PUT | `/api/v1/branches/:branchId/staff/:id` | owner, branch_manager | Update staff profile |
| DELETE | `/api/v1/branches/:branchId/staff/:id` | owner | Soft delete (set is_active=false, deleted_at) |

### Staff list query params
- `?role=waiter` — filter by role
- `?shift=morning` — filter by shift
- `?search=kumar` — search by name (case-insensitive)
- `?includeInactive=true` — include soft-deleted staff (owner only)

### Staff profile response
```json
{
  "id": "uuid",
  "branchId": "uuid",
  "name": "Murugan K",
  "phone": "9876543210",
  "roleId": "uuid",
  "departmentId": "uuid",
  "monthlySalary": 18000,
  "joinedAt": "2025-01-15",
  "notes": null,
  "isActive": true,
  "createdAt": "2025-01-15T10:30:00Z"
}
```

### Allowed role values
Values are now stored in `roles.json` as UUIDs.

### Allowed department values
Values are now stored in `departments.json` as UUIDs.

---

## Salary advance API routes

| Method | Route | Role | Description |
|--------|-------|------|-------------|
| GET | `/api/v1/branches/:branchId/advances` | owner, branch_manager | List advances, filter by month or staff |
| POST | `/api/v1/branches/:branchId/advances` | owner, branch_manager | Record a new advance |

### Advance request body
```json
{
  "staffId": "uuid",
  "amount": 2000,
  "advanceDate": "2026-03-10",
  "note": "Medical emergency"
}
```

### Advance rules
- One staff member can have multiple advances in a month
- Advances are deducted cumulatively at payroll time
- `is_deducted` flips to `true` when payroll for that month is approved — prevents double deduction if payroll is regenerated

---

## Payroll API routes

| Method | Route | Role | Description |
|--------|-------|------|-------------|
| GET | `/api/v1/branches/:branchId/payroll/:month` | owner, branch_manager | Get all payroll records for a month |
| POST | `/api/v1/branches/:branchId/payroll/:month/generate` | owner | Generate/recalculate payroll for a month |
| PATCH | `/api/v1/branches/:branchId/payroll/:month/:staffId` | owner | Override a single staff member's net payable |
| POST | `/api/v1/branches/:branchId/payroll/:month/approve` | owner | Approve and lock entire month's payroll |
| GET | `/api/v1/branches/:branchId/payroll/:month/:staffId/slip` | owner, branch_manager | Download PDF salary slip |

### Month format
`YYYY-MM` — e.g. `2026-03`

---

## Payroll generation logic

When `POST /payroll/:month/generate` is called:

1. Fetch all active staff for the branch
2. For each staff member:
   a. Count `attendance_logs` for the month:
      - `days_present` = count of `status = 'present'`
      - `half_days` = count of `status = 'half_day'`
      - `days_holiday` = count of `status = 'holiday'`
   b. Get `working_days` from branch config for that month (default 26)
   c. Get `monthly_salary` from current staff record (snapshot it)
   d. Calculate:
      ```
      gross_salary = ROUND((days_present + 0.5 * half_days) / working_days * monthly_salary)
      ```
   e. Sum all `salary_advances` for this staff for this month where `is_deducted = false`
      → `total_advances`
   f. Calculate:
      ```
      net_payable = MAX(0, gross_salary - total_advances)
      ```
3. Upsert into `payroll_records` with `status = 'draft'`
   - If a draft already exists, recalculate and overwrite
   - If `status = 'approved'`, do NOT regenerate — return error `PAYROLL_ALREADY_APPROVED`

### Payroll approval logic

When `POST /payroll/:month/approve` is called:

1. Verify all staff have payroll records generated (no missing entries)
2. Set all records to `status = 'approved'`, `approved_by`, `approved_at`
3. Set `is_deducted = true` on all `salary_advances` that were included in this payroll
4. Write to `audit_logs`
5. Lock — no further regeneration allowed for this month

---

## Payroll bulk view response

```json
{
  "month": "2026-03",
  "branchId": "uuid",
  "workingDays": 26,
  "status": "draft",
  "records": [
    {
      "staffId": "uuid",
      "name": "Murugan K",
      "role": "head_cook",
      "baseSalary": 18000,
      "daysPresent": 24,
      "halfDays": 1,
      "daysHoliday": 0,
      "grossSalary": 17308,
      "totalAdvances": 2000,
      "netPayable": 15308,
      "overrideAmount": null,
      "finalPayable": 15308
    }
  ],
  "totals": {
    "grossSalary": 320000,
    "totalAdvances": 15000,
    "totalNetPayable": 305000
  }
}
```

`finalPayable` = `overrideAmount` if set, otherwise `netPayable`.

---

## Salary slip PDF content

Each salary slip must contain:
- Restaurant name and branch name
- Staff name, role, and employee ID
- Month and year
- Working days, days present, half days
- Base salary
- Gross salary (calculated)
- Advances deducted (itemised with dates and amounts)
- Net payable
- "Approved by" name and date
- Footer: "This is a computer-generated salary slip."

---

## Branch payroll config

Each branch has a configurable `working_days` per month. This is stored as a simple config — not a separate table in Phase 1. Store as a JSON field on the branch record or as a separate `branch_config` table.

Default: `26`

The owner can override this per month before generating payroll (e.g. if the restaurant was closed for a festival week: set working days to 22 for that month).

---

## Validation schemas (Zod)

```js
const createStaffSchema = z.object({
  name: z.string().min(2).max(100),
  phone: z.string().length(10).optional(),
  roleId: z.string().uuid(),
  departmentId: z.string().uuid(),
  monthlySalary: z.number().int().positive(),
  joinedAt: z.string().date().optional()
})

const recordAdvanceSchema = z.object({
  staffId: z.string().uuid(),
  amount: z.number().int().positive(),
  advanceDate: z.string().date(),
  note: z.string().max(255).optional()
})

const overridePayrollSchema = z.object({
  overrideAmount: z.number().int().min(0),
  overrideNote: z.string().min(5).max(500)
})
```

---

## Business rules summary

1. Staff with `is_active = false` are excluded from attendance marking and payroll generation
2. Base salary changes take effect from the next month's payroll — they do not retroactively affect past records
3. Advances from previous months that were not yet deducted carry forward — they appear in the next generated payroll
4. Net payable is floored at 0 — it can never be negative
5. Once payroll is approved, it cannot be regenerated. Owner must contact super admin to unlock (handled manually, no UI)
6. Payroll generation is idempotent for draft status — calling generate multiple times produces the same result

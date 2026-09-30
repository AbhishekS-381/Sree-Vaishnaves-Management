# DOC-05 · Staff & Payroll
**Version:** v2.0
**Last updated:** 2026-09-30
**Depends on:** DOC-01, DOC-02, DOC-03, DOC-04, DOC-06

---

## Overview

This module covers three related areas, all implemented as Server Actions and rendered under `/management/staff` and `/management/payroll`:

1. **Staff profiles** — `staff.ts` + `StaffModal.tsx`
2. **Position requirements & schedules** ("Open Positions" / timeline) — `staff_requirements.ts` + `StaffRequirements.tsx`, `ScheduleTimeline.tsx`, `AutoScheduleModal.tsx`
3. **Payroll** — `salary.ts` + `PayrollClientPage.tsx`

There are no REST routes. All operations are Server Actions invoked from client components.

---

## Staff management (`src/app/actions/staff.ts`)

### Actions
| Action | Signature | Auth | Notes |
|--------|-----------|------|-------|
| `addStaff` | `(prevState, formData)` | any session; branch enforced | Zod-validated, dedupe by name+phone+branch |
| `updateStaff` | `(prevState, formData)` | branch enforced | blocks editing staff from another branch |
| `toggleStaffStatus` | `(id, currentlyActive)` | session; branch-checked for managers | deactivating unlinks the position |
| `deleteStaff` | `(id)` | `isGlobalAdmin` only | soft delete + unlink position; audit-logged |

### `addStaffSchema` (Zod)
```ts
{
  name: string (1..100, trimmed),
  phone: string (7..15, /^[0-9+\-\s()]+$/),
  departmentId: string (min 1),
  roleId: string (min 1),
  branchId: string (min 1),
  salary: int >= 0,
  label?: string (<=50),
  shiftType?: 'morning' | 'evening' | 'full',
  startTime?/endTime?: "HH:MM" or ''
}
```
(The StaffModal additionally captures `joinedAt`, `exitDate`, `specialtyId`, `positionId`, and `status` for edits.)

### Position mapping & `positionIndex`
- Staff may be mapped to a `staff_requirements` slot via `positionId`.
- On assignment the action computes the lowest free `positionIndex` among active staff already in that position (so slots fill 0,1,2…).
- On deactivate/delete, `positionId` and `positionIndex` are cleared to free the slot.
- The `StaffModal` only shows positions that still have open capacity (filled < requiredCount), except the staff member's current position when editing. Selecting a position **locks** branch/department/role/specialty to the requirement's definition.

### Duplicate rule
A staff member is considered a duplicate if an active, non-deleted record shares the same lowercased `name`, `phone`, and `branchId`.

---

## Position requirements (`src/app/actions/staff_requirements.ts`)

Requirements define budgeted headcount per branch/department/role (optionally a chef specialty).

| Action | Signature | Notes |
|--------|-----------|-------|
| `saveRequirement` | `(id, branchId, departmentId, roleId, requiredCount, specialtyId?, defaultSalary?, startTime?, endTime?, responsibility?)` | create or update; branch enforced |
| `deleteRequirement` | `(id)` | cascades: clears `positionId`/`positionIndex` on all assigned staff, then removes the requirement |
| `updateRequirementSchedules` | `(id, schedules)` | validates and stores per-position shift schedules |

Business rules enforced:
- **Duplicate guard:** a requirement with the same branch + department + role + specialty may not be created twice.
- **Locked edits:** if any active staff are assigned, you cannot change the requirement's role or department.
- **Headcount warning:** reducing `requiredCount` below the currently filled count returns a `{ success, warning }` telling the user to reassign the excess.
- `responsibility` is capped at 500 characters.

### Schedule validation (`updateRequirementSchedules`)
For each position schedule:
- Max **3 shifts**.
- Each shift must start no earlier than **05:00** and end no later than **23:00**.
- Minimum **1-hour break** between consecutive shifts.
- Total worked time across shifts must not exceed **10 hours**.

### Auto-schedule (`src/lib/scheduleGenerator.ts`)
`generateSchedules({ positionCount, branchStartTime, branchEndTime, maxHours, minSegmentHours, maxBreaks })` produces baseline `PositionSchedule[]`, staggering start times across positions and splitting each into up to 3 segments with 1-hour breaks. The `AutoScheduleModal` collects the parameters and calls `updateRequirementSchedules` with the result.

### Timeline & coverage view (`ScheduleTimeline.tsx`)
A drag-to-draw timeline (pointer events, 15-minute snapping) lets admins/owners edit each position's shifts directly. Clicking an hour marker opens a "who is working at this hour" panel that overlaps each staff member's shifts (from position schedules, or falling back to the staff record's `startTime`/`endTime`, or the `shiftType` default window) against the selected hour and compares required vs. actual coverage per role.

### Positions summary (`src/lib/positionsSummary.ts`)
`computePositionsSummary(requirements, staff)` returns `{ totalPositions, filledPositions, vacantPositions, totalSalary }` where `totalSalary = Σ(defaultSalary × requiredCount)`. Rendered by `PositionsSummaryCards`.

---

## Payroll (`src/app/actions/salary.ts`)

Payroll is generated per month/year from the current staff list and manually entered days-worked/advances.

### Actions
| Action | Signature | Auth | Notes |
|--------|-----------|------|-------|
| `savePayroll` | `(prevState, formData)` | any session; managers scoped to their branch | replaces all rows for the month/year |
| `markAsPaid` | `(id)` | `isGlobalAdmin` only | sets `status = 'PAID'`, `paidAt` |

### The salary formula (exact)
```
payableAmount = MAX(0, ROUND((monthlySalary / 30) * daysWorked) - advances)
```
- `monthlySalary` is snapshotted from the current staff record.
- `daysWorked` and `advances` are entered per staff in the payroll form (fields `staff_{id}_days`, `staff_{id}_advances`, `staff_{id}_notes`).
- Records are keyed `pay_{month}_{year}_{staffId}`; saving a month deletes existing rows for that month/year and inserts the new set, all with `status = 'PENDING'`.
- `month` must be 1–12, `year` 2020–2100.

### Prefill from attendance (`PayrollClientPage.tsx`)
The client pre-populates `daysWorked` for each staff member by counting that month's attendance from `attendanceLogs` (present = 1, half-day = 0.5), capped at 31, but the owner/manager can override any value before saving. Advances and notes are entered manually.

### What is NOT implemented
- No salary advances collection/workflow (`advances.json` is unused; advances are a plain number on the payroll record).
- No PDF salary slips.
- No per-record override-with-reason field (the payable is recomputed from days/advances).
- No approval-lock that freezes attendance — a month can be re-saved, which overwrites its records.
- No "working days" branch config — the divisor is a fixed 30.

---

## Data shapes
See DOC-03 for `Staff`, `StaffRequirement`/`PositionSchedule`/`Shift`, and `SalaryRecord`.

---

## Business rules summary
1. Managers can only add/edit staff, requirements, and payroll for their own branch.
2. Only global admins (admin/owner) can delete staff.
3. Only global admins can mark payroll as paid.
4. Deactivating or deleting staff frees their assigned position slot.
5. Payable is floored at 0.
6. Payroll save is destructive per month/year (overwrites), so re-saving recalculates that month.

# DOC-06 · Attendance
**Version:** v1.0  
**Last updated:** 2026-03-15  
**Phase:** 1  
**Depends on:** DOC-01, DOC-02, DOC-03, DOC-05

---

## Overview

Daily attendance is marked by the owner or branch manager. Designed for 35+ staff — the default is "mark all present" and only exceptions are tapped. Attendance directly feeds the payroll calculation.

---

## API routes

| Method | Route | Role | Description |
|--------|-------|------|-------------|
| GET | `/api/v1/branches/:branchId/attendance` | owner, branch_manager | Get attendance for a date or month |
| POST | `/api/v1/branches/:branchId/attendance/bulk` | owner, branch_manager | Mark attendance for multiple staff at once |
| PATCH | `/api/v1/branches/:branchId/attendance/:staffId` | owner, branch_manager | Update a single staff member's status |
| POST | `/api/v1/branches/:branchId/attendance/mark-all-present` | owner, branch_manager | Bulk mark all active staff as present for a date |
| POST | `/api/v1/branches/:branchId/holiday` | owner | Flag a day as holiday for the entire branch |
| DELETE | `/api/v1/branches/:branchId/holiday/:date` | owner | Remove holiday flag for a date |

### Query params for GET attendance
- `?date=2026-03-15` — get attendance for a specific date
- `?month=2026-03` — get full month attendance summary
- `?staffId=uuid` — get attendance history for one staff member

---

## Bulk mark all present

The primary daily action. Called when the user opens the attendance screen for today.

### Request
```json
POST /api/v1/branches/:branchId/attendance/mark-all-present
{
  "date": "2026-03-15"
}
```

### Logic
1. Fetch all active staff for the branch
2. For each staff member, INSERT into `attendance_logs` with `status = 'present'`
3. Use `ON CONFLICT (staff_id, date) DO NOTHING` — skip staff already marked
4. Return count of records created vs skipped

### Response
```json
{
  "success": true,
  "data": {
    "marked": 32,
    "skipped": 3,
    "date": "2026-03-15"
  }
}
```

---

## Bulk update (exceptions)

After marking all present, the user taps individual exceptions.

### Request
```json
POST /api/v1/branches/:branchId/attendance/bulk
{
  "date": "2026-03-15",
  "entries": [
    { "staffId": "uuid-1", "status": "absent" },
    { "staffId": "uuid-2", "status": "half_day" },
    { "staffId": "uuid-3", "status": "leave" }
  ]
}
```

### Logic
Uses `INSERT ... ON CONFLICT (staff_id, date) DO UPDATE SET status = EXCLUDED.status, marked_by = EXCLUDED.marked_by, updated_at = NOW()`

---

## Holiday flag

When a branch is marked as holiday for a date:

1. Insert into `holiday_flags`
2. Bulk update all `attendance_logs` for that branch + date to `status = 'holiday'`
   - If no attendance has been marked yet, insert records with `status = 'holiday'` for all active staff
3. `holiday` days are excluded from both the present count and absent count in payroll — they do not penalise staff

### Removing a holiday flag
1. Delete from `holiday_flags`
2. Delete all `attendance_logs` where `status = 'holiday'` for that branch + date
   - This returns the day to "not yet marked" state — the user must re-mark attendance

---

## Attendance status values

| Status | Payroll weight | Description |
|--------|---------------|-------------|
| `present` | 1.0 | Full day worked |
| `half_day` | 0.5 | Half day worked |
| `absent` | 0.0 | Did not come in |
| `leave` | 0.0 | Approved leave (no penalty, but no pay) |
| `holiday` | excluded | Branch closed — excluded from working day denominator |

---

## Edit rules

- **Same day:** Both owner and branch_manager can edit
- **Up to 7 days back:** Owner only can edit
- **Beyond 7 days:** No edits permitted through UI (root user only via DB)
- **After payroll approved:** No edits to attendance for that month — return error `PAYROLL_ALREADY_APPROVED`

---

## Attendance summary response (for a date)

```json
{
  "date": "2026-03-15",
  "branchId": "uuid",
  "isHoliday": false,
  "summary": {
    "total": 35,
    "present": 31,
    "halfDay": 2,
    "absent": 1,
    "leave": 1,
    "notMarked": 0
  },
  "records": [
    {
      "staffId": "uuid",
      "name": "Murugan K",
      "role": "head_cook",
      "shift": "full",
      "status": "present"
    }
  ]
}
```

Records are grouped by role in the response for easier scanning on large teams.

---

## Monthly attendance summary (for payroll)

```json
{
  "month": "2026-03",
  "branchId": "uuid",
  "workingDays": 26,
  "staff": [
    {
      "staffId": "uuid",
      "name": "Murugan K",
      "daysPresent": 24,
      "halfDays": 1,
      "daysAbsent": 1,
      "daysLeave": 0,
      "daysHoliday": 2,
      "daysNotMarked": 0
    }
  ]
}
```

---

## Frontend UX rules

1. **Default to "mark all present" pattern:**
   - When the user opens today's attendance, if no records exist, show a "Mark all present" button prominently
   - After marking all present, show the full list where user taps only exceptions
   - This is the most common daily flow for 35 staff

2. **Group staff by role** in the attendance list for easier scanning

3. **Colour coding for statuses:**
   - Present → green
   - Half day → yellow/amber
   - Absent → red
   - Leave → blue
   - Holiday → grey

4. **Show count summary** at top: "31 present · 2 half day · 1 absent · 1 leave"

5. **Date navigation:** User can go back to previous days to edit (within 7-day rule for owner)

6. **Holiday banner:** If the day is marked as holiday, show a prominent banner and disable all status buttons

---

## Validation schemas (Zod)

```js
const attendanceStatusEnum = z.enum(['present', 'absent', 'half_day', 'leave'])

const bulkAttendanceSchema = z.object({
  date: z.string().date(),
  entries: z.array(z.object({
    staffId: z.string().uuid(),
    status: attendanceStatusEnum
  })).min(1)
})

const holidaySchema = z.object({
  date: z.string().date(),
  reason: z.string().max(255).optional()
})
```

---

## Error codes specific to attendance

| Code | Meaning |
|------|---------|
| `ATTENDANCE_ALREADY_MARKED` | Unique constraint hit on single insert |
| `PAYROLL_ALREADY_APPROVED` | Trying to edit attendance for an approved payroll month |
| `EDIT_WINDOW_EXPIRED` | Trying to edit attendance older than 7 days (non-owner) |
| `BRANCH_IS_HOLIDAY` | Trying to mark individual attendance on a holiday |

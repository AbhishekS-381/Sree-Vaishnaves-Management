# DOC-06 · Attendance
**Version:** v2.0
**Last updated:** 2026-09-30
**Depends on:** DOC-01, DOC-02, DOC-03, DOC-04, DOC-05

---

## Overview

Daily attendance is marked by admin, owner, or manager under `/management/attendance` (`AttendanceClientPage.tsx`), backed by `src/app/actions/attendance.ts`. Records feed the payroll day-count prefill (DOC-05). `readonly` users cannot mark attendance. There are no REST routes.

---

## Actions (`src/app/actions/attendance.ts`)

| Action | Signature | Notes |
|--------|-----------|-------|
| `getAttendanceByDate` | `(date, branchId?)` | returns logs for a date, optionally filtered by branch |
| `saveAttendance` | `(newLogs: Partial<AttendanceLog>[])` | bulk upsert of attendance rows; the primary write |

There is no separate "mark all present" or "holiday flag" endpoint — the client builds the desired set of `{ date, staffId, branchId, status }` rows and sends them to `saveAttendance` in one call. "Mark all present" is a client-side convenience that pre-sets every staff row to `present` before saving.

---

## Status values

```ts
type AttendanceStatus = 'present' | 'absent' | 'half-day' | 'holiday' | 'unmarked'
```

| Status | Meaning | Payroll effect (via prefill) |
|--------|---------|------------------------------|
| `present` | Full day worked | counts as 1 day |
| `half-day` | Half day worked | counts as 0.5 day |
| `absent` | Did not attend | 0 |
| `holiday` | Branch closed / holiday | 0 (not counted) |
| `unmarked` | Not yet marked | 0 |

There is **no `leave` status** in the code. The status literal uses a hyphen (`half-day`).

---

## `saveAttendance` logic

1. **Branch enforcement.** The first log's `branchId` is passed through `requireBranchAccess`; the enforced branch is stamped onto all logs. A manager cannot write attendance for another branch (`Forbidden`).
2. **Per-row upsert** under a `withTransaction` lock on `attendance.json`. For each incoming log with a `date` and `staffId`:
   - **Future-date guard:** if `date > todayIST` the whole save aborts with `Cannot mark attendance for future dates`.
   - **7-day time-lock:** if the log's date is more than 7 days old and the user is **not** a global admin, the save aborts with `Cannot save attendance older than 7 days without Owner privileges.`
   - Existing `(date, staffId)` row → merged/updated; otherwise a new row is pushed with a generated id.
   - `updatedAt` is set to now on every write.
3. **Audit + revalidate.** Logs an `UPDATE_ATTENDANCE` entry summarizing the affected staff count and dates, then revalidates `/management/attendance` and `/`.

"Today" is computed in IST: `new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })`.

---

## Edit rules (as enforced)

- **Any date up to today, within 7 days:** admin, owner, and manager (own branch) can write.
- **Older than 7 days:** only global admins (`admin`/`owner`). Managers are blocked.
- **Future dates:** blocked for everyone.
- There is no payroll-approval lock on attendance (payroll does not freeze attendance in this codebase).

---

## Frontend behaviour (`AttendanceClientPage.tsx`)

- Date picker (defaults to today) and branch selector (managers are pinned to their branch).
- Loads existing logs for the date via `getAttendanceByDate` and keys them by `staffId`.
- "Mark all present" sets every active staff member's status to `present` client-side.
- Individual rows can be toggled between present / absent / half-day / holiday.
- **Shift toggles:** each row also has `Morning` / `Evening` / `Full Day` buttons that add/remove entries in that log's `shiftsWorked` array (seeded from the staff member's `shiftType`, defaulting to `Full Day`). These are persisted with the log.
- Staff are grouped/labelled by role for scanning large teams.
- A summary count is shown; saving calls `saveAttendance` with the full set.
- Drafts are auto-saved to localStorage per `branch_date` and cleared on successful save.

> **Note on `shiftsWorked`:** it is captured in the UI and stored in `attendance.json`, but **no downstream logic reads it**. Payroll derives days-worked solely from `status` (present = 1, half-day = 0.5); Reports and the Dashboard do not reference it. It currently serves as a record of shift coverage only.

---

## Data shape
See DOC-03 → `attendance.json` / `AttendanceLog`.

---

## Business rules summary
1. One record per staff per day (upsert on `(date, staffId)`).
2. No future-dated attendance.
3. 7-day edit window for managers; global admins can edit older records.
4. Branch scoping is enforced server-side.
5. Attendance is a soft input to payroll (prefill only) — it does not hard-lock or auto-generate payroll.

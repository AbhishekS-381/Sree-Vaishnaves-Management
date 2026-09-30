# DOC-13 · Dashboard
**Version:** v2.0
**Last updated:** 2026-09-30
**Depends on:** DOC-01, DOC-02, DOC-03, DOC-04, DOC-05, DOC-06, DOC-07

---

## Overview

The dashboard is the landing page after login at `/management` (`src/app/management/page.tsx`). It is a **server component** that reads collections directly via `readJSON`, applies branch scoping, computes today's snapshot and pending actions, and renders KPI cards plus a branch-status panel. It is not a Server Action and writes nothing.

---

## Data sources (read in `page.tsx`)

`branches`, `staff`, `eod`, `expenses`, `inventory`, `attendance`, `payroll`, and `config` — all via `readJSON`. For non-global users with a `branchId`, each collection is filtered to that branch. Active-only filtering is then applied to branches (`isActive !== false`) and staff (`isActive === true`).

---

## KPI cards

| Card | Value |
|------|-------|
| Total Branches | count of active branches (scoped) |
| Active Staff | count of active staff (scoped) |
| Today's Collection | Σ of today's EOD income (`dineInCash+dineInUpi+takeawayCash+takeawayUpi`) across today's entries |
| Net Balance | Today's Collection − today's total expenses |

"Today" is computed in IST (`toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })`).

---

## Pending actions (computed inline)

Alerts are computed on each load and gated by the `config` module toggles:

| Alert | Condition | Gated by |
|-------|-----------|----------|
| `⚠ Attendance not marked for today` | no attendance row with `date === today` | `config.attendance` |
| `⚠ EOD entry not filled` | no EOD entry with `date === today` | always shown |
| `ℹ Payroll due this month` | within last ~3 days of month AND no payroll row for current month/year | `config.payroll` |
| `⚠ N Low stock alert(s)` | any inventory item with `currentQuantity <= threshold` | `config.inventory` |

A notification bell shows a red dot when any pending actions exist. If none, the panel shows "All caught up!".

`isEndOfMonth` is `today.getDate() >= daysInMonth - 2`.

---

## Branch status panel

Lists each (scoped, active) branch with a colored status pill:
- `operational` → emerald, `maintenance` → amber, anything else (`closed`/unknown) → red.

---

## Role behaviour

- Global admins (admin/owner) and readonly see all branches and consolidated figures.
- Managers see only their assigned branch (the loader filters every collection by `session.branchId`).
- The dashboard shell (`management/layout.tsx`) renders the `Navigation` sidebar with the same `config` so disabled modules disappear from the menu.

---

## Business rules summary
1. Read-only aggregation — the dashboard never writes.
2. Today's figures use IST dates.
3. Pending-action alerts respect the global module toggles in `config.json`.
4. Branch scoping mirrors the rest of the app (managers → own branch only).

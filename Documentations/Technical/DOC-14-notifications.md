# DOC-14 · Notifications & Reminders
**Version:** v2.0
**Last updated:** 2026-09-30
**Depends on:** DOC-01, DOC-02, DOC-03, DOC-13

---

## Overview

"Notifications" in this system are **in-app pending-action alerts computed on the dashboard**. There is no notifications table, no notification collection, no badge count service, and no push/email/SMS/WhatsApp. Alerts are derived fresh on each dashboard render from the current data (see DOC-13). This document describes exactly what is implemented.

---

## Where alerts come from

All alerts are produced inline in `src/app/management/page.tsx` (the dashboard server component) as a `pendingActions` array. They are rendered as colored banners in the "Pending Actions" panel, and a bell icon shows a red dot when the array is non-empty. There is no separate `/alerts` page and no per-alert dismissal persistence.

---

## Implemented alert conditions

| Alert | Condition | Severity (color) | Gated by module toggle |
|-------|-----------|------------------|------------------------|
| Attendance not marked for today | no `attendance` row with `date === today (IST)` | warning (amber) | `config.attendance` |
| EOD entry not filled | no `eod` row with `date === today (IST)` | warning (amber) | none (always) |
| Payroll due this month | `today.getDate() >= daysInMonth - 2` AND no `payroll` row for current month/year | info (blue) | `config.payroll` |
| Low stock alert(s) | any `inventory` item with `currentQuantity <= threshold` (shows count) | warning (red styling) | `config.inventory` |

Severity is expressed purely through Tailwind color classes on the banner. There is no `urgent` tier and no `EOD_EDIT_EXPIRING` reminder in the code.

---

## How alerts are scoped

- The dashboard applies branch scoping before computing alerts, so a manager only sees alerts for their branch; global admins/readonly see them across the branches they can view.
- Alerts respect the global `config.json` module toggles: if a module is disabled, its alert is suppressed (and the module is also hidden from navigation).

---

## Not implemented

- No stored notification history or read/unread state.
- No dismissal that persists across loads.
- No holiday-based suppression of the attendance/EOD reminders.
- No time-of-day thresholds (e.g. "after 10pm") — the EOD/attendance checks are purely presence-of-row checks for today.
- No external channels (push, email, WhatsApp, SMS).

---

## Business rules summary
1. Alerts are computed, not stored — they reflect the live data each time the dashboard loads.
2. Toggling a module off in Settings silences its alert.
3. Alerts are informational nudges; they never block any action.

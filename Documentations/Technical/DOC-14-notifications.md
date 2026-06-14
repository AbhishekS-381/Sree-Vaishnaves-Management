# DOC-14 · Notifications & Reminders
**Version:** v1.0  
**Last updated:** 2026-03-15  
**Phase:** 1  
**Depends on:** DOC-01, DOC-02, DOC-03

---

## Overview

In-app alerts and reminders only — no push notifications, no email, no WhatsApp in Phase 1. Reminders are shown as banners on the dashboard and as a badge on the notification icon. They are condition-based — computed on each dashboard load, not stored in a separate notifications table.

---

## Alert types

| Type | Trigger condition | Severity | Roles |
|------|------------------|----------|-------|
| `ATTENDANCE_NOT_MARKED` | Today's attendance has 0 records for the branch | warning | owner, branch_manager |
| `EOD_NOT_FILLED` | No EOD entry for today by 10pm IST | warning | owner, branch_manager |
| `PAYROLL_DUE` | Last 3 days of the month AND payroll not approved for current month | info | owner only |
| `LOW_STOCK` | Any active stock item has `current_quantity <= low_stock_threshold` (Phase 2) | warning | owner, branch_manager |
| `EOD_EDIT_EXPIRING` | EOD entry exists but edit window closes in under 1 hour | info | owner, branch_manager |

---

## How alerts are computed

Alerts are **not stored** — they are computed fresh on every dashboard API call. The dashboard service checks each condition and appends matching alerts to the `pendingActions` array in the response.

This keeps the system simple — no background jobs, no alert state management. The trade-off is that alerts only appear when the app is open, which is acceptable for Phase 1.

---

## Alert response shape

Each alert in `pendingActions` has:

```json
{
  "type": "EOD_NOT_FILLED",
  "message": "Today's EOD entry has not been filled yet.",
  "severity": "warning",
  "branchId": "uuid",
  "branchName": "Branch 1",
  "actionRoute": "/branches/uuid/eod/2026-03-15",
  "actionLabel": "Fill now"
}
```

- `severity`: `info` (blue), `warning` (amber), `urgent` (red)
- `actionRoute`: deep link to the relevant screen
- `actionLabel`: CTA text on the button inside the alert

---

## Frontend behaviour

### Dashboard banners
- Alerts are shown as stacked banners below the page header
- Max 3 banners visible at once — if more exist, show "and N more" with a link to full alert list
- Each banner has a dismiss button — dismissal is local (sessionStorage) and resets on next page load
- Banners are not dismissible for `urgent` severity

### Notification badge
- A bell icon in the top bar shows a red badge with the count of active alerts
- Badge updates on every dashboard load

### Alert colours
- `info` → blue background, blue text
- `warning` → amber background, amber text
- `urgent` → red background, red text (not used in Phase 1 but reserved)

---

## Alert conditions — detailed logic

### `ATTENDANCE_NOT_MARKED`
```sql
SELECT COUNT(*) FROM attendance_logs 
WHERE branch_id = :branchId AND date = CURRENT_DATE
```
If count = 0 → show alert. Show regardless of time of day.

### `EOD_NOT_FILLED`
```sql
SELECT id FROM daily_entries 
WHERE branch_id = :branchId AND date = CURRENT_DATE
```
If no row found AND current IST time >= 22:00 → show `warning`.
If no row found AND current IST time >= 21:00 → show `info` (early reminder).

### `PAYROLL_DUE`
```sql
SELECT id FROM payroll_records 
WHERE branch_id = :branchId AND month = :currentMonth AND status = 'approved'
LIMIT 1
```
If no approved record exists AND EXTRACT(DAY FROM CURRENT_DATE) >= (days_in_month - 2) → show alert.

### `EOD_EDIT_EXPIRING`
```sql
SELECT created_at FROM daily_entries 
WHERE branch_id = :branchId AND date = CURRENT_DATE AND is_locked = false
```
If found AND `NOW() > created_at + INTERVAL '23 hours'` → show `info` alert.

---

## Future upgrades (Phase 3+)

- Push notifications via web push API (PWA)
- WhatsApp message via Twilio or Meta API
- Configurable alert thresholds (e.g. change EOD reminder from 10pm to 9pm)
- Alert history / log screen

---

## Business rules

1. All time comparisons use IST (UTC+5:30) — convert `NOW()` to IST before checking hour-based conditions
2. Owner sees alerts for all branches — one alert per branch if the condition is met
3. Branch manager sees alerts for their branch only
4. Alert suppression: if the restaurant is marked as holiday for today, suppress `EOD_NOT_FILLED` and `ATTENDANCE_NOT_MARKED` for that branch

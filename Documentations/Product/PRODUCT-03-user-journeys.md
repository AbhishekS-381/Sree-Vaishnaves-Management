# Sree Vaishnaves Management — User Journeys
**Document type:** Product · High Level
**Audience:** Product owner, UX designers, developers
**Version:** v2.0 | Last updated: 2026-09-30

---

## What this document is

Real scenarios showing how the portal is used day to day. These journeys reflect the **implemented** behavior (four roles; day-end locks after 24h; attendance statuses present/absent/half-day/holiday; payroll = round(salary/30 × days) − advances). All screens live under `/management/*`.

---

## Journey 1 — The owner's morning check

**Who:** Owner · **When:** 8am · **Goal:** Know the state of the business before the day starts

The owner opens the app to the dashboard. KPI cards show today's collection and net balance so far; the branch-status panel shows each branch's status pill. The Pending Actions panel flags "Attendance not marked for today" for one branch.

He messages that branch's manager to mark attendance. Because he is an owner, he can also open that branch himself and see its data directly.

**Enabled:** A cross-branch status read in under a minute, no phone calls.

---

## Journey 2 — Morning attendance (manager)

**Who:** Manager · **When:** 9am · **Goal:** Mark attendance before the rush

The manager opens Attendance. The date defaults to today and the branch is pinned to theirs. He taps **Mark all present** — every active staff member is set to present. He changes the two exceptions: one **absent**, one **half-day**. He saves; the rows upsert against `(date, staffId)`.

If he tried to edit a day more than 7 days old, the save would be refused (owner/admin only). Future dates are blocked outright.

**Enabled:** A 45-second daily task that later pre-fills payroll.

---

## Journey 3 — Evening day-end entry

**Who:** Manager · **When:** 10:30pm · **Goal:** Log the day's income and expenses

The manager opens EOD Entry. He enters dine-in cash/UPI and takeaway cash/UPI; the running total updates live. He optionally records the opening/closing cash float and sees the expected-vs-actual discrepancy. He taps expense category chips (Raw materials ₹5,200, Gas ₹800), and the net updates.

He saves. The entry is stored as **submitted**; its EOD-sourced expenses replace any earlier ones for that day. After 24 hours the entry locks — only an owner/admin could edit it then. If the day had zero income, he'd have to tick the zero-revenue confirmation first.

**Enabled:** A clean, searchable daily record that feeds Reports and the dashboard.

---

## Journey 4 — Month-end payroll (owner)

**Who:** Owner · **When:** Near month end · **Goal:** Compute and settle salaries

A dashboard nudge notes payroll is due. The owner opens Payroll and selects the month/year. Each staff row shows days-worked **pre-filled from attendance** (present = 1, half-day = 0.5, capped at 31), which he can override. He enters any advances and notes.

The payable computes as **round(monthlySalary ÷ 30 × daysWorked) − advances**, floored at 0. He saves — all rows are stored as **PENDING**. As money goes out, he marks records **PAID** (owner/admin only), which stamps `paidAt`.

There are no PDF slips to print, and re-saving the month recomputes and overwrites its rows. Attendance is not frozen by payroll in this build.

**Enabled:** Review-and-approve instead of manual arithmetic, with a stored record per month.

---

## Journey 5 — Reviewing performance

**Who:** Owner · **When:** Start of a new month · **Goal:** Understand last month

The owner opens Reports and selects a branch + month/year. He sees total revenue with dine-in/takeaway and cash/UPI splits, month-on-month change, expenses by category, payroll payable, **salary as % of revenue**, and **net profit = revenue − expenses − payroll**. If day-end billing details were filled, he also sees GST collected, covers, and average cover value.

He exports the summary as **CSV** for his own records (there is no Excel/PDF export).

**Enabled:** Data-driven observations in minutes.

---

## Journey 6 — Resolving an attendance dispute

**Who:** Owner + staff member · **When:** After payroll · **Goal:** Fix a wrong mark fairly

A staff member says he was marked absent on a day he worked. The owner opens Attendance for that date, sees the status, and corrects it to **present** (as a global admin he can edit even outside the 7-day window). He then re-saves that month's payroll, which recomputes the payable, and marks the corrected record paid.

**Enabled:** Evidence-based correction without a paper chase.

---

## Journey 7 — Checking in remotely

**Who:** Owner · **When:** Away from both branches · **Goal:** Confirm things look normal

The owner opens the dashboard between meetings. He sees each branch's today collection, net, and any alerts — including a low-stock warning if the inventory module is on and an item is at/below its threshold. He pings the manager to reorder and moves on.

**Enabled:** Remote visibility in seconds.

---

## A note on the read-only analyst

A `readonly` user can open the dashboard and Reports across branches but cannot mark attendance, fill day-end entries, or change any record — the day-end screen redirects them away, and mutation controls are hidden.

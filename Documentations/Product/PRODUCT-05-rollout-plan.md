# Sree Vaishnaves Management — Rollout & Adoption Plan
**Document type:** Product · High Level
**Audience:** Product owner, developer
**Version:** v3.0 | Last updated: 2026-11-02

---

## Context

The software is **fully built** — every module (dashboard, staff/positions, attendance, payroll, day-end entry, expenses, vendors, inventory, menu, pos/billing/kot, reports, branches, settings) is implemented over a normalized PostgreSQL relational database. Rollout is therefore an **adoption sequence**. The hard part is getting a busy restaurant team to change habits that have worked for years.

The key enabler is the **module-toggle system** (persisted in the `config` table, Settings → managed by an admin). The business can start with a minimal set of modules switched on and enable more as habits form. Toggleable modules: attendance, payroll, vendors, inventory, menu, pos, reports. When a module is off, it disappears from navigation and its dashboard alerts are silenced.

---

## Adoption principle: earn trust, one module at a time

Turn modules on gradually rather than exposing everything at once. Each newly enabled module should build on a habit already formed by the previous one.

---

## Suggested enablement sequence

### Step 1 — Foundation (always on)
Keep **Settings**, **Staff & Positions**, **Day-End Entry**, **Expenses**, and **Dashboard** on. Have the admin enter branches, departments, roles, expense categories, and all staff. The owner confirms the roster. Zero new daily habit yet — the value is "your business is in the system."

**Success signal:** the owner can look up any staff member's salary/role in seconds.

### Step 2 — Attendance
Enable the **attendance** toggle. Demonstrate the "mark all present + tap exceptions" flow (statuses: present / absent / half-day / holiday). It should take under a minute for 35 staff. Keep the paper register in parallel for a couple of weeks for confidence.

**Success signal:** attendance marked daily for three straight weeks without a reminder.

### Step 3 — Day-End Entry as a habit
Day-End is on from the start, but this is when it becomes a nightly ritual: income (dine-in/takeaway × cash/UPI), a few expense chips, save. Remind the team that entries lock after 24 hours (owners/admins can still edit). Show them an early payoff — a week's totals on the dashboard.

**Success signal:** day-end filled ~25+ of every 30 days.

### Step 4 — Payroll
Enable the **payroll** toggle once a full month of attendance exists. Walk through the first cycle: days-worked pre-fill from attendance (editable), enter advances, and confirm the payable — **round(monthlySalary ÷ 30 × daysWorked) − advances**. Save (PENDING), then mark records PAID as money goes out. Verify the numbers match the owner's manual calculation to establish trust.

**Success signal:** the owner runs and settles payroll in the app and trusts the numbers.

### Step 5 — Supply chain (vendors + inventory)
Enable **vendors** and **inventory**. Vendor bills are just expenses with a supplier attached — a natural extension of the day-end expense habit. Start inventory with the top 5–10 critical items and their thresholds so low-stock alerts are meaningful.

**Success signal:** major purchases recorded against vendors; low-stock alerts caught before shortages.

### Step 6 — Menu
Enable **menu**. Enter the global catalog once; set per-branch availability/price. This is low-effort maintenance and also unlocks chef-specialty tagging in Staff as well as POS ordering.

### Step 7 — POS, Billing & Kitchen Order Tickets (KOT)
Enable the **pos** toggle. Onboard dining floor waiters (`waiter`), kitchen cooks (`kitchen`), and front cashiers (`billing`).
- Demonstrate waiter order creation on mobile phones: table picking, dietary notes, and incremental KOT firing.
- Set up kitchen tablets at `/management/pos/kitchen` displaying the live FIFO ticket queue (auto-polling every 30s) to advance items from PENDING to PREPARING to READY.
- Train billing clerks on discount application, GST suggestions, split payments (cash/UPI), change calculation, and receipt printing.
- Showcase the direct EOD prefill payoff: day-end sales, tax, and covers populate automatically from settled POS orders.

**Success signal:** 100% digital order taking and zero manual calculation required for evening Day-End entries.

### Step 8 — Reports
Enable **reports** once there are a few months of day-end, POS, and payroll data. This is the payoff: revenue trends, expense breakdowns, salary-as-%-of-revenue, net profit, and CSV export for the accountant.

**Success signal:** the owner makes at least one decision (pricing, staffing, supplier) from report data.

---

## Onboarding staff & branch managers

### Branch Manager
When a manager is appointed:
1. An admin/owner creates their user with role **manager** and the correct **branchId**.
2. 30-minute walkthrough of Attendance.
3. 30-minute walkthrough of Day-End Entry & POS oversight.
4. A couple of supervised days where an owner/admin reviews their entries.
5. A week of independent operation with support on call.

Managers are automatically sandboxed to their branch and cannot open Settings, mark payroll paid, or edit the ledger — so their surface area is small and safe by design.

### Operational POS Staff (Waiter, Kitchen, Billing)
- Create dedicated accounts with `waiter`, `kitchen`, or `billing` roles assigned to the appropriate branch.
- Floor staff require minimal training because their interfaces are single-purpose and page-locked with navigation headers hidden in `src/proxy.ts`.

---

## When things go wrong

- **Missed day-end entry:** the dashboard nudges but never blocks. After 24 hours the entry locks; an owner/admin can still edit it. Handle the first few misses generously.
- **Questioned payroll number:** walk through it using the attendance records and the formula. Fix wrong attendance and re-save the month (which recomputes it).
- **App slow/unavailable:** attendance can be kept on paper and entered later; the day-end draft state is held client-side until submitted.

---

## Definition of a healthy deployment

1. Consistent daily data — attendance, POS orders, and day-end entered as routine.
2. A stored payroll record per month, settled through the app.
3. The owner uses the dashboard as a daily habit.
4. Managers and floor staff operate independently within their branch boundaries.
5. Reports are trusted enough to inform real decisions.

---

## Security housekeeping before wider rollout

Ensure `JWT_SECRET` is set to a cryptographically strong secret in environment variables. If deploying fresh, configure `ADMIN_PASSWORD` in the environment so that `npm run db:seed` hashes the initial administrator password with bcrypt directly rather than using fallbacks. Ensure production database connections enforce SSL.

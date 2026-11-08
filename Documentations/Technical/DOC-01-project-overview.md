# DOC-01 · Project Overview
**Version:** v3.0
**Last updated:** 2026-11-02

---

## What this app is

**Sree Vaishnaves Management** is a web application for a vegetarian restaurant business in Kannur, Kerala. The repository contains two distinct surfaces served by one Next.js app:

1. **A public marketing website** at `/` — a static, single-page hotel/restaurant site (hero, about, menu, gallery, contact) built from a Bootstrap template. It is fully public and requires no authentication.
2. **A management portal** at `/management/*` — the operations tool used by the owner, managers, cashiers, kitchen staff, waiters, and analysts to run the business. This is what the rest of the documentation is about.

The management portal replaces manual processes: paper attendance, notebook salary calculations, cash-book expense tracking, verbal stock/vendor management, paper KOT tickets, and manual bill tallying.

---

## Business context

- Restaurant chain "Sree Vaishnaves" with **multiple branches** (seed data ships two: "Sree Vaishnaves" and "Vaishnaves Classic").
- Roughly **35 staff per branch** across kitchen, service, utility, accounts, and management departments.
- Primary devices: the owner and waiters use **mobile phones**; cashiers and managers use tablets/laptops; kitchen operates a dedicated display tablet. The UI is responsive and mobile-first.
- All monetary values are in **Indian Rupees (INR)** and stored as **integers** (no paise).
- Service types: **dine-in and takeaway**. No delivery-platform integration.
- Language: English UI only.
- Timezone: business logic that depends on "today" uses **IST (Asia/Kolkata)** via `toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })`.

---

## Users and roles

There are exactly **seven roles**, derived from the `role` field on each user record and expanded into capability flags inside the JWT (see DOC-04):

### `admin` (root / system administrator)
- The bootstrap super-user. The seeded owner account "Abhishek" is created with this role.
- Only role that can open **Settings** (`/management/settings`) and manage departments, roles, expense categories, module toggles, and system users.
- Treated as a global admin (full cross-branch access) and cannot be deleted or demoted through the UI.

### `owner`
- Full cross-branch operational access (`isGlobalAdmin` and `isGlobalOwner` are true).
- Can mark payroll as paid, edit/delete ledger expenses, override EOD locks, delete staff, and manage branches.
- Cannot open Settings (that is admin-only).

### `manager`
- Operational access **restricted to a single assigned `branchId`**.
- Can manage staff, attendance, POS operations, EOD, expenses (add only), vendors, inventory, and menu availability **for their branch only**.
- Cannot mark payroll as paid, cannot edit/delete ledger expenses, cannot manage branches, cannot open Settings.

### `readonly`
- Analyst / view-only access across branches for reporting.
- Sees data but the EOD entry page redirects them away, and create/edit/delete controls are hidden.

### `waiter` (posRole)
- Dining floor staff on mobile devices.
- Page-locked to `/management/pos/order` with navigation sidebars suppressed in `src/proxy.ts`.
- Creates orders, configures item variants/notes, and fires incremental KOT tickets to the kitchen for their own branch/orders. No access to financial totals or billing.

### `kitchen` (posRole)
- Back-of-house kitchen display operator.
- Page-locked to `/management/pos/kitchen` with navigation sidebars suppressed.
- Views active KOT tickets in FIFO order (polling every 30s), advances tickets from PENDING to PREPARING to READY. Zero financial or pricing data visible.

### `billing` (posRole)
- Front counter cashiers.
- Page-locked to `/management/pos/billing` with navigation sidebars suppressed.
- Reviews active orders, applies GST/discounts, processes payments (cash, UPI, split), calculates change due, and prints customer receipts.

> Note: `admin` and `owner` both satisfy the `isGlobalAdmin` check used throughout the Server Actions. `admin` additionally satisfies `isRootAdmin` (Settings access). `owner` additionally satisfies `isGlobalOwner`. `waiter`, `kitchen`, and `billing` carry `posRole: true` in their session tokens.

---

## Multi-branch design

Branch scoping is a first-class concept enforced in the Server Actions, page loaders, and proxy middleware.

- Most records carry a `branchId`.
- Managers and floor staff are confined to their assigned branch by `requireBranchAccess()` in the actions layer and by server-side filtering in each page loader.
- Global admins (`admin`, `owner`) and `readonly` analysts can see all branches.
- Adding a branch is a data operation (insert into `branches` table via Drizzle ORM) — no code changes required.

---

## Module status

**Every module is implemented.** The portal ships with:

- Dashboard, Staff & Positions, Attendance, Payroll, EOD Entry, Expenses, Vendors, Inventory, Menu, POS / Billing / KOT, Reports, Branches, and Settings.

Admins can turn individual modules **on/off globally** from Settings via the `config` table (see DOC-02 and DOC-13). When a module is toggled off it disappears from the navigation sidebar and its dashboard alerts are suppressed. The toggleable modules are: attendance, payroll, vendors, inventory, menu, pos, reports.

---

## What is NOT in the codebase

- No customer-facing ordering, table booking, or delivery aggregator integration (Swiggy/Zomato).
- No staff self-service portal (staff do not log in to personal HR apps).
- No automatic recipe-level inventory deduction from POS sales (inventory adjustments are logged manually).
- No SMS/WhatsApp/email notifications — alerts are in-app only.
- No PDF salary-slip generation, no Excel export, and no "export data dump" (CSV export exists only in Reports and POS History).
- No accounting-software or external payment-gateway SDK integration.

---

## Key global rules (as implemented)

1. **Soft deletes** — core entities (staff, branches, departments, roles, inventory, menu items, users) use `isActive: false` + `deletedAt` and are filtered out of active views. Some collections (expenses, categories, staff requirements) use hard deletion.
2. **Audit logging** — sensitive mutations call `logAction()` which writes to the `audit_logs` table (capped at 3000 entries with rolling trimming). Coverage spans staff mutations, attendance saves, day-end saves, expense edits/deletions, and POS order voids.
3. **Monetary values are integers** — Zod schemas validate amounts with `z.number().int()`.
4. **IST for "today" logic** — date-sensitive checks compute today's date in Asia/Kolkata.
5. **Branch scoping** — never returns another branch's data to a manager or floor worker; enforced in both the action and the page loader / proxy.
6. **One EOD entry per branch per day** — enforced in database by updating the existing `(date, branchId)` record inside an atomic transaction.
7. **One attendance record per staff per day** — enforced by upserting on `(date, staffId)`.
8. **One payroll record per staff per month** — deterministic id `pay_{month}_{year}_{staffId}`, and a save replaces all rows for that month/year.
9. **Atomic database transactions** — multi-table writes execute with `withDbTransaction<T>`.

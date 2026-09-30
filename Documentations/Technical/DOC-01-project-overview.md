# DOC-01 · Project Overview
**Version:** v2.0
**Last updated:** 2026-09-30

---

## What this app is

**Sree Vaishnaves Management** is a web application for a vegetarian restaurant business in Kannur, Kerala. The repository contains two distinct surfaces served by one Next.js app:

1. **A public marketing website** at `/` — a static, single-page hotel/restaurant site (hero, about, menu, gallery, contact) built from a Bootstrap template. It is fully public and requires no authentication.
2. **A management portal** at `/management/*` — the actual operations tool used by the owner, managers, and analysts to run the business. This is what the rest of the documentation is about.

The management portal replaces manual processes: paper attendance, notebook salary calculations, cash-book expense tracking, and verbal stock/vendor management.

---

## Business context

- Restaurant chain "Sree Vaishnaves" with **multiple branches** (seed data ships two: "Sree Vaishnaves" and "Vaishnaves Classic").
- Roughly **35 staff per branch** across kitchen, service, utility, accounts, and management departments.
- Primary devices: the owner uses a **mobile phone**; managers/developers use a laptop. The UI is responsive and mobile-first (a collapsible sidebar on mobile).
- All monetary values are in **Indian Rupees (INR)** and stored as **integers** (no paise).
- Service types: **dine-in and takeaway**. No delivery-platform integration.
- Language: English UI only.
- Timezone: business logic that depends on "today" uses **IST (Asia/Kolkata)** via `toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })`.

---

## Users and roles

There are exactly **four roles**, derived from the `role` field on each user record and expanded into capability flags inside the JWT (see DOC-04):

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
- Can manage staff, attendance, EOD, expenses (add only), vendors, inventory, and menu availability **for their branch only**.
- Cannot mark payroll as paid, cannot edit/delete ledger expenses, cannot manage branches, cannot open Settings.

### `readonly`
- Analyst / view-only access across branches for reporting.
- Sees data but the EOD entry page redirects them away, and create/edit/delete controls are hidden.

> Note: `admin` and `owner` both satisfy the `isGlobalAdmin` check used throughout the Server Actions. `admin` additionally satisfies `isRootAdmin` (Settings access). `owner` additionally satisfies `isGlobalOwner`.

---

## Multi-branch design

Branch scoping is a first-class concept enforced in the Server Actions and page loaders.

- Most records carry a `branchId`.
- Managers are confined to their assigned branch by `requireBranchAccess()` in the actions layer and by server-side filtering in each page loader.
- Global admins (`admin`, `owner`) and `readonly` analysts can see all branches.
- Adding a branch is a data operation (insert into `branches.json` via the Branches module) — no code changes required.

---

## Module status

**Every module is implemented.** The portal ships with:

- Dashboard, Staff & Positions, Attendance, Payroll, EOD Entry, Expenses, Vendors, Inventory, Menu, Reports, Branches, and Settings.

Admins can turn individual modules **on/off globally** from Settings via `config.json` (see DOC-02 and DOC-13). When a module is toggled off it disappears from the navigation sidebar and its dashboard alerts are suppressed. The toggleable modules are: attendance, payroll, vendors, inventory, menu, reports.

---

## What is NOT in the codebase

- No customer-facing ordering, table booking, or delivery integration.
- No staff self-service portal (staff do not log in).
- No POS/billing (the EOD `billing` sub-object captures summary billing figures manually, but there is no order-taking POS).
- No SMS/WhatsApp/email notifications — alerts are in-app only.
- No PDF salary-slip generation, no Excel export, and no "export data dump" (CSV export exists only in Reports).
- No accounting-software or payment-gateway integration.

---

## Key global rules (as implemented)

1. **Soft deletes** — core entities (staff, branches, departments, roles, inventory, menu items, users) use `isActive: false` + `deletedAt` and are filtered out of active views. Some collections (expenses, categories, staff requirements) use hard array removal.
2. **Audit logging** — a subset of mutations call `logAction()` which appends to `audit_logs.json` (capped at 3000 entries). Coverage is partial, not universal (see DOC-02). There is no audit-log UI.
3. **Monetary values are integers** — Zod schemas validate amounts with `z.number().int()`.
4. **IST for "today" logic** — date-sensitive checks compute today's date in Asia/Kolkata.
5. **Branch scoping** — never returns another branch's data to a manager; enforced in both the action and the page loader.
6. **One EOD entry per branch per day** — enforced in code by finding an existing `(date, branchId)` entry and updating it.
7. **One attendance record per staff per day** — enforced in code by upserting on `(date, staffId)`.
8. **One payroll record per staff per month** — the payroll record id is deterministic: `pay_{month}_{year}_{staffId}`, and a save replaces all rows for that month/year.

# DOC-00 · Master Index
**Project:** Sree Vaishnaves — Restaurant Management System
**Version:** v2.0
**Last updated:** 2026-09-30
**Status:** Reflects the implemented codebase (all modules built)

---

## How to use this documentation system

This is a modular technical documentation set that describes the **actual implemented system** as it exists in the repository. Each document is self-contained but references others where needed. These docs are the source of truth for how the code behaves today — not a forward-looking plan.

### Rules
1. **Always read DOC-01 + DOC-02 + DOC-03 + DOC-04** first — they define the app identity, architecture, JSON data model, and the authentication/role model that every module depends on.
2. **Then read the relevant module doc(s)** for whatever you are working on.
3. When code changes, update the matching doc in the same change so the docs never drift from reality.
4. **Version numbers** increment on every meaningful change. Check the header before relying on a doc.

---

## Ground truth (read before anything else)

The single most important fact about this system: **there is no REST API and there are no `/api/v1` routes.** All server-side logic is implemented as **Next.js App Router Server Actions** (`'use server'` functions in `src/app/actions/*.ts`) called directly from React components. Persistence is a **JSON-blob store**: one PostgreSQL table (`json_store`) whose rows each hold a stringified JSON array (one row per logical collection). See DOC-02 and DOC-03.

There are **four roles**: `admin` (root/system), `owner`, `manager` (branch-scoped), and `readonly`. See DOC-04.

Every feature module described below is **already implemented** in the codebase. There is no unbuilt "Phase 2/3" work remaining for Inventory, Vendors, or Reports — those pages, actions, and tests all exist.

---

## Document registry

### Foundation docs — read first
| Doc | File | Purpose |
|-----|------|---------|
| DOC-01 | `DOC-01-project-overview.md` | App identity, business context, roles, scope |
| DOC-02 | `DOC-02-architecture-and-stack.md` | Tech stack, folder structure, Server Action conventions, JSON store |
| DOC-03 | `DOC-03-database-schema.md` | Every JSON blob shape, the two real Postgres tables, conventions |
| DOC-04 | `DOC-04-auth-and-roles.md` | JWT session, the four roles, branch sandboxing, middleware |

### Module docs
| Doc | File | Covers |
|-----|------|--------|
| DOC-05 | `DOC-05-staff-and-payroll.md` | Staff CRUD, position requirements, schedules, payroll calculation |
| DOC-06 | `DOC-06-attendance.md` | Daily attendance marking, statuses, 7-day time-lock |
| DOC-07 | `DOC-07-eod-entry.md` | EOD income, billing/ops sub-records, cash reconciliation, locking |
| DOC-08 | `DOC-08-expense-ledger.md` | Shared expense ledger, EOD vs vendor source, categories |
| DOC-09 | `DOC-09-menu-management.md` | Global menu items/categories, per-branch availability & price overrides |
| DOC-10 | `DOC-10-inventory.md` | Stock items, adjustments, low-stock thresholds |
| DOC-11 | `DOC-11-vendors.md` | Vendor profiles, vendor bills into the ledger, paid/unpaid |
| DOC-12 | `DOC-12-reports-and-analytics.md` | P&L, salary %, GST/covers metrics, CSV export |
| DOC-13 | `DOC-13-dashboard.md` | Home dashboard, KPI cards, pending actions, branch status |
| DOC-14 | `DOC-14-notifications.md` | In-app pending-action alerts (computed, not stored) |

---

## Module ↔ code map

| Module | Page route | Client component | Server actions |
|--------|-----------|------------------|----------------|
| Dashboard | `/management` | inline in `page.tsx` | reads via `readJSON` |
| Staff | `/management/staff` | `StaffClientPage.tsx` | `staff.ts`, `staff_requirements.ts` |
| Attendance | `/management/attendance` | `AttendanceClientPage.tsx` | `attendance.ts` |
| Payroll | `/management/payroll` | `PayrollClientPage.tsx` | `salary.ts` |
| EOD Entry | `/management/eod` | `EODClientPage.tsx` | `eod.ts` |
| Expenses | `/management/expenses` | `ExpensesClientPage.tsx` | `expenses.ts` |
| Vendors | `/management/vendors` | `VendorsClientPage.tsx` | `vendors.ts` |
| Inventory | `/management/inventory` | `InventoryClientPage.tsx` | `inventory.ts` |
| Menu | `/management/menu` | `MenuClientPage.tsx` | `menu.ts`, `menu_categories.ts` |
| Reports | `/management/reports` | `ReportsClientPage.tsx` | reads via `readJSON` |
| Branches | `/management/branches`, `/branches/[id]` | `BranchesClientPage.tsx` | `branches.ts` |
| Settings | `/management/settings` | `SettingsClientPage.tsx` | `settings.ts`, `categories.ts`, `menu_categories.ts`, `config.ts`, `users.ts` |
| Auth | `/management/login` | `login/page.tsx` | `auth.ts` |
| Public website | `/` | `(website)/page.tsx` | none (static) |

---

## Change log
| Version | Date | What changed |
|---------|------|--------------|
| v2.0 | 2026-09-30 | Rewritten to match the implemented codebase: Server Actions (no REST), JSON-blob store, four roles, all modules built. |
| v1.0 | 2026-03-15 | Initial planning-phase documentation set. |

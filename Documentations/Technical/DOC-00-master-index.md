# DOC-00 · Master Index
**Project:** Sree Vaishnaves — Restaurant Management System
**Version:** v3.0
**Last updated:** 2026-11-02
**Status:** Reflects the implemented codebase (normalized RDBMS + POS)

---

## How to use this documentation system

This is a modular technical documentation set that describes the **actual implemented system** as it exists in the repository. Each document is self-contained but references others where needed. These docs are the source of truth for how the code behaves today — not a forward-looking plan.

### Rules
1. **Always read DOC-01 + DOC-02 + DOC-03 + DOC-04** first — they define the app identity, architecture, normalized RDBMS schema, and the authentication/role model that every module depends on.
2. **Then read the relevant module doc(s)** for whatever you are working on.
3. When code changes, update the matching doc in the same change so the docs never drift from reality.
4. **Version numbers** increment on every meaningful change. Check the header before relying on a doc.

---

## Ground truth (read before anything else)

The single most important architectural fact: **there is no REST API and there are no `/api/v1` routes.** All server-side logic is implemented as **Next.js App Router Server Actions** (`'use server'` functions in `src/app/actions/*.ts`) called directly from React components. Persistence is a **normalized PostgreSQL database (27 tables)** managed by Drizzle ORM, connected via a unified `postgres-js` client (`db/index.ts`). Multi-entity atomic operations run inside `withDbTransaction<T>`. See DOC-02 and DOC-03.

There are **seven roles**: `admin` (root/system), `owner`, `manager` (branch-scoped), `readonly`, `waiter`, `kitchen`, and `billing`. Operational floor roles (`waiter`, `kitchen`, `billing`) are page-locked to dedicated POS interfaces with navigation sidebars suppressed in `src/proxy.ts`. See DOC-04.

Every feature module described below is **already implemented** in the codebase, including a complete Point of Sale (POS) and Kitchen Order Ticket (KOT) workflow with live prefill into Day-End (EOD) entries.

---

## Document registry

### Foundation docs — read first
| Doc | File | Purpose |
|-----|------|---------|
| DOC-01 | `DOC-01-project-overview.md` | App identity, business context, roles, scope |
| DOC-02 | `DOC-02-architecture-and-stack.md` | Tech stack, folder structure, Server Action conventions, normalized RDBMS |
| DOC-03 | `DOC-03-database-schema.md` | 27 normalized relational tables, primary keys, indexes, and constraints |
| DOC-04 | `DOC-04-auth-and-roles.md` | JWT session, the seven roles, branch sandboxing, POS route locking, middleware |

### Module docs
| Doc | File | Covers |
|-----|------|--------|
| DOC-05 | `DOC-05-staff-and-payroll.md` | Staff CRUD, position requirements, schedules, payroll calculation |
| DOC-06 | `DOC-06-attendance.md` | Daily attendance marking, statuses, 7-day time-lock |
| DOC-07 | `DOC-07-eod-entry.md` | EOD income, billing/ops sub-records, cash reconciliation, POS prefill, locking |
| DOC-08 | `DOC-08-expense-ledger.md` | Shared expense ledger, EOD vs vendor source, categories |
| DOC-09 | `DOC-09-menu-management.md` | Global menu items/categories, per-branch availability & price overrides, variants |
| DOC-10 | `DOC-10-inventory.md` | Stock items, adjustments, low-stock thresholds |
| DOC-11 | `DOC-11-vendors.md` | Vendor profiles, vendor bills into the ledger, paid/unpaid |
| DOC-12 | `DOC-12-reports-and-analytics.md` | P&L, salary %, GST/covers metrics, CSV export |
| DOC-13 | `DOC-13-dashboard.md` | Home dashboard, KPI cards, pending actions, branch status |
| DOC-14 | `DOC-14-notifications.md` | In-app pending-action alerts (computed, not stored) |

---

## Module ↔ code map

| Module | Page route | Client component | Server actions / Data Loader |
|--------|-----------|------------------|------------------------------|
| Dashboard | `/management` | inline in `page.tsx` | Drizzle ORM queries |
| Staff | `/management/staff` | `StaffClientPage.tsx` | `staff.ts`, `staff_requirements.ts` |
| Attendance | `/management/attendance` | `AttendanceClientPage.tsx` | `attendance.ts` |
| Payroll | `/management/payroll` | `PayrollClientPage.tsx` | `salary.ts` |
| EOD Entry | `/management/eod` | `EODClientPage.tsx` | `eod.ts` |
| Expenses | `/management/expenses` | `ExpensesClientPage.tsx` | `expenses.ts` |
| Vendors | `/management/vendors` | `VendorsClientPage.tsx` | `vendors.ts` |
| Inventory | `/management/inventory` | `InventoryClientPage.tsx` | `inventory.ts` |
| Menu | `/management/menu` | `MenuClientPage.tsx` | `menu.ts`, `menu_categories.ts` |
| POS Main | `/management/pos` | `PosClientPage.tsx` | `pos.ts` |
| POS Waiter | `/management/pos/order` | `PosOrderClientPage.tsx` | `pos.ts` |
| POS Billing | `/management/pos/billing` | `PosBillingClientPage.tsx` | `pos.ts` |
| POS Kitchen | `/management/pos/kitchen` | `PosKitchenClientPage.tsx` | `pos.ts` |
| POS History | `/management/pos/history` | `PosHistoryClientPage.tsx` | `pos.ts` |
| Reports | `/management/reports` | `ReportsClientPage.tsx` | Drizzle ORM queries |
| Branches | `/management/branches`, `/branches/[id]` | `BranchesClientPage.tsx` | `branches.ts` |
| Settings | `/management/settings` | `SettingsClientPage.tsx` | `settings.ts`, `categories.ts`, `menu_categories.ts`, `config.ts`, `users.ts` |
| Auth | `/management/login` | `login/page.tsx` | `auth.ts` |
| Public website | `/` | `(website)/page.tsx` | none (static) |

---

## Change log
| Version | Date | What changed |
|---------|------|--------------|
| v3.0 | 2026-11-02 | Fully upgraded to normalized PostgreSQL schema (27 tables) via Drizzle ORM; added 7 roles (including waiter, kitchen, billing); added full POS, KOT, and Billing module with EOD prefill; single postgres-js driver; eliminated legacy json_store, mutex, and readJSON/writeJSON. |
| v2.0 | 2026-09-30 | Rewritten to match the implemented codebase: Server Actions (no REST), JSON-blob store, four roles, all modules built. |
| v1.0 | 2026-03-15 | Initial planning-phase documentation set. |

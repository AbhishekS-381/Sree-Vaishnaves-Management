# Sree Vaishnaves Management — High Level Design
**Document type:** High Level Design (HLD)
**Version:** v3.0
**Date:** 2026-11-02
**Status:** Reflects the implemented normalized RDBMS system

---

# Part 1 — System Overview

## 1.1 What this document covers

This HLD describes the architecture of the implemented Sree Vaishnaves Management System — how it is structured, how components communicate, where data flows, and the key design decisions. Module-level detail is in `Documentations/Technical/DOC-01..DOC-14`.

## 1.2 System context

```
┌───────────────────────────────────────────────────────────┐
│                     EXTERNAL WORLD                         │
│   Owner's phone      Manager's laptop/phone   Customers    │
│        │                    │                     │        │
│        └──────── /management ┘                    │ /      │
│                     │ HTTPS                        │ HTTPS  │
└─────────────────────┼──────────────────────────────┼───────┘
                      │                              │
┌─────────────────────▼──────────────────────────────▼───────┐
│                 NEXT.JS APPLICATION                         │
│                                                            │
│  Public website (/)          Management portal (/management)│
│  static RSC page             React components               │
│         │                          │ direct call            │
│         │                          ▼                        │
│         │                 Server Actions ('use server')     │
│         │                 auth, staff, pos, eod, expenses…  │
│         │                          │                        │
│         │              ┌───────────▼───────────┐            │
│         │              │ Normalized PostgreSQL │            │
│         │              │ 27 tables + rate_limit│            │
│         │              │ (Drizzle ORM / psql)  │            │
│         │              └───────────────────────┘            │
└────────────────────────────────────────────────────────────┘
```

There are no third-party service integrations. No external APIs are called for business logic. Data leaves the system only via manual CSV export from Reports or POS Order History. Image assets and fonts are loaded from allow-listed CDNs per the CSP.

## 1.3 The architecture in three layers

**Layer 1 — UI (React / Next.js App Router).** Server components load data; client components (`*ClientPage.tsx`, modals, POS stations) handle interaction. The UI calls Server Actions directly — there is no REST client and no `/api` layer.

**Layer 2 — Server Actions (`src/app/actions/*.ts`).** All business rules, authorization, validation (Zod), and persistence orchestration live here. This is where salary is computed, day-end locks are enforced, POS KOT deltas are fired, split payments are validated, and branch scoping is applied.

**Layer 3 — Persistence (`db/schema.ts`, `db/index.ts`, `src/lib/db.ts` over PostgreSQL).** A fully normalized relational database: 27 PostgreSQL tables defined in Drizzle ORM, plus a `rate_limit` table. Access is via typed Drizzle queries and atomic ACID transactions via `withDbTransaction<T>`. Connections are managed through a unified `postgres-js` client using `DATABASE_URL` (with optional strict SSL verification via `AIVEN_CA_CERT`).

---

# Part 2 — Data Model (high level)

## 2.1 Organisation

Most records carry a `branchId`, making multi-branch scoping the backbone of the model.

```
BUSINESS
 ├── Branch (operational | maintenance | closed)
 │     ├── Staff → Attendance → Payroll
 │     │     └── mapped to Position slots (staff_requirements + schedules)
 │     ├── POS / Billing / KOT (Orders → KOTs → Payments → Order History)
 │     ├── Day-End (EOD) entries (prefilled by POS) → Expenses (source: eod)
 │     ├── Vendors → Vendor bills (Expenses source: vendor)
 │     ├── Inventory items → Stock adjustments
 │     └── Per-branch menu overrides (price/availability)
 ├── Global menu items, categories, & variants
 ├── Global expense categories
 ├── Users (admin/owner/manager/readonly/billing/kitchen/waiter)
 └── Config (module toggles) · Audit logs
```

Primary entities feature surrogate BigSerial primary keys (`pk`) alongside indexed application identifiers (`id`). Foreign references are normalized across tables. Multi-table operations maintain strict relational consistency.

## 2.2 The shared expense ledger

One `expenses` table is written by two flows and tagged with `source` (`eod` | `vendor`). The day-end screen inserts/replaces its own day's rows atomically inside `withDbTransaction`; vendor bills insert `vendor` rows; owners/admins edit or delete any row via the Expenses screen. Reports read the whole ledger.

## 2.3 Attendance → payroll

Payroll does not store its own day counts as truth; the payroll screen **pre-fills days-worked from attendance** (present = 1, half-day = 0.5) and the operator may override before saving. The payable is `max(0, round(monthlySalary/30 × daysWorked) − advances)`. Saving a month replaces that month's records; there is no lock that freezes attendance.

## 2.4 POS → Day-End prefill

Settled POS orders automatically feed Day-End revenue prefill via `getPosDataForEOD`: dine-in vs takeaway splits, cash vs UPI breakdowns, GST collected, and customer covers.

---

# Part 3 — Key Design Decisions

## 3.1 Server Actions instead of a REST API
All server logic is invoked as Next.js Server Actions directly from components. This removes an HTTP/controller layer and keeps validation, authorization, and persistence colocated per operation. The trade-off is that there is no externally consumable API surface.

## 3.2 Normalized relational database (Drizzle ORM) instead of JSON-blob store
State is stored in 27 normalized relational tables in PostgreSQL managed by Drizzle ORM. Multi-table operations (e.g. Day-End upsert + expense replacement, POS bill settlement, stock adjustments) execute within atomic ACID transactions (`withDbTransaction<T>`), guaranteeing strong consistency, eliminating concurrency bottlenecks and in-process mutexes, and enforcing database-level integrity (including partial unique indexes such as single open orders per table).

## 3.3 Multi-branch from the ground up
Branch scoping is enforced twice — in the action (`requireBranchAccess`) and in each page loader — so a manager can never read or write another branch's data. Adding a branch is a data operation.

## 3.4 Soft deletion (mostly)
Core entities (staff, branches, departments, roles, inventory, menu items, users) are soft-deleted (`isActive:false` + `deletedAt`) and filtered from active views. A few collections (expenses, expense categories, staff requirements) are hard-removed. This is a deliberate, documented inconsistency rather than a universal rule.

## 3.5 Module toggles
An admin can switch modules on/off globally via the `config` table. Disabled modules disappear from navigation and stop raising dashboard alerts, letting the business grow into complexity.

---

# Part 4 — User Experience Flow

## 4.1 Owner's typical day
```
MORNING   Dashboard → note any alert (attendance/EOD/payroll/low-stock)
          → open Attendance for a branch, mark all present, tap exceptions
DAY       Monitor POS live table grid, daily summary, and order flow
EVENING   Day-End Entry: income (prefilled from POS) + expenses → Save
MONTH END Payroll: review days (from attendance), enter advances, Save, Mark Paid
          Reports: revenue, expenses, salary %, net profit → CSV export
```

## 4.2 Manager's typical day
Own branch only: mark attendance, manage POS orders and kitchen dispatch, fill day-end, add expenses/vendor bills, adjust inventory, flip menu availability. Can view payroll drafts and reports for their branch but cannot mark paid or edit the ledger.

## 4.3 Operational POS Staff (Role-Locked)
- **Waiter (`waiter`):** Page-locked to `/management/pos/order`. Selects tables, adds items/notes, fires incremental KOTs. No financial summaries or bill generation.
- **Kitchen Staff (`kitchen`):** Page-locked to `/management/pos/kitchen`. Views live KOT ticket queue in FIFO order (polling every 30s), advances tickets from PENDING → PREPARING → READY. Zero pricing or billing information visible.
- **Billing Clerk (`billing`):** Page-locked to `/management/pos/billing`. Selects billed/ready orders, applies approved discounts/GST, records cash/UPI/split payments, calculates change due, and prints thermal receipts.

---

# Part 5 — Security Model

## 5.1 Authentication
Server-Action login: dual-axis rate limiting (per IP 10/min, per username 20/hour, 5-min block, fails open), bcrypt password check, a 2-hour HS256 JWT stored in an `HttpOnly`, `SameSite=strict` cookie. `src/proxy.ts` gates all `/management/*` routes; page loaders add role-specific redirects.

## 5.2 Authorization (capability summary)
```
CAPABILITY                         admin  owner  manager  readonly  waiter  kitchen  billing
View all branches                   ✓      ✓      own       ✓        own      own      own
Open Settings                       ✓      ✗       ✗        ✗         ✗        ✗        ✗
Manage branches/users/categories    ✓      ✓       ✗        ✗         ✗        ✗        ✗
Manage staff / attendance / EOD     ✓      ✓      own       ✗         ✗        ✗        ✗
Edit/delete ledger expenses         ✓      ✓       ✗        ✗         ✗        ✗        ✗
Mark payroll paid                   ✓      ✓       ✗        ✗         ✗        ✗        ✗
Edit locked / >24h EOD              ✓      ✓       ✗        ✗         ✗        ✗        ✗
View reports                        ✓      ✓      own       ✓         ✗        ✗        ✗
Create orders / Fire KOTs           ✓      ✓      own       ✗        own       ✗        ✗
Advance KOT status                  ✓      ✓      own       ✗         ✗       own       ✗
Generate bills / Settle payments    ✓      ✓      own       ✗         ✗        ✗       own
```
`isGlobalAdmin` = admin or owner; `isRootAdmin` = admin (Settings); `isGlobalOwner` = owner; `posRole` = true for operational staff (sandboxed to designated interfaces with navigation headers hidden).

## 5.3 Audit trail
`logAction()` writes to the `audit_logs` relational table with BigSerial surrogate `pk` and rolling cap trimming keeping the newest 3000 records. Coverage spans staff actions, attendance saves, day-end saves, expense edits/deletions, and POS order voids.

## 5.4 Transport & headers
`next.config.ts` sets HSTS, `X-Frame-Options: DENY`, `nosniff`, a strict `Content-Security-Policy`, and `Cache-Control: no-store` globally.

## 5.5 Known security gaps (documented)
- No password-complexity enforcement (login only requires non-empty fields).
- Rate limiter fails open on DB errors.

---

# Part 6 — Deployment & Environments

- **Target:** Netlify with PostgreSQL (Aiven, Neon, Supabase, or Netlify DB). Single unified `postgres-js` client selected via `DATABASE_URL` (with optional `AIVEN_CA_CERT` for strict SSL verification).
- **Migrations:** Drizzle ORM schema migrations in `netlify/database/migrations/` and `scripts/migrate-from-json-store.ts`.
- **Seeding:** `npm run db:seed` (also run during build) idempotently upserts default departments, roles, categories, branches, global config, and the seeded admin/owner users.
- **Required env:** `JWT_SECRET` (app throws without it), `DATABASE_URL`. Optional: `AIVEN_CA_CERT`, `ADMIN_PASSWORD`, `SECURE_COOKIE`, `NODE_ENV`.

---

# Part 7 — Testing

- **Unit:** Vitest (jsdom) covers actions, lib, hooks, middleware, and most components, with coverage thresholds configured in `vitest.config.ts` (backend ≥90%, several lib files at 100%). Tests mock `@/lib/db` and the auth session.
- **Integration:** Playwright (`test/integration`) drives the app in Chromium.
- **Git hooks:** Husky runs the test suite on pre-commit and coverage on pre-push.

---

*End of High Level Design.*
*Related: PRODUCT-REQUIREMENTS-DOCUMENT.md, ../Technical/DOC-01 … DOC-14.*

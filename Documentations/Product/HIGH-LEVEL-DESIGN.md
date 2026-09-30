# Sree Vaishnaves Management — High Level Design
**Document type:** High Level Design (HLD)
**Version:** v2.0
**Date:** 2026-09-30
**Status:** Reflects the implemented system

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
│         │                 auth, staff, eod, expenses, …      │
│         │                          │                        │
│         │              ┌───────────▼───────────┐            │
│         │              │  JSON store (Postgres) │            │
│         │              │  json_store + rate_limit│           │
│         │              └────────────────────────┘            │
└────────────────────────────────────────────────────────────┘
```

There are no third-party service integrations. No external APIs are called for business logic. Data leaves the system only via manual CSV export from Reports. Image assets and fonts are loaded from allow-listed CDNs per the CSP.

## 1.3 The architecture in three layers

**Layer 1 — UI (React / Next.js App Router).** Server components load data; client components (`*ClientPage.tsx`, modals) handle interaction. The UI calls Server Actions directly — there is no REST client and no `/api` layer.

**Layer 2 — Server Actions (`src/app/actions/*.ts`).** All business rules, authorization, validation (Zod), and persistence orchestration live here. This is where salary is computed, day-end locks are enforced, and branch scoping is applied.

**Layer 3 — Persistence (`src/lib/db.ts` over Postgres).** A JSON-blob store: one `json_store` table holding one row per collection (stringified JSON array), plus a `rate_limit` table for login throttling. Access is via `readJSON` / `writeJSON` / `withTransaction` (an in-process per-file mutex). The DB driver is Neon HTTP in dev and native Netlify DB in production.

---

# Part 2 — Data Model (high level)

## 2.1 Organisation

Most records carry a `branchId`, making multi-branch scoping the backbone of the model.

```
BUSINESS
 ├── Branch (operational | maintenance | closed)
 │     ├── Staff → Attendance → Payroll
 │     │     └── mapped to Position slots (staff_requirements + schedules)
 │     ├── Day-End (EOD) entries → Expenses (source: eod)
 │     ├── Vendors → Vendor bills (Expenses source: vendor)
 │     ├── Inventory items → Stock adjustments
 │     └── Per-branch menu overrides (price/availability)
 ├── Global menu items & categories
 ├── Global expense categories
 ├── Users (admin/owner/manager/readonly)
 └── Config (module toggles) · Audit logs
```

Relationships are logical (id matching in code), not SQL foreign keys. IDs are prefixed UUIDs; payroll and config use deterministic ids.

## 2.2 The shared expense ledger

One `expenses` collection is written by two flows and tagged with `source` (`eod` | `vendor`). The day-end screen inserts/replaces its own day's rows; vendor bills insert `vendor` rows; owners/admins edit or delete any row via the Expenses screen. Reports read the whole ledger.

## 2.3 Attendance → payroll

Payroll does not store its own day counts as truth; the payroll screen **pre-fills days-worked from attendance** (present = 1, half-day = 0.5) and the operator may override before saving. The payable is `max(0, round(monthlySalary/30 × daysWorked) − advances)`. Saving a month replaces that month's records; there is no lock that freezes attendance.

---

# Part 3 — Key Design Decisions

## 3.1 Server Actions instead of a REST API
All server logic is invoked as Next.js Server Actions directly from components. This removes an HTTP/controller layer and keeps validation, authorization, and persistence colocated per operation. The trade-off is that there is no externally consumable API surface.

## 3.2 JSON-blob store instead of relational tables
State is stored as JSON arrays in a single table. This is simple to reason about and cheap to evolve (no migrations per field), and fits a small single-business dataset. The trade-offs, made explicit: writes are whole-array read-modify-write guarded by an **in-process** mutex, so concurrent writes across multiple serverless instances are effectively last-write-wins; and there is no relational integrity — consistency is enforced in code.

## 3.3 Multi-branch from the ground up
Branch scoping is enforced twice — in the action (`requireBranchAccess`) and in each page loader — so a manager can never read or write another branch's data. Adding a branch is a data operation.

## 3.4 Soft deletion (mostly)
Core entities (staff, branches, departments, roles, inventory, menu items, users) are soft-deleted (`isActive:false` + `deletedAt`) and filtered from active views. A few collections (expenses, expense categories, staff requirements) are hard-removed. This is a deliberate, documented inconsistency rather than a universal rule.

## 3.5 Module toggles
An admin can switch modules on/off globally via `config.json`. Disabled modules disappear from navigation and stop raising dashboard alerts, letting the business grow into complexity.

---

# Part 4 — User Experience Flow

## 4.1 Owner's typical day
```
MORNING   Dashboard → note any alert (attendance/EOD/payroll/low-stock)
          → open Attendance for a branch, mark all present, tap exceptions
DAY       app idle
EVENING   Day-End Entry: income + expenses + optional float/billing/ops → Save
MONTH END Payroll: review days (from attendance), enter advances, Save, Mark Paid
          Reports: revenue, expenses, salary %, net profit → CSV export
```

## 4.2 Manager's typical day
Own branch only: mark attendance, fill day-end, add expenses/vendor bills, adjust inventory, flip menu availability. Can view payroll drafts and reports for their branch but cannot mark paid or edit the ledger.

---

# Part 5 — Security Model

## 5.1 Authentication
Server-Action login: dual-axis rate limiting (per IP 10/min, per username 20/hour, 5-min block, fails open), bcrypt password check, a 2-hour HS256 JWT stored in an `HttpOnly`, `SameSite=strict` cookie. `src/proxy.ts` gates all `/management/*` routes; page loaders add role-specific redirects.

## 5.2 Authorization (capability summary)
```
CAPABILITY                         admin  owner  manager  readonly
View all branches                   ✓      ✓      own       ✓
Open Settings                       ✓      ✗       ✗        ✗
Manage branches/users/categories    ✓      ✓       ✗        ✗
Manage staff / attendance / EOD     ✓      ✓      own       ✗
Edit/delete ledger expenses         ✓      ✓       ✗        ✗
Mark payroll paid                   ✓      ✓       ✗        ✗
Edit locked / >24h EOD              ✓      ✓       ✗        ✗
View reports                        ✓      ✓      own       ✓
```
`isGlobalAdmin` = admin or owner; `isRootAdmin` = admin (Settings); `isGlobalOwner` = owner.

## 5.3 Audit trail
`logAction()` appends `{ id, timestamp, userId, userName, action, entityType, entityId?, details }` to `audit_logs.json`, capped at 3000 entries. Coverage is **partial** (staff create/delete, attendance save, day-end save, expense edit/delete). There is no audit-log UI and the log is not tamper-evident.

## 5.4 Transport & headers
`next.config.ts` sets HSTS, `X-Frame-Options: DENY`, `nosniff`, a strict `Content-Security-Policy`, and `Cache-Control: no-store` globally.

## 5.5 Known security gaps (documented)
- No password-complexity enforcement (login only requires non-empty fields).
- Rate limiter fails open on DB errors.
- SQL migrations commit a plaintext bootstrap admin password and a hardcoded Postgres role password — these must be rotated and removed from source.

---

# Part 6 — Deployment & Environments

- **Target:** Netlify (native Netlify DB in production; Neon HTTP driver in dev, selected by the `NETLIFY` env flag).
- **Migrations:** SQL under `netlify/database/migrations/` create `json_store` and `rate_limit` (and the bootstrap admin).
- **Seeding:** `npm run db:seed` (also run at the end of `npm run build`) upserts default departments, roles, categories, branches, config, and the seeded owner user.
- **Required env:** `JWT_SECRET` (app throws without it), `DATABASE_URL` (dev). Optional: `SECURE_COOKIE`, `NETLIFY`, `NODE_ENV`.

---

# Part 7 — Testing

- **Unit:** Vitest (jsdom) covers actions, lib, hooks, middleware, and most components, with coverage thresholds configured in `vitest.config.ts` (backend ≥90%, several lib files at 100%). Tests mock `@/lib/db` and the auth session.
- **Integration:** Playwright (`test/integration`) drives the app in Chromium.
- **Git hooks:** Husky runs the test suite on pre-commit and coverage on pre-push.

---

*End of High Level Design.*
*Related: PRODUCT-REQUIREMENTS-DOCUMENT.md, ../Technical/DOC-01 … DOC-14.*

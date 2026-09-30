# Current State

## Status
- **Fully built management portal** plus a static public marketing website, served by one Next.js app.
- All portal modules are implemented; several are toggleable per branch business via `config.json`.

## Tech Stack
- **Next.js 16** (App Router, Server Actions) + **React 19** + **TypeScript 5**
- **Tailwind CSS v4**
- **Drizzle ORM** over PostgreSQL — Neon HTTP driver in dev, native Netlify DB in production
- **Persistence:** JSON-blob store (`json_store` table, one row per collection) + `rate_limit` table
- **Auth:** jose JWT (2h, HS256) in an HttpOnly cookie; bcrypt password hashing; Zod validation
- **Testing:** Vitest (unit) + Playwright (integration); Husky git hooks
- **Theme:** dark UI with a lavender/lilac accent

## Roles
Four roles with JWT capability flags:
- **admin** — root; only role with Settings access; full cross-branch (`isRootAdmin`, `isGlobalAdmin`).
- **owner** — full cross-branch operations, no Settings (`isGlobalAdmin`, `isGlobalOwner`).
- **manager** — single assigned branch only.
- **readonly** — view dashboards and reports; no mutations.

## Delivered Features
- **Public website** (`/`): static hero/about/menu/gallery/contact page.
- **Authentication**: Server-Action login with dual-axis rate limiting (IP + username), bcrypt, 2h JWT cookie; middleware gate on `/management/*`.
- **Dashboard**: KPI cards (branches, active staff, today's collection, net balance), config-gated pending-action alerts, branch-status panel.
- **Staff & Positions**: staff CRUD (soft delete), budgeted position slots (`staff_requirements`), per-position shift schedules (≤3 shifts, ≥1h break, ≤10h, 05:00–23:00), auto-scheduler, and a coverage timeline.
- **Attendance**: mark-all-present + exceptions; statuses present/absent/half-day/holiday; 7-day edit window for managers; future dates blocked.
- **Payroll**: days-worked pre-filled from attendance (editable); payable = max(0, round(monthlySalary/30 × daysWorked) − advances); PENDING → mark PAID (owner/admin).
- **Day-End (EOD) Entry**: income (dine-in/takeaway × cash/UPI), optional cash-float reconciliation, optional billing and ops sub-records, zero-revenue confirmation, 24h lock (owner/admin override), daily expenses into the shared ledger.
- **Expenses**: shared ledger (source eod/vendor); edit/delete owner/admin-only; global expense categories.
- **Vendors**: supplier profiles and bills written to the ledger (source vendor) with paid/unpaid tracking.
- **Inventory**: items with integer quantities and thresholds; logged increase/decrease adjustments; low-stock alerts.
- **Menu**: global item/category catalog with per-branch price and availability overrides; categories reused as chef specialties.
- **Reports**: browser-computed revenue splits, MoM change, expenses by category, salary-as-%-of-revenue, net profit, GST/covers; CSV export.
- **Branches & Settings**: branch CRUD; admin-only master data (roles, departments, categories, users) and module toggles.
- **Cross-cutting**: soft deletion for core entities, partial audit logging (`audit_logs.json`, capped 3000), strict security headers/CSP.

## Known Gaps
- No PDF salary slips; no Excel export or "data dump" (Reports export is CSV only).
- Payroll advances are a plain number on the record (no advances ledger); no approval-lock that freezes attendance; fixed /30 divisor.
- Audit logging is partial and has no UI.
- JSON-blob writes are last-write-wins across serverless instances (single-instance mutex only).
- Migrations commit a plaintext bootstrap admin password and a hardcoded Postgres role password — rotate and remove from source.
- No POS/order-taking; no automatic inventory deduction; no external notifications.

## Verified Quality Gates (last checked 2026-09-30)

Results from actually running the toolchain (`npm install` → test → coverage → eslint → tsc). `next build` and Playwright were **not** run (build chains `db:seed`, which needs a live DB).

| Gate | Command | Result |
|------|---------|--------|
| Unit tests | `npm run test` | ✅ **PASS** — 420 passed / 5 skipped / 0 failed (44 files). Skipped = `lib/db.test.ts`. |
| Coverage gate | `npm run test:coverage` | ❌ **FAIL (exit 1)** — overall 90.65% stmts / 84.92% branch / 86.47% funcs / 93.33% lines, but `src/lib/audit.ts` misses its 100% threshold (93.75% stmts / 87.5% branch / 93.33% lines). |
| Lint | `npx eslint` | ❌ **FAIL (exit 1)** — 747 errors + 1613 warnings; **383 errors in `src/`** (mostly `@typescript-eslint/no-explicit-any` ≈604 total, `no-this-alias` ≈103 from the `Mutex`). |
| Type-check | `npx tsc --noEmit` | ❌ **FAIL (exit 1)** — but **0 errors in `src/`**; all 24 errors are in `test/` files (missing test globals like `vi`/`beforeEach`/`afterEach`, and fixture prop mismatches e.g. EOD tests missing `attendance`). |
| Production build | `next build` | ⚠️ **Not run.** `next.config.ts` sets neither `eslint.ignoreDuringBuilds` nor `typescript.ignoreBuildErrors`, so by default the build would fail at the lint step given the 383 src ESLint errors. |

**Coverage hotspots (weakest):** `src/components` overall ~71% stmts / ~69% lines — `RoleModal` 33%, `RequirementModal` 48%, `UserModal` 69%. `StaffModal`, `ScheduleTimeline`, `AutoScheduleModal`, and `lib/db.ts` are **excluded** from coverage in `vitest.config.ts`. Backend is strong: actions 90–100%, hooks ~95%, `middleware`/`jwt`/`utils`/`positionsSummary` at 100%.

**Readiness verdict:** functionally/runtime ready (production TS compiles clean; full unit suite green), but **NOT release-clean** — coverage, lint, and strict type-check gates currently fail.

## Page-by-Page Maturity

Legend: 🟢 fully built (complete for its scope) · 🟡 pilot/MVP (works but a CRUD leg or business output is missing) · 🔵 read-only/derived.

| Page | Maturity | Gap keeping it from "fully built" |
|------|----------|-----------------------------------|
| Login | 🟢 Full | — |
| Branches (+ `[id]`) | 🟢 Full | — |
| Settings | 🟢 Full | — |
| Staff & Positions | 🟢 Full | `ScheduleTimeline`/`AutoScheduleModal` have no unit tests |
| Attendance | 🟢 Full | `shiftsWorked` in model but unused by UI |
| EOD Entry | 🟢 Full | — |
| Dashboard | 🔵 Full (read-only) | notification bell is decorative (dot only) |
| Reports | 🔵 Full (read-only) | CSV only; no Excel/PDF; no dedicated consolidated view |
| Public website | 🟢 Full | contact form is template-only, not wired to a backend (by design) |
| **Payroll** | 🟡 Pilot | no PDF salary slip; fixed /30 divisor; advances are a bare number (no ledger); no approval-lock; save overwrites the month |
| **Expenses** | 🟡 Pilot | no "add expense" on the page (only via EOD/vendor); hard delete, no recovery |
| **Vendors** | 🟡 Pilot | no `updateVendor`/`deleteVendor` — a created vendor is permanent; bill correction only via Expenses |
| **Menu** | 🟡 Pilot | no edit for a global menu item (name/category/basePrice) — delete + re-add only |
| **Inventory** | 🟡 Pilot | integer-only quantities (no decimals like 2.5 kg); no menu/vendor linkage; manual-only |

**Summary:** ~9 of 14 pages are functionally complete for their intended scope; **5 are pilot/MVP** (Payroll, Expenses, Vendors, Menu, Inventory), each missing one CRUD leg or a business-expected output. "Pilot" reflects functional completeness, not code quality — the lint/coverage gate failures above apply across all pages.

# Tasks — Application Baseline

**Spec:** `app-baseline`
**Type:** Baseline / reference spec.

> This is **not** an implementation plan. The application described in `requirements.md` and `design.md` is already built and shipped. This file records baseline status and defines how to start a real feature spec from this foundation.

---

## Baseline status

All modules in the baseline are implemented and covered by the documentation set. There is nothing to "build" for the baseline itself.

- [x] Auth, roles, branch scoping — implemented (`auth.ts`, `jwt.ts`, `rate-limit.ts`, `proxy.ts`)
- [x] Persistence layer — implemented (`lib/db.ts`, `db/schema.ts`, seed)
- [x] Dashboard — implemented (`management/page.tsx`)
- [x] Staff & Positions (+ schedules, timeline, auto-scheduler) — implemented
- [x] Attendance — implemented
- [x] Payroll — implemented
- [x] EOD Entry — implemented
- [x] Expense Ledger — implemented
- [x] Vendors — implemented
- [x] Inventory — implemented
- [x] Menu (global + per-branch overrides) — implemented
- [x] Reports (+ CSV export) — implemented
- [x] Branches & Settings (+ module toggles) — implemented
- [x] Public marketing website — implemented
- [x] Unit (Vitest) + integration (Playwright) test suites — present

**Verified state (2026-09-30):** 719 unit tests across 52 files, 0 failures; coverage 92.71% stmts / 86.19% branch / 90.42% funcs / 95.11% lines, with thresholds enforced in `vitest.config.ts`. `tsc --noEmit` reports 0 errors in `src/`. `npx eslint` still fails (pre-existing, codebase-wide `no-explicit-any` / `no-this-alias`), which would block `next build` by default.

## Menu Management v2 (delivered 2026-09-30)

- [x] Per-branch sharding of `branch_menu_items` + read-through fallback + lazy seeding
- [x] Idempotent, non-destructive shard migration (`src/lib/menuMigration.ts`)
- [x] `updateMenuItem` (the previously blocking gap), `restoreMenuItem`, atomic reorder for items and categories
- [x] Optional variants/portions, optional metadata (description, image, cost price, dietary, spice, allergens, signature, prep time), opt-in day/time availability windows
- [x] Bulk availability + bulk price change (percent/flat/set), clone-branch config
- [x] Price history, full audit logging, `{success}|{error}` contract on all branch actions, optimistic UI with error toasts
- [x] Archive tab with restore, price matrix showing price + availability, CSV export
- [ ] **Ops: run `migrateBranchMenuItemsToShards()` once per environment** — see the operational section in root `To Do.md`. Idempotent, non-destructive, and safe to defer (read-through fallback keeps the app working).

## Baseline hardening backlog (tracked, optional)

These are known gaps captured from the code (see also root `To Do.md`). They are candidates for their own feature specs, not part of the baseline definition:

- [ ] Rotate & remove committed credentials in `netlify/database/migrations/`; re-seed admin as a bcrypt hash.
- [ ] Add password-complexity enforcement.
- [ ] Decide rate-limiter behavior under DB failure (currently fails open).
- [ ] Revisit JSON-blob write concurrency for any write-heavy additions.
- [ ] Clean up `deleteCategory` dead code; remove/repurpose unused `advances.json` / `daily_tally.json`.
- [ ] Broaden audit-log coverage and add a read-only audit UI.

---

## How to start a NEW feature from this baseline

1. **Create a spec folder:** `.kiro/specs/<feature-name>/` with `requirements.md`, `design.md`, `tasks.md`.
2. **requirements.md** — write EARS-style acceptance criteria for the *delta only*. Reference baseline requirements by number (e.g. "extends app-baseline R8 EOD") instead of restating them.
3. **design.md** — describe only what changes: which action file(s), which collection(s) in `DB_FILES`, new/changed types, and any UI. If the feature must break a baseline decision (D1–D8 in the baseline design), record that as an explicit new decision with rationale.
4. **tasks.md** — a concrete, checkable implementation plan. Each task should:
   - name the file(s) it touches,
   - follow the Server Action contract (authorize → validate → scope → `withTransaction` → audit → revalidate),
   - include the Vitest tests to add/extend (mock `@/lib/db` + session),
   - and reference the requirement number(s) it satisfies.
5. **Honor steering:** the always-on `../../steering/{product,tech,structure}.md` apply automatically — keep branch scoping, integer money, IST dates, soft-delete conventions, and "no REST / no second datastore".

### Definition of done for any feature
- Acceptance criteria met and traceable to tasks.
- Branch scoping enforced in both action and loader.
- Vitest tests added/updated; `npm run test` and `npm run lint` green.
- Docs updated (`Documentations/…` and, if the model changed, the baseline `design.md` §4 / `DOC-03`).
- No new secrets in source; no new persistence mechanism or `/api` route introduced without a recorded decision.

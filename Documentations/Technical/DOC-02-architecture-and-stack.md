# DOC-02 · Architecture & Tech Stack
**Version:** v2.0
**Last updated:** 2026-09-30
**Depends on:** DOC-01

---

## Stack (from `package.json`)

- **Next.js 16** (App Router, React Server Components, Server Actions) with **React 19**
- **TypeScript 5** (strict), path alias `@/* → ./src/*`
- **Tailwind CSS v4** (via `@tailwindcss/postcss`)
- **Drizzle ORM** (beta) targeting PostgreSQL
- **Database drivers:** `@neondatabase/serverless` (Neon HTTP) for local/dev, `@netlify/database` (`drizzle-orm/netlify-db`) in Netlify production
- **jose** for JWT sign/verify, **bcryptjs** for password hashing, **zod** for validation
- **lucide-react** icons, `clsx` + `tailwind-merge` (`cn()` helper)
- **Testing:** Vitest (jsdom) for unit tests, Playwright for integration; Husky git hooks
- **Deployment target:** Netlify (native Netlify DB + migrations under `netlify/database/migrations`)

There is **no REST/HTTP API layer**. There are no controllers, no `/api/v1` routes, and no Bearer-token auth. All server logic runs as Server Actions invoked directly by components.

---

## Data storage — the JSON-blob store

The application persists state as JSON blobs inside a single PostgreSQL table.

### The two real tables (`db/schema.ts`)
```ts
// json_store — one row per logical collection
export const jsonStore = pgTable("json_store", {
  filename: varchar("filename", { length: 255 }).primaryKey(), // e.g. "staff.json"
  data:     text("data").notNull(),                            // stringified JSON array
});

// rate_limit — login throttling (see DOC-04)
export const rateLimitTable = pgTable("rate_limit", {
  key:          varchar("key", { length: 255 }).primaryKey(),
  attempts:     integer("attempts").notNull().default(0),
  windowStart:  bigint("window_start",  { mode: "number" }).notNull(),
  blockedUntil: bigint("blocked_until", { mode: "number" }).notNull().default(0),
});
```

Every "collection" (staff, branches, eod, expenses, …) is one row in `json_store` keyed by a filename such as `staff.json`. The `data` column holds a JSON-stringified array of records. All relationships are **logical** (resolved in code by matching ids), never foreign keys.

### The access layer (`src/lib/db.ts`)
```ts
readJSON<T>(filename): Promise<T[]>            // SELECT + JSON.parse; [] on miss/error
writeJSON<T>(filename, data): Promise<boolean> // INSERT ... ON CONFLICT DO UPDATE (upsert)
withTransaction<T>(filename, cb): Promise<boolean> // read → mutate → write, guarded by a per-file mutex
```

- `withTransaction` acquires an **in-process `Mutex` keyed by filename** so concurrent writes within a single server instance are serialized (read-modify-write on the whole blob). This does **not** protect against concurrent writes from multiple serverless instances — the model is effectively last-write-wins across instances.
- `DB_FILES` enumerates every collection filename (branches, departments, roles, staff, daily_tally, payroll, attendance, eod, expenses, menu, inventory, vendors, stock_adjustments, advances, config, categories, users, staff_requirements, menu_categories, branch_menu_items, branch_categories, audit_logs).

### Driver selection (`db/index.ts`)
```ts
if (process.env.NETLIFY !== "true" && DATABASE_URL) {
  db = drizzleNeon(DATABASE_URL, { schema });   // local/dev via Neon HTTP
} else {
  db = drizzleNetlify({ schema });              // Netlify production native DB
}
```

### Seeding (`db/seed.ts`, `db/seed-data.ts`)
`npm run db:seed` (also run automatically at the end of `npm run build`) upserts default rows into `json_store` using `onConflictDoNothing`. Seed data includes default departments, roles, expense categories, the two demo branches, a global `config` row, and a single seeded owner user "Abhishek" (bcrypt-hashed, role `owner`).

---

## Authentication (summary — full detail in DOC-04)

Auth is built entirely on Server Actions in `src/app/actions/auth.ts`:
1. `login` checks IP + username rate limits against the `rate_limit` table, validates input with Zod (name + password each `min(1)`), compares the password with the bcrypt hash from `users.json`, then signs a **2-hour** JWT and stores it in an `HttpOnly`, `SameSite=strict` cookie named `session`.
2. `logout` deletes the cookie and redirects to `/management/login`.
3. `getSession` reads and verifies the cookie; `requireBranchAccess(branchId)` enforces branch scoping inside actions.

`src/proxy.ts` verifies the `session` cookie for all `/management/*` routes and redirects unauthenticated users to the login page.

---

## Folder structure (actual)

```
/ (repo root)
  db/
    index.ts            # driver selection (Neon vs Netlify)
    schema.ts           # json_store + rate_limit tables
    seed.ts, seed-data.ts
  netlify/database/migrations/   # SQL migrations (json_store, rate_limit, admin seed)
  src/
    proxy.ts          # session gate for /management/* (Next 16 rename of middleware.ts)
    app/
      layout.tsx        # root layout
      (website)/        # public marketing site (page.tsx, layout.tsx)
      management/
        layout.tsx      # authenticated shell (Navigation + config)
        page.tsx        # dashboard
        login/
        staff/ attendance/ payroll/ eod/ expenses/
        vendors/ inventory/ menu/ reports/ branches/ settings/
        # each module has page.tsx (server loader) + XxxClientPage.tsx (client UI)
      actions/          # ALL server logic — 'use server'
        auth.ts users.ts branches.ts staff.ts staff_requirements.ts
        attendance.ts salary.ts eod.ts expenses.ts vendors.ts
        menu.ts menu_categories.ts inventory.ts categories.ts
        settings.ts config.ts
    components/          # Navigation, StaffModal, ScheduleTimeline, modals, cards, …
    hooks/              # useEODSave, useStaffFilters, useMenuFilters
    lib/
      db.ts             # JSON store + mutex
      jwt.ts            # sign/verify JWT (jose)
      rate-limit.ts     # SQL sliding-window limiter
      audit.ts          # logAction → audit_logs.json
      scheduleGenerator.ts positionsSummary.ts useDraft.ts utils.ts
  test/                 # unit/ (vitest) + integration/ (playwright)
  public/               # static website assets (bootstrap, swiper, images)
```

---

## Server Action conventions

The actions layer follows a consistent shape. A typical mutation:
```ts
'use server'
export async function updateThing(prevState: any, formData: FormData) {
  const session = await getSession()
  if (!session?.isGlobalAdmin) return { error: 'Forbidden' }        // 1. authorize

  const parsed = schema.safeParse({ ... })                          // 2. Zod validate
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const branchId = await requireBranchAccess(formData.get('branchId')) // 3. scope (if branch-bound)

  const ok = await withTransaction<Thing>(DB_FILES.THINGS, list => { // 4. mutate under lock
    /* find / push / splice */
    return list
  })
  if (!ok) return { error: 'Transaction failed' }

  await logAction('UPDATE_THING', 'THING', details, id)             // 5. audit (subset of actions)
  revalidatePath('/management/things')                              // 6. revalidate
  return { success: true }
}
```

Key points:
- Errors are **returned as `{ error }` objects**, not thrown (except `requireBranchAccess`, which throws and is caught).
- Success is `{ success: true }`, sometimes with `{ warning }` or `{ message }`.
- Form-bound actions use the `(prevState, formData)` signature for React `useActionState`; others take plain arguments.
- Validation uses **Zod**. Note that validation strictness varies by action (e.g. login only requires non-empty fields; staff/eod/inventory have richer schemas).
- Client feedback (alerts, banners, closing modals) is handled in the client components — actions never call `alert()`.

---

## Authorization

There is no request middleware for authorization beyond the session gate. Each Server Action enforces its own rules:
- `session.isGlobalAdmin` (admin or owner) gates cross-branch and privileged operations.
- `session.isRootAdmin` (admin only) gates Settings operations (`settings.ts`, `config.ts`).
- `requireBranchAccess(targetBranchId)` returns the enforced branch for managers and throws `Forbidden` if a manager targets another branch.
- Page loaders additionally re-filter data by `session.branchId` for non-global users.

---

## Audit logging (`src/lib/audit.ts`)

`logAction(action, entityType, details, entityId?)` appends an entry to `audit_logs.json`:
```ts
{ id, timestamp, userId, userName, action, entityType, entityId?, details }
```
- Trimmed to the most recent **3000** entries.
- Wrapped so an audit failure never breaks the calling operation.
- Coverage is **partial** — currently called from staff create/delete, attendance save, EOD save, and expense update/delete. Most other mutations do not log.

---

## Environment variables (actual)

```env
# Database (Neon/Postgres connection string used in dev; Netlify injects its own in prod)
DATABASE_URL=postgres://...

# Auth (required — the app throws if missing)
JWT_SECRET=<long-random-string>

# Optional
SECURE_COOKIE=false   # set to 'false' to allow non-secure cookie outside production
NETLIFY=true          # injected by Netlify to select the native DB driver
NODE_ENV=production|development
```

JWT lifetime is fixed at **2 hours** in code (`jwt.ts` uses `setExpirationTime('2h')`); there is no `JWT_EXPIRES_IN` variable.

---

## HTTP security headers (`next.config.ts`)

The Next config sets strict headers on all routes: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS, `Cache-Control: no-store`, and a detailed **Content-Security-Policy** (allows self plus YouTube/Google Maps/Firebase image hosts and Neon websocket connections).

---

## Coding conventions

- `async/await` throughout the actions layer.
- All persistence goes through `src/lib/db.ts` (`readJSON` / `writeJSON` / `withTransaction`), or `readBranchMenuItems` / `withBranchMenuTransaction` for per-branch menu shards.
- Validate inputs with Zod before mutating.
- In unit tests, mock `@/lib/db`, and mock `getSession` / `requireBranchAccess` from `@/app/actions/auth` with `vi.mock` / `vi.spyOn`.

---

## Testing

**Unit — Vitest (jsdom).** `test/unit/**` mirrors `src/`: `actions/`, `lib/`, `hooks/`, `components/`, `pages/`, plus `middleware.test.ts`. Current state (verified 2026-09-30):

- **719 tests across 52 files, 0 failures.**
- Coverage: **92.71% statements · 86.19% branches · 90.42% functions · 95.11% lines.**
- By layer: `src/lib` 98.69% · `src/hooks` 98.18% (100% funcs) · `src/app/actions` 94.84% · `src/components` 85.65%.
- Thresholds are enforced in `vitest.config.ts` and set **just under** the measured values, so a regression fails the run instead of silently eroding coverage. Several pure modules are pinned at **100%**: `menuResolver`, `menuMigration`, `positionsSummary`, `rate-limit`, `jwt`, `utils`, `audit`, `middleware`.
- Only layouts and route `page.tsx` files are excluded from coverage. (Earlier exclusions for `StaffModal`, `ScheduleTimeline`, `AutoScheduleModal` and `db.ts` have been removed and those files are now tested.)

**Mocking conventions that matter:**
- `vi.mock('lucide-react')` picks up the shared manual mock at `__mocks__/lucide-react.tsx` — add any new icon there or the component renders `undefined` and the test fails with "Element type is invalid".
- `vi.mock` is **hoisted**: build mock objects with `vi.hoisted(() => …)` or you get "Cannot access '…' before initialization".
- Mock `next/link` by **forwarding all props** (`({children, href, ...rest}) => <a href={href} {...rest}>`), otherwise `className`/`onClick` are dropped and active-state/close-on-navigate assertions silently fail.
- `src/lib/db.ts` mocks the Drizzle instance by mocking `'../../../db/index'` (the path the module under test imports, resolved from the test file).

**Integration — Playwright.** `test/integration/` runs against a dev server in Chromium (`playwright.config.ts`). Coverage here is currently thin (an EOD smoke test); expanding it is tracked in `To Do.md`.

**Git hooks (Husky).** `pre-commit` runs `npm run test`; `pre-push` runs `npm run test:coverage` — so a coverage regression blocks a push.

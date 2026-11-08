# DOC-02 · Architecture & Tech Stack
**Version:** v3.0
**Last updated:** 2026-11-02
**Depends on:** DOC-01

---

## Stack (from `package.json`)

- **Next.js 16** (App Router, React Server Components, Server Actions) with **React 19**
- **TypeScript 5** (strict), path alias `@/* → ./src/*`
- **Tailwind CSS v4** (via `@tailwindcss/postcss`)
- **Drizzle ORM** targeting PostgreSQL (27 normalized relational tables in `db/schema.ts`)
- **Database driver:** Single unified `postgres` (`postgres-js`) client via `drizzle-orm/postgres-js` in `db/index.ts` connecting via `DATABASE_URL` (with optional strict SSL verification via `AIVEN_CA_CERT`). No separate Neon HTTP vs Netlify driver branching.
- **jose** for JWT sign/verify, **bcryptjs** for password hashing, **zod** for validation
- **lucide-react** icons, `clsx` + `tailwind-merge` (`cn()` helper)
- **Testing:** Vitest (jsdom) for unit tests (1,350 tests passing across 85 suites), Playwright for integration; Husky git hooks
- **Deployment target:** Netlify with PostgreSQL (Aiven, Neon, Supabase, or Netlify DB)

There is **no REST/HTTP API layer**. There are no controllers, no `/api/v1` routes, and no Bearer-token auth. All server logic runs as Server Actions invoked directly by components.

---

## Data storage — Normalized Relational Database (Drizzle ORM)

The application persists state in 27 normalized relational tables in PostgreSQL managed by Drizzle ORM.

### Database Connection (`db/index.ts`)
```ts
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
const caCert = process.env.AIVEN_CA_CERT;

const client = postgres(connectionString, {
  ssl: caCert ? { ca: caCert, rejectUnauthorized: true } : "prefer",
  max: 10,
});

export const db = drizzle(client, { schema });
```

### The Relational Access Layer (`src/lib/db.ts`)
```ts
export { db } from "../../db";
export * from "../../db/schema";
export { eq, and, or, inArray, desc, sql } from "drizzle-orm";

export async function withDbTransaction<T>(
  callback: (tx: any) => Promise<T>
): Promise<T> {
  return await db.transaction(async (tx) => {
    return await callback(tx);
  });
}
```

- Multi-table operations (e.g. Day-End save + expense replacement, POS bill settlement + order status update, stock adjustments) execute within atomic ACID transactions via `withDbTransaction<T>`.
- Legacy single-row JSON-blob storage (`json_store`), file-based in-process `Mutex`, and `readJSON` / `writeJSON` helpers have been completely eliminated from the codebase.
- The schema enforces relational integrity, surrogate BigSerial primary keys (`pk`), indexed application identifiers (`id`), and database-level constraints (including partial unique indexes such as `pos_orders_open_table_uniq` preventing multiple open orders per active table).

### Seeding (`db/seed.ts`, `db/seed-data.ts`)
`npm run db:seed` (also run automatically during build) performs typed upserts across branches, departments, roles, categories, config, and admin/owner user accounts. Seed data securely hashes the administrator password using bcrypt.

### Migration & Validation Scripts (`scripts/`)
- `scripts/migrate-from-json-store.ts` (`npm run db:migrate`): Reads legacy `json_store` blobs and idempotently migrates records into all 27 normalized RDBMS tables.
- `scripts/validate-migration.ts` (`npm run db:validate`): Runs comprehensive cross-checks validating record counts, relational foreign-key integrity, and financial totals between legacy stores and normalized tables.

---

## Authentication (summary — full detail in DOC-04)

Auth is built entirely on Server Actions in `src/app/actions/auth.ts`:
1. `login` checks IP + username rate limits against the `rate_limit` table, validates input with Zod, checks passwords with bcrypt against the `users` table, signs a **2-hour** JWT, and stores it in an `HttpOnly`, `SameSite=strict` cookie named `session`.
2. `logout` deletes the cookie and redirects to `/management/login`.
3. `getSession` reads and verifies the cookie; `requireBranchAccess(branchId)` enforces branch scoping inside actions.

`src/proxy.ts` verifies the `session` cookie for all `/management/*` routes, redirects unauthenticated users to `/management/login`, and locks POS operational roles (`waiter`, `kitchen`, `billing`) to their designated interfaces.

---

## Folder structure (actual)

```
/ (repo root)
  db/
    index.ts            # unified postgres-js client + SSL
    schema.ts           # 27 normalized relational tables + rate_limit
    seed.ts, seed-data.ts
  scripts/              # migrate-from-json-store.ts, validate-migration.ts
  netlify/database/migrations/   # Drizzle schema migrations
  src/
    proxy.ts            # session gate & POS route-locking for /management/*
    app/
      layout.tsx        # root layout
      (website)/        # public marketing site (page.tsx, layout.tsx)
      management/
        layout.tsx      # authenticated shell (Navigation + config)
        page.tsx        # dashboard
        login/
        staff/ attendance/ payroll/ eod/ expenses/
        vendors/ inventory/ menu/ reports/ branches/ settings/
        pos/            # POS suite:
          page.tsx          # Main floor grid & daily summary
          order/page.tsx    # Waiter order station
          billing/page.tsx  # Billing clerk station
          kitchen/page.tsx  # Kitchen display system
          history/page.tsx  # Order history & receipt view
        # each module has page.tsx (server loader) + XxxClientPage.tsx (client UI)
      actions/          # ALL server logic — 'use server'
        auth.ts users.ts branches.ts staff.ts staff_requirements.ts
        attendance.ts salary.ts eod.ts expenses.ts vendors.ts
        menu.ts menu_categories.ts inventory.ts categories.ts
        settings.ts config.ts pos.ts
    components/         # Navigation, modals, cards, POS panels…
    hooks/              # useEODSave, useStaffFilters, useMenuFilters
    lib/
      db.ts             # db instance, schema exports, withDbTransaction
      jwt.ts            # sign/verify JWT (jose)
      rate-limit.ts     # SQL sliding-window limiter
      audit.ts          # logAction → audit_logs table
      posUtils.ts       # POS calculations, receipt formatting, reconciliation
      scheduleGenerator.ts positionsSummary.ts useDraft.ts utils.ts
  test/                 # unit/ (vitest) + integration/ (playwright)
  public/               # static website assets
```

---

## Server Action conventions

The actions layer follows a consistent shape. A typical mutation using atomic database transactions:
```ts
'use server'
export async function updateThing(prevState: any, formData: FormData) {
  const session = await getSession()
  if (!session?.isGlobalAdmin) return { error: 'Forbidden' }        // 1. authorize

  const parsed = schema.safeParse({ ... })                          // 2. Zod validate
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const branchId = await requireBranchAccess(formData.get('branchId')) // 3. scope (if branch-bound)

  try {
    await withDbTransaction(async (tx) => {                        // 4. atomic transaction
      await tx.update(things).set({ ... }).where(eq(things.id, parsed.data.id));
    });
  } catch (err: any) {
    return { error: 'Transaction failed: ' + err.message }
  }

  await logAction('UPDATE_THING', 'THING', details, id)             // 5. audit
  revalidatePath('/management/things')                              // 6. revalidate
  return { success: true }
}
```

Key points:
- Errors are **returned as `{ error }` objects**, not thrown (except `requireBranchAccess`, which throws and is caught).
- Success is `{ success: true }`, sometimes with `{ warning }` or `{ message }`.
- Form-bound actions use the `(prevState, formData)` signature for React `useActionState`; others take typed arguments.
- Validation uses **Zod**.
- Client feedback is handled in the client components — actions never call `alert()`.

---

## Authorization

There is no request middleware for authorization beyond the session gate and POS proxy sandbox. Each Server Action enforces its own rules:
- `session.isGlobalAdmin` (admin or owner) gates cross-branch and privileged operations.
- `session.isRootAdmin` (admin only) gates Settings operations (`settings.ts`, `config.ts`).
- `session.posRole` identifies operational floor roles (`waiter`, `kitchen`, `billing`), enforcing sandboxed access to POS routes and forbidding management modules.
- `requireBranchAccess(targetBranchId)` returns the enforced branch for branch-scoped users and throws `Forbidden` if targeting another branch.
- Page loaders additionally filter data by `session.branchId` for non-global users.

---

## Audit logging (`src/lib/audit.ts`)

`logAction(action, entityType, details, entityId?)` writes to the `audit_logs` table:
```ts
{ id, timestamp, userId, userName, action, entityType, entityId?, details }
```
- Trimmed to the most recent **3000** entries using rolling subquery trimming.
- Wrapped so an audit failure never breaks the calling operation.
- Coverage includes staff mutations, attendance saves, EOD saves, expense edits/deletions, and POS order voids.

---

## Environment variables (actual)

```env
# Database connection string
DATABASE_URL=postgres://...

# Auth (required — the app throws if missing)
JWT_SECRET=<long-random-string>

# Optional
AIVEN_CA_CERT="-----BEGIN CERTIFICATE-----\n..." # Strict SSL CA certificate
ADMIN_PASSWORD=...                               # Custom bootstrap admin password
SECURE_COOKIE=false                              # set to 'false' to allow non-secure cookie outside production
NODE_ENV=production|development
```

JWT lifetime is fixed at **2 hours** in code (`jwt.ts` uses `setExpirationTime('2h')`).

---

## HTTP security headers (`next.config.ts`)

The Next config sets strict headers on all routes: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS, `Cache-Control: no-store`, and a detailed **Content-Security-Policy**.

---

## Coding conventions

- `async/await` throughout the actions layer.
- All persistence goes through `src/lib/db.ts` (`db` and `withDbTransaction`).
- Validate inputs with Zod before mutating.
- In unit tests, mock `@/lib/db`, and mock `getSession` / `requireBranchAccess` from `@/app/actions/auth`.

---

## Testing

**Unit — Vitest (jsdom).** `test/unit/**` mirrors `src/`: `actions/`, `lib/`, `hooks/`, `components/`, `pages/`, plus `proxy.test.ts`. Current state:

- **1,350 tests across 85 test suites, 0 failures.**
- Coverage: **93.56% lines**, surpassing the 90% threshold across all packages.
- Thresholds are enforced in `vitest.config.ts`.
- Several pure modules are pinned at **100%**: `posUtils`, `positionsSummary`, `rate-limit`, `jwt`, `utils`, `audit`, `proxy`.

**Mocking conventions that matter:**
- `vi.mock('lucide-react')` picks up the shared manual mock at `__mocks__/lucide-react.tsx`.
- `vi.mock` is **hoisted**: build mock objects with `vi.hoisted(() => …)`.
- Mock `next/link` by **forwarding all props**.
- `src/lib/db.ts` mocks the Drizzle instance via `test/unit/drizzleMock.ts`.

**Integration — Playwright.** `test/integration/` runs against a dev server in Chromium (`playwright.config.ts`).

**Git hooks (Husky).** `pre-commit` runs `npm run test`; `pre-push` runs `npm run test:coverage`.

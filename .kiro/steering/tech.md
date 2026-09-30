---
inclusion: always
---

# Tech Steering — Sree Vaishnaves Management

> Always-on context describing HOW this system is built. Follow these patterns; do not introduce new ones without a decision recorded in a spec's design.md.

## Stack

- **Next.js 16** (App Router, React Server Components, **Server Actions**) + **React 19** + **TypeScript 5** (strict)
- **Tailwind CSS v4** (`@tailwindcss/postcss`)
- **Drizzle ORM** (beta) over **PostgreSQL**
- Drivers: `@neondatabase/serverless` (Neon HTTP) in dev, `@netlify/database` (`drizzle-orm/netlify-db`) in production — selected by the `NETLIFY` env flag in `db/index.ts`
- **jose** (JWT), **bcryptjs** (hashing), **zod** (validation), **lucide-react** (icons), `clsx` + `tailwind-merge` (`cn()`)
- **Vitest** (jsdom) unit tests, **Playwright** integration tests, **Husky** hooks
- Deploy target: **Netlify**
- Path alias: `@/* → ./src/*`

## The one non-negotiable architectural fact

**There is no REST API and no `/api` routes.** All server logic is **Next.js Server Actions** (`'use server'` in `src/app/actions/*.ts`) called directly from React components. Do not add HTTP controllers or a `/api/v1` layer.

## Persistence — JSON-blob store

State is stored as JSON arrays in a single Postgres table `json_store(filename PK, data text)` — one row per logical collection (e.g. `staff.json`, `eod.json`). Plus a real `rate_limit` table.

Access **only** through `src/lib/db.ts`:
- `readJSON<T>(filename): Promise<T[]>`
- `writeJSON<T>(filename, data): Promise<boolean>` (upsert)
- `withTransaction<T>(filename, cb)` — read → mutate → write under an **in-process per-file mutex**

`DB_FILES` enumerates every collection filename. All relationships are **logical** (id matching in code), never SQL foreign keys.

> ⚠️ **Concurrency caveat:** the mutex is per-instance only. Writes are whole-array read-modify-write, so concurrent writes across serverless instances are last-write-wins. Keep this in mind for any new write-heavy collection.

## Server Action contract (follow this shape)

```ts
'use server'
export async function doThing(prevState: any, formData: FormData) {
  const session = await getSession()
  if (!session?.isGlobalAdmin) return { error: 'Forbidden' }        // 1. authorize

  const parsed = schema.safeParse({ /* fields */ })                 // 2. validate (Zod)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  let branchId = await requireBranchAccess(formData.get('branchId')) // 3. scope (if branch-bound)

  const ok = await withTransaction<Thing>(DB_FILES.THINGS, list => { // 4. mutate under lock
    /* find / push / splice; set guard flags for not-found/duplicate/forbidden */
    return list
  })
  if (!ok) return { error: 'Transaction failed' }

  await logAction('DO_THING', 'THING', details, id)                  // 5. audit (sensitive ops)
  revalidatePath('/management/things')                               // 6. revalidate
  return { success: true }
}
```

Rules:
- **Return `{ error }` / `{ success: true }` / `{ warning } / { message }`** — do not throw (except `requireBranchAccess`, which throws and is caught).
- Form-bound actions use `(prevState, formData)` for React `useActionState`; others take plain args.
- **Never call `alert()` in an action** — the client component renders feedback.
- Validate with **Zod** before mutating.

## Authorization

- `session.isGlobalAdmin` → admin or owner (cross-branch + privileged ops).
- `session.isRootAdmin` → admin only (Settings: `settings.ts`, `config.ts`).
- `requireBranchAccess(targetBranchId)` → returns enforced branch for managers, throws `Forbidden` on mismatch.
- **Defense in depth:** page loaders (`page.tsx`) ALSO filter data by `session.branchId` for non-global users, and redirect where needed (Settings → non-admins bounced; EOD → readonly bounced).

## Auth specifics

- Login (`auth.ts`): dual rate limit (IP 10/min + username 20/hr, 5-min block, **fails open**) → bcrypt compare → sign **2-hour HS256 JWT** → `HttpOnly`, `SameSite=strict` cookie `session`.
- `src/middleware.ts` gates all `/management/*`; `/` is always public.
- `JWT_SECRET` is required (app throws without it).

## Conventions

- Money = integer rupees; validate with `z.number().int()`.
- Dates that mean "today" use IST: `new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })`.
- Soft delete for core entities (`isActive:false` + `deletedAt`); a few collections hard-delete (expenses, expense categories, staff requirements) — match the existing collection's pattern, don't invent a new one.
- Audit via `logAction()` for sensitive mutations (capped at 3000 entries in `audit_logs.json`).
- Each module = `page.tsx` (server loader, does scoping) + `XxxClientPage.tsx` (client UI) + one or more actions files.
- Reuse `GenericEntityModal` and existing modals/hooks (`useDraft`, `useStaffFilters`, `useMenuFilters`, `useEODSave`) before writing new ones.

## Testing expectations

- Add/extend **Vitest** unit tests for any action/lib/hook/component you touch; mock `@/lib/db` and the auth session (`vi.mock`/`vi.spyOn`). Coverage thresholds live in `vitest.config.ts` (backend ≥90%, some lib files 100%).
- Extend **Playwright** integration tests for user-facing flows where practical.
- Run `npm run test` (and `npm run lint`) before considering a change done; hooks enforce this.

## Commands

```
npm run dev              # dev server
npm run build            # next build && npm run db:seed
npm run db:seed          # seed defaults into json_store
npm run test             # vitest
npm run test:coverage    # vitest + coverage
npm run test:integration # playwright
npm run lint             # eslint
```

## Known gotchas (don't re-introduce / be aware)

- Committed secrets in `netlify/database/migrations/` (plaintext admin + Postgres role password) — must be rotated; never add more.
- No password-complexity check at login.
- `advances.json` and `daily_tally.json` are seeded but unused.
- `deleteCategory` has leftover dead/incomplete code.

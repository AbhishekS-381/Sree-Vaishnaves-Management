# Sree Vaishnaves Management

A restaurant management platform for the Sree Vaishnaves vegetarian restaurant business (Kannur, Kerala), built with [Next.js 16](https://nextjs.org) (App Router) and React 19. One app serves two surfaces:

- **Public marketing website** at `/` — a static single-page hotel/restaurant site.
- **Management portal** at `/management/*` — the operations tool (staff, attendance, payroll, day-end, expenses, vendors, inventory, menu, reports, branches, settings).

## Architecture at a glance

- **Server Actions, not REST.** All server logic lives in `src/app/actions/*.ts` (`'use server'`) and is called directly from React components. There is no `/api` layer.
- **JSON-blob store.** State is persisted as JSON arrays in a single PostgreSQL table `json_store` (one row per collection), plus a `rate_limit` table. Access goes through `src/lib/db.ts` (`readJSON` / `writeJSON` / `withTransaction`, guarded by an in-process per-file mutex).
- **Drizzle ORM** with a driver switch: Neon HTTP in dev, native Netlify DB in production (selected by the `NETLIFY` env flag).
- **Auth:** Server-Action login → bcrypt check → 2-hour HS256 JWT (jose) in an `HttpOnly`, `SameSite=strict` cookie; `src/middleware.ts` gates `/management/*`.

## Roles

Four roles: **admin** (root; only role with Settings access), **owner** (full cross-branch ops), **manager** (single-branch, sandboxed), and **readonly** (view dashboards/reports). Capability flags in the JWT: `isRootAdmin` (admin), `isGlobalAdmin` (admin or owner), `isGlobalOwner` (owner).

## Features

- **Role-based access control** with per-branch sandboxing (`requireBranchAccess`, plus page-loader filtering).
- **Multi-branch** — most records carry a `branchId`; managers see only their branch.
- **Module toggles** — admins switch attendance/payroll/vendors/inventory/menu/reports on/off globally via `config.json`.
- **Rate limiting** — SQL sliding-window limiter (per-IP 10/min, per-username 20/hour, 5-min block, fails open).
- **Soft deletion** for core entities (`isActive` + `deletedAt`); some collections are hard-deleted.
- **Zod validation** across the actions layer; **bcrypt** password hashing.
- **Partial audit log** in `audit_logs.json` (capped at 3000 entries; no UI).
- Strict security headers + CSP in `next.config.ts`.

## Development

```bash
npm install
npm run dev          # start the dev server (http://localhost:3000)
```

Required environment variables:

```env
JWT_SECRET=<long-random-string>   # required — the app throws without it
DATABASE_URL=postgres://...       # Postgres/Neon connection (dev)
# optional
SECURE_COOKIE=false               # allow non-secure cookie outside production
```

## Scripts (`package.json`)

| Script | Purpose |
|--------|---------|
| `npm run dev` | Dev server |
| `npm run build` | `next build` **and then** `npm run db:seed` |
| `npm run start` | `next build && next start` |
| `npm run db:seed` | Seed default data into `json_store` (`tsx db/seed.ts`) |
| `npm run lint` | ESLint |
| `npm run test` | Vitest unit tests |
| `npm run test:coverage` | Vitest with coverage |
| `npm run test:integration` | Playwright integration tests |
| `npm run test:all` | Unit + integration |

## Testing

- **Unit:** Vitest (jsdom) over actions, lib, hooks, middleware, and components; coverage thresholds configured in `vitest.config.ts`.
- **Integration:** Playwright in `test/integration`.
- **Git hooks:** Husky runs tests on pre-commit and coverage on pre-push.

## Deployment

Targets **Netlify**. Migrations under `netlify/database/migrations/` create `json_store` and `rate_limit`; `db:seed` populates default master data and the seeded owner user.

> **Security note:** the SQL migrations currently commit a plaintext bootstrap admin password and a hardcoded Postgres role password. Rotate these and remove them from source control before any real deployment, and set a strong `JWT_SECRET`.

## Documentation

- `Documentations/Technical/DOC-00 … DOC-14` — architecture, schema, auth, and per-module technical docs.
- `Documentations/Product/` — overview, module guide, user journeys, system map, rollout, HLD, PRD.
- `Documentations/MODULE-MAPS.md`, `Documentations/MODULES_AND_INTERLINKS.md` — visual and interlink references.

# DOC-04 · Authentication & Roles
**Version:** v3.0
**Last updated:** 2026-09-30
**Depends on:** DOC-01, DOC-02, DOC-03

---

## Overview

Authentication is built entirely on **Next.js Server Actions** (`src/app/actions/auth.ts`). There is no client-side token handling and no REST auth endpoint. A stateless JWT is stored in an `HttpOnly` cookie named `session`. Route protection is enforced by `src/middleware.ts`.

---

## Login flow (`login` action)

1. **Rate limiting.** The client IP is read from `x-forwarded-for` / `x-real-ip` headers and passed with the submitted username to `checkRateLimit(ip, name)`. Two independent limits are enforced (see below). If either is exceeded, the action returns `{ error }` with a retry message.
2. **Validation (Zod).** `loginSchema` requires `name` and `password` to each be **non-empty strings** (`min(1)`). There is no password-complexity rule at login (complexity is not enforced anywhere in the current code).
3. **Lookup.** Users are read from `users.json`; the record is matched case-insensitively on `name` and must not be soft-deleted (`isActive !== false`).
4. **Password check.** `bcrypt.compare(password, user.password)`.
5. **Success.** The IP/username rate-limit counters are cleared (`resetRateLimit`), stale rate-limit rows are pruned ~1% of the time, a JWT is signed, and the cookie is set. The action then `redirect('/management')`.
6. **Failure.** Returns `{ error: 'Invalid Credentials' }`.

### Role → capability flags
On success the action derives flags from the stored `role` (lowercased):
```ts
const isAdmin       = role === 'admin'
const isOwner       = role === 'owner'
const isGlobalAdmin = isAdmin || isOwner   // cross-branch + privileged ops
const isGlobalOwner = isOwner              // owner-specific
// isRootAdmin = isAdmin                    // Settings access
```

### Cookie
```ts
cookieStore.set('session', token, {
  httpOnly: true,
  secure: NODE_ENV === 'production' && SECURE_COOKIE !== 'false',
  sameSite: 'strict',
  maxAge: 60 * 60 * 2,   // 2 hours
  path: '/',
})
```

---

## JWT (`src/lib/jwt.ts`)

Signed with **HS256** using `JWT_SECRET` (the app throws at startup if the secret is missing). Expiry is **2 hours** (`setExpirationTime('2h')`). Payload:
```ts
interface CustomJWTPayload {
  userId: string;
  name: string;
  role: string;            // 'admin' | 'owner' | 'manager' | 'readonly'
  branchId?: string;       // managers only
  isGlobalOwner: boolean;  // owner
  isGlobalAdmin: boolean;  // admin or owner
  isRootAdmin: boolean;    // admin
  iat: number; exp: number;
}
```
`verifyToken` returns the payload or `null` on any verification error.

---

## Session helpers (`auth.ts`)

- `getSession()` — reads and verifies the `session` cookie; returns the payload or `null`.
- `getSessionRole()` — convenience returning `session.role`.
- `requireBranchAccess(targetBranchId?)` — throws `Unauthorized` if no session; for non-global-admins, throws `Forbidden` if `targetBranchId` differs from their assigned branch, otherwise returns their enforced branch id; for global admins returns the requested branch (or their own/`''`).
- `migratePasswordsToHash()` — admin-only maintenance action that bcrypt-hashes any plaintext passwords still present in `users.json`.

---

## The four roles

| Role | `isRootAdmin` | `isGlobalAdmin` | `isGlobalOwner` | Scope |
|------|:---:|:---:|:---:|-------|
| `admin` | ✓ | ✓ | ✗ | All branches; only role with Settings access; undeletable |
| `owner` | ✗ | ✓ | ✓ | All branches; full operations except Settings |
| `manager` | ✗ | ✗ | ✗ | Single assigned branch only |
| `readonly` | ✗ | ✗ | ✗ | Read-only analyst across branches |

### Capability matrix (as enforced in code)

| Capability | admin | owner | manager | readonly |
|------------|:---:|:---:|:---:|:---:|
| View all branches | ✓ | ✓ | ✗ (own only) | ✓ |
| Open Settings (`/management/settings`) | ✓ | ✗ | ✗ | ✗ |
| Manage departments / roles / module toggles | ✓ | ✗ | ✗ | ✗ |
| Manage expense categories | ✓ | ✓ | ✗ | ✗ |
| Manage system users | ✓ | ✓ | ✗ | ✗ |
| Manage branches | ✓ | ✓ | ✗ | ✗ |
| Manage staff / positions | ✓ | ✓ | ✓ (own branch) | ✗ |
| Delete staff | ✓ | ✓ | ✗ | ✗ |
| Mark attendance | ✓ | ✓ | ✓ (own branch) | ✗ |
| Edit attendance older than 7 days | ✓ | ✓ | ✗ | ✗ |
| Fill EOD entry | ✓ | ✓ | ✓ (own branch) | ✗ (redirected) |
| Edit locked / >24h EOD | ✓ | ✓ | ✗ | ✗ |
| Add expenses (via EOD / vendor) | ✓ | ✓ | ✓ (own branch) | ✗ |
| Edit / delete ledger expenses | ✓ | ✓ | ✗ | ✗ |
| Manage vendors / vendor bills | ✓ | ✓ | ✓ (own branch) | ✗ |
| Manage inventory | ✓ | ✓ | ✓ (own branch) | ✗ |
| Manage menu items/categories (global) | ✓ | ✓ | ✗ | ✗ |
| Toggle per-branch menu availability/price | ✓ | ✓ | ✓ (own branch) | ✗ |
| Save payroll draft | ✓ | ✓ | ✓ (own branch) | ✗ |
| Mark payroll as paid | ✓ | ✓ | ✗ | ✗ |
| View reports | ✓ | ✓ | ✓ (own branch) | ✓ |

> The `settings.ts` and `config.ts` actions check `session.role === 'admin'` specifically. Expense categories (`categories.ts`), users (`users.ts`), and branches (`branches.ts`) check `isGlobalAdmin`, so owners can manage those even though the Settings page itself is admin-gated.

---

## Route protection (`src/middleware.ts`)

- `/` (public website) always passes through.
- Anything not under `/management` passes through.
- For `/management/*`, the `session` cookie is verified via `jwtVerify`:
  - Logged-in user hitting `/management/login` → redirected to `/management`.
  - Not logged in on any other `/management/*` route → redirected to `/management/login`.
  - Logged in → request proceeds with `Cache-Control: no-store` and `Pragma: no-cache` added.
- The matcher excludes Next internals and static assets (`_next/static`, `_next/image`, `favicon.ico`, `assets`, `images`, `main.css`).

Page-level loaders add a second layer: e.g. `/management/settings` redirects non-admins to `/management`, and `/management/eod` redirects `readonly` users away.

---

## Rate limiting (`src/lib/rate-limit.ts`)

Backed by the `rate_limit` Postgres table via a single atomic upsert per attempt (sliding window). Two limits are checked on every login:

- **Per IP:** key `login:ip:<ip>`, max **10** attempts per **1-minute** window.
- **Per username:** key `login:user:<name>`, max **20** attempts per **1-hour** window (catches credential-stuffing across rotating IPs).

Exceeding either applies a **5-minute** hard block (`blocked_until`). The limiter **fails open** — if the DB call errors, the login is allowed to proceed. Counters reset on successful login; stale rows are pruned opportunistically.

---

## Security properties (as implemented)

1. **Soft deletion** for users and most entities — no hard user wipes.
2. **Dual-axis rate limiting** (IP + username) with a hard block.
3. **bcrypt** password hashing (`bcryptjs`).
4. **HttpOnly, SameSite=strict** session cookie, `Secure` in production.
5. **No hardcoded JWT secret** — `JWT_SECRET` must come from the environment.
6. Strict security + CSP headers set globally in `next.config.ts`.

### Known gaps / caveats (documented honestly)
- **No password-complexity enforcement** anywhere in the current code (login only checks non-empty).
- **Rate limiter fails open** on DB errors by design.
- The SQL migrations under `netlify/database/migrations/` seed a bootstrap admin with a **plaintext password** and also create a Postgres role with a hardcoded password. These credentials are committed to the repo; they should be rotated and removed from source. (The app login expects bcrypt hashes, so the plaintext-seeded app user would not authenticate through `bcrypt.compare` as-is.)

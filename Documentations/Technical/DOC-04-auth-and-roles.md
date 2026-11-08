# DOC-04 · Authentication & Roles
**Version:** v3.0
**Last updated:** 2026-11-02
**Depends on:** DOC-01, DOC-02, DOC-03

---

## Overview

Authentication is built entirely on **Next.js Server Actions** (`src/app/actions/auth.ts`). There is no client-side token handling and no REST auth endpoint. A stateless JWT is stored in an `HttpOnly` cookie named `session`. Route protection, sandboxing, and page-locking are enforced by `src/proxy.ts`.

---

## Login flow (`login` action)

1. **Rate limiting.** The client IP is read from `x-forwarded-for` / `x-real-ip` headers and passed with the submitted username to `checkRateLimit(ip, name)`. Two independent limits are enforced. If either is exceeded, the action returns `{ error }` with a retry message.
2. **Validation (Zod).** `loginSchema` requires `name` and `password` to each be **non-empty strings** (`min(1)`).
3. **Lookup.** Users are queried from the `users` relational table via Drizzle ORM; matched case-insensitively on `name` and filtered for `isActive !== false`.
4. **Password check.** `bcrypt.compare(password, user.password)`.
5. **Success.** Rate-limit counters are reset (`resetRateLimit`), a JWT is signed with role and POS capability flags, the cookie is set, and the user is redirected:
   - `waiter` → `/management/pos/order`
   - `kitchen` → `/management/pos/kitchen`
   - `billing` → `/management/pos/billing`
   - All other roles → `/management`
6. **Failure.** Returns `{ error: 'Invalid Credentials' }`.

### Role → capability flags
On success the action derives flags from the stored `role` (lowercased):
```ts
const isAdmin       = role === 'admin'
const isOwner       = role === 'owner'
const isGlobalAdmin = isAdmin || isOwner   // cross-branch + privileged ops
const isGlobalOwner = isOwner              // owner-specific
const isRootAdmin   = isAdmin              // Settings access
const posRole       = ['waiter', 'kitchen', 'billing'].includes(role) // POS floor staff
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
  role: string;            // 'admin' | 'owner' | 'manager' | 'readonly' | 'billing' | 'kitchen' | 'waiter'
  branchId?: string;       // branch-scoped roles
  isGlobalOwner: boolean;  // owner
  isGlobalAdmin: boolean;  // admin or owner
  isRootAdmin: boolean;    // admin
  posRole?: boolean;       // true for waiter, kitchen, billing
  iat: number; exp: number;
}
```
`verifyToken` returns the payload or `null` on any verification error.

---

## Session helpers (`auth.ts`)

- `getSession()` — reads and verifies the `session` cookie; returns the payload or `null`.
- `getSessionRole()` — convenience returning `session.role`.
- `requireBranchAccess(targetBranchId?)` — throws `Unauthorized` if no session; for branch-scoped users, throws `Forbidden` if `targetBranchId` differs from their assigned branch; for global admins returns the requested branch.
- `migratePasswordsToHash()` — admin-only maintenance action that bcrypt-hashes legacy plaintext passwords in the `users` table.

---

## The seven roles

| Role | `isRootAdmin` | `isGlobalAdmin` | `posRole` | Scope & Route Sandboxing |
|------|:---:|:---:|:---:|-------|
| `admin` | ✓ | ✓ | ✗ | All branches; only role with Settings access; undeletable |
| `owner` | ✗ | ✓ | ✗ | All branches; full operations across management and POS |
| `manager` | ✗ | ✗ | ✗ | Single assigned branch only; full branch management + POS |
| `readonly` | ✗ | ✗ | ✗ | Read-only analyst across branches; mutation controls hidden |
| `waiter` | ✗ | ✗ | ✓ | Page-locked to `/management/pos/order`; floor ordering & KOTs |
| `kitchen` | ✗ | ✗ | ✓ | Page-locked to `/management/pos/kitchen`; FIFO ticket status |
| `billing` | ✗ | ✗ | ✓ | Page-locked to `/management/pos/billing`; checkout & payments |

### Capability matrix (as enforced in code)

| Capability | admin | owner | manager | readonly | waiter | kitchen | billing |
|------------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| View all branches | ✓ | ✓ | ✗ (own) | ✓ | ✗ (own) | ✗ (own) | ✗ (own) |
| Open Settings (`/management/settings`) | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Manage departments / roles / config toggles | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Manage expense categories / users / branches | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Manage staff / positions | ✓ | ✓ | ✓ (own) | ✗ | ✗ | ✗ | ✗ |
| Delete staff | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Mark attendance | ✓ | ✓ | ✓ (own) | ✗ | ✗ | ✗ | ✗ |
| Edit attendance older than 7 days | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Fill Day-End (EOD) entry | ✓ | ✓ | ✓ (own) | ✗ | ✗ | ✗ | ✗ |
| Edit locked / >24h EOD | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Add expenses (via EOD / vendor) | ✓ | ✓ | ✓ (own) | ✗ | ✗ | ✗ | ✗ |
| Edit / delete ledger expenses | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Manage vendors / inventory | ✓ | ✓ | ✓ (own) | ✗ | ✗ | ✗ | ✗ |
| Manage menu catalog (global) | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Toggle branch menu availability/price | ✓ | ✓ | ✓ (own) | ✗ | ✗ | ✗ | ✗ |
| Save payroll draft | ✓ | ✓ | ✓ (own) | ✗ | ✗ | ✗ | ✗ |
| Mark payroll as paid | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| View reports | ✓ | ✓ | ✓ (own) | ✓ | ✗ | ✗ | ✗ |
| Create POS orders & fire KOTs | ✓ | ✓ | ✓ (own) | ✗ | ✓ (own) | ✗ | ✗ |
| Advance KOT ticket status | ✓ | ✓ | ✓ (own) | ✗ | ✗ | ✓ (own) | ✗ |
| Generate POS bills & record payments | ✓ | ✓ | ✓ (own) | ✗ | ✗ | ✗ | ✓ (own) |
| Void POS orders (same day) | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |

---

## Route protection & proxy sandboxing (`src/proxy.ts`)

- `/` (public marketing website) and static assets pass through unconditionally.
- For all `/management/*` routes:
  - If unauthenticated → redirect to `/management/login`.
  - If authenticated user hits `/management/login`:
    - POS roles redirected to their designated station (`/management/pos/order`, `/billing`, or `/kitchen`).
    - Other roles redirected to `/management`.
  - **POS Role Sandboxing:**
    - `waiter` is locked to `/management/pos/order`. Any other `/management/*` request redirects to `/management/pos/order`.
    - `kitchen` is locked to `/management/pos/kitchen`. Any other `/management/*` request redirects to `/management/pos/kitchen`.
    - `billing` is locked to `/management/pos/billing`. Any other `/management/*` request redirects to `/management/pos/billing`.
    - Navigation headers and sidebars are suppressed in layout for `posRole` requests via the `x-pos-role` header.

Page-level server loaders enforce second-layer checks: `/management/settings` redirects non-admins, and `/management/eod` redirects `readonly` users away.

---

## Rate limiting (`src/lib/rate-limit.ts`)

Backed by the `rate_limit` Postgres table via atomic sliding-window upserts. Two limits are checked on every login:

- **Per IP:** key `login:ip:<ip>`, max **10** attempts per **1-minute** window.
- **Per username:** key `login:user:<name>`, max **20** attempts per **1-hour** window.

Exceeding either applies a **5-minute** hard block (`blocked_until`). The limiter fails open on DB errors.

---

## Security properties (as implemented)

1. **Soft deletion** for users and most entities — preserves operational history.
2. **Dual-axis rate limiting** (IP + username) with a hard block.
3. **bcrypt** password hashing (`bcryptjs`).
4. **HttpOnly, SameSite=strict** session cookie, `Secure` in production.
5. **No hardcoded JWT secret** — `JWT_SECRET` must come from the environment.
6. **Page-locked operational roles** — prevents floor staff from accessing management data or settings.
7. Strict security + CSP headers set globally in `next.config.ts`.

# DOC-04 · Authentication & Roles
**Version:** v2.0  
**Phase:** 1  
**Depends on:** DOC-01, DOC-02, DOC-03

---

## Overview

The application utilizes **Next.js App Router Server Actions** for authentication, completely removing client-side API fetching and token management. Authentication is handled via a single stateless JWT stored securely in an `HttpOnly` cookie.

---

## Authentication Flow

### Login Action (`src/app/actions/auth.ts`)
1. **Rate Limiting**: The client's IP is extracted via `next/headers` and verified against the Postgres `rate_limit` table via a single atomic upsert. Limited to 10 attempts per 1 minute window, with a 5 minute block.
2. **Validation**: Input is strictly validated using Zod:
   - Password must be at least 8 characters, with 1 uppercase, 1 lowercase, 1 number, and 1 special character.
3. **Password Verification**: Compares the provided password with the hashed password in `users.json` using `bcrypt.compare()`.
4. **JWT Generation**: A stateless JWT containing `userId`, `name`, `role`, `branchId`, and `isGlobalOwner` is signed.
5. **Cookie Storage**: The JWT is set in an `HttpOnly`, `Secure` (in production) cookie named `session` with a 1-week expiration. No refresh tokens are used.

### Logout
The `logout` Server Action simply deletes the `session` cookie and redirects the user to `/login`.

---

## JWT Payload Structure

```json
{
  "userId": "uuid",
  "role": "owner | branch_manager",
  "branchId": "uuid or null",
  "name": "User Name",
  "isGlobalOwner": true,
  "iat": 1234567890,
  "exp": 1234567890
}
```

---

## Role-Based Access Control

### Role Definitions

| Role | Scope | Can approve payroll | Can delete | Can export | Can see all branches |
|------|-------|-------------------|-----------|-----------|---------------------|
| `owner` | All branches | Yes | Yes (soft) | Yes | Yes |
| `owner` | All branches | Yes | Yes (soft) | Yes | Yes |
| `branch_manager` | Assigned branch only | No | No | No | No |

### Backend Authorization (`requireBranchAccess`)

All Server Actions enforce data sandboxing via `requireBranchAccess(targetBranchId)` from `auth.ts`:
- If the user is an `owner`, they can view/edit any branch.
- If the user is a `branch_manager`, they are strictly confined to their assigned `branchId`.

```ts
// Usage in Server Actions
const enforcedBranchId = await requireBranchAccess(branchId);
```

### Page-Level Protection
Pages fetch the session on the server via `getSession()`. Users with invalid roles attempting to access protected pages (like `/settings` or `/branches`) are instantly redirected to `/` using `next/navigation`.

---

## Security Rules

1. **No Hard Deletion**: The application strictly enforces soft-deletion using `isActive: false` and `deletedAt`. Data is never wiped from the database.
2. **Rate Limiting**: Built-in 10-attempt / 1-minute sliding window lockout per IP to stop brute-forcing, backed by the Postgres `rate_limit` table.
3. **Password Integrity**: Passwords are one-way hashed using `bcryptjs`.
4. **Cookie Security**: Tokens are inaccessible to client-side JavaScript (`HttpOnly`).
5. **Session Fallback Removed**: No hardcoded JWT secrets are permitted; `JWT_SECRET` must be sourced from the environment.

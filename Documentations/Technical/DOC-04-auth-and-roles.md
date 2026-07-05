# DOC-04 · Authentication & Roles
**Version:** v1.0  
**Last updated:** 2026-03-15  
**Phase:** 1  
**Depends on:** DOC-01, DOC-02, DOC-03

---

## Overview

JWT-based authentication with access tokens and refresh tokens. Two tokens are issued on login — a short-lived access token (15 minutes) and a long-lived refresh token (7 days) for persistent sessions.

---

## API routes

| Method | Route | Access | Description |
|--------|-------|--------|-------------|
| POST | `/api/v1/auth/login` | Public | Login with email + password |
| POST | `/api/v1/auth/refresh` | Public | Get new access token using refresh token |
| POST | `/api/v1/auth/logout` | Authenticated | Invalidate refresh token |
| GET | `/api/v1/auth/me` | Authenticated | Get current user profile |

---

## Login flow

### Request
```json
POST /api/v1/auth/login
{
  "email": "owner@restaurant.com",
  "password": "plaintext_password"
}
```

### Process
1. Find user by email — return generic error if not found (do not reveal whether email exists)
2. Check `is_active = true` and `deleted_at IS NULL`
3. Compare password with `bcrypt.compare(password, user.password_hash)`
4. If valid, generate both tokens
5. Store hashed refresh token in `refresh_tokens` table
6. Update `users.last_login_at`
7. Write to `audit_logs` (action: INSERT, table: auth_events)

### Response
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "user": {
      "id": "uuid",
      "name": "Owner Name",
      "email": "owner@restaurant.com",
      "role": "owner",
      "branchId": null
    }
  }
}
```

---

## JWT payload structure

```json
{
  "userId": "uuid",
  "role": "owner | branch_manager | super_admin",
  "branchId": "uuid or null",
  "name": "User Name",
  "iat": 1234567890,
  "exp": 1234567890
}
```

---

## Refresh token flow

### Request
```json
POST /api/v1/auth/refresh
{
  "refreshToken": "eyJ..."
}
```

### Process
1. Verify refresh token signature
2. Hash the incoming token and look it up in `refresh_tokens`
3. Check `expires_at` is in the future
4. Delete the old refresh token row (rotation — each refresh issues a new pair)
5. Issue new access token + new refresh token
6. Store new hashed refresh token

---

## Logout

```json
POST /api/v1/auth/logout
Authorization: Bearer <access_token>
{
  "refreshToken": "eyJ..."
}
```

Hashes the refresh token and deletes the matching row from `refresh_tokens`. The access token is short-lived so no server-side invalidation needed.

---

## Role-based access control

### Role definitions

| Role | Scope | Can approve payroll | Can delete | Can export | Can see all branches |
|------|-------|-------------------|-----------|-----------|---------------------|
| `owner` | All branches | Yes | Yes (soft) | Yes | Yes |
| `branch_manager` | Assigned branch only | No | No | No | No |
| `super_admin` | Everything | Yes | Yes | Yes | Yes |

### Backend Authorization (`requireBranchAccess`)

All API actions now rely on `requireBranchAccess(branchId)` to enforce that the `branchId` from the session context matches the requested operation. Global admins bypass this automatically.

```js
// Usage in Server Actions
const enforcedBranchId = await requireBranchAccess(branchId);
```

---

## Frontend auth flow

### Token storage
- `accessToken` → stored in memory (Zustand store) — NOT in localStorage
- `refreshToken` → stored in `localStorage` under key `rms_refresh_token`
- `user` object → stored in Zustand + localStorage for persistence

### Client-side API Calls

**Request interceptor:** Attach `Authorization: Bearer <accessToken>` to every request.

**Response interceptor:** On 401 response:
1. Try to refresh using stored refresh token
2. If refresh succeeds — retry the original request with new access token
3. If refresh fails — clear all stored tokens, redirect to `/login`

### Route guards

```jsx
// Protect all app routes
<AuthGuard>           // redirects to /login if not authenticated
  <RoleGuard role="owner">   // redirects to /dashboard if wrong role
    <SensitivePage />
  </RoleGuard>
</AuthGuard>
```

---

## Validation schema (Zod)

```js
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
})
```

---

## Security rules

1. Never return `password_hash` in any response
2. Use generic error messages for login failures — never reveal whether email exists
3. Rate limit login endpoint: max 10 attempts per IP per 15 minutes
4. All tokens must be verified on every request — no caching of verification results
5. Refresh token rotation: every refresh issues a new pair and invalidates the old one
6. On password change (future feature): invalidate all existing refresh tokens for that user

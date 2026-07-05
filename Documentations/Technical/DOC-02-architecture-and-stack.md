# DOC-02 · Architecture & Stack
**Version:** v1.0  
**Last updated:** 2026-03-15

---

## Tech stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | Next.js App Router | React 18, Server Components |
| Styling | Tailwind CSS | Utility-first, mobile-first |
| State management | React Context / Server Actions | Server Actions handle logic |
| Backend | Next.js Server Actions | Local Server actions only |
| Database | Local JSON | Simulated using `src/lib/db.ts` |
| Auth | JWT (jose) | Stored in `session` cookie |
| Validation | Zod | Both frontend and backend |
| Testing | Vitest | Used with `vi.spyOn(auth)` for mocking |

---

## Folder structure

### Project (`/src`)
```
/src
  /app
    /actions           # Next.js Server Actions (staff.ts, eod.ts, auth.ts)
    /api               # Next.js API Routes (if any)
    /dashboard         # App Router pages
    /staff
    /login
    layout.tsx
    page.tsx
  /components
    /ui                # Reusable primitives: Button, Input, Badge, Card, Modal
    /layout            # AppShell, Sidebar, TopBar, BranchSelector
  /lib
    db.ts              # Local JSON database wrapper with locks
    auth.ts            # JWT verification and utilities
    audit.ts           # Audit log wrapper
  /hooks               # Custom React hooks
```

---

## API conventions

### Base URL
```
/api/v1
```

### Authentication
All routes except `/api/v1/auth/login` require a valid JWT in the Authorization header:
```
Authorization: Bearer <access_token>
```

### Request / response format
- All request bodies: `application/json`
- All responses: `application/json`
- Dates in request bodies: ISO 8601 string (`"2026-03-15"`)
- Monetary values: integer rupees (`1500`, not `"1500"` or `1500.00`)

### Standard success response
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "total": 35
  }
}
```

### Standard error response
```json
{
  "success": false,
  "error": {
    "code": "ATTENDANCE_ALREADY_MARKED",
    "message": "Attendance for this staff member on this date already exists."
  }
}
```

### Error codes (use these exact strings)
| Code | HTTP Status | Meaning |
|------|------------|---------|
| `UNAUTHORIZED` | 401 | No token or invalid token |
| `FORBIDDEN` | 403 | Valid token but insufficient role or wrong branch |
| `NOT_FOUND` | 404 | Resource does not exist |
| `VALIDATION_ERROR` | 422 | Request body failed Zod validation |
| `CONFLICT` | 409 | Unique constraint violation |
| `INTERNAL_ERROR` | 500 | Unhandled server error |

---

## Authorization via Server Actions

Instead of middleware, all restricted Server Actions enforce access via `requireBranchAccess(branchId)`.
```typescript
const enforcedBranchId = await requireBranchAccess(branchId);
```

---

## Audit logging

Every mutating request (POST, PUT, PATCH, DELETE) must write to `audit_logs`. Use the `auditLog` middleware or call the audit service directly from controllers.

Audit entry must include:
- `user_id` — who made the change
- `branch_id` — which branch was affected
- `table_name` — which table was modified
- `record_id` — which row was modified
- `action` — `INSERT`, `UPDATE`, or `DELETE`
- `old_value` — JSON snapshot before change (null for INSERT)
- `new_value` — JSON snapshot after change (null for DELETE)
- `created_at` — UTC timestamp

---

## Environment variables

```env
# Database
DATABASE_URL=file:./data/db.json

# Auth
JWT_SECRET=<long-random-string>
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=<different-long-random-string>
JWT_REFRESH_EXPIRES_IN=7d

# App
NODE_ENV=development
PORT=4000
CLIENT_URL=http://localhost:5173

# Timezone (informational — always store UTC in DB)
TZ=UTC
```

---

## Coding conventions

- Use `async/await` in Server Actions
- DB queries use `src/lib/db.ts`
- Validate all inputs with Zod schemas before processing
- Use `vi.spyOn` to mock `requireBranchAccess` and `getSession` during unit testing

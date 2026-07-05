# DOC-02 · Architecture & Tech Stack

## Stack
- Next.js (App Router)
- Drizzle ORM (connected to Netlify DB)
- Tailwind CSS
- Vitest / Playwright

## Data Storage
The application utilizes a JSON-blob backend via Drizzle ORM. The `json_store` PostgreSQL table holds a `filename` and a `data` text column. The system parses this stringified JSON on read and stringifies it on write.
A custom `withTransaction` in `src/lib/db.ts` acts as an in-memory Mutex to prevent race conditions when reading and writing these blobs.

### DB Files
- `users.json`, `staff.json`, `branches.json`
- Postgres `rate_limit` table (Handles in-house sliding-window rate limiting)
- `audit_logs.json` (Logs all destructive actions or modifications)

## Authentication
Authentication is fully stateless and built strictly on Next.js Server Actions:
1. `auth.ts` intercepts `/login` actions.
2. Checks IP rate limits via the Postgres `rate_limit` table.
3. Verifies bcrypt hashed passwords.
4. Drops an HttpOnly `session` cookie.

*No refresh tokens, localStorage, or Zustand are used for authentication.*

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

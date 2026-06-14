# DOC-02 · Architecture & Stack
**Version:** v1.0  
**Last updated:** 2026-03-15

---

## Tech stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | React 18 | Vite as build tool |
| Styling | Tailwind CSS | Utility-first, mobile-first |
| State management | Zustand | Lightweight, no Redux |
| API client | Axios | With interceptors for JWT |
| Backend | Node.js + Express | REST API |
| Database | PostgreSQL 15+ | Hosted on Railway or Render |
| Auth | JWT (jsonwebtoken) | Access token + refresh token |
| Validation | Zod | Both frontend and backend |
| File generation | pdfkit | Salary slips, monthly reports |
| Excel export | exceljs | Monthly data dumps |
| Password hashing | bcrypt | saltRounds = 12 |
| Offline drafts | localStorage | EOD entry drafts only |

---

## Folder structure

### Backend (`/server`)
```
/server
  /src
    /config
      db.js              # PostgreSQL pool setup
      env.js             # Validated env vars (zod)
    /middleware
      auth.js            # JWT verify middleware
      requireRole.js     # Role-based access control
      branchScope.js     # Injects branch_id from token, validates access
      auditLog.js        # Wraps responses to write audit entries
      errorHandler.js    # Global error handler
    /modules
      /auth
        auth.routes.js
        auth.controller.js
        auth.service.js
      /branches
        branches.routes.js
        branches.controller.js
        branches.service.js
      /staff
        staff.routes.js
        staff.controller.js
        staff.service.js
      /attendance
        attendance.routes.js
        attendance.controller.js
        attendance.service.js
      /payroll
        payroll.routes.js
        payroll.controller.js
        payroll.service.js
      /eod
        eod.routes.js
        eod.controller.js
        eod.service.js
      /expenses
        expenses.routes.js
        expenses.controller.js
        expenses.service.js
      /menu
        menu.routes.js
        menu.controller.js
        menu.service.js
      /dashboard
        dashboard.routes.js
        dashboard.controller.js
        dashboard.service.js
    /utils
      pagination.js
      dateHelpers.js     # UTC <-> IST conversions
      formatCurrency.js
    app.js               # Express app setup, middleware, routes
    server.js            # Entry point, starts server
  /migrations            # SQL migration files (numbered)
  /seeds                 # Seed data for development
  .env.example
  package.json
```

### Frontend (`/client`)
```
/client
  /src
    /api
      axios.js           # Axios instance with interceptors
      auth.api.js
      staff.api.js
      attendance.api.js
      payroll.api.js
      eod.api.js
      expenses.api.js
      menu.api.js
      dashboard.api.js
    /components
      /ui                # Reusable primitives: Button, Input, Badge, Card, Modal
      /layout            # AppShell, Sidebar, TopBar, BranchSelector
      /shared            # Shared domain components across modules
    /modules
      /auth              # Login page, auth guards
      /dashboard         # Home screen
      /staff             # Staff list, profile, add/edit
      /attendance        # Daily attendance screen
      /payroll           # Payroll table, approval, salary slip
      /eod               # EOD entry form
      /expenses          # Expense list view
      /menu              # Menu management
    /store
      authStore.js       # Zustand: user, token, role, branch
      uiStore.js         # Zustand: sidebar, alerts, loading states
    /utils
      formatDate.js      # IST display helpers
      formatCurrency.js  # ₹ formatting with en-IN locale
      offlineDraft.js    # localStorage draft helpers for EOD
    /hooks
      useAuth.js
      useBranch.js
      useDebounce.js
    App.jsx
    main.jsx
  index.html
  vite.config.js
  tailwind.config.js
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

## Branch scoping middleware

Every protected route runs `branchScope` middleware after JWT verification. This middleware:

1. Reads `branch_id` from the route param, query string, or request body
2. If the user is `owner` — allows any branch, also allows `null` branch_id for consolidated queries
3. If the user is `branch_manager` — checks that the requested `branch_id` matches their assigned `branch_id` from the JWT payload. Rejects with `FORBIDDEN` if it doesn't match.
4. Injects `req.branchId` for use in controllers

Never skip this middleware on any route that returns branch-scoped data.

---

## Role middleware

Use `requireRole(...roles)` middleware to restrict routes:

```js
// Only owner can access
router.delete('/:id', requireRole('owner'), controller.delete)

// Both owner and branch_manager can access
router.get('/', requireRole('owner', 'branch_manager'), controller.list)
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
DATABASE_URL=postgresql://user:password@host:5432/restaurant_db

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

- Use `async/await` — no raw Promise chains
- All DB queries go in the service layer, never in controllers
- Controllers only handle request/response — no business logic
- Validate all inputs with Zod schemas before processing
- Never return a password hash in any response
- Use named exports, not default exports, for services and controllers
- Use `camelCase` for JS variables and function names
- Use `snake_case` for all database column names and table names
- All IDs are UUIDs (`uuid_generate_v4()`) — never use integer auto-increment IDs
- All React components use functional components with hooks — no class components

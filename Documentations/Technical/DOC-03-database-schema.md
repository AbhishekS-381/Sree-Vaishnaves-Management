# DOC-03 · Database Schema
**Version:** v2.0  

---

## Global Conventions

- The application uses a single PostgreSQL table named `json_store` (via Netlify DB) to persist application state.
- Each "table" is represented as a distinct stringified JSON blob (e.g., `branches.json`, `staff.json`, `rate_limits.json`).
- All primary keys are standard UUIDs generated within the application layer.
- All relationships between entities are logical (enforced in code) rather than enforced via foreign keys.
- **Soft Deletion**: All major entities utilize a soft-delete pattern (`isActive: boolean`, `deletedAt: string`). Records are never removed from the JSON arrays.

---

## JSON Blob Structures

### `branches.json`
Represents a physical restaurant location.
```ts
type Branch = {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  isActive: boolean;
  createdAt: string;
  deletedAt?: string;
}
```

### `users.json`
Application access accounts.
```ts
type User = {
  id: string;
  name: string;
  email: string;
  password?: string; // bcrypt hash
  role: 'owner' | 'admin' | 'branch_manager';
  branchId?: string; // Restricted managers only
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
  deletedAt?: string;
}
```
*Note*: Passwords have been fully migrated to bcrypt hashes.

### `staff.json`
Employees attached to specific branches.
```ts
type Staff = {
  id: string;
  branchId: string;
  name: string;
  phone?: string;
  departmentId: string;
  roleId: string;
  monthlySalary: number;
  joinedAt: string;
  isActive: boolean;
  createdAt: string;
  deletedAt?: string;
}
```

### `rate_limits.json`
Tracks login attempts per IP.
```ts
type RateLimitEntry = {
  ip: string;
  attempts: number;
  resetAt: number; // Unix timestamp
}
```
*Note*: This file handles automatic garbage collection inside transactions, removing entries where `resetAt` < `Date.now()`.

### `audit_logs.json`
Append-only log of modifications across the platform.
```ts
type AuditLog = {
  id: string;
  userId: string;
  branchId?: string;
  tableName: string;
  recordId: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE'; // Soft delete is an UPDATE
  oldValue?: any;
  newValue?: any;
  createdAt: string;
}
```

---

## Deprecated Architecture Notes
- The concept of `HttpOnly Session Cookies.json` has been entirely deprecated. Sessions are managed via a single stateless JWT stored securely in an HttpOnly cookie.
- All `TIMESTAMPTZ` and SQL constructs have been converted to standard ISO 8601 strings in JSON.

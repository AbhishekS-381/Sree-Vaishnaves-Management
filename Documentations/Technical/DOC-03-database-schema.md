# DOC-03 · Database Schema
**Version:** v3.0
**Last updated:** 2026-09-30
**Depends on:** DOC-02

---

## Global conventions

- Persistence is a single PostgreSQL table `json_store(filename PRIMARY KEY, data TEXT)` plus a `rate_limit` table. Each logical "collection" is one row in `json_store` whose `data` is a stringified JSON array.
- IDs are application-generated strings, usually a prefix + UUID (e.g. `st_<uuid>`, `br_<uuid>`, `role_<uuid>`). Some are deterministic (payroll: `pay_{month}_{year}_{staffId}`; config: `global`).
- Relationships are **logical only** — resolved in code by matching id fields. No SQL foreign keys.
- **Soft delete** (`isActive: false` + `deletedAt`) is used by staff, branches, departments, roles, inventory, menu items, and users. Expenses, expense categories, and staff requirements are **hard-removed** from their arrays on delete.
- Timestamps are ISO 8601 strings. Dates are `YYYY-MM-DD` strings (computed in IST where "today" matters).
- Money is stored as integer rupees.

The `DB_FILES` map (`src/lib/db.ts`) lists every collection filename. The shapes below come directly from the TypeScript types in the action files.

---

## Collections

### `branches.json`
```ts
type Branch = {
  id: string;                 // br_<uuid>
  name: string;
  address: string;
  phone: string;
  status: 'operational' | 'closed' | 'maintenance';
  internalStartTime?: string; // "HH:MM" — staff operating window
  internalEndTime?: string;
  customerStartTime?: string; // "HH:MM" — customer-facing hours
  customerEndTime?: string;
  isActive?: boolean;
  deletedAt?: string;
}
```

### `users.json`
```ts
type User = {
  id: string;                 // u_<uuid> (seeded owner: u_owner_default)
  name: string;               // also used as the login username (case-insensitive)
  password?: string;          // bcrypt hash
  role: string;               // 'admin' | 'owner' | 'manager' | 'readonly'
  branchId?: string;          // set only for managers
  isActive?: boolean;
  deletedAt?: string;
}
```
There is **no `email` field**. Login matches on `name`.

### `departments.json`
```ts
type Department = { id: string; name: string; isActive?: boolean; deletedAt?: string }
```

### `roles.json`
```ts
type Role = {
  id: string;                 // role_<uuid>
  name: string;
  isChef?: boolean;           // if true, positions/staff of this role require a specialty (menu category)
  departmentIds?: string[];   // departments this role belongs to
  isActive?: boolean;
  deletedAt?: string;
}
```

### `staff.json`
```ts
type Staff = {
  id: string;                 // st_<uuid>
  name: string;
  branchId: string;
  departmentId: string;
  roleId: string;
  phone: string;
  label?: string;             // free-text tag (e.g. "Senior", "Part-time")
  monthlySalary?: number;
  isActive: boolean;
  joinedAt: string;           // YYYY-MM-DD
  exitDate?: string;
  shiftType?: 'morning' | 'evening' | 'full';
  specialtyId?: string;       // menu category id, for chef roles
  positionId?: string;        // links to a staff_requirements slot
  positionIndex?: number;     // which slot within that requirement's requiredCount
  startTime?: string;         // "HH:MM"
  endTime?: string;
  deletedAt?: string;
}
```

### `staff_requirements.json`
Defines budgeted "positions" (headcount slots) per branch/department/role.
```ts
type StaffRequirement = {
  id: string;                 // req_<uuid>
  branchId: string;
  departmentId: string;
  roleId: string;
  specialtyId?: string;       // menu category, for chef roles
  requiredCount: number;      // headcount
  defaultSalary?: number;
  startTime?: string;
  endTime?: string;
  responsibility?: string;    // max 500 chars
  schedules?: PositionSchedule[];
}

type PositionSchedule = { positionIndex: number; shifts: Shift[] }
type Shift = { id: string; start: string; end: string }  // "HH:MM"
```
Schedule validation (in `updateRequirementSchedules`): max 3 shifts per position, each shift within 05:00–23:00, ≥1h break between shifts, total ≤10h per position.

### `attendance.json`
```ts
type AttendanceLog = {
  id: string;
  date: string;               // YYYY-MM-DD
  staffId: string;
  branchId: string;
  status: 'present' | 'absent' | 'half-day' | 'holiday' | 'unmarked';
  shiftsWorked?: string[];
  updatedAt: string;
}
```
Note the status set uses `half-day` (hyphen). There is **no `leave` status**.

### `payroll.json`
```ts
type SalaryRecord = {
  id: string;                 // pay_{month}_{year}_{staffId}
  staffId: string;
  branchId?: string;
  name: string;
  month: number;              // 1-12
  year: number;
  monthlySalary: number;
  daysWorked: number;
  advances: number;
  payableAmount: number;      // max(0, round(monthlySalary/30 * daysWorked) - advances)
  status: 'PENDING' | 'PAID';
  notes?: string;
  paidAt?: string;
}
```

### `eod.json`
```ts
type EODEntry = {
  id: string;                 // eod_<uuid>
  branchId: string;
  date: string;               // YYYY-MM-DD
  income: {
    dineInCash: number; dineInUpi: number;
    takeawayCash: number; takeawayUpi: number;
  };
  openingFloat?: number;
  actualClosingFloat?: number;
  notes: string;
  status: 'draft' | 'submitted' | 'locked';
  createdAt: string;
  updatedAt: string;
  billing?: {
    totalBillAmount: number; billCount: number;
    dineInCovers: number; takeawayOrders: number;
    cashCollectedAsBilled: number; upiCollectedAsBilled: number;
    voids: number; discounts: number; gstCollected: number;
  };
  ops?: {
    staffOnDuty: number; powerCutHours: number;
    unusualEvent: string; kitchenIssue: boolean;
    zeroRevenueConfirmed: boolean;
  };
}
```

### `expenses.json`
```ts
type Expense = {
  id: string;                 // exp_<uuid> (EOD) | venexp_<uuid> (vendor bill)
  branchId: string;
  amount: number;
  categoryId: string;
  source: 'eod' | 'vendor';
  date: string;               // YYYY-MM-DD
  notes?: string;
  createdAt: string;
  isPaid?: boolean;           // vendor bills: paid/unpaid tracking
}
```

### `categories.json` (expense categories)
```ts
type ExpenseCategory = { id: string; name: string; color?: string }  // cat_<uuid>
```
Hard-deleted (no soft delete). Seeded defaults: Maintenance, Raw materials, Packaging, Gas / fuel, Rent, Electricity.

### `menu.json` (global menu items)
```ts
type MenuItem = {
  id: string;                 // mn_<uuid>
  name: string;
  categoryId: string;         // -> menu_categories.json
  basePrice: number;
  sortOrder: number;          // defaults to Date.now()
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### `menu_categories.json`
```ts
type MenuCategory = { id: string; name: string; sortOrder?: number; isActive?: boolean }  // mcat_<uuid>
```

### `branch_menu_items.json` (per-branch menu overrides)
```ts
type BranchMenuItem = {
  id: string;                 // bmi_<uuid>
  branchId: string;
  menuItemId: string;
  price: number | null;       // null = use item basePrice
  isAvailable: boolean;
}
```

### `branch_categories.json` (per-branch category availability)
```ts
type BranchMenuCategory = { id: string; branchId: string; categoryId: string; isAvailable: boolean }  // bcat_<uuid>
```

### `inventory.json`
```ts
type InventoryItem = {
  id: string;                 // inv_<uuid>
  branchId: string;
  name: string;
  unit: string;               // kg, litre, packet, piece, gram, ml, box, bottle
  currentQuantity: number;    // integer
  threshold: number;          // low-stock threshold
  updatedAt: string;
  isActive?: boolean;
  deletedAt?: string;
}
```

### `stock_adjustments.json`
```ts
type StockAdjustment = {
  id: string;                 // adj_<uuid>
  itemId: string;
  branchId: string;
  type: 'increase' | 'decrease';
  amount: number;             // integer >= 1
  reason: string;
  date: string;               // ISO timestamp
}
```

### `vendors.json`
```ts
type Vendor = {
  id: string;                 // ven_<uuid>
  branchId: string;
  name: string;
  phone: string;
  supplyType: string;
  createdAt: string;
}
```
Vendor bills are not a separate collection — they are written into `expenses.json` with `source: 'vendor'` and a `notes` string that embeds the vendor name and invoice reference.

### `config.json` (module toggles — single row)
```ts
type Config = {
  id: 'global';
  attendance: boolean;
  payroll: boolean;
  vendors: boolean;
  inventory: boolean;
  menu: boolean;
  reports: boolean;
}
```
Seeded with all flags `false`. `false` hides the module from navigation and suppresses its dashboard alerts.

### `audit_logs.json`
```ts
type AuditLogEntry = {
  id: string;                 // randomUUID
  timestamp: string;
  userId: string;             // or 'system'
  userName: string;
  action: string;             // e.g. CREATE_STAFF, SAVE_EOD, UPDATE_EXPENSE
  entityType: string;
  entityId?: string;
  details: string;
}
```
Capped at the most recent 3000 entries. Written by `logAction()` from a subset of mutations.

### `advances.json`, `daily_tally.json`
Present in `DB_FILES` and seeded as empty arrays (`[]`). Not actively read/written by any current action — reserved/legacy. Advances are captured inline on payroll records, not in `advances.json`.

---

## Real Postgres tables

### `json_store`
```sql
CREATE TABLE "json_store" (
  "filename" varchar(255) PRIMARY KEY,
  "data"     text NOT NULL
);
```

### `rate_limit`
```sql
CREATE TABLE IF NOT EXISTS rate_limit (
  key            VARCHAR(255) PRIMARY KEY,   -- "login:ip:<ip>" or "login:user:<name>"
  attempts       INTEGER      NOT NULL DEFAULT 0,
  window_start   BIGINT       NOT NULL,       -- epoch ms
  blocked_until  BIGINT       NOT NULL DEFAULT 0
);
```
Used by the login rate limiter (DOC-04). Rows are atomically upserted per attempt, deleted on successful login, and periodically pruned.

---

## Notes on legacy/aspirational schema

Earlier drafts of this doc described `email` on users, a `rate_limits.json` blob, `holiday_flags`, a separate `advances` table with `is_deducted`, and SQL `TIMESTAMPTZ`/foreign keys. None of those exist in the code. Rate limiting is a **real table**, not a JSON blob; there is no holiday-flags collection; advances live on the payroll record.

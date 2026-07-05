# DOC-03 · Database Schema
**Version:** v1.0  
**Last updated:** 2026-03-15

---

## Global conventions

- All primary keys are UUIDs: `id UUID PRIMARY KEY DEFAULT uuid_generate_v4()`
- All tables have `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- All timestamps are stored in **UTC**
- Soft deletes use `deleted_at TIMESTAMPTZ DEFAULT NULL` — a non-null value means deleted
- Monetary values are **integers** (INR rupees, no paise)
- Every table (except `branches`, `users`, `audit_logs`) has `branch_id UUID NOT NULL REFERENCES branches(id)`
- Run `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";` before migrations

---

## Tables

---

### `branches`
Represents a physical restaurant location.

```sql
CREATE TABLE branches (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(100) NOT NULL,
  address       TEXT,
  phone         VARCHAR(20),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ DEFAULT NULL
);
```

**Notes:**
- Branch 1 is seeded on first deployment
- Branch 2 is added as a row when ready — no code changes needed
- `is_active = false` hides the branch from all UI without deleting data

---

### `users`
App login accounts. Only owner, branch managers, and super admin.

```sql
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            VARCHAR(100) NOT NULL,
  email           VARCHAR(255) NOT NULL UNIQUE,
  password_hash   VARCHAR(255) NOT NULL,
  role            VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'branch_manager', 'super_admin')),
  branch_id       UUID REFERENCES branches(id) DEFAULT NULL,
  -- branch_id is NULL for owner and super_admin (they access all branches)
  -- branch_id is set for branch_manager (restricts their access)
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at   TIMESTAMPTZ DEFAULT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ DEFAULT NULL
);
```

**Notes:**
- `branch_id` is NULL for `owner` and `super_admin`
- `branch_id` is required for `branch_manager`
- Never return `password_hash` in any API response
- JWT payload includes: `{ userId, role, branchId, name }`

---

### `refresh_tokens`
Stores refresh tokens for persistent sessions.

```sql
CREATE TABLE refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  VARCHAR(255) NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

### `staff`
Restaurant employees. Managed by owner/branch manager. No login access.

```sql
CREATE TABLE staff (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id     UUID NOT NULL REFERENCES branches(id),
  name          VARCHAR(100) NOT NULL,
  phone         VARCHAR(20),
  department_id UUID NOT NULL,
  role_id       UUID NOT NULL,
  monthly_salary INTEGER NOT NULL CHECK (monthly_salary > 0),
  -- Monthly base salary in INR rupees (integer)
  joined_at     DATE NOT NULL DEFAULT CURRENT_DATE,
  notes         TEXT DEFAULT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ DEFAULT NULL
);

CREATE INDEX idx_staff_branch ON staff(branch_id);
CREATE INDEX idx_staff_active ON staff(branch_id, is_active);
```

---

### `attendance_logs`
One row per staff member per day.

```sql
CREATE TABLE attendance_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id   UUID NOT NULL REFERENCES branches(id),
  staff_id    UUID NOT NULL REFERENCES staff(id),
  date        DATE NOT NULL,
  status      VARCHAR(20) NOT NULL CHECK (status IN ('present', 'absent', 'half_day', 'leave', 'holiday')),
  marked_by   UUID NOT NULL REFERENCES users(id),
  -- 'holiday' is set when the branch flags a day as closed
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_attendance_staff_date UNIQUE (staff_id, date)
);

CREATE INDEX idx_attendance_branch_date ON attendance_logs(branch_id, date);
CREATE INDEX idx_attendance_staff ON attendance_logs(staff_id);
```

**Notes:**
- The unique constraint on `(staff_id, date)` prevents double-marking
- When a branch is marked as holiday, all staff for that branch on that date get `status = 'holiday'` in bulk
- `holiday` status is excluded from both present count and absent count in payroll

---

### `holiday_flags`
Tracks days when a branch is fully closed.

```sql
CREATE TABLE holiday_flags (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id   UUID NOT NULL REFERENCES branches(id),
  date        DATE NOT NULL,
  reason      VARCHAR(255),
  created_by  UUID NOT NULL REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_holiday_branch_date UNIQUE (branch_id, date)
);
```

---

### `salary_advances`
Each advance is a separate row. Deducted at payroll time.

```sql
CREATE TABLE salary_advances (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id     UUID NOT NULL REFERENCES branches(id),
  staff_id      UUID NOT NULL REFERENCES staff(id),
  amount        INTEGER NOT NULL CHECK (amount > 0),
  advance_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  note          TEXT DEFAULT NULL,
  is_deducted   BOOLEAN NOT NULL DEFAULT FALSE,
  -- Flips to TRUE when the month's payroll is approved
  -- Prevents double-deduction if payroll is regenerated
  created_by    UUID NOT NULL REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_advances_staff ON salary_advances(staff_id);
CREATE INDEX idx_advances_branch_month ON salary_advances(branch_id, advance_date);
```

---

### `payroll_records`
One row per staff member per calendar month. Generated and locked by owner.

```sql
CREATE TABLE payroll_records (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id         UUID NOT NULL REFERENCES branches(id),
  staff_id          UUID NOT NULL REFERENCES staff(id),
  month             CHAR(7) NOT NULL,
  -- Format: 'YYYY-MM' e.g. '2026-03'
  working_days      INTEGER NOT NULL,
  -- Configured working days for this branch this month (default 26)
  days_present      INTEGER NOT NULL DEFAULT 0,
  half_days         INTEGER NOT NULL DEFAULT 0,
  days_holiday      INTEGER NOT NULL DEFAULT 0,
  monthly_salary    INTEGER NOT NULL,
  -- Snapshot of monthly_salary at time of payroll — in case it changes later
  gross_salary      INTEGER NOT NULL,
  -- Calculated: ROUND((days_present + 0.5 * half_days) / working_days * monthly_salary)
  total_advances    INTEGER NOT NULL DEFAULT 0,
  net_payable       INTEGER NOT NULL,
  -- net_payable = gross_salary - total_advances (floor at 0)
  override_amount   INTEGER DEFAULT NULL,
  -- If owner manually overrides the net payable, stored here
  override_note     TEXT DEFAULT NULL,
  status            VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved')),
  approved_by       UUID REFERENCES users(id) DEFAULT NULL,
  approved_at       TIMESTAMPTZ DEFAULT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_payroll_staff_month UNIQUE (staff_id, month)
);

CREATE INDEX idx_payroll_branch_month ON payroll_records(branch_id, month);
```

**Salary formula:**
```
gross_salary = ROUND((days_present + 0.5 * half_days) / working_days * monthly_salary)
net_payable  = MAX(0, gross_salary - total_advances)
```

If `override_amount` is set, use that instead of `net_payable` as the final payout.

---

### `daily_entries`
One EOD entry per branch per day.

```sql
CREATE TABLE daily_entries (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id           UUID NOT NULL REFERENCES branches(id),
  date                DATE NOT NULL,
  -- Income
  dinein_cash         INTEGER NOT NULL DEFAULT 0,
  dinein_upi          INTEGER NOT NULL DEFAULT 0,
  takeaway_cash       INTEGER NOT NULL DEFAULT 0,
  takeaway_upi        INTEGER NOT NULL DEFAULT 0,
  total_income        INTEGER GENERATED ALWAYS AS
                        (dinein_cash + dinein_upi + takeaway_cash + takeaway_upi) STORED,
  -- Petty cash (optional — not enforced)
  petty_cash_opening  INTEGER DEFAULT NULL,
  petty_cash_closing  INTEGER DEFAULT NULL,
  -- Meta
  notes               TEXT DEFAULT NULL,
  is_holiday          BOOLEAN NOT NULL DEFAULT FALSE,
  is_locked           BOOLEAN NOT NULL DEFAULT FALSE,
  locked_at           TIMESTAMPTZ DEFAULT NULL,
  created_by          UUID NOT NULL REFERENCES users(id),
  updated_by          UUID REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_daily_entry_branch_date UNIQUE (branch_id, date)
);

CREATE INDEX idx_daily_entries_branch_date ON daily_entries(branch_id, date);
```

**Notes:**
- `total_income` is a generated column — never write to it directly
- `is_locked` is set to `true` after the 24-hour edit window (via a scheduled job or on next access)
- Owner can set `is_locked = false` to unlock any entry
- `petty_cash_opening` and `petty_cash_closing` are optional — null means skipped
- If `is_holiday = true`, income fields are expected to be 0 and income is excluded from reports

---

### `expenses`
Shared ledger. Written by both EOD entry and vendor management screens.

```sql
CREATE TABLE expenses (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id         UUID NOT NULL REFERENCES branches(id),
  daily_entry_id    UUID REFERENCES daily_entries(id) DEFAULT NULL,
  -- Links expense to the day's EOD entry. Can be NULL for vendor-entered expenses
  -- that don't have a daily entry yet (rare edge case)
  date              DATE NOT NULL,
  -- Always store the date explicitly — do not derive from daily_entry_id
  category_id       UUID NOT NULL REFERENCES expense_categories(id),
  amount            INTEGER NOT NULL CHECK (amount > 0),
  vendor_name       VARCHAR(100) DEFAULT NULL,
  invoice_ref       VARCHAR(100) DEFAULT NULL,
  source            VARCHAR(20) NOT NULL CHECK (source IN ('eod', 'vendor')),
  notes             TEXT DEFAULT NULL,
  created_by        UUID NOT NULL REFERENCES users(id),
  updated_by        UUID REFERENCES users(id) DEFAULT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ DEFAULT NULL
);

CREATE INDEX idx_expenses_branch_date ON expenses(branch_id, date);
CREATE INDEX idx_expenses_daily_entry ON expenses(daily_entry_id);
CREATE INDEX idx_expenses_category ON expenses(category_id);
```

**Rules:**
- EOD screen: INSERT only (source = 'eod')
- Vendor management screen: INSERT, UPDATE, DELETE (source = 'vendor' for new entries; can edit any source)
- Soft delete only — set `deleted_at`, never DELETE

---

### `expense_categories`
Configurable list of expense categories. Global (not branch-scoped).

```sql
CREATE TABLE expense_categories (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(100) NOT NULL UNIQUE,
  color       VARCHAR(7) DEFAULT '#888888',
  -- Hex color for UI display
  is_default  BOOLEAN NOT NULL DEFAULT FALSE,
  -- Default categories are shown in EOD quick-tap tags
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Default categories (seed data):**
| Name | is_default |
|------|-----------|
| Raw materials | true |
| Gas / fuel | true |
| Electricity | true |
| Rent | true |
| Salary advance | true |
| Maintenance | true |
| Miscellaneous | true |

---

### `menu_items`
Menu items per branch.

```sql
CREATE TABLE menu_items (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id     UUID NOT NULL REFERENCES branches(id),
  name          VARCHAR(150) NOT NULL,
  category      VARCHAR(100) NOT NULL,
  -- e.g. 'breakfast', 'lunch', 'dinner', 'beverages', 'specials'
  price         INTEGER NOT NULL CHECK (price >= 0),
  is_available  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ DEFAULT NULL
);

CREATE INDEX idx_menu_branch ON menu_items(branch_id);
```

---

### `audit_logs`
Append-only. Never updated or deleted.

```sql
CREATE TABLE audit_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id),
  branch_id   UUID REFERENCES branches(id) DEFAULT NULL,
  table_name  VARCHAR(100) NOT NULL,
  record_id   UUID NOT NULL,
  action      VARCHAR(10) NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_value   JSONB DEFAULT NULL,
  new_value   JSONB DEFAULT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_table_record ON audit_logs(table_name, record_id);
CREATE INDEX idx_audit_branch ON audit_logs(branch_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);
```

**Notes:**
- No UPDATE or DELETE ever runs on this table
- No `deleted_at` column — audit logs are permanent
- `old_value` is null for INSERT actions
- `new_value` is null for DELETE actions
- Strip sensitive fields (password_hash) before storing in JSONB

---

## Relationships summary

```
branches
  └── users (branch_manager only)
  └── staff
        └── attendance_logs
        └── salary_advances
        └── payroll_records
  └── daily_entries
        └── expenses
  └── expenses (also linked to daily_entries)
  └── menu_items
  └── holiday_flags

expense_categories (global, no branch_id)
  └── expenses

audit_logs (references users and branches)
```

---

## Migration order

Run migrations in this exact order to respect foreign key dependencies:

1. Enable uuid extension
2. `branches`
3. `users`
4. `refresh_tokens`
5. `expense_categories`
6. `staff`
7. `holiday_flags`
8. `attendance_logs`
9. `salary_advances`
10. `payroll_records`
11. `daily_entries`
12. `expenses`
13. `menu_items`
14. `audit_logs`

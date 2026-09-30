# Requirements — Application Baseline

**Spec:** `app-baseline`
**Type:** Baseline / reference spec (describes the whole system as-built). **Not** a feature to build.
**Status:** Living document — reflects the implemented codebase as of 2026-09-30.

> Purpose: capture the complete, verified behavior of Sree Vaishnaves Management so future feature specs can reference a stable baseline instead of re-deriving it. New feature specs live in their own `.kiro/specs/<feature>/` folders and only describe the delta.

Acceptance criteria use EARS phrasing (WHEN/IF … THE SYSTEM SHALL …). They document current behavior; they are the regression baseline.

---

## Requirement 1 — Authentication & session

**User story:** As a portal user, I want to log in securely, so that only authorized people can access management data.

#### Acceptance criteria
1. WHEN a user submits a username and password THE SYSTEM SHALL validate both are non-empty, look up an active user by case-insensitive name, and verify the password with bcrypt.
2. IF the credentials are valid THE SYSTEM SHALL sign a 2-hour HS256 JWT (containing userId, name, role, branchId, and the flags isRootAdmin/isGlobalAdmin/isGlobalOwner) and store it in an `HttpOnly`, `SameSite=strict` cookie named `session`, then redirect to `/management`.
3. IF the credentials are invalid THE SYSTEM SHALL return `{ error: 'Invalid Credentials' }` and set no cookie.
4. WHEN login attempts exceed 10 per IP per minute OR 20 per username per hour THE SYSTEM SHALL block further attempts for 5 minutes; IF the rate-limit datastore errors THE SYSTEM SHALL fail open (allow the attempt).
5. WHEN a request targets `/management/*` without a valid session cookie THE SYSTEM SHALL redirect to `/management/login`; WHEN an authenticated user targets `/management/login` THE SYSTEM SHALL redirect to `/management`.
6. WHEN a user logs out THE SYSTEM SHALL delete the `session` cookie and redirect to `/management/login`.
7. WHERE `JWT_SECRET` is absent THE SYSTEM SHALL fail fast (throw) rather than sign with a default.

## Requirement 2 — Roles & branch scoping

**User story:** As the business, I want role- and branch-based access control, so that managers only touch their own branch and only trusted roles perform privileged actions.

#### Acceptance criteria
1. THE SYSTEM SHALL recognize exactly four roles: `admin`, `owner`, `manager`, `readonly`.
2. WHERE a role is `admin` or `owner` THE SYSTEM SHALL treat it as a global admin (cross-branch access).
3. WHERE a role is `admin` THE SYSTEM SHALL additionally permit Settings access; WHERE a role is not `admin` THE SYSTEM SHALL redirect requests for `/management/settings` to `/management`.
4. WHEN a `manager` performs a branch-bound action THE SYSTEM SHALL force the operation onto their assigned `branchId` and SHALL reject (`Forbidden`) any attempt targeting another branch.
5. WHEN a page loads data for a non-global user THE SYSTEM SHALL filter every collection to that user's branch before rendering (defense in depth alongside the action check).
6. WHERE a role is `readonly` THE SYSTEM SHALL hide mutation controls and redirect it away from the EOD entry page.

## Requirement 3 — Persistence & data integrity

**User story:** As a developer, I want a consistent persistence model, so that all state is stored and mutated the same way.

#### Acceptance criteria
1. THE SYSTEM SHALL persist each logical collection as one JSON-array row in the `json_store` Postgres table, accessed only via `readJSON`/`writeJSON`/`withTransaction`.
2. WHEN a mutation runs THE SYSTEM SHALL perform it inside `withTransaction` (read → mutate → write) under a per-file in-process mutex.
3. THE SYSTEM SHALL store monetary values as integer rupees.
4. WHEN "today" is needed THE SYSTEM SHALL compute the date in IST (Asia/Kolkata).
5. WHEN a core entity (staff, branch, department, role, inventory item, menu item, user) is deleted THE SYSTEM SHALL soft-delete it (`isActive=false`, `deletedAt`) and exclude it from active views.
6. WHEN a sensitive mutation occurs (at minimum: staff create/delete, attendance save, EOD save, expense edit/delete) THE SYSTEM SHALL append an audit entry to `audit_logs.json`, capped at the most recent 3000 entries, and SHALL never let an audit failure break the operation.

## Requirement 4 — Dashboard

**User story:** As an operator, I want a daily snapshot, so that I know the state of the business at a glance.

#### Acceptance criteria
1. WHEN the dashboard loads THE SYSTEM SHALL show KPI cards for total active branches, active staff, today's collection (sum of today's EOD income), and net balance (today's collection − today's expenses), scoped to the user's visible branches.
2. WHEN the current day has no attendance rows AND the attendance module is enabled THE SYSTEM SHALL surface an "attendance not marked" alert.
3. WHEN the current day has no EOD entry THE SYSTEM SHALL surface an "EOD not filled" alert.
4. WHEN it is within the last ~3 days of the month AND no payroll exists for the current month/year AND the payroll module is enabled THE SYSTEM SHALL surface a "payroll due" alert.
5. WHEN any inventory item is at/below its threshold AND the inventory module is enabled THE SYSTEM SHALL surface a low-stock alert with a count.
6. THE SYSTEM SHALL render a branch-status panel with a colored pill per branch (operational/maintenance/other).

## Requirement 5 — Staff & positions

**User story:** As a manager, I want to manage staff and budgeted positions, so that rosters, pay, and scheduling have a foundation.

#### Acceptance criteria
1. WHEN staff data is submitted THE SYSTEM SHALL validate it (name, phone, department, role, branch, integer salary ≥ 0, optional label/shift/times) and reject duplicates matching name+phone+branch among active records.
2. WHEN a staff member is mapped to a position slot THE SYSTEM SHALL assign the lowest free `positionIndex` and SHALL lock branch/department/role/specialty to the requirement definition.
3. WHEN a staff member is deactivated or deleted THE SYSTEM SHALL clear their `positionId`/`positionIndex` to free the slot.
4. WHEN a position requirement is created THE SYSTEM SHALL reject a duplicate of the same branch+department+role+specialty.
5. IF active staff are assigned to a requirement THE SYSTEM SHALL prevent changing that requirement's role or department.
6. WHEN saving position schedules THE SYSTEM SHALL enforce: ≤3 shifts per position, each shift within 05:00–23:00, ≥1-hour break between shifts, and ≤10 total hours per position.
7. WHERE the role is a chef role (`isChef`) THE SYSTEM SHALL require a specialty (menu category).
8. WHEN deleting staff THE SYSTEM SHALL require a global admin.

## Requirement 6 — Attendance

**User story:** As a manager, I want fast daily attendance, so that payroll has accurate day counts.

#### Acceptance criteria
1. THE SYSTEM SHALL support statuses `present`, `absent`, `half-day`, `holiday` (with `unmarked` as the unset default).
2. WHEN attendance is saved THE SYSTEM SHALL upsert one record per `(date, staffId)` and stamp the enforced branch.
3. IF a submitted date is in the future THE SYSTEM SHALL reject the entire save.
4. IF a submitted date is more than 7 days old AND the user is not a global admin THE SYSTEM SHALL reject the save.
5. WHEN a manager saves attendance THE SYSTEM SHALL confine it to their branch.

## Requirement 7 — Payroll

**User story:** As an owner, I want monthly payroll computed from attendance, so that salaries are accurate and settled with a record.

#### Acceptance criteria
1. WHEN the payroll screen opens for a month/year THE SYSTEM SHALL pre-fill each active staff member's days-worked from that month's attendance (present=1, half-day=0.5, capped at 31), editable by the user.
2. WHEN payroll is saved THE SYSTEM SHALL compute `payableAmount = max(0, round(monthlySalary/30 × daysWorked) − advances)` per staff, store records keyed `pay_{month}_{year}_{staffId}` with status `PENDING`, and replace any existing records for that month/year.
3. THE SYSTEM SHALL validate month ∈ 1..12 and year ∈ 2020..2100.
4. WHEN a record is marked paid THE SYSTEM SHALL require a global admin and set status `PAID` with `paidAt`.
5. WHERE a manager runs payroll THE SYSTEM SHALL scope it to their branch's staff.

## Requirement 8 — Day-End (EOD) entry

**User story:** As an operator, I want a fast end-of-day entry, so that daily income and expenses are recorded and reconcilable.

#### Acceptance criteria
1. THE SYSTEM SHALL capture income (dine-in/takeaway × cash/UPI) and optionally opening/closing cash float, a billing sub-object, and an ops sub-object, plus notes.
2. WHEN total income is 0 AND `ops.zeroRevenueConfirmed` is not true THE SYSTEM SHALL reject with `ZERO_REVENUE_UNCONFIRMED`.
3. IF the date is in the future THE SYSTEM SHALL reject the entry.
4. THE SYSTEM SHALL enforce one entry per `(date, branchId)` via upsert; new entries are created with status `submitted`.
5. WHEN an existing entry is `locked` OR older than 24 hours THE SYSTEM SHALL allow edits only by a global admin.
6. WHEN an EOD entry is saved THE SYSTEM SHALL replace that day's `source:'eod'` expenses in the shared ledger while preserving `source:'vendor'` expenses.
7. THE SYSTEM SHALL redirect `readonly` users away from the EOD page.

## Requirement 9 — Expense ledger

**User story:** As an owner, I want one shared expense ledger, so that all spend is tracked and categorized once.

#### Acceptance criteria
1. THE SYSTEM SHALL store all expenses in one collection tagged `source` = `eod` | `vendor`, referencing a global category by `categoryId`.
2. WHEN editing or deleting a ledger expense THE SYSTEM SHALL require a global admin; delete is a hard removal.
3. WHEN a ledger expense is edited THE SYSTEM SHALL preserve its `id` and `branchId` and audit the change.
4. THE SYSTEM SHALL allow managers to create expenses (via EOD or vendor flows) for their branch but not edit/delete ledger rows.

## Requirement 10 — Vendors

**User story:** As a manager, I want to track suppliers and their bills, so that purchases and payments are recorded.

#### Acceptance criteria
1. WHEN a vendor is created THE SYSTEM SHALL validate name/phone/supplyType/branch and reject duplicate names within a branch.
2. WHEN a vendor bill is recorded THE SYSTEM SHALL write an expense row with `source:'vendor'`, embed vendor/invoice in the notes, and set the paid flag from the form.
3. WHEN a vendor bill is marked paid THE SYSTEM SHALL set `isPaid=true`, restricted to the branch for managers.

## Requirement 11 — Inventory

**User story:** As a manager, I want manual stock tracking with alerts, so that shortages are caught early.

#### Acceptance criteria
1. THE SYSTEM SHALL store items with an integer `currentQuantity`, a `threshold`, and a unit; quantities change only via adjustments.
2. WHEN an adjustment is recorded THE SYSTEM SHALL apply increase/decrease and append a `stock_adjustments` row with a reason; IF a decrease exceeds current quantity THE SYSTEM SHALL reject it.
3. WHEN an item's quantity is at/below its threshold THE SYSTEM SHALL make it eligible for the dashboard low-stock alert.
4. THE SYSTEM SHALL reject duplicate item name+unit within a branch.

## Requirement 12 — Menu

**User story:** As an admin, I want a global menu with per-branch overrides, so that branches share a catalog but can differ on price/availability.

#### Acceptance criteria
1. THE SYSTEM SHALL maintain global menu items and categories; only global admins may create/edit/delete them.
2. WHEN a menu item is created THE SYSTEM SHALL auto-create `branch_menu_items` mappings for every active branch.
3. WHEN a menu item is deleted THE SYSTEM SHALL soft-delete it and preserve branch mappings.
4. WHEN availability/price is toggled per branch THE SYSTEM SHALL allow any authenticated user but confine managers to their own branch.
5. THE SYSTEM SHALL compute effective price as the branch override if set, else the item `basePrice`.

## Requirement 13 — Reports

**User story:** As an owner, I want computed analytics, so that I understand performance without manual aggregation.

#### Acceptance criteria
1. WHEN Reports loads THE SYSTEM SHALL compute, for a selected branch + month/year: total revenue with dine-in/takeaway and cash/UPI splits, month-on-month change, expenses by category, payroll payable, salary-as-%-of-revenue, net profit (= revenue − expenses − payroll payable), and billing-derived metrics (GST, covers, average cover value, discounts, voids).
2. THE SYSTEM SHALL restrict a non-global user's report data to their branch (enforced in the loader).
3. WHEN the user exports THE SYSTEM SHALL produce a CSV summary. (No Excel/PDF.)

## Requirement 14 — Settings, branches & module toggles

**User story:** As an admin, I want to configure master data and which modules are active, so that the system fits the business.

#### Acceptance criteria
1. THE SYSTEM SHALL restrict the Settings page and the department/role/module-toggle actions to `admin`.
2. THE SYSTEM SHALL restrict expense-category, user, and branch management to global admins (admin/owner).
3. WHEN a module toggle in `config.json` is off THE SYSTEM SHALL hide the module from navigation and suppress its dashboard alerts. Toggleable: attendance, payroll, vendors, inventory, menu, reports.
4. WHEN deleting a department/role/branch THE SYSTEM SHALL block the delete if it would orphan active dependents (e.g. a role in use by active staff, a branch with active staff, a department that is a role's only link).
5. THE SYSTEM SHALL never expose password hashes to the client (Settings sanitizes users before rendering).

## Requirement 15 — Public website

**User story:** As a customer, I want a public site, so that I can learn about the restaurant.

#### Acceptance criteria
1. THE SYSTEM SHALL serve a static marketing page at `/` with no authentication.
2. THE SYSTEM SHALL let the middleware pass `/` through untouched and SHALL not apply management gating to it.

---

## Cross-cutting non-functional requirements

1. **Security:** strict headers + CSP set globally; bcrypt hashing; HttpOnly session; no secrets added to source.
2. **Performance/UX:** mobile-first; routine screens fast; nudges never block.
3. **Testing:** changes covered by Vitest unit tests (mock DB + session) and, where user-facing, Playwright; keep configured coverage thresholds green.
4. **Consistency:** follow the Server Action contract and the soft/hard-delete convention of the collection being touched.

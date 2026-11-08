# DOC-03 · Database Schema
**Version:** v3.0
**Last updated:** 2026-11-02
**Depends on:** DOC-02

---

## Global architecture & conventions

The application persists state in a **normalized PostgreSQL database** containing **27 relational tables** defined in `db/schema.ts` managed by Drizzle ORM, plus a `rate_limit` table.

- **Dual Keying Scheme:** Every table features a BigSerial surrogate primary key (`pk` — auto-incrementing integer) and a canonical UUID primary identifier (`id: uuid("id").notNull().unique().defaultRandom()`), with all foreign key relations across all tables enforced as native PostgreSQL `uuid` types.
- **Data Integrity & Indexes:** Database-level partial unique indexes prevent conflicting states (e.g. `pos_orders_open_table_uniq` guarantees only one open order per dining table; `bmi_branch_item_variant_uniq` guarantees one override per branch/item/variant).
- **JSONB Structured Columns:** Complex nested sub-structures that change atomically with their parent record (e.g. `eod.income`, `eod.billing`, `eod.ops`, `pos_orders.items`, `pos_orders.bill`, `pos_orders.payment`, `pos_orders.void`, `staff_requirements.schedules`) are stored as native PostgreSQL `jsonb` columns.
- **Timestamps:** Created/updated timestamps are stored with timezone (`timestamptz`). Date strings for daily scoping (`date`) use `YYYY-MM-DD` strings formatted in Asia/Kolkata (IST).
- **Monetary amounts:** All prices, fees, discounts, and payments are stored as integer Indian Rupees (`INR`, no paise).
- **Soft Deletion:** Core entities (`branches`, `departments`, `roles`, `staff`, `inventory`, `menu_items`, `menu_categories`, `menu_item_variants`, `pos_tables`, `users`) maintain `isActive: boolean` and `deletedAt: timestamptz` flags. Active partial indexes (e.g. `staff_active_branch_idx`, `inventory_active_branch_idx`) ensure index efficiency.

---

## Table Schemas (`db/schema.ts`)

### 1. `branches`
Stores branch locations and operating hours.
```ts
export const branches = pgTable("branches", {
  pk:                bigserial("pk", { mode: "number" }).primaryKey(),
  id:                varchar("id", { length: 255 }).notNull().unique(), // br_<uuid>
  name:              varchar("name", { length: 100 }).notNull(),
  address:           varchar("address", { length: 200 }),
  phone:             varchar("phone", { length: 50 }),
  status:            varchar("status", { length: 20 }).notNull().default("operational"), // operational | closed | maintenance
  internalStartTime: varchar("internal_start_time", { length: 5 }), // "HH:MM"
  internalEndTime:   varchar("internal_end_time", { length: 5 }),
  customerStartTime: varchar("customer_start_time", { length: 5 }),
  customerEndTime:   varchar("customer_end_time", { length: 5 }),
  isActive:          boolean("is_active").notNull().default(true),
  deletedAt:         timestamp("deleted_at", { withTimezone: true, mode: "date" }),
}, (table) => [
  index("branches_name_idx").on(table.name),
]);
```

### 2. `departments`
Master departments (Kitchen, Service, Utility, Accounts, Management).
```ts
export const departments = pgTable("departments", {
  pk:        bigserial("pk", { mode: "number" }).primaryKey(),
  id:        varchar("id", { length: 255 }).notNull().unique(), // dept_<uuid>
  name:      varchar("name", { length: 100 }).notNull(),
  isActive:  boolean("is_active").notNull().default(true),
  deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
});
```

### 3. `roles`
Master job titles / operational roles.
```ts
export const roles = pgTable("roles", {
  pk:            bigserial("pk", { mode: "number" }).primaryKey(),
  id:            varchar("id", { length: 255 }).notNull().unique(), // role_<uuid>
  name:          varchar("name", { length: 100 }).notNull(),
  isChef:        boolean("is_chef").default(false), // requires specialtyId when true
  departmentIds: jsonb("department_ids"),
  isActive:      boolean("is_active").notNull().default(true),
  deletedAt:     timestamp("deleted_at", { withTimezone: true, mode: "date" }),
});
```

### 4. `staff`
Staff employee profiles.
```ts
export const staff = pgTable("staff", {
  pk:            bigserial("pk", { mode: "number" }).primaryKey(),
  id:            varchar("id", { length: 255 }).notNull().unique(), // st_<uuid>
  name:          varchar("name", { length: 100 }).notNull(),
  branchId:      varchar("branch_id", { length: 255 }).notNull(),
  departmentId:  varchar("department_id", { length: 255 }).notNull(),
  roleId:        varchar("role_id", { length: 255 }).notNull(),
  phone:         varchar("phone", { length: 15 }).notNull(),
  label:         varchar("label", { length: 50 }),
  monthlySalary: integer("monthly_salary").default(0),
  isActive:      boolean("is_active").notNull().default(true),
  joinedAt:      varchar("joined_at", { length: 10 }), // YYYY-MM-DD
  exitDate:      varchar("exit_date", { length: 10 }),
  shiftType:     varchar("shift_type", { length: 10 }),
  specialtyId:   varchar("specialty_id", { length: 255 }),
  positionId:    varchar("position_id", { length: 255 }),
  positionIndex: integer("position_index"),
  startTime:     varchar("start_time", { length: 5 }),
  endTime:       varchar("end_time", { length: 5 }),
  deletedAt:     timestamp("deleted_at", { withTimezone: true, mode: "date" }),
}, (table) => [
  index("staff_branch_idx").on(table.branchId),
  index("staff_role_idx").on(table.roleId),
  index("staff_position_idx").on(table.positionId),
  index("staff_active_branch_idx").on(table.branchId, table.isActive).where(sql`is_active = true`),
]);
```

### 5. `staff_requirements`
Budgeted headcount requirements and multi-segment shift schedules per role.
```ts
export const staffRequirements = pgTable("staff_requirements", {
  pk:             bigserial("pk", { mode: "number" }).primaryKey(),
  id:             varchar("id", { length: 255 }).notNull().unique(), // req_<uuid>
  branchId:       varchar("branch_id", { length: 255 }).notNull(),
  departmentId:   varchar("department_id", { length: 255 }).notNull(),
  roleId:         varchar("role_id", { length: 255 }).notNull(),
  positionId:     varchar("position_id", { length: 255 }),
  name:           varchar("name", { length: 100 }),
  requiredCount:  integer("required_count").notNull().default(1),
  shiftType:      varchar("shift_type", { length: 10 }),
  specialtyId:    varchar("specialty_id", { length: 255 }),
  defaultSalary:  integer("default_salary"),
  startTime:      varchar("start_time", { length: 5 }),
  endTime:        varchar("end_time", { length: 5 }),
  responsibility: varchar("responsibility", { length: 500 }),
  schedules:      jsonb("schedules"), // Array<{ positionIndex: number, shifts: Array<{ id, start, end }> }>
  isActive:       boolean("is_active").notNull().default(true),
}, (table) => [
  index("staff_req_branch_idx").on(table.branchId),
  index("staff_req_role_idx").on(table.roleId),
  uniqueIndex("staff_req_branch_dept_role_uniq")
    .on(table.branchId, table.departmentId, table.roleId)
    .where(sql`is_active = true`),
]);
```

### 6. `attendance`
Daily attendance logs per staff member.
```ts
export const attendance = pgTable("attendance", {
  pk:           bigserial("pk", { mode: "number" }).primaryKey(),
  id:           varchar("id", { length: 255 }).notNull().unique(), // att_<uuid>
  date:         varchar("date", { length: 10 }).notNull(), // YYYY-MM-DD
  staffId:      varchar("staff_id", { length: 255 }).notNull(),
  branchId:     varchar("branch_id", { length: 255 }).notNull(),
  status:       varchar("status", { length: 20 }).notNull().default("present"), // present | absent | half-day | holiday | unmarked
  shiftsWorked: jsonb("shifts_worked"),
  createdAt:    timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
  updatedAt:    timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
}, (table) => [
  index("attendance_date_idx").on(table.date),
  index("attendance_branch_idx").on(table.branchId),
  index("attendance_staff_idx").on(table.staffId),
  uniqueIndex("attendance_date_staff_uniq").on(table.date, table.staffId),
]);
```

### 7. `payroll`
Monthly payroll calculations and settlement status.
```ts
export const payroll = pgTable("payroll", {
  pk:            bigserial("pk", { mode: "number" }).primaryKey(),
  id:            varchar("id", { length: 255 }).notNull().unique(), // pay_{month}_{year}_{staffId}
  staffId:       varchar("staff_id", { length: 255 }).notNull(),
  branchId:      varchar("branch_id", { length: 255 }),
  name:          varchar("name", { length: 100 }).notNull(),
  month:         integer("month").notNull(), // 1-12
  year:          integer("year").notNull(),
  monthlySalary: integer("monthly_salary").notNull().default(0),
  daysWorked:    integer("days_worked").notNull().default(0),
  advances:      integer("advances").notNull().default(0),
  payableAmount: integer("payable_amount").notNull().default(0),
  status:        varchar("status", { length: 10 }).notNull().default("PENDING"), // PENDING | PAID
  notes:         varchar("notes", { length: 500 }),
  paidAt:        timestamp("paid_at", { withTimezone: true, mode: "date" }),
}, (table) => [
  index("payroll_month_year_idx").on(table.month, table.year),
  index("payroll_month_year_staff_idx").on(table.month, table.year, table.staffId),
  index("payroll_branch_idx").on(table.branchId),
]);
```

### 8. `eod`
Day-End (EOD) entries recording revenue and operational metrics.
```ts
export const eod = pgTable("eod", {
  pk:                 bigserial("pk", { mode: "number" }).primaryKey(),
  id:                 varchar("id", { length: 255 }).notNull().unique(), // eod_<uuid>
  branchId:           varchar("branch_id", { length: 255 }).notNull(),
  date:               varchar("date", { length: 10 }).notNull(), // YYYY-MM-DD
  income:             jsonb("income").notNull(), // { dineInCash, dineInUpi, takeawayCash, takeawayUpi }
  openingFloat:       integer("opening_float"),
  actualClosingFloat: integer("actual_closing_float"),
  notes:              varchar("notes", { length: 2000 }),
  status:             varchar("status", { length: 20 }).notNull().default("submitted"), // submitted | locked
  billing:            jsonb("billing"), // { totalBillAmount, billCount, dineInCovers, voids, discounts, gstCollected }
  ops:                jsonb("ops"), // { staffOnDuty, powerCutHours, unusualEvent, kitchenIssue, zeroRevenueConfirmed }
  createdAt:          timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
  updatedAt:          timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
}, (table) => [
  index("eod_date_idx").on(table.date),
  index("eod_branch_idx").on(table.branchId),
  uniqueIndex("eod_branch_date_uniq").on(table.branchId, table.date),
]);
```

### 9. `expenses`
Shared expense ledger for Day-End and Vendor expenses.
```ts
export const expenses = pgTable("expenses", {
  pk:         bigserial("pk", { mode: "number" }).primaryKey(),
  id:         varchar("id", { length: 255 }).notNull().unique(), // exp_<uuid> | venexp_<uuid>
  branchId:   varchar("branch_id", { length: 255 }).notNull(),
  amount:     integer("amount").notNull(),
  categoryId: varchar("category_id", { length: 255 }).notNull(),
  source:     varchar("source", { length: 20 }).notNull(), // 'eod' | 'vendor'
  date:       varchar("date", { length: 10 }).notNull(),
  notes:      varchar("notes", { length: 500 }),
  isPaid:     boolean("is_paid").default(false),
  createdAt:  timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
}, (table) => [
  index("expenses_date_idx").on(table.date),
  index("expenses_branch_idx").on(table.branchId),
  index("expenses_source_branch_date_idx").on(table.source, table.branchId, table.date),
]);
```

### 10. `categories`
Expense categories.
```ts
export const categories = pgTable("categories", {
  pk:        bigserial("pk", { mode: "number" }).primaryKey(),
  id:        varchar("id", { length: 255 }).notNull().unique(), // cat_<uuid>
  name:      varchar("name", { length: 100 }).notNull(),
  color:     varchar("color", { length: 20 }),
  isActive:  boolean("is_active").notNull().default(true),
  deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
});
```

### 11. `menu_items`
Global catalog menu items.
```ts
export const menuItems = pgTable("menu_items", {
  pk:           bigserial("pk", { mode: "number" }).primaryKey(),
  id:           varchar("id", { length: 255 }).notNull().unique(), // mn_<uuid>
  name:         varchar("name", { length: 150 }).notNull(),
  categoryId:   varchar("category_id", { length: 255 }).notNull(),
  basePrice:    integer("base_price").notNull().default(0),
  sortOrder:    integer("sort_order").notNull().default(0),
  isActive:     boolean("is_active").notNull().default(true),
  description:  varchar("description", { length: 1000 }),
  imageUrl:     varchar("image_url", { length: 500 }),
  costPrice:    integer("cost_price"),
  dietary:      jsonb("dietary"), // { isVeg, isVegan, isJain, isGlutenFree }
  spiceLevel:   integer("spice_level"),
  allergens:    jsonb("allergens"),
  isSignature:  boolean("is_signature"),
  prepTimeMins: integer("prep_time_mins"),
  availability: jsonb("availability"),
  createdAt:    timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
  updatedAt:    timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
  deletedAt:    timestamp("deleted_at", { withTimezone: true, mode: "date" }),
}, (table) => [
  index("menu_items_category_idx").on(table.categoryId),
  index("menu_items_active_idx").on(table.isActive).where(sql`is_active = true`),
]);
```

### 12. `menu_categories`
Global menu categories (and chef specialties).
```ts
export const menuCategories = pgTable("menu_categories", {
  pk:        bigserial("pk", { mode: "number" }).primaryKey(),
  id:        varchar("id", { length: 255 }).notNull().unique(), // mcat_<uuid>
  name:      varchar("name", { length: 100 }).notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive:  boolean("is_active").notNull().default(true),
  deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
});
```

### 13. `branch_menu_items`
Per-branch menu price and availability overrides.
```ts
export const branchMenuItems = pgTable("branch_menu_items", {
  pk:          bigserial("pk", { mode: "number" }).primaryKey(),
  id:          varchar("id", { length: 255 }).notNull().unique(), // bmi_<uuid>
  branchId:    varchar("branch_id", { length: 255 }).notNull(),
  menuItemId:  varchar("menu_item_id", { length: 255 }).notNull(),
  variantId:   varchar("variant_id", { length: 255 }),
  price:       integer("price"), // null = fallback to item basePrice
  isAvailable: boolean("is_available").notNull().default(true),
}, (table) => [
  index("bmi_branch_idx").on(table.branchId),
  index("bmi_menu_item_idx").on(table.menuItemId),
  uniqueIndex("bmi_branch_item_variant_uniq").on(table.branchId, table.menuItemId, table.variantId),
]);
```

### 14. `branch_categories`
Per-branch category availability toggles.
```ts
export const branchCategories = pgTable("branch_categories", {
  pk:          bigserial("pk", { mode: "number" }).primaryKey(),
  id:          varchar("id", { length: 255 }).notNull().unique(), // bcat_<uuid>
  branchId:    varchar("branch_id", { length: 255 }).notNull(),
  categoryId:  varchar("category_id", { length: 255 }).notNull(),
  isAvailable: boolean("is_available").notNull().default(true),
}, (table) => [
  index("branch_cat_branch_idx").on(table.branchId),
]);
```

### 15. `menu_item_variants`
Size and portion variants (e.g. "Full", "Half", "Special").
```ts
export const menuItemVariants = pgTable("menu_item_variants", {
  pk:         bigserial("pk", { mode: "number" }).primaryKey(),
  id:         varchar("id", { length: 255 }).notNull().unique(), // var_<uuid>
  menuItemId: varchar("menu_item_id", { length: 255 }).notNull(),
  name:       varchar("name", { length: 60 }).notNull(),
  basePrice:  integer("base_price").notNull().default(0),
  sortOrder:  integer("sort_order").notNull().default(0),
  isActive:   boolean("is_active").notNull().default(true),
  deletedAt:  timestamp("deleted_at", { withTimezone: true, mode: "date" }),
}, (table) => [
  index("variants_menu_item_idx").on(table.menuItemId),
]);
```

### 16. `menu_price_history`
Audit history of price adjustments across global items and branch overrides.
```ts
export const menuPriceHistory = pgTable("menu_price_history", {
  pk:            bigserial("pk", { mode: "number" }).primaryKey(),
  id:            varchar("id", { length: 255 }).notNull().unique(), // mph_<uuid>
  menuItemId:    varchar("menu_item_id", { length: 255 }).notNull(),
  variantId:     varchar("variant_id", { length: 255 }),
  branchId:      varchar("branch_id", { length: 255 }),
  scope:         varchar("scope", { length: 10 }).notNull(), // 'global' | 'branch'
  oldPrice:      integer("old_price"),
  newPrice:      integer("new_price"),
  changedBy:     varchar("changed_by", { length: 255 }).notNull(),
  changedByName: varchar("changed_by_name", { length: 100 }).notNull(),
  changedAt:     timestamp("changed_at", { withTimezone: true, mode: "date" }).notNull(),
}, (table) => [
  index("price_history_item_idx").on(table.menuItemId),
]);
```

### 17. `inventory`
Per-branch stock items and alert thresholds.
```ts
export const inventory = pgTable("inventory", {
  pk:              bigserial("pk", { mode: "number" }).primaryKey(),
  id:              varchar("id", { length: 255 }).notNull().unique(), // inv_<uuid>
  branchId:        varchar("branch_id", { length: 255 }).notNull(),
  name:            varchar("name", { length: 100 }).notNull(),
  unit:            varchar("unit", { length: 20 }).notNull(),
  currentQuantity: integer("current_quantity").notNull().default(0),
  threshold:       integer("threshold").notNull().default(0),
  updatedAt:       timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
  isActive:        boolean("is_active").notNull().default(true),
  deletedAt:       timestamp("deleted_at", { withTimezone: true, mode: "date" }),
}, (table) => [
  index("inventory_branch_idx").on(table.branchId),
  index("inventory_active_branch_idx").on(table.branchId, table.isActive).where(sql`is_active = true`),
]);
```

### 18. `stock_adjustments`
Log of stock additions and deductions.
```ts
export const stockAdjustments = pgTable("stock_adjustments", {
  pk:       bigserial("pk", { mode: "number" }).primaryKey(),
  id:       varchar("id", { length: 255 }).notNull().unique(), // adj_<uuid>
  itemId:   varchar("item_id", { length: 255 }).notNull(),
  branchId: varchar("branch_id", { length: 255 }).notNull(),
  type:     varchar("type", { length: 10 }).notNull(), // 'increase' | 'decrease'
  amount:   integer("amount").notNull(),
  reason:   varchar("reason", { length: 200 }).notNull(),
  date:     varchar("date", { length: 10 }).notNull(),
}, (table) => [
  index("stock_adj_branch_idx").on(table.branchId),
  index("stock_adj_item_idx").on(table.itemId),
  index("stock_adj_date_idx").on(table.date),
]);
```

### 19. `vendors`
Supplier and vendor profiles.
```ts
export const vendors = pgTable("vendors", {
  pk:         bigserial("pk", { mode: "number" }).primaryKey(),
  id:         varchar("id", { length: 255 }).notNull().unique(), // ven_<uuid>
  branchId:   varchar("branch_id", { length: 255 }).notNull(),
  name:       varchar("name", { length: 100 }).notNull(),
  phone:      varchar("phone", { length: 15 }).notNull(),
  supplyType: varchar("supply_type", { length: 100 }).notNull(),
  isActive:   boolean("is_active").notNull().default(true),
  createdAt:  timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
}, (table) => [
  index("vendors_branch_idx").on(table.branchId),
]);
```

### 20. `pos_tables`
Dining tables configured per branch.
```ts
export const posTables = pgTable("pos_tables", {
  pk:        bigserial("pk", { mode: "number" }).primaryKey(),
  id:        varchar("id", { length: 255 }).notNull().unique(), // ptbl_<uuid>
  branchId:  varchar("branch_id", { length: 255 }).notNull(),
  name:      varchar("name", { length: 50 }).notNull(),
  isActive:  boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
}, (table) => [
  index("pos_tables_branch_idx").on(table.branchId),
  index("pos_tables_active_branch_idx").on(table.branchId, table.isActive).where(sql`is_active = true`),
  uniqueIndex("pos_tables_branch_name_uniq").on(table.branchId, table.name).where(sql`is_active = true`),
]);
```

### 21. `pos_orders`
Point of Sale orders for Dine-in and Takeaway.
```ts
export const posOrders = pgTable("pos_orders", {
  pk:             bigserial("pk", { mode: "number" }).primaryKey(),
  id:             varchar("id", { length: 255 }).notNull().unique(), // pord_<uuid>
  branchId:       varchar("branch_id", { length: 255 }).notNull(),
  tableId:        varchar("table_id", { length: 255 }),
  takeawayNumber: varchar("takeaway_number", { length: 20 }), // 'T-1', 'T-2'...
  orderType:      varchar("order_type", { length: 10 }).notNull(), // 'dine-in' | 'takeaway'
  covers:         integer("covers"),
  status:         varchar("status", { length: 10 }).notNull().default("open"), // 'open' | 'billed' | 'paid' | 'voided'
  items:          jsonb("items").notNull().default(sql`'[]'::jsonb`), // Array<OrderItem>
  note:           varchar("note", { length: 200 }),
  kotCount:       integer("kot_count").notNull().default(0),
  bill:           jsonb("bill"), // BillSnapshot: { subtotal, discount, gst, totalPayable, billedAt, billedBy }
  payment:        jsonb("payment"), // PaymentSnapshot: { method, cashAmount, upiAmount, paidAt, receivedBy }
  void:           jsonb("void"), // VoidInfo: { reason, voidedAt, voidedBy }
  date:           varchar("date", { length: 10 }).notNull(), // YYYY-MM-DD
  openedBy:       varchar("opened_by", { length: 255 }).notNull(),
  createdAt:      timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
  updatedAt:      timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
}, (table) => [
  index("pos_orders_branch_idx").on(table.branchId),
  index("pos_orders_date_idx").on(table.date),
  index("pos_orders_status_idx").on(table.status),
  index("pos_orders_table_idx").on(table.tableId),
  index("pos_orders_branch_date_idx").on(table.branchId, table.date),
  uniqueIndex("pos_orders_open_table_uniq")
    .on(table.tableId)
    .where(sql`status = 'open' AND table_id IS NOT NULL`),
]);
```

### 22. `pos_kots`
Kitchen Order Tickets dispatched to the kitchen.
```ts
export const posKots = pgTable("pos_kots", {
  pk:        bigserial("pk", { mode: "number" }).primaryKey(),
  id:        varchar("id", { length: 255 }).notNull().unique(), // pkot_<uuid>
  orderId:   varchar("order_id", { length: 255 }).notNull(),
  branchId:  varchar("branch_id", { length: 255 }).notNull(),
  kotNumber: integer("kot_number").notNull(),
  items:     jsonb("items").notNull().default(sql`'[]'::jsonb`), // Array<KotItem>
  status:    varchar("status", { length: 20 }).notNull().default("pending"), // 'pending' | 'preparing' | 'ready' | 'served'
  firedBy:   varchar("fired_by", { length: 255 }).notNull(),
  firedAt:   timestamp("fired_at", { withTimezone: true, mode: "date" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
}, (table) => [
  index("pos_kots_order_idx").on(table.orderId),
  index("pos_kots_branch_idx").on(table.branchId),
  index("pos_kots_status_idx").on(table.status),
]);
```

### 23. `config`
System configuration and module feature toggles (single row `id = 'global'`).
```ts
export const config = pgTable("config", {
  pk:                   bigserial("pk", { mode: "number" }).primaryKey(),
  id:                   varchar("id", { length: 50 }).notNull().unique().default("global"),
  attendance:           boolean("attendance").notNull().default(false),
  payroll:              boolean("payroll").notNull().default(false),
  vendors:              boolean("vendors").notNull().default(false),
  inventory:            boolean("inventory").notNull().default(false),
  menu:                 boolean("menu").notNull().default(true),
  reports:              boolean("reports").notNull().default(false),
  pos:                  boolean("pos").notNull().default(true),
  posDefaultGstPercent: integer("pos_default_gst_percent").notNull().default(5),
});
```

### 24. `users`
Portal users and authentication credentials.
```ts
export const users = pgTable("users", {
  pk:        bigserial("pk", { mode: "number" }).primaryKey(),
  id:        varchar("id", { length: 255 }).notNull().unique(), // u_<uuid>
  name:      varchar("name", { length: 100 }).notNull(), // unique login name
  password:  varchar("password", { length: 255 }), // bcrypt hash
  role:      varchar("role", { length: 20 }).notNull(), // 'admin' | 'owner' | 'manager' | 'readonly' | 'billing' | 'kitchen' | 'waiter'
  branchId:  varchar("branch_id", { length: 255 }),
  isActive:  boolean("is_active").notNull().default(true),
  deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
});
```

### 25. `audit_logs`
Sensitive actions audit trail.
```ts
export const auditLogs = pgTable("audit_logs", {
  pk:         bigserial("pk", { mode: "number" }).primaryKey(),
  id:         varchar("id", { length: 255 }).notNull().unique(), // uuid
  timestamp:  timestamp("timestamp", { withTimezone: true, mode: "date" }).notNull(),
  userId:     varchar("user_id", { length: 255 }).notNull(),
  userName:   varchar("user_name", { length: 100 }).notNull(),
  action:     varchar("action", { length: 100 }).notNull(),
  entityType: varchar("entity_type", { length: 100 }).notNull(),
  entityId:   varchar("entity_id", { length: 255 }),
  details:    text("details").notNull(),
}, (table) => [
  index("audit_logs_timestamp_idx").on(table.timestamp),
]);
```

### 26. `advances`
Staff advance records.
```ts
export const advances = pgTable("advances", {
  pk:        bigserial("pk", { mode: "number" }).primaryKey(),
  id:        varchar("id", { length: 255 }).notNull().unique(), // adv_<uuid>
  staffId:   varchar("staff_id", { length: 255 }).notNull(),
  branchId:  varchar("branch_id", { length: 255 }).notNull(),
  amount:    integer("amount").notNull(),
  date:      varchar("date", { length: 10 }).notNull(),
  notes:     varchar("notes", { length: 500 }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
});
```

### 27. `daily_tally`
Daily operational cash tally.
```ts
export const dailyTally = pgTable("daily_tally", {
  pk:        bigserial("pk", { mode: "number" }).primaryKey(),
  id:        varchar("id", { length: 255 }).notNull().unique(), // dt_<uuid>
  branchId:  varchar("branch_id", { length: 255 }).notNull(),
  date:      varchar("date", { length: 10 }).notNull(),
  data:      jsonb("data"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
});
```

---

## Utility table

### `rate_limit`
Sliding window rate-limiter for brute-force login prevention.
```ts
export const rateLimitTable = pgTable("rate_limit", {
  key:          varchar("key", { length: 255 }).primaryKey(), // "login:ip:<ip>" or "login:user:<name>"
  attempts:     integer("attempts").notNull().default(0),
  windowStart:  bigint("window_start", { mode: "number" }).notNull(),
  blockedUntil: bigint("blocked_until", { mode: "number" }).notNull().default(0),
});
```

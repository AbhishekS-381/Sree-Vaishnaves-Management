import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  bigint,
  bigserial,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const timestamptz = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

// ── Legacy Tables (retained during migration) ─────────────────────────

export const jsonStore = pgTable("json_store", {
  filename: varchar("filename", { length: 255 }).primaryKey(),
  data: text("data").notNull(),
});

export const rateLimitTable = pgTable("rate_limit", {
  key:          varchar("key",          { length: 255 }).primaryKey(),
  attempts:     integer("attempts")     .notNull().default(0),
  windowStart:  bigint("window_start",  { mode: "number" }).notNull(),
  blockedUntil: bigint("blocked_until", { mode: "number" }).notNull().default(0),
});

// ── 1. branches ───────────────────────────────────────────────────────

export const branches = pgTable("branches", {
  pk:                bigserial("pk", { mode: "number" }).primaryKey(),
  id:                uuid("id").notNull().unique().defaultRandom(),
  name:              varchar("name", { length: 100 }).notNull(),
  address:           varchar("address", { length: 200 }),
  phone:             varchar("phone", { length: 50 }),
  status:            varchar("status", { length: 20 }).notNull().default("operational"),
  internalStartTime: varchar("internal_start_time", { length: 5 }),
  internalEndTime:   varchar("internal_end_time", { length: 5 }),
  customerStartTime: varchar("customer_start_time", { length: 5 }),
  customerEndTime:   varchar("customer_end_time", { length: 5 }),
  gstin:             varchar("gstin", { length: 20 }),
  isActive:          boolean("is_active").notNull().default(true),
  deletedAt:         timestamptz("deleted_at"),
}, (table) => [
  index("branches_name_idx").on(table.name),
]);

export const branchesNameIdx = index("branches_name_idx").on(branches.name);

// ── 2. departments ────────────────────────────────────────────────────

export const departments = pgTable("departments", {
  pk:        bigserial("pk", { mode: "number" }).primaryKey(),
  id:        uuid("id").notNull().unique().defaultRandom(),
  name:      varchar("name", { length: 100 }).notNull(),
  isActive:  boolean("is_active").notNull().default(true),
  deletedAt: timestamptz("deleted_at"),
});

// ── 3. roles ──────────────────────────────────────────────────────────

export const roles = pgTable("roles", {
  pk:            bigserial("pk", { mode: "number" }).primaryKey(),
  id:            uuid("id").notNull().unique().defaultRandom(),
  name:          varchar("name", { length: 100 }).notNull(),
  isChef:        boolean("is_chef").default(false),
  departmentIds: jsonb("department_ids"),
  isActive:      boolean("is_active").notNull().default(true),
  deletedAt:     timestamptz("deleted_at"),
});

// ── 4. staff ──────────────────────────────────────────────────────────

export const staff = pgTable("staff", {
  pk:            bigserial("pk", { mode: "number" }).primaryKey(),
  id:            uuid("id").notNull().unique().defaultRandom(),
  name:          varchar("name", { length: 100 }).notNull(),
  branchId:      uuid("branch_id").notNull(),
  departmentId:  uuid("department_id").notNull(),
  roleId:        uuid("role_id").notNull(),
  phone:         varchar("phone", { length: 15 }).notNull(),
  label:         varchar("label", { length: 50 }),
  monthlySalary: integer("monthly_salary").default(0),
  isActive:      boolean("is_active").notNull().default(true),
  joinedAt:      varchar("joined_at", { length: 10 }),
  exitDate:      varchar("exit_date", { length: 10 }),
  shiftType:     varchar("shift_type", { length: 10 }),
  specialtyId:   uuid("specialty_id"),
  positionId:    uuid("position_id"),
  positionIndex: integer("position_index"),
  startTime:     varchar("start_time", { length: 5 }),
  endTime:       varchar("end_time", { length: 5 }),
  deletedAt:     timestamptz("deleted_at"),
}, (table) => [
  index("staff_branch_idx").on(table.branchId),
  index("staff_role_idx").on(table.roleId),
  index("staff_position_idx").on(table.positionId),
  index("staff_active_branch_idx")
    .on(table.branchId, table.isActive)
    .where(sql`is_active = true`),
]);

export const staffBranchIdx = index("staff_branch_idx").on(staff.branchId);
export const staffRoleIdx = index("staff_role_idx").on(staff.roleId);
export const staffPositionIdx = index("staff_position_idx").on(staff.positionId);
export const staffActiveBranchIdx = index("staff_active_branch_idx")
  .on(staff.branchId, staff.isActive)
  .where(sql`is_active = true`);

// ── 5. staff_requirements ─────────────────────────────────────────────

export const staffRequirements = pgTable("staff_requirements", {
  pk:             bigserial("pk", { mode: "number" }).primaryKey(),
  id:             uuid("id").notNull().unique().defaultRandom(),
  branchId:       uuid("branch_id").notNull(),
  departmentId:   uuid("department_id").notNull(),
  roleId:         uuid("role_id").notNull(),
  positionId:     uuid("position_id"),
  name:           varchar("name", { length: 100 }),
  requiredCount:  integer("required_count").notNull().default(1),
  shiftType:      varchar("shift_type", { length: 10 }),
  specialtyId:    uuid("specialty_id"),
  defaultSalary:  integer("default_salary"),
  startTime:      varchar("start_time", { length: 5 }),
  endTime:        varchar("end_time", { length: 5 }),
  responsibility: varchar("responsibility", { length: 500 }),
  schedules:      jsonb("schedules"),
  isActive:       boolean("is_active").notNull().default(true),
}, (table) => [
  index("staff_req_branch_idx").on(table.branchId),
  index("staff_req_role_idx").on(table.roleId),
  uniqueIndex("staff_req_branch_dept_role_uniq")
    .on(table.branchId, table.departmentId, table.roleId)
    .where(sql`is_active = true`),
]);

export const staffReqBranchIdx = index("staff_req_branch_idx").on(staffRequirements.branchId);
export const staffReqRoleIdx = index("staff_req_role_idx").on(staffRequirements.roleId);
export const staffReqUniq = uniqueIndex("staff_req_branch_dept_role_uniq")
  .on(staffRequirements.branchId, staffRequirements.departmentId, staffRequirements.roleId)
  .where(sql`is_active = true`);

// ── 6. attendance ─────────────────────────────────────────────────────

export const attendance = pgTable("attendance", {
  pk:           bigserial("pk", { mode: "number" }).primaryKey(),
  id:           uuid("id").notNull().unique().defaultRandom(),
  date:         varchar("date", { length: 10 }).notNull(),
  staffId:      uuid("staff_id").notNull(),
  branchId:     uuid("branch_id").notNull(),
  status:       varchar("status", { length: 20 }).notNull().default("present"),
  shiftsWorked: jsonb("shifts_worked"),
  createdAt:    timestamptz("created_at").notNull(),
  updatedAt:    timestamptz("updated_at").notNull(),
}, (table) => [
  index("attendance_date_idx").on(table.date),
  index("attendance_branch_idx").on(table.branchId),
  index("attendance_staff_idx").on(table.staffId),
  uniqueIndex("attendance_date_staff_uniq").on(table.date, table.staffId),
]);

export const attendanceDateIdx = index("attendance_date_idx").on(attendance.date);
export const attendanceBranchIdx = index("attendance_branch_idx").on(attendance.branchId);
export const attendanceStaffIdx = index("attendance_staff_idx").on(attendance.staffId);
export const attendanceDateStaffUniq = uniqueIndex("attendance_date_staff_uniq").on(attendance.date, attendance.staffId);

// ── 7. payroll ────────────────────────────────────────────────────────

export const payroll = pgTable("payroll", {
  pk:            bigserial("pk", { mode: "number" }).primaryKey(),
  id:            uuid("id").notNull().unique().defaultRandom(),
  staffId:       uuid("staff_id").notNull(),
  branchId:      uuid("branch_id"),
  name:          varchar("name", { length: 100 }).notNull(),
  month:         integer("month").notNull(),
  year:          integer("year").notNull(),
  monthlySalary: integer("monthly_salary").notNull().default(0),
  daysWorked:    integer("days_worked").notNull().default(0),
  advances:      integer("advances").notNull().default(0),
  payableAmount: integer("payable_amount").notNull().default(0),
  status:        varchar("status", { length: 10 }).notNull().default("PENDING"),
  notes:         varchar("notes", { length: 500 }),
  paidAt:        timestamptz("paid_at"),
}, (table) => [
  index("payroll_month_year_idx").on(table.month, table.year),
  index("payroll_month_year_staff_idx").on(table.month, table.year, table.staffId),
  index("payroll_branch_idx").on(table.branchId),
]);

export const payrollMonthYearIdx = index("payroll_month_year_idx").on(payroll.month, payroll.year);
export const payrollMonthYearStaffIdx = index("payroll_month_year_staff_idx").on(payroll.month, payroll.year, payroll.staffId);
export const payrollBranchIdx = index("payroll_branch_idx").on(payroll.branchId);

// ── 8. eod ────────────────────────────────────────────────────────────

export const eod = pgTable("eod", {
  pk:                 bigserial("pk", { mode: "number" }).primaryKey(),
  id:                 uuid("id").notNull().unique().defaultRandom(),
  branchId:           uuid("branch_id").notNull(),
  date:               varchar("date", { length: 10 }).notNull(),
  income:             jsonb("income").notNull(),
  openingFloat:       integer("opening_float"),
  actualClosingFloat: integer("actual_closing_float"),
  notes:              varchar("notes", { length: 2000 }),
  status:             varchar("status", { length: 20 }).notNull().default("submitted"),
  billing:            jsonb("billing"),
  ops:                jsonb("ops"),
  createdAt:          timestamptz("created_at").notNull(),
  updatedAt:          timestamptz("updated_at").notNull(),
}, (table) => [
  index("eod_date_idx").on(table.date),
  index("eod_branch_idx").on(table.branchId),
  uniqueIndex("eod_branch_date_uniq").on(table.branchId, table.date),
]);

export const eodDateIdx = index("eod_date_idx").on(eod.date);
export const eodBranchIdx = index("eod_branch_idx").on(eod.branchId);
export const eodBranchDateUniq = uniqueIndex("eod_branch_date_uniq").on(eod.branchId, eod.date);

// ── 9. expenses ───────────────────────────────────────────────────────

export const expenses = pgTable("expenses", {
  pk:         bigserial("pk", { mode: "number" }).primaryKey(),
  id:         uuid("id").notNull().unique().defaultRandom(),
  branchId:   uuid("branch_id").notNull(),
  amount:     integer("amount").notNull(),
  categoryId: uuid("category_id").notNull(),
  source:     varchar("source", { length: 20 }).notNull(),
  date:       varchar("date", { length: 10 }).notNull(),
  notes:      varchar("notes", { length: 500 }),
  isPaid:     boolean("is_paid").default(false),
  createdAt:  timestamptz("created_at").notNull(),
}, (table) => [
  index("expenses_date_idx").on(table.date),
  index("expenses_branch_idx").on(table.branchId),
  index("expenses_source_branch_date_idx").on(table.source, table.branchId, table.date),
]);

export const expensesDateIdx = index("expenses_date_idx").on(expenses.date);
export const expensesBranchIdx = index("expenses_branch_idx").on(expenses.branchId);
export const expensesSourceIdx = index("expenses_source_branch_date_idx").on(expenses.source, expenses.branchId, expenses.date);

// ── 10. categories ────────────────────────────────────────────────────

export const categories = pgTable("categories", {
  pk:        bigserial("pk", { mode: "number" }).primaryKey(),
  id:        uuid("id").notNull().unique().defaultRandom(),
  name:      varchar("name", { length: 100 }).notNull(),
  color:     varchar("color", { length: 20 }),
  isActive:  boolean("is_active").notNull().default(true),
  deletedAt: timestamptz("deleted_at"),
});

// ── 11. menu_items ────────────────────────────────────────────────────

export const menuItems = pgTable("menu_items", {
  pk:           bigserial("pk", { mode: "number" }).primaryKey(),
  id:           uuid("id").notNull().unique().defaultRandom(),
  name:         varchar("name", { length: 150 }).notNull(),
  categoryId:   uuid("category_id").notNull(),
  basePrice:    integer("base_price").notNull().default(0),
  acPrice:      integer("ac_price"),
  parcelPrice:  integer("parcel_price"),
  sortOrder:    bigint("sort_order", { mode: "number" }).notNull().default(0),
  isActive:     boolean("is_active").notNull().default(true),
  description:  varchar("description", { length: 1000 }),
  imageUrl:     varchar("image_url", { length: 500 }),
  costPrice:    integer("cost_price"),
  dietary:      jsonb("dietary"),
  spiceLevel:   integer("spice_level"),
  allergens:    jsonb("allergens"),
  isSignature:  boolean("is_signature"),
  prepTimeMins: integer("prep_time_mins"),
  availability: jsonb("availability"),
  createdAt:    timestamptz("created_at").notNull(),
  updatedAt:    timestamptz("updated_at").notNull(),
  deletedAt:    timestamptz("deleted_at"),
}, (table) => [
  index("menu_items_category_idx").on(table.categoryId),
  index("menu_items_active_idx")
    .on(table.isActive)
    .where(sql`is_active = true`),
]);

export const menuItemsCategoryIdx = index("menu_items_category_idx").on(menuItems.categoryId);
export const menuItemsActiveIdx = index("menu_items_active_idx")
  .on(menuItems.isActive)
  .where(sql`is_active = true`);

// ── 12. menu_categories ───────────────────────────────────────────────

export const menuCategories = pgTable("menu_categories", {
  pk:        bigserial("pk", { mode: "number" }).primaryKey(),
  id:        uuid("id").notNull().unique().defaultRandom(),
  name:      varchar("name", { length: 100 }).notNull(),
  sortOrder: bigint("sort_order", { mode: "number" }).notNull().default(0),
  isActive:  boolean("is_active").notNull().default(true),
  deletedAt: timestamptz("deleted_at"),
});

// ── 13. branch_menu_items ─────────────────────────────────────────────

export const branchMenuItems = pgTable("branch_menu_items", {
  pk:          bigserial("pk", { mode: "number" }).primaryKey(),
  id:          uuid("id").notNull().unique().defaultRandom(),
  branchId:    uuid("branch_id").notNull(),
  menuItemId:  uuid("menu_item_id").notNull(),
  variantId:   uuid("variant_id"),
  price:       integer("price"),
  isAvailable: boolean("is_available").notNull().default(true),
}, (table) => [
  index("bmi_branch_idx").on(table.branchId),
  index("bmi_menu_item_idx").on(table.menuItemId),
  uniqueIndex("bmi_branch_item_variant_uniq").on(table.branchId, table.menuItemId, table.variantId),
]);

export const branchMenuItemsBranchIdx = index("bmi_branch_idx").on(branchMenuItems.branchId);
export const branchMenuItemsItemIdx = index("bmi_menu_item_idx").on(branchMenuItems.menuItemId);
export const branchMenuItemsUniq = uniqueIndex("bmi_branch_item_variant_uniq")
  .on(branchMenuItems.branchId, branchMenuItems.menuItemId, branchMenuItems.variantId);

// ── 14. branch_categories ─────────────────────────────────────────────

export const branchCategories = pgTable("branch_categories", {
  pk:          bigserial("pk", { mode: "number" }).primaryKey(),
  id:          uuid("id").notNull().unique().defaultRandom(),
  branchId:    uuid("branch_id").notNull(),
  categoryId:  uuid("category_id").notNull(),
  isAvailable: boolean("is_available").notNull().default(true),
}, (table) => [
  index("branch_cat_branch_idx").on(table.branchId),
]);

export const branchCategoriesBranchIdx = index("branch_cat_branch_idx").on(branchCategories.branchId);

// ── 15. menu_item_variants ────────────────────────────────────────────

export const menuItemVariants = pgTable("menu_item_variants", {
  pk:         bigserial("pk", { mode: "number" }).primaryKey(),
  id:         uuid("id").notNull().unique().defaultRandom(),
  menuItemId: uuid("menu_item_id").notNull(),
  name:       varchar("name", { length: 60 }).notNull(),
  basePrice:  integer("base_price").notNull().default(0),
  sortOrder:  bigint("sort_order", { mode: "number" }).notNull().default(0),
  isActive:   boolean("is_active").notNull().default(true),
  deletedAt:  timestamptz("deleted_at"),
}, (table) => [
  index("variants_menu_item_idx").on(table.menuItemId),
]);

export const menuItemVariantsItemIdx = index("variants_menu_item_idx").on(menuItemVariants.menuItemId);

// ── 16. menu_price_history ────────────────────────────────────────────

export const menuPriceHistory = pgTable("menu_price_history", {
  pk:            bigserial("pk", { mode: "number" }).primaryKey(),
  id:            uuid("id").notNull().unique().defaultRandom(),
  menuItemId:    uuid("menu_item_id").notNull(),
  variantId:     uuid("variant_id"),
  branchId:      uuid("branch_id"),
  scope:         varchar("scope", { length: 10 }).notNull(),
  oldPrice:      integer("old_price"),
  newPrice:      integer("new_price"),
  changedBy:     varchar("changed_by", { length: 255 }).notNull(),
  changedByName: varchar("changed_by_name", { length: 100 }).notNull(),
  changedAt:     timestamptz("changed_at").notNull(),
}, (table) => [
  index("price_history_item_idx").on(table.menuItemId),
]);

export const priceHistoryItemIdx = index("price_history_item_idx").on(menuPriceHistory.menuItemId);

// ── 17. inventory ─────────────────────────────────────────────────────

export const inventory = pgTable("inventory", {
  pk:              bigserial("pk", { mode: "number" }).primaryKey(),
  id:              uuid("id").notNull().unique().defaultRandom(),
  branchId:        uuid("branch_id").notNull(),
  name:            varchar("name", { length: 100 }).notNull(),
  unit:            varchar("unit", { length: 20 }).notNull(),
  currentQuantity: integer("current_quantity").notNull().default(0),
  threshold:       integer("threshold").notNull().default(0),
  updatedAt:       timestamptz("updated_at").notNull(),
  isActive:        boolean("is_active").notNull().default(true),
  deletedAt:       timestamptz("deleted_at"),
}, (table) => [
  index("inventory_branch_idx").on(table.branchId),
  index("inventory_active_branch_idx")
    .on(table.branchId, table.isActive)
    .where(sql`is_active = true`),
]);

export const inventoryBranchIdx = index("inventory_branch_idx").on(inventory.branchId);
export const inventoryActiveIdx = index("inventory_active_branch_idx")
  .on(inventory.branchId, inventory.isActive)
  .where(sql`is_active = true`);

// ── 18. stock_adjustments ─────────────────────────────────────────────

export const stockAdjustments = pgTable("stock_adjustments", {
  pk:       bigserial("pk", { mode: "number" }).primaryKey(),
  id:       uuid("id").notNull().unique().defaultRandom(),
  itemId:   uuid("item_id").notNull(),
  branchId: uuid("branch_id").notNull(),
  type:     varchar("type", { length: 10 }).notNull(),
  amount:   integer("amount").notNull(),
  reason:   varchar("reason", { length: 200 }).notNull(),
  date:     varchar("date", { length: 10 }).notNull(),
}, (table) => [
  index("stock_adj_branch_idx").on(table.branchId),
  index("stock_adj_item_idx").on(table.itemId),
  index("stock_adj_date_idx").on(table.date),
]);

export const stockAdjBranchIdx = index("stock_adj_branch_idx").on(stockAdjustments.branchId);
export const stockAdjItemIdx = index("stock_adj_item_idx").on(stockAdjustments.itemId);
export const stockAdjDateIdx = index("stock_adj_date_idx").on(stockAdjustments.date);

// ── 19. vendors ───────────────────────────────────────────────────────

export const vendors = pgTable("vendors", {
  pk:         bigserial("pk", { mode: "number" }).primaryKey(),
  id:         uuid("id").notNull().unique().defaultRandom(),
  branchId:   uuid("branch_id").notNull(),
  name:       varchar("name", { length: 100 }).notNull(),
  phone:      varchar("phone", { length: 15 }).notNull(),
  supplyType: varchar("supply_type", { length: 100 }).notNull(),
  isActive:   boolean("is_active").notNull().default(true),
  createdAt:  timestamptz("created_at").notNull(),
}, (table) => [
  index("vendors_branch_idx").on(table.branchId),
]);

export const vendorsBranchIdx = index("vendors_branch_idx").on(vendors.branchId);

// ── 20. pos_tables ────────────────────────────────────────────────────

export const posTables = pgTable("pos_tables", {
  pk:        bigserial("pk", { mode: "number" }).primaryKey(),
  id:        uuid("id").notNull().unique().defaultRandom(),
  branchId:  uuid("branch_id").notNull(),
  name:      varchar("name", { length: 50 }).notNull(),
  isAc:      boolean("is_ac").notNull().default(false),
  isActive:  boolean("is_active").notNull().default(true),
  createdAt: timestamptz("created_at").notNull(),
  updatedAt: timestamptz("updated_at").notNull(),
  deletedAt: timestamptz("deleted_at"),
}, (table) => [
  index("pos_tables_branch_idx").on(table.branchId),
  index("pos_tables_active_branch_idx")
    .on(table.branchId, table.isActive)
    .where(sql`is_active = true`),
  uniqueIndex("pos_tables_branch_name_uniq")
    .on(table.branchId, table.name)
    .where(sql`is_active = true`),
]);

export const posTablesBranchIdx = index("pos_tables_branch_idx").on(posTables.branchId);
export const posTablesActiveIdx = index("pos_tables_active_branch_idx")
  .on(posTables.branchId, posTables.isActive)
  .where(sql`is_active = true`);
export const posTablesBranchNameUniq = uniqueIndex("pos_tables_branch_name_uniq")
  .on(posTables.branchId, posTables.name)
  .where(sql`is_active = true`);

// ── 21. pos_orders ────────────────────────────────────────────────────

export const posOrders = pgTable("pos_orders", {
  pk:             bigserial("pk", { mode: "number" }).primaryKey(),
  id:             uuid("id").notNull().unique().defaultRandom(),
  branchId:       uuid("branch_id").notNull(),
  tableId:        uuid("table_id"),
  takeawayNumber: varchar("takeaway_number", { length: 20 }),
  orderType:      varchar("order_type", { length: 10 }).notNull(),
  covers:         integer("covers"),
  status:         varchar("status", { length: 10 }).notNull().default("open"),
  items:          jsonb("items").notNull().default(sql`'[]'::jsonb`),
  note:           varchar("note", { length: 200 }),
  kotCount:       integer("kot_count").notNull().default(0),
  bill:           jsonb("bill"),
  payment:        jsonb("payment"),
  void:           jsonb("void"),
  date:           varchar("date", { length: 10 }).notNull(),
  openedBy:       varchar("opened_by", { length: 255 }).notNull(),
  createdAt:      timestamptz("created_at").notNull(),
  updatedAt:      timestamptz("updated_at").notNull(),
}, (table) => [
  index("pos_orders_branch_idx").on(table.branchId),
  index("pos_orders_date_idx").on(table.date),
  index("pos_orders_status_idx").on(table.status),
  index("pos_orders_table_idx").on(table.tableId),
  index("pos_orders_branch_date_idx").on(table.branchId, table.date),
  uniqueIndex("pos_orders_open_table_uniq")
    .on(table.tableId)
    .where(sql`status = 'open' AND table_id IS NOT NULL`),
  index("pos_orders_open_by_table_idx")
    .on(table.tableId, table.status)
    .where(sql`status = 'open' AND table_id IS NOT NULL`),
]);

export const posOrdersBranchIdx = index("pos_orders_branch_idx").on(posOrders.branchId);
export const posOrdersDateIdx = index("pos_orders_date_idx").on(posOrders.date);
export const posOrdersStatusIdx = index("pos_orders_status_idx").on(posOrders.status);
export const posOrdersTableIdx = index("pos_orders_table_idx").on(posOrders.tableId);
export const posOrdersBranchDateIdx = index("pos_orders_branch_date_idx").on(posOrders.branchId, posOrders.date);
export const posOrdersOpenTableUniq = uniqueIndex("pos_orders_open_table_uniq")
  .on(posOrders.tableId)
  .where(sql`status = 'open' AND table_id IS NOT NULL`);
export const posOrdersOpenByTableIdx = index("pos_orders_open_by_table_idx")
  .on(posOrders.tableId, posOrders.status)
  .where(sql`status = 'open' AND table_id IS NOT NULL`);

// ── 22. pos_kots ──────────────────────────────────────────────────────

export const posKots = pgTable("pos_kots", {
  pk:        bigserial("pk", { mode: "number" }).primaryKey(),
  id:        uuid("id").notNull().unique().defaultRandom(),
  orderId:   uuid("order_id").notNull(),
  branchId:  uuid("branch_id").notNull(),
  kotNumber: integer("kot_number").notNull(),
  items:     jsonb("items").notNull().default(sql`'[]'::jsonb`),
  status:    varchar("status", { length: 20 }).notNull().default("pending"),
  firedBy:   varchar("fired_by", { length: 255 }).notNull(),
  firedAt:   timestamptz("fired_at").notNull(),
  updatedAt: timestamptz("updated_at").notNull(),
}, (table) => [
  index("pos_kots_order_idx").on(table.orderId),
  index("pos_kots_branch_idx").on(table.branchId),
  index("pos_kots_status_idx").on(table.status),
]);

export const posKotsOrderIdx = index("pos_kots_order_idx").on(posKots.orderId);
export const posKotsBranchIdx = index("pos_kots_branch_idx").on(posKots.branchId);
export const posKotsStatusIdx = index("pos_kots_status_idx").on(posKots.status);

// ── 23. config ────────────────────────────────────────────────────────

export const config = pgTable("config", {
  pk:                      bigserial("pk", { mode: "number" }).primaryKey(),
  id:                      uuid("id").notNull().unique().default("00000000-0000-0000-0000-000000000001"),
  attendance:              boolean("attendance").notNull().default(false),
  payroll:                 boolean("payroll").notNull().default(false),
  vendors:                 boolean("vendors").notNull().default(false),
  inventory:               boolean("inventory").notNull().default(false),
  menu:                    boolean("menu").notNull().default(true),
  reports:                 boolean("reports").notNull().default(false),
  pos:                     boolean("pos").notNull().default(true),
  posDefaultGstPercent:    integer("pos_default_gst_percent").notNull().default(5),
  posDefaultParcelPercent: integer("pos_default_parcel_percent").notNull().default(0),
  posDefaultAcPercent:     integer("pos_default_ac_percent").notNull().default(0),
  posPricingMode:          varchar("pos_pricing_mode", { length: 20 }).notNull().default("percentage"),
});

// ── 24. users ─────────────────────────────────────────────────────────

export const users = pgTable("users", {
  pk:        bigserial("pk", { mode: "number" }).primaryKey(),
  id:        uuid("id").notNull().unique().defaultRandom(),
  name:      varchar("name", { length: 100 }).notNull(),
  password:  varchar("password", { length: 255 }),
  role:      varchar("role", { length: 20 }).notNull(),
  branchId:  uuid("branch_id"),
  isActive:  boolean("is_active").notNull().default(true),
  deletedAt: timestamptz("deleted_at"),
});

// ── 25. audit_logs ────────────────────────────────────────────────────

export const auditLogs = pgTable("audit_logs", {
  pk:         bigserial("pk", { mode: "number" }).primaryKey(),
  id:         uuid("id").notNull().unique().defaultRandom(),
  timestamp:  timestamptz("timestamp").notNull(),
  userId:     varchar("user_id", { length: 255 }).notNull(),
  userName:   varchar("user_name", { length: 100 }).notNull(),
  action:     varchar("action", { length: 100 }).notNull(),
  entityType: varchar("entity_type", { length: 100 }).notNull(),
  entityId:   varchar("entity_id", { length: 255 }),
  details:    text("details").notNull(),
}, (table) => [
  index("audit_logs_timestamp_idx").on(table.timestamp),
]);

export const auditLogsTimestampIdx = index("audit_logs_timestamp_idx").on(auditLogs.timestamp);

// ── 26. advances ──────────────────────────────────────────────────────

export const advances = pgTable("advances", {
  pk:        bigserial("pk", { mode: "number" }).primaryKey(),
  id:        uuid("id").notNull().unique().defaultRandom(),
  staffId:   uuid("staff_id").notNull(),
  branchId:  uuid("branch_id").notNull(),
  amount:    integer("amount").notNull(),
  date:      varchar("date", { length: 10 }).notNull(),
  notes:     varchar("notes", { length: 500 }),
  createdAt: timestamptz("created_at").notNull(),
});

// ── 27. daily_tally ───────────────────────────────────────────────────

export const dailyTally = pgTable("daily_tally", {
  pk:        bigserial("pk", { mode: "number" }).primaryKey(),
  id:        uuid("id").notNull().unique().defaultRandom(),
  branchId:  uuid("branch_id").notNull(),
  date:      varchar("date", { length: 10 }).notNull(),
  data:      jsonb("data"),
  createdAt: timestamptz("created_at").notNull(),
});

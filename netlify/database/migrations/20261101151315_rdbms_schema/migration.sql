CREATE TABLE "advances" (
	"pk" bigserial PRIMARY KEY,
	"id" varchar(255) NOT NULL UNIQUE,
	"staff_id" varchar(255) NOT NULL,
	"branch_id" varchar(255) NOT NULL,
	"amount" integer NOT NULL,
	"date" varchar(10) NOT NULL,
	"notes" varchar(500),
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendance" (
	"pk" bigserial PRIMARY KEY,
	"id" varchar(255) NOT NULL UNIQUE,
	"date" varchar(10) NOT NULL,
	"staff_id" varchar(255) NOT NULL,
	"branch_id" varchar(255) NOT NULL,
	"status" varchar(20) DEFAULT 'present' NOT NULL,
	"shifts_worked" jsonb,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"pk" bigserial PRIMARY KEY,
	"id" varchar(255) NOT NULL UNIQUE,
	"timestamp" timestamp with time zone NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"user_name" varchar(100) NOT NULL,
	"action" varchar(100) NOT NULL,
	"entity_type" varchar(100) NOT NULL,
	"entity_id" varchar(255),
	"details" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "branch_categories" (
	"pk" bigserial PRIMARY KEY,
	"id" varchar(255) NOT NULL UNIQUE,
	"branch_id" varchar(255) NOT NULL,
	"category_id" varchar(255) NOT NULL,
	"is_available" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "branch_menu_items" (
	"pk" bigserial PRIMARY KEY,
	"id" varchar(255) NOT NULL UNIQUE,
	"branch_id" varchar(255) NOT NULL,
	"menu_item_id" varchar(255) NOT NULL,
	"variant_id" varchar(255),
	"price" integer,
	"is_available" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "branches" (
	"pk" bigserial PRIMARY KEY,
	"id" varchar(255) NOT NULL UNIQUE,
	"name" varchar(100) NOT NULL,
	"address" varchar(200),
	"phone" varchar(50),
	"status" varchar(20) DEFAULT 'operational' NOT NULL,
	"internal_start_time" varchar(5),
	"internal_end_time" varchar(5),
	"customer_start_time" varchar(5),
	"customer_end_time" varchar(5),
	"is_active" boolean DEFAULT true NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"pk" bigserial PRIMARY KEY,
	"id" varchar(255) NOT NULL UNIQUE,
	"name" varchar(100) NOT NULL,
	"color" varchar(20),
	"is_active" boolean DEFAULT true NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "config" (
	"pk" bigserial PRIMARY KEY,
	"id" varchar(50) DEFAULT 'global' NOT NULL UNIQUE,
	"attendance" boolean DEFAULT false NOT NULL,
	"payroll" boolean DEFAULT false NOT NULL,
	"vendors" boolean DEFAULT false NOT NULL,
	"inventory" boolean DEFAULT false NOT NULL,
	"menu" boolean DEFAULT true NOT NULL,
	"reports" boolean DEFAULT false NOT NULL,
	"pos" boolean DEFAULT true NOT NULL,
	"pos_default_gst_percent" integer DEFAULT 5 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_tally" (
	"pk" bigserial PRIMARY KEY,
	"id" varchar(255) NOT NULL UNIQUE,
	"branch_id" varchar(255) NOT NULL,
	"date" varchar(10) NOT NULL,
	"data" jsonb,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"pk" bigserial PRIMARY KEY,
	"id" varchar(255) NOT NULL UNIQUE,
	"name" varchar(100) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "eod" (
	"pk" bigserial PRIMARY KEY,
	"id" varchar(255) NOT NULL UNIQUE,
	"branch_id" varchar(255) NOT NULL,
	"date" varchar(10) NOT NULL,
	"income" jsonb NOT NULL,
	"opening_float" integer,
	"actual_closing_float" integer,
	"notes" varchar(2000),
	"status" varchar(20) DEFAULT 'submitted' NOT NULL,
	"billing" jsonb,
	"ops" jsonb,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"pk" bigserial PRIMARY KEY,
	"id" varchar(255) NOT NULL UNIQUE,
	"branch_id" varchar(255) NOT NULL,
	"amount" integer NOT NULL,
	"category_id" varchar(255) NOT NULL,
	"source" varchar(20) NOT NULL,
	"date" varchar(10) NOT NULL,
	"notes" varchar(500),
	"is_paid" boolean DEFAULT false,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory" (
	"pk" bigserial PRIMARY KEY,
	"id" varchar(255) NOT NULL UNIQUE,
	"branch_id" varchar(255) NOT NULL,
	"name" varchar(100) NOT NULL,
	"unit" varchar(20) NOT NULL,
	"current_quantity" integer DEFAULT 0 NOT NULL,
	"threshold" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "menu_categories" (
	"pk" bigserial PRIMARY KEY,
	"id" varchar(255) NOT NULL UNIQUE,
	"name" varchar(100) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "menu_item_variants" (
	"pk" bigserial PRIMARY KEY,
	"id" varchar(255) NOT NULL UNIQUE,
	"menu_item_id" varchar(255) NOT NULL,
	"name" varchar(60) NOT NULL,
	"base_price" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "menu_items" (
	"pk" bigserial PRIMARY KEY,
	"id" varchar(255) NOT NULL UNIQUE,
	"name" varchar(150) NOT NULL,
	"category_id" varchar(255) NOT NULL,
	"base_price" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"description" varchar(1000),
	"image_url" varchar(500),
	"cost_price" integer,
	"dietary" jsonb,
	"spice_level" integer,
	"allergens" jsonb,
	"is_signature" boolean,
	"prep_time_mins" integer,
	"availability" jsonb,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "menu_price_history" (
	"pk" bigserial PRIMARY KEY,
	"id" varchar(255) NOT NULL UNIQUE,
	"menu_item_id" varchar(255) NOT NULL,
	"variant_id" varchar(255),
	"branch_id" varchar(255),
	"scope" varchar(10) NOT NULL,
	"old_price" integer,
	"new_price" integer,
	"changed_by" varchar(255) NOT NULL,
	"changed_by_name" varchar(100) NOT NULL,
	"changed_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payroll" (
	"pk" bigserial PRIMARY KEY,
	"id" varchar(255) NOT NULL UNIQUE,
	"staff_id" varchar(255) NOT NULL,
	"branch_id" varchar(255),
	"name" varchar(100) NOT NULL,
	"month" integer NOT NULL,
	"year" integer NOT NULL,
	"monthly_salary" integer DEFAULT 0 NOT NULL,
	"days_worked" integer DEFAULT 0 NOT NULL,
	"advances" integer DEFAULT 0 NOT NULL,
	"payable_amount" integer DEFAULT 0 NOT NULL,
	"status" varchar(10) DEFAULT 'PENDING' NOT NULL,
	"notes" varchar(500),
	"paid_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "pos_kots" (
	"pk" bigserial PRIMARY KEY,
	"id" varchar(255) NOT NULL UNIQUE,
	"order_id" varchar(255) NOT NULL,
	"branch_id" varchar(255) NOT NULL,
	"kot_number" integer NOT NULL,
	"items" jsonb DEFAULT '[]' NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"fired_by" varchar(255) NOT NULL,
	"fired_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pos_orders" (
	"pk" bigserial PRIMARY KEY,
	"id" varchar(255) NOT NULL UNIQUE,
	"branch_id" varchar(255) NOT NULL,
	"table_id" varchar(255),
	"takeaway_number" varchar(20),
	"order_type" varchar(10) NOT NULL,
	"covers" integer,
	"status" varchar(10) DEFAULT 'open' NOT NULL,
	"items" jsonb DEFAULT '[]' NOT NULL,
	"note" varchar(200),
	"kot_count" integer DEFAULT 0 NOT NULL,
	"bill" jsonb,
	"payment" jsonb,
	"void" jsonb,
	"date" varchar(10) NOT NULL,
	"opened_by" varchar(255) NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pos_tables" (
	"pk" bigserial PRIMARY KEY,
	"id" varchar(255) NOT NULL UNIQUE,
	"branch_id" varchar(255) NOT NULL,
	"name" varchar(50) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "rate_limit" (
	"key" varchar(255) PRIMARY KEY,
	"attempts" integer DEFAULT 0 NOT NULL,
	"window_start" bigint NOT NULL,
	"blocked_until" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"pk" bigserial PRIMARY KEY,
	"id" varchar(255) NOT NULL UNIQUE,
	"name" varchar(100) NOT NULL,
	"is_chef" boolean DEFAULT false,
	"department_ids" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "staff" (
	"pk" bigserial PRIMARY KEY,
	"id" varchar(255) NOT NULL UNIQUE,
	"name" varchar(100) NOT NULL,
	"branch_id" varchar(255) NOT NULL,
	"department_id" varchar(255) NOT NULL,
	"role_id" varchar(255) NOT NULL,
	"phone" varchar(15) NOT NULL,
	"label" varchar(50),
	"monthly_salary" integer DEFAULT 0,
	"is_active" boolean DEFAULT true NOT NULL,
	"joined_at" varchar(10),
	"exit_date" varchar(10),
	"shift_type" varchar(10),
	"specialty_id" varchar(255),
	"position_id" varchar(255),
	"position_index" integer,
	"start_time" varchar(5),
	"end_time" varchar(5),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "staff_requirements" (
	"pk" bigserial PRIMARY KEY,
	"id" varchar(255) NOT NULL UNIQUE,
	"branch_id" varchar(255) NOT NULL,
	"department_id" varchar(255) NOT NULL,
	"role_id" varchar(255) NOT NULL,
	"position_id" varchar(255),
	"name" varchar(100),
	"required_count" integer DEFAULT 1 NOT NULL,
	"shift_type" varchar(10),
	"specialty_id" varchar(255),
	"default_salary" integer,
	"start_time" varchar(5),
	"end_time" varchar(5),
	"responsibility" varchar(500),
	"schedules" jsonb,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_adjustments" (
	"pk" bigserial PRIMARY KEY,
	"id" varchar(255) NOT NULL UNIQUE,
	"item_id" varchar(255) NOT NULL,
	"branch_id" varchar(255) NOT NULL,
	"type" varchar(10) NOT NULL,
	"amount" integer NOT NULL,
	"reason" varchar(200) NOT NULL,
	"date" varchar(10) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"pk" bigserial PRIMARY KEY,
	"id" varchar(255) NOT NULL UNIQUE,
	"name" varchar(100) NOT NULL,
	"password" varchar(255),
	"role" varchar(20) NOT NULL,
	"branch_id" varchar(255),
	"is_active" boolean DEFAULT true NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "vendors" (
	"pk" bigserial PRIMARY KEY,
	"id" varchar(255) NOT NULL UNIQUE,
	"branch_id" varchar(255) NOT NULL,
	"name" varchar(100) NOT NULL,
	"phone" varchar(15) NOT NULL,
	"supply_type" varchar(100) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "attendance_date_idx" ON "attendance" ("date");--> statement-breakpoint
CREATE INDEX "attendance_branch_idx" ON "attendance" ("branch_id");--> statement-breakpoint
CREATE INDEX "attendance_staff_idx" ON "attendance" ("staff_id");--> statement-breakpoint
CREATE UNIQUE INDEX "attendance_date_staff_uniq" ON "attendance" ("date","staff_id");--> statement-breakpoint
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs" ("timestamp");--> statement-breakpoint
CREATE INDEX "branch_cat_branch_idx" ON "branch_categories" ("branch_id");--> statement-breakpoint
CREATE INDEX "bmi_branch_idx" ON "branch_menu_items" ("branch_id");--> statement-breakpoint
CREATE INDEX "bmi_menu_item_idx" ON "branch_menu_items" ("menu_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bmi_branch_item_variant_uniq" ON "branch_menu_items" ("branch_id","menu_item_id","variant_id");--> statement-breakpoint
CREATE INDEX "branches_name_idx" ON "branches" ("name");--> statement-breakpoint
CREATE INDEX "eod_date_idx" ON "eod" ("date");--> statement-breakpoint
CREATE INDEX "eod_branch_idx" ON "eod" ("branch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "eod_branch_date_uniq" ON "eod" ("branch_id","date");--> statement-breakpoint
CREATE INDEX "expenses_date_idx" ON "expenses" ("date");--> statement-breakpoint
CREATE INDEX "expenses_branch_idx" ON "expenses" ("branch_id");--> statement-breakpoint
CREATE INDEX "expenses_source_branch_date_idx" ON "expenses" ("source","branch_id","date");--> statement-breakpoint
CREATE INDEX "inventory_branch_idx" ON "inventory" ("branch_id");--> statement-breakpoint
CREATE INDEX "inventory_active_branch_idx" ON "inventory" ("branch_id","is_active") WHERE is_active = true;--> statement-breakpoint
CREATE INDEX "variants_menu_item_idx" ON "menu_item_variants" ("menu_item_id");--> statement-breakpoint
CREATE INDEX "menu_items_category_idx" ON "menu_items" ("category_id");--> statement-breakpoint
CREATE INDEX "menu_items_active_idx" ON "menu_items" ("is_active") WHERE is_active = true;--> statement-breakpoint
CREATE INDEX "price_history_item_idx" ON "menu_price_history" ("menu_item_id");--> statement-breakpoint
CREATE INDEX "payroll_month_year_idx" ON "payroll" ("month","year");--> statement-breakpoint
CREATE INDEX "payroll_month_year_staff_idx" ON "payroll" ("month","year","staff_id");--> statement-breakpoint
CREATE INDEX "payroll_branch_idx" ON "payroll" ("branch_id");--> statement-breakpoint
CREATE INDEX "pos_kots_order_idx" ON "pos_kots" ("order_id");--> statement-breakpoint
CREATE INDEX "pos_kots_branch_idx" ON "pos_kots" ("branch_id");--> statement-breakpoint
CREATE INDEX "pos_kots_status_idx" ON "pos_kots" ("status");--> statement-breakpoint
CREATE INDEX "pos_orders_branch_idx" ON "pos_orders" ("branch_id");--> statement-breakpoint
CREATE INDEX "pos_orders_date_idx" ON "pos_orders" ("date");--> statement-breakpoint
CREATE INDEX "pos_orders_status_idx" ON "pos_orders" ("status");--> statement-breakpoint
CREATE INDEX "pos_orders_table_idx" ON "pos_orders" ("table_id");--> statement-breakpoint
CREATE INDEX "pos_orders_branch_date_idx" ON "pos_orders" ("branch_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "pos_orders_open_table_uniq" ON "pos_orders" ("table_id") WHERE status = 'open' AND table_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "pos_orders_open_by_table_idx" ON "pos_orders" ("table_id","status") WHERE status = 'open' AND table_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "pos_tables_branch_idx" ON "pos_tables" ("branch_id");--> statement-breakpoint
CREATE INDEX "pos_tables_active_branch_idx" ON "pos_tables" ("branch_id","is_active") WHERE is_active = true;--> statement-breakpoint
CREATE UNIQUE INDEX "pos_tables_branch_name_uniq" ON "pos_tables" ("branch_id","name") WHERE is_active = true;--> statement-breakpoint
CREATE INDEX "staff_branch_idx" ON "staff" ("branch_id");--> statement-breakpoint
CREATE INDEX "staff_role_idx" ON "staff" ("role_id");--> statement-breakpoint
CREATE INDEX "staff_position_idx" ON "staff" ("position_id");--> statement-breakpoint
CREATE INDEX "staff_active_branch_idx" ON "staff" ("branch_id","is_active") WHERE is_active = true;--> statement-breakpoint
CREATE INDEX "staff_req_branch_idx" ON "staff_requirements" ("branch_id");--> statement-breakpoint
CREATE INDEX "staff_req_role_idx" ON "staff_requirements" ("role_id");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_req_branch_dept_role_uniq" ON "staff_requirements" ("branch_id","department_id","role_id") WHERE is_active = true;--> statement-breakpoint
CREATE INDEX "stock_adj_branch_idx" ON "stock_adjustments" ("branch_id");--> statement-breakpoint
CREATE INDEX "stock_adj_item_idx" ON "stock_adjustments" ("item_id");--> statement-breakpoint
CREATE INDEX "stock_adj_date_idx" ON "stock_adjustments" ("date");--> statement-breakpoint
CREATE INDEX "vendors_branch_idx" ON "vendors" ("branch_id");
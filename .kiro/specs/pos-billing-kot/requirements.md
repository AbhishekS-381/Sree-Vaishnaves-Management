# Requirements Document

## Introduction

This feature adds a Point-of-Sale (POS) / Billing / Kitchen Order Ticket (KOT) system to the Sree Vaishnaves management portal. Currently, end-of-day billing totals are entered manually into the EOD form with no record of individual orders. This feature introduces real-time order taking at the table or counter, generates KOTs for the kitchen, produces itemised customer bills, and automatically feeds the resulting totals into the EOD income summary — eliminating manual re-entry and capturing per-item revenue data for future reporting.

The POS supports both dine-in (table-assigned) and takeaway (counter queue) order types. A "fire to kitchen" workflow separates item entry from KOT generation, giving staff time to build an order before notifying the kitchen. An optional per-item note field supports kitchen customisation instructions (e.g. "extra spicy", "no salt"). A real-time daily summary view replaces manual tally-keeping, giving managers an at-a-glance picture of service performance. All significant mutations are audit-logged to support dispute resolution and transaction reconstruction.

The feature is scoped to in-house use by managers and counter staff. It does not introduce customer-facing self-service, online ordering, payment-gateway integration, or PDF printing; receipts are shown on-screen only. GST is collected as a single rupee amount entered per bill (no tax-rule engine). All monetary values are integer rupees.

## Glossary

- **POS_System**: The Point-of-Sale module added by this feature, accessed at `/management/pos`.
- **Order**: A collection of one or more OrderItems created for a specific table or counter session within a branch on a given date.
- **OrderItem**: A single line in an Order — one menu item (optionally a specific variant) with a quantity and the effective price at the time of ordering.
- **KOT**: Kitchen Order Ticket — a printed or on-screen summary of new/modified items sent to the kitchen for a given Order.
- **Bill**: The customer-facing summary of an Order showing all items, subtotal, discounts, GST, and total payable amount.
- **Table**: A numbered or named seating location within a branch (e.g. "Table 1", "Counter").
- **Order_Status**: The lifecycle state of an Order: `open` → `billed` → `paid` → `voided`.
- **KOT_Status**: The status of a KOT within the kitchen: `pending` → `preparing` → `ready` → `served`.
- **Payment_Method**: The mode of settlement for a Bill: `cash`, `upi`, or `split` (part cash, part UPI).
- **EOD_Entry**: The existing day-end record in `eod.json` — the POS system populates its `billing` section automatically.
- **Session_User**: The authenticated portal user operating the POS (manager role or above).
- **Branch**: A single restaurant location as defined in `branches.json`.
- **Menu_Catalog**: The global menu items from `menu.json` filtered by the branch's per-branch availability settings in `branch_menu_items_<branchId>.json`.
- **Effective_Price**: The price of a menu item or variant for a branch — branch override price when set, otherwise `basePrice`.
- **Order_Type**: The service mode of an Order: `dine-in` (table-based) or `takeaway` (counter pickup, no table assignment required).
- **Covers**: The number of guests/people seated at a table for a dine-in Order. An optional integer captured at order creation (default 1, minimum 1, maximum 30).
- **KOT_Fire**: The explicit user action of sending accumulated OrderItems to the kitchen, which triggers KOT generation. Separates item-entry from kitchen notification.
- **Item_Note**: An optional free-text note attached to a single OrderItem (e.g. "extra spicy", "no salt"), maximum 80 characters.
- **Table_Grid**: The POS landing screen showing all Tables for the current Branch with their current status (`available`, `occupied`) and active order summary.
- **POS_Role**: One of the three new POS-specific portal roles: `billing`, `kitchen`, or `waiter`. Each is branch-scoped and has access only to its designated POS page. POS_Roles are distinct from the existing management roles (`admin`, `owner`, `manager`, `readonly`).
- **Billing_Role**: A portal user with role `billing`. Branch-scoped. Has access only to `/management/pos/billing`. Can view `billed` Orders for their branch, collect payments, and view today's `paid` Orders. Cannot create orders, fire KOTs, or access any other module.
- **Kitchen_Role**: A portal user with role `kitchen`. Branch-scoped. Has access only to `/management/pos/kitchen`. Can view all active KOTs for their branch and advance KOT status. Cannot create orders, view bills, or access any other module.
- **Waiter_Role**: A portal user with role `waiter`. Branch-scoped. Has access only to `/management/pos/order`. Can create orders, add items, fire KOTs, and view **only their own orders** (orders where `openedBy === session.userId`). Cannot generate bills, collect payments, or access any other module.

## Requirements

### Requirement 1: Table Management

**User Story:** As a manager, I want to define and manage the tables/seats for my branch, so that orders can be assigned to specific tables.

#### Acceptance Criteria

1. THE POS_System SHALL allow a Session_User with `manager`, `owner`, or `admin` role to create, rename, and deactivate Tables for their assigned Branch, where Table names must be between 1 and 50 characters in length.
2. THE POS_System SHALL scope Table records to a single Branch and prevent a Session_User from viewing or modifying Tables belonging to another Branch.
3. IF a Session_User attempts to deactivate a Table that has an `open` Order, THEN THE POS_System SHALL reject the deactivation and return an error indicating the Table has an active order.
4. IF a Session_User attempts to create a Table when the Branch already has 50 active Tables, THEN THE POS_System SHALL reject the creation and return an error indicating the active table limit has been reached.
5. IF a Session_User attempts to create or rename a Table to a name that is already used by another active Table in the same Branch, THEN THE POS_System SHALL reject the operation and return an error indicating the name is already in use.
6. THE POS_System SHALL persist Table definitions in a new `pos_tables.json` collection using soft delete (`isActive: false` + `deletedAt`).
7. THE POS_System SHALL display Tables in the Table_Grid sorted by name in ascending order, with `available` Tables visually distinct from `occupied` Tables.

### Requirement 2: Order Creation

**User Story:** As a manager or counter staff, I want to open a new order for a table, so that I can record what customers have ordered.

#### Acceptance Criteria

1. WHEN a Session_User selects a Table from the Table_Grid, THE POS_System SHALL create a new Order, prompt for Order_Type (`dine-in` or `takeaway`), and if `dine-in`, optionally capture Covers (defaulting to 1); THE POS_System SHALL then set `Order_Status = open` and assign the Order to that Table and Branch.
2. IF a Session_User attempts to open an Order on a Table that already has an `open` Order, THEN THE POS_System SHALL reject the request and return an error indicating the table is occupied.
3. WHEN a new Order is created, THE POS_System SHALL record the Branch, Table, the ID of the Session_User who opened it, and the creation timestamp in IST.
4. WHEN an Order has `Order_Status = open`, THE POS_System SHALL allow a Session_User to add OrderItems by selecting from the Menu_Catalog filtered for the current Branch.
5. WHEN a Session_User adds an OrderItem, THE POS_System SHALL record the menu item id, variant id (if applicable), item name snapshot, Effective_Price at the time of ordering, and a quantity between 1 and 99 inclusive.
6. WHILE an Order has `Order_Status = open`, THE POS_System SHALL allow a Session_User to increase or decrease the quantity of an OrderItem, where decreasing the quantity to zero removes the OrderItem from the Order; IF the Order's status changes away from `open` after a quantity-decrease-to-zero removal was initiated while the order was `open`, THE POS_System SHALL allow the removal to complete.
7. IF a menu item is not available for the Branch (per branch availability settings), THEN THE POS_System SHALL exclude it from the ordering menu and prevent it from being added to an Order.
8. THE POS_System SHALL allow a Session_User to create a Takeaway Order without selecting a Table, assigning it to a counter queue with a sequential takeaway number (e.g. T-1, T-2) scoped to the current IST date and Branch.
9. THE POS_System SHALL allow a Session_User to add an optional free-text note (Item_Note, maximum 80 characters) to any OrderItem at the time of adding or editing it.
10. THE POS_System SHALL allow a Session_User to add an optional order-level note (maximum 200 characters) to an `open` Order at any time before billing.

### Requirement 3: Kitchen Order Ticket (KOT) Generation

**User Story:** As a manager, I want kitchen staff to receive a KOT for every order update, so that the kitchen always knows what to prepare.

#### Acceptance Criteria

1. WHEN a Session_User has added or modified OrderItems and performs a KOT_Fire action, THE POS_System SHALL generate a KOT containing only the OrderItems that were added or had their quantity increased since the last KOT_Fire for that Order.
2. WHEN a KOT is generated, THE POS_System SHALL assign it a sequential number within the Order (KOT #1, KOT #2, etc.) and persist it to the `pos_kots` collection with `KOT_Status` set to `pending`.
3. WHEN a KOT is generated, THE POS_System SHALL display it on the POS screen showing at minimum the KOT number, Order identifier, item names, and quantities.
4. IF a Session_User with `manager`, `owner`, or `admin` role attempts to advance `KOT_Status`, THEN THE POS_System SHALL update it only along the sequence `pending` → `preparing` → `ready` → `served`.
5. IF a Session_User attempts to set `KOT_Status` to a state that does not follow the permitted sequence, THEN THE POS_System SHALL reject the update and return an error message indicating the current status and the valid next status.
6. IF a Session_User reduces the quantity of an OrderItem or removes an OrderItem from an Order that already has a KOT, THEN THE POS_System SHALL record the reduction against the Order without generating a new KOT.
7. THE POS_System SHALL allow a Session_User to view all previously generated KOTs for an `open` or `billed` Order, showing each KOT's number, items, quantities, and current KOT_Status.

### Requirement 4: Bill Generation

**User Story:** As a manager, I want to generate an itemised bill for a table, so that customers know what they owe and payment can be collected.

#### Acceptance Criteria

1. WHEN a Session_User requests a bill for an `open` Order, THE POS_System SHALL compute a Bill showing: all OrderItems with quantities and unit prices, subtotal (sum of `quantity × unit_price` for all items), discount (integer rupees, minimum 0, maximum equal to subtotal), GST amount (integer rupees, minimum 0), and total payable (`subtotal − discount + GST`); IF the entered discount exceeds the subtotal, THEN THE POS_System SHALL reject the discount and display an error indicating the discount cannot exceed the subtotal.
2. WHEN a Bill is generated for an `open` Order, THE POS_System SHALL set `Order_Status` to `billed`.
3. WHILE `Order_Status` is `billed`, THE POS_System SHALL prevent adding, removing, or modifying OrderItems.
4. WHILE `Order_Status` is `billed` and `Order_Status` is not `paid`, THE POS_System SHALL allow a Session_User to re-open the Order by reverting `Order_Status` to `open`, re-enabling item modifications.
5. THE POS_System SHALL prevent generating a Bill for an Order that has no OrderItems.
6. THE POS_System SHALL display the Bill on-screen only; no PDF generation or printer integration is required.
7. IF total payable is 0 (after discount), THEN THE POS_System SHALL require the Session_User to explicitly confirm a zero-value bill before proceeding.
8. IF a Session_User requests a bill for an Order with `Order_Status` of `billed`, THEN THE POS_System SHALL display the existing Bill without recomputing or resetting the Order.
9. WHEN a Session_User views a Bill for a `paid` Order, THE POS_System SHALL display the stored Bill details (items, subtotal, discount, GST, total payable, payment method, cash amount, UPI amount) in read-only mode.
10. WHEN computing the Bill, THE POS_System SHALL pre-populate the GST field with a suggested amount based on the configured default GST rate (stored in `config.json`); the Session_User may override this before confirming. If no default GST rate is configured, the GST field SHALL default to 0.
11. IF a Session_User attempts to re-open an Order whose `Order_Status` is `paid`, THEN THE POS_System SHALL display an explicit error message indicating that a paid order cannot be reopened.

### Requirement 5: Payment Collection

**User Story:** As a manager, I want to record how a bill was paid, so that cash and UPI totals are captured accurately for EOD reconciliation.

#### Acceptance Criteria

1. WHEN a Session_User records payment for a `billed` Order, THE POS_System SHALL accept a Payment_Method of `cash`, `upi`, or `split`.
2. WHERE Payment_Method is `split` and the Bill's total payable amount is greater than zero, THE POS_System SHALL require the Session_User to enter a cash amount and a UPI amount whose sum equals the Bill's total payable amount, with each amount being a non-negative integer in rupees and at least one amount being greater than zero. WHERE Payment_Method is `split` and the Bill's total payable amount is zero, THE POS_System SHALL accept cash amount = 0 and UPI amount = 0 without requiring either to be greater than zero.
3. IF the cash amount plus UPI amount does not equal the Bill's total payable amount, THEN THE POS_System SHALL reject the payment without recording any payment data, and return an error indicating the entered amounts do not balance with the total payable.
4. WHEN payment is recorded, THE POS_System SHALL set `Order_Status` to `paid`, record the payment breakdown (cash amount and UPI amount as integer rupees), and set the Table's status to `available`.
5. IF a Session_User with `owner` role or above attempts to void a `paid` Order and the current IST time is on the same calendar date (IST, up to and including 23:59:59) as the Order's payment timestamp, THEN THE POS_System SHALL accept a void reason between 1 and 200 characters, set `Order_Status` to `voided`, set the Table's status to `available`, and record the void reason and the Session_User's ID against the Order.
6. WHEN a `paid` Order is voided, THE POS_System SHALL record the void timestamp, and decrement the day's POS revenue aggregates by the Order's cash amount, UPI amount, and order count by one.
7. WHEN recording a `cash` or `split` payment, THE POS_System SHALL display the change due to the customer (cash tendered amount entered by the Session_User minus the cash portion of the total payable) as a read-only on-screen value.
8. IF a Session_User with `owner` or `admin` role attempts to void a `paid` Order on a different calendar date (IST) from the Order's payment date, THEN THE POS_System SHALL reject the void and return an error indicating the order can only be voided on the same day it was paid.

### Requirement 6: EOD Integration

**User Story:** As a manager, I want POS billing totals to automatically populate the EOD income section, so that I do not have to re-enter revenue figures manually.

#### Acceptance Criteria

1. WHEN a Session_User opens the EOD form for a date and branch, THE POS_System SHALL compute and pre-fill the `income` fields (`dineInCash`, `dineInUpi`, `takeawayCash`, `takeawayUpi`) from all `paid` Orders for that date and branch, overwriting any previously displayed value from prior form loads.
2. WHEN the EOD form is opened, THE POS_System SHALL compute `dineInCash` and `dineInUpi` as the sum of cash and UPI amounts respectively from `paid` Orders with order type `dine-in`, and `takeawayCash` and `takeawayUpi` from `paid` Orders with order type `takeaway`, for that date and branch.
3. WHEN the EOD form is opened, THE POS_System SHALL compute and pre-fill the `billing` section: `totalBillAmount` as the sum of total payable amounts across all `paid` Orders; `billCount` as the count of `paid` Orders; `dineInCovers` as the count of `paid` Orders with order type `dine-in`; `takeawayOrders` as the count of `paid` Orders with order type `takeaway`; `voids` as the count of Orders with `Order_Status = voided`; and `discounts` as the sum of discount amounts in rupees across all `paid` Orders — all scoped to that date and branch.
4. WHEN a Session_User saves the EOD entry, THE POS_System SHALL allow the Session_User to override the pre-filled values if they differ from the POS totals — the override is a manual correction, not an error.
5. IF no `paid` Orders exist for a date and branch, THEN THE POS_System SHALL leave the EOD income fields at zero and display a non-blocking notice on the form indicating that no POS data is available for that date and branch.
6. THE POS_System SHALL NOT modify EOD entries automatically without explicit user action on the EOD form.
7. WHEN the EOD form is opened and POS data is available, THE POS_System SHALL also pre-fill `cashCollectedAsBilled` as the sum of all cash amounts from `paid` Orders, `upiCollectedAsBilled` as the sum of all UPI amounts from `paid` Orders, and `gstCollected` as the sum of all GST amounts from `paid` Orders — all scoped to that date and branch.

### Requirement 7: Order History and Reporting

**User Story:** As an owner or admin, I want to view the order history for any date and branch, so that I can audit transactions and investigate discrepancies.

#### Acceptance Criteria

1. WHERE a Session_User has `owner` or `admin` role, THE POS_System SHALL provide access to a read-only order history view showing all Orders (any status) for a selected date range and branch.
2. WHEN a Session_User with `owner` or `admin` role has explicitly selected both a date range and a branch, THE POS_System SHALL display each matching Order's table name, status, item count, total payable amount, payment method, and the name of the user who opened it; IF no Orders match the filter, THEN THE POS_System SHALL display an empty-state message indicating no orders were found.
3. WHEN a Session_User selects an Order in the history view, THE POS_System SHALL display the full item breakdown including item names, quantities, unit prices, subtotal, discount, GST, total payable, and payment split (cash amount and UPI amount).
4. WHERE a Session_User has `manager` role, THE POS_System SHALL only show Orders belonging to the Session_User's assigned Branch in the history view; IF the Session_User queries history for a different Branch, THEN THE POS_System SHALL return an error without revealing the existence of data for that Branch.
5. THE POS_System SHALL store all Order and KOT data in new collections `pos_orders.json` and `pos_kots.json` accessible via the standard `readJSON` / `withTransaction` interface.
6. WHEN a Session_User views the order history for a date range and branch, THE POS_System SHALL display a summary row showing total revenue (sum of total payable across `paid` Orders), total bill count, average order value, total voids count, and total discounts amount for the filtered period.

### Requirement 8: Access Control and Role-Based Page Authorization

**User Story:** As an admin, I want POS access to be strictly role-controlled with dedicated pages per role, so that each user sees only the functionality they are authorised to perform.

#### Acceptance Criteria

1. THE POS_System SHALL define the following page-to-role access matrix:
   - `/management/pos` (Main POS Dashboard): accessible to `manager`, `owner`, `admin` roles only.
   - `/management/pos/order` (Waiter Order Page): accessible to `waiter` role only (plus `manager`, `owner`, `admin` who can also access the main POS).
   - `/management/pos/billing` (Billing Page): accessible to `billing` role only (plus `manager`, `owner`, `admin`).
   - `/management/pos/kitchen` (Kitchen KOT Page): accessible to `kitchen` role only (plus `manager`, `owner`, `admin`).
   - `/management/pos/history` (Order History): accessible to `owner` and `admin` roles only.

2. WHEN a Session_User with `billing`, `kitchen`, or `waiter` role logs in, THE POS_System SHALL redirect them directly to their designated page (`/management/pos/billing`, `/management/pos/kitchen`, or `/management/pos/order` respectively) without exposing the main management navigation or other modules.

3. IF a Session_User with `billing`, `kitchen`, or `waiter` role attempts to access any URL other than their designated POS page or `/management/login`, THE POS_System SHALL redirect them to their designated page.

4. THE POS_System SHALL allow Session_Users with `manager`, `owner`, or `admin` role to create Orders, add OrderItems, fire KOTs, generate Bills, and record payments.

5. THE POS_System SHALL restrict the `waiter` role to: creating orders, adding/editing OrderItems, firing KOTs, and viewing **only their own orders** (where `openedBy === session.userId`). Waiter role SHALL NOT generate bills, record payments, or void orders.

6. THE POS_System SHALL restrict the `billing` role to: viewing `billed` and `paid` Orders for their branch (today only), generating Bills, and recording payments. Billing role SHALL NOT create orders, add items, fire KOTs, or void orders.

7. THE POS_System SHALL restrict the `kitchen` role to: viewing all active KOTs (status `pending`, `preparing`, `ready`) for their branch and advancing KOT status. Kitchen role SHALL NOT create orders, generate bills, record payments, or view order financial details (discount, GST, total payable).

8. THE POS_System SHALL restrict voiding a `paid` Order to Session_Users with `owner` or `admin` role only.

9. THE POS_System SHALL restrict voiding a stale `open` Order to `manager`, `owner`, or `admin` role only (not `waiter`, `billing`, or `kitchen`).

10. THE POS_System SHALL enforce branch scoping in every Server Action for all POS roles: a Session_User with any branch-scoped role SHALL only read and write Orders, Tables, and KOTs for their assigned Branch.

11. WHEN a Session_User with a branch-scoped role invokes any POS Server Action targeting a resource in a different Branch, THE POS_System SHALL return a distinct `BranchAccessDenied` error without revealing the existence of the resource.

12. IF any Session_User attempts an action on a POS resource for which their role does not grant permission, THE POS_System SHALL reject the action, return an appropriate error, and ensure no data mutation occurs.

13. THE POS_System SHALL allow Session_Users with `readonly` role to view the order history but not create, modify, or void Orders.

### Requirement 9: Module Toggle

**User Story:** As an admin, I want to be able to enable or disable the POS module globally, so that branches not using it do not see it.

#### Acceptance Criteria

1. WHEN the `pos` boolean flag is absent from the `config.json` record (e.g. on existing deployments), THE POS_System SHALL treat the missing flag as `false` (disabled by default).
2. WHEN the `pos` flag is `false`, THE POS_System SHALL hide the POS navigation entry for all roles and redirect any direct request to `/management/pos` to `/management`.
3. WHEN the `pos` flag is `true`, THE POS_System SHALL display the POS navigation entry for Session_Users with `manager`, `owner`, or `admin` role; Session_Users with `readonly` role SHALL NOT see the POS navigation entry regardless of the `pos` flag value.
4. THE POS_System SHALL allow a Session_User with `admin` role to toggle the `pos` flag on or off via the existing Settings module, using the same `toggleModule` Server Action pattern used for other modules.

### Requirement 10: Stale Order Management

**User Story:** As a manager, I want the system to flag orders that were left open from a previous day, so that I can close them out or void them before starting the new day's service.

#### Acceptance Criteria

1. WHEN the POS module is loaded for a Branch on a given IST date, THE POS_System SHALL identify any Orders with `Order_Status = open` whose creation date is prior to the current IST date and display a dismissible banner listing these stale orders.
2. THE POS_System SHALL allow a Session_User with `manager`, `owner`, or `admin` role to void a stale `open` Order by entering a void reason between 1 and 200 characters, setting `Order_Status` to `voided` and Table status to `available`.
3. THE POS_System SHALL NOT prevent new Orders from being created while stale open Orders exist; the banner is informational only.

### Requirement 11: Daily POS Summary (End-of-Service View)

**User Story:** As a manager, I want to see a real-time summary of today's POS activity for my branch, so that I can monitor service performance before closing out for the day.

#### Acceptance Criteria

1. THE POS_System SHALL provide a daily summary view showing, for the current IST date and the Session_User's Branch: total revenue from `paid` Orders, bill count, average order value, total cash collected, total UPI collected, dine-in bill count, takeaway bill count, void count, and total discounts given.
2. WHEN a new Order is paid or voided, THE POS_System SHALL reflect the change in the daily summary view without requiring a manual page refresh (via `revalidatePath`).
3. THE POS_System SHALL display the daily summary to Session_Users with `manager`, `owner`, or `admin` role; Session_Users with `readonly` role SHALL NOT access the daily summary view.

### Requirement 12: Audit Logging for POS Mutations

**User Story:** As an admin, I want all significant POS actions to be recorded in the audit log, so that I can investigate disputes and reconstruct transaction history.

#### Acceptance Criteria

1. THE POS_System SHALL call `logAction()` for the following POS events: Order creation, KOT_Fire, Bill generation, Payment recorded, Order voided, and Order re-opened from `billed` to `open`.
2. THE POS_System SHALL include in each audit log entry: the action type, the Order id, the Branch id, the Session_User id, and a JSON summary of the key changed values (e.g. payment amounts for a payment action, void reason for a void).
3. THE POS_System SHALL NOT create any audit log entry — through any code path, including but not limited to `logAction()` — for read-only actions (viewing orders, viewing the Table_Grid, viewing KOTs).

### Requirement 13: Config — Default GST Rate

**User Story:** As an admin, I want to set a default GST rate for the POS billing screen, so that staff do not have to calculate or type the GST amount manually on every bill.

#### Acceptance Criteria

1. THE POS_System SHALL add an optional `posDefaultGstPercent` integer field (0–28) to the `config.json` record, defaulting to 0 when absent.
2. WHEN a Session_User with `admin` role saves a new default GST rate via Settings, THE POS_System SHALL persist it in `config.json` using the existing `toggleModule` / Settings pattern.
3. WHEN the `posDefaultGstPercent` is set to a non-zero value, THE POS_System SHALL pre-compute the suggested GST as `Math.round(subtotal * posDefaultGstPercent / 100)` (integer rupees) and display it in the GST field on the Bill generation screen; the Session_User may override this value.

### Requirement 14: Dedicated Billing Page (`/management/pos/billing`)

**User Story:** As a billing clerk, I want a dedicated billing screen that shows me only the orders ready to be billed and paid, so that I can focus on collecting payment without distraction.

#### Acceptance Criteria

1. THE POS_System SHALL provide a dedicated Billing Page at `/management/pos/billing` accessible to users with `billing`, `manager`, `owner`, or `admin` role.
2. WHEN a Session_User with `billing` role accesses the Billing Page, THE POS_System SHALL display all Orders with `Order_Status = billed` for the current IST date and their assigned Branch, sorted by bill generation time (oldest first).
3. THE POS_System SHALL also display `paid` Orders for the current IST date and branch on the Billing Page in a read-only section, so the billing clerk can reference completed transactions.
4. WHEN a Session_User with `billing` role selects a `billed` Order, THE POS_System SHALL display the Bill details (items, subtotal, discount, GST, total payable) and allow the Session_User to record payment (cash/UPI/split), displaying change-due for cash payments.
5. THE POS_System SHALL allow a Session_User with `billing` role to generate a Bill for an `open` Order on the Billing Page (to handle cases where a waiter did not bill before handoff), subject to the same bill generation rules (non-empty items, discount ≤ subtotal).
6. THE POS_System SHALL NOT display the Table_Grid, order creation, KOT panels, or daily summary to a Session_User with `billing` role — the Billing Page shows only billed/paid orders and the payment collection flow.
7. WHEN a Session_User with `billing` role logs in, THE POS_System SHALL redirect them directly to `/management/pos/billing` without showing the main management navigation sidebar.
8. THE POS_System SHALL display on the Billing Page a running total of cash collected and UPI collected for the current IST date and branch, updated in real-time as payments are recorded.

### Requirement 15: Dedicated Kitchen KOT Page (`/management/pos/kitchen`)

**User Story:** As a kitchen staff member, I want a dedicated KOT display screen that shows all incoming and in-progress orders, so that I can track what to prepare and mark items as ready.

#### Acceptance Criteria

1. THE POS_System SHALL provide a dedicated Kitchen KOT Page at `/management/pos/kitchen` accessible to users with `kitchen`, `manager`, `owner`, or `admin` role.
2. WHEN a Session_User with `kitchen` role accesses the Kitchen Page, THE POS_System SHALL display all KOTs with `KOT_Status` of `pending` or `preparing` or `ready` for the current IST date and their assigned Branch, sorted by `firedAt` timestamp (oldest first — FIFO order).
3. THE POS_System SHALL display on each KOT card: KOT number, Order identifier (table name or takeaway number), time since fired (`firedAt`), KOT status chip, and for each item: item name, quantity, and Item_Note (if present).
4. THE POS_System SHALL allow a Session_User with `kitchen` role to advance the `KOT_Status` of a KOT by one step (`pending → preparing → ready → served`) using a single prominent button per KOT card.
5. WHEN `KOT_Status` is advanced to `served`, THE POS_System SHALL move the KOT card out of the active display (it may still be viewed in a collapsed "Served" section).
6. THE POS_System SHALL NOT display financial information (subtotal, discount, GST, total payable, payment method) on the Kitchen Page — kitchen staff see only item names, quantities, notes, and KOT status.
7. WHEN a Session_User with `kitchen` role logs in, THE POS_System SHALL redirect them directly to `/management/pos/kitchen` without showing the main management navigation sidebar.
8. THE POS_System SHALL refresh the Kitchen Page automatically when new KOTs arrive for the branch, so kitchen staff see new orders without manual page refresh. This is achieved via `revalidatePath` triggered by `fireKot` and displayed by the client using periodic polling (every 30 seconds) as a minimum acceptable refresh mechanism.

### Requirement 16: Dedicated Waiter Order Page (`/management/pos/order`)

**User Story:** As a waiter, I want a dedicated order-taking screen that shows me only my own tables and orders, so that I can take orders quickly and send them to the kitchen without accessing billing or other staff's orders.

#### Acceptance Criteria

1. THE POS_System SHALL provide a dedicated Waiter Order Page at `/management/pos/order` accessible to users with `waiter`, `manager`, `owner`, or `admin` role.
2. WHEN a Session_User with `waiter` role accesses the Waiter Page, THE POS_System SHALL display the Table_Grid showing all active Tables for the branch, but SHALL highlight only the tables where the currently logged-in waiter has an open order (`openedBy === session.userId`).
3. THE POS_System SHALL allow a Session_User with `waiter` role to create a new `open` Order on any `available` Table for their assigned Branch (subject to the one-open-order-per-table rule).
4. WHEN a Session_User with `waiter` role opens an Order, THE POS_System SHALL allow them to add OrderItems, edit Item_Notes, set an order-level note, and fire KOTs.
5. THE POS_System SHALL allow a Session_User with `waiter` role to view and edit **only their own Orders** (where `openedBy === session.userId`). IF a `waiter` attempts to access an Order opened by another user, THE POS_System SHALL return a `Forbidden` error.
6. THE POS_System SHALL NOT allow a Session_User with `waiter` role to generate Bills, record payments, void orders, or view the Daily Summary.
7. WHEN a Session_User with `waiter` role logs in, THE POS_System SHALL redirect them directly to `/management/pos/order` without showing the main management navigation sidebar.
8. THE POS_System SHALL display on the Waiter Page only the menu items available for the branch, with item name, price, and dietary tags — no cost price, no financial summary.

### Requirement 17: POS-Specific Role User Management

**User Story:** As an admin or owner, I want to create and manage user accounts for billing clerks, kitchen staff, and waiters, so that they can log in and access only their designated POS screens.

#### Acceptance Criteria

1. THE POS_System SHALL allow a Session_User with `admin` or `owner` role to create portal users with roles `billing`, `kitchen`, or `waiter` via the existing User Management section in Settings.
2. WHEN creating a user with `billing`, `kitchen`, or `waiter` role, THE POS_System SHALL require a Branch assignment (`branchId`) — these roles are always branch-scoped and cannot be created without a branch.
3. THE POS_System SHALL include `billing`, `kitchen`, and `waiter` as selectable role options in the user creation and edit forms, alongside the existing `manager` and `readonly` options.
4. WHEN a user with `billing`, `kitchen`, or `waiter` role successfully authenticates, THE POS_System SHALL issue a JWT that includes: `role`, `branchId`, and a `posRole: true` flag indicating a POS-dedicated account.
5. THE POS_System SHALL use the `posRole` JWT flag in `src/proxy.ts` to redirect POS-dedicated users to their designated page on any `/management/*` access attempt, enforcing their page-lock.
6. THE POS_System SHALL allow a Session_User with `admin` or `owner` role to deactivate a `billing`, `kitchen`, or `waiter` user account using the existing soft-delete user pattern.

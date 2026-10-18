# Implementation Plan: POS / Billing / KOT

## Overview

Implements the full Point-of-Sale module on top of the existing JSON-blob store and Server Action architecture. Work is organised into 11 epics that build incrementally: foundation types and seed data first, then auth/routing, then server actions (the core business logic), then UI pages, then integration with existing modules (EOD, Settings, Navigation), and finally the full test suite.

Each epic produces runnable, wired-up code before the next begins. No orphaned code is introduced.

## Tasks

- [x] 1. Foundation — DB_FILES, types, seed data, and pure helpers
  - [x] 1.1 Add POS collections to `DB_FILES` in `src/lib/db.ts`
    - Add `POS_TABLES: 'pos_tables.json'`, `POS_ORDERS: 'pos_orders.json'`, `POS_KOTS: 'pos_kots.json'` to the `DB_FILES` constant
    - _Requirements: 7.5_

  - [x] 1.2 Add TypeScript types for all POS data models
    - Create `src/app/actions/posTypes.ts` (or top of `pos.ts`) with: `PosTable`, `OrderItem`, `BillSnapshot`, `PaymentSnapshot`, `VoidInfo`, `PosOrder`, `KotItem`, `PosKot`, `PosEodData`, `OrderType`, `OrderStatus`, `KotStatus`, `CatalogItem`
    - Ensure all monetary fields are `number` (integer rupees) and all timestamps are `string` (ISO)
    - _Requirements: 2.5, 3.2, 4.1, 5.1, 6.3_

  - [x] 1.3 Create `src/lib/posUtils.ts` with POS role capability helpers
    - Create `src/lib/posUtils.ts` (not inside `pos.ts`) as the canonical location so it can be imported by `eod/page.tsx`, `pos.ts`, and test files without circular dependencies. Implement all 8 pure helper functions: `canCreateOrder`, `canFireKot`, `canGenerateBill`, `canRecordPayment`, `canAdvanceKot`, `canVoidOrder`, `canViewHistory`, `isWaiterOwnOrder`. Export `POS_DEDICATED_ROLES = ['billing', 'kitchen', 'waiter'] as const`. All action files import from `@/lib/posUtils`.
    - _Requirements: 8.4, 8.5, 8.6, 8.7, 8.8, 8.9_

  - [x] 1.4 Update `db/seed-data.ts` with POS defaults
    - Add `"pos": false` to the `config.json` seed row
    - Add three empty-array seed rows: `pos_tables.json`, `pos_orders.json`, `pos_kots.json`
    - _Requirements: 9.1_

  - [x] 1.5 Write unit tests for `posUtils.ts` helpers
    - Test each helper against every role string (including edge cases like unknown roles)
    - Test `isWaiterOwnOrder` for same-user, different-user, and non-waiter roles
    - _Requirements: 8.4–8.9_

- [x] 2. Auth / JWT extension and proxy routing
  - [x] 2.1 Extend JWT payload with `posRole` flag in `src/lib/jwt.ts` and `src/app/actions/auth.ts`
    - Add `posRole?: boolean` to `verifyToken` return type in `src/lib/jwt.ts`
    - In `auth.ts` `signToken` call: compute `isPosRole = POS_DEDICATED_ROLES.includes(role)` and pass `posRole: isPosRole`
    - _Requirements: 17.4_

  - [x] 2.2 Extend `users.ts` to support `billing`, `kitchen`, `waiter` roles with mandatory `branchId`
    - In `addUser` and `updateUser`: expand `branchId` assignment to all branch-scoped roles (`manager`, `billing`, `kitchen`, `waiter`)
    - Add validation: if role is `billing`, `kitchen`, or `waiter` and `branchId` is absent → `{ error: 'Branch is required for this role' }`
    - Add the three new role strings to the role enum/validation schema
    - _Requirements: 17.1, 17.2, 17.3_

  - [x] 2.3 Update `src/proxy.ts` to enforce POS-dedicated role page-lock
    - After session verification: if `session.posRole === true`, look up `ROLE_HOME` map (`billing→/management/pos/billing`, `kitchen→/management/pos/kitchen`, `waiter→/management/pos/order`) and redirect if the current `pathname` does not start with the designated home (excluding `/management/login`)
    - _Requirements: 8.2, 8.3, 17.5_

  - [x] 2.4 Update `src/app/management/layout.tsx` to suppress the sidebar for `posRole` users
    - After `getSession()`: if `session?.posRole === true`, render `<main className="h-screen w-full overflow-y-auto">{children}</main>` without `<Navigation>`
    - _Requirements: 14.7, 15.7, 16.7_

  - [x] 2.5 Write unit tests for auth/proxy changes
    - Test `signToken` includes `posRole: true` for billing/kitchen/waiter and `posRole: false` (or absent) for other roles
    - Test `users.ts` `addUser` returns error when `branchId` missing for POS roles
    - Test proxy redirect logic for each of the three POS roles and for non-POS roles
    - _Requirements: 17.4, 17.5, 8.2, 8.3_

- [x] 3. Checkpoint — Foundation and auth ready
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Core server actions — `src/app/actions/pos.ts` (read + table management)
  - [x] 4.1 Implement `computePosEodData(orders: PosOrder[]): PosEodData` pure function
    - Filter to `paid` orders for revenue aggregates, `voided` orders for void count only
    - Compute all 13 fields: `dineInCash`, `dineInUpi`, `takeawayCash`, `takeawayUpi`, `totalBillAmount`, `billCount`, `dineInCovers`, `takeawayOrders`, `cashCollectedAsBilled`, `upiCollectedAsBilled`, `voids`, `discounts`, `gstCollected`
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 4.2 Implement `getTodayPosData(branchId: string)` server action
    - Authorize (any authenticated, non-posRole session), scope branch, compute `todayIST`
    - Read and filter tables (active, branch-scoped, sorted A→Z), today's orders, today's KOTs
    - Build branch menu catalog: active items from `menu.json` filtered by `branch_menu_items`, compute `Effective_Price` per item and variant
    - Return `{ tables, orders, kots, catalog, todayIST }` — no mutation, no audit
    - _Requirements: 1.7, 2.4, 2.7, 11.1_

  - [x] 4.3 Implement `createTable`, `renameTable`, `deactivateTable` server actions
    - `createTable`: authorize (`isGlobalAdmin || role==='manager'`), Zod name(1–50), `requireBranchAccess`, 50-table limit guard, duplicate-name guard (case-insensitive), push new `PosTable` with `id: 'ptbl_'+uuid`, `revalidatePath`
    - `renameTable`: same auth, duplicate-name guard excluding current table, mutate name+updatedAt
    - `deactivateTable`: check no `open` order references this tableId before soft-deleting (`isActive: false`, `deletedAt`)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [x] 4.4 Write unit tests for `getTodayPosData`, `createTable`, `renameTable`, `deactivateTable`
    - Mock `readJSON`/`withTransaction`, `getSession`, `requireBranchAccess`
    - Cover: success path, role-denied, branch-denied, 50-table limit, duplicate name, deactivate-with-open-order guard
    - Test catalog assembly: items with no branch override row default to `isAvailable: true`; items with `isAvailable: false` override are excluded
    - _Requirements: 1.1–1.7, 2.7_

- [x] 5. Core server actions — order lifecycle
  - [x] 5.1 Implement `createOrder` server action
    - Authorize (`canCreateOrder(role)`), Zod validate `orderType`, `covers` (1–30), `branchId`
    - Cross-field: dine-in requires `tableId`; takeaway must not have `tableId`
    - Inside `withTransaction(POS_ORDERS)`: occupied-table guard (existing open order on same tableId), compute `takeawayNumber` as `'T-' + (todayNonVoidedTakeaways.length + 1)`
    - Push new `PosOrder` with embedded `items: []`, `kotCount: 0`, `status: 'open'`, `openedBy: session.userId`
    - `logAction('CREATE_POS_ORDER', ...)`, `revalidatePath`
    - _Requirements: 2.1, 2.2, 2.3, 2.8, 12.1, 12.2_

  - [x] 5.2 Implement `addOrUpdateOrderItem`, `removeOrderItem`, `updateOrderNote` server actions
    - `addOrUpdateOrderItem`: `canCreateOrder(role)` + waiter-own-order check; Zod `quantity` int(1–99) (absolute), `unitPrice` int≥0, `note` max(80); upsert by `menuItemId`+`variantId` — set `quantity` directly, never zero (use `removeOrderItem` for deletion); `unitPrice` is immutable on existing items
    - `removeOrderItem`: find by `orderItemId`, splice from `order.items`; waiter-own-order check; `status === 'open'` guard
    - `updateOrderNote`: `note` max(200), `status === 'open'` guard, waiter-own-order check
    - _Requirements: 2.4, 2.5, 2.6, 2.9, 2.10_

  - [x] 5.3 Implement `fireKot` server action
    - `canFireKot(role)` + waiter-own-order check; verify `order.status === 'open'` and `order.items.length > 0`
    - Load `priorKots` for this order; compute delta per item: `currentQty − sum of prior KOT quantities for same menuItemId+variantId`; include only items where delta > 0
    - If delta is empty → `{ error: 'No new items to send to kitchen' }`
    - Derive `newKotNumber = priorKots.length + 1` (authoritative — not from `order.kotCount`)
    - `withTransaction(POS_KOTS)`: push new `PosKot` with `status: 'pending'`, `firedAt: now`, `items: kotItems`
    - `withTransaction(POS_ORDERS)`: set `order.kotCount = newKotNumber` (cache sync — warn but do not fail if this write fails)
    - `logAction('FIRE_KOT', ...)`, `revalidatePath`
    - _Requirements: 3.1, 3.2, 3.3, 3.6, 12.1, 12.2_

  - [x] 5.4 Write unit tests for `createOrder`, `addOrUpdateOrderItem`, `removeOrderItem`, `updateOrderNote`, `fireKot`
    - Cover: success paths, waiter-own-order guard, occupied-table guard, takeaway number generation, KOT delta (0 prior KOTs, partial, full), empty-delta rejection, `unitPrice` immutability
    - Test Req 2.6 race case: `removeOrderItem` called on an order whose status changed away from `open` after the action was initiated while `open` — removal is allowed to complete
    - _Requirements: 2.1–2.10, 3.1–3.6_

  - [x] 5.5 Write unit tests for KOT history read path (Req 3.7)
    - In `getTodayPosData`, assert that the returned `kots` array includes all KOTs for today's orders (all statuses, not just active ones), so the Order Panel can display prior KOTs
    - Test that `getKitchenKots` correctly excludes `served` KOTs from the active list while the KOT Panel in `getTodayPosData` includes them for the waiter/manager order panel view
    - _Requirements: 3.7_

- [x] 6. Core server actions — billing, payment, and KOT status
  - [x] 6.1 Implement `generateBill` server action
    - `canGenerateBill(role)`; Zod `discount` int≥0, `gst` int≥0; `requireBranchAccess`
    - Guards inside `withTransaction(POS_ORDERS)`: `status === 'billed'` → return existing bill (no-op), `status !== 'open'` → notOpen, `items.length === 0` → noItems, `discount > subtotal` → discountExceedsSubtotal
    - Zero-bill confirmation: if `totalPayable === 0` and `confirmed !== 'true'` → set `zeroBillUnconfirmed`, return orders without mutation; if `confirmed === 'true'`, proceed
    - Compute `subtotal = Σ(qty × unitPrice)`, `totalPayable = subtotal − discount + gst`; set `order.bill`, transition to `status: 'billed'`
    - `logAction('GENERATE_BILL', ...)`, `revalidatePath`
    - _Requirements: 4.1, 4.2, 4.3, 4.5, 4.6, 4.7, 4.8, 4.10, 13.3, 12.1_

  - [x] 6.2 Implement `reopenOrder` server action
    - Authorize: `isGlobalAdmin || role==='manager'`; `requireBranchAccess`
    - Guards: `status === 'paid'` → explicit error `'A paid order cannot be reopened'`; `status !== 'billed'` → wrongStatus
    - Clear `order.bill`, set `status: 'open'`; `logAction('REOPEN_POS_ORDER', ...)`, `revalidatePath`
    - _Requirements: 4.4, 4.11, 12.1_

  - [x] 6.3 Implement `recordPayment` server action
    - `canRecordPayment(role)`; Zod `method` enum, `cashAmount` int≥0, `upiAmount` int≥0, `cashTendered` int≥0 (display only — never stored)
    - Enforce method-amount consistency: `cash` → set `cashAmount = totalPayable, upiAmount = 0`; `upi` → reverse; `split` → use provided values
    - Mismatch guard: `cashAmount + upiAmount !== totalPayable` → error; `totalPayable > 0 && both === 0` → error
    - Set `order.payment`, transition `status: 'paid'`; compute `changeDue = cashTendered − cashAmount` (return to client, not stored)
    - `logAction('RECORD_PAYMENT', ...)`, `revalidatePath`
    - Return `{ success: true, changeDue }`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.7, 12.1_

  - [x] 6.4 Implement `voidOrder` server action
    - Authorize: `getSession()` only (role-check is inside the transaction based on order status)
    - Zod `reason` min(1) max(200); `requireBranchAccess`
    - For `status === 'paid'`: require `isGlobalAdmin`; check `orderPayDate === todayIST` (cross-day guard); for `status === 'open'`: require role in `['manager','owner','admin']`; `status === 'billed'` → wrongStatus error
    - Set `order.void`, transition `status: 'voided'`; `logAction('VOID_POS_ORDER', ...)`, `revalidatePath`
    - _Requirements: 5.5, 5.6, 5.8, 10.2, 12.1_

  - [x] 6.5 Implement `advanceKotStatus` server action
    - `canAdvanceKot(role)` (allows `kitchen` role); `requireBranchAccess`
    - `KOT_SEQUENCE = ['pending','preparing','ready','served']`; find next index; `currentIdx === length-1` → `'KOT is already served'`; invalid index → `'Invalid KOT status transition'`
    - Mutate `kot.status`, `kot.updatedAt`; `revalidatePath`
    - _Requirements: 3.4, 3.5, 15.4_

  - [x] 6.6 Write unit tests for `generateBill`, `reopenOrder`, `recordPayment`, `voidOrder`, `advanceKotStatus`
    - Cover: success paths, zero-bill two-step confirmation, discount-exceeds-subtotal, reopening paid order, split-payment balance mismatch, cross-day void rejection, KOT terminal-state advancement
    - Test audit log shape: for each loggable action (`CREATE_POS_ORDER`, `FIRE_KOT`, `GENERATE_BILL`, `RECORD_PAYMENT`, `VOID_POS_ORDER`, `REOPEN_POS_ORDER`), assert `logAction` is called with the correct action type, orderId, branchId, and a JSON-parseable summary string (Req 12.1, 12.2)
    - Test that read-only actions (`getTodayPosData`, `getKitchenKots`, `getPosOrderHistory`, `getDailySummary`, `getPosDataForEOD`) do NOT call `logAction` under any path (Req 12.3)
    - Test `billing` role calling `createOrder` → `{ error: 'Forbidden' }` (Req 8.6)
    - Test `kitchen` role calling `generateBill` → `{ error: 'Forbidden' }` (Req 8.7)
    - Test `billing` role calling `voidOrder` on a stale `open` order → `{ error: 'Forbidden' }` (Req 8.9)
    - Test `kitchen` role calling `voidOrder` on a stale `open` order → `{ error: 'Forbidden' }` (Req 8.9)
    - Test GST pre-suggestion: given `subtotal` and `posDefaultGstPercent`, the suggested GST equals `Math.round(subtotal * posDefaultGstPercent / 100)` and is always a non-negative integer (Req 4.10, 13.3)
    - _Requirements: 4.1–4.11, 5.1–5.8, 3.4–3.5, 12.1, 12.2, 12.3, 8.6, 8.7, 8.9, 4.10, 13.3_

- [x] 7. Core server actions — read actions and EOD helper
  - [x] 7.1 Implement `getKitchenKots(branchId: string)` server action
    - `canAdvanceKot(role) || isGlobalAdmin`; `requireBranchAccess`
    - Load today's orders for branch; load KOTs for those orders where `status` in `['pending','preparing','ready']`, sorted by `firedAt` ascending (FIFO)
    - Resolve order identifiers (table name or `takeawayNumber`) from the order map; strip all financial data before returning
    - No audit (read-only)
    - _Requirements: 15.2, 15.3, 15.6_

  - [x] 7.2 Implement `getPosOrderHistory(branchId, fromDate, toDate)` server action
    - `canViewHistory(role)` (owner/admin only); validate date range format and `fromDate ≤ toDate`
    - Branch enforcement: `isGlobalAdmin` → use requested branchId; manager → use `session.branchId`, return `BranchAccessDenied` if mismatch (without revealing data existence)
    - Compute summary row: `totalRevenue`, `billCount`, `avgOrderValue`, `totalVoids`, `totalDiscounts`
    - Return `{ orders, summary }` — no audit
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.6_

  - [x] 7.3 Implement `getDailySummary(branchId, date)` server action
    - Forbid `posRole` accounts and `readonly` role; `requireBranchAccess`
    - Filter today's orders; call `computePosEodData` and extend with `totalCash`, `totalUpi`, `dineInBillCount`, `takeawayBillCount`
    - No audit
    - _Requirements: 11.1, 11.3_

  - [x] 7.4 Implement `getPosDataForEOD(date, branchId)` server action
    - Authenticate, validate date format, `requireBranchAccess`; filter orders; return `{ data: computePosEodData(orders) }` — raw orders never returned to client
    - No audit
    - _Requirements: 6.1, 6.2, 6.3, 6.7_

  - [x] 7.5 Write unit tests for `getKitchenKots`, `getPosOrderHistory`, `getDailySummary`, `getPosDataForEOD`, `computePosEodData`
    - Cover: `computePosEodData` with all status combinations and empty array; history date-range filter; manager cross-branch history denial; kitchen KOT FIFO ordering; financial data stripped from kitchen response; `getPosDataForEOD` returns `PosEodData` shape
    - Test `getPosOrderHistory`: when called without both `fromDate` and `toDate` and `branchId`, the action returns a validation error (Req 7.2 — display obligation only fires when both date range and branch are explicitly provided)
    - _Requirements: 6.1–6.7, 7.1–7.6, 11.1, 11.3, 15.6, 7.2_

- [x] 8. Checkpoint — all server actions complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Config extension, Navigation, and Settings integration
  - [x] 9.1 Extend `Config` type and add `updatePosGstRate` action in `src/app/actions/config.ts`
    - Add `pos: boolean` and `posDefaultGstPercent?: number` (0–28) to the `Config` type
    - Implement `updatePosGstRate(prevState, formData)`: `isRootAdmin` guard; Zod `z.number().int().min(0).max(28)`; mutate `config.json[0].posDefaultGstPercent`; `revalidatePath('/management/settings')`
    - _Requirements: 13.1, 13.2, 9.4_

  - [x] 9.2 Add POS entry to Navigation (`src/components/Navigation.tsx`)
    - Import `ShoppingCart` from `lucide-react`; add `{ name: 'POS', href: '/management/pos', icon: ShoppingCart }` to `navItems`
    - Render guard: skip this item when `config?.pos === false || isReadOnly || session?.posRole`
    - _Requirements: 9.2, 9.3_

  - [x] 9.3 Add POS controls to `SettingsClientPage.tsx` and Settings `page.tsx`
    - Add `{ id: 'pos', name: 'POS / Billing', description: 'Real-time order taking, KOT, and billing.', type: 'Optional' }` to the modules array (uses existing `toggleModule` action)
    - Render a numeric input (0–28) for `posDefaultGstPercent` under the POS toggle row, wired to `updatePosGstRate`
    - Pass `posDefaultGstPercent` from `config` to the client component via the page server loader
    - _Requirements: 9.4, 13.1, 13.2_

  - [x] 9.4 Add `billing`, `kitchen`, `waiter` role options to the User Management form in `SettingsClientPage.tsx`
    - Extend the role `<select>` to include the three new roles; show the branch selector as required when any of these roles is selected
    - Ensure the branch selector is already mandatory for `manager` (existing behavior) and extend the same requirement to the three new roles
    - _Requirements: 17.1, 17.2, 17.3_

  - [x] 9.7 Test user deactivation for POS roles
    - Extend the `deleteUser` unit test in `test/unit/actions/users.test.ts` (or create it): assert that `admin` and `owner` can soft-delete a `billing`, `kitchen`, or `waiter` user account (sets `isActive: false`, `deletedAt`); assert that `manager` role calling `deleteUser` on a POS-role account is rejected (uses existing `isGlobalAdmin` guard)
    - _Requirements: 17.6_

  - [x] 9.5 Write unit tests for `updatePosGstRate` and Navigation render guards
    - Test `updatePosGstRate`: admin-only, Zod range (0–28 valid, -1 and 29 invalid), successful write
    - Test Navigation: POS link hidden when `pos === false`, when `isReadOnly`, when `posRole === true`
    - _Requirements: 13.1, 13.2, 9.2, 9.3_

  - [x] 9.6 Extend `src/proxy.ts` to redirect all `/management/pos/*` sub-routes when `config.pos === false`
    - Currently page-level redirects handle `config.pos === false`, but the proxy should also intercept direct URL access to `/management/pos/billing`, `/management/pos/kitchen`, `/management/pos/order`, `/management/pos/history` when POS is disabled, redirecting to `/management`
    - This prevents bypassing the page-level guard via direct navigation when the module is toggled off
    - _Requirements: 9.2_

- [x] 10. POS Pages — server loaders and client components
  - [x] 10.1 Implement Main POS Dashboard: `src/app/management/pos/page.tsx` + `PosClientPage.tsx`
    - `page.tsx`: authorize (`manager`, `owner`, `admin`); redirect `posRole` users to their designated page; redirect if `config.pos === false`; `requireBranchAccess`; call `getTodayPosData`; render `<PosClientPage>`
    - `PosClientPage.tsx` panels:
      - **Table_Grid**: all branch tables, available/occupied derived from open orders, A→Z sorted; Takeaway button
      - **Order Panel**: OrderItems list, quantity controls (`addOrUpdateOrderItem`/`removeOrderItem`), item-note field, order-note field (`updateOrderNote`), Fire KOT button (`fireKot`), Generate Bill button (`generateBill`)
      - **KOT Panel**: all KOTs for the active order; status chips; `advanceKotStatus` button per KOT
      - **Bill Panel**: subtotal/discount/GST inputs (GST pre-suggested from `posDefaultGstPercent`), payment method, cash tendered, change-due display, confirm payment (`recordPayment`); zero-bill confirmation modal
      - **Daily Summary**: collapsible card showing today's aggregates from `getDailySummary`; "View History" link visible only to `isGlobalAdmin`; Assert via integration test (14.1) that after `recordPayment` succeeds, the daily summary card refreshes to reflect the new paid total (`revalidatePath` triggers server re-render) (Req 11.2)
      - **Stale Order Banner**: dismissible banner (React `useState`) listing open orders from prior dates; inline Void button per stale order
    - _Requirements: 1.7, 2.1–2.10, 3.1–3.7, 4.1–4.11, 5.1–5.8, 10.1–10.3, 11.1–11.3_

  - [x] 10.2 Implement Waiter Order Page: `src/app/management/pos/order/page.tsx` + `WaiterOrderClientPage.tsx`
    - `page.tsx`: authorize (`waiter`, `manager`, `owner`, `admin`); redirect if `config.pos === false`; load tables and today's own orders (filter by `openedBy === session.userId` for `waiter` role); render without sidebar when `session.posRole`
    - `WaiterOrderClientPage.tsx`:
      - Table_Grid: all active branch tables; highlight own open orders (amber); occupied-by-other tables shown as occupied but not clickable
      - Order Panel (own orders only): items, quantity controls, item-note, order-note, Fire KOT button; **no bill/payment buttons**
      - KOT Panel: KOTs for own orders, status chip only (no advance button)
      - No billing, no payment, no daily summary, no void controls
      - Menu items displayed to waiter show item name, price, and dietary tags (from `CatalogItem.dietary`); **cost price is never shown** to waiter role (Req 16.8)
    - Test Req 10.3: verify a waiter can create a new order on an available table while the stale-order banner is visible (banner does not block order creation)
    - _Requirements: 16.1–16.8, 8.5, 10.3_

  - [x] 10.3 Implement Billing Page: `src/app/management/pos/billing/page.tsx` + `BillingClientPage.tsx`
    - `page.tsx`: authorize (`billing`, `manager`, `owner`, `admin`); redirect if `config.pos === false`; load today's `billed` and `paid` orders for the branch; load branch catalog; render without sidebar when `session.posRole`
    - `BillingClientPage.tsx`:
      - Billed Orders Queue: `billed` orders sorted oldest-first; card shows table/takeaway, item count, total payable, time-since-billed; click opens payment flow
      - Payment Panel: bill details, payment method, cash tendered, change-due, confirm (`recordPayment`)
      - Bill generation for open orders: secondary input to bill an unbilled order (`generateBill`)
      - Paid Orders (read-only section): today's paid orders
      - Running Totals strip: total cash + total UPI collected today; updated via `revalidatePath`
      - No Table_Grid, no item editing, no KOT panel, no void, no daily summary
    - _Requirements: 14.1–14.8, 8.6_

  - [x] 10.4 Implement Kitchen KOT Page: `src/app/management/pos/kitchen/page.tsx` + `KitchenClientPage.tsx`
    - `page.tsx`: authorize (`kitchen`, `manager`, `owner`, `admin`); redirect if `config.pos === false`; load active KOTs (status `pending`/`preparing`/`ready`) for today sorted by `firedAt` asc; load order map for identifiers; render without sidebar when `session.posRole`
    - `KitchenClientPage.tsx`:
      - KOT Card Grid: one card per active KOT; shows KOT number, Order identifier (table name or T-N), time-since-fired, status chip (pending=orange, preparing=yellow, ready=green), items with name + quantity + italic note
      - Single prominent advance-status button per card: "Start Preparing" / "Mark Ready" / "Mark Served" (`advanceKotStatus`)
      - Served section: collapsible section for today's served KOTs
        - When `advanceKotStatus` succeeds with new status `served`, the KOT card is moved from the active grid to the Served section immediately (optimistic update or re-fetch after success)
      - Client-side polling: call `getKitchenKots(branchId)` every 30 seconds via `setInterval`
        - Polling uses `setInterval(fetchFn, 30000)` set up in `useEffect` with cleanup on unmount
      - **No financial data** anywhere on this page
    - _Requirements: 15.1–15.8, 8.7_

  - [x] 10.5 Implement Order History page: `src/app/management/pos/history/page.tsx` + `PosHistoryClientPage.tsx`
    - `page.tsx`: authorize (`owner`, `admin`); redirect `readonly` and other roles to `/management`; pass branches list for the selector
    - `PosHistoryClientPage.tsx`:
      - Date-range picker + branch selector (managers scoped to their branch — though only owner/admin can access)
      - Submit calls `getPosOrderHistory(branchId, fromDate, toDate)`
      - Order list with summary row at top (total revenue, bill count, avg order value, void count, total discounts)
      - Click on order row expands full item/bill/payment breakdown
      - Empty-state message when no orders match
    - _Requirements: 7.1–7.6, 8.1_

  - [x] 10.6 Write unit/component tests for Billing Page and Kitchen Page behaviour
    - Billing page running totals: assert the cash+UPI totals strip recomputes correctly after each `recordPayment` call (mock `getDailySummary` return); verify the strip shows 0 when no payments recorded today (Req 14.8)
    - Billing role generates bill for open order: verify `generateBill` is called correctly from `BillingClientPage` when the clerk uses the "Bill an open order" input; verify the billed order appears in the Billed Orders Queue (Req 14.5)
    - Kitchen served section: verify that after `advanceKotStatus` returns `served`, the card disappears from the active grid and appears in the Served collapsible section (Req 15.5)
    - _Requirements: 14.5, 14.8, 15.5_

- [x] 11. EOD integration
  - [x] 11.1 Extend `src/app/management/eod/page.tsx` with initial POS pre-fill
    - Import `computePosEodData` and `PosOrder` from `@/app/actions/pos` (or `posTypes`)
    - After loading config: if `config.pos === true` and `defaultBranchId` is set, filter today's `pos_orders.json` for the branch and call `computePosEodData`; pass result as `posEodData: PosEodData | null` prop to `EODClientPage`
    - _Requirements: 6.1, 6.5, 6.6_

  - [x] 11.2 Extend `EODClientPage.tsx` to consume POS pre-fill data
    - Accept `posEodData: PosEodData | null` prop
    - On mount (and whenever `posEodData` changes): pre-fill income fields (`dineInCash`, `dineInUpi`, `takeawayCash`, `takeawayUpi`) and billing section fields (`totalBillAmount`, `billCount`, `dineInCovers`, `takeawayOrders`, `voids`, `discounts`, `cashCollectedAsBilled`, `upiCollectedAsBilled`, `gstCollected`)
    - When the user changes the date or branch selector: call `getPosDataForEOD(date, branchId)` server action and update the pre-filled fields from the returned `PosEodData`
    - Show non-blocking notice when `posEodData` is null or `billCount === 0`
    - The EOD save action remains unchanged — it persists whatever the user submits
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

  - [x] 11.3 Write unit tests for EOD pre-fill logic
    - Test that `computePosEodData` called from EOD page produces correct field values for a mixed-status order array
    - Test that `getPosDataForEOD` returns `PosEodData` shape (not raw orders)
    - Test zero-orders case returns all-zero `PosEodData`
    - _Requirements: 6.1–6.7_

- [x] 12. Checkpoint — all pages and integrations wired
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Property-based tests (`test/unit/lib/posProperties.test.ts`)
  - [x] 13.1 Implement Property 1 — Bill arithmetic invariants (fast-check)
    - Generate arbitrary `OrderItem[]` arrays + `discount` + `gst`; assert `subtotal = Σ(qty × unitPrice)`, `totalPayable = subtotal − discount + gst`, `0 ≤ discount ≤ subtotal`, `gst ≥ 0`
    - Annotate: `// Feature: pos-billing-kot, Property 1: Bill arithmetic invariants`
    - **Validates: Requirements 4.1, 4.5**

  - [x] 13.2 Implement Property 2 — Payment balance invariant (fast-check)
    - Generate paid `PosOrder` objects with consistent payment; assert `payment.cashAmount + payment.upiAmount === bill.totalPayable`
    - **Validates: Requirements 5.1, 5.2, 5.3**

  - [x] 13.3 Implement Property 3 — KOT delta correctness (fast-check)
    - Generate order item states and prior KOT sequences; assert `delta qty = currentQty − Σ(priorKotQty)` for each item, and only positive-delta items appear in the new KOT
    - **Validates: Requirements 3.1**

  - [x] 13.4 Implement Property 4 — KOT sequential numbering (fast-check)
    - Generate n sequential `fireKot` calls on a single order; assert resulting `kotNumber` values are exactly `[1, 2, …, n]` with no gaps and no repeats
    - **Validates: Requirements 3.2**

  - [x] 13.5 Implement Property 5 — Branch isolation for managers (fast-check)
    - Generate manager sessions with arbitrary `branchId` arguments to `getTodayPosData`/`getPosOrderHistory`; assert all returned tables/orders have `branchId === session.branchId`
    - **Validates: Requirements 1.2, 7.4, 8.5**

  - [x] 13.6 Implement Property 6 — Order status machine safety: no paid→open transition (fast-check)
    - Generate `PosOrder` objects with `status === 'paid'`; assert `reopenOrder` always returns `{ error: 'A paid order cannot be reopened' }` and order status remains `'paid'`
    - **Validates: Requirements 4.4, 4.11, 8.6**

  - [x] 13.7 Implement Property 7 — Takeaway number uniqueness (fast-check)
    - Generate sequences of takeaway order creation for the same branch+date; assert no two non-voided orders share the same `takeawayNumber`
    - **Validates: Requirements 2.8**

  - [x] 13.8 Implement Property 8 — OrderItem unit price immutability (fast-check)
    - Generate `PosOrder` with initial `unitPrice` values; simulate `addOrUpdateOrderItem` calls (quantity/note changes); assert `unitPrice` on existing items is never changed
    - **Validates: Requirements 2.5**

  - [x] 13.9 Implement Property 9 — EOD aggregate correctness (fast-check)
    - Generate mixed-status `PosOrder` collections; assert `computePosEodData` includes only `paid` orders in revenue totals, only `voided` orders in `voids` count, and all 13 output fields are non-negative integers
    - **Validates: Requirements 6.1, 6.2, 6.3**

  - [x] 13.10 Implement Property 10 — Table name uniqueness invariant (fast-check)
    - Generate sequences of `createTable`/`renameTable` calls; assert no two active tables in the same branch share the same name (case-insensitive)
    - **Validates: Requirements 1.5**

  - [x] 13.11 Implement Property 11 — GST suggestion arithmetic (fast-check)
    - Generate arbitrary `subtotal ≥ 0` and `posDefaultGstPercent` in `[0, 28]`; assert suggested GST = `Math.round(subtotal * rate / 100)` is always a non-negative integer
    - **Validates: Requirements 13.3, 4.10**

  - [x] 13.12 Implement Property 12 — Waiter order ownership isolation (fast-check)
    - Generate `PosOrder` objects where `openedBy !== session.userId` with `session.role === 'waiter'`; assert all of `addOrUpdateOrderItem`, `removeOrderItem`, `updateOrderNote`, `fireKot` return `{ error: 'Forbidden: waiters can only edit their own orders' }` and the order is unchanged
    - **Validates: Requirements 8.5, 16.5**

- [x] 14. Integration tests (`test/integration/pos.spec.ts`)
  - [x] 14.1 Full order-to-payment flow
    - Create order → add items → fire KOT → generate bill → record payment → verify table available; open EOD form and verify income fields pre-filled
    - _Requirements: 2.1–2.10, 3.1–3.3, 4.1–4.2, 5.1–5.4, 6.1–6.3_

  - [x] 14.2 Manager branch isolation
    - Seed orders for branch A; log in as manager of branch B; verify Tables API and order reads return only branch B data
    - _Requirements: 1.2, 8.10, 8.11_

  - [x] 14.3 Module toggle (POS enable/disable)
    - Disable POS in settings; verify nav link disappears and direct URL redirects to dashboard; re-enable and verify link reappears
    - _Requirements: 9.1, 9.2, 9.3_

  - [x] 14.4 Stale order banner
    - Seed an `open` order with `date` set to a prior IST date; load POS; verify stale-order banner appears; void the stale order and verify banner clears
    - _Requirements: 10.1, 10.2, 10.3_

  - [x] 14.5 Waiter role isolation
    - Waiter A creates an order; waiter B attempts `addOrUpdateOrderItem` and `fireKot` on that order; assert both return Forbidden; waiter A's session succeeds on the same actions
    - _Requirements: 8.5, 16.5_

  - [x] 14.6 POS role page-lock via proxy
    - Log in as `billing` role; attempt to navigate to `/management`, `/management/pos`, `/management/pos/kitchen`; assert all redirect to `/management/pos/billing`; repeat for `kitchen` and `waiter` roles
    - _Requirements: 8.2, 8.3, 17.5_

  - [x] 14.7 Billing clerk generate-and-pay flow
    - Log in as `billing` role; verify page shows billed orders queue; select a billed order; record split payment; verify order transitions to `paid` and running totals update; verify table is now available
    - _Requirements: 14.1–14.8_

  - [x] 14.8 Kitchen KOT display and polling
    - Fire two KOTs for a branch; log in as `kitchen` role; verify both KOTs appear in FIFO order; advance first KOT to `preparing`; verify no financial data is visible; verify polling brings in new KOTs within 30 seconds
    - _Requirements: 15.2–15.6, 15.8_

  - [x] 14.9 Void same-day paid order and EOD impact
    - Record a paid order; void it (owner role, same IST date); verify `Order_Status === 'voided'`; open EOD form and verify that voided order is excluded from revenue totals and appears in `voids` count
    - _Requirements: 5.5, 5.6, 6.3_

  - [x] 14.10 Cross-day void rejection
    - Seed a paid order with `paidAt` on a prior IST date; attempt to void it (owner role); assert error `'Order can only be voided on the day it was paid'`
    - _Requirements: 5.8_

- [x] 16. Lint, test coverage, and documentation
  - [x] 16.1 Run full lint pass and fix all issues
    - Run `npm run lint` across the entire changed file set; fix all ESLint errors and warnings introduced by the POS implementation; ensure no `any` types leak in server actions or client components (TypeScript strict mode)
    - _Tech Steering: `npm run lint` required before marking feature done_

  - [x] 16.2 Verify and enforce test coverage thresholds
    - Run `npm run test:coverage`; confirm backend coverage for all files in `src/app/actions/pos.ts`, `src/lib/posUtils.ts`, and `computePosEodData` meets the ≥90% threshold specified in `vitest.config.ts`; add missing unit tests for any uncovered branch or edge case identified by the coverage report
    - _Tech Steering: backend ≥90% coverage threshold_

  - [x] 16.3 Update `/Documentations` folder to reflect POS feature
    - Update `Documentations/Technical/DOC-03-database-schema.md` to document the three new collections: `pos_tables.json`, `pos_orders.json`, `pos_kots.json` with all field shapes
    - Update the module-map document to include the five new POS routes with their role access matrix
    - Update the product/module docs to describe the `billing`, `kitchen`, and `waiter` roles and their designated pages
    - Verify that `Documentations` does not contradict the final implementation (code wins on disagreement)
    - _Tech Steering: /Documentations kept in sync with code_

- [x] 17. Final checkpoint — full test suite green
  - Run `npm run test`, `npm run test:coverage`, and `npm run lint`. All unit, property-based, and integration tests must pass. Coverage thresholds must be met. No lint errors. Documentation must be up to date. Ask the user if any questions arise before marking the feature complete.


## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP pass; core implementation tasks are never marked optional.
- The design uses TypeScript throughout; no language selection prompt is required.
- `computePosEodData` is a pure function (no `'use server'`); it can be imported directly by `eod/page.tsx` (server component) without calling it as an action.
- Table occupancy is derived (no flag on `PosTable`) — a table is `occupied` when any `PosOrder` with `status === 'open'` references its `tableId` for today's IST date.
- `kotNumber` source of truth is `priorKots.length + 1`, not `order.kotCount`. The `kotCount` field is a cache that is self-healed on every `fireKot`.
- `cashTendered` is validated but never persisted; `changeDue` is returned in the `recordPayment` success payload and displayed on the client only.
- The `billing` role can generate a bill for an `open` order (Req 14.5) — the `generateBill` action already allows `billing` via `canGenerateBill`.
- Each property-based test file must tag every `it` block with its property number and feature name for traceability.
- Playwright integration tests should use a test-specific Neon branch or the local `.netlify/db` instance; never run against production.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "1.4"] },
    { "id": 2, "tasks": ["1.5", "2.1", "2.2"] },
    { "id": 3, "tasks": ["2.3", "2.4"] },
    { "id": 4, "tasks": ["2.5", "4.1"] },
    { "id": 5, "tasks": ["4.2", "4.3"] },
    { "id": 6, "tasks": ["4.4", "5.1"] },
    { "id": 7, "tasks": ["5.2", "5.3"] },
    { "id": 8, "tasks": ["3", "5.4", "5.5", "6.1", "6.2"] },
    { "id": 9, "tasks": ["6.3", "6.4", "6.5"] },
    { "id": 10, "tasks": ["6.6", "7.1", "7.2", "7.3", "7.4"] },
    { "id": 11, "tasks": ["7.5", "9.1"] },
    { "id": 12, "tasks": ["8", "9.2", "9.3", "9.4", "9.5", "9.6", "9.7"] },
    { "id": 13, "tasks": ["10.1", "10.2", "10.3", "10.4", "10.5"] },
    { "id": 14, "tasks": ["10.6", "11.1"] },
    { "id": 15, "tasks": ["11.2"] },
    { "id": 16, "tasks": ["12", "11.3", "13.1", "13.2", "13.3", "13.4", "13.5", "13.6", "13.7", "13.8", "13.9", "13.10", "13.11", "13.12"] },
    { "id": 17, "tasks": ["14.1", "14.2", "14.3", "14.4", "14.5", "14.6", "14.7", "14.8", "14.9", "14.10"] },
    { "id": 18, "tasks": ["16.1", "16.2", "16.3"] },
    { "id": 19, "tasks": ["17"] }
  ]
}
```

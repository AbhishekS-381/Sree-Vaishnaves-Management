# Design Document — POS / Billing / KOT

## Overview

The POS / Billing / KOT feature adds a Point-of-Sale module to the Sree Vaishnaves management portal. It is structured as **four dedicated pages** accessed by distinct role types, plus an order history view for owners and admins:

| Route | Purpose | Who uses it |
|---|---|---|
| `/management/pos` | Main POS Dashboard — Table Grid, order panel, KOT panel, billing, daily summary | `manager`, `owner`, `admin` |
| `/management/pos/order` | Waiter Order Page — order taking, item entry, KOT fire | `waiter` (+ manager/owner/admin) |
| `/management/pos/billing` | Billing Page — payment collection, bill generation | `billing` (+ manager/owner/admin) |
| `/management/pos/kitchen` | Kitchen KOT Page — KOT display, status advancement | `kitchen` (+ manager/owner/admin) |
| `/management/pos/history` | Order History — audit, date-range reports | `owner`, `admin` only |

POS-dedicated roles (`billing`, `kitchen`, `waiter`) are branch-scoped portal accounts that log in and land directly on their single designated page — the management navigation sidebar is hidden from them entirely. A `posRole: true` flag in their JWT drives this enforcement.

**Core workflow:**
1. A manager or counter staff selects a table (or starts a takeaway) on the Table_Grid.
2. They add menu items to an open order, optionally with per-item notes.
3. They fire a KOT to the kitchen — only the delta since the last KOT is sent.
4. When the customer is ready to pay, a bill is generated (subtotal → discount → GST → total).
5. Payment is recorded (cash / UPI / split); the table returns to `available`.
6. The EOD form reads all paid orders for the day and pre-fills income, billing, and cash/UPI aggregates.

**Out of scope:** customer self-service, PDF printing, payment-gateway integration, GST tax-rule engine, delivery-aggregator integration.

---

## Architecture

### Architectural constraints

- **Next.js 16 App Router + React 19 + TypeScript 5 strict** — no REST API, no `/api` routes.
- All server logic lives in **Server Actions** (`src/app/actions/pos.ts`).
- Persistence is via the **JSON blob store** (`readJSON` / `writeJSON` / `withTransaction` in `src/lib/db.ts`).
- Authentication: `getSession()` and `requireBranchAccess()` from `src/app/actions/auth.ts`.
- Money is always **integer rupees** — no decimals.
- "Today" always uses **IST**: `new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })`.

### High-level module structure

```
src/
  app/
    actions/
      pos.ts                          # ALL POS server actions + computePosEodData helper
    management/
      pos/
        page.tsx                      # Main POS Dashboard — manager/owner/admin only
        PosClientPage.tsx             # client: Table_Grid, order panel, KOT panel, billing panel, daily summary
        order/
          page.tsx                    # Waiter Order Page — waiter + manager/owner/admin
          WaiterOrderClientPage.tsx   # client: Table_Grid (own orders highlighted), order item entry, KOT fire
        billing/
          page.tsx                    # Billing Page — billing + manager/owner/admin
          BillingClientPage.tsx       # client: billed orders queue, payment collection, running totals
        kitchen/
          page.tsx                    # Kitchen KOT Page — kitchen + manager/owner/admin
          KitchenClientPage.tsx       # client: KOT cards (FIFO), status advance button, no financials
        history/
          page.tsx                    # Order History — owner/admin only
          PosHistoryClientPage.tsx    # client: date-range filter, order list, summary row
  components/
    Navigation.tsx                    # +POS nav entry (ShoppingCart icon); hidden for posRole users
  lib/
    db.ts                             # +POS_TABLES, POS_ORDERS, POS_KOTS in DB_FILES
  proxy.ts                            # UPDATED: posRole redirect logic added
db/
  seed-data.ts                        # config.json gains "pos": false
```

### Data flow

```
PosClientPage / WaiterOrderClientPage / BillingClientPage / KitchenClientPage (clients)
  └─ call Server Actions (pos.ts)
       ├─ reads/writes pos_tables.json     (tables)
       ├─ reads/writes pos_orders.json     (orders + embedded items/bill/payment/void)
       ├─ reads/writes pos_kots.json       (KOTs)
       └─ reads menu.json + branch_menu_items_<branchId>.json (catalog, read-only)

EODClientPage (client)
  └─ receives posEodData: PosEodData | null (pre-computed on server for today's date)
  └─ calls getPosDataForEOD(date, branchId) when user changes date/branch selector
       └─ returns PosEodData — no raw order data exposed to client
```

---

## Components and Interfaces

### JWT and Role Extension (`src/app/actions/auth.ts` + `src/app/actions/users.ts`)

#### New POS roles

Three new role strings are added to the system: `billing`, `kitchen`, `waiter`. They are stored in `users.json` exactly like `manager` — just a role string — and **always require a `branchId`**.

#### JWT payload extension

The `signToken` call in `auth.ts` gains a new boolean field `posRole`:

```typescript
const isPosRole = ['billing', 'kitchen', 'waiter'].includes(role)

const token = await signToken({
  userId: user.id || user.name,
  name: user.name,
  role,
  branchId: user.branchId,
  isGlobalOwner,
  isGlobalAdmin,
  isRootAdmin: isAdmin,
  posRole: isPosRole,   // NEW — true for billing/kitchen/waiter accounts
})
```

The `verifyToken` return type in `src/lib/jwt.ts` must include `posRole?: boolean`.

#### POS role capability helpers (pure functions, add to `src/lib/posUtils.ts` or top of `pos.ts`)

```typescript
export function canCreateOrder(role: string): boolean {
  return ['manager', 'owner', 'admin', 'waiter'].includes(role)
}
export function canFireKot(role: string): boolean {
  return ['manager', 'owner', 'admin', 'waiter'].includes(role)
}
export function canGenerateBill(role: string): boolean {
  return ['manager', 'owner', 'admin', 'billing'].includes(role)
}
export function canRecordPayment(role: string): boolean {
  return ['manager', 'owner', 'admin', 'billing'].includes(role)
}
export function canAdvanceKot(role: string): boolean {
  return ['manager', 'owner', 'admin', 'kitchen'].includes(role)
}
export function canVoidOrder(role: string, status: 'open' | 'paid'): boolean {
  if (status === 'paid') return ['owner', 'admin'].includes(role)
  return ['manager', 'owner', 'admin'].includes(role)  // not waiter/billing/kitchen
}
export function canViewHistory(role: string): boolean {
  return ['owner', 'admin'].includes(role)
}
export function isWaiterOwnOrder(role: string, openedBy: string, sessionUserId: string): boolean {
  if (role !== 'waiter') return true  // non-waiters can access any order
  return openedBy === sessionUserId
}
```

These helpers replace the inline `isGlobalAdmin || role==='manager'` checks in actions that now need to support the new roles.

#### `users.ts` update

In `addUser` and `updateUser`, extend `branchId` assignment from only `manager` to all branch-scoped roles:

```typescript
// Before:
branchId: role === 'manager' && branchId ? branchId : undefined,

// After:
branchId: ['manager', 'billing', 'kitchen', 'waiter'].includes(role) && branchId ? branchId : undefined,
```

Add validation: if role is `billing`, `kitchen`, or `waiter` and no `branchId` provided → return `{ error: 'Branch is required for this role' }`.

---

### Navigation (`src/components/Navigation.tsx`)

Add `ShoppingCart` to lucide-react imports. Add to `navItems`:

```typescript
{ name: 'POS', href: '/management/pos', icon: ShoppingCart }
```

Render guards in the nav loop:

```typescript
if (item.name === 'POS' && (config?.pos === false || isReadOnly || session?.posRole)) return null;
```

**POS-dedicated users (`posRole: true`) never see the navigation sidebar at all.** Their pages render without the `<Navigation>` component. The management `layout.tsx` must be updated to pass `session` and conditionally skip rendering `<Navigation>` when `session.posRole === true`:

```typescript
// In src/app/management/layout.tsx:
// After getSession():
if (session?.posRole) {
  // Render without sidebar — POS role sees only their designated page
  return <main className="h-screen w-full overflow-y-auto">{children}</main>
}
// Otherwise render normal layout with Navigation
```

### `src/proxy.ts` — POS role redirect enforcement

`src/proxy.ts` (the session gate for `/management/*`) must be extended to handle `posRole` accounts. Currently it gates access but does not redirect by role.

Add the following logic after session verification:

```typescript
// POS-dedicated role redirect enforcement
if (session?.posRole) {
  const ROLE_HOME: Record<string, string> = {
    billing: '/management/pos/billing',
    kitchen: '/management/pos/kitchen',
    waiter:  '/management/pos/order',
  }
  const home = ROLE_HOME[session.role]
  if (home && !pathname.startsWith(home) && pathname !== '/management/login') {
    return NextResponse.redirect(new URL(home, request.url))
  }
}
```

This enforces that `billing`, `kitchen`, and `waiter` accounts can only ever land on their designated page — any attempt to navigate to any other `/management/*` route is redirected to their home page. The `/management/login` and `/management/logout` routes remain accessible.

---

### `src/app/management/pos/page.tsx` (server component — Main POS Dashboard)

```typescript
// Authorization: manager, owner, admin only
// 1. getSession() → redirect to /management/login if no session
// 2. if session.posRole → redirect to their designated page (posRole users never land here)
// 3. if role not in ['manager','owner','admin'] → redirect('/management')
// 4. readJSON(DB_FILES.CONFIG) → if config.pos === false, redirect('/management')
// 5. requireBranchAccess(undefined) → enforcedBranchId
// 6. getTodayPosData(enforcedBranchId) for initial data
// 7. Render <PosClientPage initialData={...} session={...} config={config} />
```

### `src/app/management/pos/PosClientPage.tsx` (client component — Main POS Dashboard)

Full-capability manager view. Panels (unchanged from prior design):
- **Table_Grid** — all branch tables, available/occupied, A→Z sorted. Takeaway button in header.
- **Order Panel** — order items, quantity controls, item notes, order note, fire-KOT button, generate-bill button.
- **KOT Panel** — all KOTs for active order, status chips, `advanceKotStatus` button per KOT.
- **Bill Panel** — bill details, discount/GST inputs (GST pre-suggested from config), payment method, cash tendered, change-due display, confirm payment.
- **Daily Summary** — collapsible today's aggregates card.
- **Stale Order Banner** — dismissible, in-memory React state (`useState dismissed: boolean`), lists stale orders with inline Void button.
- **History Link** — "View History" button visible to `isGlobalAdmin` only, links to `/management/pos/history`.

---

### `src/app/management/pos/order/page.tsx` (server component — Waiter Order Page)

```typescript
// Authorization: waiter, manager, owner, admin
// 1. getSession() → redirect to /management/login if no session
// 2. if role not in ['waiter','manager','owner','admin'] → redirect to their own page or /management
// 3. readJSON(DB_FILES.CONFIG) → if config.pos === false, redirect('/management')
// 4. requireBranchAccess(undefined) → enforcedBranchId
// 5. getTodayPosData(enforcedBranchId) for tables, today's orders, catalog
//    — orders filtered by openedBy === session.userId for waiter role
// 6. Render <WaiterOrderClientPage initialData={...} session={...} />
//    — no Navigation sidebar when session.posRole === true
```

### `src/app/management/pos/order/WaiterOrderClientPage.tsx` (client component — Waiter Order Page)

Waiter-scoped view:
- **Table_Grid** — all branch tables shown; tables with a waiter's own open order are highlighted (amber). Tables occupied by another waiter's orders appear as occupied but not clickable by this waiter.
- **Order Panel** — visible only for orders owned by this waiter (`openedBy === session.userId`). Shows OrderItems, quantity controls, item notes, order note, fire-KOT button. NO bill generation button, NO payment section.
- **KOT Panel** — KOTs for this waiter's own active orders only. Status chip visible but no advance button (kitchen advances status).
- **No billing, no payment, no daily summary, no void controls.**
- Layout: full-page, no management sidebar when `session.posRole === true`.

Authorization guard in Server Actions:
- `createOrder` — `canCreateOrder(role)` allows `waiter`
- `addOrUpdateOrderItem`, `removeOrderItem`, `updateOrderNote` — allow `waiter` but add waiter-own-order check: `isWaiterOwnOrder(role, order.openedBy, session.userId)` must be true
- `fireKot` — `canFireKot(role)` allows `waiter`
- `generateBill`, `recordPayment`, `voidOrder`, `advanceKotStatus` — `waiter` role returns `{ error: 'Forbidden' }`

---

### `src/app/management/pos/billing/page.tsx` (server component — Billing Page)

```typescript
// Authorization: billing, manager, owner, admin
// 1. getSession() → redirect to /management/login if no session
// 2. if role not in ['billing','manager','owner','admin'] → redirect to their own page or /management
// 3. readJSON(DB_FILES.CONFIG) → if config.pos === false, redirect('/management')
// 4. requireBranchAccess(undefined) → enforcedBranchId
// 5. Load today's orders filtered to status 'billed' and 'paid' for the branch
//    — sorted by bill.generatedAt ascending (billed), then paidAt descending (paid)
// 6. Load branch menu catalog (for bill generation on open orders)
// 7. Render <BillingClientPage initialData={...} session={...} config={config} />
//    — no Navigation sidebar when session.posRole === true
```

### `src/app/management/pos/billing/BillingClientPage.tsx` (client component — Billing Page)

Billing-scoped view:
- **Billed Orders Queue** — list of `billed` orders for today's branch, sorted oldest-first. Each card shows: table name or takeaway number, order item count, total payable, time since billed. Clicking opens the payment flow.
- **Payment Panel** — Bill details (items, subtotal, discount, GST, total payable), payment method selector (cash/UPI/split), cash tendered input (for change-due), confirm payment button. Calls `recordPayment`.
- **Bill Generation for Open Orders** — a secondary "Bill an open order" input (order ID or table lookup) for billing clerks to bill an unbilled order if needed. Calls `generateBill`.
- **Paid Orders (read-only section)** — today's paid orders listed with time, amount, payment method.
- **Running Totals** — top strip showing total cash collected today + total UPI collected today for the branch. Updated on each `revalidatePath`.
- **No Table_Grid, no item editing, no KOT panel, no void controls, no daily summary.**
- Layout: full-page, no management sidebar when `session.posRole === true`.

Authorization guard in Server Actions:
- `generateBill` — update to allow `billing` role: `canGenerateBill(role)`
- `recordPayment` — update to allow `billing` role: `canRecordPayment(role)`
- All other mutations — `billing` role returns `{ error: 'Forbidden' }`

---

### `src/app/management/pos/kitchen/page.tsx` (server component — Kitchen KOT Page)

```typescript
// Authorization: kitchen, manager, owner, admin
// 1. getSession() → redirect to /management/login if no session
// 2. if role not in ['kitchen','manager','owner','admin'] → redirect to their own page or /management
// 3. readJSON(DB_FILES.CONFIG) → if config.pos === false, redirect('/management')
// 4. requireBranchAccess(undefined) → enforcedBranchId
// 5. Load today's KOTs for branch where status in ['pending','preparing','ready']
//    sorted by firedAt ascending (FIFO)
// 6. Load today's orders for branch (to resolve table name / takeaway number per KOT)
// 7. Render <KitchenClientPage initialKots={...} session={...} />
//    — no Navigation sidebar when session.posRole === true
```

### `src/app/management/pos/kitchen/KitchenClientPage.tsx` (client component — Kitchen KOT Page)

Kitchen-scoped view:
- **KOT Card Grid** — one card per active KOT (`pending`, `preparing`, `ready`), sorted by `firedAt` ascending.
  Each card shows: KOT number, Order identifier (table name or T-N for takeaway), time since fired, status chip (color-coded: pending=orange, preparing=yellow, ready=green), and for each item: item name, quantity, Item_Note in italic.
- **Advance Status Button** — single large prominent button per card: "Start Preparing" (pending→preparing), "Mark Ready" (preparing→ready), "Mark Served" (ready→served). Calls `advanceKotStatus`.
- **Served Section** — collapsible section showing today's served KOTs.
- **NO financial data** — no prices, subtotals, discounts, GST, or payment info displayed anywhere on this page.
- **Polling refresh** — client polls `getKitchenKots(branchId)` every 30 seconds to pick up new KOTs without manual refresh.
- Layout: full-page, dense card grid optimised for a kitchen display, no management sidebar when `session.posRole === true`.

#### New server action: `getKitchenKots(branchId: string)`

```
1. getSession() → canAdvanceKot(role) OR isGlobalAdmin; else Forbidden
2. requireBranchAccess(branchId) → enforcedBranchId
3. todayIST = IST date
4. orders = readJSON(POS_ORDERS).filter(o => o.branchId === enforcedBranchId && o.date === todayIST)
   // build a map: orderId → { tableId, takeawayNumber, orderType } for display
5. kots = readJSON(POS_KOTS).filter(k =>
     k.branchId === enforcedBranchId
     && orders.some(o => o.id === k.orderId)
     && ['pending','preparing','ready'].includes(k.status)
   ).sort((a,b) => a.firedAt.localeCompare(b.firedAt))
6. return kots with resolved Order identifiers (table name or T-N) — NO financial data
   (no audit — read-only)
```

Also update `advanceKotStatus` to use `canAdvanceKot(role)` instead of the old `isGlobalAdmin || role==='manager'` check.

---

### `src/app/management/pos/history/page.tsx` (server component)

```typescript
// Accessible via "View History" link from /management/pos (isGlobalAdmin only)
// Direct URL access: redirects to /management if role is readonly or no session
// 1. getSession() → if role === 'readonly' or no session → redirect('/management')
// 2. if !isGlobalAdmin → ensure branchId scoping
// 3. readJSON(DB_FILES.BRANCHES) → pass branches for selector
// 4. Render <PosHistoryClientPage branches={...} session={...} />
```

### `src/app/management/pos/history/PosHistoryClientPage.tsx` (client component)

- Date-range picker + branch selector (managers see only their branch).
- Calls `getPosOrderHistory(branchId, fromDate, toDate)` on filter submit.
- Renders order list with summary row at top.
- Click on an order row expands the full item/bill/payment breakdown.

### Config extension (`src/app/actions/config.ts`)

```typescript
export type Config = {
  id: string
  attendance: boolean
  payroll: boolean
  vendors: boolean
  inventory: boolean
  menu: boolean
  reports: boolean
  pos: boolean                   // NEW — defaults to false when absent
  posDefaultGstPercent?: number  // NEW — 0–28, defaults to 0 when absent
}
```

New action:

```typescript
export async function updatePosGstRate(prevState: any, formData: FormData) {
  const session = await getSession()
  if (!session?.isRootAdmin) return { error: 'Forbidden' }  // admin role only, same as other settings actions
  // validate: z.number().int().min(0).max(28)
  // mutate: write posDefaultGstPercent to config.json[0]
  // revalidatePath('/management/settings')
  // return { success: true } | { error }
}
```

*`updatePosGstRate` requires `isRootAdmin` (admin role) — consistent with all other Settings actions. Owner role cannot change the GST rate.*

### Settings integration

`SettingsClientPage.tsx` adds `pos` to the `modulesApp` array:

```typescript
{ id: 'pos', name: 'POS / Billing', description: 'Real-time order taking, KOT, and billing.', type: 'Optional' }
```

And renders a numeric input for `posDefaultGstPercent` (0–28) under the POS module toggle row.

### EOD integration (`src/app/management/eod/page.tsx`)

```typescript
const configList = await readJSON<Config>(DB_FILES.CONFIG).catch(() => [])
const config = configList[0]

// Server: compute initial POS pre-fill for the default date (today IST) and default branch
const todayIST = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
const defaultBranchId = session.isGlobalAdmin ? branches[0]?.id : session.branchId
const initialPosData = config?.pos && defaultBranchId
  ? computePosEodData(
      (await readJSON<PosOrder>(DB_FILES.POS_ORDERS).catch(() => []))
        .filter(o => o.branchId === defaultBranchId && o.date === todayIST)
    )
  : null

// Pass to EODClientPage as posEodData (pre-computed, NOT the raw orders array)
```

`EODClientPage` receives `posEodData: PosEodData | null` as a prop for the initial load. When the user changes the selected date or branch, the client calls `getPosDataForEOD(date, branchId)` — a server action that returns the computed `PosEodData` for the new selection. The client then pre-fills the income and billing fields from the returned data. Raw order records are never sent to the client. A non-blocking notice is shown if `posEodData` is null or `posEodData.billCount === 0`.

Data flow:

```
EODClientPage (client)
  └─ receives posEodData: PosEodData | null (initial, pre-computed on server for today's date)
  └─ calls getPosDataForEOD(date, branchId) when user changes date/branch selector
       └─ returns PosEodData — no raw order data exposed to client
```

---

## Data Models

### DB_FILES additions (`src/lib/db.ts`)

```typescript
export const DB_FILES = {
  // ... existing entries ...
  POS_TABLES: 'pos_tables.json',
  POS_ORDERS: 'pos_orders.json',
  POS_KOTS:   'pos_kots.json',
}
```

### `pos_tables.json` — PosTable

```typescript
type PosTable = {
  id: string        // 'ptbl_' + randomUUID()
  branchId: string
  name: string      // 1–50 chars, unique per branch among isActive=true rows
  isActive: boolean // soft delete
  createdAt: string // ISO timestamp
  updatedAt: string
  deletedAt?: string
}
```

Design decision: **table occupancy is derived, not stored**. A table is `occupied` when at least one PosOrder with `status === 'open'` and `tableId === table.id` exists for today's IST date. This prevents sync bugs between order transitions and table state. The only exception is `payment.paidAt` setting table back to available — this is also derived from order status, not a flag on PosTable.

### `pos_orders.json` — PosOrder

```typescript
type OrderType   = 'dine-in' | 'takeaway'
type OrderStatus = 'open' | 'billed' | 'paid' | 'voided'

type OrderItem = {
  id: string           // 'oi_' + randomUUID()
  menuItemId: string
  variantId?: string
  nameSnapshot: string // captured at time of ordering — never updated post-creation
  unitPrice: number    // integer rupees, Effective_Price at time of ordering — immutable
  quantity: number     // 1–99 inclusive
  note?: string        // max 80 chars
}

type BillSnapshot = {
  subtotal: number     // Σ (item.quantity × item.unitPrice) — integer rupees
  discount: number     // integer rupees, 0 ≤ discount ≤ subtotal
  gst: number          // integer rupees, ≥ 0, user-confirmed value
  totalPayable: number // subtotal - discount + gst
  generatedAt: string  // ISO timestamp
}

type PaymentSnapshot = {
  method: 'cash' | 'upi' | 'split'
  cashAmount: number   // integer rupees (0 for pure UPI)
  upiAmount: number    // integer rupees (0 for pure cash)
  paidAt: string       // ISO timestamp
}

type VoidInfo = {
  reason: string       // 1–200 chars
  voidedBy: string     // userId
  voidedAt: string     // ISO timestamp
}

type PosOrder = {
  id: string               // 'pord_' + randomUUID()
  branchId: string
  tableId?: string         // present for dine-in; undefined for takeaway (never set to a sentinel string)
  takeawayNumber?: string  // 'T-N' sequential per branch+date, present for takeaway
  orderType: OrderType
  covers?: number          // dine-in only; 1–30; default 1
  status: OrderStatus
  items: OrderItem[]       // embedded — no separate collection
  note?: string            // order-level note, max 200 chars
  kotCount: number         // number of KOTs successfully fired; starts at 0
  bill?: BillSnapshot      // set when status transitions to 'billed'
  payment?: PaymentSnapshot // set when status transitions to 'paid'
  void?: VoidInfo          // set when status transitions to 'voided'
  date: string             // IST date 'YYYY-MM-DD' — set at creation
  openedBy: string         // userId of Session_User who created the order
  createdAt: string
  updatedAt: string
}
```

Design decision: **OrderItems are embedded on PosOrder** (not a separate collection). This is consistent with how `EODEntry` embeds `billing` and `ops`. It avoids cross-file reads when rendering the order panel, keeping the transaction scope to a single file per mutation.

### `pos_kots.json` — PosKot

```typescript
type KotStatus = 'pending' | 'preparing' | 'ready' | 'served'

type KotItem = {
  menuItemId: string
  variantId?: string
  nameSnapshot: string
  quantity: number  // delta quantity (items added/increased since last KOT fire)
  note?: string
}

type PosKot = {
  id: string        // 'pkot_' + randomUUID()
  orderId: string
  branchId: string
  kotNumber: number // sequential within order: 1, 2, 3, …
  items: KotItem[]  // only delta items at time of fire
  status: KotStatus
  firedBy: string   // userId
  firedAt: string   // ISO timestamp
  updatedAt: string
}
```

Design decision: **KOTs are in a separate collection** (not embedded on PosOrder) because they have an independent status lifecycle (`pending → preparing → ready → served`) that may be updated by kitchen staff independently from order mutations. Keeping them separate avoids contention on the order's mutex during kitchen status updates.

### `computePosEodData` return type

```typescript
type PosEodData = {
  // income pre-fill
  dineInCash: number
  dineInUpi: number
  takeawayCash: number
  takeawayUpi: number
  // billing section pre-fill
  totalBillAmount: number
  billCount: number
  dineInCovers: number      // count of paid dine-in orders (matches EODEntry.billing.dineInCovers)
  takeawayOrders: number
  cashCollectedAsBilled: number
  upiCollectedAsBilled: number
  voids: number
  discounts: number
  gstCollected: number
}
```

### Seed update (`db/seed-data.ts`)

The `config.json` seed row gains `"pos": false`:

```
// Before: {"id":"global","attendance":false,"payroll":false,...,"reports":false}
// After:  {"id":"global","attendance":false,"payroll":false,...,"reports":false,"pos":false}
```

Also, three new empty-array seeds are added:

```typescript
// db/seed-data.ts also gains three new empty-array seeds:
seedData['pos_tables.json'] = '[]'
seedData['pos_orders.json'] = '[]'
seedData['pos_kots.json']   = '[]'

// This ensures json_store rows exist for all three collections from first deployment,
// consistent with all other collections.
```

---

## Server Actions

All actions live in `src/app/actions/pos.ts` with `'use server'` at the top. They follow the standard contract: **authorize → validate → scope → mutate under lock → audit → revalidate → return**.

All actions return `{ error: string }` on failure or `{ success: true }` (optionally `{ success: true, warning: string }`) on success. Guard flags are set inside `withTransaction` callbacks and checked after the transaction returns — no throwing inside callbacks.

---

### `getTodayPosData(branchId: string)`

Not form-bound. Reads data for the POS landing page.

```
1. getSession() → if no session return { error: 'Unauthorized' }
2. requireBranchAccess(branchId) → get enforcedBranchId (catch → return { error })
3. todayIST = IST date string
4. tables    = readJSON(POS_TABLES).filter(t => t.branchId === enforcedBranchId && t.isActive)
              .sort((a,b) => a.name.localeCompare(b.name))
5. orders    = readJSON(POS_ORDERS).filter(o => o.branchId === enforcedBranchId && o.date === todayIST)
6. kots      = readJSON(POS_KOTS).filter(k => k.branchId === enforcedBranchId)
              (only for orderId in today's orders)
7. Load catalog:
   a. menuItems  = readJSON(MENU).filter(m => m.isActive === true)
   b. branchRows = readBranchMenuItems(enforcedBranchId)
      // readBranchMenuItems falls back to legacy branch_menu_items.json if no shard exists
   c. For each menuItem, find matching branchRow (by menuItemId, no variantId):
      - if branchRow exists:  include only if branchRow.isAvailable === true
      - if no branchRow:      include (default = available, consistent with menu system behaviour)
   d. For each included item, compute Effective_Price:
      - branchRow.price !== null ? branchRow.price : menuItem.basePrice
   e. Merge variants from readJSON(MENU_ITEM_VARIANTS).filter(v => v.isActive && v.menuItemId in catalog)
      Apply same branch-override price logic per variant row.
   f. return catalog as CatalogItem[] — shape: { menuItemId, variantId?, name, categoryId, effectivePrice, dietary?, prepTimeMins? }
8. return { tables, orders, kots, catalog, todayIST }
   (no mutations — no audit, no revalidate)
```

---

### `createTable(prevState: any, formData: FormData)`

```
1. getSession() → role must be manager, owner, or admin (isGlobalAdmin || role==='manager')
   if not → return { error: 'Forbidden' }
2. name     = formData.get('name').trim()
   branchId = formData.get('branchId')
3. Zod: name min(1) max(50), branchId min(1)
4. requireBranchAccess(branchId) → enforcedBranchId
5. withTransaction(POS_TABLES, tables => {
     activeTables = tables.filter(t => t.branchId === enforcedBranchId && t.isActive)
     if activeTables.length >= 50 → set limitReached flag, return tables
     if activeTables.some(t => t.name.toLowerCase() === name.toLowerCase()) → set duplicateName flag, return tables
     tables.push({ id: 'ptbl_'+uuid, branchId: enforcedBranchId, name, isActive: true,
                   createdAt: now, updatedAt: now })
     return tables
   })
6. Check flags: limitReached → { error: 'Active table limit (50) reached' }
               duplicateName → { error: 'A table with this name already exists' }
7. if !success → { error: 'Transaction failed' }
8. revalidatePath('/management/pos')
9. return { success: true }
```

---

### `renameTable(prevState: any, formData: FormData)`

```
1. getSession() → isGlobalAdmin || role==='manager'; else Forbidden
2. tableId = formData.get('tableId'), newName = formData.get('newName').trim(), branchId = formData.get('branchId')
3. Zod: newName min(1) max(50)
4. requireBranchAccess(branchId) → enforcedBranchId
5. withTransaction(POS_TABLES, tables => {
     table = tables.find(t => t.id === tableId && t.branchId === enforcedBranchId)
     if !table → set notFound, return tables
     if tables.some(t => t.id !== tableId && t.isActive && t.branchId === enforcedBranchId
                         && t.name.toLowerCase() === newName.toLowerCase()) → set duplicate, return tables
     table.name = newName; table.updatedAt = now
     return tables
   })
6. Check flags; return errors or { success: true }
7. revalidatePath('/management/pos')
```

---

### `deactivateTable(tableId: string)`

```
1. getSession() → isGlobalAdmin || role==='manager'; else Forbidden
2. Load table record → verify branchId via requireBranchAccess
3. readJSON(POS_ORDERS) → check any order with tableId === tableId and status === 'open'
   if found → return { error: 'Table has an active open order and cannot be deactivated' }
4. withTransaction(POS_TABLES, tables => {
     t = tables.find(t => t.id === tableId)
     if !t → set notFound
     else { t.isActive = false; t.deletedAt = now; t.updatedAt = now }
     return tables
   })
5. revalidatePath('/management/pos')
6. return { success: true }
```

---

### `createOrder(prevState: any, formData: FormData)`

```
1. getSession() → canCreateOrder(role); else Forbidden
   orderType  = formData.get('orderType') as OrderType
   covers     = Number(formData.get('covers')) || 1
   branchId   = formData.get('branchId')
3. Zod: orderType enum('dine-in','takeaway'), covers int min(1) max(30), branchId min(1)
   // Cross-field validation (post-Zod):
   if orderType === 'dine-in' && !tableId → return { error: 'Table is required for dine-in orders' }
   if orderType === 'takeaway' && tableId → return { error: 'Takeaway orders must not have a table assigned' }
4. requireBranchAccess(branchId) → enforcedBranchId
5. todayIST = IST date
6. withTransaction(POS_ORDERS, orders => {
     if orderType === 'dine-in':
       if !tableId → set missingTable, return orders   // belt-and-suspenders guard inside transaction
       if orders.some(o => o.tableId === tableId && o.status === 'open') → set occupied, return orders
     
     let takeawayNumber: string | undefined
     if orderType === 'takeaway':
       todayTakeaways = orders.filter(o => o.branchId === enforcedBranchId
                                         && o.date === todayIST
                                         && o.orderType === 'takeaway'
                                         && o.status !== 'voided')
       takeawayNumber = 'T-' + (todayTakeaways.length + 1)
     
     orders.push({
       id: 'pord_'+uuid,
       branchId: enforcedBranchId,
       tableId: orderType === 'dine-in' ? tableId : undefined,
       takeawayNumber,
       orderType,
       covers: orderType === 'dine-in' ? covers : undefined,
       status: 'open',
       items: [],
       kotCount: 0,
       date: todayIST,
       openedBy: session.userId,
       createdAt: now,
       updatedAt: now,
     })
     return orders
   })
7. Check occupied flag → { error: 'Table already has an open order' }
8. logAction('CREATE_POS_ORDER', 'POS_ORDER', JSON.stringify({ branchId, orderType, tableId }), orderId)
9. revalidatePath('/management/pos')
10. return { success: true }
```

---

### `addOrUpdateOrderItem(orderId, menuItemId, quantity, unitPrice, nameSnapshot, variantId?, note?)`

> **Quantity contract — absolute value:** The `quantity` parameter is always the *final desired quantity* for the item, not a delta/increment. The client is responsible for computing the new quantity before calling this action (e.g. current quantity + 1 for an increment button click). The server sets `existing.quantity = quantity` directly. To remove an item, the client calls `removeOrderItem` (quantity 0 is not accepted by this action — Zod validates `quantity int min(1)`). This matches Req 2.5 (quantity 1–99) and Req 2.6 (decreasing to zero uses `removeOrderItem`).

```
1. getSession() → canCreateOrder(role); else Forbidden
2. Validate: quantity int min(1) max(99),   // ABSOLUTE value — never 0 (use removeOrderItem for deletion)
             unitPrice int ≥ 0, nameSnapshot min(1),
             note max(80) if provided
3. requireBranchAccess(undefined) → session branchId
4. withTransaction(POS_ORDERS, orders => {
     order = orders.find(o => o.id === orderId)
     if !order → set notFound
     else if order.branchId !== enforcedBranchId → set branchDenied
     else if order.status !== 'open' → set notOpen
     else if role === 'waiter' && !isWaiterOwnOrder(role, order.openedBy, session.userId):
       set waiterForbidden
     else {
       existing = order.items.find(i => i.menuItemId === menuItemId
                                     && (i.variantId ?? undefined) === (variantId ?? undefined))
       if existing {
         existing.quantity = quantity
         if note !== undefined: existing.note = note
       } else {
         order.items.push({ id: 'oi_'+uuid, menuItemId, variantId, nameSnapshot,
                            unitPrice, quantity, note })
       }
       order.updatedAt = now
     }
     return orders
   })
5. Check flags; return errors
   if waiterForbidden → return { error: 'Forbidden: waiters can only edit their own orders' }
6. revalidatePath('/management/pos')
7. return { success: true }
```

Note: `unitPrice` is supplied by the client from the catalog's `Effective_Price`. Once written to `OrderItem.unitPrice`, it is never updated again — subsequent menu price changes do not affect in-progress orders.

---

### `removeOrderItem(orderId: string, orderItemId: string)`

```
1. getSession() → canCreateOrder(role); else Forbidden
   // ADDITIONAL CHECK after branch scope: if role === 'waiter' && !isWaiterOwnOrder(role, order.openedBy, session.userId) → return { error: 'Forbidden: waiters can only edit their own orders' }
2. requireBranchAccess → enforcedBranchId
3. withTransaction(POS_ORDERS, orders => {
     order = orders.find(o => o.id === orderId)
     if !order → notFound
     else if order.branchId !== enforcedBranchId → branchDenied
     else if order.status !== 'open' → notOpen
     else {
       idx = order.items.findIndex(i => i.id === orderItemId)
       if idx === -1 → itemNotFound
       else { order.items.splice(idx, 1); order.updatedAt = now }
     }
     return orders
   })
4. revalidatePath('/management/pos')
5. return { success: true }
```

---

### `updateOrderNote(orderId: string, note: string)`

```
1. getSession() → canCreateOrder(role); else Forbidden
   // ADDITIONAL CHECK: if role === 'waiter' && !isWaiterOwnOrder(role, order.openedBy, session.userId) → return { error: 'Forbidden: waiters can only edit their own orders' }
2. Validate: note max(200)
3. requireBranchAccess → enforcedBranchId
4. withTransaction(POS_ORDERS, orders => {
     order = orders.find(o => o.id === orderId)
     if !order → notFound
     if order.branchId !== enforcedBranchId → branchDenied
     if order.status !== 'open' → notOpen
     order.note = note; order.updatedAt = now
     return orders
   })
5. revalidatePath('/management/pos')
6. return { success: true }
```

---

### `fireKot(orderId: string)`

Implements the KOT delta algorithm.

```
1. getSession() → canFireKot(role); else Forbidden
   // ADDITIONAL CHECK: if role === 'waiter' && !isWaiterOwnOrder(role, order.openedBy, session.userId) → return { error: 'Forbidden' }
2. requireBranchAccess → enforcedBranchId

3. Load order from pos_orders.json — verify branchId, verify status === 'open'
4. if order.items.length === 0 → return { error: 'Order has no items' }

5. Load all prior KOTs: priorKots = readJSON(POS_KOTS).filter(k => k.orderId === orderId)

6. Compute delta:
   For each item in order.items:
     priorTotal = sum of k.quantity across all priorKots where k.menuItemId === item.menuItemId
                  && (k.variantId ?? undefined) === (item.variantId ?? undefined)
     delta = item.quantity - priorTotal
     if delta > 0 → include in kotItems with { menuItemId, variantId, nameSnapshot, quantity: delta, note: item.note }

7. if kotItems.length === 0 → return { error: 'No new items to send to kitchen' }

8. Compute newKotNumber from pos_kots.json directly (not from order.kotCount):
   newKotNumber = priorKots.length + 1
   (This is safe because priorKots was already loaded in step 5 and is the authoritative count.
    order.kotCount is kept in sync as a convenience cache but is NOT used as the source of truth
    for kotNumber calculation — preventing duplicate numbers if the order update fails.)
9. withTransaction(POS_KOTS, kots => {
     kots.push({
       id: 'pkot_'+uuid,
       orderId,
       branchId: enforcedBranchId,
       kotNumber: newKotNumber,
       items: kotItems,
       status: 'pending',
       firedBy: session.userId,
       firedAt: now,
       updatedAt: now,
     })
     return kots
   })
10. withTransaction(POS_ORDERS, orders => {
      order = orders.find(o => o.id === orderId)
      if (order) {
        // Sync cache: set kotCount to actual KOT count to self-heal any prior desync
        order.kotCount = newKotNumber
        order.updatedAt = now
      }
      return orders
    })
    // Note: if this second transaction fails, kotCount cache is stale but kotNumber
    // correctness is unaffected on next fireKot because we read priorKots.length directly.
    // Log a warning if this write fails but do NOT fail the overall action — the KOT is already persisted.
11. logAction('FIRE_KOT', 'POS_KOT', JSON.stringify({ orderId, kotNumber: newKotNumber, itemCount: kotItems.length }), kotId)
12. revalidatePath('/management/pos')
13. return { success: true }
```

> **Design decision — KOT number source of truth:** `kotNumber` is always derived as `priorKots.length + 1` by reading `pos_kots.json` at fire time. `order.kotCount` is a denormalized cache kept for quick display and is self-healed on every `fireKot`. This eliminates the two-transaction race that could produce duplicate KOT numbers.

---

### `generateBill(prevState: any, formData: FormData)`

```
1. getSession() → canGenerateBill(role); else Forbidden
2. orderId   = formData.get('orderId')
   discount  = Number(formData.get('discount')) || 0
   gst       = Number(formData.get('gst')) || 0
   confirmed = formData.get('confirmed') === 'true'   // re-submission flag for zero-bill
3. Zod: discount int min(0), gst int min(0)
4. requireBranchAccess → enforcedBranchId
5. withTransaction(POS_ORDERS, orders => {
     order = orders.find(o => o.id === orderId)
     if !order → notFound
     if order.branchId !== enforcedBranchId → branchDenied
     if order.status === 'billed' → alreadyBilled (return orders — no-op)
     if order.status !== 'open' → notOpen
     if order.items.length === 0 → noItems

     subtotal = order.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
     if discount > subtotal → discountExceedsSubtotal

     if (subtotal - discount + gst) === 0:
       if !confirmed → set zeroBillUnconfirmed, return orders (no mutation)
       // if confirmed === true, fall through and bill at totalPayable = 0

     totalPayable = subtotal - discount + gst
     order.bill = { subtotal, discount, gst, totalPayable, generatedAt: now }
     order.status = 'billed'
     order.updatedAt = now
     return orders
   })
6. Check flags; return errors
   if zeroBillUnconfirmed → return { error: 'ZERO_BILL_CONFIRM_REQUIRED' }
7. logAction('GENERATE_BILL', 'POS_ORDER', JSON.stringify({ orderId, subtotal, discount, gst, totalPayable }), orderId)
8. revalidatePath('/management/pos')
9. return { success: true }
```

> **Zero-bill confirmation flow:** On first submission, if `totalPayable === 0`, the action returns `{ error: 'ZERO_BILL_CONFIRM_REQUIRED' }` without mutating. The client shows a confirmation dialog. On re-submission the client sets `confirmed = 'true'` in formData and the action skips the zero-bill guard, billing at `totalPayable = 0`. This satisfies Req 4.7 without a separate round-trip action.

---

### `reopenOrder(orderId: string)`

```
1. getSession() → isGlobalAdmin || role==='manager'; else Forbidden
2. requireBranchAccess → enforcedBranchId
3. withTransaction(POS_ORDERS, orders => {
     order = orders.find(o => o.id === orderId)
     if !order → notFound
     if order.branchId !== enforcedBranchId → branchDenied
     if order.status === 'paid' → isPaid (blocked — explicit error)
     if order.status !== 'billed' → wrongStatus
     order.status = 'open'
     order.bill = undefined
     order.updatedAt = now
     return orders
   })
4. Check isPaid → { error: 'A paid order cannot be reopened' }
5. logAction('REOPEN_POS_ORDER', 'POS_ORDER', JSON.stringify({ orderId }), orderId)
6. revalidatePath('/management/pos')
7. return { success: true }
```

---

### `recordPayment(prevState: any, formData: FormData)`

```
1. getSession() → canRecordPayment(role); else Forbidden
2. orderId      = formData.get('orderId')
   method       = formData.get('method') as 'cash'|'upi'|'split'
   cashAmount   = Number(formData.get('cashAmount')) || 0
   upiAmount    = Number(formData.get('upiAmount')) || 0
   cashTendered = Number(formData.get('cashTendered')) || 0
   // cashTendered: physical cash handed by customer (for change-due display only — never persisted)
   // cashAmount:   the cash portion of the bill (stored in payment snapshot)
3. Zod: method enum, cashAmount int min(0), upiAmount int min(0),
        cashTendered: z.number().int().min(0)   // validated but not stored
4. requireBranchAccess → enforcedBranchId
5. withTransaction(POS_ORDERS, orders => {
     order = orders.find(o => o.id === orderId)
     if !order → notFound
     if order.branchId !== enforcedBranchId → branchDenied
     if order.status !== 'billed' → notBilled
     if !order.bill → noBill
     
     totalPayable = order.bill.totalPayable
     
     // Enforce method-amount consistency:
     if method === 'cash': cashAmount = totalPayable; upiAmount = 0
     if method === 'upi':  upiAmount = totalPayable;  cashAmount = 0
     // For split: use provided values
     
     if cashAmount + upiAmount !== totalPayable → mismatch
     if totalPayable > 0 && cashAmount === 0 && upiAmount === 0 → mismatch
     
     cashAmountStored = cashAmount
     order.payment = { method, cashAmount: cashAmountStored, upiAmount, paidAt: now }
     // Table status is derived (not stored on PosTable). For dine-in: the table becomes 'available'
     // automatically because no open order references it after this transition.
     // For takeaway: order.tableId is undefined — no table state to update. This is a no-op by design.
     order.status = 'paid'
     order.updatedAt = now
     return orders
   })
6. Check flags; return errors
   // Change due is computed after successful payment recording and returned to client:
   // changeDue = (method === 'cash' || method === 'split') ? cashTendered - cashAmountStored : 0
   // changeDue is NOT persisted — display only.
7. logAction('RECORD_PAYMENT', 'POS_ORDER', JSON.stringify({ orderId, method, cashAmount, upiAmount, totalPayable }), orderId)
8. revalidatePath('/management/pos')
9. return { success: true, changeDue: changeDue }
   // Client displays changeDue on the bill panel immediately after payment confirmation.
```

> **`cashTendered` vs `cashAmount`:** `cashTendered` is the physical amount handed by the customer and is used solely to compute change due (`cashTendered − cashAmount`). It is validated but never stored. `cashAmount` is the actual cash portion of the payment (= `totalPayable` for pure-cash, or the split cash component) and is stored in `PaymentSnapshot`. For pure-UPI payments, both are 0.

---

### `voidOrder(prevState: any, formData: FormData)`

Handles two void scenarios: stale open orders (any manager) and paid orders (owner/admin, same IST day).

```
1. getSession() → if !session return { error: 'Unauthorized' }
2. orderId = formData.get('orderId')
   reason  = formData.get('reason').trim()
3. Zod: reason min(1) max(200)
4. requireBranchAccess → enforcedBranchId (catch → BranchAccessDenied)
5. // Before withTransaction:
   let previousStatus: OrderStatus | undefined
   withTransaction(POS_ORDERS, orders => {
     order = orders.find(o => o.id === orderId)
     if !order → notFound
     if order.branchId !== enforcedBranchId → branchDenied
     previousStatus = order.status   // capture before mutation
     
     if order.status === 'paid':
       if !session.isGlobalAdmin → set forbidden
       todayIST = IST date
       orderPayDate = order.payment.paidAt substring(0,10) in IST
       if orderPayDate !== todayIST → set crossDay
       // allow void
     else if order.status === 'open':
       if role not in ['manager','owner','admin'] → set forbidden
       // allow void (stale or same-day open orders — no date restriction for open orders)
       // Note: same-day open void and stale open void use the same code path. Any open order
       // may be voided by manager, owner, or admin regardless of creation date.
       // (The Stale Order Banner in the UI surfaces stale orders prominently, but the underlying
       //  voidOrder action has no date restriction for open orders — only for paid orders.)
     else → set wrongStatus (cannot void billed orders directly — must reopen first)
     
     if any error flag set: return orders
     
     order.void = { reason, voidedBy: session.userId, voidedAt: now }
     order.status = 'voided'
     order.updatedAt = now
     return orders
   })
6. Check flags: forbidden → { error: 'Forbidden' }
               crossDay  → { error: 'Order can only be voided on the day it was paid' }
               wrongStatus → { error: 'Only open or paid orders can be voided' }
7. logAction('VOID_POS_ORDER', 'POS_ORDER',
     JSON.stringify({ orderId, reason, previousStatus, branchId: enforcedBranchId }),
     orderId)
8. revalidatePath('/management/pos')
9. return { success: true }
```

> **Open vs paid void policy:** Any `open` order (same-day or prior-day stale) can be voided by manager, owner, or admin with no date restriction. Only `paid` order voids are restricted to the same IST calendar day and require owner/admin role. `billed` orders cannot be voided directly — the manager must use `reopenOrder` first to revert to `open`, then void.

---

### `advanceKotStatus(kotId: string)`

```
1. getSession() → canAdvanceKot(role); else Forbidden
   // canAdvanceKot allows: manager, owner, admin, kitchen
2. requireBranchAccess → enforcedBranchId
3. KOT_SEQUENCE = ['pending', 'preparing', 'ready', 'served']
4. withTransaction(POS_KOTS, kots => {
     kot = kots.find(k => k.id === kotId)
     if !kot → notFound
     if kot.branchId !== enforcedBranchId → branchDenied
     currentIdx = KOT_SEQUENCE.indexOf(kot.status)
     if currentIdx === -1 || currentIdx === KOT_SEQUENCE.length - 1 → set invalidTransition
     kot.status = KOT_SEQUENCE[currentIdx + 1]
     kot.updatedAt = now
     return kots
   })
5. Check flags; return errors
6. revalidatePath('/management/pos')
7. return { success: true }
```

---

### `getPosOrderHistory(branchId: string, fromDate: string, toDate: string)`

```
1. getSession() → if !canViewHistory(role) return { error: 'Forbidden' }
   // canViewHistory allows only: owner, admin
   // Blocks: waiter, billing, kitchen, manager, readonly
2. Validate: fromDate, toDate match /^\d{4}-\d{2}-\d{2}$/, fromDate ≤ toDate
3. enforcedBranchId:
   - if isGlobalAdmin: use requested branchId (admin/owner can see any branch)
   - else (manager): use session.branchId; if requested branchId !== session.branchId
                     → return { error: 'BranchAccessDenied' } without confirming data exists
4. orders = readJSON(POS_ORDERS)
           .filter(o => o.branchId === enforcedBranchId
                     && o.date >= fromDate && o.date <= toDate)
5. Compute summary row:
   summary = {
     totalRevenue:   sum of o.bill.totalPayable for paid orders,
     billCount:      count of paid orders,
     avgOrderValue:  billCount > 0 ? Math.round(totalRevenue / billCount) : 0,
     totalVoids:     count of voided orders,
     totalDiscounts: sum of o.bill.discount for paid orders,
   }
6. return { orders, summary }
   (no audit — read-only action)
   // Note: PosOrder.items (embedded OrderItems) provides the full item breakdown for Req 7.3.
   // KOT records (pos_kots.json) are NOT included in history view — they are scoped to the active
   // POS session (KOT Panel in PosClientPage). The history view shows the final confirmed item list
   // from the Order, not the incremental KOT sequence.
```

---

### `getDailySummary(branchId: string, date: string)`

```
1. getSession() → if session.posRole || role === 'readonly' return { error: 'Forbidden' }
   // posRole accounts (billing/kitchen/waiter) cannot access daily summary
   // Daily summary is for manager, owner, admin only
2. requireBranchAccess(branchId) → enforcedBranchId
3. orders = readJSON(POS_ORDERS).filter(o => o.branchId === enforcedBranchId && o.date === date)
4. return computePosEodData(orders) with additional:
   totalCash: sum cashAmount of paid orders
   totalUpi:  sum upiAmount of paid orders
   dineInBillCount: count of paid dine-in orders
   takeawayBillCount: count of paid takeaway orders
   (no audit — read-only)
```

---

### `getPosDataForEOD(date: string, branchId: string)`

Called from EODClientPage when the user changes date or branch selector. Returns pre-computed EOD pre-fill values for a specific date+branch without exposing raw order data to the client.

```
1. getSession() → if !session return { error: 'Unauthorized' }
2. Validate: date matches /^\d{4}-\d{2}-\d{2}$/, branchId min(1)
3. requireBranchAccess(branchId) → enforcedBranchId
4. orders = readJSON(POS_ORDERS).filter(o => o.branchId === enforcedBranchId && o.date === date)
5. return { data: computePosEodData(orders) }
   (no audit — read-only; returns PosEodData shape, not raw orders)
```

---

### `computePosEodData(orders: PosOrder[]): PosEodData` (pure function)

Not a server action. Called from EOD `page.tsx` and `getDailySummary`. Accepts an already-filtered array (by `date` and `branchId`).

```typescript
function computePosEodData(orders: PosOrder[]): PosEodData {
  const paid = orders.filter(o => o.status === 'paid')
  const dineIn   = paid.filter(o => o.orderType === 'dine-in')
  const takeaway = paid.filter(o => o.orderType === 'takeaway')
  const voided   = orders.filter(o => o.status === 'voided')

  return {
    dineInCash:           dineIn.reduce((s, o) => s + (o.payment?.cashAmount ?? 0), 0),
    dineInUpi:            dineIn.reduce((s, o) => s + (o.payment?.upiAmount ?? 0), 0),
    takeawayCash:         takeaway.reduce((s, o) => s + (o.payment?.cashAmount ?? 0), 0),
    takeawayUpi:          takeaway.reduce((s, o) => s + (o.payment?.upiAmount ?? 0), 0),
    totalBillAmount:      paid.reduce((s, o) => s + (o.bill?.totalPayable ?? 0), 0),
    billCount:            paid.length,
    dineInCovers:         dineIn.length,   // count of paid dine-in orders (per Req 6.3)
    takeawayOrders:       takeaway.length,
    cashCollectedAsBilled: paid.reduce((s, o) => s + (o.payment?.cashAmount ?? 0), 0),
    upiCollectedAsBilled:  paid.reduce((s, o) => s + (o.payment?.upiAmount ?? 0), 0),
    voids:                voided.length,
    discounts:            paid.reduce((s, o) => s + (o.bill?.discount ?? 0), 0),
    gstCollected:         paid.reduce((s, o) => s + (o.bill?.gst ?? 0), 0),
  }
}
```

---

## State Machines

### Order status state machine

```
                  createOrder
                      │
                      ▼
              ┌───────────────┐
              │     open      │◄──────────────────────┐
              └───────┬───────┘                       │
                      │ generateBill                  │ reopenOrder
                      ▼                               │ (only when status=billed, not paid)
              ┌───────────────┐                       │
              │    billed     ├───────────────────────┘
              └───────┬───────┘
                      │ recordPayment
                      ▼
              ┌───────────────┐
              │     paid      │
              └───────┬───────┘
                      │ voidOrder (owner/admin, same IST day)
                      │
    voidOrder          │
  (stale open /        ▼
   open same day)  ┌───────────────┐
       │           │    voided     │
       └──────────►│               │
                   └───────────────┘

  BLOCKED transitions:
  paid → open     : explicit error 'A paid order cannot be reopened'
  paid → billed   : not permitted
  voided → any    : terminal state
  billed → voided : not permitted (must reopen first, then void)
```

### KOT status state machine

```
              fireKot
                │
                ▼
        ┌───────────────┐
        │    pending    │
        └───────┬───────┘
                │ advanceKotStatus
                ▼
        ┌───────────────┐
        │   preparing   │
        └───────┬───────┘
                │ advanceKotStatus
                ▼
        ┌───────────────┐
        │     ready     │
        └───────┬───────┘
                │ advanceKotStatus
                ▼
        ┌───────────────┐
        │    served     │  ← terminal
        └───────────────┘

  BLOCKED: any backward transition, any skip (pending→ready, etc.)
  advanceKotStatus on 'served' → { error: 'KOT is already served' }
```

> **KOT display spec (Req 3.3):** WHEN a KOT is generated, THE POS_System SHALL display it showing: KOT number, Order identifier (table name or takeaway number), and for each item: item name, quantity, and Item_Note if present. Item notes are shown in italic beneath the item name to ensure kitchen customisation instructions (e.g. "no chilli") are visually prominent and reach the cook.

---

## Integration Points

### EOD module

`src/app/management/eod/page.tsx` is extended:

```typescript
import { computePosEodData, getPosDataForEOD, type PosOrder, type PosEodData } from '@/app/actions/pos'

// After loading config:
// Server: compute initial POS pre-fill for the default date (today IST) and default branch
const todayIST = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
const defaultBranchId = session.isGlobalAdmin ? branches[0]?.id : session.branchId
const initialPosData = config?.pos && defaultBranchId
  ? computePosEodData(
      (await readJSON<PosOrder>(DB_FILES.POS_ORDERS).catch(() => []))
        .filter(o => o.branchId === defaultBranchId && o.date === todayIST)
    )
  : null

// Pass to EODClientPage as posEodData (pre-computed, NOT the raw orders array)
```

`EODClientPage` receives `posEodData: PosEodData | null` as a prop for the initial load. When the user changes the selected date or branch, the client calls `getPosDataForEOD(date, branchId)` — a server action that returns the computed `PosEodData` for the new selection. The client then pre-fills the income and billing fields from the returned data. Raw order records are never sent to the client. A non-blocking notice is shown if `posEodData` is null or `posEodData.billCount === 0`. The EOD save action remains unchanged — it persists whatever values the user submits.

### Settings module

`SettingsClientPage` gains:
- A `pos` toggle in the modules section alongside `attendance`, `payroll`, etc.
- A numeric input (0–28) for `posDefaultGstPercent` rendered beneath the POS toggle, calling `updatePosGstRate`.

### Navigation

`Navigation.tsx` renders the POS link when `config?.pos !== false && !isReadOnly`. The `ShoppingCart` icon is imported from `lucide-react`.

### Menu module

POS reads branch menu availability from `readBranchMenuItems(branchId)` (already public API in `src/lib/db.ts`). POS never writes to menu collections.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

PBT applies here because the POS module contains pure aggregation functions (`computePosEodData`, bill arithmetic, KOT delta computation) and universal invariants (branch isolation, status machine safety, uniqueness constraints) over large input spaces. Tests use **fast-check** (the standard PBT library for TypeScript/Vitest).

---

### Property 1: Bill arithmetic invariants

*For any* valid collection of OrderItems with non-negative unit prices and quantities in [1,99], and any non-negative discount not exceeding the subtotal, and any non-negative GST amount, the computed bill must satisfy all four of: `subtotal = Σ(item.quantity × item.unitPrice)`, `totalPayable = subtotal − discount + gst`, `0 ≤ discount ≤ subtotal`, and `gst ≥ 0`.

**Validates: Requirements 4.1, 4.5**

---

### Property 2: Payment balance invariant

*For any* paid PosOrder, `payment.cashAmount + payment.upiAmount === bill.totalPayable`.

**Validates: Requirements 5.1, 5.2, 5.3**

---

### Property 3: KOT delta correctness

*For any* sequence of `addOrUpdateOrderItem` calls on an open order followed by `fireKot`, the resulting KotItem quantities must equal (current item quantity − sum of that item's quantities across all prior KOTs for the same order), and only items with a positive delta must appear in the new KOT.

**Validates: Requirements 3.1**

---

### Property 4: KOT sequential numbering

*For any* sequence of n successful `fireKot` calls on a single order, the generated KOTs have `kotNumber` values exactly equal to [1, 2, 3, …, n] with no gaps and no repeats.

**Validates: Requirements 3.2**

---

### Property 5: Branch isolation for managers

*For any* manager session (with `isGlobalAdmin = false`) and any `branchId` argument passed to `getTodayPosData` or `getPosOrderHistory`, the returned tables and orders always have `branchId === session.branchId` — the requested `branchId` is silently enforced to the session value.

**Validates: Requirements 1.2, 7.4, 8.5**

---

### Property 6: Order status machine safety — no paid→open transition

*For any* PosOrder with `status === 'paid'`, calling `reopenOrder` on that order always returns `{ error: 'A paid order cannot be reopened' }` and the order status remains `'paid'`.

**Validates: Requirements 4.4, 4.11, 8.6**

---

### Property 7: Takeaway number uniqueness

*For any* collection of non-voided PosOrders with `orderType === 'takeaway'` scoped to the same `branchId` and IST `date`, no two orders share the same `takeawayNumber`.

**Validates: Requirements 2.8**

---

### Property 8: OrderItem unit price immutability

*For any* PosOrder created with a given `unitPrice` on each OrderItem, subsequent calls to `addOrUpdateOrderItem` (updating quantity or note) do not change the `unitPrice` of existing items.

**Validates: Requirements 2.5**

---

### Property 9: EOD aggregate correctness

*For any* collection of PosOrders with mixed statuses, `computePosEodData(orders)` produces values where `dineInCash + dineInUpi + takeawayCash + takeawayUpi = totalBillAmount` only when all paid orders' payment amounts and total payable values are consistent, and the function includes only `status === 'paid'` orders in revenue totals and includes `status === 'voided'` orders only in the `voids` count.

**Validates: Requirements 6.1, 6.2, 6.3**

---

### Property 10: Table name uniqueness invariant

*For any* collection of active PosTable records for the same branch, no two tables share the same name (case-insensitive comparison).

**Validates: Requirements 1.5**

---

### Property 11: GST suggestion arithmetic

*For any* subtotal ≥ 0 and any `posDefaultGstPercent` in [0, 28], the suggested GST amount equals `Math.round(subtotal * posDefaultGstPercent / 100)`, which is always a non-negative integer.

**Validates: Requirements 13.3, 4.10**

---

### Property 12: Waiter order ownership isolation

*For any* PosOrder with `openedBy !== session.userId` and `session.role === 'waiter'`, all mutation actions (`addOrUpdateOrderItem`, `removeOrderItem`, `updateOrderNote`, `fireKot`) return `{ error: 'Forbidden: waiters can only edit their own orders' }` and the order remains unchanged.

**Validates: Requirements 8.5, 16.5**

---

## Error Handling

### Action return contract

All actions return one of:
```typescript
{ error: string }               // failure, no data mutation
{ success: true }               // mutation completed
{ success: true, warning: string } // mutation completed with a non-blocking notice
```

No action throws (except `requireBranchAccess` which is always wrapped in try/catch).

### Guard flag pattern

Inside every `withTransaction` callback, errors are signalled via boolean flags set on the enclosing scope:

```typescript
let notFound    = false
let branchDenied = false
let notOpen     = false

const success = await withTransaction(DB_FILES.POS_ORDERS, orders => {
  const order = orders.find(o => o.id === orderId)
  if (!order)                              { notFound = true;     return orders }
  if (order.branchId !== enforcedBranchId) { branchDenied = true; return orders }
  if (order.status !== 'open')             { notOpen = true;      return orders }
  // ...mutate...
  return orders
})

if (!success && !notFound && !branchDenied && !notOpen) return { error: 'Transaction failed' }
if (notFound)     return { error: 'Order not found' }
if (branchDenied) return { error: 'BranchAccessDenied' }
if (notOpen)      return { error: 'Order is not open' }
```

### Error taxonomy

| Error string | Meaning |
|---|---|
| `'Forbidden'` | Role does not grant permission for this action |
| `'BranchAccessDenied'` | Manager attempting cross-branch access — distinct from Forbidden; does not reveal resource existence |
| `'Unauthorized'` | No valid session |
| `'Transaction failed'` | `withTransaction` returned false (DB write error) |
| `'Order not found'` | orderId does not exist in pos_orders.json |
| `'Table not found'` | tableId does not exist in pos_tables.json |
| `'KOT not found'` | kotId does not exist in pos_kots.json |
| `'Order is not open'` | Mutation requires open status; order is billed/paid/voided |
| `'Table already has an open order'` | Attempt to create second open order on occupied table |
| `'Table has an active open order and cannot be deactivated'` | Req 1.3 guard |
| `'Active table limit (50) reached'` | Req 1.4 guard |
| `'A table with this name already exists'` | Req 1.5 / 1.2 guard |
| `'No new items to send to kitchen'` | fireKot with empty delta |
| `'Order has no items'` | generateBill / fireKot on empty order |
| `'Discount cannot exceed the subtotal'` | Req 4.1 guard |
| `'ZERO_BILL_CONFIRM_REQUIRED'` | Zero-value bill; client must re-submit with confirmed=true |
| `'A paid order cannot be reopened'` | Req 4.11 — explicit error for blocked state transition |
| `'Payment amounts do not balance with total payable'` | Req 5.3 guard |
| `'Order can only be voided on the day it was paid'` | Req 5.8 cross-day void guard |
| `'Only open or paid orders can be voided'` | Attempt to void a billed or already-voided order |
| `'KOT is already served'` | advanceKotStatus on terminal status |
| `'Invalid KOT status transition'` | advanceKotStatus backward or unknown status |
| `'No new items to send to kitchen'` | fireKot delta is empty |
| `'Forbidden: waiters can only edit their own orders'` | Waiter attempting to edit or fire KOT for another waiter's order |
| `'Forbidden: billing role cannot create orders'` | `billing` role calling `createOrder` |
| `'Forbidden: kitchen role cannot generate bills'` | `kitchen` role calling `generateBill` |
| `'Branch is required for this role'` | `billing`/`kitchen`/`waiter` user created without `branchId` |
| `'POS module is disabled'` | Access to any `/management/pos/*` when `config.pos === false` |

### KOT delta edge cases

- If an item was previously in a KOT and is then removed from the order, the KOT record is not retroactively modified (Req 3.6). The kitchen is not notified of removals.
- If an item quantity is decreased but remains positive, no new KOT is generated (the delta for that item is zero or negative, so it is excluded from the next KOT's delta).

### Module disabled guard

`src/app/management/pos/page.tsx` reads `config.pos` and redirects to `/management` if absent or false. `src/proxy.ts` (middleware) does not need updating — the page-level redirect is sufficient for this module since it does not have its own session gate beyond the existing `/management/*` gate.

---

## Testing Strategy

### Unit tests (Vitest, `test/unit/actions/pos.test.ts`)

Mock `@/lib/db` (all `readJSON` / `writeJSON` / `withTransaction` calls) and `@/app/actions/auth` (`getSession`, `requireBranchAccess`) with `vi.mock` / `vi.spyOn`.

Focus areas:
- Each server action: success path, role-denied path, branch-denied path, guard-flag paths (notFound, notOpen, etc.)
- `computePosEodData`: all status combinations, edge cases (empty array, all voided)
- KOT delta algorithm: zero prior KOTs, partial prior KOTs, full delta, empty delta
- Bill arithmetic: zero items, max quantity, discount edge cases

### Property-based tests (fast-check, `test/unit/lib/posProperties.test.ts`)

Uses `fc` (fast-check) with minimum 100 runs per property. Each test is tagged:

```typescript
// Feature: pos-billing-kot, Property 1: Bill arithmetic invariants
```

Properties to implement:
- **Property 1**: Generate arbitrary OrderItems arrays + discount + gst; verify all four bill invariants.
- **Property 2**: Generate paid orders with consistent payment; verify cashAmount + upiAmount = totalPayable.
- **Property 3**: Generate order item states + sequences of KOT fires; verify delta quantities.
- **Property 4**: Generate n fire-KOT calls; verify sequential numbering [1..n].
- **Property 5**: Generate manager sessions + branchId inputs; verify branch filter applied.
- **Property 7**: Generate sequences of takeaway order creation; verify no duplicate takeawayNumbers among non-voided.
- **Property 8**: Generate OrderItems + quantity-update calls; verify unitPrice unchanged.
- **Property 9**: Generate mixed-status order collections; verify computePosEodData aggregates correctly.
- **Property 10**: Generate table creation/rename sequences; verify name uniqueness among active tables.
- **Property 11**: Generate subtotal + GST rate; verify suggestion = Math.round(subtotal * rate / 100).
- **Property 12**: Generate arbitrary PosOrders with varied openedBy values; verify waiter sessions only mutate their own orders.

### Integration tests (Playwright, `test/integration/pos.spec.ts`)

- Full order-to-payment flow: create order → add items → fire KOT → generate bill → record payment → verify EOD pre-fill.
- Manager branch isolation: verify manager cannot see another branch's tables.
- Module toggle: disable POS in settings → nav link disappears → direct URL redirects to dashboard.
- Stale order banner: seed an open order from a prior date, load POS, verify banner shows.
- Waiter role isolation: waiter A creates an order; waiter B cannot addOrUpdateOrderItem or fireKot on that order; both receive appropriate Forbidden errors.
- Billing role page-lock: a user with billing role is redirected from /management, /management/pos, and /management/pos/kitchen to /management/pos/billing.
- Kitchen role KOT display: kitchen user sees KOTs for their branch in FIFO order; advanceKotStatus advances correctly; no financial data is visible.
- POS role redirect via proxy: all three posRole types are redirected to their designated page from any other /management/* URL.
- Billing generate-and-pay: billing clerk can generate a bill for an open order and record payment; table becomes available after payment.

// ─── POS Data Model Types ─────────────────────────────────────────
// Canonical type definitions for the POS / Billing / KOT module.
// Imported by: pos.ts, eod/page.tsx, posUtils.ts, tests, client components.

// ─── Enums ────────────────────────────────────────────────────────

export type OrderType   = 'dine-in' | 'takeaway'
export type OrderStatus = 'open' | 'billed' | 'paid' | 'voided'
export type KotStatus   = 'pending' | 'preparing' | 'ready' | 'served'

// ─── pos_tables.json ──────────────────────────────────────────────

export type PosTable = {
  id: string          // 'ptbl_' + randomUUID()
  branchId: string
  name: string        // 1–50 chars, unique per branch among isActive=true rows
  isActive: boolean   // soft delete
  createdAt: string   // ISO timestamp
  updatedAt: string
  deletedAt?: string
}

// ─── pos_orders.json ──────────────────────────────────────────────

export type OrderItem = {
  id: string            // 'oi_' + randomUUID()
  menuItemId: string
  variantId?: string
  nameSnapshot: string  // captured at time of ordering — never updated post-creation
  unitPrice: number     // integer rupees, Effective_Price at time of ordering — immutable
  quantity: number      // 1–99 inclusive
  note?: string         // max 80 chars
}

export type BillSnapshot = {
  subtotal: number      // Σ (item.quantity × item.unitPrice) — integer rupees
  discount: number      // integer rupees, 0 ≤ discount ≤ subtotal
  gst: number           // integer rupees, ≥ 0, user-confirmed value
  totalPayable: number  // subtotal - discount + gst
  generatedAt: string   // ISO timestamp
}

export type PaymentSnapshot = {
  method: 'cash' | 'upi' | 'split'
  cashAmount: number    // integer rupees (0 for pure UPI)
  upiAmount: number     // integer rupees (0 for pure cash)
  paidAt: string        // ISO timestamp
}

export type VoidInfo = {
  reason: string        // 1–200 chars
  voidedBy: string      // userId
  voidedAt: string      // ISO timestamp
}

export type PosOrder = {
  id: string                  // 'pord_' + randomUUID()
  branchId: string
  tableId?: string            // present for dine-in; undefined for takeaway
  takeawayNumber?: string     // 'T-N' sequential per branch+date, present for takeaway
  orderType: OrderType
  covers?: number             // dine-in only; 1–30; default 1
  status: OrderStatus
  items: OrderItem[]          // embedded — no separate collection
  note?: string               // order-level note, max 200 chars
  kotCount: number            // number of KOTs successfully fired; starts at 0
  bill?: BillSnapshot         // set when status transitions to 'billed'
  payment?: PaymentSnapshot   // set when status transitions to 'paid'
  void?: VoidInfo             // set when status transitions to 'voided'
  date: string                // IST date 'YYYY-MM-DD' — set at creation
  openedBy: string            // userId of Session_User who created the order
  createdAt: string
  updatedAt: string
}

// ─── pos_kots.json ────────────────────────────────────────────────

export type KotItem = {
  menuItemId: string
  variantId?: string
  nameSnapshot: string
  quantity: number    // delta quantity (items added/increased since last KOT fire)
  note?: string
}

export type PosKot = {
  id: string          // 'pkot_' + randomUUID()
  orderId: string
  branchId: string
  kotNumber: number   // sequential within order: 1, 2, 3, …
  items: KotItem[]    // only delta items at time of fire
  status: KotStatus
  firedBy: string     // userId
  firedAt: string     // ISO timestamp
  updatedAt: string
}

// ─── Menu Catalog (read-only from POS perspective) ────────────────

export type CatalogItem = {
  menuItemId: string
  variantId?: string
  name: string
  categoryId: string
  categoryName?: string
  effectivePrice: number  // integer rupees — branch override or basePrice
  dietary?: string
  prepTimeMins?: number
}

// ─── EOD Pre-fill Data ────────────────────────────────────────────

export type PosEodData = {
  // income pre-fill
  dineInCash: number
  dineInUpi: number
  takeawayCash: number
  takeawayUpi: number
  // billing section pre-fill
  totalBillAmount: number
  billCount: number
  dineInCovers: number        // count of paid dine-in orders
  takeawayOrders: number
  cashCollectedAsBilled: number
  upiCollectedAsBilled: number
  voids: number
  discounts: number
  gstCollected: number
}

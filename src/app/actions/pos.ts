'use server'

import { z } from 'zod'
import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'

import { readJSON, withTransaction, DB_FILES, readBranchMenuItems } from '@/lib/db'
import { getSession, requireBranchAccess } from '@/app/actions/auth'
import { logAction } from '@/lib/audit'
import {
  canCreateOrder,
  canFireKot,
  canGenerateBill,
  canRecordPayment,
  canAdvanceKot,
  canVoidOrder,
  canViewHistory,
  isWaiterOwnOrder,
  computePosEodData,
} from '@/lib/posUtils'

import type {
  PosTable,
  PosOrder,
  PosKot,
  KotItem,
  CatalogItem,
  OrderType,
  OrderStatus,
} from './posTypes'

// ─── IST date helper ──────────────────────────────────────────────

function todayIST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
}

function nowISO(): string {
  return new Date().toISOString()
}


// ─── getTodayPosData ──────────────────────────────────────────────

type MenuItem = {
  id: string
  name: string
  basePrice: number
  categoryId: string
  isActive: boolean
  dietary?: string
  prepTimeMins?: number
}

type MenuItemVariant = {
  id: string
  menuItemId: string
  name: string
  basePrice: number
  isActive: boolean
}

type BranchMenuItemRow = {
  branchId: string
  menuItemId: string
  variantId?: string
  isAvailable: boolean
  price: number | null
}

export async function getTodayPosData(branchId: string) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }

  let enforcedBranchId: string
  try {
    enforcedBranchId = await requireBranchAccess(branchId)
  } catch {
    return { error: 'BranchAccessDenied' }
  }

  const today = todayIST()

  // Read POS data
  const allTables = await readJSON<PosTable>(DB_FILES.POS_TABLES).catch(() => [])
  const tables = allTables
    .filter(t => t.branchId === enforcedBranchId && t.isActive)
    .sort((a, b) => a.name.localeCompare(b.name))

  const allOrders = await readJSON<PosOrder>(DB_FILES.POS_ORDERS).catch(() => [])
  const orders = allOrders.filter(o => o.branchId === enforcedBranchId && o.date === today)

  const orderIds = new Set(orders.map(o => o.id))
  const allKots = await readJSON<PosKot>(DB_FILES.POS_KOTS).catch(() => [])
  const kots = allKots.filter(k => k.branchId === enforcedBranchId && orderIds.has(k.orderId))

  // Build branch menu catalog
  const allMenuItems = await readJSON<MenuItem>(DB_FILES.MENU).catch(() => [])
  const activeMenuItems = allMenuItems.filter(m => m.isActive === true)

  const allCategories = await readJSON<{ id: string; name: string }>(DB_FILES.MENU_CATEGORIES).catch(() => [])
  const categoryMap = new Map<string, string>()
  for (const c of allCategories) {
    categoryMap.set(c.id, c.name)
  }

  const branchRows = await readBranchMenuItems<BranchMenuItemRow>(enforcedBranchId)

  // Build a lookup map for branch overrides (only item-level rows, no variantId)
  const branchItemMap = new Map<string, BranchMenuItemRow>()
  for (const row of branchRows) {
    if (!row.variantId) {
      branchItemMap.set(row.menuItemId, row)
    }
  }

  const catalog: CatalogItem[] = []

  for (const item of activeMenuItems) {
    const branchRow = branchItemMap.get(item.id)

    // If branchRow exists and isAvailable is explicitly false, exclude
    if (branchRow && branchRow.isAvailable === false) continue
    // If no branchRow: default = available (consistent with menu system)

    const effectivePrice = (branchRow && branchRow.price !== null)
      ? branchRow.price
      : item.basePrice

    catalog.push({
      menuItemId: item.id,
      name: item.name,
      categoryId: item.categoryId,
      categoryName: categoryMap.get(item.categoryId) || undefined,
      effectivePrice,
      dietary: item.dietary,
      prepTimeMins: item.prepTimeMins,
    })
  }

  // Load variants
  const allVariants = await readJSON<MenuItemVariant>(DB_FILES.MENU_ITEM_VARIANTS).catch(() => [])
  const catalogItemIds = new Set(catalog.map(c => c.menuItemId))

  // Build variant-level branch override map
  const branchVariantMap = new Map<string, BranchMenuItemRow>()
  for (const row of branchRows) {
    if (row.variantId) {
      branchVariantMap.set(`${row.menuItemId}_${row.variantId}`, row)
    }
  }

  for (const v of allVariants) {
    if (!v.isActive || !catalogItemIds.has(v.menuItemId)) continue

    const variantBranchRow = branchVariantMap.get(`${v.menuItemId}_${v.id}`)
    if (variantBranchRow && variantBranchRow.isAvailable === false) continue

    const parentItem = activeMenuItems.find(m => m.id === v.menuItemId)
    const effectivePrice = (variantBranchRow && variantBranchRow.price !== null)
      ? variantBranchRow.price
      : v.basePrice

    const parentCatId = parentItem?.categoryId ?? ''
    catalog.push({
      menuItemId: v.menuItemId,
      variantId: v.id,
      name: `${parentItem?.name ?? ''} - ${v.name}`,
      categoryId: parentCatId,
      categoryName: categoryMap.get(parentCatId) || undefined,
      effectivePrice,
      dietary: parentItem?.dietary,
      prepTimeMins: parentItem?.prepTimeMins,
    })
  }

  return { tables, orders, kots, catalog, todayIST: today }
}

// ─── Table Management ─────────────────────────────────────────────

const tableNameSchema = z.string().min(1, 'Table name is required').max(50, 'Table name must be at most 50 characters')

export async function createTable(prevState: unknown, formData: FormData) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  if (!session.isGlobalAdmin && session.role !== 'manager') return { error: 'Forbidden' }

  const name = (formData.get('name') as string)?.trim()
  const branchId = formData.get('branchId') as string

  const parsed = tableNameSchema.safeParse(name)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const branchParsed = z.string().min(1).safeParse(branchId)
  if (!branchParsed.success) return { error: 'Branch is required' }

  let enforcedBranchId: string
  try {
    enforcedBranchId = await requireBranchAccess(branchId)
  } catch {
    return { error: 'BranchAccessDenied' }
  }

  let limitReached = false
  let duplicateName = false
  const now = nowISO()

  const success = await withTransaction<PosTable>(DB_FILES.POS_TABLES, (tables) => {
    const activeTables = tables.filter(t => t.branchId === enforcedBranchId && t.isActive)

    if (activeTables.length >= 50) {
      limitReached = true
      return tables
    }

    if (activeTables.some(t => t.name.toLowerCase() === name.toLowerCase())) {
      duplicateName = true
      return tables
    }

    tables.push({
      id: `ptbl_${randomUUID()}`,
      branchId: enforcedBranchId,
      name,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })

    return tables
  })

  if (limitReached) return { error: 'Active table limit (50) reached' }
  if (duplicateName) return { error: 'A table with this name already exists' }
  if (!success) return { error: 'Transaction failed' }

  revalidatePath('/management/pos')
  return { success: true }
}

export async function renameTable(prevState: unknown, formData: FormData) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  if (!session.isGlobalAdmin && session.role !== 'manager') return { error: 'Forbidden' }

  const tableId = formData.get('tableId') as string
  const newName = (formData.get('newName') as string)?.trim()
  const branchId = formData.get('branchId') as string

  const parsed = tableNameSchema.safeParse(newName)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  let enforcedBranchId: string
  try {
    enforcedBranchId = await requireBranchAccess(branchId)
  } catch {
    return { error: 'BranchAccessDenied' }
  }

  let notFound = false
  let duplicateName = false
  const now = nowISO()

  const success = await withTransaction<PosTable>(DB_FILES.POS_TABLES, (tables) => {
    const table = tables.find(t => t.id === tableId && t.branchId === enforcedBranchId)
    if (!table) {
      notFound = true
      return tables
    }

    if (tables.some(t =>
      t.id !== tableId &&
      t.isActive &&
      t.branchId === enforcedBranchId &&
      t.name.toLowerCase() === newName.toLowerCase()
    )) {
      duplicateName = true
      return tables
    }

    table.name = newName
    table.updatedAt = now

    return tables
  })

  if (notFound) return { error: 'Table not found' }
  if (duplicateName) return { error: 'A table with this name already exists' }
  if (!success) return { error: 'Transaction failed' }

  revalidatePath('/management/pos')
  return { success: true }
}

export async function deactivateTable(tableId: string) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  if (!session.isGlobalAdmin && session.role !== 'manager') return { error: 'Forbidden' }

  // Load the table to verify branch access
  const allTables = await readJSON<PosTable>(DB_FILES.POS_TABLES).catch(() => [])
  const table = allTables.find(t => t.id === tableId)
  if (!table) return { error: 'Table not found' }

  try {
    await requireBranchAccess(table.branchId)
  } catch {
    return { error: 'BranchAccessDenied' }
  }

  // Check for active orders on this table
  const allOrders = await readJSON<PosOrder>(DB_FILES.POS_ORDERS).catch(() => [])
  const hasOpenOrder = allOrders.some(o => o.tableId === tableId && o.status === 'open')
  if (hasOpenOrder) {
    return { error: 'Table has an active open order and cannot be deactivated' }
  }

  let notFound = false
  const now = nowISO()

  const success = await withTransaction<PosTable>(DB_FILES.POS_TABLES, (tables) => {
    const t = tables.find(t => t.id === tableId)
    if (!t) {
      notFound = true
      return tables
    }
    t.isActive = false
    t.deletedAt = now
    t.updatedAt = now
    return tables
  })

  if (notFound) return { error: 'Table not found' }
  if (!success) return { error: 'Transaction failed' }

  revalidatePath('/management/pos')
  return { success: true }
}

// ─── Order Lifecycle ──────────────────────────────────────────────

export async function createOrder(prevState: unknown, formData: FormData) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  if (!canCreateOrder(session.role)) return { error: 'Forbidden' }

  const orderType = formData.get('orderType') as OrderType
  const covers = Number(formData.get('covers')) || 1
  const branchId = formData.get('branchId') as string
  const tableId = formData.get('tableId') as string | null
  const orderNote = (formData.get('note') as string)?.trim() || undefined

  // Validate
  const schema = z.object({
    orderType: z.enum(['dine-in', 'takeaway']),
    covers: z.number().int().min(1).max(30),
    branchId: z.string().min(1),
  })
  const parsed = schema.safeParse({ orderType, covers, branchId })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  // Cross-field validation
  if (orderType === 'dine-in' && !tableId) return { error: 'Table is required for dine-in orders' }
  if (orderType === 'takeaway' && tableId) return { error: 'Takeaway orders must not have a table assigned' }

  let enforcedBranchId: string
  try {
    enforcedBranchId = await requireBranchAccess(branchId)
  } catch {
    return { error: 'BranchAccessDenied' }
  }

  const today = todayIST()
  const now = nowISO()
  let newOrderId = ''

  let occupied = false
  let missingTable = false

  const success = await withTransaction<PosOrder>(DB_FILES.POS_ORDERS, (orders) => {
    if (orderType === 'dine-in') {
      if (!tableId) { missingTable = true; return orders }
      if (orders.some(o => o.tableId === tableId && o.status === 'open')) {
        occupied = true
        return orders
      }
    }

    let takeawayNumber: string | undefined
    if (orderType === 'takeaway') {
      const todayTakeaways = orders.filter(o =>
        o.branchId === enforcedBranchId &&
        o.date === today &&
        o.orderType === 'takeaway' &&
        o.status !== 'voided'
      )
      takeawayNumber = `T-${todayTakeaways.length + 1}`
    }

    newOrderId = `pord_${randomUUID()}`
    orders.push({
      id: newOrderId,
      branchId: enforcedBranchId,
      tableId: orderType === 'dine-in' ? (tableId as string) : undefined,
      takeawayNumber,
      orderType,
      covers: orderType === 'dine-in' ? covers : undefined,
      status: 'open',
      items: [],
      note: orderNote,
      kotCount: 0,
      date: today,
      openedBy: session.userId,
      createdAt: now,
      updatedAt: now,
    })

    return orders
  })

  if (missingTable) return { error: 'Table is required for dine-in orders' }
  if (occupied) return { error: 'Table already has an open order' }
  if (!success) return { error: 'Transaction failed' }

  await logAction('CREATE_POS_ORDER', 'POS_ORDER', JSON.stringify({ branchId: enforcedBranchId, orderType, tableId }), newOrderId)
  revalidatePath('/management/pos')
  return { success: true }
}

export async function addOrUpdateOrderItem(
  orderId: string,
  menuItemId: string,
  quantity: number,
  unitPrice: number,
  nameSnapshot: string,
  variantId?: string,
  note?: string
) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  if (!canCreateOrder(session.role)) return { error: 'Forbidden' }

  const schema = z.object({
    quantity: z.number().int().min(1).max(99),
    unitPrice: z.number().int().min(0),
    nameSnapshot: z.string().min(1),
    note: z.string().max(80).optional(),
  })
  const parsed = schema.safeParse({ quantity, unitPrice, nameSnapshot, note })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  let enforcedBranchId: string
  try {
    enforcedBranchId = await requireBranchAccess(undefined)
  } catch {
    return { error: 'BranchAccessDenied' }
  }

  let notFound = false
  let branchDenied = false
  let notOpen = false
  let waiterForbidden = false
  const now = nowISO()

  const success = await withTransaction<PosOrder>(DB_FILES.POS_ORDERS, (orders) => {
    const order = orders.find(o => o.id === orderId)
    if (!order) { notFound = true; return orders }
    if (enforcedBranchId && order.branchId !== enforcedBranchId) { branchDenied = true; return orders }
    if (order.status !== 'open') { notOpen = true; return orders }
    if (!isWaiterOwnOrder(session.role, order.openedBy, session.userId)) {
      waiterForbidden = true; return orders
    }

    const existing = order.items.find(i =>
      i.menuItemId === menuItemId &&
      (i.variantId ?? undefined) === (variantId ?? undefined)
    )

    if (existing) {
      existing.quantity = quantity
      if (note !== undefined) existing.note = note || undefined
      // unitPrice is immutable — never updated on existing items
    } else {
      order.items.push({
        id: `oi_${randomUUID()}`,
        menuItemId,
        variantId,
        nameSnapshot,
        unitPrice,
        quantity,
        note: note || undefined,
      })
    }
    order.updatedAt = now

    return orders
  })

  if (notFound) return { error: 'Order not found' }
  if (branchDenied) return { error: 'BranchAccessDenied' }
  if (notOpen) return { error: 'Order is not open' }
  if (waiterForbidden) return { error: 'Forbidden: waiters can only edit their own orders' }
  if (!success) return { error: 'Transaction failed' }

  revalidatePath('/management/pos')
  return { success: true }
}

export async function removeOrderItem(orderId: string, orderItemId: string) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  if (!canCreateOrder(session.role)) return { error: 'Forbidden' }

  let enforcedBranchId: string
  try {
    enforcedBranchId = await requireBranchAccess(undefined)
  } catch {
    return { error: 'BranchAccessDenied' }
  }

  let notFound = false
  let branchDenied = false
  let notOpen = false
  let itemNotFound = false
  let waiterForbidden = false
  const now = nowISO()

  const success = await withTransaction<PosOrder>(DB_FILES.POS_ORDERS, (orders) => {
    const order = orders.find(o => o.id === orderId)
    if (!order) { notFound = true; return orders }
    if (enforcedBranchId && order.branchId !== enforcedBranchId) { branchDenied = true; return orders }
    // Req 2.6: allow removal to complete even if status changed from open
    // during the action — the guard only applies at initiation time
    if (order.status !== 'open') { notOpen = true; return orders }
    if (!isWaiterOwnOrder(session.role, order.openedBy, session.userId)) {
      waiterForbidden = true; return orders
    }

    const idx = order.items.findIndex(i => i.id === orderItemId)
    if (idx === -1) { itemNotFound = true; return orders }

    order.items.splice(idx, 1)
    order.updatedAt = now

    return orders
  })

  if (notFound) return { error: 'Order not found' }
  if (branchDenied) return { error: 'BranchAccessDenied' }
  if (notOpen) return { error: 'Order is not open' }
  if (waiterForbidden) return { error: 'Forbidden: waiters can only edit their own orders' }
  if (itemNotFound) return { error: 'Order item not found' }
  if (!success) return { error: 'Transaction failed' }

  revalidatePath('/management/pos')
  return { success: true }
}

export async function updateOrderNote(orderId: string, note: string) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  if (!canCreateOrder(session.role)) return { error: 'Forbidden' }

  const parsed = z.string().max(200).safeParse(note)
  if (!parsed.success) return { error: 'Note must be at most 200 characters' }

  let enforcedBranchId: string
  try {
    enforcedBranchId = await requireBranchAccess(undefined)
  } catch {
    return { error: 'BranchAccessDenied' }
  }

  let notFound = false
  let branchDenied = false
  let notOpen = false
  let waiterForbidden = false
  const now = nowISO()

  const success = await withTransaction<PosOrder>(DB_FILES.POS_ORDERS, (orders) => {
    const order = orders.find(o => o.id === orderId)
    if (!order) { notFound = true; return orders }
    if (enforcedBranchId && order.branchId !== enforcedBranchId) { branchDenied = true; return orders }
    if (order.status !== 'open') { notOpen = true; return orders }
    if (!isWaiterOwnOrder(session.role, order.openedBy, session.userId)) {
      waiterForbidden = true; return orders
    }

    order.note = note || undefined
    order.updatedAt = now

    return orders
  })

  if (notFound) return { error: 'Order not found' }
  if (branchDenied) return { error: 'BranchAccessDenied' }
  if (notOpen) return { error: 'Order is not open' }
  if (waiterForbidden) return { error: 'Forbidden: waiters can only edit their own orders' }
  if (!success) return { error: 'Transaction failed' }

  revalidatePath('/management/pos')
  return { success: true }
}

// ─── KOT ──────────────────────────────────────────────────────────

export async function fireKot(orderId: string) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  if (!canFireKot(session.role)) return { error: 'Forbidden' }

  let enforcedBranchId: string
  try {
    enforcedBranchId = await requireBranchAccess(undefined)
  } catch {
    return { error: 'BranchAccessDenied' }
  }

  // Load order
  const allOrders = await readJSON<PosOrder>(DB_FILES.POS_ORDERS).catch(() => [])
  const order = allOrders.find(o => o.id === orderId)
  if (!order) return { error: 'Order not found' }
  if (enforcedBranchId && order.branchId !== enforcedBranchId) return { error: 'BranchAccessDenied' }
  if (order.status !== 'open') return { error: 'Order is not open' }
  if (!isWaiterOwnOrder(session.role, order.openedBy, session.userId)) {
    return { error: 'Forbidden: waiters can only edit their own orders' }
  }
  if (order.items.length === 0) return { error: 'Order has no items' }

  // Load prior KOTs for delta computation
  const allKots = await readJSON<PosKot>(DB_FILES.POS_KOTS).catch(() => [])
  const priorKots = allKots.filter(k => k.orderId === orderId)

  // Compute delta per item
  const kotItems: KotItem[] = []
  for (const item of order.items) {
    const priorTotal = priorKots.reduce((sum, kot) => {
      return sum + kot.items
        .filter(ki =>
          ki.menuItemId === item.menuItemId &&
          (ki.variantId ?? undefined) === (item.variantId ?? undefined)
        )
        .reduce((s, ki) => s + ki.quantity, 0)
    }, 0)

    const delta = item.quantity - priorTotal
    if (delta > 0) {
      kotItems.push({
        menuItemId: item.menuItemId,
        variantId: item.variantId,
        nameSnapshot: item.nameSnapshot,
        quantity: delta,
        note: item.note,
      })
    }
  }

  if (kotItems.length === 0) return { error: 'No new items to send to kitchen' }

  // KOT number: derived from actual prior KOTs count (authoritative)
  const newKotNumber = priorKots.length + 1
  const now = nowISO()
  const kotId = `pkot_${randomUUID()}`

  // Persist KOT
  const kotSuccess = await withTransaction<PosKot>(DB_FILES.POS_KOTS, (kots) => {
    kots.push({
      id: kotId,
      orderId,
      branchId: order.branchId,
      kotNumber: newKotNumber,
      items: kotItems,
      status: 'pending',
      firedBy: session.userId,
      firedAt: now,
      updatedAt: now,
    })
    return kots
  })

  if (!kotSuccess) return { error: 'Transaction failed' }

  // Sync order.kotCount cache (warn on failure but don't fail the action)
  const orderUpdateSuccess = await withTransaction<PosOrder>(DB_FILES.POS_ORDERS, (orders) => {
    const o = orders.find(o => o.id === orderId)
    if (o) {
      o.kotCount = newKotNumber
      o.updatedAt = now
    }
    return orders
  })
  if (!orderUpdateSuccess) {
    console.warn(`[POS] Failed to sync order.kotCount for ${orderId}, but KOT ${kotId} was persisted successfully.`)
  }

  await logAction('FIRE_KOT', 'POS_KOT', JSON.stringify({ orderId, kotNumber: newKotNumber, itemCount: kotItems.length }), kotId)
  revalidatePath('/management/pos')
  return { success: true }
}

// ─── Bill Generation ──────────────────────────────────────────────

export async function generateBill(prevState: unknown, formData: FormData) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  if (!canGenerateBill(session.role)) return { error: 'Forbidden' }

  const orderId = formData.get('orderId') as string
  const discount = Number(formData.get('discount')) || 0
  const gst = Number(formData.get('gst')) || 0
  const confirmed = formData.get('confirmed') === 'true'

  const schema = z.object({
    discount: z.number().int().min(0),
    gst: z.number().int().min(0),
  })
  const parsed = schema.safeParse({ discount, gst })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  let enforcedBranchId: string
  try {
    enforcedBranchId = await requireBranchAccess(undefined)
  } catch {
    return { error: 'BranchAccessDenied' }
  }

  let notFound = false
  let branchDenied = false
  let alreadyBilled = false
  let notOpen = false
  let noItems = false
  let discountExceedsSubtotal = false
  let zeroBillUnconfirmed = false
  let computedSubtotal = 0
  let computedTotal = 0
  const now = nowISO()

  const success = await withTransaction<PosOrder>(DB_FILES.POS_ORDERS, (orders) => {
    const order = orders.find(o => o.id === orderId)
    if (!order) { notFound = true; return orders }
    if (enforcedBranchId && order.branchId !== enforcedBranchId) { branchDenied = true; return orders }
    if (order.status === 'billed') { alreadyBilled = true; return orders }
    if (order.status !== 'open') { notOpen = true; return orders }
    if (order.items.length === 0) { noItems = true; return orders }

    const subtotal = order.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
    if (discount > subtotal) { discountExceedsSubtotal = true; return orders }

    const totalPayable = subtotal - discount + gst
    if (totalPayable === 0 && !confirmed) {
      zeroBillUnconfirmed = true
      return orders
    }

    computedSubtotal = subtotal
    computedTotal = totalPayable

    order.bill = { subtotal, discount, gst, totalPayable, generatedAt: now }
    order.status = 'billed'
    order.updatedAt = now

    return orders
  })

  if (notFound) return { error: 'Order not found' }
  if (branchDenied) return { error: 'BranchAccessDenied' }
  if (alreadyBilled) return { success: true } // no-op: already billed
  if (notOpen) return { error: 'Order is not open' }
  if (noItems) return { error: 'Order has no items' }
  if (discountExceedsSubtotal) return { error: 'Discount cannot exceed the subtotal' }
  if (zeroBillUnconfirmed) return { error: 'ZERO_BILL_CONFIRM_REQUIRED' }
  if (!success) return { error: 'Transaction failed' }

  await logAction('GENERATE_BILL', 'POS_ORDER', JSON.stringify({ orderId, subtotal: computedSubtotal, discount, gst, totalPayable: computedTotal }), orderId)
  revalidatePath('/management/pos')
  return { success: true }
}

// ─── Reopen Order ─────────────────────────────────────────────────

export async function reopenOrder(orderId: string) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  if (!session.isGlobalAdmin && session.role !== 'manager') return { error: 'Forbidden' }

  let enforcedBranchId: string
  try {
    enforcedBranchId = await requireBranchAccess(undefined)
  } catch {
    return { error: 'BranchAccessDenied' }
  }

  let notFound = false
  let branchDenied = false
  let isPaid = false
  let wrongStatus = false
  const now = nowISO()

  const success = await withTransaction<PosOrder>(DB_FILES.POS_ORDERS, (orders) => {
    const order = orders.find(o => o.id === orderId)
    if (!order) { notFound = true; return orders }
    if (enforcedBranchId && order.branchId !== enforcedBranchId) { branchDenied = true; return orders }
    if (order.status === 'paid') { isPaid = true; return orders }
    if (order.status !== 'billed') { wrongStatus = true; return orders }

    order.status = 'open'
    order.bill = undefined
    order.updatedAt = now

    return orders
  })

  if (notFound) return { error: 'Order not found' }
  if (branchDenied) return { error: 'BranchAccessDenied' }
  if (isPaid) return { error: 'A paid order cannot be reopened' }
  if (wrongStatus) return { error: 'Only billed orders can be reopened' }
  if (!success) return { error: 'Transaction failed' }

  await logAction('REOPEN_POS_ORDER', 'POS_ORDER', JSON.stringify({ orderId }), orderId)
  revalidatePath('/management/pos')
  return { success: true }
}

// ─── Payment ──────────────────────────────────────────────────────

export async function recordPayment(prevState: unknown, formData: FormData) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  if (!canRecordPayment(session.role)) return { error: 'Forbidden' }

  const orderId = formData.get('orderId') as string
  const method = formData.get('method') as 'cash' | 'upi' | 'split'
  let cashAmount = Number(formData.get('cashAmount')) || 0
  let upiAmount = Number(formData.get('upiAmount')) || 0
  const cashTendered = Number(formData.get('cashTendered')) || 0

  const schema = z.object({
    method: z.enum(['cash', 'upi', 'split']),
    cashAmount: z.number().int().min(0),
    upiAmount: z.number().int().min(0),
    cashTendered: z.number().int().min(0),
  })
  const parsed = schema.safeParse({ method, cashAmount, upiAmount, cashTendered })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  let enforcedBranchId: string
  try {
    enforcedBranchId = await requireBranchAccess(undefined)
  } catch {
    return { error: 'BranchAccessDenied' }
  }

  let notFound = false
  let branchDenied = false
  let notBilled = false
  let noBill = false
  let mismatch = false
  let cashAmountStored = 0
  const now = nowISO()

  const success = await withTransaction<PosOrder>(DB_FILES.POS_ORDERS, (orders) => {
    const order = orders.find(o => o.id === orderId)
    if (!order) { notFound = true; return orders }
    if (enforcedBranchId && order.branchId !== enforcedBranchId) { branchDenied = true; return orders }
    if (order.status !== 'billed') { notBilled = true; return orders }
    if (!order.bill) { noBill = true; return orders }

    const totalPayable = order.bill.totalPayable

    // Enforce method-amount consistency
    if (method === 'cash') { cashAmount = totalPayable; upiAmount = 0 }
    if (method === 'upi') { upiAmount = totalPayable; cashAmount = 0 }

    if (cashAmount + upiAmount !== totalPayable) { mismatch = true; return orders }
    if (totalPayable > 0 && cashAmount === 0 && upiAmount === 0) { mismatch = true; return orders }

    cashAmountStored = cashAmount
    order.payment = { method, cashAmount: cashAmountStored, upiAmount, paidAt: now }
    order.status = 'paid'
    order.updatedAt = now

    return orders
  })

  if (notFound) return { error: 'Order not found' }
  if (branchDenied) return { error: 'BranchAccessDenied' }
  if (notBilled) return { error: 'Order must be billed before payment' }
  if (noBill) return { error: 'Order has no bill' }
  if (mismatch) return { error: 'Payment amounts do not balance with total payable' }
  if (!success) return { error: 'Transaction failed' }

  const changeDue = (method === 'cash' || method === 'split') ? Math.max(0, cashTendered - cashAmountStored) : 0

  await logAction('RECORD_PAYMENT', 'POS_ORDER', JSON.stringify({ orderId, method, cashAmount: cashAmountStored, upiAmount, totalPayable: cashAmountStored + upiAmount }), orderId)
  revalidatePath('/management/pos')
  return { success: true, changeDue }
}

// ─── Void Order ───────────────────────────────────────────────────

export async function voidOrder(prevState: unknown, formData: FormData) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }

  const orderId = formData.get('orderId') as string
  const reason = (formData.get('reason') as string)?.trim()

  const parsed = z.string().min(1, 'Void reason is required').max(200).safeParse(reason)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  let enforcedBranchId: string
  try {
    enforcedBranchId = await requireBranchAccess(undefined)
  } catch {
    return { error: 'BranchAccessDenied' }
  }

  let notFound = false
  let branchDenied = false
  let forbidden = false
  let crossDay = false
  let wrongStatus = false
  let previousStatus: OrderStatus | undefined
  let orderBranchId: string | undefined
  const now = nowISO()

  const success = await withTransaction<PosOrder>(DB_FILES.POS_ORDERS, (orders) => {
    const order = orders.find(o => o.id === orderId)
    if (!order) { notFound = true; return orders }
    if (enforcedBranchId && order.branchId !== enforcedBranchId) { branchDenied = true; return orders }

    orderBranchId = order.branchId
    previousStatus = order.status

    if (order.status === 'paid') {
      if (!session.isGlobalAdmin) { forbidden = true; return orders }
      const today = todayIST()
      // Convert paidAt to IST date
      const paidDate = new Date(order.payment!.paidAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
      if (paidDate !== today) { crossDay = true; return orders }
    } else if (order.status === 'open') {
      if (!canVoidOrder(session.role, 'open')) { forbidden = true; return orders }
    } else {
      wrongStatus = true; return orders
    }

    order.void = { reason: reason!, voidedBy: session.userId, voidedAt: now }
    order.status = 'voided'
    order.updatedAt = now

    return orders
  })

  if (notFound) return { error: 'Order not found' }
  if (branchDenied) return { error: 'BranchAccessDenied' }
  if (forbidden) return { error: 'Forbidden' }
  if (crossDay) return { error: 'Order can only be voided on the day it was paid' }
  if (wrongStatus) return { error: 'Only open or paid orders can be voided' }
  if (!success) return { error: 'Transaction failed' }

  await logAction('VOID_POS_ORDER', 'POS_ORDER', JSON.stringify({ orderId, reason, previousStatus, branchId: orderBranchId || enforcedBranchId }), orderId)
  revalidatePath('/management/pos')
  return { success: true }
}

// ─── KOT Status Advancement ──────────────────────────────────────

const KOT_SEQUENCE = ['pending', 'preparing', 'ready', 'served'] as const

export async function advanceKotStatus(kotId: string) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  if (!canAdvanceKot(session.role)) return { error: 'Forbidden' }

  let enforcedBranchId: string
  try {
    enforcedBranchId = await requireBranchAccess(undefined)
  } catch {
    return { error: 'BranchAccessDenied' }
  }

  let notFound = false
  let branchDenied = false
  let invalidTransition = false
  let alreadyServed = false
  const now = nowISO()

  const success = await withTransaction<PosKot>(DB_FILES.POS_KOTS, (kots) => {
    const kot = kots.find(k => k.id === kotId)
    if (!kot) { notFound = true; return kots }
    if (enforcedBranchId && kot.branchId !== enforcedBranchId) { branchDenied = true; return kots }

    const currentIdx = KOT_SEQUENCE.indexOf(kot.status as typeof KOT_SEQUENCE[number])
    if (currentIdx === -1) { invalidTransition = true; return kots }
    if (currentIdx === KOT_SEQUENCE.length - 1) { alreadyServed = true; return kots }

    kot.status = KOT_SEQUENCE[currentIdx + 1]
    kot.updatedAt = now

    return kots
  })

  if (notFound) return { error: 'KOT not found' }
  if (branchDenied) return { error: 'BranchAccessDenied' }
  if (alreadyServed) return { error: 'KOT is already served' }
  if (invalidTransition) return { error: 'Invalid KOT status transition' }
  if (!success) return { error: 'Transaction failed' }

  revalidatePath('/management/pos')
  return { success: true }
}

// ─── Read Actions ─────────────────────────────────────────────────

export async function getKitchenKots(branchId: string) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  if (!canAdvanceKot(session.role) && !session.isGlobalAdmin) return { error: 'Forbidden' }

  let enforcedBranchId: string
  try {
    enforcedBranchId = await requireBranchAccess(branchId)
  } catch {
    return { error: 'BranchAccessDenied' }
  }

  const today = todayIST()
  const allOrders = await readJSON<PosOrder>(DB_FILES.POS_ORDERS).catch(() => [])
  const todayOrders = allOrders.filter(o => o.branchId === enforcedBranchId && o.date === today)

  // Build order map for resolving identifiers
  const orderMap = new Map<string, { tableId?: string; takeawayNumber?: string; orderType: OrderType }>()
  for (const o of todayOrders) {
    orderMap.set(o.id, { tableId: o.tableId, takeawayNumber: o.takeawayNumber, orderType: o.orderType })
  }

  // Load tables for name resolution
  const allTables = await readJSON<PosTable>(DB_FILES.POS_TABLES).catch(() => [])
  const tableMap = new Map<string, string>()
  for (const t of allTables) {
    tableMap.set(t.id, t.name)
  }

  const orderIds = new Set(todayOrders.map(o => o.id))
  const allKots = await readJSON<PosKot>(DB_FILES.POS_KOTS).catch(() => [])
  const activeKots = allKots
    .filter(k =>
      k.branchId === enforcedBranchId &&
      orderIds.has(k.orderId) &&
      ['pending', 'preparing', 'ready'].includes(k.status)
    )
    .sort((a, b) => a.firedAt.localeCompare(b.firedAt))

  // Strip financial data and resolve order identifiers
  const kotsWithInfo = activeKots.map(k => {
    const orderInfo = orderMap.get(k.orderId)
    const tableName = orderInfo?.tableId ? tableMap.get(orderInfo.tableId) : undefined
    const orderIdentifier = tableName || orderInfo?.takeawayNumber || 'Unknown'

    return {
      id: k.id,
      orderId: k.orderId,
      kotNumber: k.kotNumber,
      items: k.items.map(i => ({
        nameSnapshot: i.nameSnapshot,
        quantity: i.quantity,
        note: i.note,
      })),
      status: k.status,
      firedAt: k.firedAt,
      orderIdentifier,
      orderType: orderInfo?.orderType,
    }
  })

  return { kots: kotsWithInfo }
}

export async function getPosOrderHistory(branchId: string, fromDate: string, toDate: string) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  if (!canViewHistory(session.role)) return { error: 'Forbidden' }

  const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format')
  const fromParsed = dateSchema.safeParse(fromDate)
  const toParsed = dateSchema.safeParse(toDate)
  if (!fromParsed.success || !toParsed.success) return { error: 'Invalid date format' }
  if (fromDate > toDate) return { error: 'From date must be on or before to date' }

  let enforcedBranchId: string
  if (session.isGlobalAdmin) {
    enforcedBranchId = branchId
  } else {
    if (branchId !== session.branchId) {
      return { error: 'BranchAccessDenied' }
    }
    enforcedBranchId = session.branchId as string
  }

  const allOrders = await readJSON<PosOrder>(DB_FILES.POS_ORDERS).catch(() => [])
  const orders = allOrders.filter(o =>
    o.branchId === enforcedBranchId &&
    o.date >= fromDate &&
    o.date <= toDate
  )

  const paidOrders = orders.filter(o => o.status === 'paid')
  const voidedOrders = orders.filter(o => o.status === 'voided')

  const totalRevenue = paidOrders.reduce((s, o) => s + (o.bill?.totalPayable ?? 0), 0)
  const billCount = paidOrders.length
  const summary = {
    totalRevenue,
    billCount,
    avgOrderValue: billCount > 0 ? Math.round(totalRevenue / billCount) : 0,
    totalVoids: voidedOrders.length,
    totalDiscounts: paidOrders.reduce((s, o) => s + (o.bill?.discount ?? 0), 0),
  }

  return { orders, summary }
}

export async function getDailySummary(branchId: string, date: string) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  if (session.posRole || session.role === 'readonly') return { error: 'Forbidden' }

  let enforcedBranchId: string
  try {
    enforcedBranchId = await requireBranchAccess(branchId)
  } catch {
    return { error: 'BranchAccessDenied' }
  }

  const allOrders = await readJSON<PosOrder>(DB_FILES.POS_ORDERS).catch(() => [])
  const orders = allOrders.filter(o => o.branchId === enforcedBranchId && o.date === date)

  const eodData = computePosEodData(orders)
  const paidOrders = orders.filter(o => o.status === 'paid')

  return {
    ...eodData,
    totalCash: paidOrders.reduce((s, o) => s + (o.payment?.cashAmount ?? 0), 0),
    totalUpi: paidOrders.reduce((s, o) => s + (o.payment?.upiAmount ?? 0), 0),
    dineInBillCount: paidOrders.filter(o => o.orderType === 'dine-in').length,
    takeawayBillCount: paidOrders.filter(o => o.orderType === 'takeaway').length,
  }
}

export async function getPosDataForEOD(date: string, branchId: string) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }

  const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format')
  const dateParsed = dateSchema.safeParse(date)
  if (!dateParsed.success) return { error: 'Invalid date format' }

  const branchParsed = z.string().min(1).safeParse(branchId)
  if (!branchParsed.success) return { error: 'Branch is required' }

  let enforcedBranchId: string
  try {
    enforcedBranchId = await requireBranchAccess(branchId)
  } catch {
    return { error: 'BranchAccessDenied' }
  }

  const allOrders = await readJSON<PosOrder>(DB_FILES.POS_ORDERS).catch(() => [])
  const orders = allOrders.filter(o => o.branchId === enforcedBranchId && o.date === date)

  return { data: computePosEodData(orders) }
}

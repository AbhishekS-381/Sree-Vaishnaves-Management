'use server'

import { z } from 'zod'
import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { eq, and, ne, ilike, inArray, isNull, asc, gte, lte } from 'drizzle-orm'

import {
  db,
  withDbTransaction,
  posTables,
  posOrders,
  posKots,
  menuItems,
  menuCategories,
  branchMenuItems,
  menuItemVariants,
} from '@/lib/db'
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
  BillSnapshot,
} from './posTypes'

// ─── IST date helper ──────────────────────────────────────────────

function todayIST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
}

// ─── getTodayPosData ──────────────────────────────────────────────

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

  try {
    // Read POS data
    const tablesRaw = await db
      .select()
      .from(posTables)
      .where(
        and(
          eq(posTables.branchId, enforcedBranchId),
          eq(posTables.isActive, true),
          isNull(posTables.deletedAt)
        )
      )
      .orderBy(asc(posTables.name))

    const tables: PosTable[] = (tablesRaw as any[]).map((t) => ({
      id: t.id,
      branchId: t.branchId,
      name: t.name,
      isAc: Boolean(t.isAc),
      isActive: t.isActive,
      createdAt: t.createdAt instanceof Date ? t.createdAt.toISOString() : String(t.createdAt || ''),
      updatedAt: t.updatedAt instanceof Date ? t.updatedAt.toISOString() : String(t.updatedAt || ''),
      deletedAt: t.deletedAt ? (t.deletedAt instanceof Date ? t.deletedAt.toISOString() : String(t.deletedAt)) : undefined,
    }))

    const ordersRaw = await db
      .select()
      .from(posOrders)
      .where(and(eq(posOrders.branchId, enforcedBranchId), eq(posOrders.date, today)))

    const orders: PosOrder[] = (ordersRaw as any[]).map((o) => ({
      id: o.id,
      branchId: o.branchId,
      tableId: o.tableId ?? undefined,
      takeawayNumber: o.takeawayNumber ?? undefined,
      orderType: o.orderType as OrderType,
      covers: o.covers ?? undefined,
      status: o.status as OrderStatus,
      items: (o.items as any) || [],
      note: o.note ?? undefined,
      kotCount: o.kotCount ?? 0,
      bill: o.bill ?? undefined,
      payment: o.payment ?? undefined,
      void: o.void ?? undefined,
      date: o.date,
      openedBy: o.openedBy,
      createdAt: o.createdAt instanceof Date ? o.createdAt.toISOString() : String(o.createdAt || ''),
      updatedAt: o.updatedAt instanceof Date ? o.updatedAt.toISOString() : String(o.updatedAt || ''),
    }))

    const orderIds = orders.map((o) => o.id)
    let kots: PosKot[] = []

    if (orderIds.length > 0) {
      const kotsRaw = await db
        .select()
        .from(posKots)
        .where(
          and(
            eq(posKots.branchId, enforcedBranchId),
            inArray(posKots.orderId, orderIds)
          )
        )

      kots = (kotsRaw as any[]).map((k) => ({
        id: k.id,
        orderId: k.orderId,
        branchId: k.branchId,
        kotNumber: k.kotNumber,
        items: (k.items as any) || [],
        status: k.status,
        firedBy: k.firedBy,
        firedAt: k.firedAt instanceof Date ? k.firedAt.toISOString() : String(k.firedAt || ''),
        updatedAt: k.updatedAt instanceof Date ? k.updatedAt.toISOString() : String(k.updatedAt || ''),
      }))
    }

    // Build branch menu catalog
    const activeMenuItems = await db
      .select()
      .from(menuItems)
      .where(and(eq(menuItems.isActive, true), isNull(menuItems.deletedAt)))

    const allCategories = await db
      .select({ id: menuCategories.id, name: menuCategories.name })
      .from(menuCategories)
      .where(isNull(menuCategories.deletedAt))

    const categoryMap = new Map<string, string>()
    for (const c of allCategories) {
      categoryMap.set(c.id, c.name)
    }

    const branchRows = await db
      .select()
      .from(branchMenuItems)
      .where(eq(branchMenuItems.branchId, enforcedBranchId))

    // Build a lookup map for branch overrides (only item-level rows, no variantId)
    const branchItemMap = new Map<string, any>()
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

      const effectivePrice =
        branchRow && branchRow.price !== null ? branchRow.price : item.basePrice

      catalog.push({
        menuItemId: item.id,
        name: item.name,
        categoryId: item.categoryId,
        categoryName: categoryMap.get(item.categoryId) || undefined,
        effectivePrice,
        acPrice: item.acPrice ?? undefined,
        parcelPrice: item.parcelPrice ?? undefined,
        dietary: (item.dietary as string) || undefined,
        prepTimeMins: item.prepTimeMins ?? undefined,
      })
    }

    // Load variants
    const allVariants = await db
      .select()
      .from(menuItemVariants)
      .where(and(eq(menuItemVariants.isActive, true), isNull(menuItemVariants.deletedAt)))

    const catalogItemIds = new Set(catalog.map((c) => c.menuItemId))

    // Build variant-level branch override map
    const branchVariantMap = new Map<string, any>()
    for (const row of branchRows) {
      if (row.variantId) {
        branchVariantMap.set(`${row.menuItemId}_${row.variantId}`, row)
      }
    }

    for (const v of allVariants) {
      if (!v.isActive || !catalogItemIds.has(v.menuItemId)) continue

      const variantBranchRow = branchVariantMap.get(`${v.menuItemId}_${v.id}`)
      if (variantBranchRow && variantBranchRow.isAvailable === false) continue

      const parentItem = activeMenuItems.find((m) => m.id === v.menuItemId)
      const effectivePrice =
        variantBranchRow && variantBranchRow.price !== null
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
        acPrice: parentItem?.acPrice ?? undefined,
        parcelPrice: parentItem?.parcelPrice ?? undefined,
        dietary: (parentItem?.dietary as string) || undefined,
        prepTimeMins: parentItem?.prepTimeMins ?? undefined,
      })
    }

    return { tables, orders, kots, catalog, todayIST: today }
  } catch (error) {
    console.error('Failed to load today POS data:', error)
    return { error: 'Database operation failed' }
  }
}

// ─── Table Management ─────────────────────────────────────────────

const tableNameSchema = z
  .string()
  .min(1, 'Table name is required')
  .max(50, 'Table name must be at most 50 characters')

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

  try {
    const existingActive = await db
      .select({ id: posTables.id, name: posTables.name })
      .from(posTables)
      .where(
        and(
          eq(posTables.branchId, enforcedBranchId),
          eq(posTables.isActive, true),
          isNull(posTables.deletedAt)
        )
      )

    if (existingActive.length >= 50) {
      return { error: 'Active table limit (50) reached' }
    }

    if (existingActive.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
      return { error: 'A table with this name already exists' }
    }

    const isAcRaw = formData.get('isAc')
    const isAc = isAcRaw === 'true' || isAcRaw === 'on' || isAcRaw === '1'

    const now = new Date()
    await db.insert(posTables).values({
      id: randomUUID(),
      branchId: enforcedBranchId,
      name,
      isAc,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })

    revalidatePath('/management/pos')
    return { success: true }
  } catch (error) {
    console.error('Failed to create table:', error)
    return { error: 'Transaction failed' }
  }
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

  try {
    const target = await db
      .select()
      .from(posTables)
      .where(
        and(
          eq(posTables.id, tableId),
          eq(posTables.branchId, enforcedBranchId),
          isNull(posTables.deletedAt)
        )
      )
      .limit(1)

    if (target.length === 0) return { error: 'Table not found' }

    const duplicate = await db
      .select({ id: posTables.id })
      .from(posTables)
      .where(
        and(
          eq(posTables.branchId, enforcedBranchId),
          eq(posTables.isActive, true),
          isNull(posTables.deletedAt),
          ilike(posTables.name, newName),
          ne(posTables.id, tableId)
        )
      )
      .limit(1)

    if (duplicate.length > 0) {
      return { error: 'A table with this name already exists' }
    }

    const updateData: { name: string; updatedAt: Date; isAc?: boolean } = {
      name: newName,
      updatedAt: new Date(),
    }
    if (formData.has('isAc')) {
      const isAcRaw = formData.get('isAc')
      updateData.isAc = isAcRaw === 'true' || isAcRaw === 'on' || isAcRaw === '1'
    }

    await db
      .update(posTables)
      .set(updateData)
      .where(eq(posTables.id, tableId))

    revalidatePath('/management/pos')
    return { success: true }
  } catch (error) {
    console.error('Failed to rename table:', error)
    return { error: 'Transaction failed' }
  }
}

export async function deactivateTable(tableId: string) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  if (!session.isGlobalAdmin && session.role !== 'manager') return { error: 'Forbidden' }

  try {
    const target = await db
      .select()
      .from(posTables)
      .where(and(eq(posTables.id, tableId), isNull(posTables.deletedAt)))
      .limit(1)

    if (target.length === 0) return { error: 'Table not found' }
    const table = target[0]

    try {
      await requireBranchAccess(table.branchId)
    } catch {
      return { error: 'BranchAccessDenied' }
    }

    // Check for active orders on this table
    const openOrders = await db
      .select({ id: posOrders.id })
      .from(posOrders)
      .where(and(eq(posOrders.tableId, tableId), eq(posOrders.status, 'open')))
      .limit(1)

    if (openOrders.length > 0) {
      return { error: 'Table has an active open order and cannot be deactivated' }
    }

    const now = new Date()
    await db
      .update(posTables)
      .set({
        isActive: false,
        deletedAt: now,
        updatedAt: now,
      })
      .where(eq(posTables.id, tableId))

    revalidatePath('/management/pos')
    return { success: true }
  } catch (error) {
    console.error('Failed to deactivate table:', error)
    return { error: 'Transaction failed' }
  }
}

// ─── Order Lifecycle ──────────────────────────────────────────────

export async function createOrder(prevState: unknown, formData: FormData) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  if (!canCreateOrder(session.role)) return { error: 'Forbidden' }

  const orderType = formData.get('orderType') as OrderType
  const covers = Number(formData.get('covers')) || 1
  const branchId = formData.get('branchId') as string
  const tableId = (formData.get('tableId') as string | null) || null
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
  const now = new Date()
  let newOrderId = ''

  try {
    if (orderType === 'takeaway') {
      newOrderId = await withDbTransaction(
        async (tx) => {
          const todayTakeaways = await tx
            .select({ id: posOrders.id })
            .from(posOrders)
            .where(
              and(
                eq(posOrders.branchId, enforcedBranchId),
                eq(posOrders.date, today),
                eq(posOrders.orderType, 'takeaway'),
                ne(posOrders.status, 'voided')
              )
            )

          const takeawayNumber = `T-${todayTakeaways.length + 1}`
          const id = randomUUID()

          await tx.insert(posOrders).values({
            id,
            branchId: enforcedBranchId,
            tableId: null,
            takeawayNumber,
            orderType: 'takeaway',
            covers: null,
            status: 'open',
            items: [],
            note: orderNote || null,
            kotCount: 0,
            date: today,
            openedBy: session.userId,
            createdAt: now,
            updatedAt: now,
          })

          return id
        },
        { isolationLevel: 'serializable' }
      )
    } else {
      // dine-in
      newOrderId = await withDbTransaction(async (tx) => {
        const occupied = await tx
          .select({ id: posOrders.id })
          .from(posOrders)
          .where(
            and(
              eq(posOrders.tableId, tableId!),
              eq(posOrders.status, 'open')
            )
          )
          .limit(1)

        if (occupied.length > 0) {
          throw new Error('TABLE_OCCUPIED')
        }

        const id = randomUUID()
        await tx.insert(posOrders).values({
          id,
          branchId: enforcedBranchId,
          tableId: tableId!,
          takeawayNumber: null,
          orderType: 'dine-in',
          covers,
          status: 'open',
          items: [],
          note: orderNote || null,
          kotCount: 0,
          date: today,
          openedBy: session.userId,
          createdAt: now,
          updatedAt: now,
        })

        return id
      })
    }

    await logAction(
      'CREATE_POS_ORDER',
      'POS_ORDER',
      JSON.stringify({ branchId: enforcedBranchId, orderType, tableId }),
      newOrderId
    )
    revalidatePath('/management/pos')
    return { success: true }
  } catch (error: any) {
    if (error?.message === 'TABLE_OCCUPIED' || error?.code === '23505') {
      return { error: 'Table already has an open order' }
    }
    console.error('Failed to create order:', error)
    return { error: 'Transaction failed' }
  }
}

export async function addOrUpdateOrderItem(
  orderId: string,
  menuItemId: string,
  quantity: number,
  unitPrice: number,
  nameSnapshot: string,
  variantId?: string,
  note?: string,
  isParcel?: boolean
) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  if (!canCreateOrder(session.role)) return { error: 'Forbidden' }

  const schema = z.object({
    quantity: z.number().int().min(1).max(99),
    unitPrice: z.number().int().min(0),
    nameSnapshot: z.string().min(1),
    note: z.string().max(80).optional(),
    isParcel: z.boolean().optional(),
  })
  const parsed = schema.safeParse({ quantity, unitPrice, nameSnapshot, note, isParcel })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  let enforcedBranchId: string
  try {
    enforcedBranchId = await requireBranchAccess(undefined)
  } catch {
    return { error: 'BranchAccessDenied' }
  }

  try {
    const orders = await db
      .select()
      .from(posOrders)
      .where(eq(posOrders.id, orderId))
      .limit(1)

    if (orders.length === 0) return { error: 'Order not found' }
    const order = orders[0]
    if (enforcedBranchId && order.branchId !== enforcedBranchId) return { error: 'BranchAccessDenied' }
    if (order.status !== 'open') return { error: 'Order is not open' }
    if (!isWaiterOwnOrder(session.role, order.openedBy, session.userId)) {
      return { error: 'Forbidden: waiters can only edit their own orders' }
    }

    const items = Array.isArray(order.items) ? [...(order.items as any[])] : []
    const existing = items.find(
      (i: any) =>
        i.menuItemId === menuItemId &&
        (i.variantId ?? undefined) === (variantId ?? undefined) &&
        Boolean(i.isParcel) === Boolean(isParcel)
    )

    if (existing) {
      existing.quantity = quantity
      if (note !== undefined) existing.note = note || undefined
      // unitPrice is immutable — never updated on existing items
    } else {
      items.push({
        id: randomUUID(),
        menuItemId,
        variantId,
        nameSnapshot,
        unitPrice,
        quantity,
        note: note || undefined,
        isParcel: Boolean(isParcel),
      })
    }

    await db
      .update(posOrders)
      .set({
        items,
        updatedAt: new Date(),
      })
      .where(eq(posOrders.id, orderId))

    revalidatePath('/management/pos')
    return { success: true }
  } catch (error) {
    console.error('Failed to add/update order item:', error)
    return { error: 'Transaction failed' }
  }
}

export async function toggleOrderItemParcel(
  orderId: string,
  orderItemId: string,
  newUnitPrice?: number,
  newNameSnapshot?: string
) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  if (!canCreateOrder(session.role)) return { error: 'Forbidden' }

  let enforcedBranchId: string
  try {
    enforcedBranchId = await requireBranchAccess(undefined)
  } catch {
    return { error: 'BranchAccessDenied' }
  }

  try {
    const orders = await db
      .select()
      .from(posOrders)
      .where(eq(posOrders.id, orderId))
      .limit(1)

    if (orders.length === 0) return { error: 'Order not found' }
    const order = orders[0]
    if (enforcedBranchId && order.branchId !== enforcedBranchId) return { error: 'BranchAccessDenied' }
    if (order.status !== 'open') return { error: 'Order is not open' }
    if (!isWaiterOwnOrder(session.role, order.openedBy, session.userId)) {
      return { error: 'Forbidden: waiters can only edit their own orders' }
    }

    const items = Array.isArray(order.items) ? [...(order.items as any[])] : []
    const targetIdx = items.findIndex((i: any) => i.id === orderItemId)
    if (targetIdx === -1) return { error: 'Order item not found' }

    const targetItem = items[targetIdx]
    const newParcelStatus = !Boolean(targetItem.isParcel)

    // Check if an item already exists with same menuItemId, variantId, and newParcelStatus
    const existingSameStatus = items.find(
      (i: any) =>
        i.id !== orderItemId &&
        i.menuItemId === targetItem.menuItemId &&
        (i.variantId ?? undefined) === (targetItem.variantId ?? undefined) &&
        Boolean(i.isParcel) === newParcelStatus
    )

    if (existingSameStatus) {
      // Merge into existing item
      existingSameStatus.quantity = Math.min(99, existingSameStatus.quantity + targetItem.quantity)
      items.splice(targetIdx, 1)
    } else {
      targetItem.isParcel = newParcelStatus
      if (typeof newUnitPrice === 'number' && newUnitPrice >= 0) {
        targetItem.unitPrice = newUnitPrice
      }
      if (typeof newNameSnapshot === 'string' && newNameSnapshot.trim().length > 0) {
        targetItem.nameSnapshot = newNameSnapshot.trim()
      }
    }

    await db
      .update(posOrders)
      .set({
        items,
        updatedAt: new Date(),
      })
      .where(eq(posOrders.id, orderId))

    revalidatePath('/management/pos')
    return { success: true }
  } catch (error) {
    console.error('Failed to toggle order item parcel status:', error)
    return { error: 'Transaction failed' }
  }
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

  try {
    const orders = await db
      .select()
      .from(posOrders)
      .where(eq(posOrders.id, orderId))
      .limit(1)

    if (orders.length === 0) return { error: 'Order not found' }
    const order = orders[0]
    if (enforcedBranchId && order.branchId !== enforcedBranchId) return { error: 'BranchAccessDenied' }
    if (order.status !== 'open') return { error: 'Order is not open' }
    if (!isWaiterOwnOrder(session.role, order.openedBy, session.userId)) {
      return { error: 'Forbidden: waiters can only edit their own orders' }
    }

    const items = Array.isArray(order.items) ? [...(order.items as any[])] : []
    const idx = items.findIndex((i: any) => i.id === orderItemId)
    if (idx === -1) return { error: 'Order item not found' }

    items.splice(idx, 1)

    await db
      .update(posOrders)
      .set({
        items,
        updatedAt: new Date(),
      })
      .where(eq(posOrders.id, orderId))

    revalidatePath('/management/pos')
    return { success: true }
  } catch (error) {
    console.error('Failed to remove order item:', error)
    return { error: 'Transaction failed' }
  }
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

  try {
    const orders = await db
      .select()
      .from(posOrders)
      .where(eq(posOrders.id, orderId))
      .limit(1)

    if (orders.length === 0) return { error: 'Order not found' }
    const order = orders[0]
    if (enforcedBranchId && order.branchId !== enforcedBranchId) return { error: 'BranchAccessDenied' }
    if (order.status !== 'open') return { error: 'Order is not open' }
    if (!isWaiterOwnOrder(session.role, order.openedBy, session.userId)) {
      return { error: 'Forbidden: waiters can only edit their own orders' }
    }

    await db
      .update(posOrders)
      .set({
        note: note || null,
        updatedAt: new Date(),
      })
      .where(eq(posOrders.id, orderId))

    revalidatePath('/management/pos')
    return { success: true }
  } catch (error) {
    console.error('Failed to update order note:', error)
    return { error: 'Transaction failed' }
  }
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

  try {
    let resultKotId = ''
    let resultKotNumber = 0
    let resultItemCount = 0

    const txResult = await withDbTransaction(async (tx) => {
      // 1. Load order
      const orders = await tx
        .select()
        .from(posOrders)
        .where(eq(posOrders.id, orderId))
        .limit(1)

      if (orders.length === 0) return { error: 'Order not found' }
      const order = orders[0]
      if (enforcedBranchId && order.branchId !== enforcedBranchId) return { error: 'BranchAccessDenied' }
      if (order.status !== 'open') return { error: 'Order is not open' }
      if (!isWaiterOwnOrder(session.role, order.openedBy, session.userId)) {
        return { error: 'Forbidden: waiters can only edit their own orders' }
      }

      const orderItems = (order.items as any[]) || []
      if (orderItems.length === 0) return { error: 'Order has no items' }

      // 2. Load prior KOTs for delta computation
      const priorKots = await tx
        .select()
        .from(posKots)
        .where(eq(posKots.orderId, orderId))

      // 3. Compute delta per item
      const kotItems: KotItem[] = []
      for (const item of orderItems) {
        const priorTotal = priorKots.reduce((sum, kot) => {
          const kItems = (kot.items as any[]) || []
          return (
            sum +
            kItems
              .filter(
                (ki: any) =>
                  ki.menuItemId === item.menuItemId &&
                  (ki.variantId ?? undefined) === (item.variantId ?? undefined) &&
                  Boolean(ki.isParcel) === Boolean(item.isParcel)
              )
              .reduce((s: number, ki: any) => s + ki.quantity, 0)
          )
        }, 0)

        const delta = item.quantity - priorTotal
        if (delta > 0) {
          kotItems.push({
            menuItemId: item.menuItemId,
            variantId: item.variantId,
            nameSnapshot: item.nameSnapshot,
            quantity: delta,
            note: item.note,
            isParcel: Boolean(item.isParcel),
          })
        }
      }

      if (kotItems.length === 0) return { error: 'No new items to send to kitchen' }

      const newKotNumber = priorKots.length + 1
      const now = new Date()
      const kotId = randomUUID()

      await tx.insert(posKots).values({
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

      await tx
        .update(posOrders)
        .set({
          kotCount: newKotNumber,
          updatedAt: now,
        })
        .where(eq(posOrders.id, orderId))

      resultKotId = kotId
      resultKotNumber = newKotNumber
      resultItemCount = kotItems.length
      return { success: true }
    })

    if (txResult && 'error' in txResult) {
      return txResult
    }

    await logAction(
      'FIRE_KOT',
      'POS_KOT',
      JSON.stringify({ orderId, kotNumber: resultKotNumber, itemCount: resultItemCount }),
      resultKotId
    )
    revalidatePath('/management/pos')
    return { success: true }
  } catch (error) {
    console.error('Failed to fire KOT:', error)
    return { error: 'Transaction failed' }
  }
}

// ─── Bill Generation ──────────────────────────────────────────────

export async function generateBill(prevState: unknown, formData: FormData) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  if (!canGenerateBill(session.role)) return { error: 'Forbidden' }

  const orderId = formData.get('orderId') as string
  const discount = Number(formData.get('discount')) || 0
  const gst = Number(formData.get('gst')) || 0
  const parcelCharges = Number(formData.get('parcelCharges')) || 0
  const acCharges = Number(formData.get('acCharges')) || 0
  const confirmed = formData.get('confirmed') === 'true'

  const schema = z.object({
    discount: z.number().int().min(0),
    gst: z.number().int().min(0),
    parcelCharges: z.number().int().min(0).optional(),
    acCharges: z.number().int().min(0).optional(),
  })
  const parsed = schema.safeParse({ discount, gst, parcelCharges, acCharges })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  let enforcedBranchId: string
  try {
    enforcedBranchId = await requireBranchAccess(undefined)
  } catch {
    return { error: 'BranchAccessDenied' }
  }

  try {
    let computedSubtotal = 0
    let computedTotal = 0

    const txResult = await withDbTransaction(async (tx) => {
      const orders = await tx
        .select()
        .from(posOrders)
        .where(eq(posOrders.id, orderId))
        .limit(1)

      if (orders.length === 0) return { error: 'Order not found' }
      const order = orders[0]
      if (enforcedBranchId && order.branchId !== enforcedBranchId) return { error: 'BranchAccessDenied' }
      if (order.status === 'billed') return { success: true } // idempotent
      if (order.status !== 'open') return { error: 'Order is not open' }

      const items = (order.items as any[]) || []
      if (items.length === 0) return { error: 'Order has no items' }

      const subtotal = items.reduce((s: number, i: any) => s + i.quantity * i.unitPrice, 0)
      if (discount > subtotal) return { error: 'Discount cannot exceed the subtotal' }

      const totalPayable = Math.max(0, subtotal - discount + parcelCharges + acCharges + gst)
      if (totalPayable === 0 && !confirmed) {
        return { error: 'ZERO_BILL_CONFIRM_REQUIRED' }
      }

      computedSubtotal = subtotal
      computedTotal = totalPayable
      const now = new Date()

      const bill: BillSnapshot = {
        subtotal,
        discount,
        gst,
        parcelCharges,
        acCharges,
        totalPayable,
        generatedAt: now.toISOString(),
      }

      await tx
        .update(posOrders)
        .set({
          bill,
          status: 'billed',
          updatedAt: now,
        })
        .where(eq(posOrders.id, orderId))

      return { success: true }
    })

    if (txResult && 'error' in txResult) {
      return txResult
    }

    await logAction(
      'GENERATE_BILL',
      'POS_ORDER',
      JSON.stringify({
        orderId,
        subtotal: computedSubtotal,
        discount,
        gst,
        parcelCharges,
        acCharges,
        totalPayable: computedTotal,
      }),
      orderId
    )
    revalidatePath('/management/pos')
    return { success: true }
  } catch (error) {
    console.error('Failed to generate bill:', error)
    return { error: 'Transaction failed' }
  }
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

  try {
    const txResult = await withDbTransaction(async (tx) => {
      const orders = await tx
        .select()
        .from(posOrders)
        .where(eq(posOrders.id, orderId))
        .limit(1)

      if (orders.length === 0) return { error: 'Order not found' }
      const order = orders[0]
      if (enforcedBranchId && order.branchId !== enforcedBranchId) return { error: 'BranchAccessDenied' }
      if (order.status === 'paid') return { error: 'A paid order cannot be reopened' }
      if (order.status !== 'billed') return { error: 'Only billed orders can be reopened' }

      const now = new Date()
      await tx
        .update(posOrders)
        .set({
          status: 'open',
          bill: null,
          updatedAt: now,
        })
        .where(eq(posOrders.id, orderId))

      return { success: true }
    })

    if (txResult && 'error' in txResult) {
      return txResult
    }

    await logAction('REOPEN_POS_ORDER', 'POS_ORDER', JSON.stringify({ orderId }), orderId)
    revalidatePath('/management/pos')
    return { success: true }
  } catch (error) {
    console.error('Failed to reopen order:', error)
    return { error: 'Transaction failed' }
  }
}

// ─── Payment ──────────────────────────────────────────────────────

export async function recordPayment(
  prevState: unknown,
  formData: FormData
): Promise<{ success?: boolean; changeDue?: number; error?: string }> {
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

  try {
    let cashAmountStored = 0

    const txResult = await withDbTransaction(async (tx) => {
      const orders = await tx
        .select()
        .from(posOrders)
        .where(eq(posOrders.id, orderId))
        .limit(1)

      if (orders.length === 0) return { error: 'Order not found' }
      const order = orders[0]
      if (enforcedBranchId && order.branchId !== enforcedBranchId) return { error: 'BranchAccessDenied' }
      if (order.status !== 'billed') return { error: 'Order must be billed before payment' }
      if (!order.bill) return { error: 'Order has no bill' }

      const totalPayable = (order.bill as any).totalPayable

      // Enforce method-amount consistency
      if (method === 'cash') {
        cashAmount = totalPayable
        upiAmount = 0
      }
      if (method === 'upi') {
        upiAmount = totalPayable
        cashAmount = 0
      }

      if (cashAmount + upiAmount !== totalPayable) {
        return { error: 'Payment amounts do not balance with total payable' }
      }
      if (totalPayable > 0 && cashAmount === 0 && upiAmount === 0) {
        return { error: 'Payment amounts do not balance with total payable' }
      }

      cashAmountStored = cashAmount
      const now = new Date()
      const payment = { method, cashAmount: cashAmountStored, upiAmount, paidAt: now.toISOString() }

      await tx
        .update(posOrders)
        .set({
          payment,
          status: 'paid',
          updatedAt: now,
        })
        .where(eq(posOrders.id, orderId))

      return { success: true }
    })

    if (txResult && 'error' in txResult) {
      return txResult
    }

    const changeDue =
      method === 'cash' || method === 'split'
        ? Math.max(0, cashTendered - cashAmountStored)
        : 0

    await logAction(
      'RECORD_PAYMENT',
      'POS_ORDER',
      JSON.stringify({
        orderId,
        method,
        cashAmount: cashAmountStored,
        upiAmount,
        totalPayable: cashAmountStored + upiAmount,
      }),
      orderId
    )
    revalidatePath('/management/pos')
    return { success: true, changeDue }
  } catch (error) {
    console.error('Failed to record payment:', error)
    return { error: 'Transaction failed' }
  }
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

  try {
    let orderBranchId: string | undefined
    let previousStatus: OrderStatus | undefined

    const txResult = await withDbTransaction(async (tx) => {
      const orders = await tx
        .select()
        .from(posOrders)
        .where(eq(posOrders.id, orderId))
        .limit(1)

      if (orders.length === 0) return { error: 'Order not found' }
      const order = orders[0]
      if (enforcedBranchId && order.branchId !== enforcedBranchId) return { error: 'BranchAccessDenied' }

      orderBranchId = order.branchId
      previousStatus = order.status as OrderStatus

      if (order.status === 'paid') {
        if (!session.isGlobalAdmin) return { error: 'Forbidden' }
        const today = todayIST()
        const paidAt = (order.payment as any)?.paidAt
        const paidDate = paidAt
          ? new Date(paidAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
          : null
        if (paidDate !== today) {
          return { error: 'Order can only be voided on the day it was paid' }
        }
      } else if (order.status === 'open') {
        if (!canVoidOrder(session.role, 'open')) return { error: 'Forbidden' }
      } else {
        return { error: 'Only open or paid orders can be voided' }
      }

      const now = new Date()
      const voidInfo = { reason: reason!, voidedBy: session.userId, voidedAt: now.toISOString() }

      await tx
        .update(posOrders)
        .set({
          void: voidInfo,
          status: 'voided',
          updatedAt: now,
        })
        .where(eq(posOrders.id, orderId))

      return { success: true }
    })

    if (txResult && 'error' in txResult) {
      return txResult
    }

    await logAction(
      'VOID_POS_ORDER',
      'POS_ORDER',
      JSON.stringify({
        orderId,
        reason,
        previousStatus,
        branchId: orderBranchId || enforcedBranchId,
      }),
      orderId
    )
    revalidatePath('/management/pos')
    return { success: true }
  } catch (error) {
    console.error('Failed to void order:', error)
    return { error: 'Transaction failed' }
  }
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

  try {
    const kots = await db
      .select()
      .from(posKots)
      .where(eq(posKots.id, kotId))
      .limit(1)

    if (kots.length === 0) return { error: 'KOT not found' }
    const kot = kots[0]
    if (enforcedBranchId && kot.branchId !== enforcedBranchId) return { error: 'BranchAccessDenied' }

    const currentIdx = KOT_SEQUENCE.indexOf(kot.status as (typeof KOT_SEQUENCE)[number])
    if (currentIdx === -1) return { error: 'Invalid KOT status transition' }
    if (currentIdx === KOT_SEQUENCE.length - 1) return { error: 'KOT is already served' }

    const nextStatus = KOT_SEQUENCE[currentIdx + 1]
    const now = new Date()

    await db
      .update(posKots)
      .set({
        status: nextStatus,
        updatedAt: now,
      })
      .where(eq(posKots.id, kotId))

    revalidatePath('/management/pos')
    return { success: true }
  } catch (error) {
    console.error('Failed to advance KOT status:', error)
    return { error: 'Transaction failed' }
  }
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

  try {
    const today = todayIST()
    const todayOrders = await db
      .select({
        id: posOrders.id,
        tableId: posOrders.tableId,
        takeawayNumber: posOrders.takeawayNumber,
        orderType: posOrders.orderType,
      })
      .from(posOrders)
      .where(and(eq(posOrders.branchId, enforcedBranchId), eq(posOrders.date, today)))

    // Build order map for resolving identifiers
    const orderMap = new Map<string, { tableId?: string; takeawayNumber?: string; orderType: OrderType }>()
    for (const o of todayOrders) {
      orderMap.set(o.id, {
        tableId: o.tableId ?? undefined,
        takeawayNumber: o.takeawayNumber ?? undefined,
        orderType: o.orderType as OrderType,
      })
    }

    // Load tables for name resolution
    const allTables = await db
      .select({ id: posTables.id, name: posTables.name })
      .from(posTables)
      .where(eq(posTables.branchId, enforcedBranchId))

    const tableMap = new Map<string, string>()
    for (const t of allTables) {
      tableMap.set(t.id, t.name)
    }

    const orderIds = todayOrders.map((o) => o.id)
    if (orderIds.length === 0) {
      return { kots: [] }
    }

    const allKots = await db
      .select()
      .from(posKots)
      .where(
        and(
          eq(posKots.branchId, enforcedBranchId),
          inArray(posKots.orderId, orderIds),
          inArray(posKots.status, ['pending', 'preparing', 'ready'])
        )
      )
      .orderBy(asc(posKots.firedAt))

    // Strip financial data and resolve order identifiers
    const kotsWithInfo = allKots.map((k) => {
      const orderInfo = orderMap.get(k.orderId)
      const tableName = orderInfo?.tableId ? tableMap.get(orderInfo.tableId) : undefined
      const orderIdentifier = tableName || orderInfo?.takeawayNumber || 'Unknown'
      const items = (k.items as any[]) || []

      return {
        id: k.id,
        orderId: k.orderId,
        kotNumber: k.kotNumber,
        items: items.map((i: any) => ({
          nameSnapshot: i.nameSnapshot,
          quantity: i.quantity,
          note: i.note,
          isParcel: Boolean(i.isParcel),
        })),
        status: k.status,
        firedAt: k.firedAt instanceof Date ? k.firedAt.toISOString() : String(k.firedAt || ''),
        orderIdentifier,
        orderType: orderInfo?.orderType,
      }
    })

    return { kots: kotsWithInfo }
  } catch (error) {
    console.error('Failed to get kitchen KOTs:', error)
    return { error: 'Database operation failed' }
  }
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

  try {
    const ordersRaw = await db
      .select()
      .from(posOrders)
      .where(
        and(
          eq(posOrders.branchId, enforcedBranchId),
          gte(posOrders.date, fromDate),
          lte(posOrders.date, toDate)
        )
      )

    const orders: PosOrder[] = (ordersRaw as any[]).map((o) => ({
      id: o.id,
      branchId: o.branchId,
      tableId: o.tableId ?? undefined,
      takeawayNumber: o.takeawayNumber ?? undefined,
      orderType: o.orderType as OrderType,
      covers: o.covers ?? undefined,
      status: o.status as OrderStatus,
      items: (o.items as any) || [],
      note: o.note ?? undefined,
      kotCount: o.kotCount ?? 0,
      bill: o.bill ?? undefined,
      payment: o.payment ?? undefined,
      void: o.void ?? undefined,
      date: o.date,
      openedBy: o.openedBy,
      createdAt: o.createdAt instanceof Date ? o.createdAt.toISOString() : String(o.createdAt || ''),
      updatedAt: o.updatedAt instanceof Date ? o.updatedAt.toISOString() : String(o.updatedAt || ''),
    }))

    const paidOrders = orders.filter((o) => o.status === 'paid')
    const voidedOrders = orders.filter((o) => o.status === 'voided')

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
  } catch (error) {
    console.error('Failed to get POS order history:', error)
    return { error: 'Database operation failed' }
  }
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

  try {
    const ordersRaw = await db
      .select()
      .from(posOrders)
      .where(and(eq(posOrders.branchId, enforcedBranchId), eq(posOrders.date, date)))

    const orders: PosOrder[] = (ordersRaw as any[]).map((o) => ({
      id: o.id,
      branchId: o.branchId,
      tableId: o.tableId ?? undefined,
      takeawayNumber: o.takeawayNumber ?? undefined,
      orderType: o.orderType as OrderType,
      covers: o.covers ?? undefined,
      status: o.status as OrderStatus,
      items: (o.items as any) || [],
      note: o.note ?? undefined,
      kotCount: o.kotCount ?? 0,
      bill: o.bill ?? undefined,
      payment: o.payment ?? undefined,
      void: o.void ?? undefined,
      date: o.date,
      openedBy: o.openedBy,
      createdAt: o.createdAt instanceof Date ? o.createdAt.toISOString() : String(o.createdAt || ''),
      updatedAt: o.updatedAt instanceof Date ? o.updatedAt.toISOString() : String(o.updatedAt || ''),
    }))

    const eodData = computePosEodData(orders)
    const paidOrders = orders.filter((o) => o.status === 'paid')

    return {
      ...eodData,
      totalCash: paidOrders.reduce((s, o) => s + (o.payment?.cashAmount ?? 0), 0),
      totalUpi: paidOrders.reduce((s, o) => s + (o.payment?.upiAmount ?? 0), 0),
      dineInBillCount: paidOrders.filter((o) => o.orderType === 'dine-in').length,
      takeawayBillCount: paidOrders.filter((o) => o.orderType === 'takeaway').length,
    }
  } catch (error) {
    console.error('Failed to get daily summary:', error)
    return { error: 'Database operation failed' }
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

  try {
    const ordersRaw = await db
      .select()
      .from(posOrders)
      .where(and(eq(posOrders.branchId, enforcedBranchId), eq(posOrders.date, date)))

    const orders: PosOrder[] = (ordersRaw as any[]).map((o) => ({
      id: o.id,
      branchId: o.branchId,
      tableId: o.tableId ?? undefined,
      takeawayNumber: o.takeawayNumber ?? undefined,
      orderType: o.orderType as OrderType,
      covers: o.covers ?? undefined,
      status: o.status as OrderStatus,
      items: (o.items as any) || [],
      note: o.note ?? undefined,
      kotCount: o.kotCount ?? 0,
      bill: o.bill ?? undefined,
      payment: o.payment ?? undefined,
      void: o.void ?? undefined,
      date: o.date,
      openedBy: o.openedBy,
      createdAt: o.createdAt instanceof Date ? o.createdAt.toISOString() : String(o.createdAt || ''),
      updatedAt: o.updatedAt instanceof Date ? o.updatedAt.toISOString() : String(o.updatedAt || ''),
    }))

    return { data: computePosEodData(orders) }
  } catch (error) {
    console.error('Failed to get POS data for EOD:', error)
    return { error: 'Database operation failed' }
  }
}

'use server'

import { db, inventory, stockAdjustments, withDbTransaction } from '@/lib/db'
import { eq, and, ilike, ne, isNull } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { randomUUID } from 'crypto'
import { requireBranchAccess } from './auth'
import { z } from 'zod'

const addInventorySchema = z.object({
  name:      z.string().min(1, 'Item name is required').max(100, 'Name too long').trim(),
  unit:      z.string().min(1, 'Unit is required').max(20, 'Unit too long'),
  quantity:  z.number().int().min(0, 'Quantity cannot be negative'),
  threshold: z.number().int().min(0, 'Threshold cannot be negative'),
  branchId:  z.string().min(1, 'Branch is required'),
})

const adjustStockSchema = z.object({
  itemId:   z.string().min(1, 'Item is required'),
  branchId: z.string().min(1, 'Branch is required'),
  type:     z.enum(['increase', 'decrease']),
  amount:   z.number().int().min(1, 'Adjustment amount must be at least 1'),
  reason:   z.string().min(1, 'Reason is required').max(200, 'Reason too long').trim(),
})

const updateInventorySchema = z.object({
  id:        z.string().min(1),
  name:      z.string().min(1, 'Item name is required').max(100, 'Name too long').trim(),
  unit:      z.string().min(1, 'Unit is required').max(20, 'Unit too long'),
  threshold: z.number().int().min(0, 'Threshold cannot be negative'),
  branchId:  z.string().min(1, 'Branch is required'),
})

export type InventoryItem = {
  id: string
  branchId: string
  name: string
  unit: string
  currentQuantity: number
  threshold: number
  updatedAt: string
  isActive?: boolean
  deletedAt?: string
}

export type StockAdjustment = {
  id: string
  itemId: string
  branchId: string
  type: 'increase' | 'decrease'
  amount: number
  reason: string
  date: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function addInventoryItem(prevState: any, formData: FormData) {
  const name = formData.get('name') as string
  const unit = formData.get('unit') as string
  const quantity = Number(formData.get('quantity'))
  const threshold = Number(formData.get('threshold'))
  let branchId = formData.get('branchId') as string

  const parsed = addInventorySchema.safeParse({
    name, unit,
    quantity: Number(formData.get('quantity')),
    threshold: Number(formData.get('threshold')),
    branchId: formData.get('branchId') as string,
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  try {
    branchId = await requireBranchAccess(branchId)
  } catch {
    return { error: 'Forbidden' }
  }

  try {
    const existing = await db
      .select({ id: inventory.id })
      .from(inventory)
      .where(
        and(
          ilike(inventory.name, name),
          eq(inventory.branchId, branchId),
          eq(inventory.unit, unit),
          eq(inventory.isActive, true),
          isNull(inventory.deletedAt)
        )
      )
      .limit(1)

    if (existing.length > 0) {
      return { error: 'An inventory item with this name and unit already exists in this branch' }
    }

    const newItemId = randomUUID()
    const now = new Date()

    if (quantity > 0) {
      // Wrap item insert + initial stock_adjustment insert in withDbTransaction (Req 7.4)
      await withDbTransaction(async (tx) => {
        await tx.insert(inventory).values({
          id: newItemId,
          branchId,
          name,
          unit,
          currentQuantity: quantity,
          threshold,
          isActive: true,
          updatedAt: now,
        })

        await tx.insert(stockAdjustments).values({
          id: randomUUID(),
          itemId: newItemId,
          branchId,
          type: 'increase',
          amount: quantity,
          reason: 'Initial Stock',
          date: now.toISOString().split('T')[0],
        })
      })
    } else {
      await db.insert(inventory).values({
        id: newItemId,
        branchId,
        name,
        unit,
        currentQuantity: quantity,
        threshold,
        isActive: true,
        updatedAt: now,
      })
    }

    revalidatePath('/management/inventory')
    return { success: true }
  } catch (error) {
    console.error('Failed to add inventory item:', error)
    return { error: 'Transaction failed' }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function adjustStock(prevState: any, formData: FormData) {
  const itemId = formData.get('itemId') as string
  let branchId = formData.get('branchId') as string
  const type = formData.get('type') as 'increase' | 'decrease'
  const amount = Number(formData.get('amount'))
  const reason = formData.get('reason') as string

  const parsed = adjustStockSchema.safeParse({ itemId, branchId, type, amount, reason })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  try {
    branchId = await requireBranchAccess(branchId)
  } catch {
    return { error: 'Forbidden' }
  }

  try {
    // Outer-scope flag pattern (Req 7.5, 13.5)
    const existing = await db
      .select()
      .from(inventory)
      .where(
        and(
          eq(inventory.id, itemId),
          eq(inventory.isActive, true),
          isNull(inventory.deletedAt)
        )
      )
      .limit(1)

    if (existing.length === 0) return { error: 'Item not found' }

    const item = existing[0]
    if (type === 'decrease' && item.currentQuantity < amount) {
      return { error: 'Not enough stock to decrease' }
    }

    const newQty = type === 'increase' ? item.currentQuantity + amount : item.currentQuantity - amount
    const now = new Date()

    await withDbTransaction(async (tx) => {
      await tx
        .update(inventory)
        .set({
          currentQuantity: newQty,
          updatedAt: now,
        })
        .where(eq(inventory.id, itemId))

      await tx.insert(stockAdjustments).values({
        id: randomUUID(),
        itemId,
        branchId,
        type,
        amount,
        reason,
        date: now.toISOString().split('T')[0],
      })
    })

    revalidatePath('/management/inventory')
    return { success: true }
  } catch (error) {
    console.error('Failed to adjust stock:', error)
    return { error: 'Transaction failed' }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateInventoryItem(prevState: any, formData: FormData) {
  const id = formData.get('id') as string
  const name = formData.get('name') as string
  const unit = formData.get('unit') as string
  const threshold = Number(formData.get('threshold'))
  let branchId = formData.get('branchId') as string

  const parsed = updateInventorySchema.safeParse({
    id, name, unit,
    threshold: Number(formData.get('threshold')),
    branchId: formData.get('branchId') as string,
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  try {
    branchId = await requireBranchAccess(branchId)
  } catch {
    return { error: 'Forbidden' }
  }

  try {
    const existing = await db
      .select()
      .from(inventory)
      .where(
        and(
          eq(inventory.id, id),
          eq(inventory.isActive, true),
          isNull(inventory.deletedAt)
        )
      )
      .limit(1)

    if (existing.length === 0) return { error: 'Item not found' }

    const duplicate = await db
      .select({ id: inventory.id })
      .from(inventory)
      .where(
        and(
          ilike(inventory.name, name),
          eq(inventory.branchId, branchId),
          eq(inventory.unit, unit),
          eq(inventory.isActive, true),
          isNull(inventory.deletedAt),
          ne(inventory.id, id)
        )
      )
      .limit(1)

    if (duplicate.length > 0) {
      return { error: 'An inventory item with this name and unit already exists in this branch' }
    }

    await db
      .update(inventory)
      .set({
        name,
        unit,
        threshold,
        updatedAt: new Date(),
      })
      .where(eq(inventory.id, id))

    revalidatePath('/management/inventory')
    return { success: true }
  } catch (error) {
    console.error('Failed to update inventory item:', error)
    return { error: 'Transaction failed' }
  }
}

export async function deleteInventoryItem(id: string) {
  try {
    const existing = await db
      .select()
      .from(inventory)
      .where(
        and(
          eq(inventory.id, id),
          eq(inventory.isActive, true),
          isNull(inventory.deletedAt)
        )
      )
      .limit(1)

    if (existing.length === 0) return { error: 'Item not found' }

    const now = new Date()
    await db
      .update(inventory)
      .set({
        isActive: false,
        deletedAt: now,
        updatedAt: now,
      })
      .where(eq(inventory.id, id))

    revalidatePath('/management/inventory')
    return { success: true }
  } catch (error) {
    console.error('Failed to delete inventory item:', error)
    return { error: 'Transaction failed' }
  }
}

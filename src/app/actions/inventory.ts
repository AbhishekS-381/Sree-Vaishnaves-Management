'use server'

import { withTransaction, DB_FILES } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { randomUUID } from 'crypto'
import { requireBranchAccess } from './auth'

export type InventoryItem = {
  id: string
  branchId: string
  name: string
  unit: string // kg, litre, packet, piece
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

export async function addInventoryItem(prevState: any, formData: FormData) {
  const name = formData.get('name') as string
  const unit = formData.get('unit') as string
  const quantity = Number(formData.get('quantity'))
  const threshold = Number(formData.get('threshold'))
  let branchId = formData.get('branchId') as string

  if (!name || !unit || quantity < 0 || threshold < 0 || !branchId) {
    return { error: 'Invalid input' }
  }

  try {
    branchId = await requireBranchAccess(branchId)
  } catch (e) {
    return { error: 'Forbidden' }
  }

  let alreadyExists = false;
  const newItem: InventoryItem = {
    id: `inv_${randomUUID()}`,
    branchId,
    name,
    unit,
    currentQuantity: quantity,
    threshold,
    updatedAt: new Date().toISOString(),
    isActive: true
  }

  const success = await withTransaction<InventoryItem>(DB_FILES.INVENTORY, (items) => {
    if (items.some(i => i.isActive !== false && i.name.toLowerCase() === name.toLowerCase() && i.branchId === branchId && i.unit === unit)) {
      alreadyExists = true;
      return items;
    }
    items.push(newItem)
    return items
  })

  if (alreadyExists) return { error: 'An inventory item with this name and unit already exists in this branch' }
  if (!success) return { error: 'Transaction failed' }
  
  // If starting quantity > 0, log adjustment
  if (quantity > 0) {
     await withTransaction<StockAdjustment>(DB_FILES.STOCK_ADJUSTMENTS, (logs) => {
       logs.push({
          id: `adj_${randomUUID()}`,
          itemId: newItem.id,
          branchId,
          type: 'increase',
          amount: quantity,
          reason: 'Initial Stock',
          date: new Date().toISOString()
       })
       return logs
     })
  }

  revalidatePath('/inventory')
  return { success: true }
}

export async function adjustStock(prevState: any, formData: FormData) {
  const itemId = formData.get('itemId') as string
  let branchId = formData.get('branchId') as string
  const type = formData.get('type') as 'increase' | 'decrease'
  const amount = Number(formData.get('amount'))
  const reason = formData.get('reason') as string

  if (!itemId || !branchId || amount <= 0 || !reason) {
    return { error: 'Invalid adjustments' }
  }

  try {
    branchId = await requireBranchAccess(branchId)
  } catch (e) {
    return { error: 'Forbidden' }
  }

  let notFound = false;
  let notEnough = false;

  const success = await withTransaction<InventoryItem>(DB_FILES.INVENTORY, (items) => {
    const itemIndex = items.findIndex(i => i.id === itemId)
    if (itemIndex === -1) {
      notFound = true;
      return items;
    }
    if (type === 'decrease' && items[itemIndex].currentQuantity < amount) {
      notEnough = true;
      return items;
    }

    const newQty = type === 'increase' 
       ? items[itemIndex].currentQuantity + amount 
       : items[itemIndex].currentQuantity - amount

    items[itemIndex].currentQuantity = newQty
    items[itemIndex].updatedAt = new Date().toISOString()
    return items
  })

  if (notFound) return { error: 'Item not found' }
  if (notEnough) return { error: 'Not enough stock to decrease' }
  if (!success) return { error: 'Transaction failed' }

  // Log adjustment
  await withTransaction<StockAdjustment>(DB_FILES.STOCK_ADJUSTMENTS, (logs) => {
    logs.push({
      id: `adj_${randomUUID()}`,
      itemId,
      branchId,
      type,
      amount,
      reason,
      date: new Date().toISOString()
    })
    return logs
  })
  
  revalidatePath('/inventory')
  return { success: true }
}

export async function updateInventoryItem(prevState: any, formData: FormData) {
  const id = formData.get('id') as string
  const name = formData.get('name') as string
  const unit = formData.get('unit') as string
  const threshold = Number(formData.get('threshold'))
  let branchId = formData.get('branchId') as string

  if (!id || !name || !unit || threshold < 0 || !branchId) {
    return { error: 'Invalid input' }
  }

  try {
    branchId = await requireBranchAccess(branchId)
  } catch (e) {
    return { error: 'Forbidden' }
  }

  let notFound = false;
  let alreadyExists = false;

  const success = await withTransaction<InventoryItem>(DB_FILES.INVENTORY, (items) => {
    const itemIndex = items.findIndex(i => i.id === id)
    if (itemIndex === -1) {
      notFound = true;
      return items;
    }
    if (items.some(i => i.isActive !== false && i.name.toLowerCase() === name.toLowerCase() && i.branchId === branchId && i.unit === unit && i.id !== id)) {
      alreadyExists = true;
      return items;
    }

    items[itemIndex] = {
      ...items[itemIndex],
      name,
      unit,
      threshold,
      updatedAt: new Date().toISOString()
    }
    return items
  })

  if (notFound) return { error: 'Item not found' }
  if (alreadyExists) return { error: 'An inventory item with this name and unit already exists in this branch' }
  if (!success) return { error: 'Transaction failed' }

  revalidatePath('/inventory')
  return { success: true }
}

export async function deleteInventoryItem(id: string) {
  let notFound = false;
  const success = await withTransaction<InventoryItem>(DB_FILES.INVENTORY, (items) => {
    const itemIndex = items.findIndex(i => i.id === id)
    if (itemIndex === -1) {
      notFound = true;
      return items;
    }
    items[itemIndex].isActive = false;
    items[itemIndex].deletedAt = new Date().toISOString();
    items[itemIndex].updatedAt = new Date().toISOString();
    return items
  })

  if (notFound) return { error: 'Item not found' }
  if (!success) return { error: 'Transaction failed' }

  revalidatePath('/inventory')
  return { success: true }
}

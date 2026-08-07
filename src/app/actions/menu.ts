'use server'

import { withTransaction, DB_FILES } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { randomUUID } from 'crypto'
import { getSession, requireBranchAccess } from './auth'

export type MenuItem = {
  id: string
  name: string
  categoryId: string
  basePrice: number
  sortOrder: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type BranchMenuItem = {
  id: string
  branchId: string
  menuItemId: string
  price: number | null
  isAvailable: boolean
}

export async function addMenuItem(prevState: any, formData: FormData) {
  const session = await getSession();
  if (!session?.isGlobalAdmin) return { error: 'Forbidden: Admin or Owner access required' };

  const name = formData.get('name') as string
  const categoryId = formData.get('categoryId') as string
  const basePrice = Number(formData.get('basePrice')) || 0
  const isAvailableGlobally = formData.get('isAvailableGlobally') !== 'false'

  if (!name || !categoryId) {
    return { error: 'Missing required fields' }
  }

  const newItem: MenuItem = {
    id: `mn_${randomUUID()}`,
    name,
    categoryId,
    basePrice,
    sortOrder: Date.now(),
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  let alreadyExists = false;
  const success = await withTransaction<MenuItem>(DB_FILES.MENU, (menu) => {
    if (menu.some(m => m.name.toLowerCase() === name.toLowerCase() && m.categoryId === categoryId && m.isActive !== false)) {
      alreadyExists = true;
      return menu;
    }
    menu.push(newItem)
    return menu
  })

  if (alreadyExists) return { error: 'A menu item with this name already exists in this category' }
  if (!success) return { error: 'Failed to add menu item' }
  
  // Auto-create branch mappings for all active branches
  const { readJSON } = await import('@/lib/db')
  const branches = await readJSON<any>(DB_FILES.BRANCHES)
  const activeBranches = branches.filter(b => b.isActive !== false)

  await withTransaction<BranchMenuItem>(DB_FILES.BRANCH_MENU_ITEMS, (items) => {
    activeBranches.forEach(branch => {
      items.push({
        id: `bmi_${randomUUID()}`,
        branchId: branch.id,
        menuItemId: newItem.id,
        price: null,
        isAvailable: isAvailableGlobally
      })
    })
    return items
  })

  revalidatePath('/menu')
  return { success: true }
}

export async function setBranchItemAvailability(branchId: string, menuItemId: string, isAvailable: boolean) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  if (!session.isGlobalAdmin && branchId !== session.branchId) return { error: 'Forbidden' };

  await withTransaction<BranchMenuItem>(DB_FILES.BRANCH_MENU_ITEMS, (items) => {
    const item = items.find(m => m.branchId === branchId && m.menuItemId === menuItemId)
    if (item) {
      item.isAvailable = isAvailable
    } else {
      items.push({
        id: `bmi_${randomUUID()}`,
        branchId,
        menuItemId,
        price: null,
        isAvailable
      })
    }
    return items
  })
  revalidatePath('/menu')
}

export async function updateBranchMenuItemPrice(branchId: string, menuItemId: string, price: number | null) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  if (!session.isGlobalAdmin && branchId !== session.branchId) return { error: 'Forbidden' };

  await withTransaction<BranchMenuItem>(DB_FILES.BRANCH_MENU_ITEMS, (items) => {
    const item = items.find(m => m.branchId === branchId && m.menuItemId === menuItemId)
    if (item) {
      item.price = price
    } else {
      items.push({
        id: `bmi_${randomUUID()}`,
        branchId,
        menuItemId,
        price,
        isAvailable: true
      })
    }
    return items
  })
  revalidatePath('/menu')
}

export async function deleteMenuItem(id: string) {
  const session = await getSession()
  if (!session?.isGlobalAdmin) return { error: 'Forbidden: Admin or Owner access required' }

  await withTransaction<MenuItem>(DB_FILES.MENU, (menu) => {
    const item = menu.find(m => m.id === id)
    if (item) {
      item.isActive = false
      item.updatedAt = new Date().toISOString()
    }
    return menu
  })
  
  // Do NOT touch branch_menu_items to preserve historical order/ticket data
  revalidatePath('/menu')
}

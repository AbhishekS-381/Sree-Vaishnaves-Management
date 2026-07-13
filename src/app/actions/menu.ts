'use server'

import { withTransaction, DB_FILES } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { randomUUID } from 'crypto'
import { getSession, requireBranchAccess } from './auth'

export type MenuItem = {
  id: string
  name: string
  categoryId: string
  createdAt: string
}

export type BranchMenuItem = {
  id: string
  branchId: string
  menuItemId: string
  price: number
  isAvailable: boolean
}

export async function addMenuItem(prevState: any, formData: FormData) {
  const session = await getSession();
  if (!session?.isGlobalAdmin) return { error: 'Forbidden: Admin or Owner access required' };

  const name = formData.get('name') as string
  const categoryId = formData.get('categoryId') as string

  if (!name || !categoryId) {
    return { error: 'Missing required fields' }
  }

  let alreadyExists = false;
  const success = await withTransaction<MenuItem>(DB_FILES.MENU, (menu) => {
    if (menu.some(m => m.name.toLowerCase() === name.toLowerCase() && m.categoryId === categoryId)) {
      alreadyExists = true;
      return menu;
    }
    menu.push({
      id: `mn_${randomUUID()}`,
      name,
      categoryId,
      createdAt: new Date().toISOString()
    })
    return menu
  })

  if (alreadyExists) return { error: 'A menu item with this name already exists in this category' }
  if (!success) return { error: 'Failed to add menu item' }
  revalidatePath('/menu')
  return { success: true }
}

export async function toggleMenuItemStatus(branchId: string, menuItemId: string, currentState: boolean) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  if (!session.isGlobalAdmin && branchId !== session.branchId) return { error: 'Forbidden' };

  await withTransaction<BranchMenuItem>(DB_FILES.BRANCH_MENU_ITEMS, (items) => {
    const item = items.find(m => m.branchId === branchId && m.menuItemId === menuItemId)
    if (item) {
      item.isAvailable = !currentState
    } else {
      items.push({
        id: `bmi_${randomUUID()}`,
        branchId,
        menuItemId,
        price: 0,
        isAvailable: !currentState
      })
    }
    return items
  })
  revalidatePath('/menu')
}

export async function updateBranchMenuItemPrice(branchId: string, menuItemId: string, price: number) {
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
        isAvailable: false
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
    return menu.filter(m => m.id !== id)
  })
  
  // Clean up branch mapping
  await withTransaction<BranchMenuItem>(DB_FILES.BRANCH_MENU_ITEMS, (items) => {
    return items.filter(m => m.menuItemId !== id)
  })

  revalidatePath('/menu')
}

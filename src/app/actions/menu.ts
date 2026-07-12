'use server'

import { withTransaction, DB_FILES } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { randomUUID } from 'crypto'
import { getSession, requireBranchAccess } from './auth'

export type MenuItem = {
  id: string
  name: string
  categoryId: string
  price: number
  branchId: string
  isAvailable: boolean
  createdAt: string
}

export async function addMenuItem(prevState: any, formData: FormData) {
  const name = formData.get('name') as string
  const categoryId = formData.get('categoryId') as string
  const price = Number(formData.get('price'))
  let branchId = formData.get('branchId') as string

  if (!name || !price || !branchId || !categoryId) {
    return { error: 'Missing required fields' }
  }

  try {
    branchId = await requireBranchAccess(branchId)
  } catch (e) {
    return { error: 'Forbidden' }
  }

  let alreadyExists = false;
  const success = await withTransaction<MenuItem>(DB_FILES.MENU, (menu) => {
    if (menu.some(m => m.name.toLowerCase() === name.toLowerCase() && m.branchId === branchId && m.categoryId === categoryId)) {
      alreadyExists = true;
      return menu;
    }
    menu.push({
      id: `mn_${randomUUID()}`,
      name,
      categoryId,
      price: Number(price),
      branchId,
      isAvailable: true,
      createdAt: new Date().toISOString()
    })
    return menu
  })

  if (alreadyExists) return { error: 'A menu item with this name already exists in this category and branch' }
  if (!success) return { error: 'Failed to add menu item' }
  revalidatePath('/menu')
  return { success: true }
}

export async function toggleMenuItemStatus(id: string, currentState: boolean) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }

  await withTransaction<MenuItem>(DB_FILES.MENU, (menu) => {
    const item = menu.find(m => m.id === id)
    if (item) {
      if (!session.isGlobalAdmin && item.branchId !== session.branchId) return menu;
      item.isAvailable = !currentState
    }
    return menu
  })
  revalidatePath('/menu')
}

export async function deleteMenuItem(id: string) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }

  await withTransaction<MenuItem>(DB_FILES.MENU, (menu) => {
    return menu.filter(m => {
      if (m.id === id) {
        if (!session.isGlobalAdmin && m.branchId !== session.branchId) return true; // Don't delete
        return false; // Delete
      }
      return true;
    })
  })
  revalidatePath('/menu')
}

'use server'

import { withTransaction, DB_FILES } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { randomUUID } from 'crypto'
import { getSession, requireBranchAccess } from './auth'

export type MenuItem = {
  id: string
  branchId: string
  name: string
  category: string
  price: number
  isAvailable: boolean
  createdAt: string
}

export async function addMenuItem(prevState: any, formData: FormData) {
  const name = formData.get('name') as string
  const category = formData.get('category') as string
  const price = Number(formData.get('price'))
  let branchId = formData.get('branchId') as string

  if (!name || !category || !price || !branchId) {
    return { error: 'All fields are required' }
  }

  try {
    branchId = await requireBranchAccess(branchId)
  } catch (e) {
    return { error: 'Forbidden' }
  }

  const newItem: MenuItem = {
    id: `mn_${randomUUID().split('-')[0]}`,
    name,
    category,
    price,
    branchId,
    isAvailable: true,
    createdAt: new Date().toISOString()
  }

  const success = await withTransaction<MenuItem>(DB_FILES.MENU, (menu) => {
    menu.push(newItem)
    return menu
  })

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

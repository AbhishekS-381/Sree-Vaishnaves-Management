'use server'

import { withTransaction, DB_FILES } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { randomUUID } from 'crypto'

type MenuCategory = {
  id: string
  name: string
}

import { getSession } from '@/app/actions/auth';

export async function addMenuCategory(prevState: any, formData: FormData) {
  const session = await getSession();
  if (!session?.isGlobalAdmin) return { error: 'Forbidden: Owner access required' };

  const name = formData.get('name') as string
  if (!name) return { error: 'Name is required' }

  const newItem = {
    id: `mcat_${randomUUID().split('-')[0]}`,
    name
  }

  const success = await withTransaction<MenuCategory>(DB_FILES.MENU_CATEGORIES, (list) => {
    list.push(newItem)
    return list
  })

  if (!success) return { error: 'Failed to add menu category' }
  revalidatePath('/settings')
  revalidatePath('/menu')
  revalidatePath('/staff')
  return { success: true }
}

export async function updateMenuCategory(prevState: any, formData: FormData) {
  const session = await getSession();
  if (!session?.isGlobalAdmin) return { error: 'Forbidden: Owner access required' };

  const id = formData.get('id') as string
  const name = formData.get('name') as string

  if (!id || !name) return { error: 'Invalid data' }

  let notFound = false
  const success = await withTransaction<MenuCategory>(DB_FILES.MENU_CATEGORIES, (list) => {
    const index = list.findIndex(c => c.id === id)
    if (index === -1) {
      notFound = true
      return list
    }
    list[index].name = name
    return list
  })

  if (notFound) return { error: 'Not found' }
  if (!success) return { error: 'Transaction failed' }
  revalidatePath('/settings')
  revalidatePath('/menu')
  revalidatePath('/staff')
  return { success: true }
}

export async function deleteMenuCategory(id: string) {
  const session = await getSession();
  if (!session?.isGlobalAdmin) return { error: 'Forbidden: Owner access required' };

  const success = await withTransaction<MenuCategory>(DB_FILES.MENU_CATEGORIES, (list) => {
    return list.filter(c => c.id !== id)
  })

  if (!success) return { error: 'Failed to delete menu category' }
    revalidatePath('/settings')
    revalidatePath('/menu')
    revalidatePath('/staff')
    return { success: true }
}

'use server'

import { withTransaction, DB_FILES } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { randomUUID } from 'crypto'

type MenuCategory = {
  id: string
  name: string
  sortOrder?: number
  isActive?: boolean
}

export type BranchMenuCategory = {
  id: string
  branchId: string
  categoryId: string
  isAvailable: boolean
}

import { getSession } from '@/app/actions/auth';

export async function addMenuCategory(prevState: any, formData: FormData) {
  const session = await getSession();
  if (!session?.isGlobalAdmin) return { error: 'Forbidden: Admin or Owner access required' };

  const name = formData.get('name') as string
  const sortOrder = Number(formData.get('sortOrder')) || Date.now()
  if (!name) return { error: 'Name is required' }

  let alreadyExists = false;
  const success = await withTransaction<MenuCategory>(DB_FILES.MENU_CATEGORIES, (cats) => {
    if (cats.some(c => c.name.toLowerCase() === name.toLowerCase() && c.isActive !== false)) {
      alreadyExists = true;
      return cats;
    }
    cats.push({ id: `mcat_${randomUUID()}`, name, sortOrder, isActive: true })
    return cats;
  })

  if (alreadyExists) return { error: 'Category name already exists' }

  if (!success) return { error: 'Failed to add menu category' }
  revalidatePath('/settings')
  revalidatePath('/menu')
  revalidatePath('/staff')
  return { success: true }
}

export async function updateMenuCategory(prevState: any, formData: FormData) {
  const session = await getSession();
  if (!session?.isGlobalAdmin) return { error: 'Forbidden: Admin or Owner access required' };

  const id = formData.get('id') as string
  const name = formData.get('name') as string
  const sortOrderStr = formData.get('sortOrder') as string

  if (!id || !name) return { error: 'Invalid data' }

  let notFound = false;
  let alreadyExists = false;
  const success = await withTransaction<MenuCategory>(DB_FILES.MENU_CATEGORIES, (cats) => {
    const idx = cats.findIndex(c => c.id === id)
    if (idx === -1) {
      notFound = true;
      return cats;
    }
    if (cats.some(c => c.name.toLowerCase() === name.toLowerCase() && c.id !== id && c.isActive !== false)) {
      alreadyExists = true;
      return cats;
    }
    cats[idx].name = name;
    if (sortOrderStr) {
      cats[idx].sortOrder = Number(sortOrderStr);
    }
    return cats;
  })

  if (notFound) return { error: 'Category not found' }
  if (alreadyExists) return { error: 'Category name already exists' }
  if (!success) return { error: 'Transaction failed' }
  revalidatePath('/settings')
  revalidatePath('/menu')
  revalidatePath('/staff')
  return { success: true }
}

export async function deleteMenuCategory(id: string) {
  const session = await getSession();
  if (!session?.isGlobalAdmin) return { error: 'Forbidden: Admin or Owner access required' };

  const success = await withTransaction<MenuCategory>(DB_FILES.MENU_CATEGORIES, (list) => {
    const cat = list.find(c => c.id === id)
    if (cat) {
      cat.isActive = false
    }
    return list
  })

  if (!success) return { error: 'Failed to delete menu category' }
  revalidatePath('/settings')
  revalidatePath('/menu')
  revalidatePath('/staff')
  return { success: true }
}

export async function setBranchCategoryAvailability(branchId: string, categoryId: string, isAvailable: boolean) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  if (!session.isGlobalAdmin && branchId !== session.branchId) return { error: 'Forbidden' };

  await withTransaction<BranchMenuCategory>(DB_FILES.BRANCH_CATEGORIES, (cats) => {
    const cat = cats.find(c => c.branchId === branchId && c.categoryId === categoryId)
    if (cat) {
      cat.isAvailable = isAvailable
    } else {
      cats.push({
        id: `bcat_${randomUUID()}`,
        branchId,
        categoryId,
        isAvailable
      })
    }
    return cats
  })
  revalidatePath('/menu')
}

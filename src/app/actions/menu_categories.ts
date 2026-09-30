'use server'

import { withTransaction, DB_FILES } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { randomUUID } from 'crypto'
import { getSession, requireBranchAccess } from '@/app/actions/auth'
import { logAction } from '@/lib/audit'

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

function revalidateCategoryConsumers() {
  revalidatePath('/management/settings')
  revalidatePath('/management/menu')
  revalidatePath('/management/staff') // categories double as chef specialties
}

export async function addMenuCategory(prevState: any, formData: FormData) {
  const session = await getSession()
  if (!session?.isGlobalAdmin) return { error: 'Forbidden: Admin or Owner access required' }

  const name = (formData.get('name') as string)?.trim()
  const sortOrder = Number(formData.get('sortOrder')) || Date.now()
  if (!name) return { error: 'Name is required' }
  if (name.length > 100) return { error: 'Name too long' }

  let alreadyExists = false
  let newId = ''
  const success = await withTransaction<MenuCategory>(DB_FILES.MENU_CATEGORIES, (cats) => {
    if (cats.some(c => c.name.toLowerCase() === name.toLowerCase() && c.isActive !== false)) {
      alreadyExists = true
      return cats
    }
    newId = `mcat_${randomUUID()}`
    cats.push({ id: newId, name, sortOrder, isActive: true })
    return cats
  })

  if (alreadyExists) return { error: 'Category name already exists' }
  if (!success) return { error: 'Failed to add menu category' }

  await logAction('CREATE_MENU_CATEGORY', 'MENU_CATEGORY', JSON.stringify({ name }), newId)
  revalidateCategoryConsumers()
  return { success: true }
}

export async function updateMenuCategory(prevState: any, formData: FormData) {
  const session = await getSession()
  if (!session?.isGlobalAdmin) return { error: 'Forbidden: Admin or Owner access required' }

  const id = formData.get('id') as string
  const name = (formData.get('name') as string)?.trim()
  const sortOrderStr = formData.get('sortOrder') as string

  if (!id || !name) return { error: 'Invalid data' }
  if (name.length > 100) return { error: 'Name too long' }

  let notFound = false
  let alreadyExists = false
  const success = await withTransaction<MenuCategory>(DB_FILES.MENU_CATEGORIES, (cats) => {
    const idx = cats.findIndex(c => c.id === id)
    if (idx === -1) { notFound = true; return cats }
    if (cats.some(c => c.name.toLowerCase() === name.toLowerCase() && c.id !== id && c.isActive !== false)) {
      alreadyExists = true
      return cats
    }
    cats[idx].name = name
    if (sortOrderStr) cats[idx].sortOrder = Number(sortOrderStr)
    return cats
  })

  if (notFound) return { error: 'Category not found' }
  if (alreadyExists) return { error: 'Category name already exists' }
  if (!success) return { error: 'Transaction failed' }

  await logAction('UPDATE_MENU_CATEGORY', 'MENU_CATEGORY', JSON.stringify({ name }), id)
  revalidateCategoryConsumers()
  return { success: true }
}

/**
 * Persist an explicit category order in ONE atomic write.
 * Replaces the previous two-call sortOrder swap, which could corrupt the order
 * if the second call failed.
 */
export async function reorderMenuCategories(orderedIds: string[]) {
  const session = await getSession()
  if (!session?.isGlobalAdmin) return { error: 'Forbidden: Admin or Owner access required' }
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) return { error: 'Nothing to reorder' }

  const success = await withTransaction<MenuCategory>(DB_FILES.MENU_CATEGORIES, (cats) => {
    orderedIds.forEach((id, index) => {
      const cat = cats.find(c => c.id === id)
      if (cat) cat.sortOrder = index
    })
    return cats
  })

  if (!success) return { error: 'Transaction failed' }
  await logAction('REORDER_MENU_CATEGORIES', 'MENU_CATEGORY', JSON.stringify({ count: orderedIds.length }))
  revalidateCategoryConsumers()
  return { success: true }
}

export async function deleteMenuCategory(id: string) {
  const session = await getSession()
  if (!session?.isGlobalAdmin) return { error: 'Forbidden: Admin or Owner access required' }

  let notFound = false
  const success = await withTransaction<MenuCategory>(DB_FILES.MENU_CATEGORIES, (list) => {
    const cat = list.find(c => c.id === id)
    if (!cat) { notFound = true; return list }
    cat.isActive = false
    return list
  })

  if (notFound) return { error: 'Category not found' }
  if (!success) return { error: 'Failed to delete menu category' }

  await logAction('DELETE_MENU_CATEGORY', 'MENU_CATEGORY', 'Archived category', id)
  revalidateCategoryConsumers()
  return { success: true }
}

export async function setBranchCategoryAvailability(
  branchId: string,
  categoryId: string,
  isAvailable: boolean
) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }

  let enforcedBranch: string
  try {
    enforcedBranch = await requireBranchAccess(branchId)
  } catch (e: any) {
    return { error: e?.message || 'Forbidden' }
  }
  if (!enforcedBranch) return { error: 'Branch is required' }

  const success = await withTransaction<BranchMenuCategory>(DB_FILES.BRANCH_CATEGORIES, (cats) => {
    const cat = cats.find(c => c.branchId === enforcedBranch && c.categoryId === categoryId)
    if (cat) {
      cat.isAvailable = isAvailable
    } else {
      cats.push({
        id: `bcat_${randomUUID()}`,
        branchId: enforcedBranch,
        categoryId,
        isAvailable,
      })
    }
    return cats
  })

  if (!success) return { error: 'Failed to update category availability' }
  await logAction(
    'SET_CATEGORY_AVAILABILITY', 'BRANCH_MENU_CATEGORY',
    JSON.stringify({ branchId: enforcedBranch, categoryId, isAvailable }), categoryId
  )
  return { success: true }
}

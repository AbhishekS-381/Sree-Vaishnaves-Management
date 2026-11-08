'use server'

import { db, menuCategories, branchCategories, withDbTransaction } from '@/lib/db'
import { eq, and, ilike, ne, isNull } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { randomUUID } from 'crypto'
import { getSession, requireBranchAccess } from '@/app/actions/auth'
import { logAction } from '@/lib/audit'

export type MenuCategory = {
  id: string
  name: string
  sortOrder?: number
  isActive?: boolean
  deletedAt?: Date | null
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function addMenuCategory(prevState: any, formData: FormData) {
  const session = await getSession()
  if (!session?.isGlobalAdmin) return { error: 'Forbidden: Admin or Owner access required' }

  const name = (formData.get('name') as string)?.trim()
  const sortOrder = Number(formData.get('sortOrder')) || Date.now()
  if (!name) return { error: 'Name is required' }
  if (name.length > 100) return { error: 'Name too long' }

  try {
    const existing = await db
      .select({ id: menuCategories.id })
      .from(menuCategories)
      .where(
        and(
          ilike(menuCategories.name, name),
          eq(menuCategories.isActive, true),
          isNull(menuCategories.deletedAt)
        )
      )
      .limit(1)

    if (existing.length > 0) {
      return { error: 'Category name already exists' }
    }

    const newId = randomUUID()
    await db.insert(menuCategories).values({
      id: newId,
      name,
      sortOrder,
      isActive: true,
    })

    await logAction('CREATE_MENU_CATEGORY', 'MENU_CATEGORY', JSON.stringify({ name }), newId)
    revalidateCategoryConsumers()
    return { success: true }
  } catch (error) {
    console.error('Failed to add menu category:', error)
    return { error: 'Failed to add menu category' }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateMenuCategory(prevState: any, formData: FormData) {
  const session = await getSession()
  if (!session?.isGlobalAdmin) return { error: 'Forbidden: Admin or Owner access required' }

  const id = formData.get('id') as string
  const name = (formData.get('name') as string)?.trim()
  const sortOrderStr = formData.get('sortOrder') as string

  if (!id || !name) return { error: 'Invalid data' }
  if (name.length > 100) return { error: 'Name too long' }

  try {
    const target = await db
      .select()
      .from(menuCategories)
      .where(and(eq(menuCategories.id, id), isNull(menuCategories.deletedAt)))
      .limit(1)

    if (target.length === 0) return { error: 'Category not found' }

    const duplicate = await db
      .select({ id: menuCategories.id })
      .from(menuCategories)
      .where(
        and(
          ilike(menuCategories.name, name),
          eq(menuCategories.isActive, true),
          isNull(menuCategories.deletedAt),
          ne(menuCategories.id, id)
        )
      )
      .limit(1)

    if (duplicate.length > 0) {
      return { error: 'Category name already exists' }
    }

    await db
      .update(menuCategories)
      .set({
        name,
        ...(sortOrderStr ? { sortOrder: Number(sortOrderStr) } : {}),
      })
      .where(eq(menuCategories.id, id))

    await logAction('UPDATE_MENU_CATEGORY', 'MENU_CATEGORY', JSON.stringify({ name }), id)
    revalidateCategoryConsumers()
    return { success: true }
  } catch (error) {
    console.error('Failed to update menu category:', error)
    return { error: 'Transaction failed' }
  }
}

export async function reorderMenuCategories(orderedIds: string[]) {
  const session = await getSession()
  if (!session?.isGlobalAdmin) return { error: 'Forbidden: Admin or Owner access required' }
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) return { error: 'Nothing to reorder' }

  try {
    await withDbTransaction(async (tx) => {
      for (let index = 0; index < orderedIds.length; index++) {
        const id = orderedIds[index]
        await tx
          .update(menuCategories)
          .set({ sortOrder: index })
          .where(eq(menuCategories.id, id))
      }
    })

    await logAction('REORDER_MENU_CATEGORIES', 'MENU_CATEGORY', JSON.stringify({ count: orderedIds.length }))
    revalidateCategoryConsumers()
    return { success: true }
  } catch (error) {
    console.error('Failed to reorder menu categories:', error)
    return { error: 'Transaction failed' }
  }
}

export async function deleteMenuCategory(id: string) {
  const session = await getSession()
  if (!session?.isGlobalAdmin) return { error: 'Forbidden: Admin or Owner access required' }

  try {
    const target = await db
      .select({ id: menuCategories.id })
      .from(menuCategories)
      .where(and(eq(menuCategories.id, id), isNull(menuCategories.deletedAt)))
      .limit(1)

    if (target.length === 0) return { error: 'Category not found' }

    await db
      .update(menuCategories)
      .set({
        isActive: false,
        deletedAt: new Date(),
      })
      .where(eq(menuCategories.id, id))

    await logAction('DELETE_MENU_CATEGORY', 'MENU_CATEGORY', 'Archived category', id)
    revalidateCategoryConsumers()
    return { success: true }
  } catch (error) {
    console.error('Failed to delete menu category:', error)
    return { error: 'Failed to delete menu category' }
  }
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    return { error: e?.message || 'Forbidden' }
  }
  if (!enforcedBranch) return { error: 'Branch is required' }

  try {
    const existing = await db
      .select({ id: branchCategories.id })
      .from(branchCategories)
      .where(
        and(
          eq(branchCategories.branchId, enforcedBranch),
          eq(branchCategories.categoryId, categoryId)
        )
      )
      .limit(1)

    if (existing.length > 0) {
      await db
        .update(branchCategories)
        .set({ isAvailable })
        .where(eq(branchCategories.id, existing[0].id))
    } else {
      await db.insert(branchCategories).values({
        id: randomUUID(),
        branchId: enforcedBranch,
        categoryId,
        isAvailable,
      })
    }

    await logAction(
      'SET_CATEGORY_AVAILABILITY',
      'BRANCH_MENU_CATEGORY',
      JSON.stringify({ branchId: enforcedBranch, categoryId, isAvailable }),
      categoryId
    )
    revalidateCategoryConsumers()
    return { success: true }
  } catch (error) {
    console.error('Failed to set category availability:', error)
    return { error: 'Failed to update category availability' }
  }
}

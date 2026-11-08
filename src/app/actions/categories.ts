'use server'

import { db, categories } from '@/lib/db'
import { eq, and, ilike, ne } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { getSession } from './auth'

export type ExpenseCategory = {
  id: string
  name: string
  color?: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function addCategory(prevState: any, formData: FormData) {
  const session = await getSession()
  if (!session?.isGlobalAdmin) return { error: 'Forbidden' }
  const name = formData.get('name')?.toString()
  const color = formData.get('color')?.toString() || '#64748b' // default slate
  
  if (!name) return { error: 'Name is required' }

  try {
    const existing = await db
      .select({ id: categories.id })
      .from(categories)
      .where(and(ilike(categories.name, name), eq(categories.isActive, true)))
      .limit(1)

    if (existing.length > 0) {
      return { error: 'Category already exists' }
    }

    await db.insert(categories).values({
      id: randomUUID(),
      name,
      color,
      isActive: true,
    })

    revalidatePath('/management/settings')
    return { success: true }
  } catch (error) {
    console.error('Failed to add category:', error)
    return { error: 'Transaction failed' }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateCategory(prevState: any, formData: FormData) {
  const session = await getSession()
  if (!session?.isGlobalAdmin) return { error: 'Forbidden' }
  const id = formData.get('id')?.toString()
  const name = formData.get('name')?.toString()
  const color = formData.get('color')?.toString()

  if (!id || !name) return { error: 'Missing required fields' }

  try {
    const target = await db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.id, id), eq(categories.isActive, true)))
      .limit(1)

    if (target.length === 0) {
      return { error: 'Category not found' }
    }

    const duplicate = await db
      .select({ id: categories.id })
      .from(categories)
      .where(and(ilike(categories.name, name), eq(categories.isActive, true), ne(categories.id, id)))
      .limit(1)

    if (duplicate.length > 0) {
      return { error: 'Category name already exists' }
    }

    await db
      .update(categories)
      .set({ name, color })
      .where(eq(categories.id, id))

    revalidatePath('/management/settings')
    revalidatePath('/management/eod')
    revalidatePath('/management/vendors')
    revalidatePath('/management/expenses')
    revalidatePath('/management/reports')
    return { success: true }
  } catch (error) {
    console.error('Failed to update category:', error)
    return { error: 'Transaction failed' }
  }
}

export async function deleteCategory(id: string) {
  const session = await getSession()
  if (!session?.isGlobalAdmin) return { error: 'Forbidden' }
  
  try {
    const target = await db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.id, id), eq(categories.isActive, true)))
      .limit(1)

    if (target.length === 0) {
      return { error: 'Category not found' }
    }

    await db
      .update(categories)
      .set({ isActive: false, deletedAt: new Date() })
      .where(eq(categories.id, id))

    revalidatePath('/management/settings')
    return { success: true }
  } catch (error) {
    console.error('Failed to delete category:', error)
    return { error: 'Transaction failed' }
  }
}

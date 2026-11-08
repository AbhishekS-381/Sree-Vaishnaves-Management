'use server'

import { db, users } from '@/lib/db'
import { eq, and, ilike, ne } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { getSession } from './auth'
import bcrypt from 'bcryptjs'
import { BRANCH_SCOPED_ROLES } from '@/lib/posUtils'

export type User = {
  id: string
  name: string
  password?: string
  role: string
  branchId?: string
  isActive?: boolean
  deletedAt?: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function addUser(prevState: any, formData: FormData) {
  const session = await getSession()
  if (!session?.isGlobalAdmin) return { error: 'Forbidden' }

  const name = formData.get('name') as string
  const password = formData.get('password') as string
  const role = (formData.get('role') as string)?.toLowerCase()
  const branchId = formData.get('branchId') as string

  if (!name || !password || !role) return { error: 'All fields required' }

  // POS-dedicated roles require a branchId
  const isBranchScoped = (BRANCH_SCOPED_ROLES as readonly string[]).includes(role)
  if (isBranchScoped && !branchId) return { error: 'Branch is required for this role' }

  try {
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(and(ilike(users.name, name), eq(users.isActive, true)))
      .limit(1)

    if (existing.length > 0) {
      return { error: 'Username already exists' }
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    await db.insert(users).values({
      id: randomUUID(),
      name,
      password: hashedPassword,
      role,
      branchId: isBranchScoped && branchId ? branchId : undefined,
      isActive: true,
    })

    revalidatePath('/management/settings')
    return { success: true }
  } catch (error) {
    console.error('Failed to add user:', error)
    return { error: 'Transaction failed' }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateUser(prevState: any, formData: FormData) {
  const session = await getSession()
  if (!session?.isGlobalAdmin) return { error: 'Forbidden' }

  const id = formData.get('id') as string
  const name = formData.get('name') as string
  const password = formData.get('password') as string // optional to update
  const role = (formData.get('role') as string)?.toLowerCase()
  const branchId = formData.get('branchId') as string

  if (!id || !name || !role) return { error: 'Invalid data' }

  // POS-dedicated roles require a branchId
  const isBranchScoped = (BRANCH_SCOPED_ROLES as readonly string[]).includes(role)
  if (isBranchScoped && !branchId) return { error: 'Branch is required for this role' }

  try {
    const target = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1)

    if (target.length === 0) {
      return { error: 'Not found' }
    }

    const user = target[0]

    const duplicate = await db
      .select({ id: users.id })
      .from(users)
      .where(and(ilike(users.name, name), eq(users.isActive, true), ne(users.id, id)))
      .limit(1)

    if (duplicate.length > 0) {
      return { error: 'Username taken by another user' }
    }

    if (user.role === 'admin' && role !== 'admin') {
      return { error: 'Cannot demote the admin account' }
    }

    const hashedPassword = password ? await bcrypt.hash(password, 10) : undefined

    await db
      .update(users)
      .set({
        name,
        role,
        branchId: isBranchScoped && branchId ? branchId : undefined,
        ...(hashedPassword ? { password: hashedPassword } : {}),
      })
      .where(eq(users.id, id))

    revalidatePath('/management/settings')
    return { success: true }
  } catch (error) {
    console.error('Failed to update user:', error)
    return { error: 'Transaction failed' }
  }
}

export async function deleteUser(id: string) {
  const session = await getSession()
  if (!session?.isGlobalAdmin) return { error: 'Forbidden' }

  try {
    const target = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1)

    if (target.length > 0) {
      if (target[0].role === 'admin') {
        return { error: 'Cannot delete the admin account' }
      }

      await db
        .update(users)
        .set({ isActive: false, deletedAt: new Date() })
        .where(eq(users.id, id))
    }

    revalidatePath('/management/settings')
    return { success: true }
  } catch (error) {
    console.error('Failed to delete user:', error)
    return { error: 'Transaction failed' }
  }
}

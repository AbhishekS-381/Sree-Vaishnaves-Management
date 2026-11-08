'use server'

import { db, departments, roles, staff, staffRequirements } from '@/lib/db'
import { eq, and, ilike, ne, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { randomUUID } from 'crypto'
import { z } from 'zod'
import { getSession } from '@/app/actions/auth'

// --- Departments ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function addDepartment(prevState: any, formData: FormData) {
  const session = await getSession()
  if (session?.role !== 'admin') return { error: 'Forbidden: Only admin can manage settings' }

  const name = formData.get('name') as string

  const schema = z.object({ name: z.string().min(1).max(100).trim() })
  const parsed = schema.safeParse({ name })
  if (!parsed.success) return { error: 'Name is required' }

  try {
    const existing = await db
      .select({ id: departments.id })
      .from(departments)
      .where(and(ilike(departments.name, name), eq(departments.isActive, true)))
      .limit(1)

    if (existing.length > 0) {
      return { error: 'Department name already exists' }
    }

    await db.insert(departments).values({
      id: randomUUID(),
      name,
      isActive: true,
    })

    revalidatePath('/management/settings')
    return { success: true }
  } catch (error) {
    console.error('Failed to add department:', error)
    return { error: 'Failed to add department' }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateDepartment(prevState: any, formData: FormData) {
  const session = await getSession()
  if (session?.role !== 'admin') return { error: 'Forbidden: Only admin can manage settings' }

  const id = formData.get('id') as string
  const name = formData.get('name') as string

  const schema = z.object({ name: z.string().min(1).max(100).trim() })
  const parsed = schema.safeParse({ name })
  if (!id || !parsed.success) return { error: 'Invalid data' }

  try {
    const target = await db
      .select({ id: departments.id })
      .from(departments)
      .where(eq(departments.id, id))
      .limit(1)

    if (target.length === 0) {
      return { error: 'Not found' }
    }

    const duplicate = await db
      .select({ id: departments.id })
      .from(departments)
      .where(and(ilike(departments.name, name), eq(departments.isActive, true), ne(departments.id, id)))
      .limit(1)

    if (duplicate.length > 0) {
      return { error: 'Department name already exists' }
    }

    await db
      .update(departments)
      .set({ name })
      .where(eq(departments.id, id))

    revalidatePath('/management/settings')
    return { success: true }
  } catch (error) {
    console.error('Failed to update department:', error)
    return { error: 'Transaction failed' }
  }
}

export async function deleteDepartment(id: string) {
  const session = await getSession()
  if (session?.role !== 'admin') return { error: 'Forbidden: Only admin can manage settings' }

  try {
    // Prevent deleting departments that are the sole link for any active role
    const activeRoles = await db
      .select({ name: roles.name, departmentIds: roles.departmentIds })
      .from(roles)
      .where(eq(roles.isActive, true))

    const orphanedRoles = activeRoles.filter(r => {
      const deptIds = (r.departmentIds as string[]) || []
      return deptIds.includes(id) && deptIds.length === 1
    })

    if (orphanedRoles.length > 0) {
      return {
        error: `Cannot delete — ${orphanedRoles.map(r => r.name).join(', ')} would become unassignable. Relink them first.`
      }
    }

    const target = await db
      .select({ id: departments.id })
      .from(departments)
      .where(and(eq(departments.id, id), eq(departments.isActive, true)))
      .limit(1)

    if (target.length === 0) {
      return { error: 'Department not found' }
    }

    await db
      .update(departments)
      .set({ isActive: false, deletedAt: new Date() })
      .where(eq(departments.id, id))

    revalidatePath('/management/settings')
    return { success: true }
  } catch (error) {
    console.error('Failed to delete department:', error)
    return { error: 'Failed to delete department' }
  }
}

// --- Roles ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function addRole(prevState: any, formData: FormData) {
  const session = await getSession()
  if (session?.role !== 'admin') return { error: 'Forbidden: Only admin can manage settings' }

  const name = formData.get('name') as string
  const isChef = formData.get('isChef') === 'on'
  const departmentIds = formData.getAll('departmentIds') as string[]

  const schema = z.object({ name: z.string().min(1).max(100).trim() })
  const parsed = schema.safeParse({ name })
  if (!parsed.success) return { error: 'Name is required' }

  try {
    const existing = await db
      .select({ id: roles.id })
      .from(roles)
      .where(and(ilike(roles.name, name), eq(roles.isActive, true)))
      .limit(1)

    if (existing.length > 0) {
      return { error: 'Role name already exists' }
    }

    await db.insert(roles).values({
      id: randomUUID(),
      name,
      isChef,
      departmentIds,
      isActive: true,
    })

    revalidatePath('/management/settings')
    return { success: true }
  } catch (error) {
    console.error('Failed to add role:', error)
    return { error: 'Failed to add role' }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateRole(prevState: any, formData: FormData) {
  const session = await getSession()
  if (session?.role !== 'admin') return { error: 'Forbidden: Only admin can manage settings' }

  const id = formData.get('id') as string
  const name = formData.get('name') as string
  const isChef = formData.get('isChef') === 'on'
  const departmentIds = formData.getAll('departmentIds') as string[]

  const schema = z.object({ name: z.string().min(1).max(100).trim() })
  const parsed = schema.safeParse({ name })
  if (!id || !parsed.success) return { error: 'Invalid data' }

  try {
    const target = await db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.id, id))
      .limit(1)

    if (target.length === 0) {
      return { error: 'Not found' }
    }

    const duplicate = await db
      .select({ id: roles.id })
      .from(roles)
      .where(and(ilike(roles.name, name), eq(roles.isActive, true), ne(roles.id, id)))
      .limit(1)

    if (duplicate.length > 0) {
      return { error: 'Role name already exists' }
    }

    await db
      .update(roles)
      .set({ name, isChef, departmentIds })
      .where(eq(roles.id, id))

    revalidatePath('/management/settings')
    return { success: true }
  } catch (error) {
    console.error('Failed to update role:', error)
    return { error: 'Transaction failed' }
  }
}

export async function deleteRole(id: string) {
  const session = await getSession()
  if (session?.role !== 'admin') return { error: 'Forbidden: Only admin can manage settings' }

  try {
    // Prevent deleting roles that are in use by staff
    const staffRows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(staff)
      .where(and(eq(staff.roleId, id), eq(staff.isActive, true)))

    const inUse = staffRows[0]?.count ?? 0
    if (inUse > 0) {
      return { error: `Cannot delete — ${inUse} active staff member(s) use this role. Reassign them first.` }
    }

    // Prevent deleting roles that are in use by staff requirements
    const reqsRows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(staffRequirements)
      .where(and(eq(staffRequirements.roleId, id), eq(staffRequirements.isActive, true)))

    const reqsInUse = reqsRows[0]?.count ?? 0
    if (reqsInUse > 0) {
      return { error: `Cannot delete — ${reqsInUse} open position(s) use this role. Delete them first.` }
    }

    const target = await db
      .select({ id: roles.id })
      .from(roles)
      .where(and(eq(roles.id, id), eq(roles.isActive, true)))
      .limit(1)

    if (target.length === 0) {
      return { error: 'Role not found' }
    }

    await db
      .update(roles)
      .set({ isActive: false, deletedAt: new Date() })
      .where(eq(roles.id, id))

    revalidatePath('/management/settings')
    return { success: true }
  } catch (error) {
    console.error('Failed to delete role:', error)
    return { error: 'Failed to delete role' }
  }
}

'use server'

import { withTransaction, readJSON, writeJSON, DB_FILES } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { randomUUID } from 'crypto'
import { z } from 'zod'
import { getSession } from '@/app/actions/auth'

// --- Departments ---

type Department = {
  id: string
  name: string
  isActive?: boolean
  deletedAt?: string
}

export async function addDepartment(prevState: any, formData: FormData) {
  const session = await getSession()
  if (session?.role !== 'owner') return { error: 'Forbidden' }

  const name = formData.get('name') as string

  const schema = z.object({ name: z.string().min(1).max(100).trim() });
  const parsed = schema.safeParse({ name });
  if (!parsed.success) return { error: 'Name is required' }

  const newDept: Department = {
    id: `dept_${randomUUID().split('-')[0]}`,
    name,
    isActive: true
  }
  let alreadyExists = false;
  const success = await withTransaction<Department>(DB_FILES.DEPARTMENTS, (list) => {
    if (list.some(d => d.isActive !== false && d.name.toLowerCase() === name.toLowerCase())) {
      alreadyExists = true; return list;
    }
    list.push(newDept)
    return list
  })

  if (alreadyExists) return { error: 'Department name already exists' }
  if (!success) return { error: 'Failed to add department' }
  revalidatePath('/settings')
  return { success: true }
}

export async function updateDepartment(prevState: any, formData: FormData) {
  const session = await getSession()
  if (session?.role !== 'owner') return { error: 'Forbidden' }

  const id = formData.get('id') as string
  const name = formData.get('name') as string

  const schema = z.object({ name: z.string().min(1).max(100).trim() });
  const parsed = schema.safeParse({ name });
  if (!id || !parsed.success) return { error: 'Invalid data' }

  let notFound = false
  const success = await withTransaction<Department>(DB_FILES.DEPARTMENTS, (list) => {
    const index = list.findIndex(d => d.id === id)
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
  return { success: true }
}

export async function deleteDepartment(id: string) {
  const session = await getSession()
  if (session?.role !== 'owner') return { error: 'Forbidden' }

  // Issue 6: Prevent deleting departments that are the sole link for any active role
  const roles = await readJSON<any>(DB_FILES.ROLES).catch(() => [])
  const orphanedRoles = roles.filter((r: any) =>
    r.isActive !== false &&
    !r.deletedAt &&
    r.departmentIds?.includes(id) &&
    r.departmentIds?.length === 1
  )
  
  if (orphanedRoles.length > 0) {
    return { error: `Cannot delete — ${orphanedRoles.map((r: any) => r.name).join(', ')} would become unassignable. Relink them first.` }
  }

  let notFound = false
  const success = await withTransaction<Department>(DB_FILES.DEPARTMENTS, (list) => {
    const index = list.findIndex(d => d.id === id)
    if (index === -1) {
      notFound = true
      return list
    }
    list[index].isActive = false
    list[index].deletedAt = new Date().toISOString()
    return list
  })

  if (notFound) return { error: 'Department not found' }
  if (!success) return { error: 'Failed to delete department' }

  revalidatePath('/settings')
  return { success: true }
}

// --- Roles ---

type Role = {
  id: string
  name: string
  isChef?: boolean
  departmentIds?: string[]
  isActive?: boolean
  deletedAt?: string
}

export async function addRole(prevState: any, formData: FormData) {
  const session = await getSession()
  if (session?.role !== 'owner') return { error: 'Forbidden' }

  const name = formData.get('name') as string
  const isChef = formData.get('isChef') === 'on'
  const departmentIds = formData.getAll('departmentIds') as string[]

  const schema = z.object({ name: z.string().min(1).max(100).trim() });
  const parsed = schema.safeParse({ name });
  if (!parsed.success) return { error: 'Name is required' }

  const newItem: Role = {
    id: `role_${randomUUID().split('-')[0]}`,
    name,
    isChef,
    departmentIds,
    isActive: true
  }
  let alreadyExists = false;
  const success = await withTransaction<Role>(DB_FILES.ROLES, (list) => {
    if (list.some(r => r.isActive !== false && r.name.toLowerCase() === name.toLowerCase())) {
      alreadyExists = true; return list;
    }
    list.push(newItem)
    return list
  })

  if (alreadyExists) return { error: 'Role name already exists' }
  if (!success) return { error: 'Failed to add role' }
  revalidatePath('/settings')
  return { success: true }
}

export async function updateRole(prevState: any, formData: FormData) {
  const session = await getSession()
  if (session?.role !== 'owner') return { error: 'Forbidden' }

  const id = formData.get('id') as string
  const name = formData.get('name') as string
  const isChef = formData.get('isChef') === 'on'
  const departmentIds = formData.getAll('departmentIds') as string[]

  const schema = z.object({ name: z.string().min(1).max(100).trim() });
  const parsed = schema.safeParse({ name });
  if (!id || !parsed.success) return { error: 'Invalid data' }

  let notFound = false
  const success = await withTransaction<Role>(DB_FILES.ROLES, (list) => {
    const index = list.findIndex(r => r.id === id)
    if (index === -1) {
      notFound = true
      return list
    }
    list[index] = { ...list[index], name, isChef, departmentIds }
    return list
  })

  if (notFound) return { error: 'Not found' }
  if (!success) return { error: 'Transaction failed' }
  revalidatePath('/settings')
  return { success: true }
}

export async function deleteRole(id: string) {
  const session = await getSession()
  if (session?.role !== 'owner') return { error: 'Forbidden' }

  // Issue 1: Prevent deleting roles that are in use
  const staffList = await readJSON<any>(DB_FILES.STAFF).catch(() => [])
  const inUse = staffList.filter((s: any) => s.roleId === id && s.isActive !== false && !s.deletedAt).length
  if (inUse > 0) {
    return { error: `Cannot delete — ${inUse} active staff member(s) use this role. Reassign them first.` }
  }

  const reqs = await readJSON<any>(DB_FILES.STAFF_REQUIREMENTS).catch(() => [])
  const reqsInUse = reqs.filter((r: any) => r.roleId === id && r.isActive !== false).length
  if (reqsInUse > 0) {
    return { error: `Cannot delete — ${reqsInUse} open position(s) use this role. Delete them first.` }
  }

  let notFound = false
  const success = await withTransaction<Role>(DB_FILES.ROLES, (list) => {
    const index = list.findIndex(r => r.id === id)
    if (index === -1) {
      notFound = true
      return list
    }
    list[index].isActive = false
    list[index].deletedAt = new Date().toISOString()
    return list
  })

  if (notFound) return { error: 'Role not found' }
  if (!success) return { error: 'Failed to delete role' }

  revalidatePath('/settings')
  return { success: true }
}

'use server'

import { withTransaction, readJSON, writeJSON, DB_FILES } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { randomUUID } from 'crypto'

// --- Departments ---

type Department = {
  id: string
  name: string
  isActive?: boolean
  deletedAt?: string
}

export async function addDepartment(prevState: any, formData: FormData) {
  const name = formData.get('name') as string

  if (!name) return { error: 'Name is required' }

  const newDept: Department = {
    id: `dept_${randomUUID().split('-')[0]}`,
    name,
    isActive: true
  }
  const success = await withTransaction<Department>(DB_FILES.DEPARTMENTS, (list) => {
    list.push(newDept)
    return list
  })

  if (!success) return { error: 'Failed to add department' }
  revalidatePath('/settings')
  return { success: true }
}

export async function updateDepartment(prevState: any, formData: FormData) {
  const id = formData.get('id') as string
  const name = formData.get('name') as string

  if (!id || !name) return { error: 'Invalid data' }

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
  isAdmin: boolean
  isChef?: boolean
  departmentIds?: string[]
  isActive?: boolean
  deletedAt?: string
}

export async function addRole(prevState: any, formData: FormData) {
  const name = formData.get('name') as string
  const isAdmin = formData.get('isAdmin') === 'on'
  const isChef = formData.get('isChef') === 'on'
  const departmentIds = formData.getAll('departmentIds') as string[]

  if (!name) return { error: 'Name is required' }

  const newItem: Role = {
    id: `role_${randomUUID().split('-')[0]}`,
    name,
    isAdmin,
    isChef,
    departmentIds,
    isActive: true
  }
  const success = await withTransaction<Role>(DB_FILES.ROLES, (list) => {
    list.push(newItem)
    return list
  })

  if (!success) return { error: 'Failed to add role' }
  revalidatePath('/settings')
  return { success: true }
}

export async function updateRole(prevState: any, formData: FormData) {
  const id = formData.get('id') as string
  const name = formData.get('name') as string
  const isAdmin = formData.get('isAdmin') === 'on'
  const isChef = formData.get('isChef') === 'on'
  const departmentIds = formData.getAll('departmentIds') as string[]

  if (!id || !name) return { error: 'Invalid data' }

  let notFound = false
  const success = await withTransaction<Role>(DB_FILES.ROLES, (list) => {
    const index = list.findIndex(r => r.id === id)
    if (index === -1) {
      notFound = true
      return list
    }
    list[index] = { ...list[index], name, isAdmin, isChef, departmentIds }
    return list
  })

  if (notFound) return { error: 'Not found' }
  if (!success) return { error: 'Transaction failed' }
  revalidatePath('/settings')
  return { success: true }
}

export async function deleteRole(id: string) {
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

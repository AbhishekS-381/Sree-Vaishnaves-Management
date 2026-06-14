'use server'

import { withTransaction, DB_FILES } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { randomUUID } from 'crypto'

type Staff = {
  id: string
  name: string
  branchId: string
  departmentId: string
  roleId: string
  phone: string
  label?: string
  monthlySalary?: number
  isActive: boolean
  joinedAt: string
  exitDate?: string
  shiftType?: 'morning' | 'evening' | 'full'
  specialtyId?: string
  positionId?: string
  startTime?: string
  endTime?: string
}

export async function addStaff(prevState: any, formData: FormData) {
  const name = formData.get('name') as string
  const phone = formData.get('phone') as string
  const branchId = formData.get('branchId') as string
  const departmentId = formData.get('departmentId') as string
  const roleId = formData.get('roleId') as string
  const label = formData.get('label') as string
  const salary = Number(formData.get('salary')) || 0
  const joinedAt = formData.get('joinedAt') as string
  const shiftType = formData.get('shiftType') as 'morning' | 'evening' | 'full' || 'full'
  const specialtyId = formData.get('specialtyId') as string || undefined
  const positionId = formData.get('positionId') as string || undefined
  const startTime = formData.get('startTime') as string || undefined
  const endTime = formData.get('endTime') as string || undefined

  if (!name || !phone || !branchId || !departmentId || !roleId) {
    return { error: 'All fields are required' }
  }

  const newStaff: Staff = {
    id: `st_${randomUUID().split('-')[0]}`,
    name,
    phone,
    branchId,
    departmentId,
    roleId,
    label: label || undefined,
    monthlySalary: salary,
    isActive: true, // Default active
    joinedAt: joinedAt || new Date().toISOString().split('T')[0],
    shiftType,
    specialtyId,
    positionId,
    startTime,
    endTime
  }

  const success = await withTransaction<Staff>(DB_FILES.STAFF, (staffList) => {
    staffList.push(newStaff)
    return staffList
  })

  if (!success) {
    return { error: 'Failed to save data' }
  }

  revalidatePath('/staff')
  return { success: true }
}

export async function updateStaff(prevState: any, formData: FormData) {
  const id = formData.get('id') as string
  const name = formData.get('name') as string
  const phone = formData.get('phone') as string
  const branchId = formData.get('branchId') as string
  const departmentId = formData.get('departmentId') as string
  const roleId = formData.get('roleId') as string
  const label = formData.get('label') as string
  const salary = Number(formData.get('salary')) || 0
  const status = formData.get('status') as string
  const joinedAt = formData.get('joinedAt') as string
  const exitDate = formData.get('exitDate') as string
  const shiftType = formData.get('shiftType') as 'morning' | 'evening' | 'full'
  const specialtyId = formData.get('specialtyId') as string || undefined
  const positionId = formData.get('positionId') as string || undefined
  const startTime = formData.get('startTime') as string || undefined
  const endTime = formData.get('endTime') as string || undefined

  if (!id || !name) return { error: 'Invalid ID or Name' }

  let notFound = false
  const success = await withTransaction<Staff>(DB_FILES.STAFF, (staffList) => {
    const index = staffList.findIndex(s => s.id === id)
    if (index === -1) {
      notFound = true
      return staffList
    }
    
    staffList[index] = {
      ...staffList[index],
      name,
      phone,
      branchId,
      departmentId,
      roleId,
      label: label || undefined,
      monthlySalary: salary,
      isActive: status === 'active',
      joinedAt: joinedAt || staffList[index].joinedAt,
      exitDate: exitDate || undefined,
      shiftType: shiftType || staffList[index].shiftType,
      specialtyId,
      positionId,
      startTime,
      endTime
    }
    return staffList
  })

  if (notFound) return { error: 'Staff not found' }
  if (!success) return { error: 'Transaction failed' }
  revalidatePath('/staff')
  return { success: true }
}

export async function toggleStaffStatus(id: string, currentlyActive: boolean) {
  let notFound = false
  const success = await withTransaction<Staff>(DB_FILES.STAFF, (staffList) => {
    const index = staffList.findIndex(s => s.id === id)
    if (index === -1) {
      notFound = true
      return staffList
    }
    staffList[index].isActive = !currentlyActive
    return staffList
  })

  if (notFound) return { error: 'Staff not found' }
  if (!success) return { error: 'Transaction failed' }
  revalidatePath('/staff')
  return { success: true }
}

export async function deleteStaff(id: string) {
  let notFound = false
  const success = await withTransaction<Staff>(DB_FILES.STAFF, (staffList) => {
    const newList = staffList.filter(s => s.id !== id)
    if (newList.length === staffList.length) {
      notFound = true
    }
    return newList
  })

  if (notFound) return { error: 'Staff not found' }
  if (!success) return { error: 'Transaction failed' }
  revalidatePath('/staff')
  return { success: true }
}

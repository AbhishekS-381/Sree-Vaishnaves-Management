'use server'

import { withTransaction, DB_FILES, readJSON } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { randomUUID } from 'crypto'
import { getSession, requireBranchAccess } from '@/app/actions/auth'
import { logAction } from '@/lib/audit'

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
  positionIndex?: number
  startTime?: string
  endTime?: string
  deletedAt?: string
}

export async function addStaff(prevState: any, formData: FormData) {
  const name = formData.get('name') as string
  const phone = formData.get('phone') as string
  let branchId = formData.get('branchId') as string
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

  try {
    branchId = await requireBranchAccess(branchId)
  } catch (err: any) {
    return { error: err.message }
  }

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
    if (newStaff.positionId) {
      const existingIndices = staffList
        .filter(s => s.isActive === true && s.positionId === newStaff.positionId)
        .map(s => s.positionIndex)
        .filter(idx => idx !== undefined) as number[];
      
      let newIndex = 0;
      while (existingIndices.includes(newIndex)) {
        newIndex++;
      }
      newStaff.positionIndex = newIndex;
    }
    
    staffList.push(newStaff)
    return staffList
  })

  if (!success) {
    return { error: 'Failed to save data' }
  }

  const session = await getSession();
  await logAction('CREATE_STAFF', 'Staff', JSON.stringify({ name, roleId }), newStaff.id);

  revalidatePath('/', 'layout')
  return { success: true }
}

export async function updateStaff(prevState: any, formData: FormData) {
  const id = formData.get('id') as string
  const name = formData.get('name') as string
  const phone = formData.get('phone') as string
  let branchId = formData.get('branchId') as string
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

  try {
    branchId = await requireBranchAccess(branchId)
  } catch (err: any) {
    return { error: err.message }
  }

  let notFound = false
  let forbidden = false
  const success = await withTransaction<Staff>(DB_FILES.STAFF, (staffList) => {
    const index = staffList.findIndex(s => s.id === id)
    if (index === -1) {
      notFound = true
      return staffList
    }
    
    // Check if branch manager is trying to edit staff from another branch
    if (staffList[index].branchId !== branchId) {
      forbidden = true
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
      positionIndex: staffList[index].positionIndex, // preserve initially, update below
      startTime,
      endTime
    }
    
    // Update positionIndex if positionId changed
    if (positionId && staffList[index].positionId !== positionId) {
      const existingIndices = staffList
        .filter(s => s.isActive === true && s.positionId === positionId && s.id !== id)
        .map(s => s.positionIndex)
        .filter(idx => idx !== undefined) as number[];
      
      let newIndex = 0;
      while (existingIndices.includes(newIndex)) {
        newIndex++;
      }
      staffList[index].positionIndex = newIndex;
    } else if (!positionId) {
      staffList[index].positionIndex = undefined;
    }
    
    return staffList
  })

  if (notFound) return { error: 'Staff not found' }
  if (forbidden) return { error: 'Forbidden: Cannot edit staff from another branch' }
  if (!success) return { error: 'Transaction failed' }
  revalidatePath('/', 'layout')
  return { success: true }
}

export async function toggleStaffStatus(id: string, currentlyActive: boolean) {
  const session = await getSession();
  if (!session) return { error: 'Unauthorized' };

  let notFound = false
  let forbidden = false
  const success = await withTransaction<Staff>(DB_FILES.STAFF, (staffList) => {
    const index = staffList.findIndex(s => s.id === id)
    if (index === -1) {
      notFound = true
      return staffList
    }
    if (!session.isGlobalAdmin && staffList[index].branchId !== session.branchId) {
      forbidden = true
      return staffList
    }
    staffList[index].isActive = !currentlyActive
    if (currentlyActive) {
      // Deactivating — unlink from position to prevent silent re-assignment on reactivation
      staffList[index].positionId = undefined
      staffList[index].positionIndex = undefined
    }
    return staffList
  })

  if (notFound) return { error: 'Staff not found' }
  if (forbidden) return { error: 'Forbidden: Cannot edit staff from another branch' }
  if (!success) return { error: 'Transaction failed' }
  revalidatePath('/', 'layout')
  return { success: true }
}

export async function deleteStaff(id: string) {
  const session = await getSession();
  if (!session?.isGlobalAdmin) {
    return { error: 'Forbidden: Only owners can delete staff' };
  }

  let notFound = false
  const success = await withTransaction<Staff>(DB_FILES.STAFF, (staffList) => {
    const index = staffList.findIndex(s => s.id === id)
    if (index === -1) {
      notFound = true
      return staffList
    }
    staffList[index].isActive = false
    staffList[index].deletedAt = new Date().toISOString()
    staffList[index].positionId = undefined  // unlink from position
    staffList[index].positionIndex = undefined
    return staffList
  })

  if (notFound) return { error: 'Staff not found' }
  if (!success) return { error: 'Transaction failed' }
  
  await logAction('DELETE_STAFF', 'Staff', 'Deleted staff member', id);

  revalidatePath('/', 'layout')
  return { success: true }
}

"use server"

import { withTransaction, DB_FILES } from '@/lib/db'
import { revalidatePath } from 'next/cache'

export async function saveRequirement(id: string | null, branchId: string, departmentId: string, roleId: string, requiredCount: number, specialtyId?: string, defaultSalary?: number, startTime?: string, endTime?: string, responsibility?: string) {
  try {
    const success = await withTransaction<any>(DB_FILES.STAFF_REQUIREMENTS, (reqs) => {
      const existingIndex = reqs.findIndex((r: any) => 
        (id && r.id === id) || 
        (!id && r.branchId === branchId && r.departmentId === departmentId && r.roleId === roleId && r.specialtyId === specialtyId)
      )

      if (existingIndex >= 0) {
        reqs[existingIndex].branchId = branchId
        reqs[existingIndex].departmentId = departmentId
        reqs[existingIndex].roleId = roleId
        reqs[existingIndex].requiredCount = requiredCount
        reqs[existingIndex].specialtyId = specialtyId
        reqs[existingIndex].defaultSalary = defaultSalary
        reqs[existingIndex].startTime = startTime
        reqs[existingIndex].endTime = endTime
        reqs[existingIndex].responsibility = responsibility
      } else {
        reqs.push({
          id: `req_${Date.now()}`,
          branchId,
          departmentId,
          roleId,
          specialtyId,
          requiredCount,
          defaultSalary,
          startTime,
          endTime,
          responsibility
        })
      }
      return reqs
    })

    if (!success) throw new Error('Transaction failed')
    revalidatePath('/staff')
    return { success: true }
  } catch (error) {
    console.error('Error saving requirement:', error)
    return { error: 'Failed to save requirement' }
  }
}

export async function deleteRequirement(id: string) {
  try {
    const success = await withTransaction<any>(DB_FILES.STAFF_REQUIREMENTS, (reqs) => {
      return reqs.filter((r: any) => r.id !== id)
    })
    
    if (!success) throw new Error('Transaction failed')
    revalidatePath('/staff')
    return { success: true }
  } catch (error) {
    console.error('Error deleting requirement:', error)
    return { error: 'Failed to delete requirement' }
  }
}

export type Shift = {
  id: string;
  start: string; // "06:00"
  end: string;   // "10:00"
}

export type PositionSchedule = {
  positionIndex: number;
  shifts: Shift[];
}

export async function updateRequirementSchedules(id: string, schedules: PositionSchedule[]) {
  try {
    const success = await withTransaction<any>(DB_FILES.STAFF_REQUIREMENTS, (reqs) => {
      const index = reqs.findIndex((r: any) => r.id === id)
      if (index >= 0) {
        reqs[index].schedules = schedules
      }
      return reqs
    })
    
    if (!success) throw new Error('Transaction failed')
    revalidatePath('/staff')
    return { success: true }
  } catch (error) {
    console.error('Error updating schedules:', error)
    return { error: 'Failed to update schedules' }
  }
}

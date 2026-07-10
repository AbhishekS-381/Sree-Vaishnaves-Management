"use server"

import { withTransaction, readJSON, DB_FILES } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { randomUUID } from 'crypto'
import { getSession, requireBranchAccess } from './auth'

export async function saveRequirement(id: string | null, branchId: string, departmentId: string, roleId: string, requiredCount: number, specialtyId?: string, defaultSalary?: number, startTime?: string, endTime?: string, responsibility?: string) {
  try {
    const enforcedBranchId = await requireBranchAccess(branchId)

    // Issue 6: Block role/department changes when staff are assigned
    if (id) {
      const [currentReqs, staffList] = await Promise.all([
        readJSON<any>(DB_FILES.STAFF_REQUIREMENTS),
        readJSON<any>(DB_FILES.STAFF)
      ])
      const existingReq = currentReqs.find((r: any) => r.id === id)
      if (existingReq) {
        const linkedCount = staffList.filter((s: any) => s.positionId === id && s.isActive === true).length
        if (linkedCount > 0 && (roleId !== existingReq.roleId || departmentId !== existingReq.departmentId)) {
          return { error: `Cannot change role/department — ${linkedCount} staff member(s) are currently assigned to this position. Unassign them first.` }
        }
      }
    }

    const success = await withTransaction<any>(DB_FILES.STAFF_REQUIREMENTS, (reqs) => {
      // Issue 21: Duplicate check for edits
      if (id) {
        const duplicateExists = reqs.some((r: any) => 
          r.id !== id && 
          r.branchId === enforcedBranchId && 
          r.departmentId === departmentId && 
          r.roleId === roleId && 
          r.specialtyId === specialtyId
        )
        if (duplicateExists) throw new Error('DUPLICATE_REQUIREMENT')
      }

      const existingIndex = reqs.findIndex((r: any) => 
        (id && r.id === id) || 
        (!id && r.branchId === enforcedBranchId && r.departmentId === departmentId && r.roleId === roleId && r.specialtyId === specialtyId)
      )

      if (existingIndex >= 0) {
        reqs[existingIndex].branchId = enforcedBranchId
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
          id: `req_${randomUUID()}`,
          branchId: enforcedBranchId,
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

    // Warn if requiredCount was reduced below currently filled count
    if (id) {
      const staffList = await readJSON<any>(DB_FILES.STAFF)
      const currentlyFilled = staffList.filter((s: any) => s.positionId === id && s.isActive === true).length
      if (requiredCount < currentlyFilled) {
        return { success: true, warning: `${currentlyFilled - requiredCount} staff member(s) exceed the new headcount. Please reassign them.` }
      }
    }

    return { success: true }
  } catch (error: any) {
    if (error.message === 'DUPLICATE_REQUIREMENT') {
      return { error: 'A position with this Role, Department, and Branch already exists.' }
    }
    console.error('Error saving requirement:', error)
    return { error: 'Failed to save requirement' }
  }
}

export async function deleteRequirement(id: string) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }

  try {
    // Cascade: clear positionId and positionIndex from all staff assigned to this requirement
    await withTransaction<any>(DB_FILES.STAFF, (staffList) => {
      staffList.forEach((s: any) => {
        if (s.positionId === id) {
          s.positionId = undefined
          s.positionIndex = undefined
        }
      })
      return staffList
    })

    // Then delete the requirement itself
    const success = await withTransaction<any>(DB_FILES.STAFF_REQUIREMENTS, (reqs) => {
      return reqs.filter((r: any) => {
        if (r.id === id) {
          if (!session.isGlobalAdmin && r.branchId !== session.branchId) return true; // Keep it
          return false; // Delete it
        }
        return true;
      })
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

function parseTime(t: string) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export async function updateRequirementSchedules(id: string, schedules: PositionSchedule[]) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }

  try {
    for (const schedule of schedules) {
      if (schedule.shifts.length > 3) {
        return { error: 'Validation Error: Maximum 3 shifts allowed per position' };
      }
      
      let totalMinutes = 0;
      const sortedShifts = [...schedule.shifts].sort((a, b) => parseTime(a.start) - parseTime(b.start));
      
      for (let i = 0; i < sortedShifts.length; i++) {
        const shift = sortedShifts[i];
        const startMins = parseTime(shift.start);
        const endMins = parseTime(shift.end);
        
        if (startMins < 5 * 60) return { error: 'Validation Error: Shift cannot start before 05:00' };
        if (endMins > 23 * 60) return { error: 'Validation Error: Shift cannot end after 23:00' };
        
        totalMinutes += (endMins - startMins);
        
        if (i > 0) {
          const prevEndMins = parseTime(sortedShifts[i - 1].end);
          const gap = startMins - prevEndMins;
          if (gap < 60) return { error: 'Validation Error: Minimum 1 hour break required between shifts' };
        }
      }
      
      if (totalMinutes > 10 * 60) {
        return { error: `Validation Error: Total shift hours cannot exceed 10 hours.` };
      }
    }

    const success = await withTransaction<any>(DB_FILES.STAFF_REQUIREMENTS, (reqs) => {
      const index = reqs.findIndex((r: any) => r.id === id)
      if (index >= 0) {
        if (!session.isGlobalAdmin && reqs[index].branchId !== session.branchId) return reqs; // Don't modify
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

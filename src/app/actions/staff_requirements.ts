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

function parseTime(t: string) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export async function updateRequirementSchedules(id: string, schedules: PositionSchedule[]) {
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
      
      if (totalMinutes !== 10 * 60) {
        return { error: `Validation Error: Total shift hours must be exactly 10 hours.` };
      }
    }

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

'use server'

import { db, staffRequirements, staff } from '@/lib/db'
import { eq, and, ne, isNull } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { randomUUID } from 'crypto'
import { getSession, requireBranchAccess } from './auth'
import { z } from 'zod'

export async function saveRequirement(
  id: string | null,
  branchId: string,
  departmentId: string,
  roleId: string,
  requiredCount: number,
  specialtyId?: string,
  defaultSalary?: number,
  startTime?: string,
  endTime?: string,
  responsibility?: string
) {
  const parsed = z.string().max(500, 'Responsibility text cannot exceed 500 characters').safeParse(responsibility || '')
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  try {
    const enforcedBranchId = await requireBranchAccess(branchId)

    // Block role/department changes when staff are assigned
    if (id) {
      const existingReqs = await db
        .select()
        .from(staffRequirements)
        .where(eq(staffRequirements.id, id))
        .limit(1)

      if (existingReqs.length > 0) {
        const existingReq = existingReqs[0]
        if (roleId !== existingReq.roleId || departmentId !== existingReq.departmentId) {
          const linkedStaff = await db
            .select({ id: staff.id })
            .from(staff)
            .where(
              and(
                eq(staff.positionId, id),
                eq(staff.isActive, true),
                isNull(staff.deletedAt)
              )
            )

          if (linkedStaff.length > 0) {
            return {
              error: `Cannot change role/department — ${linkedStaff.length} staff member(s) are currently assigned to this position. Unassign them first.`,
            }
          }
        }
      }
    }

    // Duplicate check for edits & creations
    const dupConditions = [
      eq(staffRequirements.branchId, enforcedBranchId),
      eq(staffRequirements.departmentId, departmentId),
      eq(staffRequirements.roleId, roleId),
      eq(staffRequirements.isActive, true),
    ]

    if (id) {
      dupConditions.push(ne(staffRequirements.id, id))
    }

    if (specialtyId) {
      dupConditions.push(eq(staffRequirements.specialtyId, specialtyId))
    } else {
      dupConditions.push(isNull(staffRequirements.specialtyId))
    }

    const duplicate = await db
      .select({ id: staffRequirements.id })
      .from(staffRequirements)
      .where(and(...dupConditions))
      .limit(1)

    if (duplicate.length > 0) {
      return { error: 'A position with this Role, Department, and Branch already exists.' }
    }

    if (id) {
      await db
        .update(staffRequirements)
        .set({
          branchId: enforcedBranchId,
          departmentId,
          roleId,
          requiredCount,
          specialtyId: specialtyId || null,
          defaultSalary: defaultSalary || null,
          startTime: startTime || null,
          endTime: endTime || null,
          responsibility: responsibility || null,
        })
        .where(eq(staffRequirements.id, id))
    } else {
      await db.insert(staffRequirements).values({
        id: randomUUID(),
        branchId: enforcedBranchId,
        departmentId,
        roleId,
        specialtyId: specialtyId || null,
        requiredCount,
        defaultSalary: defaultSalary || null,
        startTime: startTime || null,
        endTime: endTime || null,
        responsibility: responsibility || null,
        isActive: true,
      })
    }

    revalidatePath('/management/staff')

    // Warn if requiredCount was reduced below currently filled count
    if (id) {
      const linkedStaff = await db
        .select({ id: staff.id })
        .from(staff)
        .where(
          and(
            eq(staff.positionId, id),
            eq(staff.isActive, true),
            isNull(staff.deletedAt)
          )
        )

      if (requiredCount < linkedStaff.length) {
        return {
          success: true,
          warning: `${linkedStaff.length - requiredCount} staff member(s) exceed the new headcount. Please reassign them.`,
        }
      }
    }

    return { success: true }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('Error saving requirement:', error)
    return { error: 'Failed to save requirement' }
  }
}

export async function deleteRequirement(id: string) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }

  try {
    if (!session.isGlobalAdmin) {
      const existing = await db
        .select({ branchId: staffRequirements.branchId })
        .from(staffRequirements)
        .where(eq(staffRequirements.id, id))
        .limit(1)

      if (existing.length === 0 || existing[0].branchId !== session.branchId) {
        return { success: true }
      }
    }

    // Cascade: clear positionId and positionIndex from all staff assigned to this requirement
    await db
      .update(staff)
      .set({ positionId: null, positionIndex: null })
      .where(eq(staff.positionId, id))

    // Hard-delete the requirement itself (Req 4.8)
    await db
      .delete(staffRequirements)
      .where(eq(staffRequirements.id, id))

    revalidatePath('/management/staff')
    return { success: true }
  } catch (error) {
    console.error('Error deleting requirement:', error)
    return { error: 'Failed to delete requirement' }
  }
}

export type Shift = {
  id: string
  start: string // "06:00"
  end: string   // "10:00"
}

export type PositionSchedule = {
  positionIndex: number
  shifts: Shift[]
}

function parseTime(t: string) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export async function updateRequirementSchedules(id: string, schedules: PositionSchedule[]) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }

  try {
    for (const schedule of schedules) {
      if (schedule.shifts.length > 3) {
        return { error: 'Validation Error: Maximum 3 shifts allowed per position' }
      }

      let totalMinutes = 0
      const sortedShifts = [...schedule.shifts].sort((a, b) => parseTime(a.start) - parseTime(b.start))

      for (let i = 0; i < sortedShifts.length; i++) {
        const shift = sortedShifts[i]
        const startMins = parseTime(shift.start)
        const endMins = parseTime(shift.end)

        if (startMins < 5 * 60) return { error: 'Validation Error: Shift cannot start before 05:00' }
        if (endMins > 23 * 60) return { error: 'Validation Error: Shift cannot end after 23:00' }

        totalMinutes += endMins - startMins

        if (i > 0) {
          const prevEndMins = parseTime(sortedShifts[i - 1].end)
          const gap = startMins - prevEndMins
          if (gap < 60) return { error: 'Validation Error: Minimum 1 hour break required between shifts' }
        }
      }

      if (totalMinutes > 10 * 60) {
        return { error: 'Validation Error: Total shift hours cannot exceed 10 hours.' }
      }
    }

    if (!session.isGlobalAdmin) {
      const existing = await db
        .select({ branchId: staffRequirements.branchId })
        .from(staffRequirements)
        .where(eq(staffRequirements.id, id))
        .limit(1)

      if (existing.length === 0 || existing[0].branchId !== session.branchId) {
        return { success: true }
      }
    }

    await db
      .update(staffRequirements)
      .set({ schedules })
      .where(eq(staffRequirements.id, id))

    revalidatePath('/management/staff')
    return { success: true }
  } catch (error) {
    console.error('Error updating schedules:', error)
    return { error: 'Failed to update schedules' }
  }
}

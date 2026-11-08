'use server'

import { db, staff } from '@/lib/db'
import { eq, and, ilike, ne, isNull } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { randomUUID } from 'crypto'
import { getSession, requireBranchAccess } from '@/app/actions/auth'
import { logAction } from '@/lib/audit'
import { z } from 'zod'

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/

const addStaffSchema = z.object({
  name:         z.string().min(1, 'Name is required').max(100, 'Name too long').trim(),
  phone:        z.string().min(7, 'Phone too short').max(15, 'Phone too long').regex(/^[0-9+\-\s()]+$/, 'Invalid phone'),
  departmentId: z.string().min(1, 'Department is required'),
  roleId:       z.string().min(1, 'Role is required'),
  branchId:     z.string().min(1, 'Branch is required'),
  salary:       z.number().int('Salary must be a whole number').min(0, 'Salary cannot be negative'),
  label:        z.string().max(50).optional(),
  shiftType:    z.enum(['morning', 'evening', 'full']).optional(),
  startTime:    z.string().regex(timeRegex, 'Invalid start time (HH:MM)').optional().or(z.literal('')),
  endTime:      z.string().regex(timeRegex, 'Invalid end time (HH:MM)').optional().or(z.literal('')),
})

export type Staff = {
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function addStaff(prevState: any, formData: FormData) {
  const name = formData.get('name') as string
  const phone = formData.get('phone') as string
  let branchId = formData.get('branchId') as string
  const departmentId = formData.get('departmentId') as string
  const roleId = formData.get('roleId') as string
  const label = formData.get('label') as string
  const salary = Number(formData.get('salary')) || 0
  const joinedAt = formData.get('joinedAt') as string
  const shiftType = (formData.get('shiftType') as 'morning' | 'evening' | 'full') || 'full'
  const specialtyId = (formData.get('specialtyId') as string) || undefined
  const positionId = (formData.get('positionId') as string) || undefined
  const startTime = (formData.get('startTime') as string) || undefined
  const endTime = (formData.get('endTime') as string) || undefined

  const validation = addStaffSchema.safeParse({
    name, phone, departmentId, roleId,
    branchId: formData.get('branchId') as string,
    salary: Number(formData.get('salary')) || 0,
    label: label || undefined,
    shiftType: shiftType || undefined,
    startTime: startTime || undefined,
    endTime: endTime || undefined,
  })
  if (!validation.success) {
    return { error: validation.error.issues[0].message }
  }

  try {
    branchId = await requireBranchAccess(branchId)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    return { error: err.message }
  }

  if (!name || !phone || !branchId || !departmentId || !roleId) {
    return { error: 'All fields are required' }
  }

  try {
    const existing = await db
      .select({ id: staff.id })
      .from(staff)
      .where(
        and(
          ilike(staff.name, name),
          eq(staff.phone, phone),
          eq(staff.branchId, branchId),
          eq(staff.isActive, true),
          isNull(staff.deletedAt)
        )
      )
      .limit(1)

    if (existing.length > 0) {
      return { error: 'A staff member with this name and phone number already exists in this branch' }
    }

    let positionIndex: number | undefined = undefined
    if (positionId) {
      const existingIndices = (
        await db
          .select({ positionIndex: staff.positionIndex })
          .from(staff)
          .where(
            and(
              eq(staff.positionId, positionId),
              eq(staff.isActive, true),
              isNull(staff.deletedAt)
            )
          )
      )
        .map(s => s.positionIndex)
        .filter((idx): idx is number => idx !== null && idx !== undefined)

      let newIndex = 0
      while (existingIndices.includes(newIndex)) {
        newIndex++
      }
      positionIndex = newIndex
    }

    const newStaffId = randomUUID()
    await db.insert(staff).values({
      id: newStaffId,
      name,
      phone,
      branchId,
      departmentId,
      roleId,
      label: label || undefined,
      monthlySalary: salary,
      isActive: true,
      joinedAt: joinedAt || new Date().toISOString().split('T')[0],
      shiftType,
      specialtyId,
      positionId,
      positionIndex,
      startTime,
      endTime,
    })

    await logAction('CREATE_STAFF', 'Staff', JSON.stringify({ name, roleId }), newStaffId)

    revalidatePath('/management', 'layout')
    return { success: true }
  } catch (error) {
    console.error('Failed to add staff:', error)
    return { error: 'Failed to save data' }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  const specialtyId = (formData.get('specialtyId') as string) || undefined
  const positionId = (formData.get('positionId') as string) || undefined
  const startTime = (formData.get('startTime') as string) || undefined
  const endTime = (formData.get('endTime') as string) || undefined

  const validation = addStaffSchema.safeParse({
    name, phone, departmentId, roleId,
    branchId: formData.get('branchId') as string,
    salary: Number(formData.get('salary')) || 0,
    label: label || undefined,
    shiftType: shiftType || undefined,
    startTime: startTime || undefined,
    endTime: endTime || undefined,
  })
  if (!validation.success) {
    return { error: validation.error.issues[0].message }
  }

  if (!id || !name) return { error: 'Invalid ID or Name' }

  try {
    branchId = await requireBranchAccess(branchId)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    return { error: err.message }
  }

  try {
    const target = await db
      .select()
      .from(staff)
      .where(and(eq(staff.id, id), isNull(staff.deletedAt)))
      .limit(1)

    if (target.length === 0) {
      return { error: 'Staff not found' }
    }

    const currentStaff = target[0]
    if (currentStaff.branchId !== branchId) {
      return { error: 'Forbidden: Cannot edit staff from another branch' }
    }

    const duplicate = await db
      .select({ id: staff.id })
      .from(staff)
      .where(
        and(
          ilike(staff.name, name),
          eq(staff.phone, phone),
          eq(staff.branchId, branchId),
          eq(staff.isActive, true),
          isNull(staff.deletedAt),
          ne(staff.id, id)
        )
      )
      .limit(1)

    if (duplicate.length > 0) {
      return { error: 'A staff member with this name and phone number already exists in this branch' }
    }

    let newPositionIndex: number | null | undefined = currentStaff.positionIndex
    if (positionId && currentStaff.positionId !== positionId) {
      const existingIndices = (
        await db
          .select({ positionIndex: staff.positionIndex })
          .from(staff)
          .where(
            and(
              eq(staff.positionId, positionId),
              eq(staff.isActive, true),
              isNull(staff.deletedAt),
              ne(staff.id, id)
            )
          )
      )
        .map(s => s.positionIndex)
        .filter((idx): idx is number => idx !== null && idx !== undefined)

      let newIdx = 0
      while (existingIndices.includes(newIdx)) {
        newIdx++
      }
      newPositionIndex = newIdx
    } else if (!positionId) {
      newPositionIndex = null
    }

    await db
      .update(staff)
      .set({
        name,
        phone,
        branchId,
        departmentId,
        roleId,
        label: label || null,
        monthlySalary: salary,
        isActive: status === 'active',
        joinedAt: joinedAt || currentStaff.joinedAt,
        exitDate: exitDate || null,
        shiftType: shiftType || currentStaff.shiftType,
        specialtyId: specialtyId || null,
        positionId: positionId || null,
        positionIndex: newPositionIndex,
        startTime: startTime || null,
        endTime: endTime || null,
      })
      .where(eq(staff.id, id))

    revalidatePath('/management', 'layout')
    return { success: true }
  } catch (error) {
    console.error('Failed to update staff:', error)
    return { error: 'Transaction failed' }
  }
}

export async function toggleStaffStatus(id: string, currentlyActive: boolean) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }

  try {
    const target = await db
      .select()
      .from(staff)
      .where(and(eq(staff.id, id), isNull(staff.deletedAt)))
      .limit(1)

    if (target.length === 0) return { error: 'Staff not found' }

    if (!session.isGlobalAdmin && target[0].branchId !== session.branchId) {
      return { error: 'Forbidden: Cannot edit staff from another branch' }
    }

    await db
      .update(staff)
      .set({
        isActive: !currentlyActive,
        ...(currentlyActive ? { positionId: null, positionIndex: null } : {}),
      })
      .where(eq(staff.id, id))

    revalidatePath('/management', 'layout')
    return { success: true }
  } catch (error) {
    console.error('Failed to toggle staff status:', error)
    return { error: 'Transaction failed' }
  }
}

export async function deleteStaff(id: string) {
  const session = await getSession()
  if (!session?.isGlobalAdmin) {
    return { error: 'Forbidden: Only owners can delete staff' }
  }

  try {
    const target = await db
      .select({ id: staff.id })
      .from(staff)
      .where(and(eq(staff.id, id), isNull(staff.deletedAt)))
      .limit(1)

    if (target.length === 0) return { error: 'Staff not found' }

    await db
      .update(staff)
      .set({
        isActive: false,
        deletedAt: new Date(),
        positionId: null,
        positionIndex: null,
      })
      .where(eq(staff.id, id))

    await logAction('DELETE_STAFF', 'Staff', 'Deleted staff member', id)

    revalidatePath('/management', 'layout')
    return { success: true }
  } catch (error) {
    console.error('Failed to delete staff:', error)
    return { error: 'Transaction failed' }
  }
}

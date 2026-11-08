'use server'

import { db, attendance, withDbTransaction } from '@/lib/db'
import { eq, and } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { getSession, requireBranchAccess } from '@/app/actions/auth'
import { logAction } from '@/lib/audit'

export type AttendanceStatus = 'present' | 'absent' | 'half-day' | 'holiday' | 'unmarked'

export interface AttendanceLog {
  id: string
  date: string
  staffId: string
  branchId: string
  status: AttendanceStatus
  shiftsWorked?: string[]
  updatedAt: string
}

export async function getAttendanceByDate(date: string, branchId?: string) {
  try {
    const conditions = [eq(attendance.date, date)]
    if (branchId) {
      conditions.push(eq(attendance.branchId, branchId))
    }
    const rows = await db
      .select()
      .from(attendance)
      .where(and(...conditions))

    return rows.map((l) => ({
      id: l.id,
      date: l.date,
      staffId: l.staffId,
      branchId: l.branchId,
      status: l.status as AttendanceStatus,
      shiftsWorked: (l.shiftsWorked as string[]) || undefined,
      updatedAt: l.updatedAt instanceof Date ? l.updatedAt.toISOString() : String(l.updatedAt),
    }))
  } catch (error) {
    console.error('Failed to get attendance by date:', error)
    return []
  }
}

export async function saveAttendance(newLogs: Partial<AttendanceLog>[]) {
  const session = await getSession()

  const now = new Date()
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })

  if (newLogs.length > 0) {
    try {
      const enforcedBranch = await requireBranchAccess(newLogs[0].branchId)
      newLogs.forEach((l) => (l.branchId = enforcedBranch))
    } catch {
      return { error: 'Forbidden: Branch access denied.' }
    }
  }

  // Pre-write date validations (Requirement 4.4, 4.5)
  for (const newLog of newLogs) {
    if (!newLog.date || !newLog.staffId) continue

    if (newLog.date > todayStr) {
      return { error: 'Cannot mark attendance for future dates' }
    }

    // Time-lock validation: 7-day limit for non-global-admin
    const diffTime = Math.abs(now.getTime() - new Date(newLog.date).getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    if (diffDays > 7 && !session?.isGlobalAdmin) {
      return { error: 'Cannot save attendance older than 7 days without Owner privileges.' }
    }
  }

  try {
    await withDbTransaction(async (tx) => {
      for (const newLog of newLogs) {
        if (!newLog.date || !newLog.staffId) continue

        const effectiveDate = new Date()
        await tx
          .insert(attendance)
          .values({
            id: newLog.id || randomUUID(),
            date: newLog.date,
            staffId: newLog.staffId,
            branchId: newLog.branchId || '',
            status: newLog.status || 'present',
            shiftsWorked: newLog.shiftsWorked || [],
            createdAt: effectiveDate,
            updatedAt: effectiveDate,
          })
          .onConflictDoUpdate({
            target: [attendance.date, attendance.staffId],
            set: {
              status: newLog.status || 'present',
              shiftsWorked: newLog.shiftsWorked || [],
              updatedAt: effectiveDate,
            },
          })
      }
    })

    await logAction(
      'UPDATE_ATTENDANCE',
      'ATTENDANCE',
      `Updated attendance for ${newLogs.length} staff members. Dates: ${[...new Set(newLogs.map((n) => n.date))].join(',')}`
    )

    revalidatePath('/management/attendance')
    revalidatePath('/')
    return { success: true }
  } catch (error) {
    console.error('Failed to save attendance:', error)
    return { error: 'Transaction failed' }
  }
}

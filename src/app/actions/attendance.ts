"use server"

import { withTransaction, readJSON, DB_FILES } from '@/lib/db'
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
  const logs = await readJSON<AttendanceLog>(DB_FILES.ATTENDANCE)
  return logs.filter(l => l.date === date && (!branchId || l.branchId === branchId))
}

export async function saveAttendance(newLogs: Partial<AttendanceLog>[]) {
  const session = await getSession()
  const userRole = session?.role || ''
  
  const now = new Date().toISOString()
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  
  if (newLogs.length > 0) {
    try {
      const enforcedBranch = await requireBranchAccess(newLogs[0].branchId);
      newLogs.forEach(l => l.branchId = enforcedBranch);
    } catch (e) {
      return { error: 'Forbidden: Branch access denied.' }
    }
  }
  
  let timeLockError = false;
  let futureDateError = false;

  const success = await withTransaction<AttendanceLog>(DB_FILES.ATTENDANCE, (allLogs) => {
    for (const newLog of newLogs) {
      if (!newLog.date || !newLog.staffId) continue

      if (newLog.date > todayStr) {
        futureDateError = true;
        return allLogs; 
      }

      // Time-lock validation
      const diffTime = Math.abs(new Date(now).getTime() - new Date(newLog.date).getTime())
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      if (diffDays > 7 && userRole !== 'admin' && userRole !== 'owner') {
          timeLockError = true;
          return allLogs;
      }
      
      const existingIndex = allLogs.findIndex(l => l.date === newLog.date && l.staffId === newLog.staffId)
      
      if (existingIndex >= 0) {
        allLogs[existingIndex] = {
          ...allLogs[existingIndex],
          ...newLog,
          updatedAt: now
        } as AttendanceLog
      } else {
        allLogs.push({
          id: newLog.id || randomUUID(),
          date: newLog.date,
          staffId: newLog.staffId,
          branchId: newLog.branchId || '',
          status: newLog.status || 'present',
          shiftsWorked: newLog.shiftsWorked || [],
          updatedAt: now
        })
      }
    }
    return allLogs
  })

  if (futureDateError) {
     return { error: 'Cannot mark attendance for future dates' }
  }
  if (timeLockError) {
    return { error: 'Cannot save attendance older than 7 days without Admin privileges.' }
  }
  
  if (!success) return { error: 'Transaction failed' }
  
  await logAction('UPDATE_ATTENDANCE', 'ATTENDANCE', `Updated attendance for ${newLogs.length} staff members. Dates: ${[...new Set(newLogs.map(n => n.date))].join(',')}`);

  revalidatePath('/attendance')
  revalidatePath('/')
  return { success: true }
}

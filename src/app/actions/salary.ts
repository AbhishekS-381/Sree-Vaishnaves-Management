'use server'

import { withTransaction, readJSON, DB_FILES } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { randomUUID } from 'crypto'
import { getSession } from './auth'

type SalaryRecord = {
  id: string
  staffId: string
  branchId?: string
  name: string
  month: number
  year: number
  monthlySalary: number
  daysWorked: number
  advances: number
  payableAmount: number
  status: 'PENDING' | 'PAID'
  notes?: string
  paidAt?: string
}

export async function savePayroll(prevState: any, formData: FormData) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }

  const monthStr = formData.get('month') as string
  const yearStr = formData.get('year') as string

  if (!monthStr || !yearStr) {
    return { error: 'Invalid Date Selection' }
  }
  const month = Number(monthStr)
  const year = Number(yearStr)

  if (!Number.isInteger(month) || month < 1 || month > 12) return { error: 'Invalid month' };
  if (!Number.isInteger(year) || year < 2020 || year > 2100) return { error: 'Invalid year' };

  // Extract dynamic fields: staff_{id}_days, staff_{id}_notes
  const entries: SalaryRecord[] = []
  const rawData = Object.fromEntries(formData.entries())

  // We need current staff list to map IDs -> Names/Base Salary
  let staffList = await readJSON<any>(DB_FILES.STAFF)
  if (!session.isGlobalAdmin) {
    staffList = staffList.filter((s: any) => s.branchId === session.branchId)
  }

  for (const key in rawData) {
    if (key.startsWith('staff_') && key.endsWith('_days')) {
      const staffId = key.replace('staff_', '').replace('_days', '')
      const daysWorked = Number(rawData[key])
      const notes = rawData[`staff_${staffId}_notes`] as string

      const staffMember = staffList.find(s => s.id === staffId)
      if (!staffMember) continue

      const monthlySalary = staffMember.monthlySalary || 0
      const advances = Number(rawData[`staff_${staffId}_advances`]) || 0
      // Calc: (Salary / 30) * Days - advances
      const payableAmount = Math.max(0, Math.round((monthlySalary / 30) * daysWorked) - advances)

      const record: SalaryRecord = {
        id: `pay_${month}_${year}_${staffId}`,
        staffId,
        branchId: staffMember.branchId,
        name: staffMember.name,
        month,
        year,
        monthlySalary,
        daysWorked,
        advances,
        payableAmount,
        status: 'PENDING',
        notes: notes || ''
      }
      entries.push(record)
    }
  }

  const success = await withTransaction<SalaryRecord>(DB_FILES.PAYROLL, (payrollDB) => {
    // Remove old entries for this month/year to avoid duplicates
    const filtered = payrollDB.filter(p => !(p.month === month && p.year === year))
    filtered.push(...entries)
    return filtered
  })

  if (!success) return { error: 'Transaction failed' }
  revalidatePath('/payroll')
  return { success: true, message: 'Payroll saved successfully' }
}

export async function markAsPaid(id: string) {
  const session = await getSession()
  if (!session?.isGlobalAdmin) return { error: 'Forbidden: Only admin and owner can mark payroll as paid' }

  let notFound = false;
  const success = await withTransaction<SalaryRecord>(DB_FILES.PAYROLL, (payrollDB) => {
    const index = payrollDB.findIndex(p => p.id === id)
    if (index === -1) { notFound = true; return payrollDB }
    payrollDB[index].status = 'PAID'
    payrollDB[index].paidAt = new Date().toISOString()
    return payrollDB
  })

  if (notFound) return { error: 'Record not found' }
  if (!success) return { error: 'Transaction failed' }
  revalidatePath('/payroll')
  return { success: true }
}

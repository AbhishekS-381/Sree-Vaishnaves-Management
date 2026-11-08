'use server'

import { db, payroll, staff, withDbTransaction } from '@/lib/db'
import { eq, and, isNull } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { getSession } from './auth'

function generatePayrollId(month: number, year: number, staffId: string): string {
  const str = `payroll:${month}:${year}:${staffId}`
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57, h3 = 0x67452301, h4 = 0xefcdab89
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
    h3 = Math.imul(h3 ^ ch, 2246822507)
    h4 = Math.imul(h4 ^ ch, 3266489909)
  }
  const toHex = (n: number) => (n >>> 0).toString(16).padStart(8, '0')
  const hex = toHex(h1) + toHex(h2) + toHex(h3) + toHex(h4)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

export type SalaryRecord = {
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  if (!Number.isInteger(month) || month < 1 || month > 12) return { error: 'Invalid month' }
  if (!Number.isInteger(year) || year < 2020 || year > 2100) return { error: 'Invalid year' }

  // Extract dynamic fields: staff_{id}_days, staff_{id}_notes
  const entries: SalaryRecord[] = []
  const rawData = Object.fromEntries(formData.entries())

  try {
    // Current staff list to map IDs -> Names/Base Salary
    const staffConditions = [eq(staff.isActive, true), isNull(staff.deletedAt)]
    if (!session.isGlobalAdmin && session.branchId) {
      staffConditions.push(eq(staff.branchId, session.branchId))
    }

    const staffList = await db
      .select()
      .from(staff)
      .where(and(...staffConditions))

    for (const key in rawData) {
      if (key.startsWith('staff_') && key.endsWith('_days')) {
        const staffId = key.replace('staff_', '').replace('_days', '')
        const daysWorked = Number(rawData[key])
        const notes = rawData[`staff_${staffId}_notes`] as string

        const staffMember = staffList.find((s) => s.id === staffId)
        if (!staffMember) continue

        const monthlySalary = staffMember.monthlySalary || 0
        const advances = Number(rawData[`staff_${staffId}_advances`]) || 0
        // Calc: (Salary / 30) * Days - advances
        const payableAmount = Math.max(0, Math.round((monthlySalary / 30) * daysWorked) - advances)

        const record: SalaryRecord = {
          id: generatePayrollId(month, year, staffId),
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
          notes: notes || '',
        }
        entries.push(record)
      }
    }

    await withDbTransaction(async (tx) => {
      for (const entry of entries) {
        const now = new Date()
        await tx
          .insert(payroll)
          .values({
            id: entry.id,
            staffId: entry.staffId,
            branchId: entry.branchId,
            name: entry.name,
            month: entry.month,
            year: entry.year,
            monthlySalary: entry.monthlySalary,
            daysWorked: entry.daysWorked,
            advances: entry.advances,
            payableAmount: entry.payableAmount,
            status: 'PENDING',
            notes: entry.notes || '',
          })
          .onConflictDoUpdate({
            target: payroll.id,
            set: {
              name: entry.name,
              monthlySalary: entry.monthlySalary,
              daysWorked: entry.daysWorked,
              advances: entry.advances,
              payableAmount: entry.payableAmount,
              notes: entry.notes || '',
            },
          })
      }
    })

    revalidatePath('/management/payroll')
    return { success: true, message: 'Payroll saved successfully' }
  } catch (error) {
    console.error('Failed to save payroll:', error)
    return { error: 'Transaction failed' }
  }
}

export async function markAsPaid(id: string) {
  const session = await getSession()
  if (!session?.isGlobalAdmin) {
    return { error: 'Forbidden: Only admin and owner can mark payroll as paid' }
  }

  try {
    const target = await db
      .select({ id: payroll.id })
      .from(payroll)
      .where(eq(payroll.id, id))
      .limit(1)

    if (target.length === 0) {
      return { error: 'Record not found' }
    }

    await db
      .update(payroll)
      .set({
        status: 'PAID',
        paidAt: new Date(),
      })
      .where(eq(payroll.id, id))

    revalidatePath('/management/payroll')
    return { success: true }
  } catch (error) {
    console.error('Failed to mark payroll as paid:', error)
    return { error: 'Transaction failed' }
  }
}

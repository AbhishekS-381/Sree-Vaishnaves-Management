"use server"

import { withTransaction, readJSON, writeJSON, DB_FILES } from '@/lib/db'
import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'

export type Expense = {
  id: string
  branchId: string
  amount: number
  category: string
  source: 'eod' | 'vendor'
  date: string
  notes?: string
  createdAt: string
  isPaid?: boolean
}

export type EODIncome = {
  dineInCash: number
  dineInUpi: number
  takeawayCash: number
  takeawayUpi: number
}

export type EODEntry = {
  id: string
  branchId: string
  date: string
  income: EODIncome
  openingFloat?: number
  actualClosingFloat?: number
  notes: string
  status: 'draft' | 'locked'
  createdAt: string
  updatedAt: string
}

export async function saveEODEntry(
  entryData: Omit<EODEntry, 'id' | 'createdAt' | 'updatedAt' | 'status'>,
  expensesOut: Omit<Expense, 'id' | 'createdAt' | 'source'>[]
) {
  const now = new Date().toISOString()
  
  let isLocked = false;
  
  const success = await withTransaction<EODEntry>(DB_FILES.EOD, async (allEOD) => {
    const existingEODIndex = allEOD.findIndex(e => e.date === entryData.date && e.branchId === entryData.branchId)
    
    // If exists and locked, block
    if (existingEODIndex >= 0 && allEOD[existingEODIndex].status === 'locked') {
      isLocked = true;
      return allEOD;
    }

    if (existingEODIndex >= 0) {
      allEOD[existingEODIndex] = {
        ...allEOD[existingEODIndex],
        income: entryData.income,
        openingFloat: entryData.openingFloat,
        actualClosingFloat: entryData.actualClosingFloat,
        notes: entryData.notes,
        updatedAt: now
      }
    } else {
      allEOD.push({
        id: `eod_${randomUUID().split('-')[0]}`,
        branchId: entryData.branchId,
        date: entryData.date,
        income: entryData.income,
        openingFloat: entryData.openingFloat,
        actualClosingFloat: entryData.actualClosingFloat,
        notes: entryData.notes,
        status: 'draft',
        createdAt: now,
        updatedAt: now
      })
    }

    // Handle nested expense save
    const expSuccess = await withTransaction<Expense>(DB_FILES.EXPENSES, (allExpenses) => {
      const otherExpenses = allExpenses.filter(ex => !(ex.date === entryData.date && ex.branchId === entryData.branchId && ex.source === 'eod'))
      const newExpenses = expensesOut.map(ex => ({
        id: `exp_${randomUUID().split('-')[0]}`,
        branchId: ex.branchId,
        amount: ex.amount,
        category: ex.category,
        source: 'eod' as const,
        date: ex.date,
        notes: ex.notes || '',
        createdAt: now
      }))
      return [...otherExpenses, ...newExpenses]
    })

    if (!expSuccess) {
       // if it failed, returning original array. Though withTransaction might not cleanly rollback,
       // we log error.
       throw new Error("Failed to write expenses");
    }

    return allEOD;
  })

  if (isLocked) return { error: 'EOD for this date is already locked.' }
  if (!success) return { error: 'Transaction failed' }
  
  revalidatePath('/eod')
  revalidatePath('/expenses')
  revalidatePath('/')
  
  return { success: true }
}

export async function getEODByDate(date: string, branchId: string) {
  const allEOD = await readJSON<EODEntry>(DB_FILES.EOD)
  return allEOD.find(e => e.date === date && e.branchId === branchId) || null
}

export async function getExpensesByDate(date: string, branchId: string) {
  const allExpenses = await readJSON<Expense>(DB_FILES.EXPENSES)
  return allExpenses.filter(e => e.date === date && e.branchId === branchId)
}

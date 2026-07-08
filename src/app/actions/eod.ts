"use server"

import { withTransaction, readJSON, writeJSON, DB_FILES } from '@/lib/db'
import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { requireBranchAccess, getSession } from '@/app/actions/auth'
import { logAction } from '@/lib/audit'

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

import { z } from 'zod'

export async function saveEODEntry(
  entryData: Omit<EODEntry, 'id' | 'createdAt' | 'updatedAt' | 'status'>,
  expensesOut: Omit<Expense, 'id' | 'createdAt' | 'source'>[]
) {
  const incomeSchema = z.object({
    dineInCash: z.number().int().min(0),
    dineInUpi: z.number().int().min(0),
    takeawayCash: z.number().int().min(0),
    takeawayUpi: z.number().int().min(0),
  });
  const eodSchema = z.object({
    branchId: z.string().min(1),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    income: incomeSchema,
    notes: z.string().max(2000).optional(),
  });
  const parsed = eodSchema.safeParse(entryData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    entryData.branchId = await requireBranchAccess(entryData.branchId);
  } catch (err: any) {
    return { error: err.message };
  }
  
  const todayIST = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  if (entryData.date > todayIST) {
    return { error: 'EOD entry cannot be submitted for a future date' };
  }

  const now = new Date().toISOString()
  
  let isLocked = false;
  
  const success = await withTransaction<EODEntry>(DB_FILES.EOD, async (allEOD) => {
    const existingEODIndex = allEOD.findIndex(e => e.date === entryData.date && e.branchId === entryData.branchId)
    
    // If exists and locked (or > 24 hours old), block non-owners
    if (existingEODIndex >= 0) {
      const existing = allEOD[existingEODIndex];
      const isPast24Hours = (new Date().getTime() - new Date(existing.createdAt).getTime()) > 24 * 60 * 60 * 1000;
      
      const session = await getSession();
      if ((existing.status === 'locked' || isPast24Hours) && !session?.isGlobalOwner) {
        isLocked = true;
        return allEOD;
      }
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
    return allEOD;
  })

  if (isLocked) return { error: 'EOD for this date is already locked.' }
  if (!success) return { error: 'Transaction failed' }

  // Handle expense save separately to avoid nested transactions
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

  const session = await getSession();
  await logAction('SAVE_EOD', 'EOD', JSON.stringify({ income: entryData.income }), entryData.date);

  revalidatePath('/eod')
  revalidatePath('/expenses')
  revalidatePath('/')
  
  if (!expSuccess) {
    return { success: true, warning: 'EOD saved, but failed to write expenses.' }
  }
  
  return { success: true }
}

export async function getEODByDate(date: string, branchId: string) {
  const enforcedBranchId = await requireBranchAccess(branchId).catch(() => null);
  if (!enforcedBranchId) return null;
  const allEOD = await readJSON<EODEntry>(DB_FILES.EOD)
  return allEOD.find(e => e.date === date && e.branchId === enforcedBranchId) || null
}

export async function getExpensesByDate(date: string, branchId: string) {
  const enforcedBranchId = await requireBranchAccess(branchId).catch(() => null);
  if (!enforcedBranchId) return [];
  const allExpenses = await readJSON<Expense>(DB_FILES.EXPENSES)
  return allExpenses.filter(e => e.date === date && e.branchId === enforcedBranchId)
}

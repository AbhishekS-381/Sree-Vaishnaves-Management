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
  categoryId: string
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
  status: 'draft' | 'submitted' | 'locked'
  createdAt: string
  updatedAt: string
  billing?: {
    totalBillAmount: number
    billCount: number
    dineInCovers: number
    takeawayOrders: number
    cashCollectedAsBilled: number
    upiCollectedAsBilled: number
    voids: number
    discounts: number
    gstCollected: number
  }
  ops?: {
    staffOnDuty: number
    powerCutHours: number
    unusualEvent: string
    kitchenIssue: boolean
    zeroRevenueConfirmed: boolean
  }
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
  
  const billingSchema = z.object({
    totalBillAmount: z.number().int().min(0),
    billCount: z.number().int().min(0),
    dineInCovers: z.number().int().min(0),
    takeawayOrders: z.number().int().min(0),
    cashCollectedAsBilled: z.number().int().min(0),
    upiCollectedAsBilled: z.number().int().min(0),
    voids: z.number().int().min(0),
    discounts: z.number().int().min(0),
    gstCollected: z.number().int().min(0),
  }).optional()

  const opsSchema = z.object({
    staffOnDuty: z.number().int().min(0),
    powerCutHours: z.number().min(0).max(24),
    unusualEvent: z.string().max(100),
    kitchenIssue: z.boolean(),
    zeroRevenueConfirmed: z.boolean(),
  }).optional()

  const eodSchema = z.object({
    branchId: z.string().min(1),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    income: incomeSchema,
    notes: z.string().max(2000).optional(),
    billing: billingSchema,
    ops: opsSchema,
  });
  const parsed = eodSchema.safeParse(entryData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { income, ops } = parsed.data
  const totalIncome = income.dineInCash + income.dineInUpi + income.takeawayCash + income.takeawayUpi
  if (totalIncome === 0 && !ops?.zeroRevenueConfirmed) {
    return { error: 'ZERO_REVENUE_UNCONFIRMED' }
  }

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
      if ((existing.status === 'locked' || isPast24Hours) && !session?.isGlobalAdmin) {
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
        billing: entryData.billing ?? undefined,
        ops: entryData.ops ?? undefined,
        notes: entryData.notes,
        updatedAt: now
      }
    } else {
      allEOD.push({
        id: `eod_${randomUUID()}`,
        branchId: entryData.branchId,
        date: entryData.date,
        income: entryData.income,
        openingFloat: entryData.openingFloat,
        actualClosingFloat: entryData.actualClosingFloat,
        billing: entryData.billing ?? undefined,
        ops: entryData.ops ?? undefined,
        notes: entryData.notes,
        status: 'submitted',
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
      id: `exp_${randomUUID()}`,
      branchId: ex.branchId,
      amount: ex.amount,
      categoryId: (ex as any).categoryId,
      source: 'eod' as const,
      date: ex.date,
      notes: ex.notes || '',
      createdAt: now
    }))
    return [...otherExpenses, ...newExpenses]
  })

  const session = await getSession();
  await logAction('SAVE_EOD', 'EOD', JSON.stringify({ income: entryData.income }), entryData.date);

  revalidatePath('/management/eod')
  revalidatePath('/management/expenses')
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

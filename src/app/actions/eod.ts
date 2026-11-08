'use server'

import { db, eod, expenses, withDbTransaction } from '@/lib/db'
import { eq, and } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { requireBranchAccess, getSession } from '@/app/actions/auth'
import { logAction } from '@/lib/audit'
import { z } from 'zod'

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

export async function saveEODEntry(
  entryData: Omit<EODEntry, 'id' | 'createdAt' | 'updatedAt' | 'status'>,
  expensesOut: Omit<Expense, 'id' | 'createdAt' | 'source'>[]
): Promise<{ success?: boolean; error?: string; warning?: string }> {
  const incomeSchema = z.object({
    dineInCash: z.number().int().min(0),
    dineInUpi: z.number().int().min(0),
    takeawayCash: z.number().int().min(0),
    takeawayUpi: z.number().int().min(0),
  })

  const billingSchema = z
    .object({
      totalBillAmount: z.number().int().min(0),
      billCount: z.number().int().min(0),
      dineInCovers: z.number().int().min(0),
      takeawayOrders: z.number().int().min(0),
      cashCollectedAsBilled: z.number().int().min(0),
      upiCollectedAsBilled: z.number().int().min(0),
      voids: z.number().int().min(0),
      discounts: z.number().int().min(0),
      gstCollected: z.number().int().min(0),
    })
    .optional()

  const opsSchema = z
    .object({
      staffOnDuty: z.number().int().min(0),
      powerCutHours: z.number().min(0).max(24),
      unusualEvent: z.string().max(100),
      kitchenIssue: z.boolean(),
      zeroRevenueConfirmed: z.boolean(),
    })
    .optional()

  const eodSchema = z.object({
    branchId: z.string().min(1),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    income: incomeSchema,
    notes: z.string().max(2000).optional(),
    billing: billingSchema,
    ops: opsSchema,
  })

  const parsed = eodSchema.safeParse(entryData)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { income, ops } = parsed.data
  const totalIncome = income.dineInCash + income.dineInUpi + income.takeawayCash + income.takeawayUpi
  if (totalIncome === 0 && !ops?.zeroRevenueConfirmed) {
    return { error: 'ZERO_REVENUE_UNCONFIRMED' }
  }

  try {
    entryData.branchId = await requireBranchAccess(entryData.branchId)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    return { error: err.message }
  }

  const todayIST = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  if (entryData.date > todayIST) {
    return { error: 'EOD entry cannot be submitted for a future date' }
  }

  const session = await getSession()
  const now = new Date()

  try {
    // Lock check: check status='locked' OR createdAt > 24h + non-global-admin (Req 6.2, 6.3)
    const existing = await db
      .select()
      .from(eod)
      .where(and(eq(eod.branchId, entryData.branchId), eq(eod.date, entryData.date)))
      .limit(1)

    if (existing.length > 0) {
      const prev = existing[0]
      const isPast24Hours = now.getTime() - new Date(prev.createdAt).getTime() > 24 * 60 * 60 * 1000
      if ((prev.status === 'locked' || isPast24Hours) && !session?.isGlobalAdmin) {
        return { error: 'EOD for this date is already locked.' }
      }
    }

    // Atomic transaction wrapping: (1) EOD upsert, (2) delete old EOD expenses, (3) insert new expenses (Req 6.1)
    await withDbTransaction(async (tx) => {
      await tx
        .insert(eod)
        .values({
          id: existing[0]?.id || randomUUID(),
          branchId: entryData.branchId,
          date: entryData.date,
          income: entryData.income,
          openingFloat: entryData.openingFloat,
          actualClosingFloat: entryData.actualClosingFloat,
          billing: entryData.billing ?? null,
          ops: entryData.ops ?? null,
          notes: entryData.notes || '',
          status: 'submitted',
          createdAt: existing[0]?.createdAt || now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [eod.branchId, eod.date],
          set: {
            income: entryData.income,
            openingFloat: entryData.openingFloat,
            actualClosingFloat: entryData.actualClosingFloat,
            billing: entryData.billing ?? null,
            ops: entryData.ops ?? null,
            notes: entryData.notes || '',
            updatedAt: now,
          },
        })

      // Replace old EOD expenses atomically
      await tx
        .delete(expenses)
        .where(
          and(
            eq(expenses.branchId, entryData.branchId),
            eq(expenses.date, entryData.date),
            eq(expenses.source, 'eod')
          )
        )

      for (const ex of expensesOut) {
        await tx.insert(expenses).values({
          id: randomUUID(),
          branchId: ex.branchId,
          amount: ex.amount,
          categoryId: (ex as unknown as { categoryId: string }).categoryId,
          source: 'eod',
          date: ex.date,
          notes: ex.notes || '',
          createdAt: now,
        })
      }
    })

    await logAction('SAVE_EOD', 'EOD', JSON.stringify({ income: entryData.income }), entryData.date)

    revalidatePath('/management/eod')
    revalidatePath('/management/expenses')
    revalidatePath('/')

    return { success: true }
  } catch (error) {
    console.error('Failed to save EOD entry:', error)
    return { error: 'Transaction failed' }
  }
}

export async function getEODByDate(date: string, branchId: string) {
  const enforcedBranchId = await requireBranchAccess(branchId).catch(() => null)
  if (!enforcedBranchId) return null

  try {
    const rows = await db
      .select()
      .from(eod)
      .where(and(eq(eod.date, date), eq(eod.branchId, enforcedBranchId)))
      .limit(1)

    if (rows.length === 0) return null
    const row = rows[0]
    return {
      id: row.id,
      branchId: row.branchId,
      date: row.date,
      income: row.income as EODIncome,
      openingFloat: row.openingFloat ?? undefined,
      actualClosingFloat: row.actualClosingFloat ?? undefined,
      notes: row.notes || '',
      status: row.status as 'draft' | 'submitted' | 'locked',
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
      updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
      billing: (row.billing as EODEntry['billing']) ?? undefined,
      ops: (row.ops as EODEntry['ops']) ?? undefined,
    }
  } catch (error) {
    console.error('Failed to get EOD by date:', error)
    return null
  }
}

export async function getExpensesByDate(date: string, branchId: string) {
  const enforcedBranchId = await requireBranchAccess(branchId).catch(() => null)
  if (!enforcedBranchId) return []

  try {
    const rows = await db
      .select()
      .from(expenses)
      .where(and(eq(expenses.date, date), eq(expenses.branchId, enforcedBranchId)))

    return rows.map((r) => ({
      id: r.id,
      branchId: r.branchId,
      amount: r.amount,
      categoryId: r.categoryId,
      source: r.source as 'eod' | 'vendor',
      date: r.date,
      notes: r.notes || undefined,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
      isPaid: r.isPaid ?? undefined,
    }))
  } catch (error) {
    console.error('Failed to get expenses by date:', error)
    return []
  }
}

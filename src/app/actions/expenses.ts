'use server'

import { db, expenses } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { getSession } from '@/app/actions/auth'
import { logAction } from '@/lib/audit'
import type { Expense } from '@/app/actions/eod'
import { z } from 'zod'

const updateExpenseSchema = z.object({
  amount:     z.number().int('Amount must be a whole number').min(0, 'Amount cannot be negative').optional(),
  notes:      z.string().max(500, 'Notes too long').optional(),
  date:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date').optional(),
  categoryId: z.string().max(100).optional(),
  branchId:   z.string().optional(),
})

export async function updateExpense(id: string, updates: Partial<Expense>) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }

  // Only Admin and Owners can edit ledger expenses directly
  if (!session.isGlobalAdmin) {
    return { error: 'Only admin and owner can edit ledger expenses.' }
  }

  const parsed = updateExpenseSchema.safeParse(updates)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  try {
    const existing = await db
      .select()
      .from(expenses)
      .where(eq(expenses.id, id))
      .limit(1)

    if (existing.length === 0) return { error: 'Expense not found.' }

    const oldExp = existing[0]

    // Guard: Cannot change branchId of existing expense (Req 6.6)
    if (updates.branchId && updates.branchId !== oldExp.branchId) {
      return { error: 'Cannot change the branch of an existing expense.' }
    }

    const updatedAmount = updates.amount !== undefined ? updates.amount : oldExp.amount
    const updatedNotes = updates.notes !== undefined ? updates.notes : oldExp.notes
    const updatedDate = updates.date || oldExp.date
    const updatedCategoryId = updates.categoryId || oldExp.categoryId

    await db
      .update(expenses)
      .set({
        amount: updatedAmount,
        notes: updatedNotes,
        date: updatedDate,
        categoryId: updatedCategoryId,
      })
      .where(eq(expenses.id, id))

    await logAction(
      'UPDATE_EXPENSE',
      'EXPENSE',
      `Updated expense ${id}. From ${oldExp.amount} to ${updatedAmount}. Notes: ${updatedNotes}`,
      id
    )

    revalidatePath('/management/expenses')
    revalidatePath('/management/reports')
    return { success: true }
  } catch (error) {
    console.error('Failed to update expense:', error)
    return { error: 'Transaction failed' }
  }
}

export async function deleteExpense(id: string) {
  const session = await getSession()
  if (!session || !session.isGlobalAdmin) return { error: 'Unauthorized' }

  try {
    const existing = await db
      .select()
      .from(expenses)
      .where(eq(expenses.id, id))
      .limit(1)

    if (existing.length === 0) return { error: 'Not found' }

    const exp = existing[0]

    await db
      .delete(expenses)
      .where(eq(expenses.id, id))

    await logAction('DELETE_EXPENSE', 'EXPENSE', `Deleted expense ${id} of amount ${exp.amount}`, id)

    revalidatePath('/management/expenses')
    revalidatePath('/management/reports')
    return { success: true }
  } catch (error) {
    console.error('Failed to delete expense:', error)
    return { error: 'Failed to delete' }
  }
}

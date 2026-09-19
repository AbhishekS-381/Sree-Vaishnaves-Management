"use server"

import { withTransaction, DB_FILES } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { getSession } from '@/app/actions/auth'
import { logAction } from '@/lib/audit'
import type { Expense } from '@/app/actions/eod'
import { z } from 'zod'

const updateExpenseSchema = z.object({
  amount:   z.number().int('Amount must be a whole number').min(0, 'Amount cannot be negative').optional(),
  notes:    z.string().max(500, 'Notes too long').optional(),
  date:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date').optional(),
  category: z.string().max(100).optional(),
})

export async function updateExpense(id: string, updates: Partial<Expense>) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }

  // Only Admin and Owners can edit older ledger expenses directly
  if (!session.isGlobalAdmin) {
    return { error: 'Only admin and owner can edit ledger expenses.' }
  }

  const parsed = updateExpenseSchema.safeParse(updates)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  let oldData: Expense | null = null;
  let newData: Expense | null = null;
  
  const success = await withTransaction<Expense>(DB_FILES.EXPENSES, (allExpenses) => {
    const index = allExpenses.findIndex(e => e.id === id)
    if (index === -1) return allExpenses;

    oldData = { ...allExpenses[index] }
    
    allExpenses[index] = {
      ...allExpenses[index],
      ...updates,
      id: allExpenses[index].id,
      branchId: allExpenses[index].branchId, // Do not allow changing branchId
    }
    
    newData = allExpenses[index]
    return allExpenses
  })

  if (!oldData || !newData) return { error: 'Expense not found.' }
  if (!success) return { error: 'Transaction failed' }
  
  const oldExp = oldData as Expense
  const newExp = newData as Expense

  await logAction(
    'UPDATE_EXPENSE', 
    'EXPENSE', 
    `Updated expense ${id}. From ${oldExp.amount} to ${newExp.amount}. Notes: ${newExp.notes}`,
    id
  )

  revalidatePath('/expenses')
  revalidatePath('/reports')
  return { success: true }
}

export async function deleteExpense(id: string) {
  const session = await getSession()
  if (!session || !session.isGlobalAdmin) return { error: 'Unauthorized' }
  let deleted: Expense | null = null;
  const success = await withTransaction<Expense>(DB_FILES.EXPENSES, (allExpenses) => {
    const index = allExpenses.findIndex(e => e.id === id)
    if (index === -1) return allExpenses;
    deleted = allExpenses.splice(index, 1)[0];
    return allExpenses;
  })
  if (!deleted) return { error: 'Not found' }
  if (!success) return { error: 'Failed to delete' }
  const exp = deleted as unknown as Expense;
  await logAction('DELETE_EXPENSE', 'EXPENSE', `Deleted expense ${id} of amount ${exp.amount}`, id)
  revalidatePath('/expenses')
  revalidatePath('/reports')
  return { success: true }
}

"use server"

import { withTransaction, DB_FILES } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { getSession } from '@/app/actions/auth'
import { logAction } from '@/lib/audit'
import type { Expense } from '@/app/actions/eod'

export async function updateExpense(id: string, updates: Partial<Expense>) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }

  // Only Owners can edit older ledger expenses directly
  if (session.role !== 'owner') {
    return { error: 'Only owners can edit ledger expenses.' }
  }

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

"use server"

import { withTransaction, DB_FILES } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { getSession } from '@/app/actions/auth'
import { logAction } from '@/lib/audit'
import type { Expense } from '@/app/actions/eod'

export async function updateExpense(id: string, updates: Partial<Expense>) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }

  // Only Admins or SuperAdmins can edit older ledger expenses directly
  if (session.role !== 'admin' && session.role !== 'owner') {
    return { error: 'Only administrators can edit ledger expenses.' }
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

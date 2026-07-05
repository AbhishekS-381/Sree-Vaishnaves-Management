'use server'

import { withTransaction, readJSON, writeJSON, DB_FILES } from '@/lib/db'
import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { Expense } from './eod'

export type ExpenseCategory = {
  id: string
  name: string
  color?: string
}

export async function addCategory(prevState: any, formData: FormData) {
  const name = formData.get('name')?.toString()
  const color = formData.get('color')?.toString() || '#64748b' // default slate
  
  if (!name) return { error: 'Name is required' }

  let alreadyExists = false;
  const success = await withTransaction<ExpenseCategory>(DB_FILES.CATEGORIES, (cats) => {
    if (cats.some(c => c.name.toLowerCase() === name.toLowerCase())) {
      alreadyExists = true;
      return cats;
    }
    cats.push({ id: randomUUID(), name, color })
    return cats;
  })

  if (alreadyExists) return { error: 'Category already exists' }
  if (!success) return { error: 'Transaction failed' }

  revalidatePath('/settings')
  return { success: true }
}

export async function updateCategory(prevState: any, formData: FormData) {
  const id = formData.get('id')?.toString()
  const name = formData.get('name')?.toString()
  const color = formData.get('color')?.toString()

  if (!id || !name) return { error: 'Missing required fields' }

  let notFound = false;
  let oldName = '';
  const success = await withTransaction<ExpenseCategory>(DB_FILES.CATEGORIES, (cats) => {
    const idx = cats.findIndex(c => c.id === id)
    if (idx === -1) {
      notFound = true;
      return cats;
    }
    oldName = cats[idx].name
    cats[idx] = { ...cats[idx], name, color }
    return cats;
  })

  if (notFound) return { error: 'Category not found' }
  if (!success) return { error: 'Transaction failed' }

  if (oldName && oldName !== name) {
     const expenses = await readJSON<Expense>(DB_FILES.EXPENSES).catch(() => []);
     let updated = false;
     expenses.forEach(ex => {
        if (ex.category === oldName) {
           ex.category = name;
           updated = true;
        }
     });
     if (updated) {
        await writeJSON(DB_FILES.EXPENSES, expenses);
     }
  }

  revalidatePath('/settings')
  revalidatePath('/eod')
  revalidatePath('/vendors')
  revalidatePath('/expenses')
  revalidatePath('/reports')
  return { success: true }
}

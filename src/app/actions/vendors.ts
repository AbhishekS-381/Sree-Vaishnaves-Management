'use server'

import { withTransaction, DB_FILES } from '@/lib/db'
import { Expense } from './eod'
import { revalidatePath } from 'next/cache'
import { randomUUID } from 'crypto'
import { getSession, requireBranchAccess } from './auth'

export type Vendor = {
  id: string
  branchId: string
  name: string
  phone: string
  supplyType: string
  createdAt: string
}

export async function addVendor(prevState: any, formData: FormData) {
  const name = formData.get('name') as string
  const phone = formData.get('phone') as string
  const supplyType = formData.get('supplyType') as string
  let branchId = formData.get('branchId') as string

  if (!name || !phone || !supplyType || !branchId) {
    return { error: 'Invalid input fields' }
  }

  try {
    branchId = await requireBranchAccess(branchId)
  } catch (e) {
    return { error: 'Forbidden' }
  }

  const success = await withTransaction<Vendor>(DB_FILES.VENDORS, (vendors) => {
    vendors.push({
      id: `ven_${randomUUID().split('-')[0]}`,
      branchId,
      name,
      phone,
      supplyType,
      createdAt: new Date().toISOString()
    })
    return vendors
  })

  if (!success) return { error: 'Transaction failed' }
  revalidatePath('/vendors')
  return { success: true }
}

export async function addVendorBill(prevState: any, formData: FormData) {
  const vendorId = formData.get('vendorId') as string
  const vendorName = formData.get('vendorName') as string
  const amount = Number(formData.get('amount'))
  const category = formData.get('category') as string
  const date = formData.get('date') as string
  const invoiceRef = formData.get('invoiceRef') as string
  let branchId = formData.get('branchId') as string
  const isPaid = formData.get('isPaid') === 'on'

  if (!vendorId || !amount || !category || !date || !branchId) {
     return { error: 'Please fill all required bill fields' }
  }
  
  if (!Number.isInteger(amount) || amount <= 0) return { error: 'Amount must be a positive whole number' };

  try {
    branchId = await requireBranchAccess(branchId)
  } catch (e) {
    return { error: 'Forbidden' }
  }

  const notes = invoiceRef 
    ? `Vendor: ${vendorName} | Invoice: ${invoiceRef}` 
    : `Vendor: ${vendorName}`

  const success = await withTransaction<Expense>(DB_FILES.EXPENSES, (expenses) => {
    expenses.push({
      id: `venexp_${randomUUID().split('-')[0]}`,
      branchId,
      amount,
      category,
      source: 'vendor',
      date,
      notes,
      isPaid,
      createdAt: new Date().toISOString()
    })
    return expenses
  })

  if (!success) return { error: 'Transaction failed' }
  revalidatePath('/vendors')
  revalidatePath('/expenses')
  return { success: true }
}

export async function markVendorBillAsPaid(id: string) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }

  let notFound = false;
  let forbidden = false;
  const success = await withTransaction<Expense>(DB_FILES.EXPENSES, (expenses) => {
    const index = expenses.findIndex(e => e.id === id)
    if (index === -1) { notFound = true; return expenses; }
    
    if (!session.isGlobalOwner && expenses[index].branchId !== session.branchId) {
      forbidden = true; return expenses;
    }

    expenses[index].isPaid = true
    return expenses
  })

  if (forbidden) return { error: 'Forbidden' }

  if (notFound) return { error: 'Bill not found' }
  if (!success) return { error: 'Transaction failed' }

  revalidatePath('/vendors')
  revalidatePath('/expenses')
  return { success: true }
}

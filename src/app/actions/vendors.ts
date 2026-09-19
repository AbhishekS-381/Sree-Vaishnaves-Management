'use server'

import { withTransaction, DB_FILES } from '@/lib/db'
import { Expense } from './eod'
import { revalidatePath } from 'next/cache'
import { randomUUID } from 'crypto'
import { getSession, requireBranchAccess } from './auth'
import { z } from 'zod'

const addVendorSchema = z.object({
  name:        z.string().min(1, 'Vendor name is required').max(100, 'Name too long').trim(),
  phone:       z.string().min(7, 'Phone too short').max(15, 'Phone too long').regex(/^[0-9+\-\s()]+$/, 'Invalid phone'),
  supplyType:  z.string().min(1, 'Supply type is required').max(100, 'Supply type too long').trim(),
  branchId:    z.string().min(1, 'Branch is required'),
})

const addVendorBillSchema = z.object({
  vendorId:   z.string().min(1, 'Vendor is required'),
  amount:     z.number().int('Amount must be a whole number').min(1, 'Amount must be positive'),
  categoryId: z.string().min(1, 'Category is required'),
  date:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  branchId:   z.string().min(1, 'Branch is required'),
  invoiceRef: z.string().max(100, 'Invoice ref too long').optional(),
})

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

  const parsed = addVendorSchema.safeParse({ name, phone, supplyType, branchId })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  try {
    branchId = await requireBranchAccess(branchId)
  } catch (e) {
    return { error: 'Forbidden' }
  }

  let alreadyExists = false;
  const success = await withTransaction<Vendor>(DB_FILES.VENDORS, (vendors) => {
    if (vendors.some(v => v.name.toLowerCase() === name.toLowerCase() && v.branchId === branchId)) {
      alreadyExists = true;
      return vendors;
    }
    vendors.push({
      id: `ven_${randomUUID()}`,
      branchId,
      name,
      phone,
      supplyType,
      createdAt: new Date().toISOString()
    })
    return vendors
  })

  if (alreadyExists) return { error: 'A vendor with this name already exists in this branch' }

  if (!success) return { error: 'Transaction failed' }
  revalidatePath('/vendors')
  return { success: true }
}

export async function addVendorBill(prevState: any, formData: FormData) {
  const vendorId = formData.get('vendorId') as string
  const vendorName = formData.get('vendorName') as string
  const amount = Number(formData.get('amount'))
  const categoryId = (formData.get('categoryId') || formData.get('category')) as string
  const date = formData.get('date') as string
  const invoiceRef = formData.get('invoiceRef') as string
  let branchId = formData.get('branchId') as string
  const isPaid = formData.get('isPaid') === 'on'

  const parsed = addVendorBillSchema.safeParse({ vendorId, amount, categoryId, date, branchId, invoiceRef: invoiceRef || undefined })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

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
      id: `venexp_${randomUUID()}`,
      branchId,
      amount,
      categoryId,
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
    
    if (!session.isGlobalAdmin && expenses[index].branchId !== session.branchId) {
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

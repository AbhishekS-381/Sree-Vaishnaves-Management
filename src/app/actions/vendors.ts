'use server'

import { db, vendors, expenses } from '@/lib/db'
import { eq, and, ilike } from 'drizzle-orm'
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function addVendor(prevState: any, formData: FormData) {
  const name = formData.get('name') as string
  const phone = formData.get('phone') as string
  const supplyType = formData.get('supplyType') as string
  let branchId = formData.get('branchId') as string

  const parsed = addVendorSchema.safeParse({ name, phone, supplyType, branchId })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  try {
    branchId = await requireBranchAccess(branchId)
  } catch {
    return { error: 'Forbidden' }
  }

  try {
    const existing = await db
      .select({ id: vendors.id })
      .from(vendors)
      .where(
        and(
          ilike(vendors.name, name),
          eq(vendors.branchId, branchId),
          eq(vendors.isActive, true)
        )
      )
      .limit(1)

    if (existing.length > 0) {
      return { error: 'A vendor with this name already exists in this branch' }
    }

    await db.insert(vendors).values({
      id: randomUUID(),
      branchId,
      name,
      phone,
      supplyType,
      isActive: true,
      createdAt: new Date(),
    })

    revalidatePath('/management/vendors')
    return { success: true }
  } catch (error) {
    console.error('Failed to add vendor:', error)
    return { error: 'Transaction failed' }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  } catch {
    return { error: 'Forbidden' }
  }

  const notes = invoiceRef 
    ? `Vendor: ${vendorName} | Invoice: ${invoiceRef}` 
    : `Vendor: ${vendorName}`

  try {
    await db.insert(expenses).values({
      id: randomUUID(),
      branchId,
      amount,
      categoryId,
      source: 'vendor',
      date,
      notes,
      isPaid,
      createdAt: new Date(),
    })

    revalidatePath('/management/vendors')
    revalidatePath('/management/expenses')
    return { success: true }
  } catch (error) {
    console.error('Failed to add vendor bill:', error)
    return { error: 'Transaction failed' }
  }
}

export async function markVendorBillAsPaid(id: string) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }

  try {
    const existing = await db
      .select()
      .from(expenses)
      .where(eq(expenses.id, id))
      .limit(1)

    if (existing.length === 0) return { error: 'Bill not found' }

    if (!session.isGlobalAdmin && existing[0].branchId !== session.branchId) {
      return { error: 'Forbidden' }
    }

    await db
      .update(expenses)
      .set({ isPaid: true })
      .where(eq(expenses.id, id))

    revalidatePath('/management/vendors')
    revalidatePath('/management/expenses')
    return { success: true }
  } catch (error) {
    console.error('Failed to mark vendor bill as paid:', error)
    return { error: 'Transaction failed' }
  }
}

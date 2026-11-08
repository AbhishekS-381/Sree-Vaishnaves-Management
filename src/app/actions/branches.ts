'use server'

import { db, branches, staff } from '@/lib/db'
import { eq, and, ilike, ne, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { randomUUID } from 'crypto'
import { getSession } from './auth'
import { z } from 'zod'

type Branch = {
  id: string
  name: string
  address: string
  phone: string
  status: 'operational' | 'closed' | 'maintenance'
  gstin?: string | null
  internalStartTime?: string
  internalEndTime?: string
  customerStartTime?: string
  customerEndTime?: string
  isActive?: boolean
  deletedAt?: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function addBranch(prevState: any, formData: FormData) {
  const session = await getSession()
  if (!session?.isGlobalAdmin) return { error: 'Forbidden: Only admin and owner can manage branches' }

  const name = formData.get('name') as string
  const address = formData.get('address') as string
  const phone = formData.get('phone') as string
  const status = (formData.get('status') as Branch['status']) || 'operational'
  const gstin = (formData.get('gstin') as string)?.trim() || null
  const internalStartTime = formData.get('internalStartTime') as string
  const internalEndTime = formData.get('internalEndTime') as string
  const customerStartTime = formData.get('customerStartTime') as string
  const customerEndTime = formData.get('customerEndTime') as string

  const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/
  const schema = z.object({
    name: z.string().min(1).max(100).trim(),
    address: z.string().min(1).max(200).trim(),
    phone: z.string().min(1).max(50).trim(),
    gstin: z.string().max(20).optional().nullable().or(z.literal('')),
    internalStartTime: z.string().regex(timeRegex).optional().or(z.literal('')),
    internalEndTime: z.string().regex(timeRegex).optional().or(z.literal('')),
    customerStartTime: z.string().regex(timeRegex).optional().or(z.literal('')),
    customerEndTime: z.string().regex(timeRegex).optional().or(z.literal('')),
  }).refine(d => {
    if (d.internalStartTime && d.internalEndTime && d.internalStartTime !== '' && d.internalEndTime !== '') {
      return d.internalStartTime < d.internalEndTime
    }
    return true
  }, { message: 'End time must be after start time' })

  const parsed = schema.safeParse({ 
    name, 
    address, 
    phone,
    gstin,
    internalStartTime,
    internalEndTime,
    customerStartTime,
    customerEndTime
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Validation failed' }

  try {
    const existing = await db
      .select({ id: branches.id })
      .from(branches)
      .where(and(ilike(branches.name, name), eq(branches.isActive, true)))
      .limit(1)

    if (existing.length > 0) {
      return { error: 'A branch with this name already exists' }
    }

    await db.insert(branches).values({
      id: randomUUID(),
      name,
      address,
      phone,
      status,
      gstin: gstin || undefined,
      internalStartTime: internalStartTime || undefined,
      internalEndTime: internalEndTime || undefined,
      customerStartTime: customerStartTime || undefined,
      customerEndTime: customerEndTime || undefined,
      isActive: true,
    })

    revalidatePath('/management/branches')
    revalidatePath('/management/pos', 'layout')
    return { success: true }
  } catch (error) {
    console.error('Failed to add branch:', error)
    return { error: 'Failed to add branch due to a concurrent write.' }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateBranch(prevState: any, formData: FormData) {
  const session = await getSession()
  if (!session?.isGlobalAdmin) return { error: 'Forbidden: Only admin and owner can manage branches' }

  const id = formData.get('id') as string
  const name = formData.get('name') as string
  const address = formData.get('address') as string
  const phone = formData.get('phone') as string
  const status = formData.get('status') as Branch['status']
  const gstin = (formData.get('gstin') as string)?.trim() || null
  const internalStartTime = formData.get('internalStartTime') as string
  const internalEndTime = formData.get('internalEndTime') as string
  const customerStartTime = formData.get('customerStartTime') as string
  const customerEndTime = formData.get('customerEndTime') as string

  const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/
  const schema = z.object({ 
    name: z.string().min(1).max(100).trim(),
    gstin: z.string().max(20).optional().nullable().or(z.literal('')),
    internalStartTime: z.string().regex(timeRegex).optional().or(z.literal('')),
    internalEndTime: z.string().regex(timeRegex).optional().or(z.literal('')),
    customerStartTime: z.string().regex(timeRegex).optional().or(z.literal('')),
    customerEndTime: z.string().regex(timeRegex).optional().or(z.literal('')),
  }).refine(d => {
    if (d.internalStartTime && d.internalEndTime && d.internalStartTime !== '' && d.internalEndTime !== '') {
      return d.internalStartTime < d.internalEndTime
    }
    return true
  }, { message: 'End time must be after start time' })

  const parsed = schema.safeParse({ 
    name,
    gstin,
    internalStartTime,
    internalEndTime,
    customerStartTime,
    customerEndTime 
  })
  if (!id || !parsed.success) return { error: parsed.error?.issues[0]?.message || 'Invalid data' }

  try {
    const target = await db
      .select({ id: branches.id })
      .from(branches)
      .where(eq(branches.id, id))
      .limit(1)

    if (target.length === 0) {
      return { error: 'Not found' }
    }

    const duplicate = await db
      .select({ id: branches.id })
      .from(branches)
      .where(and(ilike(branches.name, name), eq(branches.isActive, true), ne(branches.id, id)))
      .limit(1)

    if (duplicate.length > 0) {
      return { error: 'A branch with this name already exists' }
    }

    await db
      .update(branches)
      .set({ 
        name, 
        address, 
        phone, 
        status,
        gstin: gstin || null,
        internalStartTime: internalStartTime || undefined,
        internalEndTime: internalEndTime || undefined,
        customerStartTime: customerStartTime || undefined,
        customerEndTime: customerEndTime || undefined,
      })
      .where(eq(branches.id, id))

    revalidatePath('/management/branches')
    revalidatePath(`/management/branches/${id}`)
    revalidatePath('/management/pos', 'layout')
    return { success: true }
  } catch (error) {
    console.error('Failed to update branch:', error)
    return { error: 'Transaction failed' }
  }
}

export async function deleteBranch(id: string) {
  const session = await getSession()
  if (!session?.isGlobalAdmin) return { error: 'Forbidden: Only admin and owner can manage branches' }

  try {
    // Block deletion if active staff exist in this branch
    const staffCountRows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(staff)
      .where(and(eq(staff.branchId, id), eq(staff.isActive, true)))

    const activeStaffCount = staffCountRows[0]?.count ?? 0
    if (activeStaffCount > 0) {
      return {
        error: `Cannot delete — ${activeStaffCount} active staff member(s) are assigned to this branch. Reassign or deactivate them first.`
      }
    }

    const target = await db
      .select({ id: branches.id })
      .from(branches)
      .where(and(eq(branches.id, id), eq(branches.isActive, true)))
      .limit(1)

    if (target.length === 0) {
      return { error: 'Branch not found' }
    }

    await db
      .update(branches)
      .set({ isActive: false, deletedAt: new Date() })
      .where(eq(branches.id, id))

    revalidatePath('/management/branches')
    revalidatePath('/management/pos', 'layout')
    return { success: true }
  } catch (error) {
    console.error('Failed to delete branch:', error)
    return { error: 'Transaction failed' }
  }
}

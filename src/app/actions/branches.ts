'use server'

import { withTransaction, DB_FILES, readJSON } from '@/lib/db'
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
  internalStartTime?: string
  internalEndTime?: string
  customerStartTime?: string
  customerEndTime?: string
  isActive?: boolean
  deletedAt?: string
}

export async function addBranch(prevState: any, formData: FormData) {
  const session = await getSession()
  if (session?.role !== 'owner') return { error: 'Forbidden' }

  const name = formData.get('name') as string
  const address = formData.get('address') as string
  const phone = formData.get('phone') as string
  const status = formData.get('status') as Branch['status'] || 'operational'
  const internalStartTime = formData.get('internalStartTime') as string
  const internalEndTime = formData.get('internalEndTime') as string
  const customerStartTime = formData.get('customerStartTime') as string
  const customerEndTime = formData.get('customerEndTime') as string

  const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
  const schema = z.object({
    name: z.string().min(1).max(100).trim(),
    address: z.string().min(1).max(200).trim(),
    phone: z.string().min(1).max(50).trim(),
    internalStartTime: z.string().regex(timeRegex).optional().or(z.literal('')),
    internalEndTime: z.string().regex(timeRegex).optional().or(z.literal('')),
    customerStartTime: z.string().regex(timeRegex).optional().or(z.literal('')),
    customerEndTime: z.string().regex(timeRegex).optional().or(z.literal('')),
  }).refine(d => {
    if (d.internalStartTime && d.internalEndTime && d.internalStartTime !== '' && d.internalEndTime !== '') {
      return d.internalStartTime < d.internalEndTime;
    }
    return true;
  }, { message: 'End time must be after start time' });

  const parsed = schema.safeParse({ 
    name, 
    address, 
    phone,
    internalStartTime,
    internalEndTime,
    customerStartTime,
    customerEndTime
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Validation failed' };

  const success = await withTransaction<Branch>(DB_FILES.BRANCHES, (list) => {
    list.push({
      id: `br_${randomUUID().split('-')[0]}`,
      name,
      address,
      phone,
      status,
      internalStartTime,
      internalEndTime,
      customerStartTime,
      customerEndTime,
      isActive: true
    })
    return list
  })

  if (!success) return { error: 'Failed to add branch due to a concurrent write.' }

  revalidatePath('/branches')
  return { success: true }
}

export async function updateBranch(prevState: any, formData: FormData) {
  const session = await getSession()
  if (session?.role !== 'owner') return { error: 'Forbidden' }

  const id = formData.get('id') as string
  const name = formData.get('name') as string
  const address = formData.get('address') as string
  const phone = formData.get('phone') as string
  const status = formData.get('status') as Branch['status']
  const internalStartTime = formData.get('internalStartTime') as string
  const internalEndTime = formData.get('internalEndTime') as string
  const customerStartTime = formData.get('customerStartTime') as string
  const customerEndTime = formData.get('customerEndTime') as string

  const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
  const schema = z.object({ 
    name: z.string().min(1).max(100).trim(),
    internalStartTime: z.string().regex(timeRegex).optional().or(z.literal('')),
    internalEndTime: z.string().regex(timeRegex).optional().or(z.literal('')),
    customerStartTime: z.string().regex(timeRegex).optional().or(z.literal('')),
    customerEndTime: z.string().regex(timeRegex).optional().or(z.literal('')),
  }).refine(d => {
    if (d.internalStartTime && d.internalEndTime && d.internalStartTime !== '' && d.internalEndTime !== '') {
      return d.internalStartTime < d.internalEndTime;
    }
    return true;
  }, { message: 'End time must be after start time' });

  const parsed = schema.safeParse({ 
    name,
    internalStartTime,
    internalEndTime,
    customerStartTime,
    customerEndTime 
  });
  if (!id || !parsed.success) return { error: parsed.error?.issues[0]?.message || 'Invalid data' }

  let notFound = false
  const success = await withTransaction<Branch>(DB_FILES.BRANCHES, (list) => {
    const index = list.findIndex(r => r.id === id)
    if (index === -1) {
      notFound = true
      return list
    }
    list[index] = { 
      ...list[index], 
      name, 
      address, 
      phone, 
      status,
      internalStartTime,
      internalEndTime,
      customerStartTime,
      customerEndTime
    }
    return list
  })

  if (notFound) return { error: 'Not found' }
  if (!success) return { error: 'Transaction failed' }

  revalidatePath('/branches')
  revalidatePath(`/branches/${id}`)
  return { success: true }
}

export async function deleteBranch(id: string) {
  const session = await getSession()
  if (session?.role !== 'owner') return { error: 'Forbidden' }

  // Issue 8: Block deletion if active staff exist in this branch
  const staffList = await readJSON<any>(DB_FILES.STAFF).catch(() => [])
  const activeStaff = staffList.filter((s: any) => s.branchId === id && s.isActive !== false && !s.deletedAt)
  if (activeStaff.length > 0) {
    return { error: `Cannot delete — ${activeStaff.length} active staff member(s) are assigned to this branch. Reassign or deactivate them first.` }
  }

  let notFound = false
  const success = await withTransaction<Branch>(DB_FILES.BRANCHES, (list) => {
    const index = list.findIndex(b => b.id === id)
    if (index === -1) {
      notFound = true
      return list
    }
    list[index].isActive = false
    list[index].deletedAt = new Date().toISOString()
    return list
  })

  if (notFound) return { error: 'Branch not found' }
  if (!success) return { error: 'Transaction failed' }

  revalidatePath('/branches')
  return { success: true }
}

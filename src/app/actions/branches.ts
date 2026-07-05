'use server'

import { withTransaction, DB_FILES } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { randomUUID } from 'crypto'
import { getSession } from './auth'

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
  if (session?.role !== 'owner' && session?.role !== 'admin') return { error: 'Forbidden' }

  const name = formData.get('name') as string
  const address = formData.get('address') as string
  const phone = formData.get('phone') as string
  const status = formData.get('status') as Branch['status'] || 'operational'
  const internalStartTime = formData.get('internalStartTime') as string
  const internalEndTime = formData.get('internalEndTime') as string
  const customerStartTime = formData.get('customerStartTime') as string
  const customerEndTime = formData.get('customerEndTime') as string

  if (!name || !address || !phone) {
    return { error: 'All fields are required' }
  }

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
  if (session?.role !== 'owner' && session?.role !== 'admin') return { error: 'Forbidden' }

  const id = formData.get('id') as string
  const name = formData.get('name') as string
  const address = formData.get('address') as string
  const phone = formData.get('phone') as string
  const status = formData.get('status') as Branch['status']
  const internalStartTime = formData.get('internalStartTime') as string
  const internalEndTime = formData.get('internalEndTime') as string
  const customerStartTime = formData.get('customerStartTime') as string
  const customerEndTime = formData.get('customerEndTime') as string

  if (!id || !name) return { error: 'Invalid data' }

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
  if (session?.role !== 'owner' && session?.role !== 'admin') return { error: 'Forbidden' }

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

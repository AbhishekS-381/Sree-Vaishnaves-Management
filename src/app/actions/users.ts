'use server'

import { withTransaction, DB_FILES } from '@/lib/db'
import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { getSession } from './auth'
import bcrypt from 'bcryptjs'

export type User = {
  id: string
  name: string
  password?: string
  role: string
  isActive?: boolean
  deletedAt?: string
}

export async function addUser(prevState: any, formData: FormData) {
  const session = await getSession()
  if (session?.role !== 'owner' && session?.role !== 'admin') return { error: 'Forbidden' }

  const name = formData.get('name') as string
  const password = formData.get('password') as string
  const role = formData.get('role') as string

  if (!name || !password || !role) return { error: 'All fields required' }
  const hashedPassword = await bcrypt.hash(password, 10)

  let alreadyExists = false
  const success = await withTransaction<User>(DB_FILES.USERS, (list) => {
    if (list.find(u => u.name.toLowerCase() === name.toLowerCase() && u.isActive !== false)) {
      alreadyExists = true
      return list
    }
    list.push({
      id: `u_${randomUUID()}`,
      name,
      password: hashedPassword,
      role,
      isActive: true
    })
    return list
  })

  if (alreadyExists) return { error: 'Username already exists' }
  if (!success) return { error: 'Transaction failed' }
  revalidatePath('/settings')
  return { success: true }
}

export async function updateUser(prevState: any, formData: FormData) {
  const session = await getSession()
  if (session?.role !== 'owner' && session?.role !== 'admin') return { error: 'Forbidden' }

  const id = formData.get('id') as string
  const name = formData.get('name') as string
  const password = formData.get('password') as string // optional to update
  const role = formData.get('role') as string

  if (!id || !name || !role) return { error: 'Invalid data' }
  const hashedPassword = password ? await bcrypt.hash(password, 10) : undefined

  let notFound = false
  let alreadyExists = false
  const success = await withTransaction<User>(DB_FILES.USERS, (list) => {
    const index = list.findIndex(u => u.id === id)
    if (index === -1) { notFound = true; return list; }

    if (list.find(u => u.name.toLowerCase() === name.toLowerCase() && u.id !== id && u.isActive !== false)) {
      alreadyExists = true; return list;
    }

    const existingPassword = list[index].password
    list[index] = { 
       ...list[index],
       name, 
       role, 
       password: hashedPassword || existingPassword 
    }
    return list
  })

  if (notFound) return { error: 'Not found' }
  if (alreadyExists) return { error: 'Username taken by another user' }
  if (!success) return { error: 'Transaction failed' }
  revalidatePath('/settings')
  return { success: true }
}

export async function deleteUser(id: string) {
  const session = await getSession()
  if (session?.role !== 'owner' && session?.role !== 'admin') return { error: 'Forbidden' }

  await withTransaction<User>(DB_FILES.USERS, (list) => {
    const index = list.findIndex(u => u.id === id)
    if (index !== -1) {
      list[index].isActive = false
      list[index].deletedAt = new Date().toISOString()
    }
    return list
  })
  revalidatePath('/settings')
  return { success: true }
}

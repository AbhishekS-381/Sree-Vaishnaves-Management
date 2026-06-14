'use server'

import { withTransaction, DB_FILES } from '@/lib/db'
import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'

export type User = {
  id: string
  name: string
  password?: string
  role: string
}

export async function addUser(prevState: any, formData: FormData) {
  const name = formData.get('name') as string
  const password = formData.get('password') as string
  const role = formData.get('role') as string

  if (!name || !password || !role) return { error: 'All fields required' }

  let alreadyExists = false
  const success = await withTransaction<User>(DB_FILES.USERS, (list) => {
    if (list.find(u => u.name.toLowerCase() === name.toLowerCase())) {
      alreadyExists = true
      return list
    }
    list.push({
      id: `u_${randomUUID().split('-')[0]}`,
      name,
      password,
      role
    })
    return list
  })

  if (alreadyExists) return { error: 'Username already exists' }
  if (!success) return { error: 'Transaction failed' }
  revalidatePath('/settings')
  return { success: true }
}

export async function updateUser(prevState: any, formData: FormData) {
  const id = formData.get('id') as string
  const name = formData.get('name') as string
  const password = formData.get('password') as string // optional to update
  const role = formData.get('role') as string

  if (!id || !name || !role) return { error: 'Invalid data' }

  let notFound = false
  let alreadyExists = false
  const success = await withTransaction<User>(DB_FILES.USERS, (list) => {
    const index = list.findIndex(u => u.id === id)
    if (index === -1) { notFound = true; return list; }

    if (list.find(u => u.name.toLowerCase() === name.toLowerCase() && u.id !== id)) {
      alreadyExists = true; return list;
    }

    const existingPassword = list[index].password
    list[index] = { 
       id, 
       name, 
       role, 
       password: password || existingPassword 
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
  await withTransaction<User>(DB_FILES.USERS, (list) => list.filter(u => u.id !== id))
  revalidatePath('/settings')
  return { success: true }
}

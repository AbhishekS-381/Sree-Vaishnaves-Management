'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { readJSON, DB_FILES } from '@/lib/db'
import { signToken, verifyToken } from '@/lib/jwt'

export async function login(prevState: any, formData: FormData) {
  const name = formData.get('name') as string
  const password = formData.get('password') as string

  if (!name || !password) return { error: 'Username and Password required' }

  const users = await readJSON<any>(DB_FILES.USERS).catch(() => [])
  const user = users.find((u: any) => u.name.toLowerCase() === name.toLowerCase() && u.password === password)

  if (user) {
    const isGlobalAdmin = user.role === 'Admin' || user.role === 'SuperAdmin' || user.role === 'owner';
    const token = await signToken({
      userId: user.id || user.name,
      name: user.name,
      role: user.role,
      branchId: user.branchId,
      isGlobalAdmin,
    });

    const cookieStore = await cookies()
    cookieStore.set('session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production' && process.env.SECURE_COOKIE !== 'false',
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: '/',
    })
    redirect('/')
  } else {
    return { error: 'Invalid Credentials' }
  }
}

export async function logout() {
  const cookieStore = await cookies()
  cookieStore.delete('session')
  redirect('/login')
}

export async function getSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value
  if (!token) return null;
  return await verifyToken(token);
}

export async function getSessionRole() {
  const session = await getSession();
  return session?.role || null;
}

export async function requireBranchAccess(targetBranchId?: string) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');
  
  if (!session.isGlobalAdmin) {
    if (targetBranchId && targetBranchId !== session.branchId) {
      throw new Error('Forbidden: You can only access your assigned branch.');
    }
    return session.branchId as string; // Return their enforced branch ID
  }
  
  return targetBranchId || session.branchId as string || '';
}

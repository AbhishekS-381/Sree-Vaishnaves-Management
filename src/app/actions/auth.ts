'use server'

import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

import { db, users } from '@/lib/db'
import { eq, and, ilike, isNull } from 'drizzle-orm'
import { signToken, verifyToken } from '@/lib/jwt'
import { checkRateLimit, resetRateLimit, pruneRateLimits } from '@/lib/rate-limit'

const loginSchema = z.object({
  name: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function login(prevState: any, formData: FormData) {
  const headersList = await headers()
  const ip = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || 'unknown'
  const name = formData.get('name') as string
  const rateLimit = await checkRateLimit(ip, name)
  if (!rateLimit.success) {
    return { error: rateLimit.error }
  }

  const password = formData.get('password') as string

  const parsed = loginSchema.safeParse({ name, password })
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const userRows = await db
    .select()
    .from(users)
    .where(and(ilike(users.name, name), eq(users.isActive, true), isNull(users.deletedAt)))
    .limit(1)
    .catch(() => [])

  const user = userRows[0]

  let isValidPassword = false
  if (user && user.password) {
    isValidPassword = await bcrypt.compare(password, user.password)
  }

  if (user && isValidPassword) {
    // Clear rate limit counter on successful login
    await resetRateLimit(ip, name)

    // Prune stale rate limit rows ~1% of logins — fire and forget
    if (Math.random() < 0.01) {
      pruneRateLimits().catch(() => {})
    }

    const role = user.role?.toLowerCase() || 'manager'
    const isAdmin = role === 'admin'
    const isOwner = role === 'owner'
    const isGlobalAdmin = isAdmin || isOwner
    const isGlobalOwner = isOwner
    const isPosRole = ['billing', 'kitchen', 'waiter'].includes(role)
    const token = await signToken({
      userId: user.id || user.name,
      name: user.name,
      role,
      branchId: user.branchId || undefined,
      isGlobalOwner,
      isGlobalAdmin,
      isRootAdmin: isAdmin,
      posRole: isPosRole || undefined,
    })

    const cookieStore = await cookies()
    cookieStore.set('session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production' && process.env.SECURE_COOKIE !== 'false',
      sameSite: 'strict',
      maxAge: 60 * 60 * 2, // 2 hours
      path: '/',
    })
    if (isPosRole) {
      const ROLE_HOME: Record<string, string> = {
        billing: '/management/pos/billing',
        kitchen: '/management/pos/kitchen',
        waiter: '/management/pos/order',
      }
      redirect(ROLE_HOME[role] || '/management')
    }

    redirect('/management')
  } else {
    return { error: 'Invalid Credentials' }
  }
}

export async function logout() {
  const cookieStore = await cookies()
  cookieStore.delete('session')
  redirect('/management/login')
}

export async function getSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value
  if (!token) return null
  const payload = await verifyToken(token)
  return payload
}

export async function getSessionRole() {
  const session = await getSession()
  return session?.role || null
}

export async function requireBranchAccess(targetBranchId?: string) {
  const session = await getSession()
  if (!session) throw new Error('Unauthorized')
  
  if (!session.isGlobalAdmin) {
    if (targetBranchId && targetBranchId !== session.branchId) {
      throw new Error('Forbidden: You can only access your assigned branch.')
    }
    return session.branchId as string // Return their enforced branch ID
  }
  
  return targetBranchId || session.branchId as string || ''
}

export async function migratePasswordsToHash() {
  const session = await getSession()
  if (session?.role !== 'admin') {
    return { error: 'Forbidden' }
  }

  const userList = await db.select().from(users).catch(() => [])
  let updated = false
  for (const u of userList) {
    if (u.password && !u.password.startsWith('$2a$') && !u.password.startsWith('$2b$')) {
      const hash = await bcrypt.hash(u.password, 10)
      await db.update(users).set({ password: hash }).where(eq(users.id, u.id))
      updated = true
    }
  }

  if (updated) {
    return { success: true, message: 'Passwords migrated successfully' }
  }
  return { success: true, message: 'No passwords needed migration' }
}

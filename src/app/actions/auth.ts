'use server'

import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

import { readJSON, writeJSON, DB_FILES } from '@/lib/db'
import { signToken, verifyToken } from '@/lib/jwt'
import { checkRateLimit, resetRateLimit, pruneRateLimits } from '@/lib/rate-limit'

const loginSchema = z.object({
  name: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
})

export async function login(prevState: any, formData: FormData) {
  const headersList = await headers();
  const ip = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || 'unknown';
  const rateLimit = await checkRateLimit(ip);
  if (!rateLimit.success) {
    return { error: rateLimit.error };
  }

  const name = formData.get('name') as string
  const password = formData.get('password') as string

  const parsed = loginSchema.safeParse({ name, password });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const users = await readJSON<any>(DB_FILES.USERS).catch(() => [])
  const user = users.find((u: any) => u.name.toLowerCase() === name.toLowerCase() && u.isActive !== false)

  let isValidPassword = false;
  if (user && user.password) {
    if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$')) {
      isValidPassword = await bcrypt.compare(password, user.password);
    } else {
      // Fallback for unmigrated passwords
      isValidPassword = user.password === password;
    }
  }

  if (user && isValidPassword) {
    // Clear rate limit counter on successful login
    await resetRateLimit(ip);

    // Prune stale rate limit rows ~1% of logins — fire and forget
    if (Math.random() < 0.01) {
      pruneRateLimits().catch(() => {});
    }

    const role = user.role?.toLowerCase() || 'manager';
    const isAdmin = role === 'admin';
    const isOwner = role === 'owner';
    const isGlobalAdmin = isAdmin || isOwner;
    const isGlobalOwner = isOwner;
    const token = await signToken({
      userId: user.id || user.name,
      name: user.name,
      role,
      branchId: user.branchId,
      isGlobalOwner,
      isGlobalAdmin,
      isRootAdmin: isAdmin,
    });

    const cookieStore = await cookies()
    cookieStore.set('session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production' && process.env.SECURE_COOKIE !== 'false',
      maxAge: 60 * 60 * 2, // 2 hours
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
  const payload = await verifyToken(token);
  return payload;
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

export async function migratePasswordsToHash() {
  const session = await getSession();
  if (session?.role !== 'admin') {
    return { error: 'Forbidden' };
  }
  const users = await readJSON<any>(DB_FILES.USERS);
  let updated = false;
  const migratedUsers = await Promise.all(users.map(async (u) => {
    if (u.password && !u.password.startsWith('$2a$') && !u.password.startsWith('$2b$')) {
      const hash = await bcrypt.hash(u.password, 10);
      updated = true;
      return { ...u, password: hash };
    }
    return u;
  }));

  if (updated) {
    await writeJSON(DB_FILES.USERS, migratedUsers);
    return { success: true, message: 'Passwords migrated successfully' };
  }
  return { success: true, message: 'No passwords needed migration' };
}

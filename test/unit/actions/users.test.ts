import { describe, it, expect, vi, beforeEach } from 'vitest'
import { addUser, updateUser, deleteUser } from '@/app/actions/users'
import * as auth from '@/app/actions/auth'

const { mockDb } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mock: any = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  }
  return { mockDb: mock }
})

vi.mock('@/lib/db', () => ({
  db: mockDb,
  users: {
    id: 'id',
    name: 'name',
    password: 'password',
    role: 'role',
    branchId: 'branchId',
    isActive: 'isActive',
    deletedAt: 'deletedAt',
  },
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('hashed_pw'),
    compare: vi.fn().mockResolvedValue(true),
  },
}))

describe('Users Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.select.mockReturnThis()
    mockDb.from.mockReturnThis()
    mockDb.where.mockReturnThis()
    mockDb.limit.mockResolvedValue([])
    mockDb.insert.mockReturnThis()
    mockDb.values.mockResolvedValue([])
    mockDb.update.mockReturnThis()
    mockDb.set.mockReturnThis()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(auth, 'getSession').mockResolvedValue({ role: 'admin', isGlobalAdmin: true, isRootAdmin: true, branchId: 'b1' } as any)
  })

  // ─── addUser ──────────────────────────────────────────────────────────────
  it('addUser validates global admin role', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(auth.getSession).mockResolvedValueOnce({ role: 'manager', isGlobalAdmin: false } as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await addUser({}, { get: () => 'Alice' } as any)
    expect(res).toEqual({ error: 'Forbidden' })
  })

  it('addUser validates required fields', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await addUser({}, { get: () => null } as any)
    expect(res).toEqual({ error: 'All fields required' })
  })

  it('addUser validates branchId requirement for POS scoped roles', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fd = {
      get: (k: string) => {
        if (k === 'name') return 'biller1'
        if (k === 'password') return 'secret'
        if (k === 'role') return 'billing'
        if (k === 'branchId') return ''
        return null
      }
    } as any
    const res = await addUser({}, fd)
    expect(res).toEqual({ error: 'Branch is required for this role' })
  })

  it('addUser rejects duplicate name', async () => {
    mockDb.limit.mockResolvedValueOnce([{ id: 'u1' }])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fd = {
      get: (k: string) => {
        if (k === 'name') return 'Alice'
        if (k === 'password') return 'secret'
        if (k === 'role') return 'owner'
        return null
      }
    } as any
    const res = await addUser({}, fd)
    expect(res).toEqual({ error: 'Username already exists' })
  })

  it('addUser succeeds', async () => {
    mockDb.limit.mockResolvedValueOnce([])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fd = {
      get: (k: string) => {
        if (k === 'name') return 'newuser'
        if (k === 'password') return 'pass123'
        if (k === 'role') return 'manager'
        if (k === 'branchId') return 'b1'
        return null
      }
    } as any
    const res = await addUser({}, fd)
    expect(res).toEqual({ success: true })
    expect(mockDb.insert).toHaveBeenCalled()
  })

  it('addUser handles db failure', async () => {
    mockDb.limit.mockResolvedValueOnce([])
    mockDb.values.mockRejectedValueOnce(new Error('db down'))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fd = {
      get: (k: string) => {
        if (k === 'name') return 'newuser'
        if (k === 'password') return 'pass123'
        if (k === 'role') return 'manager'
        if (k === 'branchId') return 'b1'
        return null
      }
    } as any
    const res = await addUser({}, fd)
    expect(res).toEqual({ error: 'Transaction failed' })
  })

  // ─── updateUser ──────────────────────────────────────────────────────────
  it('updateUser validates global admin role', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(auth.getSession).mockResolvedValueOnce({ role: 'manager', isGlobalAdmin: false } as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await updateUser({}, { get: () => 'test' } as any)
    expect(res).toEqual({ error: 'Forbidden' })
  })

  it('updateUser validates required fields', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await updateUser({}, { get: () => null } as any)
    expect(res).toEqual({ error: 'Invalid data' })
  })

  it('updateUser validates branchId requirement for POS roles', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fd = {
      get: (k: string) => {
        if (k === 'id') return 'u1'
        if (k === 'name') return 'biller1'
        if (k === 'role') return 'billing'
        if (k === 'branchId') return ''
        return null
      }
    } as any
    const res = await updateUser({}, fd)
    expect(res).toEqual({ error: 'Branch is required for this role' })
  })

  it('updateUser handles not found', async () => {
    mockDb.limit.mockResolvedValueOnce([]) // not found
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fd = {
      get: (k: string) => {
        if (k === 'id') return 'u999'
        if (k === 'name') return 'alice'
        if (k === 'role') return 'manager'
        if (k === 'branchId') return 'b1'
        return null
      }
    } as any
    const res = await updateUser({}, fd)
    expect(res).toEqual({ error: 'Not found' })
  })

  it('updateUser rejects duplicate name for another user', async () => {
    mockDb.limit
      .mockResolvedValueOnce([{ id: 'u1', role: 'manager' }]) // found target
      .mockResolvedValueOnce([{ id: 'u2' }]) // duplicate exists
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fd = {
      get: (k: string) => {
        if (k === 'id') return 'u1'
        if (k === 'name') return 'existing_other'
        if (k === 'role') return 'manager'
        if (k === 'branchId') return 'b1'
        return null
      }
    } as any
    const res = await updateUser({}, fd)
    expect(res).toEqual({ error: 'Username taken by another user' })
  })

  it('updateUser prevents demoting admin account', async () => {
    mockDb.limit
      .mockResolvedValueOnce([{ id: 'u1', role: 'admin' }]) // target is admin
      .mockResolvedValueOnce([]) // no duplicate
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fd = {
      get: (k: string) => {
        if (k === 'id') return 'u1'
        if (k === 'name') return 'admin_user'
        if (k === 'role') return 'manager' // attempted demotion
        if (k === 'branchId') return 'b1'
        return null
      }
    } as any
    const res = await updateUser({}, fd)
    expect(res).toEqual({ error: 'Cannot demote the admin account' })
  })

  it('updateUser succeeds', async () => {
    mockDb.limit
      .mockResolvedValueOnce([{ id: 'u1', role: 'manager' }]) // target found
      .mockResolvedValueOnce([]) // no duplicate
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fd = {
      get: (k: string) => {
        if (k === 'id') return 'u1'
        if (k === 'name') return 'uniqueuser'
        if (k === 'role') return 'manager'
        if (k === 'branchId') return 'b1'
        if (k === 'password') return 'newsecret'
        return null
      }
    } as any
    const res = await updateUser({}, fd)
    expect(res).toEqual({ success: true })
    expect(mockDb.update).toHaveBeenCalled()
  })

  // ─── deleteUser ──────────────────────────────────────────────────────────
  it('deleteUser validates global admin role', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(auth.getSession).mockResolvedValueOnce({ role: 'manager', isGlobalAdmin: false } as any)
    const res = await deleteUser('u1')
    expect(res).toEqual({ error: 'Forbidden' })
  })

  it('deleteUser prevents deleting admin account', async () => {
    mockDb.limit.mockResolvedValueOnce([{ id: 'u1', role: 'admin' }])
    const res = await deleteUser('u1')
    expect(res).toEqual({ error: 'Cannot delete the admin account' })
  })

  it('deleteUser succeeds', async () => {
    mockDb.limit.mockResolvedValueOnce([{ id: 'u2', role: 'manager' }])
    const res = await deleteUser('u2')
    expect(res).toEqual({ success: true })
    expect(mockDb.update).toHaveBeenCalled()
  })

  it('deleteUser handles db failure', async () => {
    mockDb.limit.mockResolvedValueOnce([{ id: 'u2', role: 'manager' }])
    mockDb.set.mockReturnValueOnce({
      where: vi.fn().mockRejectedValueOnce(new Error('db down'))
    })
    const res = await deleteUser('u2')
    expect(res).toEqual({ error: 'Transaction failed' })
  })
})

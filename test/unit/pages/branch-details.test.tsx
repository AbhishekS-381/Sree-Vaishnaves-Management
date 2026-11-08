import { describe, it, expect, vi, beforeEach } from 'vitest'
import BranchPage from '@/app/management/branches/[id]/page'
import * as auth from '@/app/actions/auth'
import { redirect } from 'next/navigation'

const { mockDb } = vi.hoisted(() => {
  const state: any = {
    branches: [{ id: 'b1', name: 'Branch 1', isActive: true, status: 'operational' }],
    staff: [],
    roles: [],
    eod: [],
    expenses: [],
    requirements: [],
  }

  const getCollection = (tableName: string) => {
    if (tableName === 'branches') return state.branches
    if (tableName === 'staff') return state.staff
    if (tableName === 'roles') return state.roles
    if (tableName === 'eod') return state.eod
    if (tableName === 'expenses') return state.expenses
    if (tableName === 'staff_requirements') return state.requirements
    return []
  }

  const mock: any = {
    state,
    select: vi.fn(() => ({
      from: vi.fn((table: any) => {
        const tableName = table?.tableName || ''
        const collection = getCollection(tableName)
        let filtered = collection

        const builder: any = {
          where: vi.fn((_cond?: any) => builder),
          limit: vi.fn((count?: number) => Promise.resolve(count !== undefined ? filtered.slice(0, count) : filtered)),
          catch: (cb: any) => Promise.resolve(filtered).catch(cb),
          then: (res: any, rej: any) => Promise.resolve(filtered).then(res, rej),
        }
        return builder
      }),
    })),
  }
  return { mockDb: mock }
})

vi.mock('@/lib/db', () => ({
  db: mockDb,
  branches: { tableName: 'branches', id: { name: 'id' } },
  staff: { tableName: 'staff', branchId: { name: 'branch_id' }, deletedAt: { name: 'deleted_at' } },
  roles: { tableName: 'roles' },
  eod: { tableName: 'eod', branchId: { name: 'branch_id' } },
  expenses: { tableName: 'expenses', branchId: { name: 'branch_id' } },
  staffRequirements: { tableName: 'staff_requirements', branchId: { name: 'branch_id' } },
}))

vi.mock('@/app/actions/auth', () => ({
  getSession: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
  notFound: vi.fn(),
}))

describe('Branch Details Page RBAC', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.state.branches = [{ id: 'b1', name: 'Branch 1', isActive: true, status: 'operational' }]
  })

  it('Root Admin can access any branch', async () => {
    vi.mocked(auth.getSession).mockResolvedValue({ role: 'admin', isGlobalAdmin: true, isRootAdmin: true } as any)
    await BranchPage({ params: Promise.resolve({ id: 'b1' }) } as any)
    expect(redirect).not.toHaveBeenCalled()
  })

  it('Owner can access any branch', async () => {
    vi.mocked(auth.getSession).mockResolvedValue({ role: 'owner', isGlobalAdmin: true, isGlobalOwner: true, isRootAdmin: false } as any)
    await BranchPage({ params: Promise.resolve({ id: 'b1' }) } as any)
    expect(redirect).not.toHaveBeenCalled()
  })

  it('Read-Only can access any branch', async () => {
    vi.mocked(auth.getSession).mockResolvedValue({ role: 'readonly', isGlobalAdmin: false, isRootAdmin: false } as any)
    await BranchPage({ params: Promise.resolve({ id: 'b1' }) } as any)
    expect(redirect).not.toHaveBeenCalled()
  })

  it('Manager can access their own branch', async () => {
    vi.mocked(auth.getSession).mockResolvedValue({ role: 'manager', branchId: 'b1', isGlobalAdmin: false, isRootAdmin: false } as any)
    await BranchPage({ params: Promise.resolve({ id: 'b1' }) } as any)
    expect(redirect).not.toHaveBeenCalled()
  })

  it('Manager is redirected when accessing another branch', async () => {
    vi.mocked(auth.getSession).mockResolvedValue({ role: 'manager', branchId: 'b2', isGlobalAdmin: false, isRootAdmin: false } as any)
    await BranchPage({ params: Promise.resolve({ id: 'b1' }) } as any)
    expect(redirect).toHaveBeenCalledWith('/management')
  })
})

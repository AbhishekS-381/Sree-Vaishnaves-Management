import { describe, it, expect, vi, beforeEach } from 'vitest'
import BranchPage from '@/app/branches/[id]/page'
import * as db from '@/lib/db'
import * as auth from '@/app/actions/auth'
import { redirect } from 'next/navigation'

vi.mock('@/lib/db', () => ({
  readJSON: vi.fn().mockResolvedValue([]),
  DB_FILES: new Proxy({}, { get: (target, prop) => String(prop).toLowerCase() + '.json' })
}))

vi.mock('@/app/actions/auth', () => ({
  getSession: vi.fn()
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn()
}))

vi.mock('@/app/branches/[id]/BranchClientPage', () => ({
  default: () => <div data-testid="branch-client" />
}))

describe('Branch Details Page RBAC', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Default mocks to pass DB reads
    vi.mocked(db.readJSON).mockImplementation(async (file: string) => {
      if (file.includes('branches')) return [{ id: 'b1', name: 'Branch 1' }]
      return []
    })
  })

  it('Root Admin can access any branch', async () => {
    vi.mocked(auth.getSession).mockResolvedValue({ role: 'admin', isGlobalAdmin: true, isRootAdmin: true } as any)
    await BranchPage({ params: { id: 'b1' } } as any)
    expect(redirect).not.toHaveBeenCalled()
  })

  it('Owner can access any branch', async () => {
    vi.mocked(auth.getSession).mockResolvedValue({ role: 'owner', isGlobalAdmin: true, isGlobalOwner: true, isRootAdmin: false } as any)
    await BranchPage({ params: { id: 'b1' } } as any)
    expect(redirect).not.toHaveBeenCalled()
  })

  it('Read-Only can access any branch', async () => {
    vi.mocked(auth.getSession).mockResolvedValue({ role: 'readonly', isGlobalAdmin: false, isRootAdmin: false } as any)
    await BranchPage({ params: { id: 'b1' } } as any)
    expect(redirect).not.toHaveBeenCalled()
  })

  it('Manager can access their own branch', async () => {
    vi.mocked(auth.getSession).mockResolvedValue({ role: 'manager', branchId: 'b1', isGlobalAdmin: false, isRootAdmin: false } as any)
    await BranchPage({ params: { id: 'b1' } } as any)
    expect(redirect).not.toHaveBeenCalled()
  })

  it('Manager is redirected when accessing another branch', async () => {
    vi.mocked(auth.getSession).mockResolvedValue({ role: 'manager', branchId: 'b2', isGlobalAdmin: false, isRootAdmin: false } as any)
    await BranchPage({ params: { id: 'b1' } } as any)
    expect(redirect).toHaveBeenCalledWith('/')
  })
})

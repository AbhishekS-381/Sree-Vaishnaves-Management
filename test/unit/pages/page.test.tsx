import { describe, it, expect, vi, beforeEach } from 'vitest'
import DashboardPage from '@/app/page'
import * as db from '@/lib/db'
import * as auth from '@/app/actions/auth'

vi.mock('@/lib/db', () => ({
  readJSON: vi.fn(),
  DB_FILES: new Proxy({}, { get: (target, prop) => String(prop).toLowerCase() + '.json' })
}))

vi.mock('@/app/actions/auth', () => ({
  getSession: vi.fn()
}))

vi.mock('@/app/DashboardClientPage', () => ({
  default: (props: any) => <div data-testid="dashboard-client" data-props={JSON.stringify(props)} />
}))

describe('Dashboard Page RBAC', () => {
  const mockBranches = [{ id: 'b1', name: 'Branch 1' }, { id: 'b2', name: 'Branch 2' }]
  const mockStaff = [{ id: 's1', branchId: 'b1' }, { id: 's2', branchId: 'b2' }]
  
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(db.readJSON).mockResolvedValue([])
    vi.mocked(db.readJSON).mockImplementation(async (file: string) => {
      if (file.includes('branches')) return mockBranches
      if (file.includes('staff')) return mockStaff
      return []
    })
  })

  it('Root Admin sees all data unfiltered', async () => {
    vi.mocked(auth.getSession).mockResolvedValue({ role: 'owner', isGlobalOwner: true, isRootAdmin: true } as any)
    const result = await DashboardPage()
    const htmlStr = JSON.stringify(result)
    
    expect(htmlStr).toContain('Branch 1')
    expect(htmlStr).toContain('Branch 2')
  })

  it('Owner sees all data unfiltered', async () => {
    vi.mocked(auth.getSession).mockResolvedValue({ role: 'owner', isGlobalOwner: true, isRootAdmin: false } as any)
    const result = await DashboardPage()
    const htmlStr = JSON.stringify(result)
    
    expect(htmlStr).toContain('Branch 1')
    expect(htmlStr).toContain('Branch 2')
  })

  it('Manager sees data filtered to their branchId', async () => {
    vi.mocked(auth.getSession).mockResolvedValue({ role: 'manager', isGlobalOwner: false, isRootAdmin: false, branchId: 'b1' } as any)
    const result = await DashboardPage()
    const htmlStr = JSON.stringify(result)
    
    expect(htmlStr).toContain('Branch 1')
    expect(htmlStr).not.toContain('Branch 2')
  })

  it('Read-Only sees all data if they have no branchId', async () => {
    vi.mocked(auth.getSession).mockResolvedValue({ role: 'readonly', isGlobalOwner: false, isRootAdmin: false } as any)
    const result = await DashboardPage()
    const htmlStr = JSON.stringify(result)
    
    expect(htmlStr).toContain('Branch 1')
    expect(htmlStr).toContain('Branch 2')
  })
})

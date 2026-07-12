import { describe, it, expect, vi, beforeEach } from 'vitest'
import DashboardPage from '@/app/page'
import * as db from '@/lib/db'
import * as auth from '@/app/actions/auth'

vi.mock('@/lib/db', () => ({
  readJSON: vi.fn().mockResolvedValue([]),
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
    vi.clearAllMocks()
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

describe('Dashboard UI & Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth.getSession).mockResolvedValue({ role: 'owner', isGlobalOwner: true, isRootAdmin: true } as any)
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2023-10-15T10:00:00Z')) // Not end of month
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('calculates metrics and formats currency with en-IN locale (1,00,000)', async () => {
    const todayStr = new Date('2023-10-15T10:00:00Z').toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
    vi.mocked(db.readJSON).mockImplementation(async (file: string) => {
      if (file.includes('branches')) return [{ id: 'b1', name: 'B1', status: 'operational', isActive: true }]
      if (file.includes('staff')) return [{ id: 's1', branchId: 'b1', isActive: true }]
      if (file.includes('eod')) return [
        { branchId: 'b1', date: todayStr, income: { dineInCash: 50000, takeawayCash: 50000 } }
      ]
      if (file.includes('expenses')) return [
        { branchId: 'b1', date: todayStr, amount: 20000 }
      ]
      return []
    })

    const result = await DashboardPage()
    const htmlStr = JSON.stringify(result)
    
    // Collection = 50000 + 50000 = 100000 -> 1,00,000
    // Expenses = 20000 -> Net Balance = 80000 -> 80,000
    expect(htmlStr).toContain('1,00,000')
    expect(htmlStr).toContain('80,000')
  })

  it('renders gracefully with $0 sales (Empty State)', async () => {
    vi.mocked(db.readJSON).mockImplementation(async (file: string) => {
      if (file.includes('branches')) return [{ id: 'b1', name: 'B1', status: 'operational', isActive: true }]
      return [] // No EOD, no staff, no expenses
    })

    const result = await DashboardPage()
    const htmlStr = JSON.stringify(result)
    
    // Should render 0 format without crashing
    expect(htmlStr).toContain('₹0')
  })

  it('renders pending actions correctly based on system state', async () => {
    const todayStr = new Date('2023-10-15T10:00:00Z').toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
    vi.mocked(db.readJSON).mockImplementation(async (file: string) => {
      if (file.includes('inventory')) return [{ currentQuantity: 5, threshold: 10 }] // Low stock
      if (file.includes('attendance')) return [] // Not marked
      if (file.includes('eod')) return [] // Not filled
      return []
    })

    const result = await DashboardPage()
    const htmlStr = JSON.stringify(result)
    
    expect(htmlStr).toContain('Attendance not marked for today')
    expect(htmlStr).toContain('EOD entry not filled')
    expect(htmlStr).toContain('1 Low stock alert(s)')
  })
})

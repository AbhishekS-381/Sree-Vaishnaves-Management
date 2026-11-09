import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import DashboardPage from '@/app/management/page'
import * as auth from '@/app/actions/auth'

const { mockDb } = vi.hoisted(() => {
  const state: any = {
    branches: [] as any[],
    staff: [] as any[],
    eod: [] as any[],
    expenses: [] as any[],
    inventory: [] as any[],
    attendance: [] as any[],
    payroll: [] as any[],
    config: [] as any[],
  }

  const getCollection = (tableName: string) => {
    if (tableName === 'branches') return state.branches
    if (tableName === 'staff') return state.staff
    if (tableName === 'eod') return state.eod
    if (tableName === 'expenses') return state.expenses
    if (tableName === 'inventory') return state.inventory
    if (tableName === 'attendance') return state.attendance
    if (tableName === 'payroll') return state.payroll
    if (tableName === 'config') return state.config
    return []
  }

  const mock: any = {
    state,
    select: vi.fn((_fields?: any) => ({
      from: vi.fn((table: any) => {
        const tableName = table?.tableName || ''
        const collection = getCollection(tableName)
        let filtered = collection

        const builder: any = {
          where: vi.fn((cond?: any) => {
            if (cond) {
              const str = JSON.stringify(cond)
              filtered = collection.filter((item: any) => {
                if (str.includes('"b1"') && (item.id !== 'b1' && item.branchId !== 'b1')) return false
                if (str.includes('"b2"') && (item.id !== 'b2' && item.branchId !== 'b2')) return false
                return true
              })
            }
            return builder
          }),
          limit: vi.fn((count?: number) => {
            return Promise.resolve(count !== undefined ? filtered.slice(0, count) : filtered)
          }),
          catch: (errCb: any) => Promise.resolve(filtered).catch(errCb),
          then: (resolve: any, reject: any) => Promise.resolve(filtered).then(resolve, reject),
        }
        return builder
      }),
    })),
  }
  return { mockDb: mock }
})

vi.mock('@/lib/db', () => ({
  db: mockDb,
  branches: { tableName: 'branches', id: { name: 'id' }, name: { name: 'name' }, status: { name: 'status' }, isActive: { name: 'is_active' }, deletedAt: { name: 'deleted_at' } },
  staff: { tableName: 'staff', id: { name: 'id' }, branchId: { name: 'branch_id' }, isActive: { name: 'is_active' }, deletedAt: { name: 'deleted_at' } },
  eod: { tableName: 'eod', branchId: { name: 'branch_id' }, date: { name: 'date' }, income: { name: 'income' } },
  expenses: { tableName: 'expenses', branchId: { name: 'branch_id' }, date: { name: 'date' }, amount: { name: 'amount' } },
  inventory: { tableName: 'inventory', branchId: { name: 'branch_id' }, id: { name: 'id' }, currentQuantity: { name: 'current_quantity' }, threshold: { name: 'threshold' } },
  attendance: { tableName: 'attendance', branchId: { name: 'branch_id' }, date: { name: 'date' }, id: { name: 'id' } },
  payroll: { tableName: 'payroll', branchId: { name: 'branch_id' }, month: { name: 'month' }, year: { name: 'year' }, id: { name: 'id' } },
  config: { tableName: 'config', id: { name: 'id' } },
}))

vi.mock('@/app/actions/auth', () => ({
  getSession: vi.fn(),
}))

describe('Dashboard Page RBAC', () => {
  const mockBranches = [
    { id: 'b1', name: 'Branch 1', isActive: true, status: 'operational' },
    { id: 'b2', name: 'Branch 2', isActive: true, status: 'operational' },
  ]
  const mockStaff = [
    { id: 's1', branchId: 'b1', isActive: true },
    { id: 's2', branchId: 'b2', isActive: true },
  ]
  
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.state.branches = [...mockBranches]
    mockDb.state.staff = [...mockStaff]
    mockDb.state.eod = []
    mockDb.state.expenses = []
    mockDb.state.inventory = []
    mockDb.state.attendance = []
    mockDb.state.payroll = []
    mockDb.state.config = [{ attendance: true, payroll: true, inventory: true }]
  })

  it('Root Admin sees all data unfiltered', async () => {
    vi.mocked(auth.getSession).mockResolvedValue({ role: 'owner', isGlobalOwner: true, isGlobalAdmin: true, isRootAdmin: true } as any)
    const result = await DashboardPage()
    const htmlStr = JSON.stringify(result)
    
    expect(htmlStr).toContain('Branch 1')
    expect(htmlStr).toContain('Branch 2')
  })

  it('Owner sees all data unfiltered', async () => {
    vi.mocked(auth.getSession).mockResolvedValue({ role: 'owner', isGlobalOwner: true, isGlobalAdmin: true, isRootAdmin: false } as any)
    const result = await DashboardPage()
    const htmlStr = JSON.stringify(result)
    
    expect(htmlStr).toContain('Branch 1')
    expect(htmlStr).toContain('Branch 2')
  })

  it('Manager sees data filtered to their branchId', async () => {
    vi.mocked(auth.getSession).mockResolvedValue({ role: 'manager', isGlobalOwner: false, isGlobalAdmin: false, isRootAdmin: false, branchId: 'b1' } as any)
    const result = await DashboardPage()
    const htmlStr = JSON.stringify(result)
    
    expect(htmlStr).toContain('Branch 1')
    expect(htmlStr).not.toContain('Branch 2')
  })

  it('Read-Only sees all data if they have no branchId', async () => {
    vi.mocked(auth.getSession).mockResolvedValue({ role: 'readonly', isGlobalOwner: true, isGlobalAdmin: true, isRootAdmin: false } as any)
    const result = await DashboardPage()
    const htmlStr = JSON.stringify(result)
    
    expect(htmlStr).toContain('Branch 1')
    expect(htmlStr).toContain('Branch 2')
  })
})

describe('Dashboard UI & Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth.getSession).mockResolvedValue({ role: 'owner', isGlobalOwner: true, isGlobalAdmin: true, isRootAdmin: true } as any)
    mockDb.state.branches = [{ id: 'b1', name: 'B1', status: 'operational', isActive: true }]
    mockDb.state.staff = [{ id: 's1', branchId: 'b1', isActive: true }]
    mockDb.state.eod = []
    mockDb.state.expenses = []
    mockDb.state.inventory = []
    mockDb.state.attendance = []
    mockDb.state.payroll = []
    mockDb.state.config = [{ attendance: true, payroll: true, inventory: true }]

    vi.useFakeTimers()
    vi.setSystemTime(new Date('2023-10-15T10:00:00Z')) // Not end of month
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('calculates metrics and formats currency with en-IN locale (1,00,000)', async () => {
    const todayStr = new Date('2023-10-15T10:00:00Z').toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
    mockDb.state.eod = [
      { branchId: 'b1', date: todayStr, income: { dineInCash: 50000, takeawayCash: 50000 } },
    ]
    mockDb.state.expenses = [
      { branchId: 'b1', date: todayStr, amount: 20000 },
    ]

    const result = await DashboardPage()
    const htmlStr = JSON.stringify(result)
    
    // Collection = 50000 + 50000 = 100000 -> 1,00,000
    // Expenses = 20000 -> Net Balance = 80000 -> 80,000
    expect(htmlStr).toContain('1,00,000')
    expect(htmlStr).toContain('80,000')
  })

  it('renders gracefully with $0 sales (Empty State)', async () => {
    mockDb.state.eod = []
    mockDb.state.staff = []
    mockDb.state.expenses = []

    const result = await DashboardPage()
    const htmlStr = JSON.stringify(result)
    
    // Should render 0 format without crashing
    expect(htmlStr).toContain('₹0')
  })

  it('renders pending actions correctly based on system state', async () => {
    mockDb.state.inventory = [{ currentQuantity: 5, threshold: 10 }] // Low stock
    mockDb.state.attendance = [] // Not marked
    mockDb.state.eod = [] // Not filled

    const result = await DashboardPage()
    const htmlStr = JSON.stringify(result)
    
    expect(htmlStr).toContain('Attendance not marked for today')
    expect(htmlStr).toContain('EOD entry not filled')
    expect(htmlStr).toContain('1 Low stock alert(s)')
  })
})

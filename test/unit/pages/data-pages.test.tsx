import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as db from '@/lib/db'
import * as auth from '@/app/actions/auth'

// Import all data pages
import StaffPage from '@/app/staff/page'
import AttendancePage from '@/app/attendance/page'
import BranchesPage from '@/app/branches/page'
import EODPage from '@/app/eod/page'
import ExpensesPage from '@/app/expenses/page'
import InventoryPage from '@/app/inventory/page'
import MenuPage from '@/app/menu/page'
import PayrollPage from '@/app/payroll/page'
import ReportsPage from '@/app/reports/page'
import VendorsPage from '@/app/vendors/page'

vi.mock('@/lib/db', () => ({
  readJSON: vi.fn().mockResolvedValue([]),
  DB_FILES: new Proxy({}, { get: (target, prop) => String(prop).toLowerCase() + '.json' })
}))

vi.mock('@/app/actions/auth', () => ({
  getSession: vi.fn(),
  getSessionRole: vi.fn().mockResolvedValue('owner')
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn()
}))

// Mock all Client Components so they don't error out during render
vi.mock('@/app/staff/StaffClientPage', () => ({ default: (props: any) => <div data-props={props} /> }))
vi.mock('@/app/attendance/AttendanceClientPage', () => ({ default: (props: any) => <div data-props={props} /> }))
vi.mock('@/app/branches/BranchesClientPage', () => ({ default: (props: any) => <div data-props={props} /> }))
vi.mock('@/app/eod/EODClientPage', () => ({ default: (props: any) => <div data-props={props} /> }))
vi.mock('@/app/expenses/ExpensesClientPage', () => ({ default: (props: any) => <div data-props={props} /> }))
vi.mock('@/app/inventory/InventoryClientPage', () => ({ default: (props: any) => <div data-props={props} /> }))
vi.mock('@/app/menu/MenuClientPage', () => ({ default: (props: any) => <div data-props={props} /> }))
vi.mock('@/app/payroll/PayrollClientPage', () => ({ default: (props: any) => <div data-props={props} /> }))
vi.mock('@/app/reports/ReportsClientPage', () => ({ default: (props: any) => <div data-props={props} /> }))
vi.mock('@/app/vendors/VendorsClientPage', () => ({ default: (props: any) => <div data-props={props} /> }))

const pagesToTest = [
  { name: 'StaffPage', component: StaffPage, dataProp: 'initialStaff' },
  { name: 'AttendancePage', component: AttendancePage, dataProp: 'staff' },
  { name: 'BranchesPage', component: BranchesPage, dataProp: 'branches' },
  { name: 'EODPage', component: EODPage, dataProp: 'branches' },
  { name: 'ExpensesPage', component: ExpensesPage, dataProp: 'expenses' },
  { name: 'InventoryPage', component: InventoryPage, dataProp: 'inventory' },
  { name: 'MenuPage', component: MenuPage, dataProp: 'initialMenu' },
  { name: 'PayrollPage', component: PayrollPage, dataProp: 'savedRecords' },
  { name: 'ReportsPage', component: ReportsPage, dataProp: 'staffData' },
  { name: 'VendorsPage', component: VendorsPage, dataProp: 'vendors' },
]

describe('Data Pages RBAC Filtering', () => {
  const mockData = [
    { id: 'b1', branchId: 'b1', status: 'active', isActive: true },
    { id: 'b2', branchId: 'b2', status: 'active', isActive: true },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.readJSON).mockImplementation(async (file: string) => {
      // Return a fresh copy to avoid mutation sharing between tests
      return JSON.parse(JSON.stringify(mockData))
    })
  })

  pagesToTest.forEach(({ name, component, dataProp }) => {
    describe(`${name}`, () => {
      
      it('Root Admin sees unfiltered data', async () => {
        vi.mocked(auth.getSession).mockResolvedValue({ role: 'admin', isGlobalAdmin: true, isRootAdmin: true } as any)
        const result = await component() as any
        const data = result.props[dataProp]
        
        // At least 2 items, because mockData has 2
        // Some pages might filter by isActive, but we mocked isActive: true
        expect(data.length).toBe(2)
      })

      it('Owner sees unfiltered data', async () => {
        vi.mocked(auth.getSession).mockResolvedValue({ role: 'owner', isGlobalAdmin: true, isGlobalOwner: true, isRootAdmin: false } as any)
        const result = await component() as any
        const data = result.props[dataProp]
        
        expect(data.length).toBe(2)
      })

      it('Read-Only sees unfiltered data', async () => {
        vi.mocked(auth.getSession).mockResolvedValue({ role: 'readonly', isGlobalAdmin: false, isRootAdmin: false } as any)
        const result = await component() as any
        if (name === 'EODPage') return; // Read-only cannot access EOD page
        const data = result.props[dataProp]
        
        expect(data.length).toBe(2)
      })

      it('Manager sees data filtered to their branch', async () => {
        vi.mocked(auth.getSession).mockResolvedValue({ role: 'manager', branchId: 'b1', isGlobalAdmin: false, isRootAdmin: false } as any)
        const result = await component() as any
        const data = result.props[dataProp]
        
        // Only items with branchId === 'b1'
        // EXCEPT branches page filters by branchId, which might be `b.id === branchId`. 
        // Let's check the result length. It should be 1.
        expect(data.length).toBe(1)
        expect(data[0].branchId === 'b1' || data[0].id === 'b1').toBe(true)
      })
    })
  })
})

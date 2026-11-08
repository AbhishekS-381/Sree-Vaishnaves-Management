import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as auth from '@/app/actions/auth'

// Import all data pages
import StaffPage from '@/app/management/staff/page'
import AttendancePage from '@/app/management/attendance/page'
import BranchesPage from '@/app/management/branches/page'
import EODPage from '@/app/management/eod/page'
import ExpensesPage from '@/app/management/expenses/page'
import InventoryPage from '@/app/management/inventory/page'
import MenuPage from '@/app/management/menu/page'
import PayrollPage from '@/app/management/payroll/page'
import ReportsPage from '@/app/management/reports/page'
import VendorsPage from '@/app/management/vendors/page'

const { mockDb } = vi.hoisted(() => {
  const getMockData = () => [
    { id: 'b1', branchId: 'b1', name: 'B1', status: 'active', isActive: true, deletedAt: null },
    { id: 'b2', branchId: 'b2', name: 'B2', status: 'active', isActive: true, deletedAt: null },
  ]

  const mock: any = {
    select: vi.fn(() => ({
      from: vi.fn((_table?: any) => {
        let filtered = getMockData()
        const builder: any = {
          where: vi.fn((cond?: any) => {
            if (cond) {
              const str = JSON.stringify(cond)
              if (str.includes('"b1"')) {
                filtered = filtered.filter((i: any) => i.id === 'b1' || i.branchId === 'b1')
              } else if (str.includes('"b2"')) {
                filtered = filtered.filter((i: any) => i.id === 'b2' || i.branchId === 'b2')
              }
            }
            return builder
          }),
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
  branches: { tableName: 'branches', id: { name: 'id' }, isActive: { name: 'is_active' }, deletedAt: { name: 'deleted_at' } },
  staff: { tableName: 'staff', id: { name: 'id' }, branchId: { name: 'branch_id' }, isActive: { name: 'is_active' }, deletedAt: { name: 'deleted_at' } },
  roles: { tableName: 'roles', isActive: { name: 'is_active' } },
  departments: { tableName: 'departments', isActive: { name: 'is_active' } },
  staffRequirements: { tableName: 'staff_requirements', branchId: { name: 'branch_id' }, isActive: { name: 'is_active' } },
  menuItems: { tableName: 'menu_items', deletedAt: { name: 'deleted_at' } },
  menuCategories: { tableName: 'menu_categories', deletedAt: { name: 'deleted_at' } },
  menuItemVariants: { tableName: 'menu_item_variants' },
  branchCategories: { tableName: 'branch_categories' },
  branchMenuItems: { tableName: 'branch_menu_items', branchId: { name: 'branch_id' } },
  attendance: { tableName: 'attendance', branchId: { name: 'branch_id' }, date: { name: 'date' } },
  eod: { tableName: 'eod', branchId: { name: 'branch_id' } },
  expenses: { tableName: 'expenses', branchId: { name: 'branch_id' } },
  inventory: { tableName: 'inventory', branchId: { name: 'branch_id' } },
  payroll: { tableName: 'payroll', branchId: { name: 'branch_id' } },
  categories: { tableName: 'categories' },
  vendors: { tableName: 'vendors', branchId: { name: 'branch_id' } },
  config: { tableName: 'config', id: { name: 'id' } },
  posOrders: { tableName: 'pos_orders', branchId: { name: 'branch_id' }, date: { name: 'date' } },
}))

vi.mock('@/app/actions/auth', () => ({
  getSession: vi.fn(),
  getSessionRole: vi.fn().mockResolvedValue('owner'),
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}))

// Mock all Client Components so they don't error out during render
vi.mock('@/app/management/staff/StaffClientPage', () => ({ default: (props: any) => <div data-props={props} /> }))
vi.mock('@/app/management/attendance/AttendanceClientPage', () => ({ default: (props: any) => <div data-props={props} /> }))
vi.mock('@/app/management/branches/BranchesClientPage', () => ({ default: (props: any) => <div data-props={props} /> }))
vi.mock('@/app/management/eod/EODClientPage', () => ({ default: (props: any) => <div data-props={props} /> }))
vi.mock('@/app/management/expenses/ExpensesClientPage', () => ({ default: (props: any) => <div data-props={props} /> }))
vi.mock('@/app/management/inventory/InventoryClientPage', () => ({ default: (props: any) => <div data-props={props} /> }))
vi.mock('@/app/management/menu/MenuClientPage', () => ({ default: (props: any) => <div data-props={props} /> }))
vi.mock('@/app/payroll/PayrollClientPage', () => ({ default: (props: any) => <div data-props={props} /> }))
vi.mock('@/app/management/reports/ReportsClientPage', () => ({ default: (props: any) => <div data-props={props} /> }))
vi.mock('@/app/management/vendors/VendorsClientPage', () => ({ default: (props: any) => <div data-props={props} /> }))

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
  beforeEach(() => {
    vi.clearAllMocks()
  })

  pagesToTest.forEach(({ name, component, dataProp }) => {
    describe(`${name}`, () => {
      
      it('Root Admin sees unfiltered data', async () => {
        vi.mocked(auth.getSession).mockResolvedValue({ role: 'admin', isGlobalAdmin: true, isRootAdmin: true } as any)
        const result = await component() as any
        const data = result.props[dataProp]
        
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
        if (name === 'EODPage') return // Read-only cannot access EOD page
        const data = result.props[dataProp]
        
        expect(data.length).toBe(2)
      })

      it('Manager sees data filtered to their branch', async () => {
        vi.mocked(auth.getSession).mockResolvedValue({ role: 'manager', branchId: 'b1', isGlobalAdmin: false, isRootAdmin: false } as any)
        const result = await component() as any
        const data = result.props[dataProp]
        
        if (name === 'MenuPage') {
          // Menu items are global, so they aren't filtered by branch
          expect(data.length).toBe(2)
        } else {
          expect(data.length).toBe(1)
          expect(data[0].branchId === 'b1' || data[0].id === 'b1').toBe(true)
        }
      })
    })
  })
})

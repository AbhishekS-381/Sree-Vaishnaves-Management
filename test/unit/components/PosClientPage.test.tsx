import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import PosClientPage from '@/app/management/pos/PosClientPage'
import * as posActions from '@/app/actions/pos'
import type { PosTable, PosOrder, PosKot, CatalogItem } from '@/app/actions/posTypes'

const mockPush = vi.fn()
const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}))

vi.mock('@/app/actions/pos', () => ({
  createTable: vi.fn(),
  renameTable: vi.fn(),
  deactivateTable: vi.fn(),
  createOrder: vi.fn(),
  addOrUpdateOrderItem: vi.fn(),
  removeOrderItem: vi.fn(),
  updateOrderNote: vi.fn(),
  fireKot: vi.fn(),
  generateBill: vi.fn(),
  reopenOrder: vi.fn(),
  recordPayment: vi.fn(),
  voidOrder: vi.fn(),
  advanceKotStatus: vi.fn(),
  getDailySummary: vi.fn(),
}))

describe('PosClientPage Component Tests', () => {
  const branches = [
    { id: 'br-1', name: 'Main Branch' },
    { id: 'br-2', name: 'Airport Branch' },
  ]

  const adminSession = {
    userId: 'user-admin',
    name: 'Abhishek Admin',
    role: 'admin',
    isGlobalAdmin: true,
  }

  const managerSession = {
    userId: 'user-manager',
    name: 'Vikram Manager',
    role: 'manager',
    isGlobalAdmin: false,
  }

  const sampleTables: PosTable[] = [
    { id: 'tbl-1', branchId: 'br-1', name: 'Table 1', capacity: 4, isActive: true, createdAt: '2026-10-19T00:00:00Z', updatedAt: '2026-10-19T00:00:00Z' },
    { id: 'tbl-2', branchId: 'br-1', name: 'Table 2', capacity: 2, isActive: true, createdAt: '2026-10-19T00:00:00Z', updatedAt: '2026-10-19T00:00:00Z' },
    { id: 'tbl-3', branchId: 'br-1', name: 'Table 3', capacity: 6, isActive: true, createdAt: '2026-10-19T00:00:00Z', updatedAt: '2026-10-19T00:00:00Z' },
  ]

  const sampleOrders: PosOrder[] = [
    // Open order on Table 1
    {
      id: 'ord-1',
      branchId: 'br-1',
      tableId: 'tbl-1',
      orderType: 'dine-in',
      status: 'open',
      openedAt: '2026-10-19T10:00:00.000Z',
      openedByUserId: 'user-admin',
      covers: 2,
      note: 'Extra napkins',
      items: [
        { id: 'it-1', menuItemId: 'm1', nameSnapshot: 'Paneer Butter Masala', quantity: 2, unitPrice: 220, note: 'Mild' },
        { id: 'it-2', menuItemId: 'm2', nameSnapshot: 'Garlic Roti', quantity: 4, unitPrice: 35 },
      ],
    },
    // Billed order on Table 2
    {
      id: 'ord-2',
      branchId: 'br-1',
      tableId: 'tbl-2',
      orderType: 'dine-in',
      status: 'billed',
      openedAt: '2026-10-19T09:30:00.000Z',
      openedByUserId: 'user-manager',
      covers: 2,
      items: [
        { id: 'it-3', menuItemId: 'm3', nameSnapshot: 'Veg Biryani', quantity: 1, unitPrice: 190 },
      ],
      bill: {
        subtotal: 190,
        discount: 10,
        gst: 9,
        totalPayable: 189,
        generatedAt: '2026-10-19T10:15:00.000Z',
        generatedByUserId: 'user-manager',
      },
    },
    // Open takeaway order
    {
      id: 'ord-tkw-1',
      branchId: 'br-1',
      orderType: 'takeaway',
      takeawayNumber: 'T-1',
      status: 'open',
      openedAt: '2026-10-19T10:05:00.000Z',
      openedByUserId: 'user-admin',
      items: [
        { id: 'it-4', menuItemId: 'm4', nameSnapshot: 'Masala Dosa', quantity: 1, unitPrice: 85 },
      ],
    },
  ]

  const sampleKots: PosKot[] = [
    {
      id: 'kot-101',
      orderId: 'ord-1',
      kotNumber: 1,
      items: [
        { menuItemId: 'm1', nameSnapshot: 'Paneer Butter Masala', quantity: 2 },
      ],
      status: 'preparing',
      firedAt: '2026-10-19T10:02:00.000Z',
    },
  ]

  const sampleCatalog: CatalogItem[] = [
    { menuItemId: 'm1', name: 'Paneer Butter Masala', effectivePrice: 220, categoryId: 'Curries', isAvailable: true },
    { menuItemId: 'm2', name: 'Garlic Roti', effectivePrice: 35, categoryId: 'Breads', isAvailable: true },
    { menuItemId: 'm3', name: 'Veg Biryani', effectivePrice: 190, categoryId: 'Rice', isAvailable: true },
    { menuItemId: 'm4', name: 'Masala Dosa', effectivePrice: 85, categoryId: 'Tiffin', isAvailable: true },
  ]

  const initialData = {
    tables: sampleTables,
    orders: sampleOrders,
    kots: sampleKots,
    catalog: sampleCatalog,
    todayIST: '2026-10-19',
  }

  const sampleDailySummary = {
    totalBillAmount: 1850,
    billCount: 6,
    totalCash: 1200,
    totalUpi: 650,
    dineInBillCount: 4,
    takeawayBillCount: 2,
    dineInCovers: 12,
    voids: 1,
    discounts: 50,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    posActions.createTable.mockResolvedValue({ success: true })
    posActions.renameTable.mockResolvedValue({ success: true })
    posActions.deactivateTable.mockResolvedValue({ success: true })
    posActions.createOrder.mockResolvedValue({ success: true, orderId: 'ord-new' })
    posActions.addOrUpdateOrderItem.mockResolvedValue({ success: true })
    posActions.removeOrderItem.mockResolvedValue({ success: true })
    posActions.updateOrderNote.mockResolvedValue({ success: true })
    posActions.fireKot.mockResolvedValue({ success: true, kotNumber: 2 })
    posActions.generateBill.mockResolvedValue({ success: true })
    posActions.reopenOrder.mockResolvedValue({ success: true })
    posActions.recordPayment.mockResolvedValue({ success: true, changeDue: 0 })
    posActions.voidOrder.mockResolvedValue({ success: true })
    posActions.advanceKotStatus.mockResolvedValue({ success: true })
    posActions.getDailySummary.mockResolvedValue(sampleDailySummary as any)
  })

  // ── Header & Navigation ──
  it('renders POS page title and operator badge', () => {
    render(
      <PosClientPage
        branches={branches}
        activeBranchId="br-1"
        initialData={initialData}
        staleOrders={[]}
        session={adminSession}
        posDefaultGstPercent={5}
      />
    )
    expect(screen.getByText('Point of Sale')).toBeDefined()
    expect(screen.getByText(/Service Operator: Abhishek Admin \(admin\)/)).toBeDefined()
  })

  it('renders branch dropdown for global admin', () => {
    render(
      <PosClientPage
        branches={branches}
        activeBranchId="br-1"
        initialData={initialData}
        staleOrders={[]}
        session={adminSession}
        posDefaultGstPercent={5}
      />
    )
    const select = screen.getByRole('combobox') as HTMLSelectElement
    expect(select).toBeDefined()
    expect(select.value).toBe('br-1')
  })

  it('switching branch triggers router navigation', () => {
    render(
      <PosClientPage
        branches={branches}
        activeBranchId="br-1"
        initialData={initialData}
        staleOrders={[]}
        session={adminSession}
        posDefaultGstPercent={5}
      />
    )
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'br-2' } })
    expect(mockPush).toHaveBeenCalledWith('/management/pos?branch=br-2')
  })

  it('renders link to POS History for global admin', () => {
    render(
      <PosClientPage
        branches={branches}
        activeBranchId="br-1"
        initialData={initialData}
        staleOrders={[]}
        session={adminSession}
        posDefaultGstPercent={5}
      />
    )
    const historyLink = screen.getByRole('link', { name: /History/i })
    expect(historyLink).toBeDefined()
    expect(historyLink.getAttribute('href')).toContain('/management/pos/history')
  })

  // ── Day Summary Drawer ──
  it('renders Summary button in header', () => {
    render(
      <PosClientPage
        branches={branches}
        activeBranchId="br-1"
        initialData={initialData}
        staleOrders={[]}
        session={adminSession}
        posDefaultGstPercent={5}
      />
    )
    expect(screen.getByRole('button', { name: /Summary/i })).toBeDefined()
  })

  it('clicking Summary fetches daily summary and expands metrics card', async () => {
    render(
      <PosClientPage
        branches={branches}
        activeBranchId="br-1"
        initialData={initialData}
        staleOrders={[]}
        session={adminSession}
        posDefaultGstPercent={5}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /Summary/i }))

    await waitFor(() => {
      expect(posActions.getDailySummary).toHaveBeenCalledWith('br-1', '2026-10-19')
      expect(screen.getByText(/Today's POS Performance/i)).toBeDefined()
      expect(screen.getByText('₹1850')).toBeDefined()
      expect(screen.getByText(/₹1200 \/ ₹650/)).toBeDefined()
    })
  })

  // ── Stale Orders Warning Banner ──
  it('renders stale orders banner when staleOrders exist and allows dismissal', () => {
    const staleOrders = [{ ...sampleOrders[0], tableName: 'Table 1' }]
    render(
      <PosClientPage
        branches={branches}
        activeBranchId="br-1"
        initialData={initialData}
        staleOrders={staleOrders}
        session={adminSession}
        posDefaultGstPercent={5}
      />
    )
    expect(screen.getByText(/order left open from prior days/i)).toBeDefined()
    fireEvent.click(screen.getByText('Dismiss'))
    expect(screen.queryByText(/order left open from prior days/i)).toBeNull()
  })

  // ── Tables Grid & Table Operations ──
  it('renders all tables in grid', () => {
    render(
      <PosClientPage
        branches={branches}
        activeBranchId="br-1"
        initialData={initialData}
        staleOrders={[]}
        session={adminSession}
        posDefaultGstPercent={5}
      />
    )
    expect(screen.getByText('Table 1')).toBeDefined()
    expect(screen.getByText('Table 2')).toBeDefined()
    expect(screen.getByText('Table 3')).toBeDefined()
  })

  it('renders table status badges (Occupied, Billed, Available)', () => {
    render(
      <PosClientPage
        branches={branches}
        activeBranchId="br-1"
        initialData={initialData}
        staleOrders={[]}
        session={adminSession}
        posDefaultGstPercent={5}
      />
    )
    expect(screen.getAllByText('Occupied').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Billed')).toBeDefined()
    expect(screen.getAllByText('Available').length).toBeGreaterThanOrEqual(1)
  })

  it('clicking Manage Tables button opens Table modal in create mode', () => {
    render(
      <PosClientPage
        branches={branches}
        activeBranchId="br-1"
        initialData={initialData}
        staleOrders={[]}
        session={adminSession}
        posDefaultGstPercent={5}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /Manage Tables/i }))
    expect(screen.getByRole('heading', { name: 'Manage Tables' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Add Table' })).toBeDefined()
  })

  it('submitting Add Table in modal calls createTable', async () => {
    render(
      <PosClientPage
        branches={branches}
        activeBranchId="br-1"
        initialData={initialData}
        staleOrders={[]}
        session={adminSession}
        posDefaultGstPercent={5}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /Manage Tables/i }))
    const input = screen.getByPlaceholderText(/e.g. Table 1, T12, Patio 4/i)
    fireEvent.change(input, { target: { value: 'Table 4' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add Table' }))

    await waitFor(() => {
      expect(posActions.createTable).toHaveBeenCalledTimes(1)
      const formData = posActions.createTable.mock.calls[0][1] as FormData
      expect(formData.get('name')).toBe('Table 4')
      expect(screen.getByText(/Table created successfully/i)).toBeDefined()
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  it('clicking table rename button in modal switches to rename mode and calls renameTable', async () => {
    render(
      <PosClientPage
        branches={branches}
        activeBranchId="br-1"
        initialData={initialData}
        staleOrders={[]}
        session={adminSession}
        posDefaultGstPercent={5}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /Manage Tables/i }))
    const renameButtons = screen.getAllByRole('button', { name: 'Rename' })
    fireEvent.click(renameButtons[0])

    const input = screen.getByPlaceholderText(/e.g. Table 1, T12, Patio 4/i)
    fireEvent.change(input, { target: { value: 'Table VIP' } })
    fireEvent.click(screen.getByRole('button', { name: 'Update' }))

    await waitFor(() => {
      expect(posActions.renameTable).toHaveBeenCalledTimes(1)
      const formData = posActions.renameTable.mock.calls[0][1] as FormData
      expect(formData.get('tableId')).toBe('tbl-1')
      expect(formData.get('newName')).toBe('Table VIP')
      expect(screen.getByText(/Table renamed successfully/i)).toBeDefined()
    })
  })

  it('clicking deactivate table button triggers confirm and calls deactivateTable', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(
      <PosClientPage
        branches={branches}
        activeBranchId="br-1"
        initialData={initialData}
        staleOrders={[]}
        session={adminSession}
        posDefaultGstPercent={5}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /Manage Tables/i }))
    const deactivateButtons = screen.getAllByRole('button', { name: 'Deactivate' })
    fireEvent.click(deactivateButtons[0])

    await waitFor(() => {
      expect(posActions.deactivateTable).toHaveBeenCalledWith('tbl-1')
      expect(screen.getByText('Table deactivated')).toBeDefined()
    })
  })

  // ── Takeaways List ──
  it('renders Active Takeaways list with order chips', () => {
    render(
      <PosClientPage
        branches={branches}
        activeBranchId="br-1"
        initialData={initialData}
        staleOrders={[]}
        session={adminSession}
        posDefaultGstPercent={5}
      />
    )
    expect(screen.getByText(/Active Takeaway Orders/i)).toBeDefined()
    expect(screen.getByText(/T-1/)).toBeDefined()
  })

  it('clicking a takeaway chip selects it in the right panel', () => {
    render(
      <PosClientPage
        branches={branches}
        activeBranchId="br-1"
        initialData={initialData}
        staleOrders={[]}
        session={adminSession}
        posDefaultGstPercent={5}
      />
    )
    fireEvent.click(screen.getByText(/T-1 • 1 items/))
    expect(screen.getByRole('heading', { name: /T-1/i })).toBeDefined()
    expect(screen.getAllByText('Masala Dosa').length).toBeGreaterThanOrEqual(1)
  })

  // ── Selected Order Panel & Cart Operations ──
  it('clicking an occupied table selects it and displays order details', () => {
    render(
      <PosClientPage
        branches={branches}
        activeBranchId="br-1"
        initialData={initialData}
        staleOrders={[]}
        session={adminSession}
        posDefaultGstPercent={5}
      />
    )
    fireEvent.click(screen.getByText('Table 1'))
    expect(screen.getByRole('heading', { name: /Table 1/i })).toBeDefined()
    expect(screen.getAllByText('Paneer Butter Masala').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Garlic Roti').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('“Mild”')).toBeDefined()
  })

  it('clicking + button increments item quantity in order cart', async () => {
    render(
      <PosClientPage
        branches={branches}
        activeBranchId="br-1"
        initialData={initialData}
        staleOrders={[]}
        session={adminSession}
        posDefaultGstPercent={5}
      />
    )
    fireEvent.click(screen.getByText('Table 1'))
    const plusButtons = screen.getAllByRole('button', { name: '+' })
    fireEvent.click(plusButtons[0])

    await waitFor(() => {
      expect(posActions.addOrUpdateOrderItem).toHaveBeenCalledWith(
        'ord-1',
        'm1',
        3,
        220,
        'Paneer Butter Masala',
        undefined
      )
    })
  })

  it('clicking - button decrements quantity when quantity > 1', async () => {
    render(
      <PosClientPage
        branches={branches}
        activeBranchId="br-1"
        initialData={initialData}
        staleOrders={[]}
        session={adminSession}
        posDefaultGstPercent={5}
      />
    )
    fireEvent.click(screen.getByText('Table 1'))
    const minusButtons = screen.getAllByRole('button', { name: '-' })
    fireEvent.click(minusButtons[0])

    await waitFor(() => {
      expect(posActions.addOrUpdateOrderItem).toHaveBeenCalledWith(
        'ord-1',
        'm1',
        1,
        220,
        'Paneer Butter Masala',
        undefined
      )
    })
  })

  // ── Fire KOT Operations ──
  it('enables "Fire KOT" when order has unfired items', () => {
    render(
      <PosClientPage
        branches={branches}
        activeBranchId="br-1"
        initialData={initialData}
        staleOrders={[]}
        session={adminSession}
        posDefaultGstPercent={5}
      />
    )
    fireEvent.click(screen.getByText('Table 1'))
    const fireBtn = screen.getByRole('button', { name: /Fire KOT/i }) as HTMLButtonElement
    expect(fireBtn.disabled).toBe(false)
  })

  it('clicking "Fire KOT" calls fireKot', async () => {
    render(
      <PosClientPage
        branches={branches}
        activeBranchId="br-1"
        initialData={initialData}
        staleOrders={[]}
        session={adminSession}
        posDefaultGstPercent={5}
      />
    )
    fireEvent.click(screen.getByText('Table 1'))
    fireEvent.click(screen.getByRole('button', { name: /Fire KOT/i }))

    await waitFor(() => {
      expect(posActions.fireKot).toHaveBeenCalledWith('ord-1')
      expect(screen.getByText('KOT fired to kitchen')).toBeDefined()
    })
  })

  // ── Bill Generation Modal ──
  it('clicking "Generate Bill" opens bill modal with subtotal and GST', () => {
    render(
      <PosClientPage
        branches={branches}
        activeBranchId="br-1"
        initialData={initialData}
        staleOrders={[]}
        session={adminSession}
        posDefaultGstPercent={5}
      />
    )
    fireEvent.click(screen.getByText('Table 1'))
    fireEvent.click(screen.getByRole('button', { name: /Generate Bill/i }))

    expect(screen.getByText('Generate Customer Bill')).toBeDefined()
    expect(screen.getAllByText('₹580').length).toBeGreaterThanOrEqual(1)
  })

  it('submitting Bill Modal calls generateBill', async () => {
    render(
      <PosClientPage
        branches={branches}
        activeBranchId="br-1"
        initialData={initialData}
        staleOrders={[]}
        session={adminSession}
        posDefaultGstPercent={5}
      />
    )
    fireEvent.click(screen.getByText('Table 1'))
    fireEvent.click(screen.getByRole('button', { name: /Generate Bill/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Bill' }))

    await waitFor(() => {
      expect(posActions.generateBill).toHaveBeenCalledTimes(1)
      expect(screen.getByText('Bill generated successfully')).toBeDefined()
    })
  })

  // ── Billed Order Actions (Reopen & Settle Payment) ──
  it('billed order displays "Re-open Order" and "Settle Payment" buttons', () => {
    render(
      <PosClientPage
        branches={branches}
        activeBranchId="br-1"
        initialData={initialData}
        staleOrders={[]}
        session={adminSession}
        posDefaultGstPercent={5}
      />
    )
    fireEvent.click(screen.getByText('Table 2'))
    expect(screen.getByRole('button', { name: /Re-open Order/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /Settle Payment/i })).toBeDefined()
  })

  it('clicking "Re-open Order" calls reopenOrder and refreshes', async () => {
    render(
      <PosClientPage
        branches={branches}
        activeBranchId="br-1"
        initialData={initialData}
        staleOrders={[]}
        session={adminSession}
        posDefaultGstPercent={5}
      />
    )
    fireEvent.click(screen.getByText('Table 2'))
    fireEvent.click(screen.getByRole('button', { name: /Re-open Order/i }))

    await waitFor(() => {
      expect(posActions.reopenOrder).toHaveBeenCalledWith('ord-2')
      expect(screen.getByText('Order reopened')).toBeDefined()
    })
  })

  it('clicking "Settle Payment" opens payment settlement modal', () => {
    render(
      <PosClientPage
        branches={branches}
        activeBranchId="br-1"
        initialData={initialData}
        staleOrders={[]}
        session={adminSession}
        posDefaultGstPercent={5}
      />
    )
    fireEvent.click(screen.getByText('Table 2'))
    fireEvent.click(screen.getByRole('button', { name: /Settle Payment/i }))

    expect(screen.getByText('Record Settlement')).toBeDefined()
    expect(screen.getAllByText('₹189').length).toBeGreaterThanOrEqual(1)
  })

  it('submitting cash payment in Payment Modal calls recordPayment', async () => {
    render(
      <PosClientPage
        branches={branches}
        activeBranchId="br-1"
        initialData={initialData}
        staleOrders={[]}
        session={adminSession}
        posDefaultGstPercent={5}
      />
    )
    fireEvent.click(screen.getByText('Table 2'))
    fireEvent.click(screen.getByRole('button', { name: /Settle Payment/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Complete Payment' }))

    await waitFor(() => {
      expect(posActions.recordPayment).toHaveBeenCalledTimes(1)
      const formData = posActions.recordPayment.mock.calls[0][1] as FormData
      expect(formData.get('orderId')).toBe('ord-2')
      expect(formData.get('method')).toBe('cash')
    })
  })

  // ── Void Order Modal ──
  it('clicking "Void Order" button opens Void Order modal', () => {
    render(
      <PosClientPage
        branches={branches}
        activeBranchId="br-1"
        initialData={initialData}
        staleOrders={[]}
        session={adminSession}
        posDefaultGstPercent={5}
      />
    )
    fireEvent.click(screen.getByText('Table 1'))
    fireEvent.click(screen.getByRole('button', { name: /Void Order/i }))

    expect(screen.getByRole('heading', { name: 'Void Order' })).toBeDefined()
    expect(screen.getByPlaceholderText(/Reason for voiding.../i)).toBeDefined()
  })

  it('submitting Void Order modal with reason calls voidOrder', async () => {
    render(
      <PosClientPage
        branches={branches}
        activeBranchId="br-1"
        initialData={initialData}
        staleOrders={[]}
        session={adminSession}
        posDefaultGstPercent={5}
      />
    )
    fireEvent.click(screen.getByText('Table 1'))
    fireEvent.click(screen.getByRole('button', { name: /Void Order/i }))

    const reasonInput = screen.getByPlaceholderText(/Reason for voiding.../i)
    fireEvent.change(reasonInput, { target: { value: 'Guest left before food served' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Void' }))

    await waitFor(() => {
      expect(posActions.voidOrder).toHaveBeenCalledTimes(1)
      const formData = posActions.voidOrder.mock.calls[0][1] as FormData
      expect(formData.get('orderId')).toBe('ord-1')
      expect(formData.get('reason')).toBe('Guest left before food served')
      expect(screen.getByText('Order voided successfully')).toBeDefined()
    })
  })

  // ── KOT Ticket Status Advance ──
  it('manager/admin can advance KOT status from order panel', async () => {
    render(
      <PosClientPage
        branches={branches}
        activeBranchId="br-1"
        initialData={initialData}
        staleOrders={[]}
        session={adminSession}
        posDefaultGstPercent={5}
      />
    )
    fireEvent.click(screen.getByText('Table 1'))
    expect(screen.getByText('KOT #1')).toBeDefined()

    const advanceBtn = screen.getByRole('button', { name: 'Advance' })
    fireEvent.click(advanceBtn)

    await waitFor(() => {
      expect(posActions.advanceKotStatus).toHaveBeenCalledWith('kot-101')
      expect(screen.getByText('KOT status advanced')).toBeDefined()
    })
  })

  // ── Catalog Quick Add ──
  it('clicking a dish in catalog adds it to the open order', async () => {
    render(
      <PosClientPage
        branches={branches}
        activeBranchId="br-1"
        initialData={initialData}
        staleOrders={[]}
        session={adminSession}
        posDefaultGstPercent={5}
      />
    )
    fireEvent.click(screen.getByText('Table 1'))
    const catalogBtns = screen.getAllByRole('button', { name: /Veg Biryani/i })
    fireEvent.click(catalogBtns[0])

    await waitFor(() => {
      expect(posActions.addOrUpdateOrderItem).toHaveBeenCalledWith(
        'ord-1',
        'm3',
        1,
        190,
        'Veg Biryani',
        undefined,
        undefined
      )
    })
  })
})

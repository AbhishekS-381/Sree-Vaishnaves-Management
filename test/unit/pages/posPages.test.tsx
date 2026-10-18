import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, screen, waitFor } from '@testing-library/react'
import BillingClientPage from '@/app/management/pos/billing/BillingClientPage'
import KitchenClientPage from '@/app/management/pos/kitchen/KitchenClientPage'
import WaiterOrderClientPage from '@/app/management/pos/order/WaiterOrderClientPage'
import type { PosOrder } from '@/app/actions/posTypes'

vi.mock('lucide-react')

const { posActions, navMocks } = vi.hoisted(() => ({
  posActions: {
    recordPayment: vi.fn(),
    generateBill: vi.fn(),
    advanceKotStatus: vi.fn(),
    getKitchenKots: vi.fn(),
    createOrder: vi.fn(),
    addOrUpdateOrderItem: vi.fn(),
    removeOrderItem: vi.fn(),
    updateOrderNote: vi.fn(),
    fireKot: vi.fn(),
  },
  navMocks: {
    push: vi.fn(),
    refresh: vi.fn(),
  },
}))

vi.mock('@/app/actions/pos', () => posActions)

vi.mock('next/navigation', () => ({
  useRouter: () => navMocks,
}))

describe('BillingClientPage Component Tests (Task 10.6, Req 14.5, 14.8)', () => {
  const branches = [{ id: 'b1', name: 'Main Branch' }]
  const session = { userId: 'u_bill', name: 'Cashier Alice', role: 'billing' }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('Running totals strip displays 0 when no payments recorded today (Req 14.8)', () => {
    render(
      <BillingClientPage
        branches={branches}
        activeBranchId="b1"
        billedOrders={[]}
        paidOrders={[]}
        openOrders={[]}
        tableMap={{}}
        session={session}
        posDefaultGstPercent={5}
      />
    )

    expect(screen.getByText('Total Cash Collected')).toBeDefined()
    expect(screen.getByText('Total UPI Collected')).toBeDefined()
    // Cash ₹0, UPI ₹0, Total ₹0, Bills 0
    const zeroAmounts = screen.getAllByText('₹0')
    expect(zeroAmounts.length).toBeGreaterThanOrEqual(3)
  })

  it('Running totals strip correctly computes Cash + UPI from paidOrders (Req 14.8)', () => {
    const paidOrders: PosOrder[] = [
      {
        id: 'pord_1',
        branchId: 'b1',
        orderType: 'dine-in',
        tableId: 't1',
        status: 'paid',
        items: [{ id: 'oi_1', menuItemId: 'm1', nameSnapshot: 'Thali', unitPrice: 200, quantity: 1 }],
        kotCount: 1,
        bill: { subtotal: 200, discount: 0, gst: 10, totalPayable: 210, generatedAt: '2026-10-19T10:00:00Z' },
        payment: { method: 'cash', cashAmount: 210, upiAmount: 0, paidAt: '2026-10-19T10:05:00Z' },
        date: '2026-10-19',
        openedBy: 'u_waiter',
        createdAt: '2026-10-19T09:30:00Z',
        updatedAt: '2026-10-19T10:05:00Z',
      },
      {
        id: 'pord_2',
        branchId: 'b1',
        orderType: 'takeaway',
        takeawayNumber: 'T-1',
        status: 'paid',
        items: [{ id: 'oi_2', menuItemId: 'm2', nameSnapshot: 'Dosa', unitPrice: 100, quantity: 2 }],
        kotCount: 1,
        bill: { subtotal: 200, discount: 20, gst: 9, totalPayable: 189, generatedAt: '2026-10-19T10:10:00Z' },
        payment: { method: 'split', cashAmount: 100, upiAmount: 89, paidAt: '2026-10-19T10:15:00Z' },
        date: '2026-10-19',
        openedBy: 'u_waiter',
        createdAt: '2026-10-19T09:40:00Z',
        updatedAt: '2026-10-19T10:15:00Z',
      },
    ]

    render(
      <BillingClientPage
        branches={branches}
        activeBranchId="b1"
        billedOrders={[]}
        paidOrders={paidOrders}
        openOrders={[]}
        tableMap={{ t1: 'Table 1' }}
        session={session}
        posDefaultGstPercent={5}
      />
    )

    // Total cash = 210 + 100 = 310
    expect(screen.getByText('₹310')).toBeDefined()
    // Total UPI = 0 + 89 = 89
    expect(screen.getByText('₹89')).toBeDefined()
    // Total Revenue = 310 + 89 = 399
    expect(screen.getByText('₹399')).toBeDefined()
    // Settled count = 2
    expect(screen.getByText('2')).toBeDefined()
  })

  it('Billing role can generate bill for an open order (Req 14.5)', async () => {
    posActions.generateBill.mockResolvedValue({ success: true })

    const openOrders: PosOrder[] = [
      {
        id: 'pord_open_1',
        branchId: 'b1',
        orderType: 'dine-in',
        tableId: 't2',
        status: 'open',
        items: [{ id: 'oi_3', menuItemId: 'm1', nameSnapshot: 'Paneer Butter Masala', unitPrice: 250, quantity: 2 }],
        kotCount: 1,
        date: '2026-10-19',
        openedBy: 'u_waiter',
        createdAt: '2026-10-19T11:00:00Z',
        updatedAt: '2026-10-19T11:00:00Z',
      },
    ]

    render(
      <BillingClientPage
        branches={branches}
        activeBranchId="b1"
        billedOrders={[]}
        paidOrders={[]}
        openOrders={openOrders}
        tableMap={{ t2: 'Table 2' }}
        session={session}
        posDefaultGstPercent={5}
      />
    )

    // Find "Bill an Open Order" button
    const openBillBtn = screen.getByText(/Bill an Open Order/)
    fireEvent.click(openBillBtn)

    // Modal opens with Confirm Bill button
    const confirmBtn = screen.getByText('Confirm Bill')
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(posActions.generateBill).toHaveBeenCalledTimes(1)
    })
  })
})

describe('KitchenClientPage Component Tests (Task 10.6, Req 15.4, 15.5, 15.6)', () => {
  const session = { userId: 'u_cook', name: 'Chef Bob', role: 'kitchen' }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('Renders KOT card in active grid without financial data (Req 15.6)', () => {
    const activeKots = [
      {
        id: 'kot_1',
        orderId: 'pord_1',
        kotNumber: 1,
        items: [
          { nameSnapshot: 'Masala Dosa', quantity: 2, note: 'Extra crispy' },
        ],
        status: 'pending',
        firedAt: '2026-10-19T12:00:00Z',
        orderIdentifier: 'Table 4',
        orderType: 'dine-in',
      },
    ]

    const { container } = render(
      <KitchenClientPage
        branchId="b1"
        initialActiveKots={activeKots}
        initialServedKots={[]}
        session={session}
      />
    )

    expect(screen.getByText('Table 4')).toBeDefined()
    expect(screen.getByText('Masala Dosa')).toBeDefined()
    expect(screen.getByText('“Extra crispy”')).toBeDefined()
    expect(screen.getByText('Start Preparing')).toBeDefined()

    // Assert NO financial symbols appear on the kitchen display (Req 15.6)
    expect(container.textContent).not.toContain('₹')
    expect(container.textContent).not.toContain('Subtotal')
    expect(container.textContent).not.toContain('Payable')
  })

  it('Advancing ready KOT to served moves it to Served section immediately (Req 15.5)', async () => {
    posActions.advanceKotStatus.mockResolvedValue({ success: true })

    const activeKots = [
      {
        id: 'kot_2',
        orderId: 'pord_2',
        kotNumber: 2,
        items: [{ nameSnapshot: 'Cold Coffee', quantity: 1 }],
        status: 'ready',
        firedAt: '2026-10-19T12:10:00Z',
        orderIdentifier: 'T-3',
        orderType: 'takeaway',
      },
    ]

    render(
      <KitchenClientPage
        branchId="b1"
        initialActiveKots={activeKots}
        initialServedKots={[]}
        session={session}
      />
    )

    // Button should say "Mark Served"
    const markServedBtn = screen.getByText('Mark Served')
    fireEvent.click(markServedBtn)

    await waitFor(() => {
      expect(posActions.advanceKotStatus).toHaveBeenCalledWith('kot_2')
    })

    // Once served, active grid shows empty state "Kitchen All Clear!"
    await waitFor(() => {
      expect(screen.getByText('Kitchen All Clear!')).toBeDefined()
    })

    // Served counter updates to Served (1)
    expect(screen.getByText(/Served \(1\)/)).toBeDefined()
  })
})

describe('WaiterOrderClientPage Component Tests (Task 10.2, Req 16.5, 16.6, 16.8)', () => {
  const branches = [{ id: 'b1', name: 'Main Branch' }]
  const waiterSession = { userId: 'w1', name: 'Waiter John', role: 'waiter' }

  it('Waiter page does not display bill/payment buttons or cost prices (Req 16.6, 16.8)', () => {
    const orders: PosOrder[] = [
      {
        id: 'ord_w1',
        branchId: 'b1',
        tableId: 'tbl_1',
        orderType: 'dine-in',
        status: 'open',
        items: [{ id: 'i1', menuItemId: 'm1', nameSnapshot: 'Idli', unitPrice: 50, quantity: 2 }],
        kotCount: 0,
        date: '2026-10-19',
        openedBy: 'w1',
        createdAt: '2026-10-19T08:00:00Z',
        updatedAt: '2026-10-19T08:00:00Z',
      },
    ]

    const catalog = [
      { menuItemId: 'm1', name: 'Idli', categoryId: 'c1', effectivePrice: 50, dietary: 'veg' },
    ]

    const { container } = render(
      <WaiterOrderClientPage
        branches={branches}
        activeBranchId="b1"
        initialData={{
          tables: [{ id: 'tbl_1', branchId: 'b1', name: 'T1', isActive: true, createdAt: '', updatedAt: '' }],
          orders,
          kots: [],
          catalog,
          todayIST: '2026-10-19',
        }}
        staleOrders={[]}
        session={waiterSession}
      />
    )

    // Click table T1 to select waiter's order
    fireEvent.click(screen.getByText('T1'))

    // Fire KOT button exists
    expect(screen.getByText(/Fire KOT to Kitchen/)).toBeDefined()

    // Bill generation, payment settlement, and daily summary DO NOT exist
    expect(screen.queryByText(/Generate Bill/)).toBeNull()
    expect(screen.queryByText(/Settle Payment/)).toBeNull()
    expect(screen.queryByText(/Daily Summary/)).toBeNull()
    expect(screen.queryByText(/Void Order/)).toBeNull()

    // Cost price is never rendered
    expect(container.textContent).not.toContain('Cost Price')
  })
})

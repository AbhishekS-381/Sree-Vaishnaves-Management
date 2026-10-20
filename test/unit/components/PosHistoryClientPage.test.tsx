import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import PosHistoryClientPage from '@/app/management/pos/history/PosHistoryClientPage'
import type { PosOrder } from '@/app/actions/posTypes'

vi.mock('lucide-react', () => {
  const MockIcon = () => null
  return {
    __esModule: true,
    ArrowLeft: MockIcon,
    ChevronDown: MockIcon,
    ChevronUp: MockIcon,
    Search: MockIcon,
    Receipt: MockIcon,
    Printer: MockIcon,
    X: MockIcon,
    Check: MockIcon,
    Copy: MockIcon,
    SlidersHorizontal: MockIcon,
    LayoutDashboard: MockIcon,
    LogOut: MockIcon,
  }
})

const { posActions } = vi.hoisted(() => ({
  posActions: {
    getPosOrderHistory: vi.fn(),
  },
}))

vi.mock('@/app/actions/pos', () => posActions)

describe('PosHistoryClientPage Component Tests', () => {
  const branches = [
    { id: 'b1', name: 'Main Branch' },
    { id: 'b2', name: 'Second Branch' },
  ]
  const tableMap = { t1: 'Table 1', t2: 'Table 2' }
  const userMap = { u_admin: 'Abhishek', u_waiter: 'Ravi' }

  const mockPaidOrder: PosOrder = {
    id: 'ord_1',
    branchId: 'b1',
    orderType: 'dine-in',
    tableId: 't1',
    status: 'paid',
    items: [
      { id: 'i1', menuItemId: 'm1', nameSnapshot: 'Masala Dosa', unitPrice: 80, quantity: 2 },
      { id: 'i2', menuItemId: 'm2', nameSnapshot: 'Filter Coffee', unitPrice: 30, quantity: 1 },
    ],
    kotCount: 1,
    bill: { subtotal: 190, discount: 10, gst: 9, totalPayable: 189, generatedAt: '2026-10-19T10:00:00Z' },
    payment: { method: 'cash', cashAmount: 189, upiAmount: 0, paidAt: '2026-10-19T10:05:00Z' },
    date: '2026-10-19',
    openedBy: 'u_waiter',
    createdAt: '2026-10-19T09:30:00Z',
    updatedAt: '2026-10-19T10:05:00Z',
  }

  const mockTakeawayOrder: PosOrder = {
    id: 'ord_2',
    branchId: 'b1',
    orderType: 'takeaway',
    takeawayNumber: 'T-1',
    status: 'paid',
    items: [
      { id: 'i3', menuItemId: 'm3', nameSnapshot: 'Veg Biryani', unitPrice: 150, quantity: 1 },
    ],
    kotCount: 1,
    bill: { subtotal: 150, discount: 0, gst: 8, totalPayable: 158, generatedAt: '2026-10-19T11:00:00Z' },
    payment: { method: 'upi', cashAmount: 0, upiAmount: 158, paidAt: '2026-10-19T11:05:00Z' },
    date: '2026-10-19',
    openedBy: 'u_admin',
    createdAt: '2026-10-19T10:45:00Z',
    updatedAt: '2026-10-19T11:05:00Z',
  }

  const mockVoidOrder: PosOrder = {
    id: 'ord_3',
    branchId: 'b1',
    orderType: 'dine-in',
    tableId: 't2',
    status: 'voided',
    items: [
      { id: 'i4', menuItemId: 'm4', nameSnapshot: 'Paneer Tikka', unitPrice: 200, quantity: 1 },
    ],
    kotCount: 1,
    date: '2026-10-19',
    openedBy: 'u_waiter',
    createdAt: '2026-10-19T11:15:00Z',
    updatedAt: '2026-10-19T11:30:00Z',
    void: { reason: 'Guest cancelled before prep', voidedBy: 'u_admin', voidedAt: '2026-10-19T11:30:00Z' },
  }

  const mockBilledOrder: PosOrder = {
    id: 'ord_4',
    branchId: 'b1',
    orderType: 'dine-in',
    tableId: 't1',
    status: 'billed',
    items: [{ id: 'i5', menuItemId: 'm1', nameSnapshot: 'Rava Dosa', unitPrice: 90, quantity: 1 }],
    kotCount: 1,
    bill: { subtotal: 90, discount: 0, gst: 5, totalPayable: 95, generatedAt: '2026-10-19T12:00:00Z' },
    date: '2026-10-19',
    openedBy: 'u_waiter',
    createdAt: '2026-10-19T11:30:00Z',
    updatedAt: '2026-10-19T12:00:00Z',
  }

  const mockOpenOrder: PosOrder = {
    id: 'ord_5',
    branchId: 'b1',
    orderType: 'dine-in',
    tableId: 't2',
    status: 'open',
    items: [{ id: 'i6', menuItemId: 'm1', nameSnapshot: 'Poori', unitPrice: 60, quantity: 1 }],
    kotCount: 1,
    date: '2026-10-19',
    openedBy: 'u_waiter',
    createdAt: '2026-10-19T12:15:00Z',
    updatedAt: '2026-10-19T12:15:00Z',
  }

  const defaultSummary = {
    totalRevenue: 347,
    billCount: 2,
    avgOrderValue: 174,
    totalVoids: 1,
    totalDiscounts: 10,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    posActions.getPosOrderHistory.mockResolvedValue({
      orders: [mockPaidOrder, mockTakeawayOrder, mockVoidOrder],
      summary: defaultSummary,
    })
  })

  // ── Header & Structure ──
  it('renders page header, title and role badge', () => {
    render(<PosHistoryClientPage branches={branches} tableMap={tableMap} userMap={userMap} />)
    expect(screen.getByText('Order History & Audit')).toBeDefined()
    expect(screen.getByText('Owner / Admin')).toBeDefined()
    expect(screen.getByText(/Query historical orders, revenue aggregates/)).toBeDefined()
  })

  it('renders back button linking to /management/pos', () => {
    const { container } = render(<PosHistoryClientPage branches={branches} tableMap={tableMap} userMap={userMap} />)
    const backLink = container.querySelector('a[href="/management/pos"]')
    expect(backLink).not.toBeNull()
  })

  // ── Filter Controls ──
  it('renders branch dropdown populated with branches', () => {
    render(<PosHistoryClientPage branches={branches} tableMap={tableMap} userMap={userMap} />)
    expect(screen.getByText('Main Branch')).toBeDefined()
    expect(screen.getByText('Second Branch')).toBeDefined()
  })

  it('renders fromDate and toDate inputs defaulting to today', () => {
    const { container } = render(<PosHistoryClientPage branches={branches} tableMap={tableMap} userMap={userMap} />)
    const dateInputs = container.querySelectorAll('input[type="date"]')
    expect(dateInputs.length).toBe(2)
  })

  it('triggers getPosOrderHistory on initial render', async () => {
    render(<PosHistoryClientPage branches={branches} tableMap={tableMap} userMap={userMap} />)
    await waitFor(() => {
      expect(posActions.getPosOrderHistory).toHaveBeenCalledTimes(1)
      expect(posActions.getPosOrderHistory).toHaveBeenCalledWith(
        'b1',
        expect.any(String),
        expect.any(String)
      )
    })
  })

  it('changing branch selects new branch and fetches new history', async () => {
    const { container } = render(<PosHistoryClientPage branches={branches} tableMap={tableMap} userMap={userMap} />)
    const select = container.querySelector('select')!
    fireEvent.change(select, { target: { value: 'b2' } })

    await waitFor(() => {
      expect(posActions.getPosOrderHistory).toHaveBeenCalledWith('b2', expect.any(String), expect.any(String))
    })
  })

  it('changing fromDate triggers fetch', async () => {
    const { container } = render(<PosHistoryClientPage branches={branches} tableMap={tableMap} userMap={userMap} />)
    const dateInputs = container.querySelectorAll('input[type="date"]')
    fireEvent.change(dateInputs[0], { target: { value: '2026-10-01' } })

    await waitFor(() => {
      expect(posActions.getPosOrderHistory).toHaveBeenCalledWith('b1', '2026-10-01', expect.any(String))
    })
  })

  it('changing toDate triggers fetch', async () => {
    const { container } = render(<PosHistoryClientPage branches={branches} tableMap={tableMap} userMap={userMap} />)
    const dateInputs = container.querySelectorAll('input[type="date"]')
    fireEvent.change(dateInputs[1], { target: { value: '2026-10-25' } })

    await waitFor(() => {
      expect(posActions.getPosOrderHistory).toHaveBeenCalledWith('b1', expect.any(String), '2026-10-25')
    })
  })

  it('submitting form triggers fetch manually', async () => {
    render(<PosHistoryClientPage branches={branches} tableMap={tableMap} userMap={userMap} />)
    await waitFor(() => {
      expect(screen.getByText('Filter Records')).toBeDefined()
    })

    const filterBtn = screen.getByText('Filter Records')
    fireEvent.click(filterBtn)

    await waitFor(() => {
      expect(posActions.getPosOrderHistory).toHaveBeenCalledTimes(2)
    })
  })

  // ── Error Handling ──
  it('displays error toast when getPosOrderHistory returns error', async () => {
    posActions.getPosOrderHistory.mockResolvedValueOnce({ error: 'Database timeout' })
    render(<PosHistoryClientPage branches={branches} tableMap={tableMap} userMap={userMap} />)

    await waitFor(() => {
      expect(screen.getByText('Database timeout')).toBeDefined()
    })
  })

  // ── Summary Cards ──
  it('renders summary aggregates accurately from action response', async () => {
    render(<PosHistoryClientPage branches={branches} tableMap={tableMap} userMap={userMap} />)

    await waitFor(() => {
      expect(screen.getByText('₹347')).toBeDefined() // Total Revenue
      expect(screen.getByText('2')).toBeDefined()    // Bills Settled
      expect(screen.getByText('₹174')).toBeDefined() // Avg Order Value
      expect(screen.getByText('₹10')).toBeDefined()  // Total Discounts
      expect(screen.getByText('1')).toBeDefined()    // Orders Voided
    })
  })

  it('renders all summary label titles', async () => {
    render(<PosHistoryClientPage branches={branches} tableMap={tableMap} userMap={userMap} />)

    await waitFor(() => {
      expect(screen.getByText('Total Revenue')).toBeDefined()
      expect(screen.getByText('Bills Settled')).toBeDefined()
      expect(screen.getByText('Avg Order Value')).toBeDefined()
      expect(screen.getByText('Total Discounts')).toBeDefined()
      expect(screen.getByText('Orders Voided')).toBeDefined()
    })
  })

  // ── Orders List & Rows ──
  it('renders count of matching transactions', async () => {
    render(<PosHistoryClientPage branches={branches} tableMap={tableMap} userMap={userMap} />)
    await waitFor(() => {
      expect(screen.getByText(/Matching Transactions \(3\)/)).toBeDefined()
    })
  })

  it('renders dine-in table name using tableMap', async () => {
    render(<PosHistoryClientPage branches={branches} tableMap={tableMap} userMap={userMap} />)
    await waitFor(() => {
      expect(screen.getByText('Table 1')).toBeDefined()
    })
  })

  it('renders takeaway order with takeaway number T-1', async () => {
    render(<PosHistoryClientPage branches={branches} tableMap={tableMap} userMap={userMap} />)
    await waitFor(() => {
      expect(screen.getByText('T-1')).toBeDefined()
    })
  })

  it('renders operator name using userMap', async () => {
    render(<PosHistoryClientPage branches={branches} tableMap={tableMap} userMap={userMap} />)
    await waitFor(() => {
      expect(screen.getAllByText(/Opened By: Ravi/).length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText(/Opened By: Abhishek/)).toBeDefined()
    })
  })

  it('renders fallback user ID when user not in userMap', async () => {
    const unmappedOrder: PosOrder = {
      ...mockPaidOrder,
      id: 'ord_unmapped',
      openedBy: 'u_unknown_staff',
    }
    posActions.getPosOrderHistory.mockResolvedValueOnce({
      orders: [unmappedOrder],
      summary: defaultSummary,
    })

    render(<PosHistoryClientPage branches={branches} tableMap={tableMap} userMap={userMap} />)
    await waitFor(() => {
      expect(screen.getByText(/Opened By: u_unknown_staff/)).toBeDefined()
    })
  })

  it('renders paid status badge with emerald styling', async () => {
    render(<PosHistoryClientPage branches={branches} tableMap={tableMap} userMap={userMap} />)
    await waitFor(() => {
      const paidBadges = screen.getAllByText('paid')
      expect(paidBadges.length).toBeGreaterThanOrEqual(1)
    })
  })

  it('renders voided status badge with red styling', async () => {
    render(<PosHistoryClientPage branches={branches} tableMap={tableMap} userMap={userMap} />)
    await waitFor(() => {
      expect(screen.getByText('voided')).toBeDefined()
    })
  })

  it('renders billed status badge with blue styling', async () => {
    posActions.getPosOrderHistory.mockResolvedValueOnce({
      orders: [mockBilledOrder],
      summary: defaultSummary,
    })
    render(<PosHistoryClientPage branches={branches} tableMap={tableMap} userMap={userMap} />)
    await waitFor(() => {
      expect(screen.getByText('billed')).toBeDefined()
    })
  })

  it('renders open status badge with amber styling', async () => {
    posActions.getPosOrderHistory.mockResolvedValueOnce({
      orders: [mockOpenOrder],
      summary: defaultSummary,
    })
    render(<PosHistoryClientPage branches={branches} tableMap={tableMap} userMap={userMap} />)
    await waitFor(() => {
      expect(screen.getByText('open')).toBeDefined()
    })
  })

  it('renders payment method label for paid orders', async () => {
    render(<PosHistoryClientPage branches={branches} tableMap={tableMap} userMap={userMap} />)
    await waitFor(() => {
      expect(screen.getByText('cash')).toBeDefined()
      expect(screen.getByText('upi')).toBeDefined()
    })
  })

  it('renders "Voided" method label for voided order without payment', async () => {
    render(<PosHistoryClientPage branches={branches} tableMap={tableMap} userMap={userMap} />)
    await waitFor(() => {
      expect(screen.getByText('Voided')).toBeDefined()
    })
  })

  it('renders "Unpaid" method label for billed or open order', async () => {
    posActions.getPosOrderHistory.mockResolvedValueOnce({
      orders: [mockBilledOrder],
      summary: defaultSummary,
    })
    render(<PosHistoryClientPage branches={branches} tableMap={tableMap} userMap={userMap} />)
    await waitFor(() => {
      expect(screen.getByText('Unpaid')).toBeDefined()
    })
  })

  // ── Expanded Breakdown ──
  it('expands order item breakdown when clicking order row', async () => {
    render(<PosHistoryClientPage branches={branches} tableMap={tableMap} userMap={userMap} />)
    await waitFor(() => {
      expect(screen.getByText('Table 1')).toBeDefined()
    })

    // Initially breakdown is hidden
    expect(screen.queryByText('Order Items Breakdown')).toBeNull()

    // Click to expand Table 1
    fireEvent.click(screen.getByText('Table 1'))

    // Breakdown is now visible
    expect(screen.getByText('Order Items Breakdown')).toBeDefined()
    expect(screen.getByText(/Masala Dosa × 2/)).toBeDefined()
    expect(screen.getByText('₹160')).toBeDefined()
    expect(screen.getByText(/Filter Coffee × 1/)).toBeDefined()
    expect(screen.getByText('₹30')).toBeDefined()
  })

  it('collapses order item breakdown on second click', async () => {
    render(<PosHistoryClientPage branches={branches} tableMap={tableMap} userMap={userMap} />)
    await waitFor(() => {
      expect(screen.getByText('Table 1')).toBeDefined()
    })

    fireEvent.click(screen.getByText('Table 1'))
    expect(screen.getByText('Order Items Breakdown')).toBeDefined()

    // Click again to collapse
    fireEvent.click(screen.getByText('Table 1'))
    expect(screen.queryByText('Order Items Breakdown')).toBeNull()
  })

  it('expanded view shows bill details: subtotal, discount, GST, total', async () => {
    render(<PosHistoryClientPage branches={branches} tableMap={tableMap} userMap={userMap} />)
    await waitFor(() => {
      expect(screen.getByText('Table 1')).toBeDefined()
    })

    fireEvent.click(screen.getByText('Table 1'))

    expect(screen.getByText('Subtotal: ₹190')).toBeDefined()
    expect(screen.getByText('Discount: ₹10')).toBeDefined()
    expect(screen.getByText('GST: ₹9')).toBeDefined()
    expect(screen.getByText('Total: ₹189')).toBeDefined()
  })

  it('expanded view shows payment details: method, cash, upi, settled at', async () => {
    render(<PosHistoryClientPage branches={branches} tableMap={tableMap} userMap={userMap} />)
    await waitFor(() => {
      expect(screen.getByText('Table 1')).toBeDefined()
    })

    fireEvent.click(screen.getByText('Table 1'))

    expect(screen.getByText(/Payment Method:/)).toBeDefined()
    expect(screen.getByText('Cash Amount: ₹189')).toBeDefined()
    expect(screen.getByText('UPI Amount: ₹0')).toBeDefined()
    expect(screen.getByText(/Settled At: 2026-10-19/)).toBeDefined()
  })

  it('expanded view shows void details: reason, voided by, timestamp', async () => {
    render(<PosHistoryClientPage branches={branches} tableMap={tableMap} userMap={userMap} />)
    await waitFor(() => {
      expect(screen.getByText('Table 2')).toBeDefined()
    })

    fireEvent.click(screen.getByText('Table 2'))

    expect(screen.getByText('Void Information:')).toBeDefined()
    expect(screen.getByText(/Guest cancelled before prep/)).toBeDefined()
    expect(screen.getByText(/Voided by: Abhishek/)).toBeDefined()
  })

  it('expanded view renders Print Receipt button and opens ReceiptPrintModal', async () => {
    render(<PosHistoryClientPage branches={branches} tableMap={tableMap} userMap={userMap} />)
    await waitFor(() => {
      expect(screen.getByText('Table 1')).toBeDefined()
    })

    fireEvent.click(screen.getByText('Table 1'))
    const printBtn = screen.getByRole('button', { name: /Print Receipt/i })
    expect(printBtn).toBeDefined()
    fireEvent.click(printBtn)

    expect(screen.getByText('Customer Receipt')).toBeDefined()
    expect(screen.getAllByText(/\*\*\* DUPLICATE \/ REPRINT \*\*\*/i).length).toBeGreaterThan(0)
  })

  // ── Empty State ──
  it('renders friendly empty state when 0 orders match search filter', async () => {
    posActions.getPosOrderHistory.mockResolvedValueOnce({
      orders: [],
      summary: { totalRevenue: 0, billCount: 0, avgOrderValue: 0, totalVoids: 0, totalDiscounts: 0 },
    })

    render(<PosHistoryClientPage branches={branches} tableMap={tableMap} userMap={userMap} />)

    await waitFor(() => {
      expect(screen.getByText('No orders found for the selected date range and branch.')).toBeDefined()
      expect(screen.getByText('Try expanding your date range filter.')).toBeDefined()
    })
  })

  // ── Edge Cases ──
  it('handles empty branches array without crashing', () => {
    render(<PosHistoryClientPage branches={[]} tableMap={tableMap} userMap={userMap} />)
    expect(screen.getByText('Order History & Audit')).toBeDefined()
  })

  it('handles order without bill or payment gracefully in expanded view', async () => {
    posActions.getPosOrderHistory.mockResolvedValueOnce({
      orders: [mockOpenOrder],
      summary: defaultSummary,
    })

    render(<PosHistoryClientPage branches={branches} tableMap={tableMap} userMap={userMap} />)
    await waitFor(() => {
      expect(screen.getByText('Table 2')).toBeDefined()
    })

    fireEvent.click(screen.getByText('Table 2'))
    expect(screen.getByText('Order Items Breakdown')).toBeDefined()
    expect(screen.queryByText(/Subtotal:/)).toBeNull()
    expect(screen.queryByText(/Payment Method:/)).toBeNull()
  })

  it('handles split payment order in expanded view', async () => {
    const splitOrder: PosOrder = {
      ...mockPaidOrder,
      id: 'ord_split',
      payment: { method: 'split', cashAmount: 100, upiAmount: 89, paidAt: '2026-10-19T10:05:00Z' },
    }
    posActions.getPosOrderHistory.mockResolvedValueOnce({
      orders: [splitOrder],
      summary: defaultSummary,
    })

    render(<PosHistoryClientPage branches={branches} tableMap={tableMap} userMap={userMap} />)
    await waitFor(() => {
      expect(screen.getByText('Table 1')).toBeDefined()
    })

    fireEvent.click(screen.getByText('Table 1'))
    expect(screen.getAllByText('split').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Cash Amount: ₹100')).toBeDefined()
    expect(screen.getByText('UPI Amount: ₹89')).toBeDefined()
  })

  it('renders takeaway order with TBL vs TKW badge', async () => {
    render(<PosHistoryClientPage branches={branches} tableMap={tableMap} userMap={userMap} />)
    await waitFor(() => {
      expect(screen.getAllByText('TBL').length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText('TKW')).toBeDefined()
    })
  })
})

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import WaiterOrderClientPage from '@/app/management/pos/order/WaiterOrderClientPage'
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
  createOrder: vi.fn(),
  addOrUpdateOrderItem: vi.fn(),
  removeOrderItem: vi.fn(),
  updateOrderNote: vi.fn(),
  fireKot: vi.fn(),
}))

describe('WaiterOrderClientPage Component Tests', () => {
  const waiterSession = {
    userId: 'user-waiter-1',
    name: 'Ravi Waiter',
    role: 'waiter',
    isGlobalAdmin: false,
  }

  const managerSession = {
    userId: 'user-manager',
    name: 'Suresh Manager',
    role: 'manager',
    isGlobalAdmin: false,
  }

  const sampleTables: PosTable[] = [
    { id: 'tbl-1', branchId: 'br-1', name: 'Table 1', capacity: 4, isActive: true, createdAt: '2026-10-19T00:00:00Z', updatedAt: '2026-10-19T00:00:00Z' },
    { id: 'tbl-2', branchId: 'br-1', name: 'Table 2', capacity: 2, isActive: true, createdAt: '2026-10-19T00:00:00Z', updatedAt: '2026-10-19T00:00:00Z' },
    { id: 'tbl-3', branchId: 'br-1', name: 'Table 3', capacity: 6, isActive: true, createdAt: '2026-10-19T00:00:00Z', updatedAt: '2026-10-19T00:00:00Z' },
  ]

  const sampleOrders: PosOrder[] = [
    // Table 1 owned by Ravi (waiter-1)
    {
      id: 'ord-1',
      branchId: 'br-1',
      tableId: 'tbl-1',
      orderType: 'dine-in',
      status: 'open',
      openedAt: '2026-10-19T10:00:00.000Z',
      openedBy: 'user-waiter-1',
      openedByUserId: 'user-waiter-1',
      covers: 3,
      note: 'Rush order',
      items: [
        { id: 'item-1', menuItemId: 'm1', nameSnapshot: 'Paneer Tikka', quantity: 2, unitPrice: 200, note: 'Spicy' },
        { id: 'item-2', menuItemId: 'm2', nameSnapshot: 'Garlic Naan', quantity: 3, unitPrice: 40 },
      ],
    },
    // Table 2 owned by another waiter (waiter-2)
    {
      id: 'ord-2',
      branchId: 'br-1',
      tableId: 'tbl-2',
      orderType: 'dine-in',
      status: 'open',
      openedAt: '2026-10-19T10:05:00.000Z',
      openedBy: 'user-waiter-2',
      openedByUserId: 'user-waiter-2',
      covers: 2,
      items: [
        { id: 'item-3', menuItemId: 'm3', nameSnapshot: 'Veg Biryani', quantity: 1, unitPrice: 180 },
      ],
    },
    // Takeaway owned by Ravi (waiter-1)
    {
      id: 'ord-tkw-1',
      branchId: 'br-1',
      orderType: 'takeaway',
      takeawayNumber: 'T-1',
      status: 'open',
      openedAt: '2026-10-19T10:10:00.000Z',
      openedBy: 'user-waiter-1',
      openedByUserId: 'user-waiter-1',
      items: [
        { id: 'item-4', menuItemId: 'm4', nameSnapshot: 'Masala Dosa', quantity: 2, unitPrice: 90 },
      ],
    },
  ]

  const sampleKots: PosKot[] = [
    {
      id: 'kot-1',
      orderId: 'ord-1',
      kotNumber: 1,
      items: [
        { menuItemId: 'm1', nameSnapshot: 'Paneer Tikka', quantity: 2 },
      ],
      status: 'preparing',
      firedAt: '2026-10-19T10:02:00.000Z',
    },
  ]

  const sampleCatalog: CatalogItem[] = [
    { menuItemId: 'm1', name: 'Paneer Tikka', effectivePrice: 200, categoryId: 'Starters', isAvailable: true },
    { menuItemId: 'm2', name: 'Garlic Naan', effectivePrice: 40, categoryId: 'Breads', isAvailable: true },
    { menuItemId: 'm3', name: 'Veg Biryani', effectivePrice: 180, categoryId: 'Mains', isAvailable: true },
    { menuItemId: 'm4', name: 'Masala Dosa', effectivePrice: 90, categoryId: 'South Indian', isAvailable: true },
    { menuItemId: 'm5', name: 'Mango Lassi', effectivePrice: 70, categoryId: 'Beverages', isAvailable: true },
  ]

  const initialData = {
    tables: sampleTables,
    orders: sampleOrders,
    kots: sampleKots,
    catalog: sampleCatalog,
    todayIST: '2026-10-19',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    posActions.createOrder.mockResolvedValue({ success: true, orderId: 'ord-new' })
    posActions.addOrUpdateOrderItem.mockResolvedValue({ success: true })
    posActions.removeOrderItem.mockResolvedValue({ success: true })
    posActions.updateOrderNote.mockResolvedValue({ success: true })
    posActions.fireKot.mockResolvedValue({ success: true, kotNumber: 2 })
  })

  // ── Header & Context ──
  it('renders Waiter Order Station title and Active Service badge', () => {
    render(
      <WaiterOrderClientPage
        activeBranchId="br-1"
        initialData={initialData}
        staleOrders={[]}
        session={waiterSession}
      />
    )
    expect(screen.getByText('Waiter Order Station')).toBeDefined()
    expect(screen.getByText('Active Service')).toBeDefined()
  })

  it('renders waiter logged in name, role, and today date', () => {
    render(
      <WaiterOrderClientPage
        activeBranchId="br-1"
        initialData={initialData}
        staleOrders={[]}
        session={waiterSession}
      />
    )
    expect(screen.getByText(/Logged in as: Ravi Waiter \(waiter\)/)).toBeDefined()
    expect(screen.getByText(/2026-10-19/)).toBeDefined()
  })

  it('renders "New Takeaway Order" button in header', () => {
    render(
      <WaiterOrderClientPage
        activeBranchId="br-1"
        initialData={initialData}
        staleOrders={[]}
        session={waiterSession}
      />
    )
    expect(screen.getByText('New Takeaway Order')).toBeDefined()
  })

  it('renders stale orders warning banner and allows dismissal', () => {
    const staleOrders = [{ ...sampleOrders[0], tableName: 'Table 1' }]
    render(
      <WaiterOrderClientPage
        activeBranchId="br-1"
        initialData={initialData}
        staleOrders={staleOrders}
        session={waiterSession}
      />
    )
    expect(screen.getByText(/Unclosed orders exist from previous day service/i)).toBeDefined()
    fireEvent.click(screen.getByText('Dismiss'))
    expect(screen.queryByText(/Unclosed orders exist from previous day service/i)).toBeNull()
  })

  // ── Table Grid & Ownership Scoping ──
  it('renders all tables in the grid', () => {
    render(
      <WaiterOrderClientPage
        activeBranchId="br-1"
        initialData={initialData}
        staleOrders={[]}
        session={waiterSession}
      />
    )
    expect(screen.getByText('Table 1')).toBeDefined()
    expect(screen.getByText('Table 2')).toBeDefined()
    expect(screen.getByText('Table 3')).toBeDefined()
  })

  it('renders table status indicators (Available, My Order, Occupied Other)', () => {
    render(
      <WaiterOrderClientPage
        activeBranchId="br-1"
        initialData={initialData}
        staleOrders={[]}
        session={waiterSession}
      />
    )
    // Table 1 is My Order
    expect(screen.getByText(/2 items • 3 covers/)).toBeDefined()
    // Table 2 is Occupied Other
    expect(screen.getByText('Occupied (Other)')).toBeDefined()
    // Table 3 is Available
    expect(screen.getAllByText('Available').length).toBeGreaterThanOrEqual(1)
  })

  it('clicking an occupied table owned by another server blocks access and shows error toast', () => {
    render(
      <WaiterOrderClientPage
        activeBranchId="br-1"
        initialData={initialData}
        staleOrders={[]}
        session={waiterSession}
      />
    )
    fireEvent.click(screen.getByText('Table 2'))
    expect(screen.getByText('This table has an order opened by another server.')).toBeDefined()
    // Right panel remains "Select a Table"
    expect(screen.getByText('Select a Table')).toBeDefined()
  })

  it('manager can access occupied tables opened by any waiter', () => {
    render(
      <WaiterOrderClientPage
        activeBranchId="br-1"
        initialData={initialData}
        staleOrders={[]}
        session={managerSession}
      />
    )
    // Manager clicks Table 2 (opened by waiter-2)
    fireEvent.click(screen.getByText('Table 2'))
    // Should open Table 2 in right panel without error!
    expect(screen.getByRole('heading', { name: /Table 2/i })).toBeDefined()
    expect(screen.getAllByText('Veg Biryani').length).toBeGreaterThanOrEqual(1)
  })

  it('clicking available table opens New Order modal for dine-in', () => {
    render(
      <WaiterOrderClientPage
        activeBranchId="br-1"
        initialData={initialData}
        staleOrders={[]}
        session={waiterSession}
      />
    )
    fireEvent.click(screen.getByText('Table 3'))
    expect(screen.getByText('Open Dine-In Order')).toBeDefined()
    expect(screen.getByText('Guests / Covers')).toBeDefined()
  })

  // ── New Order Modal Submission ──
  it('submitting New Dine-In Order modal calls createOrder with tableId and covers', async () => {
    render(
      <WaiterOrderClientPage
        activeBranchId="br-1"
        initialData={initialData}
        staleOrders={[]}
        session={waiterSession}
      />
    )
    fireEvent.click(screen.getByText('Table 3'))
    const coversInput = screen.getByLabelText(/Guests \/ Covers/i)
    fireEvent.change(coversInput, { target: { value: '4' } })
    fireEvent.click(screen.getByRole('button', { name: 'Start Order' }))

    await waitFor(() => {
      expect(posActions.createOrder).toHaveBeenCalledTimes(1)
      const formData = posActions.createOrder.mock.calls[0][1] as FormData
      expect(formData.get('orderType')).toBe('dine-in')
      expect(formData.get('branchId')).toBe('br-1')
      expect(formData.get('tableId')).toBe('tbl-3')
      expect(formData.get('covers')).toBe('4')
      expect(screen.getByText('Order opened')).toBeDefined()
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  it('clicking "New Takeaway Order" opens takeaway modal without covers input', () => {
    render(
      <WaiterOrderClientPage
        activeBranchId="br-1"
        initialData={initialData}
        staleOrders={[]}
        session={waiterSession}
      />
    )
    fireEvent.click(screen.getByText('New Takeaway Order'))
    expect(screen.getByText('Open Takeaway Order')).toBeDefined()
    expect(screen.queryByLabelText(/Guests \/ Covers/i)).toBeNull()
  })

  it('submitting takeaway modal calls createOrder with orderType=takeaway', async () => {
    render(
      <WaiterOrderClientPage
        activeBranchId="br-1"
        initialData={initialData}
        staleOrders={[]}
        session={waiterSession}
      />
    )
    fireEvent.click(screen.getByText('New Takeaway Order'))
    const noteInput = screen.getByLabelText(/Optional Note/i)
    fireEvent.change(noteInput, { target: { value: 'Pack separately' } })
    fireEvent.click(screen.getByRole('button', { name: 'Start Order' }))

    await waitFor(() => {
      expect(posActions.createOrder).toHaveBeenCalledTimes(1)
      const formData = posActions.createOrder.mock.calls[0][1] as FormData
      expect(formData.get('orderType')).toBe('takeaway')
      expect(formData.get('note')).toBe('Pack separately')
      expect(formData.get('tableId')).toBeNull()
    })
  })

  it('cancel button in New Order modal closes modal without calling createOrder', () => {
    render(
      <WaiterOrderClientPage
        activeBranchId="br-1"
        initialData={initialData}
        staleOrders={[]}
        session={waiterSession}
      />
    )
    fireEvent.click(screen.getByText('New Takeaway Order'))
    expect(screen.getByText('Open Takeaway Order')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByText('Open Takeaway Order')).toBeNull()
    expect(posActions.createOrder).not.toHaveBeenCalled()
  })

  // ── Takeaways List & Selection ──
  it('renders My Active Takeaways section with owned orders', () => {
    render(
      <WaiterOrderClientPage
        activeBranchId="br-1"
        initialData={initialData}
        staleOrders={[]}
        session={waiterSession}
      />
    )
    expect(screen.getByText('My Active Takeaways (1)')).toBeDefined()
    expect(screen.getByText(/T-1 • 1 items/)).toBeDefined()
  })

  it('clicking takeaway card selects it in the right order panel', () => {
    render(
      <WaiterOrderClientPage
        activeBranchId="br-1"
        initialData={initialData}
        staleOrders={[]}
        session={waiterSession}
      />
    )
    fireEvent.click(screen.getByText(/T-1 • 1 items/))
    expect(screen.getByRole('heading', { name: /T-1/i })).toBeDefined()
    expect(screen.getAllByText('Masala Dosa').length).toBeGreaterThanOrEqual(1)
  })

  // ── Right Column: Selected Order Panel ──
  it('clicking own occupied table opens order panel with items and notes', () => {
    render(
      <WaiterOrderClientPage
        activeBranchId="br-1"
        initialData={initialData}
        staleOrders={[]}
        session={waiterSession}
      />
    )
    fireEvent.click(screen.getByText('Table 1'))
    expect(screen.getByRole('heading', { name: /Table 1/i })).toBeDefined()
    expect(screen.getAllByText('Paneer Tikka').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Garlic Naan').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('“Spicy”')).toBeDefined()
  })

  it('closing order panel clears selection', () => {
    render(
      <WaiterOrderClientPage
        activeBranchId="br-1"
        initialData={initialData}
        staleOrders={[]}
        session={waiterSession}
      />
    )
    fireEvent.click(screen.getByText('Table 1'))
    expect(screen.getByRole('heading', { name: /Table 1/i })).toBeDefined()

    // Click close button
    fireEvent.click(screen.getByLabelText('Close Order Panel'))
    expect(screen.getByText('Select a Table')).toBeDefined()
  })

  // ── Financial Isolation for Waiters ──
  it('strictly ensures NO billing buttons, payment buttons, or void controls appear for waiter', () => {
    render(
      <WaiterOrderClientPage
        activeBranchId="br-1"
        initialData={initialData}
        staleOrders={[]}
        session={waiterSession}
      />
    )
    fireEvent.click(screen.getByText('Table 1'))
    expect(screen.queryByText(/Generate Bill/i)).toBeNull()
    expect(screen.queryByText(/Settle/i)).toBeNull()
    expect(screen.queryByText(/Collect Payment/i)).toBeNull()
    expect(screen.queryByText(/Void Order/i)).toBeNull()
    expect(screen.queryByText(/Reopen/i)).toBeNull()
  })

  // ── Item Quantity Modifications ──
  it('clicking + button increments item quantity', async () => {
    render(
      <WaiterOrderClientPage
        activeBranchId="br-1"
        initialData={initialData}
        staleOrders={[]}
        session={waiterSession}
      />
    )
    fireEvent.click(screen.getByText('Table 1'))
    const plusButtons = screen.getAllByRole('button', { name: '+' })
    // Click plus on Paneer Tikka (qty 2 -> 3)
    fireEvent.click(plusButtons[0])

    await waitFor(() => {
      expect(posActions.addOrUpdateOrderItem).toHaveBeenCalledWith(
        'ord-1',
        'm1',
        3,
        200,
        'Paneer Tikka',
        undefined
      )
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  it('clicking - button decrements item quantity when quantity > 1', async () => {
    render(
      <WaiterOrderClientPage
        activeBranchId="br-1"
        initialData={initialData}
        staleOrders={[]}
        session={waiterSession}
      />
    )
    fireEvent.click(screen.getByText('Table 1'))
    const minusButtons = screen.getAllByRole('button', { name: '-' })
    // Click minus on Paneer Tikka (qty 2 -> 1)
    fireEvent.click(minusButtons[0])

    await waitFor(() => {
      expect(posActions.addOrUpdateOrderItem).toHaveBeenCalledWith(
        'ord-1',
        'm1',
        1,
        200,
        'Paneer Tikka',
        undefined
      )
    })
  })


  it('calls removeOrderItem when decrementing item with quantity 1', async () => {
    const singleItemOrder: PosOrder = {
      id: 'ord-single',
      branchId: 'br-1',
      tableId: 'tbl-1',
      orderType: 'dine-in',
      status: 'open',
      openedAt: '2026-10-19T10:00:00Z',
      openedBy: 'user-waiter-1',
      openedByUserId: 'user-waiter-1',
      items: [{ id: 'it-only', menuItemId: 'm1', nameSnapshot: 'Paneer Tikka', quantity: 1, unitPrice: 200 }],
    }
    render(
      <WaiterOrderClientPage
        activeBranchId="br-1"
        initialData={{ ...initialData, orders: [singleItemOrder] }}
        staleOrders={[]}
        session={waiterSession}
      />
    )
    fireEvent.click(screen.getByText('Table 1'))
    fireEvent.click(screen.getByRole('button', { name: '-' }))

    await waitFor(() => {
      expect(posActions.removeOrderItem).toHaveBeenCalledWith('ord-single', 'it-only')
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  // ── Item Kitchen Note Modal ──
  it('clicking note tag icon opens item note modal', () => {
    render(
      <WaiterOrderClientPage
        activeBranchId="br-1"
        initialData={initialData}
        staleOrders={[]}
        session={waiterSession}
      />
    )
    fireEvent.click(screen.getByText('Table 1'))
    const tagButtons = screen.getAllByTitle('Add/edit item kitchen note')
    fireEvent.click(tagButtons[0])

    expect(screen.getByText(/Item Kitchen Note \(Paneer Tikka\)/)).toBeDefined()
    expect(screen.getByPlaceholderText(/e.g. extra spicy, no onion, less oil/i)).toBeDefined()
  })

  it('saving note in item note modal calls addOrUpdateOrderItem with note text', async () => {
    render(
      <WaiterOrderClientPage
        activeBranchId="br-1"
        initialData={initialData}
        staleOrders={[]}
        session={waiterSession}
      />
    )
    fireEvent.click(screen.getByText('Table 1'))
    const tagButtons = screen.getAllByTitle('Add/edit item kitchen note')
    fireEvent.click(tagButtons[0])

    const input = screen.getByPlaceholderText(/e.g. extra spicy, no onion, less oil/i)
    fireEvent.change(input, { target: { value: 'Well done crispy' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save Note' }))

    await waitFor(() => {
      expect(posActions.addOrUpdateOrderItem).toHaveBeenCalledWith(
        'ord-1',
        'm1',
        2,
        200,
        'Paneer Tikka',
        undefined,
        'Well done crispy'
      )
      expect(screen.getByText('Item note saved')).toBeDefined()
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  // ── Fire KOT to Kitchen ──
  it('enables "Fire KOT to Kitchen" when order has unfired items', () => {
    render(
      <WaiterOrderClientPage
        activeBranchId="br-1"
        initialData={initialData}
        staleOrders={[]}
        session={waiterSession}
      />
    )
    fireEvent.click(screen.getByText('Table 1'))
    // Garlic Naan (3) is not in KOT-1 (which only has Paneer Tikka (2))
    const fireBtn = screen.getByRole('button', { name: /Fire KOT to Kitchen/i }) as HTMLButtonElement
    expect(fireBtn.disabled).toBe(false)
  })

  it('shows "Kitchen Up to Date" disabled button when all items have been fired', () => {
    const allFiredKots: PosKot[] = [
      {
        id: 'kot-all',
        orderId: 'ord-1',
        kotNumber: 1,
        items: [
          { menuItemId: 'm1', nameSnapshot: 'Paneer Tikka', quantity: 2 },
          { menuItemId: 'm2', nameSnapshot: 'Garlic Naan', quantity: 3 },
        ],
        status: 'preparing',
        firedAt: '2026-10-19T10:02:00.000Z',
      },
    ]
    render(
      <WaiterOrderClientPage
        activeBranchId="br-1"
        initialData={{ ...initialData, kots: allFiredKots }}
        staleOrders={[]}
        session={waiterSession}
      />
    )
    fireEvent.click(screen.getByText('Table 1'))
    const upToDateBtn = screen.getByRole('button', { name: /Kitchen Up to Date/i }) as HTMLButtonElement
    expect(upToDateBtn.disabled).toBe(true)
  })

  it('clicking "Fire KOT to Kitchen" calls fireKot and shows success toast', async () => {
    render(
      <WaiterOrderClientPage
        activeBranchId="br-1"
        initialData={initialData}
        staleOrders={[]}
        session={waiterSession}
      />
    )
    fireEvent.click(screen.getByText('Table 1'))
    fireEvent.click(screen.getByRole('button', { name: /Fire KOT to Kitchen/i }))

    await waitFor(() => {
      expect(posActions.fireKot).toHaveBeenCalledWith('ord-1')
      expect(screen.getByText('KOT fired to kitchen')).toBeDefined()
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  it('displays error toast if fireKot fails', async () => {
    posActions.fireKot.mockResolvedValueOnce({ error: 'Cannot fire empty KOT' })
    render(
      <WaiterOrderClientPage
        activeBranchId="br-1"
        initialData={initialData}
        staleOrders={[]}
        session={waiterSession}
      />
    )
    fireEvent.click(screen.getByText('Table 1'))
    fireEvent.click(screen.getByRole('button', { name: /Fire KOT to Kitchen/i }))

    await waitFor(() => {
      expect(screen.getByText('Cannot fire empty KOT')).toBeDefined()
    })
  })

  // ── KOT History on Order (Read-only for Waiters) ──
  it('renders KOT ticket badges with status for the selected order', () => {
    render(
      <WaiterOrderClientPage
        activeBranchId="br-1"
        initialData={initialData}
        staleOrders={[]}
        session={waiterSession}
      />
    )
    fireEvent.click(screen.getByText('Table 1'))
    expect(screen.getByText('Kitchen Tickets (1)')).toBeDefined()
    expect(screen.getByText('KOT #1')).toBeDefined()
    expect(screen.getByText('preparing')).toBeDefined()
  })

  it('strictly ensures NO advance buttons exist on KOT tickets in waiter view', () => {
    render(
      <WaiterOrderClientPage
        activeBranchId="br-1"
        initialData={initialData}
        staleOrders={[]}
        session={waiterSession}
      />
    )
    fireEvent.click(screen.getByText('Table 1'))
    expect(screen.queryByText(/Start Preparing/i)).toBeNull()
    expect(screen.queryByText(/Mark Ready/i)).toBeNull()
    expect(screen.queryByText(/Mark Served/i)).toBeNull()
  })

  // ── Menu Catalog Search & Quick Add ──
  it('renders menu catalog with category filter and search input', () => {
    render(
      <WaiterOrderClientPage
        activeBranchId="br-1"
        initialData={initialData}
        staleOrders={[]}
        session={waiterSession}
      />
    )
    fireEvent.click(screen.getByText('Table 1'))
    expect(screen.getByPlaceholderText('Search dishes...')).toBeDefined()
    expect(screen.getByText('Mango Lassi')).toBeDefined()
  })

  it('filtering menu catalog by search query narrows visible dishes', () => {
    render(
      <WaiterOrderClientPage
        activeBranchId="br-1"
        initialData={initialData}
        staleOrders={[]}
        session={waiterSession}
      />
    )
    fireEvent.click(screen.getByText('Table 1'))
    const searchInput = screen.getByPlaceholderText('Search dishes...')
    fireEvent.change(searchInput, { target: { value: 'Lassi' } })

    expect(screen.getByText('Mango Lassi')).toBeDefined()
    expect(screen.queryByText('Veg Biryani')).toBeNull()
  })

  it('clicking a catalog item adds it to the order via addOrUpdateOrderItem', async () => {
    render(
      <WaiterOrderClientPage
        activeBranchId="br-1"
        initialData={initialData}
        staleOrders={[]}
        session={waiterSession}
      />
    )
    fireEvent.click(screen.getByText('Table 1'))
    fireEvent.click(screen.getByText('Mango Lassi'))

    await waitFor(() => {
      expect(posActions.addOrUpdateOrderItem).toHaveBeenCalledWith(
        'ord-1',
        'm5',
        1,
        70,
        'Mango Lassi',
        undefined,
        undefined
      )
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  it('renders friendly empty state when branch has zero dining tables', () => {
    render(
      <WaiterOrderClientPage
        activeBranchId="br-empty"
        initialData={{ ...initialData, tables: [] }}
        staleOrders={[]}
        session={waiterSession}
      />
    )
    expect(screen.getByText('No tables configured for this branch')).toBeDefined()
  })

  it('displays category names instead of category IDs in the category filter dropdown', () => {
    const catalogWithUuids: CatalogItem[] = [
      { menuItemId: 'm1', name: 'Paneer Tikka', effectivePrice: 200, categoryId: 'mcat_starters_id' },
      { menuItemId: 'm5', name: 'Mango Lassi', effectivePrice: 70, categoryId: 'mcat_beverages_id', categoryName: 'Beverages' },
    ]
    const categoryMap = {
      mcat_starters_id: 'Starters & Appetizers',
    }

    render(
      <WaiterOrderClientPage
        activeBranchId="br-1"
        initialData={{ ...initialData, catalog: catalogWithUuids }}
        staleOrders={[]}
        session={waiterSession}
        categoryMap={categoryMap}
      />
    )
    fireEvent.click(screen.getByText('Table 1'))

    // The options should display the human-readable names
    expect(screen.getByRole('option', { name: 'Starters & Appetizers' })).toBeDefined()
    expect(screen.getByRole('option', { name: 'Beverages' })).toBeDefined()
    expect(screen.queryByRole('option', { name: 'mcat_starters_id' })).toBeNull()
  })
})


import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import KitchenClientPage from '@/app/management/pos/kitchen/KitchenClientPage'
import * as posActions from '@/app/actions/pos'

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

vi.mock('@/app/actions/pos', () => ({
  advanceKotStatus: vi.fn(),
  getKitchenKots: vi.fn(),
}))

describe('KitchenClientPage Component Tests', () => {
  const branches = [
    { id: 'br-1', name: 'Main Branch' },
    { id: 'br-2', name: 'Airport Branch' },
  ]

  const staffSession = {
    userId: 'user-kitchen',
    name: 'Chef Gordon',
    role: 'kitchen',
    isGlobalAdmin: false,
  }

  const adminSession = {
    userId: 'user-admin',
    name: 'Admin Owner',
    role: 'admin',
    isGlobalAdmin: true,
  }

  const sampleActiveKots = [
    {
      id: 'kot-101',
      orderId: 'ord-1',
      kotNumber: 1,
      items: [
        { nameSnapshot: 'Paneer Butter Masala', quantity: 2, note: 'Extra spicy' },
        { nameSnapshot: 'Butter Naan', quantity: 4 },
      ],
      status: 'pending',
      firedAt: '2026-10-19T10:30:00.000Z',
      orderIdentifier: 'Table 4',
      orderType: 'dine_in',
    },
    {
      id: 'kot-102',
      orderId: 'ord-2',
      kotNumber: 2,
      items: [{ nameSnapshot: 'Veg Biryani', quantity: 1, note: 'No onions' }],
      status: 'preparing',
      firedAt: '2026-10-19T10:35:00.000Z',
      orderIdentifier: 'T-1',
      orderType: 'takeaway',
    },
    {
      id: 'kot-103',
      orderId: 'ord-3',
      kotNumber: 3,
      items: [{ nameSnapshot: 'Masala Dosa', quantity: 3 }],
      status: 'ready',
      firedAt: '2026-10-19T10:40:00.000Z',
      orderIdentifier: 'Table 7',
      orderType: 'dine_in',
    },
  ]

  const sampleServedKots = [
    {
      id: 'kot-099',
      orderId: 'ord-0',
      kotNumber: 99,
      items: [{ nameSnapshot: 'Cold Coffee', quantity: 2 }],
      status: 'served',
      firedAt: '2026-10-19T09:15:00.000Z',
      orderIdentifier: 'Table 1',
      orderType: 'dine_in',
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    posActions.advanceKotStatus.mockResolvedValue({ success: true })
    posActions.getKitchenKots.mockResolvedValue({ kots: [] })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ── Header & Staff Rendering ──
  it('renders KDS header title and live FIFO badge', () => {
    render(
      <KitchenClientPage
        branches={branches}
        branchId="br-1"
        initialActiveKots={sampleActiveKots}
        initialServedKots={sampleServedKots}
        session={staffSession}
      />
    )
    expect(screen.getByText('Kitchen Display System (KDS)')).toBeDefined()
    expect(screen.getByText('Live FIFO')).toBeDefined()
  })

  it('renders kitchen staff name and role', () => {
    render(
      <KitchenClientPage
        branches={branches}
        branchId="br-1"
        initialActiveKots={sampleActiveKots}
        initialServedKots={sampleServedKots}
        session={staffSession}
      />
    )
    expect(screen.getByText(/Kitchen Staff: Chef Gordon \(kitchen\)/)).toBeDefined()
  })

  it('hides branch selector for non-admin kitchen staff', () => {
    render(
      <KitchenClientPage
        branches={branches}
        branchId="br-1"
        initialActiveKots={sampleActiveKots}
        initialServedKots={sampleServedKots}
        session={staffSession}
      />
    )
    expect(screen.queryByRole('combobox')).toBeNull()
  })

  it('renders branch selector for global admin with multiple branches', () => {
    render(
      <KitchenClientPage
        branches={branches}
        branchId="br-1"
        initialActiveKots={sampleActiveKots}
        initialServedKots={sampleServedKots}
        session={adminSession}
      />
    )
    const select = screen.getByRole('combobox') as HTMLSelectElement
    expect(select).toBeDefined()
    expect(select.value).toBe('br-1')
    expect(screen.getByText('Main Branch')).toBeDefined()
    expect(screen.getByText('Airport Branch')).toBeDefined()
  })

  it('switching branch in selector pushes router navigation', () => {
    render(
      <KitchenClientPage
        branches={branches}
        branchId="br-1"
        initialActiveKots={sampleActiveKots}
        initialServedKots={sampleServedKots}
        session={adminSession}
      />
    )
    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: 'br-2' } })
    expect(mockPush).toHaveBeenCalledWith('/management/pos/kitchen?branch=br-2')
  })

  it('hides branch selector if global admin but only 1 branch exists', () => {
    render(
      <KitchenClientPage
        branches={[{ id: 'br-1', name: 'Sole Branch' }]}
        branchId="br-1"
        initialActiveKots={sampleActiveKots}
        initialServedKots={sampleServedKots}
        session={adminSession}
      />
    )
    expect(screen.queryByRole('combobox')).toBeNull()
  })

  // ── Polling Controls & Timers ──
  it('displays default active polling state indicator (Poll: 30s)', () => {
    render(
      <KitchenClientPage
        branches={branches}
        branchId="br-1"
        initialActiveKots={sampleActiveKots}
        initialServedKots={sampleServedKots}
        session={staffSession}
      />
    )
    expect(screen.getByText('Poll: 30s')).toBeDefined()
  })

  it('toggles polling state between Paused and 30s on click', () => {
    render(
      <KitchenClientPage
        branches={branches}
        branchId="br-1"
        initialActiveKots={sampleActiveKots}
        initialServedKots={sampleServedKots}
        session={staffSession}
      />
    )
    const toggleBtn = screen.getByText('Poll: 30s')
    fireEvent.click(toggleBtn)
    expect(screen.getByText('Poll: Paused')).toBeDefined()

    fireEvent.click(screen.getByText('Poll: Paused'))
    expect(screen.getByText('Poll: 30s')).toBeDefined()
  })

  it('calls getKitchenKots automatically after 30 seconds when polling active', async () => {
    render(
      <KitchenClientPage
        branches={branches}
        branchId="br-1"
        initialActiveKots={sampleActiveKots}
        initialServedKots={sampleServedKots}
        session={staffSession}
      />
    )
    expect(posActions.getKitchenKots).not.toHaveBeenCalled()

    await act(async () => {
      vi.advanceTimersByTime(30000)
    })
    expect(posActions.getKitchenKots).toHaveBeenCalledWith('br-1')
  })

  it('does not poll when polling is paused', async () => {
    render(
      <KitchenClientPage
        branches={branches}
        branchId="br-1"
        initialActiveKots={sampleActiveKots}
        initialServedKots={sampleServedKots}
        session={staffSession}
      />
    )
    fireEvent.click(screen.getByText('Poll: 30s'))
    expect(screen.getByText('Poll: Paused')).toBeDefined()

    await act(async () => {
      vi.advanceTimersByTime(60000)
    })
    expect(posActions.getKitchenKots).not.toHaveBeenCalled()
  })

  // ── Manual Refresh ──
  it('renders manual Refresh button', () => {
    render(
      <KitchenClientPage
        branches={branches}
        branchId="br-1"
        initialActiveKots={sampleActiveKots}
        initialServedKots={sampleServedKots}
        session={staffSession}
      />
    )
    expect(screen.getByText('Refresh')).toBeDefined()
  })

  it('clicking manual Refresh invokes getKitchenKots and displays success toast', async () => {
    posActions.getKitchenKots.mockResolvedValueOnce({ kots: sampleActiveKots })
    render(
      <KitchenClientPage
        branches={branches}
        branchId="br-1"
        initialActiveKots={sampleActiveKots}
        initialServedKots={sampleServedKots}
        session={staffSession}
      />
    )
    fireEvent.click(screen.getByText('Refresh'))
    await waitFor(() => {
      expect(posActions.getKitchenKots).toHaveBeenCalledWith('br-1')
      expect(screen.getByText('Tickets refreshed')).toBeDefined()
    })
  })

  it('displays error toast when manual refresh fails', async () => {
    posActions.getKitchenKots.mockResolvedValueOnce({ error: 'Failed to fetch tickets' })
    render(
      <KitchenClientPage
        branches={branches}
        branchId="br-1"
        initialActiveKots={sampleActiveKots}
        initialServedKots={sampleServedKots}
        session={staffSession}
      />
    )
    fireEvent.click(screen.getByText('Refresh'))
    await waitFor(() => {
      expect(screen.getByText('Failed to fetch tickets')).toBeDefined()
    })
  })

  // ── Empty State ──
  it('renders "Kitchen All Clear!" when active KOTs list is empty', () => {
    render(
      <KitchenClientPage
        branches={branches}
        branchId="br-1"
        initialActiveKots={[]}
        initialServedKots={sampleServedKots}
        session={staffSession}
      />
    )
    expect(screen.getByText('Kitchen All Clear!')).toBeDefined()
    expect(
      screen.getByText(/No active pending or preparing kitchen tickets/i)
    ).toBeDefined()
  })

  // ── Active KOT Card Rendering ──
  it('renders Table / Takeaway identifier for each KOT', () => {
    render(
      <KitchenClientPage
        branches={branches}
        branchId="br-1"
        initialActiveKots={sampleActiveKots}
        initialServedKots={sampleServedKots}
        session={staffSession}
      />
    )
    expect(screen.getByText('Table 4')).toBeDefined()
    expect(screen.getByText('T-1')).toBeDefined()
    expect(screen.getByText('Table 7')).toBeDefined()
  })

  it('renders order type chips (Dine-In vs Takeaway)', () => {
    render(
      <KitchenClientPage
        branches={branches}
        branchId="br-1"
        initialActiveKots={sampleActiveKots}
        initialServedKots={sampleServedKots}
        session={staffSession}
      />
    )
    expect(screen.getAllByText('Dine-In').length).toBe(2)
    expect(screen.getByText('Takeaway')).toBeDefined()
  })

  it('renders KOT ticket numbers', () => {
    render(
      <KitchenClientPage
        branches={branches}
        branchId="br-1"
        initialActiveKots={sampleActiveKots}
        initialServedKots={sampleServedKots}
        session={staffSession}
      />
    )
    expect(screen.getByText('KOT #1')).toBeDefined()
    expect(screen.getByText('KOT #2')).toBeDefined()
    expect(screen.getByText('KOT #3')).toBeDefined()
  })

  it('renders fired timestamp for tickets', () => {
    render(
      <KitchenClientPage
        branches={branches}
        branchId="br-1"
        initialActiveKots={sampleActiveKots}
        initialServedKots={sampleServedKots}
        session={staffSession}
      />
    )
    expect(screen.getAllByText(/Fired at/i).length).toBe(3)
  })

  it('renders item names and quantities on active tickets', () => {
    render(
      <KitchenClientPage
        branches={branches}
        branchId="br-1"
        initialActiveKots={sampleActiveKots}
        initialServedKots={sampleServedKots}
        session={staffSession}
      />
    )
    expect(screen.getByText('Paneer Butter Masala')).toBeDefined()
    expect(screen.getByText('×2')).toBeDefined()
    expect(screen.getByText('Butter Naan')).toBeDefined()
    expect(screen.getByText('×4')).toBeDefined()
    expect(screen.getByText('Veg Biryani')).toBeDefined()
    expect(screen.getByText('×1')).toBeDefined()
    expect(screen.getByText('Masala Dosa')).toBeDefined()
    expect(screen.getByText('×3')).toBeDefined()
  })

  it('renders special cooking instructions / notes when present', () => {
    render(
      <KitchenClientPage
        branches={branches}
        branchId="br-1"
        initialActiveKots={sampleActiveKots}
        initialServedKots={sampleServedKots}
        session={staffSession}
      />
    )
    expect(screen.getByText('“Extra spicy”')).toBeDefined()
    expect(screen.getByText('“No onions”')).toBeDefined()
  })

  it('does not render note quotes when item has no note', () => {
    render(
      <KitchenClientPage
        branches={branches}
        branchId="br-1"
        initialActiveKots={[sampleActiveKots[2]]} // Masala Dosa has no note
        initialServedKots={[]}
        session={staffSession}
      />
    )
    expect(screen.queryByText(/“/)).toBeNull()
  })

  // ── Financial Isolation in KDS ──
  it('strictly ensures NO prices or currency symbols appear anywhere in KDS', () => {
    render(
      <KitchenClientPage
        branches={branches}
        branchId="br-1"
        initialActiveKots={sampleActiveKots}
        initialServedKots={sampleServedKots}
        session={staffSession}
      />
    )
    expect(screen.queryByText(/₹/)).toBeNull()
    expect(screen.queryByText(/Subtotal/i)).toBeNull()
    expect(screen.queryByText(/Total/i)).toBeNull()
    expect(screen.queryByText(/Payment/i)).toBeNull()
  })

  // ── Status Advance Buttons & Transitions ──
  it('renders "Start Preparing" button for pending KOT', () => {
    render(
      <KitchenClientPage
        branches={branches}
        branchId="br-1"
        initialActiveKots={[sampleActiveKots[0]]}
        initialServedKots={[]}
        session={staffSession}
      />
    )
    expect(screen.getByText('Start Preparing')).toBeDefined()
  })

  it('renders "Mark Ready" button for preparing KOT', () => {
    render(
      <KitchenClientPage
        branches={branches}
        branchId="br-1"
        initialActiveKots={[sampleActiveKots[1]]}
        initialServedKots={[]}
        session={staffSession}
      />
    )
    expect(screen.getByText('Mark Ready')).toBeDefined()
  })

  it('renders "Mark Served" button for ready KOT', () => {
    render(
      <KitchenClientPage
        branches={branches}
        branchId="br-1"
        initialActiveKots={[sampleActiveKots[2]]}
        initialServedKots={[]}
        session={staffSession}
      />
    )
    expect(screen.getByText('Mark Served')).toBeDefined()
  })

  it('clicking "Start Preparing" calls advanceKotStatus and updates status to preparing', async () => {
    render(
      <KitchenClientPage
        branches={branches}
        branchId="br-1"
        initialActiveKots={[sampleActiveKots[0]]}
        initialServedKots={[]}
        session={staffSession}
      />
    )
    fireEvent.click(screen.getByText('Start Preparing'))

    await waitFor(() => {
      expect(posActions.advanceKotStatus).toHaveBeenCalledWith('kot-101')
      expect(screen.getByText('Mark Ready')).toBeDefined()
      expect(screen.getByText('preparing')).toBeDefined()
      expect(screen.getByText('Ticket #1 updated')).toBeDefined()
    })
  })

  it('clicking "Mark Ready" calls advanceKotStatus and updates status to ready', async () => {
    render(
      <KitchenClientPage
        branches={branches}
        branchId="br-1"
        initialActiveKots={[sampleActiveKots[1]]}
        initialServedKots={[]}
        session={staffSession}
      />
    )
    fireEvent.click(screen.getByText('Mark Ready'))

    await waitFor(() => {
      expect(posActions.advanceKotStatus).toHaveBeenCalledWith('kot-102')
      expect(screen.getByText('Mark Served')).toBeDefined()
      expect(screen.getByText('ready')).toBeDefined()
      expect(screen.getByText('Ticket #2 updated')).toBeDefined()
    })
  })

  it('clicking "Mark Served" moves ticket from active to served', async () => {
    render(
      <KitchenClientPage
        branches={branches}
        branchId="br-1"
        initialActiveKots={[sampleActiveKots[2]]}
        initialServedKots={[]}
        session={staffSession}
      />
    )
    expect(screen.getByText('Table 7')).toBeDefined()
    fireEvent.click(screen.getByText('Mark Served'))

    await waitFor(() => {
      expect(posActions.advanceKotStatus).toHaveBeenCalledWith('kot-103')
      // Active ticket removed -> shows empty state!
      expect(screen.getByText('Kitchen All Clear!')).toBeDefined()
      expect(screen.getByText('Ticket #3 updated')).toBeDefined()
      // Served count increases from 0 to 1
      expect(screen.getByText('Served (1)')).toBeDefined()
    })
  })

  it('handles advanceKotStatus error by displaying toast without state change', async () => {
    posActions.advanceKotStatus.mockResolvedValueOnce({ error: 'Cannot advance cancelled KOT' })
    render(
      <KitchenClientPage
        branches={branches}
        branchId="br-1"
        initialActiveKots={[sampleActiveKots[0]]}
        initialServedKots={[]}
        session={staffSession}
      />
    )
    fireEvent.click(screen.getByText('Start Preparing'))

    await waitFor(() => {
      expect(posActions.advanceKotStatus).toHaveBeenCalledWith('kot-101')
      expect(screen.getByText('Cannot advance cancelled KOT')).toBeDefined()
      // Still shows "Start Preparing"
      expect(screen.getByText('Start Preparing')).toBeDefined()
    })
  })

  // ── Served Tickets Collapsible Section ──
  it('renders Served button with initial count', () => {
    render(
      <KitchenClientPage
        branches={branches}
        branchId="br-1"
        initialActiveKots={sampleActiveKots}
        initialServedKots={sampleServedKots}
        session={staffSession}
      />
    )
    expect(screen.getByText('Served (1)')).toBeDefined()
  })

  it('served collapsible drawer is closed by default', () => {
    render(
      <KitchenClientPage
        branches={branches}
        branchId="br-1"
        initialActiveKots={sampleActiveKots}
        initialServedKots={sampleServedKots}
        session={staffSession}
      />
    )
    expect(screen.queryByText(/Completed \/ Served Tickets Today/i)).toBeNull()
  })

  it('clicking Served button expands drawer and shows served tickets', () => {
    render(
      <KitchenClientPage
        branches={branches}
        branchId="br-1"
        initialActiveKots={sampleActiveKots}
        initialServedKots={sampleServedKots}
        session={staffSession}
      />
    )
    fireEvent.click(screen.getByText('Served (1)'))
    expect(screen.getByText('Completed / Served Tickets Today (1)')).toBeDefined()
    expect(screen.getByText('Table 1')).toBeDefined()
    expect(screen.getByText('KOT #99')).toBeDefined()
    expect(screen.getByText('2 × Cold Coffee')).toBeDefined()
  })

  it('displays empty message inside served section when servedKots is empty', () => {
    render(
      <KitchenClientPage
        branches={branches}
        branchId="br-1"
        initialActiveKots={sampleActiveKots}
        initialServedKots={[]}
        session={staffSession}
      />
    )
    fireEvent.click(screen.getByText('Served (0)'))
    expect(screen.getByText('No served tickets yet today.')).toBeDefined()
  })

  it('clicking Served button again collapses drawer', () => {
    render(
      <KitchenClientPage
        branches={branches}
        branchId="br-1"
        initialActiveKots={sampleActiveKots}
        initialServedKots={sampleServedKots}
        session={staffSession}
      />
    )
    const servedBtn = screen.getByText('Served (1)')
    fireEvent.click(servedBtn)
    expect(screen.getByText('Completed / Served Tickets Today (1)')).toBeDefined()

    fireEvent.click(servedBtn)
    expect(screen.queryByText('Completed / Served Tickets Today (1)')).toBeNull()
  })

  // ── Polling State Updates ──
  it('updates activeKots list when polling response returns new tickets', async () => {
    render(
      <KitchenClientPage
        branches={branches}
        branchId="br-1"
        initialActiveKots={[sampleActiveKots[0]]}
        initialServedKots={[]}
        session={staffSession}
      />
    )
    expect(screen.queryByText('T-1')).toBeNull()

    posActions.getKitchenKots.mockResolvedValueOnce({
      kots: [sampleActiveKots[0], sampleActiveKots[1]],
    })

    await act(async () => {
      vi.advanceTimersByTime(30000)
    })

    await waitFor(() => {
      expect(screen.getByText('T-1')).toBeDefined()
    })
  })

  it('status chip displays correct text for each ticket', () => {
    render(
      <KitchenClientPage
        branches={branches}
        branchId="br-1"
        initialActiveKots={sampleActiveKots}
        initialServedKots={[]}
        session={staffSession}
      />
    )
    expect(screen.getByText('pending')).toBeDefined()
    expect(screen.getByText('preparing')).toBeDefined()
    expect(screen.getByText('ready')).toBeDefined()
  })

  it('handles multiple items under a single KOT ticket', () => {
    render(
      <KitchenClientPage
        branches={branches}
        branchId="br-1"
        initialActiveKots={[sampleActiveKots[0]]}
        initialServedKots={[]}
        session={staffSession}
      />
    )
    expect(screen.getByText('Paneer Butter Masala')).toBeDefined()
    expect(screen.getByText('Butter Naan')).toBeDefined()
  })

  it('unmounting clears the 30-second polling interval', () => {
    const { unmount } = render(
      <KitchenClientPage
        branches={branches}
        branchId="br-1"
        initialActiveKots={sampleActiveKots}
        initialServedKots={sampleServedKots}
        session={staffSession}
      />
    )
    unmount()
    act(() => {
      vi.advanceTimersByTime(60000)
    })
    expect(posActions.getKitchenKots).not.toHaveBeenCalled()
  })
})

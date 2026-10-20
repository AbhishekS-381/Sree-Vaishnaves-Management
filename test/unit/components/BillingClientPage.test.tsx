import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import BillingClientPage from '@/app/management/pos/billing/BillingClientPage'
import * as posActions from '@/app/actions/pos'
import type { PosOrder } from '@/app/actions/posTypes'

const mockPush = vi.fn()
const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}))

vi.mock('@/app/actions/pos', () => ({
  recordPayment: vi.fn(),
  generateBill: vi.fn(),
}))

vi.mock('@/app/actions/auth', () => ({
  logout: vi.fn(),
}))

describe('BillingClientPage Component Tests', () => {
  const branches = [
    { id: 'br-1', name: 'Main Branch' },
    { id: 'br-2', name: 'Airport Branch' },
  ]

  const cashierSession = {
    userId: 'user-cashier',
    name: 'Suresh Kumar',
    role: 'billing',
    isGlobalAdmin: false,
  }

  const adminSession = {
    userId: 'user-admin',
    name: 'Abhishek Admin',
    role: 'admin',
    isGlobalAdmin: true,
  }

  const tableMap = {
    'tbl-1': 'Table 1',
    'tbl-2': 'Table 2',
    'tbl-3': 'Table 3',
  }

  const sampleBilledOrders: PosOrder[] = [
    {
      id: 'ord-billed-1',
      branchId: 'br-1',
      tableId: 'tbl-1',
      status: 'billed',
      openedAt: '2026-10-19T10:00:00.000Z',
      openedByUserId: 'user-waiter',
      items: [
        { id: 'item-1', menuItemId: 'm1', nameSnapshot: 'Paneer Tikka', quantity: 2, unitPrice: 200 },
        { id: 'item-2', menuItemId: 'm2', nameSnapshot: 'Butter Roti', quantity: 3, unitPrice: 30 },
      ],
      bill: {
        subtotal: 490,
        discount: 40,
        gst: 22,
        totalPayable: 472,
        generatedAt: '2026-10-19T10:45:00.000Z',
        generatedByUserId: 'user-cashier',
      },
    },
    {
      id: 'ord-billed-2',
      branchId: 'br-1',
      takeawayNumber: 'T-5',
      status: 'billed',
      openedAt: '2026-10-19T10:15:00.000Z',
      openedByUserId: 'user-cashier',
      items: [
        { id: 'item-3', menuItemId: 'm3', nameSnapshot: 'Veg Biryani', quantity: 1, unitPrice: 180 },
      ],
      bill: {
        subtotal: 180,
        discount: 0,
        gst: 9,
        totalPayable: 189,
        generatedAt: '2026-10-19T10:50:00.000Z',
        generatedByUserId: 'user-cashier',
      },
    },
  ]

  const samplePaidOrders: PosOrder[] = [
    {
      id: 'ord-paid-1',
      branchId: 'br-1',
      tableId: 'tbl-2',
      status: 'paid',
      openedAt: '2026-10-19T09:00:00.000Z',
      openedByUserId: 'user-waiter',
      items: [{ id: 'item-4', menuItemId: 'm4', nameSnapshot: 'Thali', quantity: 2, unitPrice: 150 }],
      bill: {
        subtotal: 300,
        discount: 0,
        gst: 15,
        totalPayable: 315,
        generatedAt: '2026-10-19T09:40:00.000Z',
        generatedByUserId: 'user-cashier',
      },
      payment: {
        method: 'cash',
        cashAmount: 315,
        upiAmount: 0,
        cashTendered: 500,
        changeDue: 185,
        paidAt: '2026-10-19T09:42:00.000Z',
        recordedByUserId: 'user-cashier',
      },
    },
    {
      id: 'ord-paid-2',
      branchId: 'br-1',
      takeawayNumber: 'T-1',
      status: 'paid',
      openedAt: '2026-10-19T09:10:00.000Z',
      openedByUserId: 'user-cashier',
      items: [{ id: 'item-5', menuItemId: 'm5', nameSnapshot: 'Fried Rice', quantity: 1, unitPrice: 160 }],
      bill: {
        subtotal: 160,
        discount: 0,
        gst: 8,
        totalPayable: 168,
        generatedAt: '2026-10-19T09:30:00.000Z',
        generatedByUserId: 'user-cashier',
      },
      payment: {
        method: 'upi',
        cashAmount: 0,
        upiAmount: 168,
        paidAt: '2026-10-19T09:32:00.000Z',
        recordedByUserId: 'user-cashier',
      },
    },
    {
      id: 'ord-paid-3',
      branchId: 'br-1',
      tableId: 'tbl-3',
      status: 'paid',
      openedAt: '2026-10-19T09:30:00.000Z',
      openedByUserId: 'user-waiter',
      items: [{ id: 'item-6', menuItemId: 'm6', nameSnapshot: 'Pizza', quantity: 2, unitPrice: 250 }],
      bill: {
        subtotal: 500,
        discount: 0,
        gst: 25,
        totalPayable: 525,
        generatedAt: '2026-10-19T10:10:00.000Z',
        generatedByUserId: 'user-cashier',
      },
      payment: {
        method: 'split',
        cashAmount: 300,
        upiAmount: 225,
        cashTendered: 300,
        changeDue: 0,
        paidAt: '2026-10-19T10:12:00.000Z',
        recordedByUserId: 'user-cashier',
      },
    },
  ]

  const sampleOpenOrders: PosOrder[] = [
    {
      id: 'ord-open-1',
      branchId: 'br-1',
      tableId: 'tbl-3',
      status: 'open',
      openedAt: '2026-10-19T11:00:00.000Z',
      openedByUserId: 'user-waiter',
      items: [
        { id: 'item-7', menuItemId: 'm7', nameSnapshot: 'Chole Bhature', quantity: 2, unitPrice: 120 },
      ],
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    posActions.recordPayment.mockResolvedValue({ success: true, changeDue: 28 })
    posActions.generateBill.mockResolvedValue({ success: true })
  })

  // ── Header & Cashier Info ──
  it('renders station title and cashier badge', () => {
    render(
      <BillingClientPage
        branches={branches}
        activeBranchId="br-1"
        billedOrders={sampleBilledOrders}
        paidOrders={samplePaidOrders}
        openOrders={sampleOpenOrders}
        tableMap={tableMap}
        session={cashierSession}
        posDefaultGstPercent={5}
      />
    )
    expect(screen.getByText('Billing & Settlement Station')).toBeDefined()
    expect(screen.getByText('Cashier')).toBeDefined()
  })

  it('renders cashier staff name and role', () => {
    render(
      <BillingClientPage
        branches={branches}
        activeBranchId="br-1"
        billedOrders={sampleBilledOrders}
        paidOrders={samplePaidOrders}
        openOrders={sampleOpenOrders}
        tableMap={tableMap}
        session={cashierSession}
        posDefaultGstPercent={5}
      />
    )
    expect(screen.getByText(/Cashier: Suresh Kumar \(billing\)/)).toBeDefined()
  })

  it('hides branch selector for non-admin cashier', () => {
    render(
      <BillingClientPage
        branches={branches}
        activeBranchId="br-1"
        billedOrders={sampleBilledOrders}
        paidOrders={samplePaidOrders}
        openOrders={sampleOpenOrders}
        tableMap={tableMap}
        session={cashierSession}
        posDefaultGstPercent={5}
      />
    )
    expect(screen.queryByRole('combobox')).toBeNull()
  })

  it('renders branch selector for global admin', () => {
    render(
      <BillingClientPage
        branches={branches}
        activeBranchId="br-1"
        billedOrders={sampleBilledOrders}
        paidOrders={samplePaidOrders}
        openOrders={sampleOpenOrders}
        tableMap={tableMap}
        session={adminSession}
        posDefaultGstPercent={5}
      />
    )
    const select = screen.getByRole('combobox') as HTMLSelectElement
    expect(select).toBeDefined()
    expect(select.value).toBe('br-1')
  })

  it('selecting a branch in admin dropdown navigates router', () => {
    render(
      <BillingClientPage
        branches={branches}
        activeBranchId="br-1"
        billedOrders={sampleBilledOrders}
        paidOrders={samplePaidOrders}
        openOrders={sampleOpenOrders}
        tableMap={tableMap}
        session={adminSession}
        posDefaultGstPercent={5}
      />
    )
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'br-2' } })
    expect(mockPush).toHaveBeenCalledWith('/management/pos/billing?branch=br-2')
  })

  // ── Running Totals Strip (Req 14.8) ──
  it('correctly aggregates and displays Total Cash Collected', () => {
    render(
      <BillingClientPage
        branches={branches}
        activeBranchId="br-1"
        billedOrders={sampleBilledOrders}
        paidOrders={samplePaidOrders}
        openOrders={sampleOpenOrders}
        tableMap={tableMap}
        session={cashierSession}
        posDefaultGstPercent={5}
      />
    )
    // Paid 1 cash (315) + Paid 3 split cash (300) = 615
    expect(screen.getByText('Total Cash Collected')).toBeDefined()
    expect(screen.getByText('₹615')).toBeDefined()
  })

  it('correctly aggregates and displays Total UPI Collected', () => {
    render(
      <BillingClientPage
        branches={branches}
        activeBranchId="br-1"
        billedOrders={sampleBilledOrders}
        paidOrders={samplePaidOrders}
        openOrders={sampleOpenOrders}
        tableMap={tableMap}
        session={cashierSession}
        posDefaultGstPercent={5}
      />
    )
    // Paid 2 upi (168) + Paid 3 split upi (225) = 393
    expect(screen.getByText('Total UPI Collected')).toBeDefined()
    expect(screen.getByText('₹393')).toBeDefined()
  })

  it('correctly displays Total Revenue Today', () => {
    render(
      <BillingClientPage
        branches={branches}
        activeBranchId="br-1"
        billedOrders={sampleBilledOrders}
        paidOrders={samplePaidOrders}
        openOrders={sampleOpenOrders}
        tableMap={tableMap}
        session={cashierSession}
        posDefaultGstPercent={5}
      />
    )
    // 615 + 393 = 1008
    expect(screen.getByText('Total Revenue Today')).toBeDefined()
    expect(screen.getByText('₹1008')).toBeDefined()
  })

  it('displays Bills Settled Today count', () => {
    render(
      <BillingClientPage
        branches={branches}
        activeBranchId="br-1"
        billedOrders={sampleBilledOrders}
        paidOrders={samplePaidOrders}
        openOrders={sampleOpenOrders}
        tableMap={tableMap}
        session={cashierSession}
        posDefaultGstPercent={5}
      />
    )
    expect(screen.getByText('Bills Settled Today')).toBeDefined()
    expect(screen.getByText('3')).toBeDefined()
  })

  it('displays zeroes when paidOrders is empty', () => {
    render(
      <BillingClientPage
        branches={branches}
        activeBranchId="br-1"
        billedOrders={sampleBilledOrders}
        paidOrders={[]}
        openOrders={[]}
        tableMap={tableMap}
        session={cashierSession}
        posDefaultGstPercent={5}
      />
    )
    expect(screen.getAllByText('₹0').length).toBeGreaterThanOrEqual(2)
  })

  // ── Pending Payment Queue (Left Column) ──
  it('renders Pending Payment Queue header with count', () => {
    render(
      <BillingClientPage
        branches={branches}
        activeBranchId="br-1"
        billedOrders={sampleBilledOrders}
        paidOrders={samplePaidOrders}
        openOrders={sampleOpenOrders}
        tableMap={tableMap}
        session={cashierSession}
        posDefaultGstPercent={5}
      />
    )
    expect(screen.getByText('Pending Payment Queue (2)')).toBeDefined()
  })

  it('renders billed order cards with identifiers and totals', () => {
    render(
      <BillingClientPage
        branches={branches}
        activeBranchId="br-1"
        billedOrders={sampleBilledOrders}
        paidOrders={samplePaidOrders}
        openOrders={sampleOpenOrders}
        tableMap={tableMap}
        session={cashierSession}
        posDefaultGstPercent={5}
      />
    )
    expect(screen.getByText('Table 1')).toBeDefined()
    expect(screen.getAllByText('₹472').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('T-5').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('₹189')).toBeDefined()
  })

  it('renders empty queue state when billedOrders is empty', () => {
    render(
      <BillingClientPage
        branches={branches}
        activeBranchId="br-1"
        billedOrders={[]}
        paidOrders={samplePaidOrders}
        openOrders={sampleOpenOrders}
        tableMap={tableMap}
        session={cashierSession}
        posDefaultGstPercent={5}
      />
    )
    expect(screen.getByText('No pending bills waiting for payment.')).toBeDefined()
  })

  it('clicking another billed order switches the active settlement target', () => {
    render(
      <BillingClientPage
        branches={branches}
        activeBranchId="br-1"
        billedOrders={sampleBilledOrders}
        paidOrders={samplePaidOrders}
        openOrders={sampleOpenOrders}
        tableMap={tableMap}
        session={cashierSession}
        posDefaultGstPercent={5}
      />
    )
    // Initially first order (Table 1) is selected
    expect(screen.getByText('Settling: Table 1')).toBeDefined()

    // Click T-5 card heading
    fireEvent.click(screen.getByRole('heading', { name: 'T-5' }))
    expect(screen.getByText('Settling: T-5')).toBeDefined()
  })

  // ── Settled Transactions Today (Left Column) ──
  it('renders Settled Transactions Today list with count', () => {
    render(
      <BillingClientPage
        branches={branches}
        activeBranchId="br-1"
        billedOrders={sampleBilledOrders}
        paidOrders={samplePaidOrders}
        openOrders={sampleOpenOrders}
        tableMap={tableMap}
        session={cashierSession}
        posDefaultGstPercent={5}
      />
    )
    expect(screen.getByText('Settled Transactions Today (3)')).toBeDefined()
    expect(screen.getByText('Table 2')).toBeDefined()
    expect(screen.getByText('T-1')).toBeDefined()
  })

  it('displays split breakdown inside settled transaction card', () => {
    render(
      <BillingClientPage
        branches={branches}
        activeBranchId="br-1"
        billedOrders={sampleBilledOrders}
        paidOrders={samplePaidOrders}
        openOrders={sampleOpenOrders}
        tableMap={tableMap}
        session={cashierSession}
        posDefaultGstPercent={5}
      />
    )
    expect(screen.getByText(/Cash ₹300, UPI ₹225/)).toBeDefined()
  })

  it('displays empty message when paidOrders is empty', () => {
    render(
      <BillingClientPage
        branches={branches}
        activeBranchId="br-1"
        billedOrders={sampleBilledOrders}
        paidOrders={[]}
        openOrders={sampleOpenOrders}
        tableMap={tableMap}
        session={cashierSession}
        posDefaultGstPercent={5}
      />
    )
    expect(screen.getByText('No transactions settled yet today.')).toBeDefined()
  })

  // ── Right Column: Selected Order & Breakdown ──
  it('renders selected order line items and bill summary', () => {
    render(
      <BillingClientPage
        branches={branches}
        activeBranchId="br-1"
        billedOrders={sampleBilledOrders}
        paidOrders={samplePaidOrders}
        openOrders={sampleOpenOrders}
        tableMap={tableMap}
        session={cashierSession}
        posDefaultGstPercent={5}
      />
    )
    expect(screen.getByText('Paneer Tikka')).toBeDefined()
    expect(screen.getByText('Butter Roti')).toBeDefined()
    expect(screen.getByText('Subtotal:')).toBeDefined()
    expect(screen.getByText('₹490')).toBeDefined()
    expect(screen.getByText('Discount:')).toBeDefined()
    expect(screen.getByText('-₹40')).toBeDefined()
    expect(screen.getByText('GST:')).toBeDefined()
    expect(screen.getByText('+₹22')).toBeDefined()
  })

  it('displays placeholder when no order is selected', () => {
    render(
      <BillingClientPage
        branches={branches}
        activeBranchId="br-1"
        billedOrders={[]}
        paidOrders={samplePaidOrders}
        openOrders={sampleOpenOrders}
        tableMap={tableMap}
        session={cashierSession}
        posDefaultGstPercent={5}
      />
    )
    expect(screen.getByText('Select an Order from Queue')).toBeDefined()
  })

  // ── Payment Form & Methods ──
  it('renders payment method options: CASH, UPI, SPLIT', () => {
    render(
      <BillingClientPage
        branches={branches}
        activeBranchId="br-1"
        billedOrders={sampleBilledOrders}
        paidOrders={samplePaidOrders}
        openOrders={sampleOpenOrders}
        tableMap={tableMap}
        session={cashierSession}
        posDefaultGstPercent={5}
      />
    )
    expect(screen.getByRole('button', { name: 'cash' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'upi' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'split' })).toBeDefined()
  })

  it('cash method renders cash tendered input with pre-filled exact total', () => {
    render(
      <BillingClientPage
        branches={branches}
        activeBranchId="br-1"
        billedOrders={sampleBilledOrders}
        paidOrders={samplePaidOrders}
        openOrders={sampleOpenOrders}
        tableMap={tableMap}
        session={cashierSession}
        posDefaultGstPercent={5}
      />
    )
    const input = screen.getByLabelText(/Cash Tendered from Customer/i) as HTMLInputElement
    expect(input.value).toBe('472')
    expect(screen.getByText('Change Due to Customer: ₹0')).toBeDefined()
  })

  it('changing cash tendered dynamically calculates change due', () => {
    render(
      <BillingClientPage
        branches={branches}
        activeBranchId="br-1"
        billedOrders={sampleBilledOrders}
        paidOrders={samplePaidOrders}
        openOrders={sampleOpenOrders}
        tableMap={tableMap}
        session={cashierSession}
        posDefaultGstPercent={5}
      />
    )
    const input = screen.getByLabelText(/Cash Tendered from Customer/i)
    fireEvent.change(input, { target: { value: '500' } })
    // 500 - 472 = 28
    expect(screen.getByText('Change Due to Customer: ₹28')).toBeDefined()
  })

  it('switching to UPI hides cash tendered input', () => {
    render(
      <BillingClientPage
        branches={branches}
        activeBranchId="br-1"
        billedOrders={sampleBilledOrders}
        paidOrders={samplePaidOrders}
        openOrders={sampleOpenOrders}
        tableMap={tableMap}
        session={cashierSession}
        posDefaultGstPercent={5}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'upi' }))
    expect(screen.queryByLabelText(/Cash Tendered from Customer/i)).toBeNull()
  })

  it('switching to SPLIT renders Cash Part and UPI Part inputs', () => {
    render(
      <BillingClientPage
        branches={branches}
        activeBranchId="br-1"
        billedOrders={sampleBilledOrders}
        paidOrders={samplePaidOrders}
        openOrders={sampleOpenOrders}
        tableMap={tableMap}
        session={cashierSession}
        posDefaultGstPercent={5}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'split' }))
    expect(screen.getByLabelText(/Cash Part/i)).toBeDefined()
    expect(screen.getByLabelText(/UPI Part/i)).toBeDefined()
  })

  it('editing Cash Part in split mode auto-adjusts UPI Part', () => {
    render(
      <BillingClientPage
        branches={branches}
        activeBranchId="br-1"
        billedOrders={sampleBilledOrders}
        paidOrders={samplePaidOrders}
        openOrders={sampleOpenOrders}
        tableMap={tableMap}
        session={cashierSession}
        posDefaultGstPercent={5}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'split' }))
    const cashPartInput = screen.getByLabelText(/Cash Part/i)
    const upiPartInput = screen.getByLabelText(/UPI Part/i) as HTMLInputElement

    fireEvent.change(cashPartInput, { target: { value: '200' } })
    // total is 472 -> UPI should become 472 - 200 = 272
    expect(upiPartInput.value).toBe('272')
  })

  it('editing UPI Part in split mode auto-adjusts Cash Part', () => {
    render(
      <BillingClientPage
        branches={branches}
        activeBranchId="br-1"
        billedOrders={sampleBilledOrders}
        paidOrders={samplePaidOrders}
        openOrders={sampleOpenOrders}
        tableMap={tableMap}
        session={cashierSession}
        posDefaultGstPercent={5}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'split' }))
    const upiPartInput = screen.getByLabelText(/UPI Part/i)
    const cashPartInput = screen.getByLabelText(/Cash Part/i) as HTMLInputElement

    fireEvent.change(upiPartInput, { target: { value: '300' } })
    // total is 472 -> Cash should become 472 - 300 = 172
    expect(cashPartInput.value).toBe('172')
  })

  // ── Payment Submission ──
  it('submitting cash payment calls recordPayment with cash formData', async () => {
    render(
      <BillingClientPage
        branches={branches}
        activeBranchId="br-1"
        billedOrders={sampleBilledOrders}
        paidOrders={samplePaidOrders}
        openOrders={sampleOpenOrders}
        tableMap={tableMap}
        session={cashierSession}
        posDefaultGstPercent={5}
      />
    )
    fireEvent.change(screen.getByLabelText(/Cash Tendered from Customer/i), {
      target: { value: '500' },
    })
    fireEvent.click(screen.getByText('Confirm Settlement & Clear Table'))

    await waitFor(() => {
      expect(posActions.recordPayment).toHaveBeenCalledTimes(1)
      const formData = posActions.recordPayment.mock.calls[0][1] as FormData
      expect(formData.get('orderId')).toBe('ord-billed-1')
      expect(formData.get('method')).toBe('cash')
      expect(formData.get('cashAmount')).toBe('472')
      expect(formData.get('upiAmount')).toBe('0')
      expect(formData.get('cashTendered')).toBe('500')
      expect(screen.getByText('Payment recorded! Change Due: ₹28')).toBeDefined()
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  it('submitting UPI payment calls recordPayment with upi formData', async () => {
    render(
      <BillingClientPage
        branches={branches}
        activeBranchId="br-1"
        billedOrders={sampleBilledOrders}
        paidOrders={samplePaidOrders}
        openOrders={sampleOpenOrders}
        tableMap={tableMap}
        session={cashierSession}
        posDefaultGstPercent={5}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'upi' }))
    fireEvent.click(screen.getByText('Confirm Settlement & Clear Table'))

    await waitFor(() => {
      expect(posActions.recordPayment).toHaveBeenCalledTimes(1)
      const formData = posActions.recordPayment.mock.calls[0][1] as FormData
      expect(formData.get('orderId')).toBe('ord-billed-1')
      expect(formData.get('method')).toBe('upi')
      expect(formData.get('cashAmount')).toBe('0')
      expect(formData.get('upiAmount')).toBe('472')
      expect(formData.get('cashTendered')).toBe('0')
    })
  })

  it('submitting split payment calls recordPayment with split formData', async () => {
    render(
      <BillingClientPage
        branches={branches}
        activeBranchId="br-1"
        billedOrders={sampleBilledOrders}
        paidOrders={samplePaidOrders}
        openOrders={sampleOpenOrders}
        tableMap={tableMap}
        session={cashierSession}
        posDefaultGstPercent={5}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'split' }))
    fireEvent.change(screen.getByLabelText(/Cash Part/i), { target: { value: '200' } })
    fireEvent.click(screen.getByText('Confirm Settlement & Clear Table'))

    await waitFor(() => {
      expect(posActions.recordPayment).toHaveBeenCalledTimes(1)
      const formData = posActions.recordPayment.mock.calls[0][1] as FormData
      expect(formData.get('orderId')).toBe('ord-billed-1')
      expect(formData.get('method')).toBe('split')
      expect(formData.get('cashAmount')).toBe('200')
      expect(formData.get('upiAmount')).toBe('272')
    })
  })

  it('displays error toast when recordPayment returns error', async () => {
    posActions.recordPayment.mockResolvedValueOnce({ error: 'Insufficient cash tendered' })
    render(
      <BillingClientPage
        branches={branches}
        activeBranchId="br-1"
        billedOrders={sampleBilledOrders}
        paidOrders={samplePaidOrders}
        openOrders={sampleOpenOrders}
        tableMap={tableMap}
        session={cashierSession}
        posDefaultGstPercent={5}
      />
    )
    fireEvent.click(screen.getByText('Confirm Settlement & Clear Table'))

    await waitFor(() => {
      expect(screen.getByText('Insufficient cash tendered')).toBeDefined()
    })
  })

  // ── "Bill an Open Order" Drawer / Modal ──
  it('renders "Bill an Open Order" button when open orders with items exist', () => {
    render(
      <BillingClientPage
        branches={branches}
        activeBranchId="br-1"
        billedOrders={sampleBilledOrders}
        paidOrders={samplePaidOrders}
        openOrders={sampleOpenOrders}
        tableMap={tableMap}
        session={cashierSession}
        posDefaultGstPercent={5}
      />
    )
    expect(screen.getByText('Bill an Open Order (1)')).toBeDefined()
  })

  it('hides "Bill an Open Order" button when openOrders is empty or has 0 items', () => {
    render(
      <BillingClientPage
        branches={branches}
        activeBranchId="br-1"
        billedOrders={sampleBilledOrders}
        paidOrders={samplePaidOrders}
        openOrders={[{ ...sampleOpenOrders[0], items: [] }]}
        tableMap={tableMap}
        session={cashierSession}
        posDefaultGstPercent={5}
      />
    )
    expect(screen.queryByText(/Bill an Open Order/i)).toBeNull()
  })

  it('clicking "Bill an Open Order" opens modal with calculated subtotal and suggested GST', () => {
    render(
      <BillingClientPage
        branches={branches}
        activeBranchId="br-1"
        billedOrders={sampleBilledOrders}
        paidOrders={samplePaidOrders}
        openOrders={sampleOpenOrders}
        tableMap={tableMap}
        session={cashierSession}
        posDefaultGstPercent={5}
      />
    )
    fireEvent.click(screen.getByText('Bill an Open Order (1)'))
    // Subtotal: 2 * 120 = 240. 5% GST = 12. Total = 252.
    expect(screen.getByText(/Subtotal: ₹240/)).toBeDefined()
    expect(screen.getByText('₹252')).toBeDefined()
  })

  it('editing discount in modal adjusts total payable', () => {
    render(
      <BillingClientPage
        branches={branches}
        activeBranchId="br-1"
        billedOrders={sampleBilledOrders}
        paidOrders={samplePaidOrders}
        openOrders={sampleOpenOrders}
        tableMap={tableMap}
        session={cashierSession}
        posDefaultGstPercent={5}
      />
    )
    fireEvent.click(screen.getByText('Bill an Open Order (1)'))
    const discountInput = screen.getByLabelText(/Discount \(₹\)/i)
    fireEvent.change(discountInput, { target: { value: '40' } })
    // Subtotal 240 - 40 discount + 12 GST = 212
    expect(screen.getByText('₹212')).toBeDefined()
  })

  it('submitting modal form calls generateBill and refreshes page on success', async () => {
    render(
      <BillingClientPage
        branches={branches}
        activeBranchId="br-1"
        billedOrders={sampleBilledOrders}
        paidOrders={samplePaidOrders}
        openOrders={sampleOpenOrders}
        tableMap={tableMap}
        session={cashierSession}
        posDefaultGstPercent={5}
      />
    )
    fireEvent.click(screen.getByText('Bill an Open Order (1)'))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Bill' }))

    await waitFor(() => {
      expect(posActions.generateBill).toHaveBeenCalledTimes(1)
      const formData = posActions.generateBill.mock.calls[0][1] as FormData
      expect(formData.get('orderId')).toBe('ord-open-1')
      expect(screen.getByText('Bill generated! Added to payment queue.')).toBeDefined()
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  it('handles ZERO_BILL_CONFIRM_REQUIRED by prompting user and updating submit button', async () => {
    posActions.generateBill.mockResolvedValueOnce({ error: 'ZERO_BILL_CONFIRM_REQUIRED' })
    render(
      <BillingClientPage
        branches={branches}
        activeBranchId="br-1"
        billedOrders={sampleBilledOrders}
        paidOrders={samplePaidOrders}
        openOrders={sampleOpenOrders}
        tableMap={tableMap}
        session={cashierSession}
        posDefaultGstPercent={5}
      />
    )
    fireEvent.click(screen.getByText('Bill an Open Order (1)'))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Bill' }))

    await waitFor(() => {
      expect(screen.getByText(/Total is ₹0. Please confirm you wish to issue a ₹0 complimentary bill/i)).toBeDefined()
      const btn = screen.getByRole('button', { name: 'Confirm ₹0 Bill' })
      expect(btn).not.toBeDisabled()
    })

    // Now clicking Confirm ₹0 Bill submits confirmed=true
    fireEvent.click(screen.getByRole('button', { name: 'Confirm ₹0 Bill' }))
    await waitFor(() => {
      expect(posActions.generateBill).toHaveBeenCalledTimes(2)
      const formData = posActions.generateBill.mock.calls[1][1] as FormData
      expect(formData.get('confirmed')).toBe('true')
    })
  })

  it('cancel button in bill modal closes modal without submitting', () => {
    render(
      <BillingClientPage
        branches={branches}
        activeBranchId="br-1"
        billedOrders={sampleBilledOrders}
        paidOrders={samplePaidOrders}
        openOrders={sampleOpenOrders}
        tableMap={tableMap}
        session={cashierSession}
        posDefaultGstPercent={5}
      />
    )
    fireEvent.click(screen.getByText('Bill an Open Order (1)'))
    expect(screen.getByText(/Subtotal: ₹240/)).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByText(/Subtotal: ₹240/)).toBeNull()
    expect(posActions.generateBill).not.toHaveBeenCalled()
  })

  it('displays generic error toast if generateBill fails with error', async () => {
    posActions.generateBill.mockResolvedValueOnce({ error: 'Cannot bill empty order' })
    render(
      <BillingClientPage
        branches={branches}
        activeBranchId="br-1"
        billedOrders={sampleBilledOrders}
        paidOrders={samplePaidOrders}
        openOrders={sampleOpenOrders}
        tableMap={tableMap}
        session={cashierSession}
        posDefaultGstPercent={5}
      />
    )
    fireEvent.click(screen.getByText('Bill an Open Order (1)'))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Bill' }))

    await waitFor(() => {
      expect(screen.getByText('Cannot bill empty order')).toBeDefined()
    })
  })

  // ── Print Bill during Payment Phase ──
  describe('Print Bill during Payment Phase', () => {
    it('renders Print Bill button in settlement panel for billed order', () => {
      render(
        <BillingClientPage
          branches={branches}
          activeBranchId="br-1"
          billedOrders={sampleBilledOrders}
          paidOrders={samplePaidOrders}
          openOrders={sampleOpenOrders}
          tableMap={tableMap}
          session={cashierSession}
          posDefaultGstPercent={5}
        />
      )

      expect(screen.getByRole('button', { name: 'Print Bill' })).toBeDefined()
    })

    it('opens ReceiptPrintModal when clicking Print Bill button', () => {
      render(
        <BillingClientPage
          branches={branches}
          activeBranchId="br-1"
          billedOrders={sampleBilledOrders}
          paidOrders={samplePaidOrders}
          openOrders={sampleOpenOrders}
          tableMap={tableMap}
          session={cashierSession}
          posDefaultGstPercent={5}
        />
      )

      fireEvent.click(screen.getByRole('button', { name: 'Print Bill' }))
      expect(screen.getByText('Customer Bill')).toBeDefined()
      expect(screen.getAllByText(/SREE VAISHNAVES/i).length).toBeGreaterThan(0)
    })

    it('renders Settle & Print Bill button and print checkbox in settlement form', () => {
      render(
        <BillingClientPage
          branches={branches}
          activeBranchId="br-1"
          billedOrders={sampleBilledOrders}
          paidOrders={samplePaidOrders}
          openOrders={sampleOpenOrders}
          tableMap={tableMap}
          session={cashierSession}
          posDefaultGstPercent={5}
        />
      )

      expect(screen.getByRole('button', { name: /Settle & Print Bill/i })).toBeDefined()
      expect(screen.getByLabelText(/Print receipt automatically on settlement/i)).toBeDefined()
    })

    it('clicking Settle & Print Bill records payment and triggers receipt print modal', async () => {
      posActions.recordPayment.mockResolvedValueOnce({ success: true, changeDue: 0 })

      render(
        <BillingClientPage
          branches={branches}
          activeBranchId="br-1"
          billedOrders={sampleBilledOrders}
          paidOrders={samplePaidOrders}
          openOrders={sampleOpenOrders}
          tableMap={tableMap}
          session={cashierSession}
          posDefaultGstPercent={5}
        />
      )

      fireEvent.click(screen.getByRole('button', { name: /Settle & Print Bill/i }))

      await waitFor(() => {
        expect(posActions.recordPayment).toHaveBeenCalled()
        expect(screen.getByText('Customer Receipt')).toBeDefined()
      })
    })

    it('allows reprinting from settled transactions list', () => {
      render(
        <BillingClientPage
          branches={branches}
          activeBranchId="br-1"
          billedOrders={sampleBilledOrders}
          paidOrders={samplePaidOrders}
          openOrders={sampleOpenOrders}
          tableMap={tableMap}
          session={cashierSession}
          posDefaultGstPercent={5}
        />
      )

      const reprintButtons = screen.getAllByRole('button', { name: /Reprint receipt/i })
      expect(reprintButtons.length).toBeGreaterThan(0)
      fireEvent.click(reprintButtons[0])

      expect(screen.getByText('Customer Receipt')).toBeDefined()
      expect(screen.getAllByText(/\*\*\* DUPLICATE \/ REPRINT \*\*\*/i).length).toBeGreaterThan(0)
    })
  })

  describe('Billing Logout and Navigation Controls (Goal Requirement 2)', () => {
    it('renders Logout button and clicking it calls logout', async () => {
      const { logout } = await import('@/app/actions/auth')

      render(
        <BillingClientPage
          branches={branches}
          activeBranchId="br-1"
          billedOrders={[]}
          paidOrders={[]}
          openOrders={[]}
          tableMap={tableMap}
          session={cashierSession}
          posDefaultGstPercent={5}
        />
      )

      const logoutBtn = screen.getByRole('button', { name: /Logout/i })
      expect(logoutBtn).toBeDefined()

      fireEvent.click(logoutBtn)
      expect(logout).toHaveBeenCalled()
    })

    it('renders POS and Dashboard link when session is admin/owner', () => {
      const adminSession = {
        userId: 'u-admin',
        name: 'Manager Bob',
        role: 'manager',
        isGlobalAdmin: true,
      }

      render(
        <BillingClientPage
          branches={branches}
          activeBranchId="br-1"
          billedOrders={[]}
          paidOrders={[]}
          openOrders={[]}
          tableMap={tableMap}
          session={adminSession}
          posDefaultGstPercent={5}
        />
      )

      const posLink = screen.getByRole('link', { name: /POS/i })
      expect(posLink).toBeDefined()
      expect(posLink.getAttribute('href')).toContain('/management/pos')

      const dashboardLink = screen.getByRole('link', { name: /Dashboard/i })
      expect(dashboardLink).toBeDefined()
      expect(dashboardLink.getAttribute('href')).toBe('/management')
    })
  })
})


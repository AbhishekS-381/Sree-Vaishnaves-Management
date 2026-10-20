import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ReceiptPrintModal } from '@/components/ReceiptPrintModal'
import type { PosOrder } from '@/app/actions/posTypes'

describe('ReceiptPrintModal Component Tests', () => {
  const sampleOrder: PosOrder = {
    id: 'pord_123456789abc',
    branchId: 'br-1',
    tableId: 'tbl-4',
    orderType: 'dine-in',
    status: 'billed',
    date: '2026-10-20',
    openedBy: 'u_waiter',
    createdAt: '2026-10-20T10:00:00Z',
    updatedAt: '2026-10-20T10:30:00Z',
    items: [
      { id: 'it-1', menuItemId: 'm1', nameSnapshot: 'Paneer Butter Masala', quantity: 2, unitPrice: 240, note: 'Spicy' },
      { id: 'it-2', menuItemId: 'm2', nameSnapshot: 'Garlic Naan', quantity: 3, unitPrice: 50 },
    ],
    bill: {
      subtotal: 630,
      discount: 30,
      gst: 30,
      totalPayable: 630,
      generatedAt: '2026-10-20T10:30:00Z',
    },
  }

  const sampleBranch = {
    id: 'br-1',
    name: 'Indiranagar Main',
    address: '100ft Road, Bangalore',
    phone: '9876543210',
  }

  let printSpy: any

  beforeEach(() => {
    printSpy = vi.spyOn(window, 'print').mockImplementation(() => {})
  })

  afterEach(() => {
    printSpy.mockRestore()
  })

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <ReceiptPrintModal
        isOpen={false}
        onClose={vi.fn()}
        order={sampleOrder}
        branch={sampleBranch}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when order is null', () => {
    const { container } = render(
      <ReceiptPrintModal
        isOpen={true}
        onClose={vi.fn()}
        order={null}
        branch={sampleBranch}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders restaurant header, branch info, and order metadata', () => {
    render(
      <ReceiptPrintModal
        isOpen={true}
        onClose={vi.fn()}
        order={sampleOrder}
        branch={sampleBranch}
        tableName="Table 4"
        cashierName="Ramesh Cashier"
      />
    )

    expect(screen.getAllByText(/SREE VAISHNAVES/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Indiranagar Main/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/100ft Road, Bangalore/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/9876543210/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Table 4/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Ramesh Cashier/i).length).toBeGreaterThan(0)
  })

  it('renders order line items and pricing breakdown', () => {
    render(
      <ReceiptPrintModal
        isOpen={true}
        onClose={vi.fn()}
        order={sampleOrder}
        branch={sampleBranch}
      />
    )

    expect(screen.getAllByText(/Paneer Butter Masala/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Garlic Naan/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Subtotal:/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Discount:/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/CGST \(2.5%\):/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/SGST \(2.5%\):/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/NET PAYABLE:/i).length).toBeGreaterThan(0)
  })

  it('renders duplicate reprint disclaimer when isReprint is true', () => {
    render(
      <ReceiptPrintModal
        isOpen={true}
        onClose={vi.fn()}
        order={sampleOrder}
        branch={sampleBranch}
        isReprint={true}
      />
    )

    expect(screen.getAllByText(/\*\*\* DUPLICATE \/ REPRINT \*\*\*/i).length).toBeGreaterThan(0)
  })

  it('renders payment details when order is paid', () => {
    const paidOrder: PosOrder = {
      ...sampleOrder,
      status: 'paid',
      payment: {
        method: 'split',
        cashAmount: 300,
        upiAmount: 330,
        paidAt: '2026-10-20T10:45:00Z',
      },
    }

    render(
      <ReceiptPrintModal
        isOpen={true}
        onClose={vi.fn()}
        order={paidOrder}
        branch={sampleBranch}
      />
    )

    expect(screen.getAllByText(/PAID VIA:/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/SPLIT/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Cash: ₹300/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/UPI: ₹330/i).length).toBeGreaterThan(0)
  })

  it('triggers window.print when Print Bill button is clicked', () => {
    render(
      <ReceiptPrintModal
        isOpen={true}
        onClose={vi.fn()}
        order={sampleOrder}
        branch={sampleBranch}
      />
    )

    const printBtn = screen.getByRole('button', { name: /Print Bill/i })
    fireEvent.click(printBtn)

    expect(printSpy).toHaveBeenCalled()
  })

  it('triggers window.print automatically when autoPrint is true', async () => {
    render(
      <ReceiptPrintModal
        isOpen={true}
        onClose={vi.fn()}
        order={sampleOrder}
        branch={sampleBranch}
        autoPrint={true}
      />
    )

    await waitFor(() => {
      expect(printSpy).toHaveBeenCalled()
    })
  })

  it('switches thermal paper width between 80mm and 58mm', () => {
    render(
      <ReceiptPrintModal
        isOpen={true}
        onClose={vi.fn()}
        order={sampleOrder}
        branch={sampleBranch}
      />
    )

    const btn58 = screen.getByRole('button', { name: '58mm' })
    const btn80 = screen.getByRole('button', { name: '80mm' })

    fireEvent.click(btn58)
    expect(btn58.className).toContain('bg-amber-600')

    fireEvent.click(btn80)
    expect(btn80.className).toContain('bg-amber-600')
  })

  it('copies raw thermal receipt text to clipboard', async () => {
    const writeTextSpy = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextSpy,
      },
    })

    render(
      <ReceiptPrintModal
        isOpen={true}
        onClose={vi.fn()}
        order={sampleOrder}
        branch={sampleBranch}
      />
    )

    const copyBtn = screen.getByRole('button', { name: /Copy Raw Slip/i })
    fireEvent.click(copyBtn)

    await waitFor(() => {
      expect(writeTextSpy).toHaveBeenCalled()
    })
  })

  it('calls onClose when close button or X is clicked', () => {
    const onCloseMock = vi.fn()
    render(
      <ReceiptPrintModal
        isOpen={true}
        onClose={onCloseMock}
        order={sampleOrder}
        branch={sampleBranch}
      />
    )

    const closeBtn = screen.getByRole('button', { name: 'Close' })
    fireEvent.click(closeBtn)

    expect(onCloseMock).toHaveBeenCalledTimes(1)
  })
})

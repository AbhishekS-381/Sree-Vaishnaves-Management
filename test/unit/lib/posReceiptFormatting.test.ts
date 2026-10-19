import { describe, it, expect } from 'vitest'
import { formatThermalReceipt, formatKotSlip } from '@/lib/posReceipt'
import type { PosOrder, PosKot } from '@/app/actions/posTypes'

describe('POS Receipt & Thermal Printer Formatting - posReceiptFormatting.test.ts', () => {
  const baseOrder: PosOrder = {
    id: 'pord_12345678abcdef',
    branchId: 'br-1',
    tableId: 'tbl-1',
    orderType: 'dine-in',
    status: 'paid',
    date: '2026-10-19',
    openedBy: 'u_waiter',
    createdAt: '2026-10-19T10:00:00Z',
    updatedAt: '2026-10-19T10:30:00Z',
    items: [
      { id: 'it-1', menuItemId: 'm1', nameSnapshot: 'Paneer Butter Masala', quantity: 2, unitPrice: 220, note: 'Spicy' },
      { id: 'it-2', menuItemId: 'm2', nameSnapshot: 'Butter Naan', quantity: 4, unitPrice: 40 },
    ],
    bill: {
      subtotal: 600,
      discount: 50,
      gst: 27.5,
      totalPayable: 577.5,
      generatedAt: '2026-10-19T10:20:00Z',
    },
    payment: {
      method: 'cash',
      cashAmount: 577.5,
      upiAmount: 0,
      paidAt: '2026-10-19T10:30:00Z',
    },
  }

  const baseKot: PosKot = {
    id: 'pkot_999',
    orderId: 'pord_12345678abcdef',
    branchId: 'br-1',
    kotNumber: 3,
    status: 'pending',
    firedBy: 'u_waiter',
    firedAt: '2026-10-19T10:15:00Z',
    updatedAt: '2026-10-19T10:15:00Z',
    items: [
      { menuItemId: 'm1', nameSnapshot: 'Paneer Butter Masala', quantity: 2, note: 'Less oil' },
      { menuItemId: 'm2', nameSnapshot: 'Butter Naan', quantity: 4 },
    ],
  }

  // =========================================================================
  // 1. Thermal Receipt Formatter (80mm vs 58mm)
  // =========================================================================
  describe('formatThermalReceipt', () => {
    it('generates standard 80mm receipt with restaurant header and dividers', () => {
      const receipt = formatThermalReceipt(baseOrder, {
        restaurantName: 'Sree Vaishnaves Pure Veg',
        branchName: 'Main Branch - Indiranagar',
        branchAddress: '100ft Road, Bangalore',
        gstin: '29ABCDE1234F1Z5',
        fssai: '11223344556677',
        tableName: 'Table 4',
        cashierName: 'Ramesh',
        waiterName: 'Suresh',
      })

      expect(receipt).toContain('Sree Vaishnaves Pure Veg')
      expect(receipt).toContain('Main Branch - Indiranagar')
      expect(receipt).toContain('GSTIN: 29ABCDE1234F1Z5')
      expect(receipt).toContain('FSSAI Lic: 11223344556677')
      expect(receipt).toContain('TABLE: Table 4')
      expect(receipt).toContain('CASHIER: Ramesh')
      expect(receipt).toContain('WAITER: Suresh')
    })

    it('generates 58mm receipt with narrow column limits (32 characters per line)', () => {
      const receipt = formatThermalReceipt(baseOrder, {
        width: '58mm',
        restaurantName: 'Sree Vaishnaves',
      })

      const lines = receipt.split('\n')
      for (const line of lines) {
        expect(line.length).toBeLessThanOrEqual(32)
      }
    })

    it('displays takeaway identifier when order is takeaway', () => {
      const takeawayOrder: PosOrder = {
        ...baseOrder,
        orderType: 'takeaway',
        tableId: undefined,
        takeawayNumber: 'T-14',
      }

      const receipt = formatThermalReceipt(takeawayOrder)
      expect(receipt).toContain('TAKEAWAY: T-14')
    })

    it('includes duplicate reprint disclaimer when isReprint is true', () => {
      const receipt = formatThermalReceipt(baseOrder, { isReprint: true })
      expect(receipt).toContain('*** DUPLICATE / REPRINT ***')
    })

    it('does not include duplicate reprint disclaimer on original receipt', () => {
      const receipt = formatThermalReceipt(baseOrder, { isReprint: false })
      expect(receipt).not.toContain('*** DUPLICATE / REPRINT ***')
    })

    it('lists all ordered items with quantity, unit price and line total', () => {
      const receipt = formatThermalReceipt(baseOrder)
      expect(receipt).toContain('Paneer Butter Masala')
      expect(receipt).toContain('2  ₹440')
      expect(receipt).toContain('Butter Naan')
      expect(receipt).toContain('4  ₹160')
    })

    it('renders item preparation note with asterisk indent', () => {
      const receipt = formatThermalReceipt(baseOrder)
      expect(receipt).toContain('* Spicy')
    })

    it('formats subtotal, discount, CGST, SGST and Net Payable accurately', () => {
      const receipt = formatThermalReceipt(baseOrder)
      expect(receipt).toMatch(/Subtotal:\s+₹600/)
      expect(receipt).toMatch(/Discount:\s+-₹50/)
      expect(receipt).toMatch(/CGST \(2\.5%\):\s+₹13\.75/)
      expect(receipt).toMatch(/SGST \(2\.5%\):\s+₹13\.75/)
      expect(receipt).toMatch(/NET PAYABLE:\s+₹577\.5/)
    })

    it('omits discount and GST lines when values are 0', () => {
      const zeroGstOrder: PosOrder = {
        ...baseOrder,
        bill: {
          subtotal: 200,
          discount: 0,
          gst: 0,
          totalPayable: 200,
        },
      }

      const receipt = formatThermalReceipt(zeroGstOrder)
      expect(receipt).not.toContain('Discount:')
      expect(receipt).not.toContain('CGST')
      expect(receipt).not.toContain('SGST')
      expect(receipt).toMatch(/NET PAYABLE:\s+₹200/)
    })

    it('renders cash payment method breakdown', () => {
      const receipt = formatThermalReceipt(baseOrder)
      expect(receipt).toMatch(/PAYMENT METHOD:\s+CASH/)
    })

    it('renders split payment method breakdown with cash and UPI details', () => {
      const splitOrder: PosOrder = {
        ...baseOrder,
        payment: {
          method: 'split',
          cashAmount: 300,
          upiAmount: 277.5,
          paidAt: '2026-10-19T10:30:00Z',
        },
      }

      const receipt = formatThermalReceipt(splitOrder)
      expect(receipt).toMatch(/PAYMENT METHOD:\s+SPLIT/)
      expect(receipt).toMatch(/Cash Paid:\s+₹300/)
      expect(receipt).toMatch(/UPI Paid:\s+₹277\.5/)
    })

    it('handles complimentary ₹0 zero-bill cleanly', () => {
      const zeroBillOrder: PosOrder = {
        ...baseOrder,
        bill: {
          subtotal: 200,
          discount: 200,
          gst: 0,
          totalPayable: 0,
        },
      }

      const receipt = formatThermalReceipt(zeroBillOrder)
      expect(receipt).toMatch(/Discount:\s+-₹200/)
      expect(receipt).toMatch(/NET PAYABLE:\s+₹0/)
    })

    it('truncates order ID to last 6 characters for concise display', () => {
      const receipt = formatThermalReceipt(baseOrder)
      expect(receipt).toContain('ORDER: #ABCDEF')
    })

    it('includes polite closing footer on receipt', () => {
      const receipt = formatThermalReceipt(baseOrder)
      expect(receipt).toContain('Thank you for dining with us!')
      expect(receipt).toContain('Please visit again')
    })

    it('formats unbilled order with subtotal fallback when bill object is missing', () => {
      const unbilledOrder: PosOrder = {
        ...baseOrder,
        status: 'open',
        bill: undefined,
        payment: undefined,
      }

      const receipt = formatThermalReceipt(unbilledOrder)
      expect(receipt).toMatch(/Subtotal:\s+₹600/)
      expect(receipt).toMatch(/NET PAYABLE:\s+₹600/)
      expect(receipt).not.toContain('PAYMENT METHOD:')
    })

    it('formats order with missing table name fallback to Dine-In', () => {
      const noTableOrder: PosOrder = {
        ...baseOrder,
        tableId: undefined,
      }

      const receipt = formatThermalReceipt(noTableOrder)
      expect(receipt).toContain('TABLE: Dine-In')
    })

    it('formats order with missing takeaway number fallback to Takeaway', () => {
      const noTkwNumOrder: PosOrder = {
        ...baseOrder,
        orderType: 'takeaway',
        takeawayNumber: undefined,
      }

      const receipt = formatThermalReceipt(noTkwNumOrder)
      expect(receipt).toContain('TAKEAWAY: Takeaway')
    })

    it('formats 58mm with item line truncation gracefully without overflow', () => {
      const longItemOrder: PosOrder = {
        ...baseOrder,
        items: [
          { id: 'it-x', menuItemId: 'mx', nameSnapshot: 'Super Long Dish Special Masala Thali Deluxe Platter', quantity: 1, unitPrice: 350 },
        ],
      }

      const receipt = formatThermalReceipt(longItemOrder, { width: '58mm' })
      const lines = receipt.split('\n')
      for (const line of lines) {
        expect(line.length).toBeLessThanOrEqual(32)
      }
    })
  })

  // =========================================================================
  // 2. Kitchen KOT Slip Formatter
  // =========================================================================
  describe('formatKotSlip', () => {
    it('formats KOT slip with header, ticket number, time, and items in 80mm', () => {
      const slip = formatKotSlip(baseKot, 'Table 4', '80mm')

      expect(slip).toContain('*** KITCHEN ORDER TICKET ***')
      expect(slip).toContain('KOT #3')
      expect(slip).toContain('TABLE 4')
      expect(slip).toContain('STATUS: PENDING')
      expect(slip).toContain('Paneer Butter Masala')
      expect(slip).toContain('x2')
      expect(slip).toContain('NOTE: Less oil')
      expect(slip).toContain('Butter Naan')
      expect(slip).toContain('x4')
    })

    it('formats KOT slip in 58mm adhering to 32 character line length', () => {
      const slip = formatKotSlip(baseKot, 'T-10', '58mm')
      const lines = slip.split('\n')
      for (const line of lines) {
        expect(line.length).toBeLessThanOrEqual(32)
      }
    })

    it('displays takeaway order identifier on KOT slip', () => {
      const slip = formatKotSlip(baseKot, 'Takeaway T-7')
      expect(slip).toContain('TAKEAWAY T-7')
    })

    it('omits NOTE line when item does not have a note', () => {
      const noNoteKot: PosKot = {
        ...baseKot,
        items: [{ menuItemId: 'm1', nameSnapshot: 'Plain Dosa', quantity: 1 }],
      }

      const slip = formatKotSlip(noNoteKot, 'Table 1')
      expect(slip).not.toContain('NOTE:')
    })

    it('formats multiple items with distinct quantities', () => {
      const multiItemKot: PosKot = {
        ...baseKot,
        items: [
          { menuItemId: 'm1', nameSnapshot: 'Idli Vada', quantity: 3 },
          { menuItemId: 'm2', nameSnapshot: 'Filter Coffee', quantity: 5 },
        ],
      }

      const slip = formatKotSlip(multiItemKot, 'Table 2')
      expect(slip).toContain('Idli Vada')
      expect(slip).toContain('x3')
      expect(slip).toContain('Filter Coffee')
      expect(slip).toContain('x5')
    })

    it('handles KOT with preparing status', () => {
      const preparingKot: PosKot = { ...baseKot, status: 'preparing' }
      const slip = formatKotSlip(preparingKot, 'Table 3')
      expect(slip).toContain('STATUS: PREPARING')
    })

    it('handles KOT with ready status', () => {
      const readyKot: PosKot = { ...baseKot, status: 'ready' }
      const slip = formatKotSlip(readyKot, 'Table 3')
      expect(slip).toContain('STATUS: READY')
    })

    it('handles KOT with served status', () => {
      const servedKot: PosKot = { ...baseKot, status: 'served' }
      const slip = formatKotSlip(servedKot, 'Table 3')
      expect(slip).toContain('STATUS: SERVED')
    })

    it('preserves special preparation notes with punctuation and symbols', () => {
      const specialNoteKot: PosKot = {
        ...baseKot,
        items: [{ menuItemId: 'm1', nameSnapshot: 'Soup', quantity: 1, note: 'No onion & no garlic, 100% jain!' }],
      }

      const slip = formatKotSlip(specialNoteKot, 'Table 12')
      expect(slip).toContain('NOTE: No onion & no garlic, 100% jain!')
    })

    it('handles KOT item with quantity 1 correctly formatted as x1', () => {
      const singleKot: PosKot = {
        ...baseKot,
        items: [{ menuItemId: 'm1', nameSnapshot: 'Masala Dosa', quantity: 1 }],
      }

      const slip = formatKotSlip(singleKot, 'Table 5')
      expect(slip).toContain('x1')
    })
  })
})

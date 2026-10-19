import { describe, it, expect } from 'vitest'
import {
  filterPosOrders,
  computePosHistoryMetrics,
  generatePosHistoryCsv,
} from '@/lib/posHistoryExport'
import type { PosOrder } from '@/app/actions/posTypes'

describe('POS History Filtering, Metrics & CSV Export - posHistoryExport.test.ts', () => {
  const tableMap: Record<string, string> = {
    'tbl-1': 'Table 1',
    'tbl-2': 'Table 2',
    'tbl-patio': 'Patio Corner',
  }

  const userMap: Record<string, string> = {
    'usr-1': 'Abhishek Admin',
    'usr-2': 'Ravi Waiter',
    'usr-3': 'Pooja Cashier',
  }

  const sampleOrders: PosOrder[] = [
    {
      id: 'ord-001',
      branchId: 'br-1',
      tableId: 'tbl-1',
      orderType: 'dine-in',
      status: 'paid',
      date: '2026-10-15',
      openedBy: 'usr-2',
      items: [
        { id: 'i-1', menuItemId: 'm1', nameSnapshot: 'Paneer Butter Masala', quantity: 2, unitPrice: 200 },
        { id: 'i-2', menuItemId: 'm2', nameSnapshot: 'Butter Naan, Garlic', quantity: 3, unitPrice: 40 },
      ],
      bill: { subtotal: 520, discount: 20, gst: 25, totalPayable: 525, generatedAt: '2026-10-15T11:00:00Z' },
      payment: { method: 'cash', cashAmount: 525, upiAmount: 0, paidAt: '2026-10-15T11:15:00Z' },
      note: 'VIP Guest, Window seat',
    },
    {
      id: 'ord-002',
      branchId: 'br-1',
      orderType: 'takeaway',
      takeawayNumber: 'T-05',
      status: 'paid',
      date: '2026-10-16',
      openedBy: 'usr-1',
      items: [
        { id: 'i-3', menuItemId: 'm3', nameSnapshot: 'Veg Biryani', quantity: 1, unitPrice: 180 },
      ],
      bill: { subtotal: 180, discount: 0, gst: 9, totalPayable: 189, generatedAt: '2026-10-16T12:00:00Z' },
      payment: { method: 'upi', cashAmount: 0, upiAmount: 189, paidAt: '2026-10-16T12:10:00Z' },
    },
    {
      id: 'ord-003',
      branchId: 'br-1',
      tableId: 'tbl-2',
      orderType: 'dine-in',
      status: 'billed',
      date: '2026-10-17',
      openedBy: 'usr-2',
      items: [
        { id: 'i-4', menuItemId: 'm4', nameSnapshot: 'Masala Dosa', quantity: 2, unitPrice: 80 },
      ],
      bill: { subtotal: 160, discount: 10, gst: 7.5, totalPayable: 157.5, generatedAt: '2026-10-17T09:00:00Z' },
    },
    {
      id: 'ord-004',
      branchId: 'br-1',
      tableId: 'tbl-patio',
      orderType: 'dine-in',
      status: 'voided',
      date: '2026-10-17',
      openedBy: 'usr-2',
      items: [
        { id: 'i-5', menuItemId: 'm1', nameSnapshot: 'Paneer Butter Masala', quantity: 1, unitPrice: 200 },
      ],
      void: { reason: 'Guest had emergency and left', voidedBy: 'usr-1', voidedAt: '2026-10-17T13:00:00Z' },
    },
    {
      id: 'ord-005',
      branchId: 'br-2', // Other branch
      tableId: 'tbl-1',
      orderType: 'dine-in',
      status: 'paid',
      date: '2026-10-18',
      openedBy: 'usr-3',
      items: [
        { id: 'i-6', menuItemId: 'm5', nameSnapshot: 'Thali Deluxe', quantity: 2, unitPrice: 250 },
      ],
      bill: { subtotal: 500, discount: 0, gst: 25, totalPayable: 525, generatedAt: '2026-10-18T14:00:00Z' },
      payment: { method: 'split', cashAmount: 300, upiAmount: 225, paidAt: '2026-10-18T14:20:00Z' },
    },
    {
      id: 'ord-006',
      branchId: 'br-1',
      orderType: 'takeaway',
      takeawayNumber: 'T-09',
      status: 'open',
      date: '2026-10-19',
      openedBy: 'usr-1',
      items: [
        { id: 'i-7', menuItemId: 'm6', nameSnapshot: 'Filter Coffee', quantity: 2, unitPrice: 30 },
      ],
    },
  ]

  // =========================================================================
  // 1. filterPosOrders
  // =========================================================================
  describe('filterPosOrders', () => {
    it('filters orders by branchId', () => {
      const filtered = filterPosOrders(sampleOrders, { branchId: 'br-2' })
      expect(filtered).toHaveLength(1)
      expect(filtered[0].id).toBe('ord-005')
    })

    it('filters orders within a date range (inclusive)', () => {
      const filtered = filterPosOrders(sampleOrders, {
        fromDate: '2026-10-16',
        toDate: '2026-10-17',
      })
      expect(filtered.map(o => o.id)).toEqual(['ord-002', 'ord-003', 'ord-004'])
    })

    it('filters orders by single date when fromDate equals toDate', () => {
      const filtered = filterPosOrders(sampleOrders, {
        fromDate: '2026-10-15',
        toDate: '2026-10-15',
      })
      expect(filtered).toHaveLength(1)
      expect(filtered[0].id).toBe('ord-001')
    })

    it('filters orders by status "paid"', () => {
      const filtered = filterPosOrders(sampleOrders, { status: 'paid' })
      expect(filtered).toHaveLength(3)
      expect(filtered.every(o => o.status === 'paid')).toBe(true)
    })

    it('filters orders by status "voided"', () => {
      const filtered = filterPosOrders(sampleOrders, { status: 'voided' })
      expect(filtered).toHaveLength(1)
      expect(filtered[0].id).toBe('ord-004')
    })

    it('filters orders by status "billed"', () => {
      const filtered = filterPosOrders(sampleOrders, { status: 'billed' })
      expect(filtered).toHaveLength(1)
      expect(filtered[0].id).toBe('ord-003')
    })

    it('filters orders by status "open"', () => {
      const filtered = filterPosOrders(sampleOrders, { status: 'open' })
      expect(filtered).toHaveLength(1)
      expect(filtered[0].id).toBe('ord-006')
    })

    it('ignores status filter when set to "all"', () => {
      const filtered = filterPosOrders(sampleOrders, { status: 'all' })
      expect(filtered).toHaveLength(6)
    })

    it('filters orders by orderType "dine-in"', () => {
      const filtered = filterPosOrders(sampleOrders, { orderType: 'dine-in' })
      expect(filtered).toHaveLength(4)
      expect(filtered.every(o => o.orderType === 'dine-in')).toBe(true)
    })

    it('filters orders by orderType "takeaway"', () => {
      const filtered = filterPosOrders(sampleOrders, { orderType: 'takeaway' })
      expect(filtered).toHaveLength(2)
      expect(filtered.every(o => o.orderType === 'takeaway')).toBe(true)
    })

    it('filters orders by paymentMethod "cash"', () => {
      const filtered = filterPosOrders(sampleOrders, { paymentMethod: 'cash' })
      expect(filtered).toHaveLength(1)
      expect(filtered[0].id).toBe('ord-001')
    })

    it('filters orders by paymentMethod "upi"', () => {
      const filtered = filterPosOrders(sampleOrders, { paymentMethod: 'upi' })
      expect(filtered).toHaveLength(1)
      expect(filtered[0].id).toBe('ord-002')
    })

    it('filters orders by paymentMethod "split"', () => {
      const filtered = filterPosOrders(sampleOrders, { paymentMethod: 'split' })
      expect(filtered).toHaveLength(1)
      expect(filtered[0].id).toBe('ord-005')
    })

    it('filters orders by minAmount threshold', () => {
      const filtered = filterPosOrders(sampleOrders, { minAmount: 500 })
      expect(filtered.map(o => o.id)).toEqual(['ord-001', 'ord-005'])
    })

    it('filters orders by maxAmount threshold', () => {
      const filtered = filterPosOrders(sampleOrders, { maxAmount: 200 })
      expect(filtered.map(o => o.id)).toEqual(['ord-002', 'ord-003', 'ord-004', 'ord-006'])
    })

    it('searches by table name', () => {
      const filtered = filterPosOrders(sampleOrders, { searchQuery: 'patio' }, tableMap, userMap)
      expect(filtered).toHaveLength(1)
      expect(filtered[0].id).toBe('ord-004')
    })

    it('searches by takeaway number', () => {
      const filtered = filterPosOrders(sampleOrders, { searchQuery: 'T-05' }, tableMap, userMap)
      expect(filtered).toHaveLength(1)
      expect(filtered[0].id).toBe('ord-002')
    })

    it('searches by staff user name', () => {
      const filtered = filterPosOrders(sampleOrders, { searchQuery: 'Ravi' }, tableMap, userMap)
      expect(filtered.map(o => o.id)).toEqual(['ord-001', 'ord-003', 'ord-004'])
    })

    it('searches by order note content', () => {
      const filtered = filterPosOrders(sampleOrders, { searchQuery: 'VIP Guest' }, tableMap, userMap)
      expect(filtered).toHaveLength(1)
      expect(filtered[0].id).toBe('ord-001')
    })

    it('searches by void reason content', () => {
      const filtered = filterPosOrders(sampleOrders, { searchQuery: 'emergency' }, tableMap, userMap)
      expect(filtered).toHaveLength(1)
      expect(filtered[0].id).toBe('ord-004')
    })

    it('searches by dish name across ordered items', () => {
      const filtered = filterPosOrders(sampleOrders, { searchQuery: 'Biryani' }, tableMap, userMap)
      expect(filtered).toHaveLength(1)
      expect(filtered[0].id).toBe('ord-002')
    })

    it('combines multiple criteria simultaneously (branch + date + status + payment)', () => {
      const filtered = filterPosOrders(sampleOrders, {
        branchId: 'br-1',
        fromDate: '2026-10-15',
        toDate: '2026-10-18',
        status: 'paid',
        paymentMethod: 'cash',
      })
      expect(filtered).toHaveLength(1)
      expect(filtered[0].id).toBe('ord-001')
    })
  })

  // =========================================================================
  // 2. computePosHistoryMetrics
  // =========================================================================
  describe('computePosHistoryMetrics', () => {
    it('computes financial metrics summing only paid orders', () => {
      const metrics = computePosHistoryMetrics(sampleOrders)

      // Paid orders: ord-001 (525), ord-002 (189), ord-005 (525) -> Total = 1239
      expect(metrics.totalRevenue).toBe(1239)
      expect(metrics.billCount).toBe(3)
      // Avg = Math.round(1239 / 3) = 413
      expect(metrics.avgOrderValue).toBe(413)
      // Discounts = 20 (ord-001) + 0 (ord-002) + 0 (ord-005) = 20
      expect(metrics.totalDiscounts).toBe(20)
      // GST = 25 + 9 + 25 = 59
      expect(metrics.totalGst).toBe(59)
      // Voids = 1 (ord-004)
      expect(metrics.totalVoids).toBe(1)
      // Cash = 525 (ord-001) + 300 (ord-005) = 825
      expect(metrics.cashTotal).toBe(825)
      // UPI = 189 (ord-002) + 225 (ord-005) = 414
      expect(metrics.upiTotal).toBe(414)
    })

    it('returns zero values safely when order list is empty', () => {
      const metrics = computePosHistoryMetrics([])
      expect(metrics.totalRevenue).toBe(0)
      expect(metrics.billCount).toBe(0)
      expect(metrics.avgOrderValue).toBe(0)
      expect(metrics.totalDiscounts).toBe(0)
      expect(metrics.totalGst).toBe(0)
      expect(metrics.totalVoids).toBe(0)
      expect(metrics.cashTotal).toBe(0)
      expect(metrics.upiTotal).toBe(0)
    })
  })

  // =========================================================================
  // 3. generatePosHistoryCsv
  // =========================================================================
  describe('generatePosHistoryCsv', () => {
    it('generates CSV with header and correct columns', () => {
      const csv = generatePosHistoryCsv(sampleOrders, tableMap, userMap)
      const lines = csv.split('\n')

      expect(lines[0]).toContain('"Order ID","Date","Branch ID","Order Type","Identifier","Status"')
      expect(lines.length).toBe(sampleOrders.length + 1)
    })

    it('properly escapes commas in dish names or notes', () => {
      const csv = generatePosHistoryCsv(sampleOrders, tableMap, userMap)
      // ord-001 has table "Table 1" and items with comma
      expect(csv).toContain('"ord-001"')
      expect(csv).toContain('"Table 1"')
      expect(csv).toContain('"525"')
    })

    it('includes void reason in CSV for voided orders', () => {
      const csv = generatePosHistoryCsv(sampleOrders, tableMap, userMap)
      expect(csv).toContain('"Guest had emergency and left"')
    })

    it('resolves user names from userMap', () => {
      const csv = generatePosHistoryCsv(sampleOrders, tableMap, userMap)
      expect(csv).toContain('"Abhishek Admin"')
      expect(csv).toContain('"Ravi Waiter"')
    })

    it('handles empty order array by returning header row only', () => {
      const csv = generatePosHistoryCsv([], tableMap, userMap)
      const lines = csv.split('\n')
      expect(lines).toHaveLength(1)
      expect(lines[0]).toContain('"Order ID"')
    })
  })
})

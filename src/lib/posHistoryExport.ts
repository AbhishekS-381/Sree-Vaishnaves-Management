/**
 * Pure utility functions for POS history filtering, data transformation,
 * and CSV report generation.
 */

import type { PosOrder } from '@/app/actions/posTypes'

export interface PosHistoryFilterOptions {
  branchId?: string
  fromDate?: string // YYYY-MM-DD
  toDate?: string   // YYYY-MM-DD
  status?: 'all' | 'paid' | 'billed' | 'open' | 'voided'
  orderType?: 'all' | 'dine-in' | 'takeaway'
  paymentMethod?: 'all' | 'cash' | 'upi' | 'split'
  searchQuery?: string
  minAmount?: number
  maxAmount?: number
}

export interface PosHistorySummaryMetrics {
  totalRevenue: number
  billCount: number
  avgOrderValue: number
  totalDiscounts: number
  totalGst: number
  totalVoids: number
  cashTotal: number
  upiTotal: number
}

/**
 * Filters a list of PosOrders according to multi-dimensional criteria.
 */
export function filterPosOrders(
  orders: PosOrder[],
  filters: PosHistoryFilterOptions,
  tableMap: Record<string, string> = {},
  userMap: Record<string, string> = {}
): PosOrder[] {
  return orders.filter(order => {
    // Branch filter
    if (filters.branchId && order.branchId !== filters.branchId) {
      return false
    }

    // Date range filter
    if (filters.fromDate && order.date < filters.fromDate) {
      return false
    }
    if (filters.toDate && order.date > filters.toDate) {
      return false
    }

    // Status filter
    if (filters.status && filters.status !== 'all' && order.status !== filters.status) {
      return false
    }

    // Order type filter
    if (filters.orderType && filters.orderType !== 'all' && order.orderType !== filters.orderType) {
      return false
    }

    // Payment method filter
    if (filters.paymentMethod && filters.paymentMethod !== 'all') {
      if (!order.payment || order.payment.method !== filters.paymentMethod) {
        return false
      }
    }

    // Min / Max amount filter
    const totalPayable = order.bill?.totalPayable ?? 0
    if (filters.minAmount !== undefined && totalPayable < filters.minAmount) {
      return false
    }
    if (filters.maxAmount !== undefined && totalPayable > filters.maxAmount) {
      return false
    }

    // Text search query
    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase().trim()
      const tableName = (order.tableId ? tableMap[order.tableId] : '') || ''
      const takeawayNum = order.takeawayNumber || ''
      const openedByName = (userMap[order.openedBy] || order.openedBy) || ''
      const orderNote = order.note || ''
      const voidReason = order.void?.reason || ''
      const dishNames = order.items.map(i => i.nameSnapshot).join(' ')

      const matches =
        order.id.toLowerCase().includes(q) ||
        tableName.toLowerCase().includes(q) ||
        takeawayNum.toLowerCase().includes(q) ||
        openedByName.toLowerCase().includes(q) ||
        orderNote.toLowerCase().includes(q) ||
        voidReason.toLowerCase().includes(q) ||
        dishNames.toLowerCase().includes(q)

      if (!matches) return false
    }

    return true
  })
}

/**
 * Computes financial summary aggregates from a filtered list of orders.
 */
export function computePosHistoryMetrics(orders: PosOrder[]): PosHistorySummaryMetrics {
  const paidOrders = orders.filter(o => o.status === 'paid')
  const totalRevenue = paidOrders.reduce((sum, o) => sum + (o.bill?.totalPayable ?? 0), 0)
  const totalDiscounts = paidOrders.reduce((sum, o) => sum + (o.bill?.discount ?? 0), 0)
  const totalGst = paidOrders.reduce((sum, o) => sum + (o.bill?.gst ?? 0), 0)
  const totalVoids = orders.filter(o => o.status === 'voided').length
  const billCount = paidOrders.length
  const avgOrderValue = billCount > 0 ? Math.round(totalRevenue / billCount) : 0

  const cashTotal = paidOrders.reduce((sum, o) => sum + (o.payment?.cashAmount ?? 0), 0)
  const upiTotal = paidOrders.reduce((sum, o) => sum + (o.payment?.upiAmount ?? 0), 0)

  return {
    totalRevenue,
    billCount,
    avgOrderValue,
    totalDiscounts,
    totalGst,
    totalVoids,
    cashTotal,
    upiTotal,
  }
}

function escapeCsvField(field: unknown): string {
  if (field === null || field === undefined) return '""'
  const str = String(field)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return `"${str}"`
}

/**
 * Generates CSV string suitable for downloading or spreadsheet auditing.
 */
export function generatePosHistoryCsv(
  orders: PosOrder[],
  tableMap: Record<string, string> = {},
  userMap: Record<string, string> = {}
): string {
  const headers = [
    'Order ID',
    'Date',
    'Branch ID',
    'Order Type',
    'Identifier',
    'Status',
    'Items Count',
    'Subtotal (INR)',
    'Discount (INR)',
    'GST (INR)',
    'Total Payable (INR)',
    'Payment Method',
    'Cash (INR)',
    'UPI (INR)',
    'Opened By',
    'Settled At',
    'Void Reason',
  ]

  const rows: string[] = [headers.map(escapeCsvField).join(',')]

  for (const order of orders) {
    const identifier = order.orderType === 'dine-in'
      ? (order.tableId ? tableMap[order.tableId] || 'Table' : 'Table')
      : (order.takeawayNumber || 'Takeaway')

    const row = [
      order.id,
      order.date,
      order.branchId,
      order.orderType,
      identifier,
      order.status,
      order.items.reduce((s, i) => s + i.quantity, 0),
      order.bill?.subtotal ?? 0,
      order.bill?.discount ?? 0,
      order.bill?.gst ?? 0,
      order.bill?.totalPayable ?? 0,
      order.payment?.method ?? '',
      order.payment?.cashAmount ?? 0,
      order.payment?.upiAmount ?? 0,
      userMap[order.openedBy] || order.openedBy,
      order.payment?.paidAt ?? '',
      order.void?.reason ?? '',
    ]

    rows.push(row.map(escapeCsvField).join(','))
  }

  return rows.join('\n')
}

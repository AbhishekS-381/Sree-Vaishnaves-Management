/**
 * Pure utility functions for formatting POS receipts and KOT kitchen slips
 * for thermal printers (58mm / 80mm) and text/HTML print views.
 */

import type { PosOrder, PosKot } from '@/app/actions/posTypes'

export type ReceiptWidth = '58mm' | '80mm'

export interface ReceiptOptions {
  width?: ReceiptWidth
  restaurantName?: string
  branchName?: string
  branchAddress?: string
  gstin?: string
  fssai?: string
  tableName?: string
  cashierName?: string
  waiterName?: string
  isReprint?: boolean
}

const LINE_WIDTHS: Record<ReceiptWidth, number> = {
  '58mm': 32,
  '80mm': 42,
}

function centerText(text: string, width: number): string {
  if (text.length >= width) return text.slice(0, width)
  const leftPad = Math.floor((width - text.length) / 2)
  const rightPad = width - text.length - leftPad
  return ' '.repeat(leftPad) + text + ' '.repeat(rightPad)
}

function justifyText(left: string, right: string, width: number): string {
  const combined = left.length + right.length
  if (combined >= width) {
    const availableLeft = width - right.length - 1
    const truncatedLeft = availableLeft > 0 ? left.slice(0, availableLeft) : ''
    const spaces = Math.max(1, width - truncatedLeft.length - right.length)
    return truncatedLeft + ' '.repeat(spaces) + right
  }
  const spaces = width - combined
  return left + ' '.repeat(spaces) + right
}

function divider(char: string, width: number): string {
  return char.repeat(width)
}

/**
 * Formats a thermal printable receipt string for customer billing.
 */
export function formatThermalReceipt(order: PosOrder, options: ReceiptOptions = {}): string {
  const width = LINE_WIDTHS[options.width || '80mm']
  const lines: string[] = []

  // Header
  const restName = options.restaurantName || 'SREE VAISHNAVES'
  lines.push(centerText(restName, width))
  if (options.branchName) {
    lines.push(centerText(options.branchName, width))
  }
  if (options.branchAddress) {
    lines.push(centerText(options.branchAddress, width))
  }
  if (options.gstin) {
    lines.push(centerText(`GSTIN: ${options.gstin}`, width))
  }
  if (options.fssai) {
    lines.push(centerText(`FSSAI Lic: ${options.fssai}`, width))
  }

  lines.push(divider('=', width))

  // Reprint Watermark
  if (options.isReprint) {
    lines.push(centerText('*** DUPLICATE / REPRINT ***', width))
    lines.push(divider('-', width))
  }

  // Order Details
  const orderIdentifier = order.orderType === 'dine-in'
    ? `TABLE: ${options.tableName || 'Dine-In'}`
    : `TAKEAWAY: ${order.takeawayNumber || 'Takeaway'}`
  lines.push(justifyText(`ORDER: #${order.id.slice(-6).toUpperCase()}`, orderIdentifier, width))

  const dateStr = order.date || new Date().toISOString().slice(0, 10)
  lines.push(justifyText(`DATE: ${dateStr}`, `STATUS: ${order.status.toUpperCase()}`, width))

  if (options.cashierName) {
    lines.push(justifyText(`CASHIER: ${options.cashierName}`, options.waiterName ? `WAITER: ${options.waiterName}` : '', width))
  }

  lines.push(divider('-', width))

  // Items Header
  lines.push(justifyText('ITEM', 'QTY   AMT', width))
  lines.push(divider('-', width))

  // Items List
  for (const item of order.items) {
    const qtyPrice = `${item.quantity}  ₹${item.quantity * item.unitPrice}`
    lines.push(justifyText(item.nameSnapshot, qtyPrice, width))
    if (item.note) {
      lines.push(`  * ${item.note.slice(0, width - 4)}`)
    }
  }

  lines.push(divider('-', width))

  // Financial Summary
  const subtotal = order.bill?.subtotal ?? order.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
  lines.push(justifyText('Subtotal:', `₹${subtotal}`, width))

  if (order.bill?.discount && order.bill.discount > 0) {
    lines.push(justifyText('Discount:', `-₹${order.bill.discount}`, width))
  }

  if (order.bill?.gst && order.bill.gst > 0) {
    const halfGst = (order.bill.gst / 2).toFixed(2)
    lines.push(justifyText('CGST (2.5%):', `₹${halfGst}`, width))
    lines.push(justifyText('SGST (2.5%):', `₹${halfGst}`, width))
  }

  lines.push(divider('=', width))
  const total = order.bill?.totalPayable ?? subtotal
  lines.push(justifyText('NET PAYABLE:', `₹${total}`, width))
  lines.push(divider('=', width))

  // Payment Breakdown
  if (order.payment) {
    lines.push(justifyText('PAYMENT METHOD:', order.payment.method.toUpperCase(), width))
    if (order.payment.method === 'split') {
      lines.push(justifyText('  Cash Paid:', `₹${order.payment.cashAmount}`, width))
      lines.push(justifyText('  UPI Paid:', `₹${order.payment.upiAmount}`, width))
    }
  }

  // Footer
  lines.push(divider('-', width))
  lines.push(centerText('Thank you for dining with us!', width))
  lines.push(centerText('Please visit again', width))

  return lines.join('\n')
}

/**
 * Formats a KOT (Kitchen Order Ticket) slip for kitchen thermal printers.
 */
export function formatKotSlip(kot: PosKot, orderIdentifier: string, widthType: ReceiptWidth = '80mm'): string {
  const width = LINE_WIDTHS[widthType]
  const lines: string[] = []

  lines.push(centerText('*** KITCHEN ORDER TICKET ***', width))
  lines.push(divider('=', width))

  lines.push(justifyText(`KOT #${kot.kotNumber}`, orderIdentifier.toUpperCase(), width))
  lines.push(justifyText(`TIME: ${new Date(kot.firedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, `STATUS: ${kot.status.toUpperCase()}`, width))
  lines.push(divider('-', width))

  lines.push(justifyText('ITEM', 'QTY', width))
  lines.push(divider('-', width))

  for (const item of kot.items) {
    lines.push(justifyText(item.nameSnapshot, `x${item.quantity}`, width))
    if (item.note) {
      lines.push(`  NOTE: ${item.note}`)
    }
  }

  lines.push(divider('=', width))
  return lines.join('\n')
}

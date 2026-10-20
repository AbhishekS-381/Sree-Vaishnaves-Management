'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Printer, Copy, Check, X, SlidersHorizontal, FileText } from 'lucide-react'
import type { PosOrder } from '@/app/actions/posTypes'
import { formatThermalReceipt, type ReceiptWidth } from '@/lib/posReceipt'

export interface ReceiptPrintModalProps {
  isOpen: boolean
  onClose: () => void
  order: PosOrder | null
  branch?: { id?: string; name?: string; address?: string; phone?: string } | null
  tableName?: string
  cashierName?: string
  waiterName?: string
  isReprint?: boolean
  autoPrint?: boolean
}

export function ReceiptPrintModal({
  isOpen,
  onClose,
  order,
  branch,
  tableName,
  cashierName,
  waiterName,
  isReprint = false,
  autoPrint = false,
}: ReceiptPrintModalProps) {
  const [receiptWidth, setReceiptWidth] = useState<ReceiptWidth>('80mm')
  const [copied, setCopied] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Toggle .pos-printing class on document.body to cleanly isolate receipt in print
  useEffect(() => {
    if (isOpen && order && typeof document !== 'undefined') {
      document.body.classList.add('pos-printing')
      return () => {
        document.body.classList.remove('pos-printing')
      }
    }
  }, [isOpen, order])

  // Auto-print effect when triggered from payment settlement
  useEffect(() => {
    if (isOpen && autoPrint && order) {
      const timer = setTimeout(() => {
        if (typeof window !== 'undefined') {
          window.print()
        }
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [isOpen, autoPrint, order])

  if (!isOpen || !order) return null

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print()
    }
  }

  const handleCopyRaw = async () => {
    const rawText = formatThermalReceipt(order, {
      width: receiptWidth,
      restaurantName: 'SREE VAISHNAVES',
      branchName: branch?.name,
      branchAddress: branch?.address,
      tableName: tableName || (order.tableId ? `Table ${order.tableId}` : order.takeawayNumber || 'Takeaway'),
      cashierName,
      waiterName,
      isReprint,
    })

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(rawText)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    } catch {
      // Clipboard write failed fallback
    }
  }

  const orderIdentifier = order.orderType === 'dine-in'
    ? (tableName || (order.tableId ? `Table ${order.tableId}` : 'Dine-In'))
    : (order.takeawayNumber ? `Takeaway ${order.takeawayNumber}` : 'Takeaway')

  const subtotal = order.bill?.subtotal ?? order.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
  const discount = order.bill?.discount ?? 0
  const gst = order.bill?.gst ?? 0
  const totalPayable = order.bill?.totalPayable ?? Math.max(0, subtotal - discount + gst)
  const isPaid = order.status === 'paid'

  return (
    <>
      {/* ── Screen Modal (Interactive Preview & Controls) ──────────────── */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto print:hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="receipt-modal-title"
      >
        <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-5 shadow-2xl flex flex-col gap-4 max-h-[90vh]">
          {/* Header & Controls */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Printer className="w-5 h-5" />
              </div>
              <div>
                <h3 id="receipt-modal-title" className="text-base font-bold text-white">
                  {isPaid ? 'Customer Receipt' : 'Customer Bill'}
                </h3>
                <p className="text-xs text-slate-400">
                  Order #{order.id.slice(-6).toUpperCase()} &bull; {orderIdentifier}
                </p>
              </div>
            </div>

            {/* Width Toggle */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500 ml-1.5" />
              <button
                type="button"
                onClick={() => setReceiptWidth('80mm')}
                className={`px-2 py-1 rounded-lg font-semibold transition-all ${
                  receiptWidth === '80mm'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                80mm
              </button>
              <button
                type="button"
                onClick={() => setReceiptWidth('58mm')}
                className={`px-2 py-1 rounded-lg font-semibold transition-all ${
                  receiptWidth === '58mm'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                58mm
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors ml-1"
                aria-label="Close receipt preview"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Receipt Paper Preview Container */}
          <div className="overflow-y-auto flex justify-center py-2 bg-slate-950/80 rounded-xl p-3 border border-slate-800/80">
            <div
              className={`bg-white text-slate-900 rounded-xl shadow-2xl p-5 font-mono text-xs transition-all ${
                receiptWidth === '58mm' ? 'w-[280px]' : 'w-[360px]'
              }`}
            >
              {/* Restaurant Header */}
              <div className="text-center pb-3 border-b border-dashed border-slate-300">
                <h4 className="font-extrabold text-sm tracking-wide text-slate-950 uppercase">
                  SREE VAISHNAVES
                </h4>
                {branch?.name && (
                  <p className="text-[11px] font-semibold text-slate-700">{branch.name}</p>
                )}
                {branch?.address && (
                  <p className="text-[10px] text-slate-500 leading-tight mt-0.5">{branch.address}</p>
                )}
                {branch?.phone && (
                  <p className="text-[10px] text-slate-500">Ph: {branch.phone}</p>
                )}

                {isReprint && (
                  <div className="mt-2 py-0.5 bg-amber-100 border border-amber-300 text-amber-900 font-bold text-[10px] uppercase tracking-wider rounded">
                    *** DUPLICATE / REPRINT ***
                  </div>
                )}
              </div>

              {/* Order Meta */}
              <div className="py-2.5 border-b border-dashed border-slate-300 text-[11px] space-y-1">
                <div className="flex justify-between font-bold">
                  <span>ORDER: #{order.id.slice(-6).toUpperCase()}</span>
                  <span className="uppercase text-slate-900">{orderIdentifier}</span>
                </div>
                <div className="flex justify-between text-slate-600 text-[10px]">
                  <span>DATE: {order.date || new Date().toISOString().slice(0, 10)}</span>
                  <span className="font-bold uppercase text-slate-800">
                    {order.status.toUpperCase()}
                  </span>
                </div>
                {cashierName && (
                  <div className="flex justify-between text-slate-600 text-[10px]">
                    <span>CASHIER: {cashierName}</span>
                    {waiterName && <span>WAITER: {waiterName}</span>}
                  </div>
                )}
              </div>

              {/* Items Table */}
              <div className="py-2 border-b border-dashed border-slate-300">
                <div className="flex justify-between font-bold text-[10px] text-slate-700 pb-1 border-b border-slate-200">
                  <span className="w-1/2">ITEM</span>
                  <span className="w-1/6 text-center">QTY</span>
                  <span className="w-1/3 text-right">AMT</span>
                </div>
                <div className="divide-y divide-slate-100 pt-1">
                  {order.items.map((item, idx) => (
                    <div key={item.id || idx} className="py-1">
                      <div className="flex justify-between text-[11px] leading-tight">
                        <span className="w-1/2 font-semibold text-slate-900 truncate pr-1">
                          {item.nameSnapshot}
                        </span>
                        <span className="w-1/6 text-center text-slate-700">
                          {item.quantity}
                        </span>
                        <span className="w-1/3 text-right font-bold text-slate-900">
                          ₹{item.quantity * item.unitPrice}
                        </span>
                      </div>
                      {item.note && (
                        <p className="text-[9px] text-slate-500 italic pl-1">&bull; {item.note}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Financials Breakdown */}
              <div className="py-2.5 border-b border-dashed border-slate-300 text-[11px] space-y-1">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal:</span>
                  <span>₹{subtotal}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-emerald-700 font-semibold">
                    <span>Discount:</span>
                    <span>-₹{discount}</span>
                  </div>
                )}
                {gst > 0 && (
                  <>
                    <div className="flex justify-between text-slate-600 text-[10px]">
                      <span>CGST (2.5%):</span>
                      <span>₹{(gst / 2).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600 text-[10px]">
                      <span>SGST (2.5%):</span>
                      <span>₹{(gst / 2).toFixed(2)}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between text-sm font-extrabold text-slate-950 pt-1.5 border-t border-slate-300">
                  <span>NET PAYABLE:</span>
                  <span>₹{totalPayable}</span>
                </div>
              </div>

              {/* Payment Details */}
              {order.payment && (
                <div className="py-2 border-b border-dashed border-slate-300 text-[10px] space-y-0.5">
                  <div className="flex justify-between font-bold text-slate-800">
                    <span>PAID VIA:</span>
                    <span className="uppercase">{order.payment.method}</span>
                  </div>
                  {order.payment.method === 'split' && (
                    <div className="flex justify-between text-slate-600">
                      <span>Cash: ₹{order.payment.cashAmount}</span>
                      <span>UPI: ₹{order.payment.upiAmount}</span>
                    </div>
                  )}
                  {order.payment.paidAt && (
                    <p className="text-[9px] text-slate-400 text-right">
                      Paid: {new Date(order.payment.paidAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
              )}

              {/* Footer Note */}
              <div className="pt-3 text-center text-[10px] text-slate-500 leading-tight">
                <p className="font-semibold text-slate-700">Thank you for dining with us!</p>
                <p>Please visit again</p>
              </div>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={handleCopyRaw}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors border border-slate-700"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied Text!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Raw Slip</span>
                </>
              )}
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="flex items-center gap-2 px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl shadow-lg shadow-amber-500/20 transition-all active:scale-95"
              >
                <Printer className="w-4 h-4" />
                <span>Print Bill</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Native Thermal Print Container (@media print) ─────────────── */}
      {(() => {
        const printReceiptNode = (
          <div
            id="pos-print-receipt"
            className={`hidden print:block font-mono text-black bg-white ${
              receiptWidth === '58mm' ? 'w-[58mm]' : 'w-[80mm]'
            } p-3 text-xs leading-tight`}
          >
            <div className="text-center pb-2 border-b border-black">
              <p className="font-extrabold text-sm uppercase">SREE VAISHNAVES</p>
              {branch?.name && <p className="text-[11px] font-semibold">{branch.name}</p>}
              {branch?.address && <p className="text-[9px]">{branch.address}</p>}
              {branch?.phone && <p className="text-[9px]">Ph: {branch.phone}</p>}
              {isReprint && (
                <p className="font-bold text-[10px] mt-1 border-t border-b border-black py-0.5 uppercase">
                  *** DUPLICATE / REPRINT ***
                </p>
              )}
            </div>

            <div className="py-2 border-b border-black text-[10px] space-y-0.5">
              <div className="flex justify-between font-bold">
                <span>ORDER: #{order.id.slice(-6).toUpperCase()}</span>
                <span>{orderIdentifier}</span>
              </div>
              <div className="flex justify-between text-[9px]">
                <span>DATE: {order.date || new Date().toISOString().slice(0, 10)}</span>
                <span>STATUS: {order.status.toUpperCase()}</span>
              </div>
              {cashierName && (
                <div className="flex justify-between text-[9px]">
                  <span>CASHIER: {cashierName}</span>
                  {waiterName && <span>WAITER: {waiterName}</span>}
                </div>
              )}
            </div>

            <div className="py-2 border-b border-black">
              <div className="flex justify-between font-bold text-[9px] border-b border-black pb-0.5 mb-1">
                <span className="w-1/2">ITEM</span>
                <span className="w-1/6 text-center">QTY</span>
                <span className="w-1/3 text-right">AMT</span>
              </div>
              {order.items.map((item, idx) => (
                <div key={item.id || idx} className="py-0.5">
                  <div className="flex justify-between text-[10px]">
                    <span className="w-1/2 font-semibold truncate pr-1">{item.nameSnapshot}</span>
                    <span className="w-1/6 text-center">{item.quantity}</span>
                    <span className="w-1/3 text-right font-bold">₹{item.quantity * item.unitPrice}</span>
                  </div>
                  {item.note && <p className="text-[8px] pl-1">* {item.note}</p>}
                </div>
              ))}
            </div>

            <div className="py-2 border-b border-black text-[10px] space-y-0.5">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>₹{subtotal}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between font-semibold">
                  <span>Discount:</span>
                  <span>-₹{discount}</span>
                </div>
              )}
              {gst > 0 && (
                <>
                  <div className="flex justify-between text-[9px]">
                    <span>CGST (2.5%):</span>
                    <span>₹{(gst / 2).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[9px]">
                    <span>SGST (2.5%):</span>
                    <span>₹{(gst / 2).toFixed(2)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between text-xs font-bold pt-1 border-t border-black">
                <span>TOTAL:</span>
                <span>₹{totalPayable}</span>
              </div>
            </div>

            {order.payment && (
              <div className="py-1 border-b border-black text-[9px]">
                <div className="flex justify-between font-semibold">
                  <span>PAYMENT:</span>
                  <span className="uppercase">{order.payment.method}</span>
                </div>
                {order.payment.method === 'split' && (
                  <div className="flex justify-between">
                    <span>Cash: ₹{order.payment.cashAmount}</span>
                    <span>UPI: ₹{order.payment.upiAmount}</span>
                  </div>
                )}
              </div>
            )}

            <div className="pt-2 text-center text-[9px]">
              <p className="font-semibold">Thank you for dining with us!</p>
              <p>Please visit again</p>
            </div>
          </div>
        )

        return mounted && typeof document !== 'undefined'
          ? createPortal(printReceiptNode, document.body)
          : printReceiptNode
      })()}
    </>
  )
}

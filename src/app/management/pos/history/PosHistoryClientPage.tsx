'use client'

import React, { useState, useEffect, useTransition, useCallback } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Search,
  Receipt,
  Printer,
  LayoutDashboard,
  LogOut,
} from 'lucide-react'
import { logout } from '@/app/actions/auth'
import { useToast, ToastStack } from '@/components/Toast'
import { getPosOrderHistory } from '@/app/actions/pos'
import type { PosOrder } from '@/app/actions/posTypes'
import { ReceiptPrintModal } from '@/components/ReceiptPrintModal'

function todayIST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
}

export default function PosHistoryClientPage({
  branches,
  tableMap = {},
  userMap = {},
}: {
  branches: { id: string; name: string }[]
  tableMap?: Record<string, string>
  userMap?: Record<string, string>
  session?: { userId: string; name: string; role: string; isGlobalAdmin?: boolean }
}) {
  const { messages, dismiss, error } = useToast()
  const [isPending, startTransition] = useTransition()

  const today = todayIST()
  const [selectedBranchId, setSelectedBranchId] = useState<string>(branches[0]?.id || '')
  const [fromDate, setFromDate] = useState<string>(today)
  const [toDate, setToDate] = useState<string>(today)

  const [orders, setOrders] = useState<PosOrder[]>([])
  const [summary, setSummary] = useState<{
    totalRevenue: number
    billCount: number
    avgOrderValue: number
    totalVoids: number
    totalDiscounts: number
  } | null>(null)
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)

  // Print Receipt Modal
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false)
  const [printOrder, setPrintOrder] = useState<PosOrder | null>(null)

  const activeBranch = branches.find(b => b.id === selectedBranchId) || branches[0] || null

  const fetchHistory = useCallback((branchId: string, from: string, to: string) => {
    if (!branchId || !from || !to) return
    startTransition(async () => {
      const res = await getPosOrderHistory(branchId, from, to)
      setHasSearched(true)
      if ('error' in res) {
        error(res.error || 'Failed to fetch history')
      } else {
        setOrders(res.orders)
        setSummary(res.summary)
      }
    })
  }, [error])

  // Initial load
  useEffect(() => {
    if (selectedBranchId) {
      fetchHistory(selectedBranchId, fromDate, toDate)
    }
  }, [selectedBranchId, fromDate, toDate, fetchHistory])

  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    fetchHistory(selectedBranchId, fromDate, toDate)
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6 gap-6">
      <ToastStack messages={messages} onDismiss={dismiss} />

      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <Link
            href="/management/pos"
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              Order History & Audit
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-semibold">
                Owner / Admin
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Query historical orders, revenue aggregates, and transaction audit trails
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/management"
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-sm font-semibold rounded-xl transition-all"
            title="Back to Management Portal"
          >
            <LayoutDashboard className="w-4 h-4 text-indigo-400" />
            <span className="hidden sm:inline">Dashboard</span>
          </Link>

          {/* Logout Button (Req 2) */}
          <button
            onClick={() => logout()}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-sm font-semibold rounded-xl transition-all"
            title="Logout from POS"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Filters Form */}
      <form
        onSubmit={handleFilterSubmit}
        className="bg-slate-900 border border-slate-800 rounded-2xl p-4 md:p-5 shadow-xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end"
      >
        <div>
          <label className="text-xs font-semibold text-slate-300 block mb-1.5">Branch</label>
          <select
            value={selectedBranchId}
            onChange={e => setSelectedBranchId(e.target.value)}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            {branches.map(b => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-300 block mb-1.5">From Date</label>
          <input
            type="date"
            required
            value={fromDate}
            onChange={e => setFromDate(e.target.value)}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-300 block mb-1.5">To Date</label>
          <input
            type="date"
            required
            value={toDate}
            onChange={e => setToDate(e.target.value)}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div>
          <button
            type="submit"
            disabled={isPending}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-sm font-semibold transition-all shadow-md shadow-amber-600/20"
          >
            <Search className="w-4 h-4" />
            {isPending ? 'Searching...' : 'Filter Records'}
          </button>
        </div>
      </form>

      {/* Summary Row (Req 7.6) */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl">
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <span className="text-xs text-slate-400 font-medium">Total Revenue</span>
            <p className="text-xl font-bold text-emerald-400">₹{summary.totalRevenue}</p>
          </div>
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <span className="text-xs text-slate-400 font-medium">Bills Settled</span>
            <p className="text-xl font-bold text-white">{summary.billCount}</p>
          </div>
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <span className="text-xs text-slate-400 font-medium">Avg Order Value</span>
            <p className="text-xl font-bold text-blue-400">₹{summary.avgOrderValue}</p>
          </div>
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <span className="text-xs text-slate-400 font-medium">Total Discounts</span>
            <p className="text-xl font-bold text-amber-400">₹{summary.totalDiscounts}</p>
          </div>
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <span className="text-xs text-slate-400 font-medium">Orders Voided</span>
            <p className="text-xl font-bold text-red-400">{summary.totalVoids}</p>
          </div>
        </div>
      )}

      {/* Order List */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 md:p-6 shadow-xl">
        <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Receipt className="w-4 h-4 text-amber-400" />
          Matching Transactions ({orders.length})
        </h2>

        {hasSearched && orders.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-slate-800 rounded-xl">
            <Receipt className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-400 font-medium">No orders found for the selected date range and branch.</p>
            <p className="text-xs text-slate-500 mt-1">Try expanding your date range filter.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {orders.map(order => {
              const isExpanded = expandedOrderId === order.id
              const totalAmount = order.bill?.totalPayable ?? 0

              return (
                <div
                  key={order.id}
                  className="rounded-xl border border-slate-800 bg-slate-950/50 overflow-hidden transition-all"
                >
                  <div
                    onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                    className="p-4 flex flex-wrap items-center justify-between gap-4 cursor-pointer hover:bg-slate-900/60 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-amber-400 text-xs">
                        {order.orderType === 'dine-in' ? 'TBL' : 'TKW'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-white text-base">
                            {(order.tableId && tableMap[order.tableId]) ? tableMap[order.tableId] : (order.takeawayNumber || (order.orderType === 'dine-in' ? 'Table' : 'Takeaway'))}
                          </h3>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                              order.status === 'paid'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                : order.status === 'voided'
                                ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                                : order.status === 'billed'
                                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                            }`}
                          >
                            {order.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Date: {order.date} &bull; Opened By: {userMap[order.openedBy] || order.openedBy} &bull; {order.items.length} item(s)
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-base font-bold text-white">₹{totalAmount}</p>
                        <p className="text-xs text-slate-400 uppercase font-semibold">
                          {order.payment?.method || (order.status === 'voided' ? 'Voided' : 'Unpaid')}
                        </p>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                  </div>

                  {/* Expanded Breakdown */}
                  {isExpanded && (
                    <div className="p-4 bg-slate-900 border-t border-slate-800 text-xs flex flex-col gap-3">
                      <h4 className="font-bold text-slate-300 uppercase tracking-wider text-[11px]">
                        Order Items Breakdown
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {order.items.map(item => (
                          <div
                            key={item.id}
                            className="flex justify-between items-center p-2 rounded-lg bg-slate-950 border border-slate-800"
                          >
                            <span>
                              {item.nameSnapshot} &times; {item.quantity}
                            </span>
                            <span className="font-semibold text-white">
                              ₹{item.unitPrice * item.quantity}
                            </span>
                          </div>
                        ))}
                      </div>

                      {order.bill && (
                        <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex flex-wrap justify-between gap-4 text-slate-300 mt-2">
                          <div>Subtotal: ₹{order.bill.subtotal}</div>
                          <div>Discount: ₹{order.bill.discount}</div>
                          <div>GST: ₹{order.bill.gst}</div>
                          <div className="font-bold text-emerald-400">Total: ₹{order.bill.totalPayable}</div>
                        </div>
                      )}

                      {order.payment && (
                        <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex flex-wrap justify-between gap-4 text-slate-300">
                          <div>Payment Method: <span className="uppercase font-bold">{order.payment.method}</span></div>
                          <div>Cash Amount: ₹{order.payment.cashAmount}</div>
                          <div>UPI Amount: ₹{order.payment.upiAmount}</div>
                          <div>Settled At: {order.payment.paidAt}</div>
                        </div>
                      )}

                      {order.void && (
                        <div className="p-3 bg-red-950/30 rounded-xl border border-red-500/30 text-red-300 flex flex-col gap-1">
                          <span className="font-bold">Void Information:</span>
                          <p>Reason: &ldquo;{order.void.reason}&rdquo;</p>
                          <p className="text-[11px] text-red-400/80">
                            Voided by: {userMap[order.void.voidedBy] || order.void.voidedBy} at {order.void.voidedAt}
                          </p>
                        </div>
                      )}

                      {order.bill && (
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setPrintOrder(order)
                              setIsPrintModalOpen(true)
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition-all shadow-sm active:scale-95"
                          >
                            <Printer className="w-3.5 h-3.5 text-amber-400" />
                            <span>Print Receipt</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Bill / Receipt Print Modal */}
      <ReceiptPrintModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        order={printOrder}
        branch={activeBranch}
        tableName={printOrder?.orderType === 'dine-in' ? (tableMap[printOrder.tableId || ''] || 'Table') : (printOrder?.takeawayNumber || 'Takeaway')}
        isReprint={true}
      />
    </div>
  )
}

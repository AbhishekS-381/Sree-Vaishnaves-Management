'use client'

import React, { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Receipt,
  Clock,
  CheckCircle2,
  CreditCard,
  PlusCircle,
  Printer,
  LogOut,
  UtensilsCrossed,
  LayoutDashboard,
} from 'lucide-react'
import { logout } from '@/app/actions/auth'
import { useToast, ToastStack } from '@/components/Toast'
import type { PosOrder } from '@/app/actions/posTypes'
import { recordPayment, generateBill } from '@/app/actions/pos'
import { ReceiptPrintModal } from '@/components/ReceiptPrintModal'

export default function BillingClientPage({
  branches = [],
  activeBranchId,
  billedOrders,
  paidOrders,
  openOrders,
  tableMap,
  session,
  posDefaultGstPercent,
}: {
  branches?: { id: string; name: string; address?: string; phone?: string }[]
  activeBranchId?: string

  billedOrders: PosOrder[]
  paidOrders: PosOrder[]
  openOrders: PosOrder[]
  tableMap: Record<string, string>
  session: { userId: string; name: string; role: string; isGlobalAdmin?: boolean }
  posDefaultGstPercent: number
}) {
  const router = useRouter()
  const { messages, dismiss, success, error } = useToast()
  const [isPending, startTransition] = useTransition()

  // Selected billed order for payment collection
  const [selectedBilledOrderId, setSelectedBilledOrderId] = useState<string | null>(
    billedOrders[0]?.id || null
  )

  // Payment form state
  const initialPayable = billedOrders[0]?.bill?.totalPayable ?? 0
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi' | 'split'>('cash')
  const [splitCash, setSplitCash] = useState<number>(initialPayable)
  const [splitUpi, setSplitUpi] = useState<number>(0)
  const [cashTendered, setCashTendered] = useState<number>(initialPayable)
  const [changeDueDisplay, setChangeDueDisplay] = useState<number | null>(billedOrders[0]?.bill ? 0 : null)

  // Secondary "Bill an open order" drawer / modal
  const [selectedOpenOrderId, setSelectedOpenOrderId] = useState<string>('')
  const [discountInput, setDiscountInput] = useState<number>(0)
  const [gstInput, setGstInput] = useState<number>(0)
  const [isBillOpenOrderModalOpen, setIsBillOpenOrderModalOpen] = useState(false)
  const [confirmZeroBill, setConfirmZeroBill] = useState(false)

  // Receipt Printing state (Payment Phase)
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false)
  const [printOrder, setPrintOrder] = useState<PosOrder | null>(null)
  const [isReprintMode, setIsReprintMode] = useState(false)
  const [autoPrintTrigger, setAutoPrintTrigger] = useState(false)
  const [autoPrintOnSettlement, setAutoPrintOnSettlement] = useState(true)
  const [isSettleAndPrint, setIsSettleAndPrint] = useState(false)

  const currentBranch = useMemo(() => {
    return branches.find(b => b.id === activeBranchId) || branches[0] || null
  }, [branches, activeBranchId])

  const handleOpenPrintModal = (order: PosOrder, isReprint = false, autoPrint = false) => {
    setPrintOrder(order)
    setIsReprintMode(isReprint)
    setAutoPrintTrigger(autoPrint)
    setIsPrintModalOpen(true)
  }

  // Running totals strip (Req 14.8)
  const runningTotals = useMemo(() => {
    let totalCash = 0
    let totalUpi = 0
    for (const o of paidOrders) {
      if (o.payment) {
        totalCash += o.payment.cashAmount || 0
        totalUpi += o.payment.upiAmount || 0
      }
    }
    return {
      totalCash,
      totalUpi,
      totalRevenue: totalCash + totalUpi,
      paidCount: paidOrders.length,
    }
  }, [paidOrders])

  const selectedOrder = useMemo(() => {
    return billedOrders.find(o => o.id === selectedBilledOrderId) || null
  }, [billedOrders, selectedBilledOrderId])

  const getOrderIdentifier = (order: PosOrder) => {
    if (order.tableId && tableMap[order.tableId]) return tableMap[order.tableId]
    if (order.takeawayNumber) return order.takeawayNumber
    return 'Order'
  }

  const handleSelectBilledOrder = (order: PosOrder) => {
    setSelectedBilledOrderId(order.id)
    setPaymentMethod('cash')
    const payable = order.bill?.totalPayable ?? 0
    setSplitCash(payable)
    setSplitUpi(0)
    setCashTendered(payable)
    setChangeDueDisplay(0)
  }

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedOrder?.bill) return

    const orderToSettle = selectedOrder
    const shouldPrint = isSettleAndPrint || autoPrintOnSettlement

    const formData = new FormData()
    formData.set('orderId', selectedOrder.id)
    formData.set('method', paymentMethod)
    if (paymentMethod === 'cash') {
      formData.set('cashAmount', String(selectedOrder.bill.totalPayable))
      formData.set('upiAmount', '0')
      formData.set('cashTendered', String(cashTendered))
    } else if (paymentMethod === 'upi') {
      formData.set('cashAmount', '0')
      formData.set('upiAmount', String(selectedOrder.bill.totalPayable))
      formData.set('cashTendered', '0')
    } else {
      formData.set('cashAmount', String(splitCash))
      formData.set('upiAmount', String(splitUpi))
      formData.set('cashTendered', String(cashTendered))
    }

    startTransition(async () => {
      const res = await recordPayment(null, formData)
      if (res?.error) {
        error(res.error)
      } else {
        success(`Payment recorded! Change Due: ₹${res?.changeDue ?? 0}`)
        setSelectedBilledOrderId(null)
        if (shouldPrint && orderToSettle) {
          const paidSnapshot: PosOrder = {
            ...orderToSettle,
            status: 'paid',
            payment: {
              method: paymentMethod,
              cashAmount: paymentMethod === 'cash' ? orderToSettle.bill!.totalPayable : (paymentMethod === 'split' ? splitCash : 0),
              upiAmount: paymentMethod === 'upi' ? orderToSettle.bill!.totalPayable : (paymentMethod === 'split' ? splitUpi : 0),
              paidAt: new Date().toISOString(),
            },
          }
          handleOpenPrintModal(paidSnapshot, false, true)
        }
        router.refresh()
      }
    })
  }

  // Open order billing
  const handleOpenBillDrawer = (orderId: string) => {
    setSelectedOpenOrderId(orderId)
    const order = openOrders.find(o => o.id === orderId)
    if (!order) return
    const subtotal = order.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
    const suggestedGst = posDefaultGstPercent > 0 ? Math.round((subtotal * posDefaultGstPercent) / 100) : 0
    setDiscountInput(0)
    setGstInput(suggestedGst)
    setConfirmZeroBill(false)
    setIsBillOpenOrderModalOpen(true)
  }

  const handleGenerateBillSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedOpenOrderId) return

    const formData = new FormData()
    formData.set('orderId', selectedOpenOrderId)
    formData.set('discount', String(discountInput))
    formData.set('gst', String(gstInput))
    if (confirmZeroBill) {
      formData.set('confirmed', 'true')
    }

    startTransition(async () => {
      const res = await generateBill(null, formData)
      if (res?.error) {
        if (res.error === 'ZERO_BILL_CONFIRM_REQUIRED') {
          setConfirmZeroBill(true)
        } else {
          error(res.error)
        }
      } else {
        success('Bill generated! Added to payment queue.')
        setIsBillOpenOrderModalOpen(false)
        setSelectedBilledOrderId(selectedOpenOrderId)
        setSelectedOpenOrderId('')
        router.refresh()
      }
    })
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6 gap-6">
      <ToastStack messages={messages} onDismiss={dismiss} />

      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400">
            <Receipt className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              Billing & Settlement Station
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-semibold">
                Cashier
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Cashier: {session.name} ({session.role})
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {session.role !== 'billing' && (
            <>
              <Link
                href={activeBranchId ? `/management/pos?branch=${activeBranchId}` : '/management/pos'}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-sm font-semibold rounded-xl transition-all"
                title="POS Register"
              >
                <UtensilsCrossed className="w-4 h-4 text-amber-400" />
                <span>POS</span>
              </Link>
              {Boolean(session.isGlobalAdmin || session.role === 'admin' || session.role === 'owner') && (
                <Link
                  href="/management"
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-sm font-semibold rounded-xl transition-all"
                  title="Back to Management Portal"
                >
                  <LayoutDashboard className="w-4 h-4 text-indigo-400" />
                  <span className="hidden lg:inline">Dashboard</span>
                </Link>
              )}
            </>
          )}

          {session.isGlobalAdmin && branches && branches.length > 1 && (
            <select
              value={activeBranchId}
              onChange={e => router.push(`/management/pos/billing?branch=${e.target.value}`)}
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm font-medium text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {branches.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}

          {openOrders.filter(o => o.items.length > 0).length > 0 && (
            <button
              onClick={() => {
                const firstOpen = openOrders.find(o => o.items.length > 0)
                if (firstOpen) handleOpenBillDrawer(firstOpen.id)
              }}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-all shadow-md shadow-blue-600/20"
            >
              <PlusCircle className="w-4 h-4" />
              Bill an Open Order ({openOrders.filter(o => o.items.length > 0).length})
            </button>
          )}

          {/* Logout Button (Req 2) */}
          <button
            onClick={() => logout()}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-sm font-semibold rounded-xl transition-all"
            title="Logout from Billing Station"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Running Totals Strip (Req 14.8) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl">
        <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
          <span className="text-xs text-slate-400 font-medium">Total Cash Collected</span>
          <p className="text-xl font-bold text-emerald-400">₹{runningTotals.totalCash}</p>
        </div>
        <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
          <span className="text-xs text-slate-400 font-medium">Total UPI Collected</span>
          <p className="text-xl font-bold text-blue-400">₹{runningTotals.totalUpi}</p>
        </div>
        <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
          <span className="text-xs text-slate-400 font-medium">Total Revenue Today</span>
          <p className="text-xl font-bold text-white">₹{runningTotals.totalRevenue}</p>
        </div>
        <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
          <span className="text-xs text-slate-400 font-medium">Bills Settled Today</span>
          <p className="text-xl font-bold text-amber-400">{runningTotals.paidCount}</p>
        </div>
      </div>

      {/* Main Content: Left = Billed Queue, Right = Payment Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Billed Orders Queue */}
        <div className="lg:col-span-6 flex flex-col gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 md:p-6 shadow-xl">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              Pending Payment Queue ({billedOrders.length})
            </h2>

            {billedOrders.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-slate-800 rounded-xl">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-60" />
                <p className="text-sm text-slate-400 font-medium">No pending bills waiting for payment.</p>
                <p className="text-xs text-slate-500 mt-1">
                  When a server generates a bill, it will appear here immediately for settlement.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {billedOrders.map(order => {
                  const isSelected = order.id === selectedBilledOrderId
                  const identifier = getOrderIdentifier(order)
                  const generatedTime = order.bill?.generatedAt
                    ? new Date(order.bill.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : ''

                  return (
                    <div
                      key={order.id}
                      onClick={() => handleSelectBilledOrder(order)}
                      className={`cursor-pointer p-4 rounded-xl border transition-all flex items-center justify-between ${
                        isSelected
                          ? 'bg-slate-800 border-emerald-500 ring-2 ring-emerald-500/20'
                          : 'bg-slate-950/50 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold text-sm">
                          {identifier.slice(0, 3)}
                        </div>
                        <div>
                          <h3 className="font-bold text-white text-base">{identifier}</h3>
                          <p className="text-xs text-slate-400">
                            {order.items.length} items &bull; Billed at {generatedTime}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="text-lg font-bold text-emerald-400">
                          ₹{order.bill?.totalPayable ?? 0}
                        </p>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase bg-blue-500/10 text-blue-400 border border-blue-500/30">
                          Billed
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Paid Orders History (Read-only section) */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 md:p-6 shadow-xl">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Settled Transactions Today ({paidOrders.length})
            </h2>

            {paidOrders.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">No transactions settled yet today.</p>
            ) : (
              <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
                {paidOrders.map(order => {
                  const identifier = getOrderIdentifier(order)
                  const paidTime = order.payment?.paidAt
                    ? new Date(order.payment.paidAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : ''

                  return (
                    <div
                      key={order.id}
                      className="flex items-center justify-between p-3 bg-slate-950/50 rounded-xl border border-slate-800/80 text-xs"
                    >
                      <div>
                        <span className="font-bold text-white">{identifier}</span> &bull; {paidTime}
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Method: <span className="uppercase text-slate-300 font-semibold">{order.payment?.method}</span>
                          {order.payment?.method === 'split' && ` (Cash ₹${order.payment.cashAmount}, UPI ₹${order.payment.upiAmount})`}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-emerald-400">
                          ₹{(order.payment?.cashAmount || 0) + (order.payment?.upiAmount || 0)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleOpenPrintModal(order, true, false)}
                          className="flex items-center gap-1 p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 transition-colors"
                          title="Reprint receipt"
                          aria-label="Reprint receipt"
                        >
                          <Printer className="w-3.5 h-3.5 text-slate-300" />
                          <span className="text-[10px] hidden sm:inline">Print</span>
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Payment Settlement Panel */}
        <div className="lg:col-span-6">
          {selectedOrder && selectedOrder.bill ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col gap-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    Settling: {getOrderIdentifier(selectedOrder)}
                  </h2>
                  <p className="text-xs text-slate-400">
                    Order #{selectedOrder.id.slice(-6)} &bull; {selectedOrder.items.length} items
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenPrintModal(selectedOrder, false, false)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 rounded-xl text-xs font-semibold transition-all shadow-sm active:scale-95"
                    title="Print customer bill prior to payment"
                  >
                    <Printer className="w-3.5 h-3.5 text-amber-400" />
                    <span>Print Bill</span>
                  </button>
                  <span className="text-xs px-2.5 py-1 rounded-full font-bold uppercase bg-blue-500/10 text-blue-400 border border-blue-500/30">
                    Ready for Payment
                  </span>
                </div>
              </div>

              {/* Bill Line Items Breakdown */}
              <div className="flex flex-col gap-2 max-h-52 overflow-y-auto pr-1">
                {selectedOrder.items.map(item => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-2 bg-slate-950/60 rounded-xl border border-slate-800/80 text-xs"
                  >
                    <div>
                      <p className="font-semibold text-slate-200">{item.nameSnapshot}</p>
                      <p className="text-slate-400">
                        ₹{item.unitPrice} &times; {item.quantity}
                      </p>
                    </div>
                    <span className="font-bold text-white">₹{item.unitPrice * item.quantity}</span>
                  </div>
                ))}
              </div>

              {/* Bill Financial Summary */}
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex flex-col gap-1.5 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Subtotal:</span>
                  <span className="font-semibold text-slate-200">₹{selectedOrder.bill.subtotal}</span>
                </div>
                {selectedOrder.bill.discount > 0 && (
                  <div className="flex justify-between text-amber-400">
                    <span>Discount:</span>
                    <span className="font-semibold">-₹{selectedOrder.bill.discount}</span>
                  </div>
                )}
                {selectedOrder.bill.gst > 0 && (
                  <div className="flex justify-between text-slate-400">
                    <span>GST:</span>
                    <span className="font-semibold text-slate-200">+₹{selectedOrder.bill.gst}</span>
                  </div>
                )}
                <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-sm">
                  <span className="font-bold text-emerald-400">Total Payable:</span>
                  <span className="text-xl font-bold text-emerald-400">
                    ₹{selectedOrder.bill.totalPayable}
                  </span>
                </div>
              </div>

              {/* Payment Settlement Form */}
              <form onSubmit={handlePaymentSubmit} className="flex flex-col gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                    Select Payment Method
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['cash', 'upi', 'split'] as const).map(m => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => {
                          setPaymentMethod(m)
                          if (m === 'cash') {
                            setSplitCash(selectedOrder.bill!.totalPayable)
                            setSplitUpi(0)
                            setCashTendered(selectedOrder.bill!.totalPayable)
                            setChangeDueDisplay(0)
                          } else if (m === 'upi') {
                            setSplitCash(0)
                            setSplitUpi(selectedOrder.bill!.totalPayable)
                            setCashTendered(0)
                            setChangeDueDisplay(null)
                          } else {
                            setSplitCash(selectedOrder.bill!.totalPayable)
                            setSplitUpi(0)
                            setCashTendered(selectedOrder.bill!.totalPayable)
                          }
                        }}
                        className={`py-2.5 text-xs font-bold uppercase rounded-xl border transition-all ${
                          paymentMethod === m
                            ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-600/20'
                            : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                {paymentMethod === 'split' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="splitCash" className="text-xs font-semibold text-slate-300 block mb-1">Cash Part (₹)</label>
                      <input
                        id="splitCash"
                        type="number"
                        min={0}
                        value={splitCash}
                        onChange={e => {
                          const cash = Number(e.target.value)
                          setSplitCash(cash)
                          setSplitUpi(Math.max(0, selectedOrder.bill!.totalPayable - cash))
                        }}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label htmlFor="splitUpi" className="text-xs font-semibold text-slate-300 block mb-1">UPI Part (₹)</label>
                      <input
                        id="splitUpi"
                        type="number"
                        min={0}
                        value={splitUpi}
                        onChange={e => {
                          const upi = Number(e.target.value)
                          setSplitUpi(upi)
                          setSplitCash(Math.max(0, selectedOrder.bill!.totalPayable - upi))
                        }}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                {(paymentMethod === 'cash' || paymentMethod === 'split') && (
                  <div>
                    <label htmlFor="cashTendered" className="text-xs font-semibold text-slate-300 block mb-1">
                      Cash Tendered from Customer (₹)
                    </label>
                    <input
                      id="cashTendered"
                      type="number"
                      min={0}
                      value={cashTendered}
                      onChange={e => {
                        const tendered = Number(e.target.value)
                        setCashTendered(tendered)
                        const cashDue = paymentMethod === 'cash' ? selectedOrder.bill!.totalPayable : splitCash
                        setChangeDueDisplay(Math.max(0, tendered - cashDue))
                      }}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    {changeDueDisplay !== null && (
                      <p className="text-xs font-bold text-amber-300 mt-1">
                        Change Due to Customer: ₹{changeDueDisplay}
                      </p>
                    )}
                  </div>
                )}

                <label className="flex items-center gap-2.5 p-2.5 bg-slate-950/70 border border-slate-800/80 rounded-xl cursor-pointer hover:border-slate-700 transition-colors">
                  <input
                    type="checkbox"
                    checked={autoPrintOnSettlement}
                    onChange={e => setAutoPrintOnSettlement(e.target.checked)}
                    className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-emerald-500 focus:ring-emerald-500"
                  />
                  <span className="text-xs text-slate-300 font-medium flex items-center gap-1.5">
                    <Printer className="w-3.5 h-3.5 text-amber-400" />
                    Print receipt automatically on settlement
                  </span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="submit"
                    disabled={isPending}
                    onClick={() => setIsSettleAndPrint(true)}
                    className="w-full py-3 px-4 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-amber-600/20 flex items-center justify-center gap-1.5"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Settle & Print Bill</span>
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    onClick={() => setIsSettleAndPrint(false)}
                    className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-1.5"
                  >
                    <span>Confirm Settlement & Clear Table</span>
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center flex flex-col items-center justify-center min-h-[350px]">
              <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 mb-3">
                <CreditCard className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white mb-1">Select an Order from Queue</h3>
              <p className="text-xs text-slate-400 max-w-xs">
                Click a pending bill on the left to collect cash, UPI, or split payment.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Bill an Open Order (Req 14.5) */}
      {isBillOpenOrderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-3">Bill an Open Order</h3>
            {(() => {
              const order = openOrders.find(o => o.id === selectedOpenOrderId)
              if (!order) return null
              const subtotal = order.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
              const totalPayable = Math.max(0, subtotal - discountInput + gstInput)

              return (
                <form onSubmit={handleGenerateBillSubmit} className="flex flex-col gap-4">
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs">
                    <p className="font-bold text-white mb-1">{getOrderIdentifier(order)}</p>
                    <p className="text-slate-400">{order.items.length} items &bull; Subtotal: ₹{subtotal}</p>
                  </div>

                  <div>
                    <label htmlFor="discountInput" className="text-xs font-semibold text-slate-300 block mb-1">Discount (₹)</label>
                    <input
                      id="discountInput"
                      type="number"
                      min={0}
                      max={subtotal}
                      value={discountInput}
                      onChange={e => setDiscountInput(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label htmlFor="gstInput" className="text-xs font-semibold text-slate-300 block mb-1">GST (₹)</label>
                    <input
                      id="gstInput"
                      type="number"
                      min={0}
                      value={gstInput}
                      onChange={e => setGstInput(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none"
                    />
                  </div>

                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex justify-between items-center text-sm">
                    <span className="font-semibold text-emerald-300">Total Payable:</span>
                    <span className="text-lg font-bold text-emerald-400">₹{totalPayable}</span>
                  </div>

                  {confirmZeroBill && (
                    <div className="p-3 bg-amber-500/20 border border-amber-500/40 rounded-xl text-xs text-amber-200">
                      Total is ₹0. Please confirm you wish to issue a ₹0 complimentary bill.
                    </div>
                  )}

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsBillOpenOrderModalOpen(false)}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold rounded-xl"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isPending}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl"
                    >
                      {confirmZeroBill ? 'Confirm ₹0 Bill' : 'Confirm Bill'}
                    </button>
                  </div>
                </form>
              )
            })()}
          </div>
        </div>
      )}

      {/* Bill / Receipt Print Modal */}
      <ReceiptPrintModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        order={printOrder}
        branch={currentBranch}
        tableName={printOrder ? getOrderIdentifier(printOrder) : undefined}
        cashierName={session?.name}
        isReprint={isReprintMode}
        autoPrint={autoPrintTrigger}
      />
    </div>
  )
}

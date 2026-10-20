'use client'

import React, { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  UtensilsCrossed,
  Plus,
  Flame,
  Receipt,
  RotateCcw,
  Ban,
  History,
  ShoppingBag,
  DollarSign,
  ChevronDown,
  ChevronUp,
  X,
  Edit2,
  Trash2,
  Layers,
  AlertTriangle,
  Tag,
  Printer,
  LayoutDashboard,
  LogOut,
} from 'lucide-react'
import { logout } from '@/app/actions/auth'
import { useToast, ToastStack } from '@/components/Toast'
import type {
  PosTable,
  PosOrder,
  PosKot,
  CatalogItem,
} from '@/app/actions/posTypes'
import { ReceiptPrintModal } from '@/components/ReceiptPrintModal'
import {
  createTable,
  renameTable,
  deactivateTable,
  createOrder,
  addOrUpdateOrderItem,
  removeOrderItem,
  updateOrderNote,
  fireKot,
  generateBill,
  reopenOrder,
  recordPayment,
  voidOrder,
  advanceKotStatus,
  getDailySummary,
} from '@/app/actions/pos'

type PosInitialData = {
  tables: PosTable[]
  orders: PosOrder[]
  kots: PosKot[]
  catalog: CatalogItem[]
  todayIST: string
}

type StaleOrder = PosOrder & { tableName: string }

export default function PosClientPage({
  branches,
  activeBranchId,
  initialData,
  staleOrders: initialStaleOrders,
  session,
  posDefaultGstPercent,
}: {
  branches: { id: string; name: string; address?: string; phone?: string }[]
  activeBranchId: string
  initialData: PosInitialData | null
  staleOrders: StaleOrder[]
  session: { userId: string; name: string; role: string; isGlobalAdmin?: boolean }
  posDefaultGstPercent: number
}) {
  const router = useRouter()
  const { messages, dismiss, success, error } = useToast()
  const [isPending, startTransition] = useTransition()
  const isOwnerOrAdmin = Boolean(session.isGlobalAdmin || session.role === 'admin' || session.role === 'owner')

  // State
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [staleOrders, setStaleOrders] = useState<StaleOrder[]>(initialStaleOrders)
  const [dismissStaleBanner, setDismissStaleBanner] = useState(false)

  // Modals
  const [isTableModalOpen, setIsTableModalOpen] = useState(false)
  const [tableModalMode, setTableModalMode] = useState<'create' | 'rename'>('create')
  const [selectedTableForRename, setSelectedTableForRename] = useState<PosTable | null>(null)
  const [tableNameInput, setTableNameInput] = useState('')

  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false)
  const [orderTypeSelection, setOrderTypeSelection] = useState<'dine-in' | 'takeaway'>('dine-in')
  const [targetTableId, setTargetTableId] = useState<string | null>(null)
  const [coversInput, setCoversInput] = useState(1)
  const [newOrderNote, setNewOrderNote] = useState('')

  // Catalog search / Category filter
  const [searchCatalogQuery, setSearchCatalogQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  // Bill & Payment modal / panel
  const [isBillModalOpen, setIsBillModalOpen] = useState(false)
  const [discountInput, setDiscountInput] = useState<number>(0)
  const [gstInput, setGstInput] = useState<number>(0)
  const [confirmZeroBill, setConfirmZeroBill] = useState(false)

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi' | 'split'>('cash')
  const [splitCash, setSplitCash] = useState<number>(0)
  const [splitUpi, setSplitUpi] = useState<number>(0)
  const [cashTendered, setCashTendered] = useState<number>(0)
  const [changeDueDisplay, setChangeDueDisplay] = useState<number | null>(null)

  // Receipt Print Modal state (Payment Phase)
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false)
  const [printOrder, setPrintOrder] = useState<PosOrder | null>(null)
  const [isReprintMode, setIsReprintMode] = useState(false)
  const [autoPrintTrigger, setAutoPrintTrigger] = useState(false)
  const [autoPrintOnPayment, setAutoPrintOnPayment] = useState(true)
  const [isSettleAndPrintPayment, setIsSettleAndPrintPayment] = useState(false)

  const currentBranch = useMemo(() => {
    return branches.find(b => b.id === activeBranchId) || branches[0] || null
  }, [branches, activeBranchId])

  const handleOpenPrintModal = (order: PosOrder, isReprint = false, autoPrint = false) => {
    setPrintOrder(order)
    setIsReprintMode(isReprint)
    setAutoPrintTrigger(autoPrint)
    setIsPrintModalOpen(true)
  }

  // Void modal
  const [isVoidModalOpen, setIsVoidModalOpen] = useState(false)
  const [voidOrderId, setVoidOrderId] = useState<string | null>(null)
  const [voidReason, setVoidReason] = useState('')

  // Item Note editing modal
  const [editingNoteItem, setEditingNoteItem] = useState<{ id: string; name: string; note: string } | null>(null)

  // Daily summary drawer / card
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(false)
  const [dailySummary, setDailySummary] = useState<{
    totalBillAmount?: number
    billCount?: number
    totalCash?: number
    totalUpi?: number
    dineInBillCount?: number
    takeawayBillCount?: number
    dineInCovers?: number
    voids?: number
    discounts?: number
    gstCollected?: number
  } | null>(null)

  const tables = useMemo(() => initialData?.tables ?? [], [initialData?.tables])
  const orders = useMemo(() => initialData?.orders ?? [], [initialData?.orders])
  const kots = useMemo(() => initialData?.kots ?? [], [initialData?.kots])
  const catalog = useMemo(() => initialData?.catalog ?? [], [initialData?.catalog])


  // Derive occupied tables (today's open or billed orders)
  const openOrdersByTable = useMemo(() => {
    const map = new Map<string, PosOrder>()
    for (const o of orders) {
      if ((o.status === 'open' || o.status === 'billed') && o.tableId) {
        map.set(o.tableId, o)
      }
    }
    return map
  }, [orders])

  // Open & billed takeaways
  const openTakeaways = useMemo(() => {
    return orders.filter(o => o.orderType === 'takeaway' && (o.status === 'open' || o.status === 'billed'))
  }, [orders])

  // Active selected order
  const selectedOrder = useMemo(() => {
    if (!selectedOrderId) return null
    return orders.find(o => o.id === selectedOrderId) || null
  }, [orders, selectedOrderId])

  // KOTs for active selected order
  const activeOrderKots = useMemo(() => {
    if (!selectedOrderId) return []
    return kots.filter(k => k.orderId === selectedOrderId).sort((a, b) => a.kotNumber - b.kotNumber)
  }, [kots, selectedOrderId])

  // Items with pending delta for KOT
  const hasUnfiredKotItems = useMemo(() => {
    if (!selectedOrder || selectedOrder.items.length === 0) return false
    for (const item of selectedOrder.items) {
      const priorTotal = activeOrderKots.reduce((sum, kot) => {
        return sum + kot.items
          .filter(ki =>
            ki.menuItemId === item.menuItemId &&
            (ki.variantId ?? undefined) === (item.variantId ?? undefined)
          )
          .reduce((s, ki) => s + ki.quantity, 0)
      }, 0)
      if (item.quantity > priorTotal) return true
    }
    return false
  }, [selectedOrder, activeOrderKots])

  // Categories in catalog
  const categories = useMemo(() => {
    const set = new Set<string>()
    catalog.forEach(item => {
      if (item.categoryId) set.add(item.categoryId)
    })
    return Array.from(set)
  }, [catalog])

  // Filtered catalog
  const filteredCatalog = useMemo(() => {
    return catalog.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchCatalogQuery.toLowerCase())
      const matchesCategory = selectedCategory === 'all' || item.categoryId === selectedCategory
      return matchesSearch && matchesCategory
    })
  }, [catalog, searchCatalogQuery, selectedCategory])

  // Load daily summary
  const fetchDailySummary = async () => {
    if (!initialData?.todayIST) return
    const res = await getDailySummary(activeBranchId, initialData.todayIST)
    if ('error' in res) {
      error(res.error || 'Failed to load summary')
    } else {
      setDailySummary(res)
    }
  }

  // --- Handlers ---
  const handleBranchChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newBranchId = e.target.value
    router.push(`/management/pos?branch=${newBranchId}`)
  }

  const handleOpenTableClick = (table: PosTable) => {
    const existingOrder = openOrdersByTable.get(table.id)
    if (existingOrder) {
      setSelectedOrderId(existingOrder.id)
    } else {
      setTargetTableId(table.id)
      setOrderTypeSelection('dine-in')
      setCoversInput(1)
      setNewOrderNote('')
      setIsNewOrderModalOpen(true)
    }
  }

  const handleOpenTakeawayClick = () => {
    setTargetTableId(null)
    setOrderTypeSelection('takeaway')
    setNewOrderNote('')
    setIsNewOrderModalOpen(true)
  }

  const handleCreateOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const formData = new FormData()
    formData.set('orderType', orderTypeSelection)
    formData.set('branchId', activeBranchId)
    if (orderTypeSelection === 'dine-in' && targetTableId) {
      formData.set('tableId', targetTableId)
      formData.set('covers', String(coversInput))
    }
    if (newOrderNote) {
      formData.set('note', newOrderNote)
    }

    startTransition(async () => {
      const res = await createOrder(null, formData)
      if (res?.error) {
        error(res.error)
      } else {
        success('Order opened successfully')
        setIsNewOrderModalOpen(false)
        router.refresh()
      }
    })
  }

  const handleAddItem = (item: CatalogItem) => {
    if (!selectedOrder || selectedOrder.status !== 'open') return
    const existingItem = selectedOrder.items.find(
      i => i.menuItemId === item.menuItemId && (i.variantId ?? undefined) === (item.variantId ?? undefined)
    )
    const newQty = (existingItem?.quantity ?? 0) + 1
    if (newQty > 99) {
      error('Maximum item quantity is 99')
      return
    }

    startTransition(async () => {
      const res = await addOrUpdateOrderItem(
        selectedOrder.id,
        item.menuItemId,
        newQty,
        item.effectivePrice,
        item.name,
        item.variantId,
        existingItem?.note
      )
      if (res?.error) {
        error(res.error)
      } else {
        router.refresh()
      }
    })
  }

  const handleUpdateQty = (menuItemId: string, variantId: string | undefined, currentQty: number, delta: number, unitPrice: number, nameSnapshot: string) => {
    if (!selectedOrder || selectedOrder.status !== 'open') return
    const newQty = currentQty + delta
    if (newQty <= 0) {
      const item = selectedOrder.items.find(i => i.menuItemId === menuItemId && (i.variantId ?? undefined) === (variantId ?? undefined))
      if (item) {
        handleRemoveItem(item.id)
      }
      return
    }
    if (newQty > 99) return

    startTransition(async () => {
      const res = await addOrUpdateOrderItem(
        selectedOrder.id,
        menuItemId,
        newQty,
        unitPrice,
        nameSnapshot,
        variantId
      )
      if (res?.error) error(res.error)
      else router.refresh()
    })
  }

  const handleRemoveItem = (orderItemId: string) => {
    if (!selectedOrder) return
    startTransition(async () => {
      const res = await removeOrderItem(selectedOrder.id, orderItemId)
      if (res?.error) error(res.error)
      else {
        success('Item removed')
        router.refresh()
      }
    })
  }

  const handleSaveItemNote = (orderItemId: string, noteText: string) => {
    if (!selectedOrder) return
    const item = selectedOrder.items.find(i => i.id === orderItemId)
    if (!item) return
    startTransition(async () => {
      const res = await addOrUpdateOrderItem(
        selectedOrder.id,
        item.menuItemId,
        item.quantity,
        item.unitPrice,
        item.nameSnapshot,
        item.variantId,
        noteText
      )
      if (res?.error) error(res.error)
      else {
        success('Item note saved')
        router.refresh()
      }
    })
  }

  const handleFireKot = () => {
    if (!selectedOrder) return
    startTransition(async () => {
      const res = await fireKot(selectedOrder.id)
      if (res?.error) {
        error(res.error)
      } else {
        success('KOT fired to kitchen')
        router.refresh()
      }
    })
  }

  const handleOpenBillModal = () => {
    if (!selectedOrder) return
    const subtotal = selectedOrder.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
    const suggestedGst = posDefaultGstPercent > 0 ? Math.round((subtotal * posDefaultGstPercent) / 100) : 0
    setDiscountInput(0)
    setGstInput(suggestedGst)
    setConfirmZeroBill(false)
    setIsBillModalOpen(true)
  }

  const handleGenerateBillSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedOrder) return
    const formData = new FormData()
    formData.set('orderId', selectedOrder.id)
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
        success('Bill generated successfully')
        setIsBillModalOpen(false)
        router.refresh()
      }
    })
  }

  const handleReopenOrder = () => {
    if (!selectedOrder) return
    startTransition(async () => {
      const res = await reopenOrder(selectedOrder.id)
      if (res?.error) error(res.error)
      else {
        success('Order reopened')
        router.refresh()
      }
    })
  }

  const handleOpenPaymentModal = () => {
    if (!selectedOrder?.bill) return
    setPaymentMethod('cash')
    setSplitCash(selectedOrder.bill.totalPayable)
    setSplitUpi(0)
    setCashTendered(selectedOrder.bill.totalPayable)
    setChangeDueDisplay(0)
    setIsPaymentModalOpen(true)
  }

  const handleRecordPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedOrder) return

    const orderToSettle = selectedOrder
    const shouldPrint = isSettleAndPrintPayment || autoPrintOnPayment

    const formData = new FormData()
    formData.set('orderId', selectedOrder.id)
    formData.set('method', paymentMethod)
    if (paymentMethod === 'cash') {
      formData.set('cashAmount', String(selectedOrder.bill?.totalPayable ?? 0))
      formData.set('upiAmount', '0')
      formData.set('cashTendered', String(cashTendered))
    } else if (paymentMethod === 'upi') {
      formData.set('cashAmount', '0')
      formData.set('upiAmount', String(selectedOrder.bill?.totalPayable ?? 0))
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
        setIsPaymentModalOpen(false)
        setSelectedOrderId(null)
        if (shouldPrint && orderToSettle) {
          const paidSnapshot: PosOrder = {
            ...orderToSettle,
            status: 'paid',
            payment: {
              method: paymentMethod,
              cashAmount: paymentMethod === 'cash' ? (orderToSettle.bill?.totalPayable ?? 0) : (paymentMethod === 'split' ? splitCash : 0),
              upiAmount: paymentMethod === 'upi' ? (orderToSettle.bill?.totalPayable ?? 0) : (paymentMethod === 'split' ? splitUpi : 0),
              paidAt: new Date().toISOString(),
            },
          }
          handleOpenPrintModal(paidSnapshot, false, true)
        }
        router.refresh()
      }
    })
  }

  const handleOpenVoidModal = (orderId: string) => {
    setVoidOrderId(orderId)
    setVoidReason('')
    setIsVoidModalOpen(true)
  }

  const handleVoidOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!voidOrderId) return
    const formData = new FormData()
    formData.set('orderId', voidOrderId)
    formData.set('reason', voidReason)

    startTransition(async () => {
      const res = await voidOrder(null, formData)
      if (res?.error) {
        error(res.error)
      } else {
        success('Order voided successfully')
        setIsVoidModalOpen(false)
        if (selectedOrderId === voidOrderId) {
          setSelectedOrderId(null)
        }
        setStaleOrders(prev => prev.filter(o => o.id !== voidOrderId))
        router.refresh()
      }
    })
  }

  const handleAdvanceKot = (kotId: string) => {
    startTransition(async () => {
      const res = await advanceKotStatus(kotId)
      if (res?.error) error(res.error)
      else {
        success('KOT status advanced')
        router.refresh()
      }
    })
  }

  const handleSaveTable = async (e: React.FormEvent) => {
    e.preventDefault()
    const formData = new FormData()
    formData.set('name', tableNameInput)
    formData.set('branchId', activeBranchId)

    startTransition(async () => {
      let res
      if (tableModalMode === 'create') {
        res = await createTable(null, formData)
      } else if (selectedTableForRename) {
        formData.set('tableId', selectedTableForRename.id)
        formData.set('newName', tableNameInput)
        res = await renameTable(null, formData)
      }
      if (res?.error) error(res.error)
      else {
        success(`Table ${tableModalMode === 'create' ? 'created' : 'renamed'} successfully`)
        setIsTableModalOpen(false)
        setTableNameInput('')
        setSelectedTableForRename(null)
        router.refresh()
      }
    })
  }

  const handleDeactivateTable = (tableId: string) => {
    if (!confirm('Are you sure you want to deactivate this table?')) return
    startTransition(async () => {
      const res = await deactivateTable(tableId)
      if (res?.error) error(res.error)
      else {
        success('Table deactivated')
        router.refresh()
      }
    })
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6 gap-6">
      <ToastStack messages={messages} onDismiss={dismiss} />

      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400">
            <UtensilsCrossed className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              Point of Sale
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-semibold">
                Live
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              {initialData?.todayIST} &bull; Service Operator: {session.name} ({session.role})
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {session.isGlobalAdmin && branches.length > 1 && (
            <select
              value={activeBranchId}
              onChange={handleBranchChange}
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm font-medium text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              {branches.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={() => {
              setTableModalMode('create')
              setTableNameInput('')
              setIsTableModalOpen(true)
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-sm font-semibold rounded-xl transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Manage Tables
          </button>

          <button
            onClick={handleOpenTakeawayClick}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold rounded-xl transition-all shadow-md shadow-amber-600/20"
          >
            <ShoppingBag className="w-4 h-4" />
            New Takeaway
          </button>

          {/* Owner / Admin POS Station Navigation (Req 3) */}
          {isOwnerOrAdmin && (
            <>
              <Link
                href={activeBranchId ? `/management/pos/kitchen?branch=${activeBranchId}` : '/management/pos/kitchen'}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-sm font-semibold rounded-xl transition-all"
                title="Kitchen Display System"
              >
                <Flame className="w-4 h-4 text-orange-400" />
                <span>Kitchen</span>
              </Link>
              <Link
                href={activeBranchId ? `/management/pos/order?branch=${activeBranchId}` : '/management/pos/order'}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-sm font-semibold rounded-xl transition-all"
                title="Waiter Order Station"
              >
                <UtensilsCrossed className="w-4 h-4 text-amber-400" />
                <span>Order</span>
              </Link>
              <Link
                href={activeBranchId ? `/management/pos/billing?branch=${activeBranchId}` : '/management/pos/billing'}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-sm font-semibold rounded-xl transition-all"
                title="Billing & Settlement"
              >
                <Receipt className="w-4 h-4 text-emerald-400" />
                <span>Billing</span>
              </Link>
              <Link
                href={activeBranchId ? `/management/pos/history?branch=${activeBranchId}` : '/management/pos/history'}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-sm font-semibold rounded-xl transition-all"
                title="POS History"
              >
                <History className="w-4 h-4 text-purple-400" />
                <span>History</span>
              </Link>
              <Link
                href="/management"
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-sm font-semibold rounded-xl transition-all"
                title="Back to Management Portal"
              >
                <LayoutDashboard className="w-4 h-4 text-indigo-400" />
                <span className="hidden lg:inline">Dashboard</span>
              </Link>
            </>
          )}

          <button
            onClick={() => {
              setIsSummaryExpanded(!isSummaryExpanded)
              if (!isSummaryExpanded) fetchDailySummary()
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-sm font-semibold rounded-xl transition-all"
          >
            <DollarSign className="w-4 h-4 text-emerald-400" />
            Summary
            {isSummaryExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

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

      {/* Stale Orders Banner */}
      {!dismissStaleBanner && staleOrders.length > 0 && (
        <div className="bg-amber-950/40 border border-amber-600/40 rounded-2xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-300 font-semibold text-sm">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
              <span>
                Attention: {staleOrders.length} order{staleOrders.length > 1 ? 's' : ''} left open from prior days.
              </span>
            </div>
            <button
              onClick={() => setDismissStaleBanner(true)}
              className="text-amber-400/70 hover:text-amber-300 text-sm font-medium"
            >
              Dismiss
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {staleOrders.map(so => (
              <div
                key={so.id}
                className="flex items-center justify-between bg-slate-900/80 border border-amber-500/20 px-3 py-2 rounded-xl text-xs"
              >
                <div>
                  <span className="font-bold text-white">{so.tableName}</span> &bull; {so.date} &bull; {so.items.length} items
                </div>
                <button
                  onClick={() => handleOpenVoidModal(so.id)}
                  className="px-2.5 py-1 bg-red-600/20 text-red-300 hover:bg-red-600/30 border border-red-500/30 rounded-lg font-semibold"
                >
                  Void
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Daily Summary Drawer (Collapsible) */}
      {isSummaryExpanded && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
          <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-3">Today&apos;s POS Performance</h2>
          {dailySummary ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                <span className="text-xs text-slate-400">Total Revenue</span>
                <p className="text-lg font-bold text-emerald-400">₹{dailySummary.totalBillAmount || 0}</p>
              </div>
              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                <span className="text-xs text-slate-400">Bills Settled</span>
                <p className="text-lg font-bold text-white">{dailySummary.billCount || 0}</p>
              </div>
              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                <span className="text-xs text-slate-400">Cash / UPI Split</span>
                <p className="text-sm font-semibold text-slate-200">
                  ₹{dailySummary.totalCash || 0} / ₹{dailySummary.totalUpi || 0}
                </p>
              </div>
              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                <span className="text-xs text-slate-400">Dine-In / Takeaway</span>
                <p className="text-sm font-semibold text-slate-200">
                  {dailySummary.dineInBillCount || 0} / {dailySummary.takeawayBillCount || 0}
                </p>
              </div>
              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                <span className="text-xs text-slate-400">Discounts / Voids</span>
                <p className="text-sm font-semibold text-amber-300">
                  ₹{dailySummary.discounts || 0} ({dailySummary.voids || 0} voids)
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400">Loading aggregates...</p>
          )}
        </div>
      )}

      {/* Main Layout: Left = Table Grid & Takeaway Queue, Right = Order & KOT & Bill Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (Tables & Takeaways) */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* Takeaways Queue */}
          {openTakeaways.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-amber-400" />
                Active Takeaway Orders ({openTakeaways.length})
              </h2>
              <div className="flex flex-wrap gap-2">
                {openTakeaways.map(order => (
                  <button
                    key={order.id}
                    onClick={() => setSelectedOrderId(order.id)}
                    className={`px-3.5 py-2 rounded-xl text-sm font-semibold border transition-all ${
                      selectedOrderId === order.id
                        ? 'bg-amber-600 text-white border-amber-500 shadow-md'
                        : 'bg-slate-800/80 text-slate-200 border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    {order.takeawayNumber || 'Takeaway'} &bull; {order.items.length} items
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Table Grid */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 md:p-6 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-400" />
                Seating & Tables ({tables.length})
              </h2>
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5 text-slate-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Available
                </span>
                <span className="flex items-center gap-1.5 text-slate-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Occupied
                </span>
              </div>
            </div>

            {tables.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-slate-800 rounded-xl">
                <p className="text-sm text-slate-400">No active tables defined for this branch.</p>
                <button
                  onClick={() => {
                    setTableModalMode('create')
                    setTableNameInput('')
                    setIsTableModalOpen(true)
                  }}
                  className="mt-3 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 text-sm font-semibold rounded-xl border border-slate-700"
                >
                  Create First Table
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {tables.map(table => {
                  const existingOrder = openOrdersByTable.get(table.id)
                  const isOccupied = !!existingOrder
                  const isSelected = selectedOrder?.tableId === table.id

                  return (
                    <div
                      key={table.id}
                      onClick={() => handleOpenTableClick(table)}
                      className={`relative cursor-pointer p-4 rounded-xl border transition-all flex flex-col justify-between h-28 group ${
                        isSelected
                          ? 'border-amber-400 ring-2 ring-amber-400/20 bg-slate-800'
                          : isOccupied
                          ? 'bg-amber-950/20 border-amber-500/40 hover:border-amber-400'
                          : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 pr-2">
                        <span
                          className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                            isOccupied ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
                          }`}
                        />
                        <span className="font-bold text-base text-white group-hover:text-amber-300 transition-colors truncate">
                          {table.name}
                        </span>
                      </div>

                      <div className="flex items-center justify-between mt-auto">
                        {isOccupied && existingOrder ? (
                          <div className="text-xs text-slate-400">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span
                                className={`text-[10px] px-1.5 py-0.2 rounded font-bold uppercase ${
                                  existingOrder.status === 'billed'
                                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                }`}
                              >
                                {existingOrder.status === 'billed' ? 'Billed' : 'Occupied'}
                              </span>
                            </div>
                            <p className="font-medium text-amber-300">{existingOrder.items.length} items</p>
                            <p className="text-[10px] text-slate-500">{existingOrder.covers || 1} covers</p>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500 font-medium">Available</span>
                        )}

                        {/* Quick Rename/Deactivate Table Controls */}
                        <div className="flex items-center gap-1 bg-slate-900/90 px-1 py-0.5 rounded-lg border border-slate-700/80">
                          <button
                            onClick={e => {
                              e.stopPropagation()
                              setSelectedTableForRename(table)
                              setTableNameInput(table.name)
                              setTableModalMode('rename')
                              setIsTableModalOpen(true)
                            }}
                            className="p-1 hover:text-amber-400 text-slate-400"
                            title="Rename"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={e => {
                              e.stopPropagation()
                              handleDeactivateTable(table.id)
                            }}
                            className="p-1 hover:text-red-400 text-slate-400"
                            title="Deactivate"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Order Panel, Catalog, KOTs, Bill */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {selectedOrder ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col gap-4">
              {/* Order Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-white">
                      {selectedOrder.orderType === 'dine-in'
                        ? tables.find(t => t.id === selectedOrder.tableId)?.name || 'Dine-In'
                        : selectedOrder.takeawayNumber || 'Takeaway'}
                    </h2>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-bold uppercase ${
                        selectedOrder.status === 'open'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                          : selectedOrder.status === 'billed'
                          ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                          : selectedOrder.status === 'paid'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : 'bg-red-500/10 text-red-400 border border-red-500/30'
                      }`}
                    >
                      {selectedOrder.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Order #{selectedOrder.id.slice(-6)} &bull; {selectedOrder.covers || 1} Guests
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleOpenVoidModal(selectedOrder.id)}
                    className="p-2 bg-red-600/10 hover:bg-red-600/20 text-red-400 border border-red-500/30 rounded-xl text-xs font-semibold"
                    title="Void Order"
                  >
                    <Ban className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setSelectedOrderId(null)}
                    className="p-2 text-slate-400 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Order Note */}
              {selectedOrder.status === 'open' && (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    defaultValue={selectedOrder.note || ''}
                    placeholder="Order note (e.g. rush order, guest preferences)..."
                    maxLength={200}
                    onBlur={e => {
                      if (e.target.value !== (selectedOrder.note || '')) {
                        updateOrderNote(selectedOrder.id, e.target.value)
                      }
                    }}
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              )}

              {/* Items List */}
              <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">
                {selectedOrder.items.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4 text-center">No items added to this order yet.</p>
                ) : (
                  selectedOrder.items.map(item => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-2.5 bg-slate-950/60 rounded-xl border border-slate-800/80 text-sm"
                    >
                      <div className="flex-1 min-w-0 pr-2">
                        <div className="flex items-center gap-1.5">
                          <p className="font-semibold text-slate-200 truncate">{item.nameSnapshot}</p>
                          {selectedOrder.status === 'open' && (
                            <button
                              onClick={() => setEditingNoteItem({ id: item.id, name: item.nameSnapshot, note: item.note || '' })}
                              className="text-slate-500 hover:text-amber-400 p-0.5 rounded transition-colors"
                              title="Add/edit item kitchen note"
                            >
                              <Tag className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        <p className="text-xs text-slate-400">₹{item.unitPrice} each</p>
                        {item.note && (
                          <p
                            onClick={() => selectedOrder.status === 'open' && setEditingNoteItem({ id: item.id, name: item.nameSnapshot, note: item.note || '' })}
                            className="text-[11px] italic text-amber-400/80 cursor-pointer hover:underline"
                            title="Click to edit kitchen note"
                          >
                            &ldquo;{item.note}&rdquo;
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {selectedOrder.status === 'open' && (
                          <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-0.5 border border-slate-700">
                            <button
                              onClick={() =>
                                handleUpdateQty(
                                  item.menuItemId,
                                  item.variantId,
                                  item.quantity,
                                  -1,
                                  item.unitPrice,
                                  item.nameSnapshot
                                )
                              }
                              className="w-6 h-6 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-700 rounded font-bold"
                            >
                              -
                            </button>
                            <span className="w-6 text-center font-bold text-xs text-white">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() =>
                                handleUpdateQty(
                                  item.menuItemId,
                                  item.variantId,
                                  item.quantity,
                                  1,
                                  item.unitPrice,
                                  item.nameSnapshot
                                )
                              }
                              className="w-6 h-6 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-700 rounded font-bold"
                            >
                              +
                            </button>
                          </div>
                        )}
                        <span className="font-bold text-white text-sm w-14 text-right">
                          ₹{item.quantity * item.unitPrice}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Subtotal & Action Buttons */}
              <div className="pt-3 border-t border-slate-800 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-medium">Subtotal</span>
                  <span className="text-base font-bold text-white">
                    ₹{selectedOrder.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {selectedOrder.status === 'open' && (
                    <>
                      <button
                        onClick={handleFireKot}
                        disabled={!hasUnfiredKotItems || isPending}
                        className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-amber-600/20"
                      >
                        <Flame className="w-4 h-4" />
                        {hasUnfiredKotItems ? 'Fire KOT' : (activeOrderKots.length > 0 ? 'Kitchen Up to Date' : 'Fire KOT')}
                      </button>

                      <button
                        onClick={handleOpenBillModal}
                        disabled={selectedOrder.items.length === 0 || isPending}
                        className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/20"
                      >
                        <Receipt className="w-4 h-4" />
                        Generate Bill
                      </button>
                    </>
                  )}

                  {selectedOrder.status === 'billed' && (
                    <>
                      <button
                        onClick={handleReopenOrder}
                        disabled={isPending}
                        className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-all"
                      >
                        <RotateCcw className="w-4 h-4" />
                        Re-open Order
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenPrintModal(selectedOrder, false, false)}
                        className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-amber-600/20"
                        title="Print bill for customer"
                      >
                        <Printer className="w-4 h-4" />
                        Print Bill
                      </button>

                      <button
                        onClick={handleOpenPaymentModal}
                        disabled={isPending}
                        className="col-span-2 flex items-center justify-center gap-1.5 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/20"
                      >
                        <Receipt className="w-4 h-4" />
                        Settle Payment (₹{selectedOrder.bill?.totalPayable ?? 0})
                      </button>
                    </>
                  )}

                  {selectedOrder.status === 'paid' && (
                    <div className="col-span-2">
                      <button
                        type="button"
                        onClick={() => handleOpenPrintModal(selectedOrder, true, false)}
                        className="w-full flex items-center justify-center gap-1.5 py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-all"
                      >
                        <Printer className="w-4 h-4 text-amber-400" />
                        Print Receipt / Reprint
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* KOT History Panel for Active Order */}
              {activeOrderKots.length > 0 && (
                <div className="pt-3 border-t border-slate-800">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-amber-400" />
                    Kitchen Tickets ({activeOrderKots.length})
                  </h3>
                  <div className="flex flex-col gap-2">
                    {activeOrderKots.map(kot => (
                      <div
                        key={kot.id}
                        className="p-2.5 bg-slate-950/80 rounded-xl border border-slate-800 flex items-center justify-between text-xs"
                      >
                        <div>
                          <span className="font-bold text-white">KOT #{kot.kotNumber}</span> &bull;{' '}
                          <span className="text-slate-400">{kot.items.length} item(s)</span>
                          <span
                            className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                              kot.status === 'pending'
                                ? 'bg-orange-500/20 text-orange-300'
                                : kot.status === 'preparing'
                                ? 'bg-yellow-500/20 text-yellow-300'
                                : kot.status === 'ready'
                                ? 'bg-green-500/20 text-green-300'
                                : 'bg-slate-700 text-slate-300'
                            }`}
                          >
                            {kot.status}
                          </span>
                        </div>

                        {kot.status !== 'served' && (
                          <button
                            onClick={() => handleAdvanceKot(kot.id)}
                            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-lg font-semibold border border-slate-700"
                          >
                            Advance
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Menu Catalog Search & Quick Add */}
              {selectedOrder.status === 'open' && (
                <div className="pt-3 border-t border-slate-800 flex flex-col gap-2">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Add Items from Menu</h3>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Search items..."
                      value={searchCatalogQuery}
                      onChange={e => setSearchCatalogQuery(e.target.value)}
                      className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                    {categories.length > 0 && (
                      <select
                        value={selectedCategory}
                        onChange={e => setSelectedCategory(e.target.value)}
                        className="px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none"
                      >
                        <option value="all">All Categories</option>
                        {categories.map(c => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                    {filteredCatalog.slice(0, 30).map(item => (
                      <button
                        key={`${item.menuItemId}_${item.variantId || 'base'}`}
                        onClick={() => handleAddItem(item)}
                        className="flex items-center justify-between p-2.5 bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800 rounded-xl text-left transition-colors"
                      >
                        <span className="font-semibold text-xs text-white truncate pr-2">{item.name}</span>
                        <span className="text-[11px] font-bold text-emerald-400 shrink-0">₹{item.effectivePrice}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center flex flex-col items-center justify-center min-h-[300px]">
              <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 mb-3">
                <UtensilsCrossed className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white mb-1">No Active Order Selected</h3>
              <p className="text-xs text-slate-400 max-w-xs">
                Select an occupied table or click an available table / takeaway to start taking orders.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* --- MODALS --- */}

      {/* Table Management Modal */}
      {isTableModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 shadow-2xl flex flex-col gap-4 max-h-[85vh] overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">
                {tableModalMode === 'rename' ? 'Rename Table' : 'Manage Tables'}
              </h3>
              <button
                onClick={() => {
                  setIsTableModalOpen(false)
                  setSelectedTableForRename(null)
                  setTableNameInput('')
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTable} className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  {tableModalMode === 'rename' ? 'New Table Name' : 'Add New Table'}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    maxLength={50}
                    value={tableNameInput}
                    onChange={e => setTableNameInput(e.target.value)}
                    placeholder="e.g. Table 1, T12, Patio 4"
                    className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <button
                    type="submit"
                    disabled={isPending || !tableNameInput.trim()}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl"
                  >
                    {tableModalMode === 'rename' ? 'Update' : 'Add Table'}
                  </button>
                </div>
              </div>
              {tableModalMode === 'rename' && (
                <button
                  type="button"
                  onClick={() => {
                    setTableModalMode('create')
                    setTableNameInput('')
                    setSelectedTableForRename(null)
                  }}
                  className="text-xs text-amber-400 hover:underline self-start"
                >
                  &larr; Switch back to Add Table
                </button>
              )}
            </form>

            {tableModalMode === 'create' && (
              <div className="flex flex-col gap-2 pt-2 border-t border-slate-800 overflow-y-auto max-h-60 pr-1">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Current Active Tables ({tables.length})
                </span>
                {tables.length === 0 ? (
                  <p className="text-xs text-slate-500 py-3 text-center">No active tables found.</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {tables.map(t => {
                      const isOccupied = openOrdersByTable.has(t.id)
                      return (
                        <div key={t.id} className="flex items-center justify-between p-2 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white">{t.name}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase ${isOccupied ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'}`}>
                              {isOccupied ? 'Occupied' : 'Available'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedTableForRename(t)
                                setTableNameInput(t.name)
                                setTableModalMode('rename')
                              }}
                              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-lg font-semibold"
                            >
                              Rename
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeactivateTable(t.id)}
                              className="px-2 py-1 bg-red-600/10 hover:bg-red-600/20 text-red-400 border border-red-500/30 rounded-lg font-semibold"
                            >
                              Deactivate
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* New Order Modal */}
      {isNewOrderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-3">
              Open New {orderTypeSelection === 'dine-in' ? 'Dine-In' : 'Takeaway'} Order
            </h3>
            <form onSubmit={handleCreateOrderSubmit} className="flex flex-col gap-4">
              {orderTypeSelection === 'dine-in' && (
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Guests / Covers</label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    required
                    value={coversInput}
                    onChange={e => setCoversInput(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              )}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Optional Note</label>
                <input
                  type="text"
                  maxLength={200}
                  value={newOrderNote}
                  onChange={e => setNewOrderNote(e.target.value)}
                  placeholder="e.g. VIP, allergy notes"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewOrderModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold rounded-xl"
                >
                  Open Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bill Generation Modal */}
      {isBillModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-3">Generate Customer Bill</h3>
            {(() => {
              const subtotal = selectedOrder.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
              const totalPayable = Math.max(0, subtotal - discountInput + gstInput)

              return (
                <form onSubmit={handleGenerateBillSubmit} className="flex flex-col gap-4">
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex justify-between items-center text-sm">
                    <span className="text-slate-400">Subtotal:</span>
                    <span className="font-bold text-white">₹{subtotal}</span>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">Discount (₹)</label>
                    <input
                      type="number"
                      min={0}
                      max={subtotal}
                      value={discountInput}
                      onChange={e => setDiscountInput(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">GST Amount (₹)</label>
                    <input
                      type="number"
                      min={0}
                      value={gstInput}
                      onChange={e => setGstInput(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
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
                      onClick={() => setIsBillModalOpen(false)}
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

      {/* Settle Payment Modal */}
      {isPaymentModalOpen && selectedOrder?.bill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-3">Record Settlement</h3>
            <form onSubmit={handleRecordPaymentSubmit} className="flex flex-col gap-4">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex justify-between items-center text-sm">
                <span className="text-slate-400">Total Payable:</span>
                <span className="text-lg font-bold text-emerald-400">
                  ₹{selectedOrder.bill.totalPayable}
                </span>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Payment Method</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['cash', 'upi', 'split'] as const).map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPaymentMethod(m)}
                      className={`py-2 text-xs font-bold uppercase rounded-xl border transition-all ${
                        paymentMethod === m
                          ? 'bg-amber-600 text-white border-amber-500'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {paymentMethod === 'split' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">Cash (₹)</label>
                    <input
                      type="number"
                      min={0}
                      value={splitCash}
                      onChange={e => setSplitCash(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">UPI (₹)</label>
                    <input
                      type="number"
                      min={0}
                      value={splitUpi}
                      onChange={e => setSplitUpi(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {(paymentMethod === 'cash' || paymentMethod === 'split') && (
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Cash Tendered (₹)</label>
                  <input
                    type="number"
                    min={0}
                    value={cashTendered}
                    onChange={e => {
                      const tendered = Number(e.target.value)
                      setCashTendered(tendered)
                      const cashDue = paymentMethod === 'cash' ? selectedOrder.bill!.totalPayable : splitCash
                      setChangeDueDisplay(Math.max(0, tendered - cashDue))
                    }}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none"
                  />
                  {changeDueDisplay !== null && (
                    <p className="text-xs font-bold text-amber-300 mt-1">
                      Change Due to Customer: ₹{changeDueDisplay}
                    </p>
                  )}
                </div>
              )}

              <div className="flex justify-between items-center">
                <button
                  type="button"
                  onClick={() => handleOpenPrintModal(selectedOrder, false, false)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 rounded-xl text-xs font-semibold transition-all"
                >
                  <Printer className="w-3.5 h-3.5 text-amber-400" />
                  <span>Print Bill Preview</span>
                </button>
              </div>

              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={autoPrintOnPayment}
                  onChange={e => setAutoPrintOnPayment(e.target.checked)}
                  className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-emerald-500 focus:ring-emerald-500"
                />
                <span>Print receipt automatically on settlement</span>
              </label>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  onClick={() => setIsSettleAndPrintPayment(true)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl shadow-md"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Settle & Print</span>
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  onClick={() => setIsSettleAndPrintPayment(false)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md"
                >
                  Complete Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Void Reason Modal */}
      {isVoidModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl">
            <h3 className="text-base font-bold text-red-400 mb-2">Void Order</h3>
            <p className="text-xs text-slate-400 mb-4">
              Enter reason for voiding this transaction. This action is permanently recorded in the audit log.
            </p>
            <form onSubmit={handleVoidOrderSubmit} className="flex flex-col gap-4">
              <textarea
                required
                minLength={1}
                maxLength={200}
                rows={3}
                value={voidReason}
                onChange={e => setVoidReason(e.target.value)}
                placeholder="Reason for voiding..."
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsVoidModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending || !voidReason.trim()}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold rounded-xl"
                >
                  Confirm Void
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Item Note Modal */}
      {editingNoteItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl">
            <h3 className="text-sm font-bold text-white mb-2">Item Kitchen Note ({editingNoteItem.name})</h3>
            <p className="text-xs text-slate-400 mb-3">Add special instructions for kitchen preparation (max 80 chars).</p>
            <input
              type="text"
              maxLength={80}
              value={editingNoteItem.note}
              onChange={e => setEditingNoteItem({ ...editingNoteItem, note: e.target.value })}
              placeholder="e.g. extra spicy, no onion, less oil"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500 mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingNoteItem(null)}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  handleSaveItemNote(editingNoteItem.id, editingNoteItem.note)
                  setEditingNoteItem(null)
                }}
                className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-xl"
              >
                Save Note
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bill / Receipt Print Modal */}
      <ReceiptPrintModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        order={printOrder}
        branch={currentBranch}
        tableName={
          printOrder?.orderType === 'dine-in'
            ? (tables.find(t => t.id === printOrder.tableId)?.name || (printOrder.tableId ? `Table ${printOrder.tableId}` : 'Table'))
            : (printOrder?.takeawayNumber || 'Takeaway')
        }
        cashierName={session?.name}
        isReprint={isReprintMode}
        autoPrint={autoPrintTrigger}
      />
    </div>
  )
}

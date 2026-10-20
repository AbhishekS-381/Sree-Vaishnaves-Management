'use client'

import React, { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  UtensilsCrossed,
  Flame,
  X,
  Layers,
  ShoppingBag,
  AlertTriangle,
  Tag,
  LogOut,
  LayoutDashboard,
} from 'lucide-react'
import { logout } from '@/app/actions/auth'
import { useToast, ToastStack } from '@/components/Toast'
import type {
  PosTable,
  PosOrder,
  PosKot,
  CatalogItem,
} from '@/app/actions/posTypes'
import {
  createOrder,
  addOrUpdateOrderItem,
  removeOrderItem,
  updateOrderNote,
  fireKot,
} from '@/app/actions/pos'

type PosInitialData = {
  tables: PosTable[]
  orders: PosOrder[]
  kots: PosKot[]
  catalog: CatalogItem[]
  todayIST: string
}

type StaleOrder = PosOrder & { tableName: string }

export default function WaiterOrderClientPage({
  activeBranchId,
  initialData,
  staleOrders,
  session,
  categoryMap = {},
}: {
  branches?: { id: string; name: string }[]
  activeBranchId: string
  initialData: PosInitialData
  staleOrders: StaleOrder[]
  session: { userId: string; name: string; role: string; isGlobalAdmin?: boolean }
  categoryMap?: Record<string, string>
}) {
  const router = useRouter()
  const { messages, dismiss, success, error } = useToast()
  const [isPending, startTransition] = useTransition()

  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [dismissStaleBanner, setDismissStaleBanner] = useState(false)

  // Modals
  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false)
  const [orderTypeSelection, setOrderTypeSelection] = useState<'dine-in' | 'takeaway'>('dine-in')
  const [targetTableId, setTargetTableId] = useState<string | null>(null)
  const [coversInput, setCoversInput] = useState(1)
  const [newOrderNote, setNewOrderNote] = useState('')

  // Item Note editing modal
  const [editingNoteItem, setEditingNoteItem] = useState<{ id: string; name: string; note: string } | null>(null)

  // Catalog search / Filter
  const [searchCatalogQuery, setSearchCatalogQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  const tables = initialData.tables
  const orders = initialData.orders
  const kots = initialData.kots
  const catalog = initialData.catalog

  const isWaiter = session.role === 'waiter'

  // Map of open orders per table
  const openOrdersByTable = useMemo(() => {
    const map = new Map<string, PosOrder>()
    for (const o of orders) {
      if (o.status === 'open' && o.tableId) {
        map.set(o.tableId, o)
      }
    }
    return map
  }, [orders])

  // Open takeaways owned by waiter (or all if manager)
  const openTakeaways = useMemo(() => {
    return orders.filter(o =>
      o.orderType === 'takeaway' &&
      o.status === 'open' &&
      (!isWaiter || o.openedBy === session.userId)
    )
  }, [orders, isWaiter, session.userId])

  // Selected order (waiter can only view their own)
  const selectedOrder = useMemo(() => {
    if (!selectedOrderId) return null
    const o = orders.find(ord => ord.id === selectedOrderId)
    if (!o) return null
    if (isWaiter && o.openedBy !== session.userId) return null
    return o
  }, [orders, selectedOrderId, isWaiter, session.userId])

  // KOTs for selected order
  const activeOrderKots = useMemo(() => {
    if (!selectedOrderId) return []
    return kots.filter(k => k.orderId === selectedOrderId).sort((a, b) => a.kotNumber - b.kotNumber)
  }, [kots, selectedOrderId])

  // Delta: does selectedOrder have any items or qty not yet in activeOrderKots?
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

  // Catalog categories: array of { id: string; name: string }
  const categories = useMemo(() => {
    const map = new Map<string, string>()
    catalog.forEach(item => {
      if (item.categoryId) {
        const name =
          categoryMap[item.categoryId] ||
          item.categoryName ||
          item.categoryId
        map.set(item.categoryId, name)
      }
    })
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [catalog, categoryMap])

  const filteredCatalog = useMemo(() => {
    return catalog.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchCatalogQuery.toLowerCase())
      const matchesCategory = selectedCategory === 'all' || item.categoryId === selectedCategory
      return matchesSearch && matchesCategory
    })
  }, [catalog, searchCatalogQuery, selectedCategory])

  // Click table
  const handleTableClick = (table: PosTable) => {
    const existingOrder = openOrdersByTable.get(table.id)
    if (existingOrder) {
      // Check ownership
      if (isWaiter && existingOrder.openedBy !== session.userId) {
        error('This table has an order opened by another server.')
        return
      }
      setSelectedOrderId(existingOrder.id)
    } else {
      setTargetTableId(table.id)
      setOrderTypeSelection('dine-in')
      setCoversInput(1)
      setNewOrderNote('')
      setIsNewOrderModalOpen(true)
    }
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
        success('Order opened')
        setIsNewOrderModalOpen(false)
        router.refresh()
      }
    })
  }

  const handleAddItem = (item: CatalogItem) => {
    if (!selectedOrder || selectedOrder.status !== 'open') return
    const existing = selectedOrder.items.find(
      i => i.menuItemId === item.menuItemId && (i.variantId ?? undefined) === (item.variantId ?? undefined)
    )
    const newQty = (existing?.quantity ?? 0) + 1
    if (newQty > 99) return

    startTransition(async () => {
      const res = await addOrUpdateOrderItem(
        selectedOrder.id,
        item.menuItemId,
        newQty,
        item.effectivePrice,
        item.name,
        item.variantId,
        existing?.note
      )
      if (res?.error) error(res.error)
      else router.refresh()
    })
  }

  const handleUpdateQty = (
    menuItemId: string,
    variantId: string | undefined,
    currentQty: number,
    delta: number,
    unitPrice: number,
    nameSnapshot: string
  ) => {
    if (!selectedOrder || selectedOrder.status !== 'open') return
    const newQty = currentQty + delta
    if (newQty <= 0) {
      const item = selectedOrder.items.find(
        i => i.menuItemId === menuItemId && (i.variantId ?? undefined) === (variantId ?? undefined)
      )
      if (item) {
        startTransition(async () => {
          const res = await removeOrderItem(selectedOrder.id, item.id)
          if (res?.error) error(res.error)
          else router.refresh()
        })
      }
      return
    }

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
      if (res?.error) error(res.error)
      else {
        success('KOT fired to kitchen')
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
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400">
            <UtensilsCrossed className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              Waiter Order Station
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 font-semibold">
                Active Service
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Logged in as: {session.name} ({session.role}) &bull; {initialData.todayIST}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {session.role !== 'waiter' && (
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

          <button
            onClick={() => {
              setTargetTableId(null)
              setOrderTypeSelection('takeaway')
              setNewOrderNote('')
              setIsNewOrderModalOpen(true)
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold rounded-xl transition-all shadow-md shadow-amber-600/20"
          >
            <ShoppingBag className="w-4 h-4" />
            New Takeaway Order
          </button>

          {/* Logout Button (Req 2) */}
          <button
            onClick={() => logout()}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-sm font-semibold rounded-xl transition-all"
            title="Logout from Order Station"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Stale Orders Warning (Informational, non-blocking per Req 10.3) */}
      {!dismissStaleBanner && staleOrders.length > 0 && (
        <div className="bg-amber-950/40 border border-amber-600/40 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-amber-300 font-semibold text-sm">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <span>Notice: Unclosed orders exist from previous day service. (Informational)</span>
          </div>
          <button
            onClick={() => setDismissStaleBanner(true)}
            className="text-amber-400/70 hover:text-amber-300 text-sm font-medium"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Grid: Left = Table Grid, Right = Order & KOT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Tables & Takeaways */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* Own Takeaways */}
          {openTakeaways.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-amber-400" />
                My Active Takeaways ({openTakeaways.length})
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
                Tables
              </h2>
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5 text-slate-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Available
                </span>
                <span className="flex items-center gap-1.5 text-slate-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> My Order
                </span>
                <span className="flex items-center gap-1.5 text-slate-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-600" /> Other Server
                </span>
              </div>
            </div>

            {tables.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 bg-slate-950/40 border border-dashed border-slate-800 rounded-xl text-center">
                <Layers className="w-8 h-8 text-slate-600 mb-2" />
                <p className="text-sm font-semibold text-slate-300">No tables configured for this branch</p>
                <p className="text-xs text-slate-500 max-w-sm mt-1">
                  Ask a branch manager or administrator to configure dining tables in the POS Register or management portal.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {tables.map(table => {

                const existingOrder = openOrdersByTable.get(table.id)
                const isOccupied = !!existingOrder
                const isMyOrder = isOccupied && (!isWaiter || existingOrder.openedBy === session.userId)
                const isOtherServerOrder = isOccupied && isWaiter && existingOrder.openedBy !== session.userId
                const isSelected = selectedOrder?.tableId === table.id

                return (
                  <div
                    key={table.id}
                    onClick={() => handleTableClick(table)}
                    className={`p-4 rounded-xl border transition-all flex flex-col justify-between h-28 ${
                      isOtherServerOrder
                        ? 'bg-slate-900/60 border-slate-800/60 opacity-60 cursor-not-allowed'
                        : 'cursor-pointer hover:border-slate-600'
                    } ${
                      isSelected
                        ? 'border-amber-400 ring-2 ring-amber-400/20 bg-slate-800'
                        : isMyOrder
                        ? 'bg-amber-950/20 border-amber-500/50 hover:border-amber-400'
                        : !isOccupied
                        ? 'bg-slate-950/40 border-slate-800'
                        : ''
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <span className="font-bold text-base text-white">{table.name}</span>
                      <span
                        className={`w-2.5 h-2.5 rounded-full ${
                          isMyOrder ? 'bg-amber-500 animate-pulse' : isOtherServerOrder ? 'bg-slate-600' : 'bg-emerald-500'
                        }`}
                      />
                    </div>

                    {isMyOrder && existingOrder ? (
                      <div className="text-xs text-amber-300 font-medium">
                        {existingOrder.items.length} items &bull; {existingOrder.covers || 1} covers
                      </div>
                    ) : isOtherServerOrder ? (
                      <span className="text-[11px] text-slate-500 font-medium">Occupied (Other)</span>
                    ) : (
                      <span className="text-xs text-slate-500 font-medium">Available</span>
                    )}
                  </div>
                )
              })}
            </div>
            )}
          </div>

        </div>

        {/* Right Column: Order Panel & Menu Catalog */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {selectedOrder ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col gap-4">
              {/* Order Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    {selectedOrder.orderType === 'dine-in'
                      ? tables.find(t => t.id === selectedOrder.tableId)?.name || 'Dine-In'
                      : selectedOrder.takeawayNumber || 'Takeaway'}
                    <span className="text-xs px-2 py-0.5 rounded-full font-bold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/30">
                      Open
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Order #{selectedOrder.id.slice(-6)} &bull; {selectedOrder.covers || 1} Guests
                  </p>
                </div>
                <button
                  aria-label="Close Order Panel"
                  onClick={() => setSelectedOrderId(null)}
                  className="p-2 text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Order Note */}
              <input
                type="text"
                defaultValue={selectedOrder.note || ''}
                placeholder="Kitchen note (e.g. less salt, rush)..."
                maxLength={200}
                onBlur={e => {
                  if (e.target.value !== (selectedOrder.note || '')) {
                    updateOrderNote(selectedOrder.id, e.target.value)
                  }
                }}
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />

              {/* Items List */}
              <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
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
                          <button
                            onClick={() => setEditingNoteItem({ id: item.id, name: item.nameSnapshot, note: item.note || '' })}
                            className="text-slate-500 hover:text-amber-400 p-0.5 rounded transition-colors"
                            title="Add/edit item kitchen note"
                          >
                            <Tag className="w-3 h-3" />
                          </button>
                        </div>
                        <p className="text-xs text-slate-400">₹{item.unitPrice}</p>
                        {item.note && (
                          <p
                            onClick={() => setEditingNoteItem({ id: item.id, name: item.nameSnapshot, note: item.note || '' })}
                            className="text-[11px] italic text-amber-400/80 cursor-pointer hover:underline"
                            title="Click to edit kitchen note"
                          >
                            &ldquo;{item.note}&rdquo;
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-0.5 border border-slate-700 shrink-0">
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
                    </div>
                  ))
                )}
              </div>

              {/* Fire KOT Button */}
              <div className="pt-3 border-t border-slate-800">
                <button
                  onClick={handleFireKot}
                  disabled={selectedOrder.items.length === 0 || !hasUnfiredKotItems || isPending}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-amber-600/20"
                >
                  <Flame className="w-5 h-5" />
                  {hasUnfiredKotItems ? 'Fire KOT to Kitchen' : 'Kitchen Up to Date'}
                </button>
              </div>

              {/* KOT History (Read-only for waiter, NO advance button) */}
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
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
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
                    ))}
                  </div>
                </div>
              )}

              {/* Menu Catalog Search & Quick Add */}
              <div className="pt-3 border-t border-slate-800 flex flex-col gap-2">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Select Items to Add</h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Search dishes..."
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
                      <option value="all">All</option>
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
                  {filteredCatalog.slice(0, 24).map(item => (
                    <button
                      key={`${item.menuItemId}_${item.variantId || 'base'}`}
                      onClick={() => handleAddItem(item)}
                      className="flex flex-col items-start p-2.5 bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800 rounded-xl text-left transition-colors"
                    >
                      <span className="font-semibold text-xs text-white truncate w-full">{item.name}</span>
                      <div className="flex items-center justify-between w-full mt-1">
                        <span className="text-[11px] font-bold text-emerald-400">₹{item.effectivePrice}</span>
                        {item.dietary && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-semibold uppercase">
                            {item.dietary}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center flex flex-col items-center justify-center min-h-[300px]">
              <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 mb-3">
                <UtensilsCrossed className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white mb-1">Select a Table</h3>
              <p className="text-xs text-slate-400 max-w-xs">
                Tap an available green table or takeaway order to open an order and select items.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* New Order Modal */}
      {isNewOrderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-3">
              Open {orderTypeSelection === 'dine-in' ? 'Dine-In' : 'Takeaway'} Order
            </h3>
            <form onSubmit={handleCreateOrderSubmit} className="flex flex-col gap-4">
              {orderTypeSelection === 'dine-in' && (
                <div>
                  <label htmlFor="coversInput" className="text-xs font-semibold text-slate-300 block mb-1">Guests / Covers</label>
                  <input
                    id="coversInput"
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
                <label htmlFor="newOrderNote" className="text-xs font-semibold text-slate-300 block mb-1">Optional Note</label>
                <input
                  id="newOrderNote"
                  type="text"
                  maxLength={200}
                  value={newOrderNote}
                  onChange={e => setNewOrderNote(e.target.value)}
                  placeholder="e.g. VIP, seating note"
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
                  Start Order
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
    </div>
  )
}

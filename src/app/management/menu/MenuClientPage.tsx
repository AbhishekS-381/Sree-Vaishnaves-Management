"use client"

import React, { useMemo, useState, useTransition } from 'react'
import {
  Store, Plus, Search, CheckCircle2, XCircle, Trash2, UtensilsCrossed, Pencil,
  ChevronDown, ArrowUp, ArrowDown, Clock, Download, Copy, RefreshCw, Filter,
} from 'lucide-react'
import {
  setBranchItemAvailability,
  deleteMenuItem,
  restoreMenuItem,
  updateBranchMenuItemPrice,
  bulkSetBranchAvailability,
  bulkUpdateBranchPrices,
  reorderMenuItems,
} from '@/app/actions/menu'
import {
  deleteMenuCategory, addMenuCategory, updateMenuCategory,
  setBranchCategoryAvailability, reorderMenuCategories,
} from '@/app/actions/menu_categories'
import { GenericEntityModal } from '@/components/GenericEntityModal'
import { MenuItemModal } from '@/components/MenuItemModal'
import { BulkActionBar } from '@/components/BulkActionBar'
import { CloneBranchModal } from '@/components/CloneBranchModal'
import { ToastStack, useToast } from '@/components/Toast'
import { useMenuResolver } from '@/hooks/useMenuResolver'
import { resolveEffectiveBasePrice, resolvePrice, isPriceOverridden } from '@/lib/menuResolver'

const AUTO_COLLAPSE_THRESHOLD = 150

type Props = {
  branches: any[]
  initialMenu: any[]
  categories: any[]
  branchMenuItems: any[]
  branchCategories: any[]
  variants?: any[]
  userRole: string
  isGlobalAdmin: boolean
}

// ── inline price editor ──────────────────────────────────────────────────────

function PriceEditor({
  price, basePrice, onSave, disabled = false,
}: {
  price: number
  basePrice: number
  onSave: (price: number | null) => Promise<void>
  disabled?: boolean
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [val, setVal] = useState(String(price))

  const commit = async () => {
    setIsEditing(false)
    const n = Number(val)
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) return
    if (n === price) return
    await onSave(n === basePrice ? null : n)
  }

  if (!isEditing) {
    const overridden = isPriceOverridden(price === basePrice ? null : price, basePrice)
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => { setVal(String(price)); setIsEditing(true) }}
        className="group flex items-center gap-1 hover:bg-white/5 px-2 py-1 rounded transition-colors disabled:cursor-default"
        title={disabled ? undefined : 'Click to edit price'}
      >
        <span className="text-lg font-bold text-emerald-400">₹{price}</span>
        {!disabled && (overridden ? (
          <span className="text-[10px] uppercase text-amber-500/80 border border-amber-500/20 px-1 rounded">Override</span>
        ) : (
          <span className="text-[10px] uppercase text-emerald-500/50 border border-emerald-500/20 px-1 rounded">Base</span>
        ))}
      </button>
    )
  }

  return (
    <div className="flex items-center gap-1 bg-black/40 p-1 rounded border border-[#c084fc]">
      <span className="text-sm font-bold text-emerald-400">₹</span>
      <input
        autoFocus
        type="number"
        min={0}
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') { setIsEditing(false); setVal(String(price)) }
        }}
        // Commit on blur rather than silently discarding the edit.
        onBlur={commit}
        className="w-16 bg-transparent text-emerald-400 text-lg font-bold outline-none px-1"
        aria-label="Price"
      />
    </div>
  )
}

// ── page ─────────────────────────────────────────────────────────────────────

export default function MenuClientPage({
  branches, initialMenu, categories, branchMenuItems, branchCategories,
  variants = [], userRole, isGlobalAdmin,
}: Props) {
  const canEditGlobal = isGlobalAdmin
  const canEditBranch = isGlobalAdmin || userRole === 'manager'
  const canSeeCost = isGlobalAdmin

  const [selectedBranch, setSelectedBranch] = useState(branches[0]?.id || '')
  const [activeTab, setActiveTab] = useState<'menu' | 'matrix' | 'categories' | 'archive'>('menu')
  const [isPending, startTransition] = useTransition()
  const toast = useToast()

  const [itemModal, setItemModal] = useState<{ open: boolean; data: any }>({ open: false, data: null })
  const [menuCatModal, setMenuCatModal] = useState<{ open: boolean; data: any }>({ open: false, data: null })
  const [cloneOpen, setCloneOpen] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  // Optimistic overlay: id|variantId -> partial patch. Cleared when the server
  // data comes back through revalidation.
  const [optimistic, setOptimistic] = useState<Record<string, { isAvailable?: boolean; price?: number | null }>>({})

  const effectiveBranchMenuItems = useMemo(() => {
    return branchMenuItems.map(row => {
      const key = `${row.menuItemId}:${row.variantId ?? ''}`
      const patch = optimistic[key]
      return patch ? { ...row, ...patch } : row
    })
  }, [branchMenuItems, optimistic])

  const {
    filters, setFilters, resetFilters,
    groupedItems, archivedItems, enrichedCategories, categoryName, counts, resolvedItems,
  } = useMenuResolver({
    menu: initialMenu,
    variants,
    categories,
    branchMenuItems: effectiveBranchMenuItems,
    branchCategories,
    selectedBranch,
  })

  const branchName = branches.find(b => b.id === selectedBranch)?.name ?? 'this branch'

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    if (initialMenu.length <= AUTO_COLLAPSE_THRESHOLD) return {}
    // Large catalog: collapse everything but the first category for performance.
    const out: Record<string, boolean> = {}
    categories.slice(1).forEach((c: any) => { out[c.id] = true })
    return out
  })

  const report = (res: any, successText?: string) => {
    if (res?.error) { toast.error(res.error); return false }
    if (res?.warning) { toast.info(res.warning); return true }
    if (successText) toast.success(successText)
    return true
  }

  const patch = (menuItemId: string, variantId: string | undefined, changes: { isAvailable?: boolean; price?: number | null }) => {
    setOptimistic(prev => ({ ...prev, [`${menuItemId}:${variantId ?? ''}`]: { ...prev[`${menuItemId}:${variantId ?? ''}`], ...changes } }))
  }
  const revert = (menuItemId: string, variantId?: string) => {
    setOptimistic(prev => {
      const next = { ...prev }
      delete next[`${menuItemId}:${variantId ?? ''}`]
      return next
    })
  }

  // ── actions ───────────────────────────────────────────────────────────────

  const toggleItemAvailability = async (item: any) => {
    const next = !item.isAvailable
    patch(item.id, undefined, { isAvailable: next })
    const res = await setBranchItemAvailability(selectedBranch, item.id, next)
    if (res?.error) { revert(item.id); toast.error(res.error) }
  }

  const saveItemPrice = async (item: any, price: number | null) => {
    patch(item.id, undefined, { price })
    const res = await updateBranchMenuItemPrice(selectedBranch, item.id, price)
    if (res?.error) { revert(item.id); toast.error(res.error) }
    else toast.success(`${item.name} price updated`)
  }

  const saveVariantPrice = async (item: any, variantId: string, price: number | null) => {
    patch(item.id, variantId, { price })
    const res = await updateBranchMenuItemPrice(selectedBranch, item.id, price, variantId)
    if (res?.error) { revert(item.id, variantId); toast.error(res.error) }
  }

  const toggleCategoryAvailability = async (categoryId: string, current: boolean) => {
    const res = await setBranchCategoryAvailability(selectedBranch, categoryId, !current)
    if (res?.error) toast.error(res.error)
    else startTransition(() => { toast.success('Category availability updated') })
  }

  const handleDeleteItem = async (item: any) => {
    if (!window.confirm(`Archive "${item.name}"? It will be hidden everywhere but kept in the Archive tab.`)) return
    const res = await deleteMenuItem(item.id)
    report(res, `${item.name} archived`)
  }

  const handleRestoreItem = async (item: any) => {
    const res = await restoreMenuItem(item.id)
    report(res, `${item.name} restored`)
  }

  const handleBulkAvailability = async (isAvailable: boolean) => {
    setBusy(true)
    const res = await bulkSetBranchAvailability(selectedBranch, selectedIds, isAvailable)
    setBusy(false)
    if (report(res, `${res?.changed ?? 0} item(s) updated in ${branchName}`)) setSelectedIds([])
  }

  const handleBulkPrice = async (mode: 'percent' | 'flat' | 'set', value: number) => {
    setBusy(true)
    const res = await bulkUpdateBranchPrices(selectedBranch, selectedIds, mode, value)
    setBusy(false)
    if (report(res, `${res?.changed ?? 0} price(s) updated in ${branchName}`)) setSelectedIds([])
  }

  const moveCategory = async (index: number, direction: -1 | 1) => {
    const ordered = [...enrichedCategories]
    const target = index + direction
    if (target < 0 || target >= ordered.length) return
    ;[ordered[index], ordered[target]] = [ordered[target], ordered[index]]
    const res = await reorderMenuCategories(ordered.map(c => c.id))
    report(res, 'Category order saved')
  }

  const moveItem = async (categoryId: string, items: any[], index: number, direction: -1 | 1) => {
    const ordered = [...items]
    const target = index + direction
    if (target < 0 || target >= ordered.length) return
    ;[ordered[index], ordered[target]] = [ordered[target], ordered[index]]
    const res = await reorderMenuItems(categoryId, ordered.map(i => i.id))
    report(res, 'Item order saved')
  }

  // ── export ────────────────────────────────────────────────────────────────

  const exportCsv = () => {
    const header = ['Category', 'Item', 'Base Price', `${branchName} Price`, 'Overridden', 'Available', 'Variants']
    if (canSeeCost) header.push('Cost Price', 'Food Cost %')

    const rows = resolvedItems.map(i => {
      const row = [
        categoryName(i.categoryId),
        i.name,
        String(i.basePriceEffective),
        String(i.price),
        i.isOverridden ? 'Yes' : 'No',
        i.isAvailable ? 'Yes' : 'No',
        i.variants.map(v => `${v.name}:${v.price}`).join(' | '),
      ]
      if (canSeeCost) row.push(i.costPrice != null ? String(i.costPrice) : '', i.margin ? String(i.margin.foodCostPct) : '')
      return row
    })

    const csv = [header, ...rows]
      .map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `menu_${branchName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Menu exported')
  }

  // ── render helpers ────────────────────────────────────────────────────────

  const allShownIds = groupedItems.flatMap(g => g.items.map(i => i.id))
  const allSelected = allShownIds.length > 0 && allShownIds.every(id => selectedIds.includes(id))

  const tabs: { key: typeof activeTab; label: string; adminOnly?: boolean }[] = [
    { key: 'menu', label: 'Menu' },
    { key: 'matrix', label: 'Price Matrix', adminOnly: true },
    { key: 'categories', label: 'Categories', adminOnly: true },
    { key: 'archive', label: `Archive${counts.archived ? ` (${counts.archived})` : ''}`, adminOnly: true },
  ]

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-32">
      <ToastStack messages={toast.messages} onDismiss={toast.dismiss} />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Menu Management</h1>
          <p className="text-slate-400 mt-1">
            Manage items, pricing and availability.
            <span className="ml-2 text-slate-500 text-sm">
              {counts.shown} of {counts.total} shown · {counts.available} available · {counts.overridden} overridden
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={exportCsv}
            className="bg-[#252033] hover:bg-[#2d283e] text-slate-200 border border-white/10 font-medium py-2.5 px-4 rounded-xl flex items-center gap-2 text-sm">
            <Download size={16} /> Export
          </button>
          {canEditBranch && branches.length > 1 && (
            <button onClick={() => setCloneOpen(true)}
              className="bg-[#252033] hover:bg-[#2d283e] text-slate-200 border border-white/10 font-medium py-2.5 px-4 rounded-xl flex items-center gap-2 text-sm">
              <Copy size={16} /> Copy Branch
            </button>
          )}
          {canEditGlobal && activeTab === 'menu' && (
            <button onClick={() => setItemModal({ open: true, data: null })}
              className="bg-primary hover:bg-primary/90 text-white font-medium py-2.5 px-6 rounded-xl flex items-center gap-2">
              <Plus size={18} /> Add Menu Item
            </button>
          )}
        </div>
      </div>

      {canEditGlobal && (
        <div className="flex gap-2 border-b border-white/10 pb-2 overflow-x-auto">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`px-4 py-2 font-bold whitespace-nowrap transition-colors ${
                activeTab === t.key ? 'text-primary border-b-2 border-primary' : 'text-slate-400 hover:text-slate-200'
              }`}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* ── MENU TAB ───────────────────────────────────────────────────── */}
      {activeTab === 'menu' && (
        <>
          <div className="bg-card p-4 rounded-2xl border border-white/5 flex flex-col gap-4">
            <div className="flex flex-col md:flex-row gap-4 items-center">
              <div className="flex relative items-center w-full md:w-auto">
                <Store className="w-5 h-5 absolute left-3 text-slate-400" />
                <select
                  className="w-full pl-10 pr-10 py-2.5 bg-[#1e1b2e] border border-[#3b3054] rounded-xl text-sm focus:border-[#c084fc] outline-none cursor-pointer text-slate-200"
                  value={selectedBranch}
                  onChange={e => { setSelectedBranch(e.target.value); setOptimistic({}); setSelectedIds([]) }}
                  aria-label="Select branch"
                >
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>

              <div className="flex relative items-center w-full md:flex-1 md:max-w-xs">
                <Search className="w-4 h-4 absolute left-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search menu..."
                  className="w-full pl-9 pr-4 py-2.5 bg-[#1e1b2e] border border-white/10 rounded-xl text-sm outline-none text-slate-200"
                  value={filters.search}
                  onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
                />
              </div>

              <div className="flex items-center gap-2 ml-auto">
                <select
                  value={filters.sort}
                  onChange={e => setFilters(f => ({ ...f, sort: e.target.value as any }))}
                  className="bg-[#1e1b2e] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-slate-200 outline-none"
                  aria-label="Sort"
                >
                  <option value="menu">Menu order</option>
                  <option value="name">Name</option>
                  <option value="price-asc">Price ↑</option>
                  <option value="price-desc">Price ↓</option>
                </select>
                <button onClick={() => setShowFilters(v => !v)}
                  className="bg-[#1e1b2e] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-slate-200 flex items-center gap-2">
                  <Filter size={14} /> Filters
                </button>
              </div>
            </div>

            {showFilters && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-white/5 pt-4">
                <select
                  value={filters.availability}
                  onChange={e => setFilters(f => ({ ...f, availability: e.target.value as any }))}
                  className="bg-[#131018] border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none"
                  aria-label="Availability filter"
                >
                  <option value="all">All availability</option>
                  <option value="available">Available only</option>
                  <option value="unavailable">Unavailable only</option>
                </select>

                <select
                  value={filters.categoryIds[0] ?? ''}
                  onChange={e => setFilters(f => ({ ...f, categoryIds: e.target.value ? [e.target.value] : [] }))}
                  className="bg-[#131018] border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none"
                  aria-label="Category filter"
                >
                  <option value="">All categories</option>
                  {enrichedCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>

                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                    <input type="checkbox" checked={filters.overriddenOnly}
                      onChange={e => setFilters(f => ({ ...f, overriddenOnly: e.target.checked }))}
                      className="w-4 h-4 accent-primary" />
                    Overridden only
                  </label>
                  <button onClick={resetFilters} className="text-xs text-slate-400 hover:text-white flex items-center gap-1 ml-auto">
                    <RefreshCw size={12} /> Reset
                  </button>
                </div>
              </div>
            )}

            {canEditBranch && allShownIds.length > 0 && (
              <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer border-t border-white/5 pt-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={e => setSelectedIds(e.target.checked ? allShownIds : [])}
                  className="w-4 h-4 accent-primary"
                />
                Select all {allShownIds.length} shown
              </label>
            )}
          </div>

          {groupedItems.length === 0 ? (
            <div className="text-center p-12 text-slate-500 bg-card rounded-2xl border border-white/5">
              No menu items match your filters.
            </div>
          ) : (
            groupedItems.map(({ category, items }) => {
              const isCatAvailable = category.isAvailable
              if (!canEditBranch && !isCatAvailable) return null
              const isCollapsed = collapsed[category.id]

              return (
                <div key={category.id}
                  className={`bg-card border border-white/5 rounded-2xl overflow-hidden shadow-sm mb-6 ${!isCatAvailable ? 'opacity-60 grayscale' : ''} transition-all`}>
                  <div
                    className="bg-[#252033] px-6 py-3 border-b border-[#3b3054] flex items-center justify-between cursor-pointer hover:bg-[#2d283e]"
                    onClick={() => setCollapsed(prev => ({ ...prev, [category.id]: !prev[category.id] }))}
                  >
                    <div className="flex items-center gap-2">
                      <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                      <h2 className="text-lg font-bold text-slate-200 uppercase tracking-wider">{category.name}</h2>
                      <span className="text-xs text-slate-500">({items.length})</span>
                    </div>
                    <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
                      {canEditBranch && category.id !== '__orphan' && (
                        <button
                          onClick={() => toggleCategoryAvailability(category.id, isCatAvailable)}
                          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition-colors ${
                            isCatAvailable
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                              : 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20'
                          }`}
                        >
                          {isCatAvailable ? <><CheckCircle2 size={14} /> Enabled</> : <><XCircle size={14} /> Disabled</>}
                        </button>
                      )}
                    </div>
                  </div>

                  {!isCollapsed && (
                    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 bg-[#1a1625]">
                      {items.map((item, index) => {
                        if (!canEditBranch && !item.isAvailable) return null
                        const checked = selectedIds.includes(item.id)

                        return (
                          <div key={item.id}
                            className={`flex flex-col p-4 bg-[#252033] border rounded-xl transition-all group shadow-sm ${
                              checked ? 'border-primary/50 ring-1 ring-primary/30' : 'border-white/5 hover:border-emerald-500/30'
                            }`}>
                            <div className="flex justify-between items-start mb-2 gap-2">
                              <div className="flex items-start gap-2 min-w-0">
                                {canEditBranch && (
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={e => setSelectedIds(prev =>
                                      e.target.checked ? [...prev, item.id] : prev.filter(id => id !== item.id)
                                    )}
                                    className="mt-1 w-4 h-4 accent-primary shrink-0"
                                    aria-label={`Select ${item.name}`}
                                  />
                                )}
                                <div className="min-w-0">
                                  <h3 className="font-semibold text-slate-100 truncate" title={item.name}>{item.name}</h3>
                                  {item.description && (
                                    <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">{item.description}</p>
                                  )}
                                </div>
                              </div>
                              {canEditGlobal && (
                                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                                  <button onClick={() => setItemModal({ open: true, data: item })}
                                    className="text-slate-500 hover:text-white p-1" title="Edit item">
                                    <Pencil size={14} />
                                  </button>
                                  <button onClick={() => handleDeleteItem(item)}
                                    className="text-slate-500 hover:text-red-400 p-1" title="Archive item">
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              )}
                            </div>

                            <div className="flex flex-wrap gap-1 mb-2">
                              {item.hasWindow && (
                                <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20 flex items-center gap-1">
                                  <Clock size={9} /> Timed
                                </span>
                              )}
                              {item.isSignature && (
                                <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">Signature</span>
                              )}
                              {(item.dietary ?? []).map((d: string) => (
                                <span key={d} className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">{d}</span>
                              ))}
                              {canSeeCost && item.margin && (
                                <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20"
                                  title="Food cost as % of price">
                                  FC {item.margin.foodCostPct}%
                                </span>
                              )}
                            </div>

                            {item.variants.length > 0 && (
                              <div className="space-y-1 mb-2 border-t border-white/5 pt-2">
                                {item.variants.map(v => (
                                  <div key={v.id} className="flex items-center justify-between text-xs">
                                    <span className="text-slate-400">{v.name}</span>
                                    {canEditBranch ? (
                                      <PriceEditor
                                        price={v.price}
                                        basePrice={v.basePrice}
                                        onSave={p => saveVariantPrice(item, v.id, p)}
                                      />
                                    ) : (
                                      <span className="font-bold text-emerald-400">₹{v.price}</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            <div className="flex items-end justify-between mt-auto gap-2">
                              {canEditBranch ? (
                                <PriceEditor
                                  price={item.price}
                                  basePrice={item.basePriceEffective}
                                  onSave={p => saveItemPrice(item, p)}
                                />
                              ) : (
                                <span className="text-lg font-bold text-emerald-400">₹{item.price}</span>
                              )}

                              <div className="flex items-center gap-1">
                                {canEditGlobal && (
                                  <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button disabled={index === 0} onClick={() => moveItem(category.id, items, index, -1)}
                                      className="text-slate-500 hover:text-white disabled:opacity-20 p-0.5" title="Move up">
                                      <ArrowUp size={12} />
                                    </button>
                                    <button disabled={index === items.length - 1} onClick={() => moveItem(category.id, items, index, 1)}
                                      className="text-slate-500 hover:text-white disabled:opacity-20 p-0.5" title="Move down">
                                      <ArrowDown size={12} />
                                    </button>
                                  </div>
                                )}
                                {canEditBranch ? (
                                  <button
                                    onClick={() => toggleItemAvailability(item)}
                                    className={`px-2.5 py-1 rounded-md text-[10px] uppercase tracking-wider font-bold border transition-colors ${
                                      item.isAvailable
                                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                                        : 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20'
                                    }`}
                                  >
                                    {item.isAvailable ? 'On' : 'Off'}
                                  </button>
                                ) : (
                                  <span className="px-2.5 py-1 rounded-md text-[10px] uppercase font-bold border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">On</span>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </>
      )}

      {/* ── PRICE MATRIX TAB (price + availability) ────────────────────── */}
      {activeTab === 'matrix' && canEditGlobal && (
        <div className="bg-card rounded-2xl border border-white/5 overflow-x-auto shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#252033] border-b border-[#3b3054]">
                <th className="p-4 text-slate-300 font-bold min-w-[200px] sticky left-0 bg-[#252033] z-10">Item</th>
                <th className="p-4 text-slate-300 font-bold min-w-[110px]">Base</th>
                {branches.map(b => (
                  <th key={b.id} className="p-4 text-slate-300 font-bold min-w-[130px]">{b.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {enrichedCategories.map(cat => {
                const catItems = initialMenu
                  .filter((m: any) => m.categoryId === cat.id && m.isActive !== false)
                  .sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0))
                if (catItems.length === 0) return null

                return (
                  <React.Fragment key={cat.id}>
                    <tr className="bg-[#1e1b2e] border-b border-[#3b3054]">
                      <td colSpan={2 + branches.length}
                        className="px-4 py-2 font-bold text-pink-400 text-sm uppercase tracking-wider sticky left-0 bg-[#1e1b2e]">
                        {cat.name}
                      </td>
                    </tr>
                    {catItems.map((item: any) => (
                      <tr key={item.id} className="border-b border-[#3b3054]/50 hover:bg-white/[0.02]">
                        <td className="p-4 text-slate-200 sticky left-0 bg-card">{item.name}</td>
                        <td className="p-4 text-slate-400 font-medium">₹{item.basePrice || 0}</td>
                        {branches.map(b => {
                          const mapping = branchMenuItems.find(
                            (m: any) => m.menuItemId === item.id && m.branchId === b.id && !m.variantId
                          )
                          const base = resolveEffectiveBasePrice(item)
                          const price = resolvePrice(mapping?.price, base)
                          const available = mapping ? mapping.isAvailable !== false : true
                          return (
                            <td key={b.id} className="p-4">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`w-2 h-2 rounded-full shrink-0 ${available ? 'bg-emerald-400' : 'bg-red-400'}`}
                                  title={available ? 'Available' : 'Unavailable'}
                                />
                                <PriceEditor
                                  price={price}
                                  basePrice={base}
                                  onSave={async p => {
                                    const res = await updateBranchMenuItemPrice(b.id, item.id, p)
                                    if (res?.error) toast.error(res.error)
                                    else toast.success(`${item.name} · ${b.name} updated`)
                                  }}
                                />
                              </div>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── CATEGORIES TAB ─────────────────────────────────────────────── */}
      {activeTab === 'categories' && canEditGlobal && (
        <section className="bg-card rounded-2xl border border-white/5 shadow-sm p-6 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-pink-500/10 text-pink-400 rounded-lg border border-pink-500/20">
                <UtensilsCrossed className="h-5 w-5" />
              </div>
              <h2 className="text-lg font-bold text-white">Manage Food Categories</h2>
            </div>
            <button onClick={() => setMenuCatModal({ open: true, data: null })}
              className="bg-pink-500/10 text-pink-400 px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-pink-500/20 flex items-center gap-1.5">
              <Plus className="h-4 w-4" /> Add Category
            </button>
          </div>

          <div className="flex flex-col gap-3">
            {enrichedCategories.map((c, index) => (
              <div key={c.id}
                className="p-4 bg-[#252033] rounded-xl border border-white/5 flex items-center justify-between group hover:bg-[#2d283e] hover:border-pink-500/30 transition-all">
                <span className="font-semibold text-slate-200">{c.name}</span>
                <div className="flex items-center gap-3">
                  <div className="flex items-center bg-black/20 rounded-md p-1 border border-white/5">
                    <button disabled={index === 0} onClick={() => moveCategory(index, -1)}
                      className="text-slate-400 hover:text-white disabled:opacity-30 p-1 rounded hover:bg-white/10" aria-label="Move up">
                      <ArrowUp size={16} />
                    </button>
                    <div className="w-px h-4 bg-white/10 mx-1" />
                    <button disabled={index === enrichedCategories.length - 1} onClick={() => moveCategory(index, 1)}
                      className="text-slate-400 hover:text-white disabled:opacity-30 p-1 rounded hover:bg-white/10" aria-label="Move down">
                      <ArrowDown size={16} />
                    </button>
                  </div>
                  <button onClick={() => setMenuCatModal({ open: true, data: c })}
                    className="text-slate-400 hover:text-white p-2 bg-black/20 rounded-md hover:bg-white/10" aria-label="Edit">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={async () => {
                      if (!window.confirm(`Archive the "${c.name}" category?`)) return
                      report(await deleteMenuCategory(c.id), 'Category archived')
                    }}
                    className="text-slate-400 hover:text-red-400 p-2 bg-black/20 rounded-md hover:bg-red-500/10" aria-label="Delete">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
            {enrichedCategories.length === 0 && (
              <div className="text-center py-10 text-slate-500 text-sm italic border-2 border-dashed border-[#3b3054] rounded-2xl">
                No menu categories yet. Add one to classify your items.
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── ARCHIVE TAB ────────────────────────────────────────────────── */}
      {activeTab === 'archive' && canEditGlobal && (
        <div className="bg-card rounded-2xl border border-white/5 shadow-sm p-6">
          <h2 className="text-lg font-bold text-white mb-1">Archived Items</h2>
          <p className="text-sm text-slate-400 mb-6">
            Archived items are hidden everywhere but their history and branch pricing are preserved.
          </p>

          {archivedItems.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-sm italic border-2 border-dashed border-[#3b3054] rounded-2xl">
              Nothing archived.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {archivedItems.map((item: any) => (
                <div key={item.id}
                  className="p-4 bg-[#252033] rounded-xl border border-white/5 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-slate-200">{item.name}</span>
                    <span className="ml-3 text-xs text-slate-500">{categoryName(item.categoryId)}</span>
                    {item.deletedAt && (
                      <span className="ml-3 text-[11px] text-slate-600">
                        archived {new Date(item.deletedAt).toLocaleDateString('en-GB')}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleRestoreItem(item)}
                    className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-emerald-500/20"
                  >
                    Restore
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── bulk bar & modals ──────────────────────────────────────────── */}
      {activeTab === 'menu' && canEditBranch && (
        <BulkActionBar
          selectedCount={selectedIds.length}
          branchName={branchName}
          busy={busy || isPending}
          onClear={() => setSelectedIds([])}
          onSetAvailability={handleBulkAvailability}
          onPriceChange={handleBulkPrice}
        />
      )}

      <MenuItemModal
        isOpen={itemModal.open}
        onClose={() => setItemModal({ open: false, data: null })}
        editData={itemModal.data}
        categories={categories}
        variants={variants}
        canSeeCost={canSeeCost}
        onResult={res => report(res, itemModal.data ? 'Item updated' : 'Item created')}
      />

      <CloneBranchModal
        isOpen={cloneOpen}
        onClose={() => setCloneOpen(false)}
        branches={branches}
        defaultTargetId={selectedBranch}
        onResult={res => report(res, `Copied ${res?.applied ?? 0} mapping(s)`)}
      />

      <GenericEntityModal
        isOpen={menuCatModal.open}
        onClose={() => setMenuCatModal({ open: false, data: null })}
        title="Menu Category"
        editData={menuCatModal.data}
        addAction={addMenuCategory}
        updateAction={updateMenuCategory}
        fields={[
          { name: 'name', label: 'Category Name', type: 'text', required: true, placeholder: 'e.g. Starters, Main Course, Beverages' },
        ]}
      />
    </div>
  )
}

"use client"

import { useState } from 'react'
import { Loader2, X, CheckCircle2, XCircle, IndianRupee } from 'lucide-react'

type Mode = 'percent' | 'flat' | 'set'

/**
 * Floating bar shown while items are multi-selected on the Menu tab.
 * Every destructive/bulk action shows an explicit count before it runs so a
 * mistyped percentage can't silently reprice a whole category.
 */
export function BulkActionBar({
  selectedCount,
  branchName,
  onClear,
  onSetAvailability,
  onPriceChange,
  busy = false,
}: {
  selectedCount: number
  branchName: string
  onClear: () => void
  onSetAvailability: (isAvailable: boolean) => Promise<void> | void
  onPriceChange: (mode: Mode, value: number) => Promise<void> | void
  busy?: boolean
}) {
  const [mode, setMode] = useState<Mode>('percent')
  const [value, setValue] = useState('')

  if (selectedCount === 0) return null

  const numeric = Number(value)
  const valid = value !== '' && Number.isFinite(numeric) && (mode !== 'set' || numeric >= 0)

  const describe = () => {
    if (!valid) return ''
    if (mode === 'percent') return `${numeric > 0 ? '+' : ''}${numeric}% on ${selectedCount} item(s)`
    if (mode === 'flat') return `${numeric > 0 ? '+' : ''}₹${numeric} on ${selectedCount} item(s)`
    return `Set ₹${numeric} on ${selectedCount} item(s)`
  }

  const applyPrice = async () => {
    if (!valid) return
    const ok = window.confirm(
      `${describe()} in ${branchName}.\n\nThis updates branch prices only — base prices are unchanged. Continue?`
    )
    if (!ok) return
    await onPriceChange(mode, numeric)
    setValue('')
  }

  const applyAvailability = async (isAvailable: boolean) => {
    const ok = window.confirm(
      `Mark ${selectedCount} item(s) as ${isAvailable ? 'available' : 'unavailable'} in ${branchName}?`
    )
    if (!ok) return
    await onSetAvailability(isAvailable)
  }

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 md:pl-72 p-4 pointer-events-none"
      data-testid="bulk-action-bar"
    >
      <div className="pointer-events-auto max-w-5xl mx-auto bg-[#1e1b2e]/95 backdrop-blur-md border border-primary/30 rounded-2xl shadow-2xl shadow-black/40 p-4 flex flex-col lg:flex-row lg:items-center gap-4">

        <div className="flex items-center gap-3 shrink-0">
          <span className="bg-primary/20 text-accent border border-primary/30 px-3 py-1 rounded-full text-sm font-bold">
            {selectedCount} selected
          </span>
          <button
            onClick={onClear}
            className="text-slate-400 hover:text-white text-xs flex items-center gap-1"
          >
            <X size={12} /> Clear
          </button>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            disabled={busy}
            onClick={() => applyAvailability(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 disabled:opacity-50"
          >
            <CheckCircle2 size={14} /> Enable
          </button>
          <button
            disabled={busy}
            onClick={() => applyAvailability(false)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 disabled:opacity-50"
          >
            <XCircle size={14} /> Disable
          </button>
        </div>

        <div className="h-px lg:h-8 w-full lg:w-px bg-white/10" />

        <div className="flex flex-1 items-center gap-2 min-w-0">
          <IndianRupee size={14} className="text-slate-400 shrink-0" />
          <select
            value={mode}
            onChange={e => setMode(e.target.value as Mode)}
            className="bg-[#131018] border border-white/10 rounded-lg px-2 py-2 text-xs text-slate-200 outline-none focus:border-primary shrink-0"
            aria-label="Price change mode"
          >
            <option value="percent">Change by %</option>
            <option value="flat">Change by ₹</option>
            <option value="set">Set price to ₹</option>
          </select>
          <input
            type="number"
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder={mode === 'percent' ? 'e.g. 10 or -5' : 'e.g. 20'}
            className="w-28 bg-[#131018] border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-primary shrink-0"
            aria-label="Price change value"
          />
          <button
            disabled={!valid || busy}
            onClick={applyPrice}
            className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg text-xs font-bold disabled:opacity-40 flex items-center gap-2 shrink-0"
          >
            {busy && <Loader2 className="h-3 w-3 animate-spin" />}
            Apply
          </button>
          {valid && (
            <span className="text-[11px] text-slate-400 truncate hidden xl:inline">{describe()}</span>
          )}
        </div>
      </div>
    </div>
  )
}

"use client"

import { useEffect, useState } from 'react'
import { X, Loader2, Copy } from 'lucide-react'
import { cloneBranchMenuConfig } from '@/app/actions/menu'

type Branch = { id: string; name: string }

/**
 * Copy one branch's menu configuration (prices and/or availability) onto
 * another. Intended for onboarding a new branch without re-pricing by hand.
 */
export function CloneBranchModal({
  isOpen,
  onClose,
  branches,
  defaultTargetId,
  onResult,
}: {
  isOpen: boolean
  onClose: () => void
  branches: Branch[]
  defaultTargetId?: string
  onResult?: (result: { success?: boolean; error?: string; applied?: number }) => void
}) {
  const [fromId, setFromId] = useState('')
  const [toId, setToId] = useState(defaultTargetId ?? '')
  const [copyPrices, setCopyPrices] = useState(true)
  const [copyAvailability, setCopyAvailability] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen) return
    setError('')
    setLoading(false)
    setToId(defaultTargetId ?? '')
    setFromId(branches.find(b => b.id !== defaultTargetId)?.id ?? '')
    setCopyPrices(true)
    setCopyAvailability(true)
  }, [isOpen, defaultTargetId, branches])

  if (!isOpen) return null

  const fromName = branches.find(b => b.id === fromId)?.name ?? '—'
  const toName = branches.find(b => b.id === toId)?.name ?? '—'
  const sameBranch = Boolean(fromId) && fromId === toId
  const nothingSelected = !copyPrices && !copyAvailability
  const canSubmit = Boolean(fromId && toId) && !sameBranch && !nothingSelected && !loading

  const handleSubmit = async () => {
    setError('')
    const ok = window.confirm(
      `Copy ${[copyPrices && 'prices', copyAvailability && 'availability'].filter(Boolean).join(' + ')} ` +
      `from ${fromName} to ${toName}?\n\nExisting values in ${toName} will be overwritten.`
    )
    if (!ok) return

    setLoading(true)
    const res = await cloneBranchMenuConfig(fromId, toId, {
      prices: copyPrices,
      availability: copyAvailability,
    })
    setLoading(false)

    if (res?.error) {
      setError(res.error)
      return
    }
    onResult?.(res ?? {})
    onClose()
  }

  const field = 'w-full bg-[#1e1b2e] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-primary'

  return (
    <div className="fixed inset-0 z-[100]">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
        <div className="relative w-full max-w-md bg-[#13101c] border border-[#2d2438] rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 pointer-events-auto">

          <div className="px-6 py-4 border-b border-[#2d2438] flex items-center justify-between">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Copy size={18} className="text-accent" /> Copy Branch Menu
            </h2>
            <button onClick={onClose} className="text-slate-400 hover:text-white bg-black/20 p-2 rounded-full hover:bg-white/10" aria-label="Close">
              <X size={16} />
            </button>
          </div>

          <div className="p-6 space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Copy from</label>
              <select value={fromId} onChange={e => setFromId(e.target.value)} className={field}>
                <option value="">Select source branch</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Copy to</label>
              <select value={toId} onChange={e => setToId(e.target.value)} className={field}>
                <option value="">Select target branch</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>

            <div className="space-y-2 border-t border-[#3b3054] pt-4">
              <label className="flex items-center gap-3 text-sm text-slate-300 cursor-pointer p-2 rounded-lg hover:bg-white/5">
                <input type="checkbox" checked={copyPrices} onChange={e => setCopyPrices(e.target.checked)} className="w-4 h-4 accent-primary" />
                Copy price overrides
              </label>
              <label className="flex items-center gap-3 text-sm text-slate-300 cursor-pointer p-2 rounded-lg hover:bg-white/5">
                <input type="checkbox" checked={copyAvailability} onChange={e => setCopyAvailability(e.target.checked)} className="w-4 h-4 accent-primary" />
                Copy availability
              </label>
            </div>

            {sameBranch && (
              <p className="text-amber-400 text-xs font-medium">Source and target must be different branches.</p>
            )}
            {nothingSelected && (
              <p className="text-amber-400 text-xs font-medium">Select at least one thing to copy.</p>
            )}
            {error && (
              <div className="p-3 rounded-lg bg-red-900/20 border border-red-900/50 text-red-300 text-sm font-medium text-center">
                {error}
              </div>
            )}

            <div className="pt-2 flex justify-end gap-3">
              <button onClick={onClose} className="px-5 py-2.5 text-slate-400 hover:text-white font-medium hover:bg-white/5 rounded-xl">
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="bg-primary hover:bg-primary/90 text-white px-6 py-2.5 rounded-xl font-bold disabled:opacity-40 flex items-center gap-2"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Copy
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

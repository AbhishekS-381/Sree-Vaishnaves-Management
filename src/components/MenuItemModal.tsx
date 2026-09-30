"use client"

import { useEffect, useState } from 'react'
import { X, Loader2, Plus, Trash2, ChevronDown } from 'lucide-react'
import {
  addMenuItem,
  updateMenuItem,
  addVariant,
  updateVariant,
  deleteVariant,
} from '@/app/actions/menu'

type Category = { id: string; name: string }
type Variant = { id: string; menuItemId: string; name: string; basePrice: number; isActive?: boolean }

const DIETARY_OPTIONS = [
  { value: 'jain', label: 'Jain' },
  { value: 'no-onion-garlic', label: 'No onion / garlic' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'contains-dairy', label: 'Contains dairy' },
]

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function MenuItemModal({
  isOpen,
  onClose,
  editData,
  categories,
  variants = [],
  canSeeCost = false,
  onResult,
}: {
  isOpen: boolean
  onClose: () => void
  editData?: any
  categories: Category[]
  variants?: Variant[]
  /** cost price / margin is restricted to admin + owner */
  canSeeCost?: boolean
  onResult?: (result: { success?: boolean; error?: string; warning?: string }) => void
}) {
  const isEditing = Boolean(editData?.id)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [dietary, setDietary] = useState<string[]>([])
  const [days, setDays] = useState<number[]>([])

  // variant editor state (only meaningful while editing an existing item)
  const [newVariantName, setNewVariantName] = useState('')
  const [newVariantPrice, setNewVariantPrice] = useState('')
  const [variantBusy, setVariantBusy] = useState(false)

  const itemVariants = variants.filter(v => v.menuItemId === editData?.id && v.isActive !== false)

  useEffect(() => {
    if (!isOpen) return
    setError('')
    setVariantBusy(false)
    setNewVariantName('')
    setNewVariantPrice('')
    setDietary(editData?.dietary ?? [])
    setDays(editData?.availability?.days ?? [])
    setShowAdvanced(
      Boolean(
        editData?.description || editData?.costPrice || editData?.availability ||
        editData?.imageUrl || editData?.spiceLevel || editData?.prepTimeMins ||
        editData?.isSignature || (editData?.allergens?.length)
      )
    )
  }, [isOpen, editData])

  if (!isOpen) return null

  const toggleDietary = (value: string) =>
    setDietary(prev => (prev.includes(value) ? prev.filter(d => d !== value) : [...prev, value]))

  const toggleDay = (day: number) =>
    setDays(prev => (prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]))

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const formData = new FormData(e.currentTarget)
    dietary.forEach(d => formData.append('dietary', d))
    days.forEach(d => formData.append('availDays', String(d)))

    try {
      const res = isEditing
        ? await updateMenuItem(null, formData)
        : await addMenuItem(null, formData)

      if (res?.error) {
        setError(res.error)
        return
      }
      onResult?.(res ?? {})
      onClose()
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleAddVariant = async () => {
    const price = Number(newVariantPrice)
    if (!newVariantName.trim()) { setError('Variant name is required'); return }
    if (!Number.isInteger(price) || price < 0) { setError('Variant price must be a whole number'); return }

    setVariantBusy(true)
    setError('')
    const res = await addVariant(editData.id, newVariantName.trim(), price)
    setVariantBusy(false)
    if (res?.error) { setError(res.error); return }
    setNewVariantName('')
    setNewVariantPrice('')
    onResult?.({ success: true })
  }

  const handleVariantPriceSave = async (v: Variant, name: string, price: number) => {
    setVariantBusy(true)
    const res = await updateVariant(v.id, name, price)
    setVariantBusy(false)
    if (res?.error) setError(res.error)
    else onResult?.({ success: true })
  }

  const handleVariantDelete = async (v: Variant) => {
    setVariantBusy(true)
    const res = await deleteVariant(v.id)
    setVariantBusy(false)
    if (res?.error) setError(res.error)
    else onResult?.({ success: true })
  }

  const field = 'w-full bg-[#1e1b2e] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-primary'
  const label = 'block text-sm font-medium text-slate-300 mb-1.5'

  return (
    <div className="fixed inset-0 z-[100]">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
        <div className="relative w-full max-w-lg max-h-[92vh] flex flex-col bg-[#13101c] border border-[#2d2438] rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 pointer-events-auto">

          <div className="px-6 py-4 border-b border-[#2d2438] flex items-center justify-between shrink-0">
            <h2 className="text-xl font-bold text-white">
              {isEditing ? 'Edit Menu Item' : 'Add Menu Item'}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white bg-black/20 p-2 rounded-full hover:bg-white/10 transition-colors"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {isEditing && <input type="hidden" name="id" value={editData.id} />}

              <div>
                <label className={label}>Item Name</label>
                <input required type="text" name="name" defaultValue={editData?.name ?? ''}
                  placeholder="e.g. Masala Dosa" className={field} />
              </div>

              <div>
                <label className={label}>Category</label>
                <select required name="categoryId" defaultValue={editData?.categoryId ?? ''} className={field}>
                  <option value="">Select Category</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div className={canSeeCost ? 'grid grid-cols-2 gap-4' : ''}>
                <div>
                  <label className={label}>Base Price (₹)</label>
                  <input required type="number" name="basePrice" min={0} step={1}
                    defaultValue={editData?.basePrice ?? ''} placeholder="0" className={field} />
                  <p className="text-[11px] text-slate-500 mt-1.5">Applies to all branches unless overridden.</p>
                </div>
                {canSeeCost && (
                  <div>
                    <label className={label}>Cost Price (₹)</label>
                    <input type="number" name="costPrice" min={0} step={1}
                      defaultValue={editData?.costPrice ?? ''} placeholder="Optional" className={field} />
                    <p className="text-[11px] text-slate-500 mt-1.5">Drives margin / food-cost %.</p>
                  </div>
                )}
              </div>

              {!isEditing && (
                <div className="border-t border-[#3b3054] pt-5">
                  <label className={label}>Availability on create</label>
                  <label className="flex items-center gap-3 text-slate-300 text-sm mb-2 cursor-pointer p-2 rounded-lg hover:bg-white/5">
                    <input type="radio" name="isAvailableGlobally" value="true" defaultChecked className="accent-primary w-4 h-4" />
                    Available in all branches by default
                  </label>
                  <label className="flex items-center gap-3 text-slate-300 text-sm cursor-pointer p-2 rounded-lg hover:bg-white/5">
                    <input type="radio" name="isAvailableGlobally" value="false" className="accent-primary w-4 h-4" />
                    No, I&apos;ll enable per branch
                  </label>
                </div>
              )}

              {/* ── optional details ─────────────────────────────────────── */}
              <button
                type="button"
                onClick={() => setShowAdvanced(v => !v)}
                className="w-full flex items-center justify-between text-sm font-semibold text-slate-300 hover:text-white border-t border-[#3b3054] pt-4"
              >
                <span>Optional details</span>
                <ChevronDown size={16} className={`transition-transform ${showAdvanced ? '' : '-rotate-90'}`} />
              </button>

              {showAdvanced && (
                <div className="space-y-4 bg-[#1a1625] p-4 rounded-xl border border-white/5">
                  <div>
                    <label className={label}>Description</label>
                    <textarea name="description" rows={2} defaultValue={editData?.description ?? ''}
                      placeholder="Short description shown to staff" className={`${field} resize-y`} />
                  </div>

                  <div>
                    <label className={label}>Image URL</label>
                    <input type="url" name="imageUrl" defaultValue={editData?.imageUrl ?? ''}
                      placeholder="https://…" className={field} />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={label}>Spice Level</label>
                      <select name="spiceLevel" defaultValue={editData?.spiceLevel ?? ''} className={field}>
                        <option value="">Not set</option>
                        <option value="0">None</option>
                        <option value="1">Mild</option>
                        <option value="2">Medium</option>
                        <option value="3">Hot</option>
                      </select>
                    </div>
                    <div>
                      <label className={label}>Prep Time (mins)</label>
                      <input type="number" name="prepTimeMins" min={0} max={240}
                        defaultValue={editData?.prepTimeMins ?? ''} placeholder="Optional" className={field} />
                    </div>
                  </div>

                  <div>
                    <label className={label}>Dietary</label>
                    <div className="flex flex-wrap gap-2">
                      {DIETARY_OPTIONS.map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => toggleDietary(opt.value)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                            dietary.includes(opt.value)
                              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                              : 'bg-transparent text-slate-400 border-white/10 hover:border-white/20'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <label className="flex items-center gap-3 text-sm text-slate-300 cursor-pointer p-2 rounded-lg hover:bg-white/5">
                    <input type="checkbox" name="isSignature" defaultChecked={Boolean(editData?.isSignature)}
                      className="w-4 h-4 accent-primary" />
                    Signature / bestseller
                  </label>

                  {/* availability window */}
                  <div className="border-t border-white/5 pt-4">
                    <label className={label}>Availability window (optional)</label>
                    <p className="text-[11px] text-slate-500 mb-3">
                      Leave blank for always available. Supports overnight ranges (e.g. 22:00 → 02:00).
                    </p>
                    <div className="grid grid-cols-2 gap-4 mb-3">
                      <div>
                        <span className="text-xs text-slate-400">From</span>
                        <input type="time" name="availStart" defaultValue={editData?.availability?.startTime ?? ''} className={field} />
                      </div>
                      <div>
                        <span className="text-xs text-slate-400">To</span>
                        <input type="time" name="availEnd" defaultValue={editData?.availability?.endTime ?? ''} className={field} />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {DAYS.map((d, i) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => toggleDay(i)}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-bold border transition-colors ${
                            days.includes(i)
                              ? 'bg-primary/20 text-accent border-primary/40'
                              : 'bg-transparent text-slate-500 border-white/10 hover:border-white/20'
                          }`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                    {days.length === 0 && (
                      <p className="text-[11px] text-slate-500 mt-2">No days selected = every day.</p>
                    )}
                  </div>
                </div>
              )}

              {/* ── variants (edit mode only) ───────────────────────────── */}
              {isEditing && (
                <div className="border-t border-[#3b3054] pt-5">
                  <label className={label}>Portions / Variants (optional)</label>
                  <p className="text-[11px] text-slate-500 mb-3">
                    Add sizes like Half / Full. Leave empty to keep a single price.
                  </p>

                  <div className="space-y-2 mb-3">
                    {itemVariants.map(v => (
                      <VariantRow
                        key={v.id}
                        variant={v}
                        busy={variantBusy}
                        onSave={handleVariantPriceSave}
                        onDelete={handleVariantDelete}
                      />
                    ))}
                    {itemVariants.length === 0 && (
                      <p className="text-xs text-slate-500 italic">No variants yet.</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newVariantName}
                      onChange={e => setNewVariantName(e.target.value)}
                      placeholder="e.g. Half"
                      className={`${field} flex-1`}
                    />
                    <input
                      type="number"
                      min={0}
                      value={newVariantPrice}
                      onChange={e => setNewVariantPrice(e.target.value)}
                      placeholder="₹"
                      className={`${field} w-24`}
                    />
                    <button
                      type="button"
                      disabled={variantBusy}
                      onClick={handleAddVariant}
                      className="bg-primary/20 text-accent border border-primary/30 px-3 py-2.5 rounded-xl hover:bg-primary/30 disabled:opacity-50"
                      aria-label="Add variant"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
              )}

              {error && (
                <div className="p-3 rounded-lg bg-red-900/20 border border-red-900/50 text-red-300 text-sm font-medium text-center">
                  {error}
                </div>
              )}

              <div className="pt-2 flex justify-end gap-3">
                <button type="button" onClick={onClose}
                  className="px-5 py-2.5 text-slate-400 hover:text-white font-medium hover:bg-white/5 rounded-xl transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={loading}
                  className="bg-primary hover:bg-primary/90 text-white px-6 py-2.5 rounded-xl font-bold disabled:opacity-50 shadow-lg shadow-primary/20 flex items-center gap-2">
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isEditing ? 'Save Changes' : 'Create Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

function VariantRow({
  variant, busy, onSave, onDelete,
}: {
  variant: Variant
  busy: boolean
  onSave: (v: Variant, name: string, price: number) => Promise<void>
  onDelete: (v: Variant) => Promise<void>
}) {
  const [name, setName] = useState(variant.name)
  const [price, setPrice] = useState(String(variant.basePrice))
  const dirty = name !== variant.name || Number(price) !== variant.basePrice

  return (
    <div className="flex items-center gap-2 bg-[#252033] p-2 rounded-lg border border-white/5">
      <input
        value={name}
        onChange={e => setName(e.target.value)}
        className="flex-1 bg-transparent text-sm text-white outline-none px-1"
        aria-label="Variant name"
      />
      <input
        type="number"
        min={0}
        value={price}
        onChange={e => setPrice(e.target.value)}
        className="w-20 bg-transparent text-sm text-emerald-400 font-bold outline-none px-1"
        aria-label="Variant price"
      />
      {dirty && (
        <button
          type="button"
          disabled={busy}
          onClick={() => onSave(variant, name, Number(price))}
          className="text-[10px] uppercase font-bold px-2 py-1 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 disabled:opacity-50"
        >
          Save
        </button>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() => onDelete(variant)}
        className="text-slate-500 hover:text-red-400 p-1 disabled:opacity-50"
        aria-label={`Delete ${variant.name}`}
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}

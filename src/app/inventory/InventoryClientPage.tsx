"use client"

import { useState, useActionState } from 'react'
import { Store, Plus, Search, AlertTriangle, Package, Activity, Loader2 } from 'lucide-react'
import { addInventoryItem, adjustStock } from '@/app/actions/inventory'
import { useDraft } from '@/lib/useDraft'
import { useEffect } from 'react'

const initialState: any = { message: '', error: '' }

export default function InventoryClientPage({ branches, inventory }: { branches: any[], inventory: any[] }) {
  const [selectedBranch, setSelectedBranch] = useState(branches[0]?.id || '')
  const [search, setSearch] = useState('')
  
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [adjustTarget, setAdjustTarget] = useState<any>(null)
  const [addDraftState, setAddDraftState] = useState<any>({})

  const { saveDraft, loadDraft, clearDraft } = useDraft('inventory')

  const handleOpenAdd = () => {
     const draft = loadDraft('add')
     if (draft && draft.name) {
       if (window.confirm("You have an unsaved draft for a new item. Restore it?")) {
         setAddDraftState(draft)
       } else {
         clearDraft('add')
         setAddDraftState({})
       }
     } else {
       setAddDraftState({})
     }
     setIsAddOpen(true)
  }

  const handleAddChange = (e: React.ChangeEvent<HTMLFormElement>) => {
    const fd = new FormData(e.currentTarget)
    const data = Object.fromEntries(fd.entries())
    setAddDraftState(data)
    saveDraft('add', data)
  }

  const [addState, addAction, isAdding] = useActionState(addInventoryItem, initialState)
  const [adjState, adjAction, isAdjusting] = useActionState(adjustStock, initialState)

  const filteredInventory = inventory.filter(i => {
    if (i.branchId !== selectedBranch) return false
    if (search && !i.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Inventory & Stock</h1>
          <p className="text-slate-400 mt-1">Track quantities and manage low-stock alerts.</p>
        </div>
        
        <button 
           onClick={handleOpenAdd}
           className="bg-primary hover:bg-primary/90 text-white font-medium py-2.5 px-6 rounded-xl flex items-center gap-2"
        >
           <Plus size={18} /> Add New Item
        </button>
      </div>

      <div className="bg-card p-4 rounded-2xl border border-white/5 flex flex-col md:flex-row gap-4 items-center shadow-sm">
         <div className="flex relative items-center w-full md:w-auto">
           <Store className="w-5 h-5 absolute left-3 text-slate-400" />
           <select
             className="w-full pl-10 pr-10 py-2.5 bg-[#1e1b2e] border border-[#3b3054] rounded-xl text-sm focus:border-[#c084fc] focus:outline-none focus:ring-0 cursor-pointer text-slate-200"
             value={selectedBranch}
             onChange={e => setSelectedBranch(e.target.value)}
           >
             {branches.map(b => (
               <option key={b.id} value={b.id}>{b.name}</option>
             ))}
           </select>
         </div>

         <div className="flex relative items-center w-full md:w-auto flex-1 md:max-w-xs ml-auto">
           <Search className="w-4 h-4 absolute left-3 text-slate-400" />
           <input
             type="text"
             placeholder="Search inventory items..."
             className="w-full pl-9 pr-4 py-2.5 bg-[#1e1b2e] border border-white/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary text-slate-200"
             value={search}
             onChange={e => setSearch(e.target.value)}
           />
         </div>
      </div>

      <div className="bg-card border border-white/5 rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-white/5 bg-white/5">
              <th className="p-4 font-medium text-slate-300">Item Details</th>
              <th className="p-4 font-medium text-slate-300">Stock Level</th>
              <th className="p-4 font-medium text-slate-300">Min Threshold</th>
              <th className="p-4 font-medium text-slate-300">Status</th>
              <th className="p-4 font-medium text-slate-300 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredInventory.length === 0 ? (
              <tr><td colSpan={5} className="p-12 text-center text-slate-500 bg-[#131018]">No items found. Create your first stock item.</td></tr>
            ) : filteredInventory.map(item => {
              const isLow = item.currentQuantity <= item.threshold
              
              return (
                <tr key={item.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="p-4">
                     <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${isLow ? 'bg-red-500/10 text-red-400' : 'bg-blue-500/10 text-blue-400'}`}>
                           <Package size={18} />
                        </div>
                        <span className="font-bold text-slate-200 uppercase tracking-wider">{item.name}</span>
                     </div>
                  </td>
                  <td className="p-4">
                     <span className={`text-xl font-black ${isLow ? 'text-red-400' : 'text-slate-200'}`}>{item.currentQuantity}</span>
                     <span className="text-xs text-slate-500 uppercase ml-1 font-bold">{item.unit}</span>
                  </td>
                  <td className="p-4 text-slate-400 font-medium">
                     {item.threshold} <span className="text-xs uppercase">{item.unit}</span>
                  </td>
                  <td className="p-4">
                     {isLow ? (
                        <span className="flex items-center gap-1.5 text-xs font-bold text-red-400 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 max-w-max">
                           <AlertTriangle size={14} /> LOW STOCK
                        </span>
                     ) : (
                        <span className="text-xs font-bold text-emerald-400 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 max-w-max">
                           SUFFICIENT
                        </span>
                     )}
                  </td>
                  <td className="p-4 text-right">
                     <button 
                       onClick={() => setAdjustTarget(item)}
                       className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg font-medium text-sm transition"
                     >
                       Adjust Stock
                     </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Add New Item Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#13101c] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2"><Package size={20} className="text-primary"/> Add New Item</h2>
              <button disabled={isAdding} onClick={() => setIsAddOpen(false)} className="text-slate-400 hover:text-white">&times;</button>
            </div>
            
            <form action={async (fd) => {
              await addAction(fd);
              clearDraft('add');
              setIsAddOpen(false);
            }} 
            onChange={handleAddChange}
            className="p-6 space-y-4">
              <input type="hidden" name="branchId" value={selectedBranch} />
              
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Item Name</label>
                <input required type="text" name="name" defaultValue={addDraftState.name || ''} className="w-full bg-[#1e1b2e] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-primary" />
              </div>

              <div className="flex gap-4">
                 <div className="flex-1">
                   <label className="block text-sm font-medium text-slate-400 mb-1">Unit type</label>
                   <select required name="unit" defaultValue={addDraftState.unit || 'kg'} className="w-full bg-[#131018] border border-[#3b3054] rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#c084fc]">
                      <option value="kg">Kilograms (kg)</option>
                      <option value="litres">Litres (L)</option>
                      <option value="packets">Packets</option>
                      <option value="pieces">Pieces</option>
                      <option value="units">Units</option>
                   </select>
                 </div>
                 
                 <div className="flex-1">
                   <label className="block text-sm font-medium text-slate-400 mb-1">Low Threshold</label>
                   <input required type="number" name="threshold" min="0" defaultValue={addDraftState.threshold || 5} className="w-full bg-[#1e1b2e] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-primary" />
                 </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Starting Quantity</label>
                <input required type="number" step="0.01" name="quantity" min="0" defaultValue={addDraftState.quantity || 0} className="w-full bg-[#1e1b2e] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-primary" />
              </div>

              {addState?.error && <p className="text-red-400 text-sm">{addState.error}</p>}
              
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" disabled={isAdding} onClick={() => setIsAddOpen(false)} className="px-4 py-2 text-slate-300 hover:text-white font-medium">Cancel</button>
                <button type="submit" disabled={isAdding} className="bg-primary hover:bg-primary/90 text-white px-6 py-2 rounded-xl font-medium disabled:opacity-50 flex items-center gap-2">
                   {isAdding && <Loader2 className="w-4 h-4 animate-spin" />}
                   Save Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Adjust Stock Modal */}
      {adjustTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#13101c] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2"><Activity size={20} className="text-blue-400"/> Adjust Stock</h2>
              <button disabled={isAdjusting} onClick={() => setAdjustTarget(null)} className="text-slate-400 hover:text-white">&times;</button>
            </div>
            
            <form action={async (fd) => {
              await adjAction(fd);
              setAdjustTarget(null);
            }} className="p-6 space-y-5">
              <input type="hidden" name="branchId" value={selectedBranch} />
              <input type="hidden" name="itemId" value={adjustTarget.id} />
              
              <div className="bg-white/5 p-4 rounded-xl flex items-center justify-between">
                 <span className="font-bold text-slate-200 uppercase">{adjustTarget.name}</span>
                 <span className="text-slate-400 font-medium">{adjustTarget.currentQuantity} {adjustTarget.unit}</span>
              </div>

              <div className="flex gap-4">
                 <div className="flex-1">
                   <label className="block text-sm font-medium text-slate-400 mb-1">Adjustment Type</label>
                   <select required name="type" className="w-full bg-[#131018] border border-[#3b3054] rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#c084fc]">
                      <option value="increase">Increase (+ Stock Arrived)</option>
                      <option value="decrease">Decrease (- Stock Used/Waste)</option>
                   </select>
                 </div>
                 
                 <div className="flex-1">
                   <label className="block text-sm font-medium text-slate-400 mb-1">Amount</label>
                   <input required type="number" step="0.01" name="amount" min="0.01" className="w-full bg-[#1e1b2e] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-primary" />
                 </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Reason / Note</label>
                <input required type="text" name="reason" placeholder="e.g. Daily usage, Delivery from Vendor XYZ" className="w-full bg-[#1e1b2e] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-primary" />
              </div>

              {adjState?.error && <p className="text-red-400 text-sm">{adjState.error}</p>}
              
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" disabled={isAdjusting} onClick={() => setAdjustTarget(null)} className="px-4 py-2 text-slate-300 hover:text-white font-medium">Cancel</button>
                <button type="submit" disabled={isAdjusting} className="bg-primary hover:bg-primary/90 text-white px-6 py-2 rounded-xl font-medium disabled:opacity-50 flex items-center gap-2">
                   {isAdjusting && <Loader2 className="w-4 h-4 animate-spin" />}
                   Apply
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}

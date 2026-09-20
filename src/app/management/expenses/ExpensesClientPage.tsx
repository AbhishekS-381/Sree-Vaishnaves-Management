'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Store, Calendar as CalendarIcon, Filter, Search, Download, Edit2, X, Save, Trash2 } from 'lucide-react'
import { updateExpense, deleteExpense } from '@/app/actions/expenses'
import type { Expense } from '@/app/actions/eod'
import { useDraft } from '@/lib/useDraft'
import { useEffect } from 'react'

export default function ExpensesClientPage({ branches, expenses, categories, userRole, isGlobalAdmin, isReadOnly = false }: { branches: any[], expenses: any[], categories: any[], userRole: string, isGlobalAdmin: boolean, isReadOnly?: boolean }) {
  const [selectedBranch, setSelectedBranch] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [search, setSearch] = useState('')
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const isOwner = !isReadOnly && isGlobalAdmin
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  
  const { saveDraft, loadDraft, clearDraft } = useDraft('expenses_edit')

  useEffect(() => {
    if (editingExpense) {
      saveDraft(editingExpense.id, editingExpense)
    }
  }, [editingExpense, saveDraft])

  const handleEditClick = (ex: Expense) => {
    const draft = loadDraft(ex.id)
    if (draft) {
      if (window.confirm("You have an unsaved draft for editing this expense. Restore it?")) {
        setEditingExpense(draft as any)
        return
      } else {
        clearDraft(ex.id)
      }
    }
    setEditingExpense(ex)
  }

  const filteredExpenses = expenses.filter(ex => {
    if (selectedBranch && ex.branchId !== selectedBranch) return false
    if (dateFilter && ex.date !== dateFilter) return false
    if (search) {
      const q = search.toLowerCase()
      const catName = (categories.find(c => c.id === (ex as any).categoryId)?.name || '').toLowerCase()
      return catName.includes(q) || (ex.notes && ex.notes.toLowerCase().includes(q))
    }
    return true
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const totalFiltered = filteredExpenses.reduce((sum, ex) => sum + Number(ex.amount), 0)

  async function handleDelete() {
    if (!confirmDeleteId) return;
    setDeleting(true)
    try {
      const res = await deleteExpense(confirmDeleteId);
      if ('error' in res && res.error) {
         alert('Delete failed: ' + res.error);
      } else {
         startTransition(() => {
            router.refresh();
         });
      }
    } catch (err: any) {
      alert(err.message || "Failed to delete");
    } finally {
      setDeleting(false)
      setConfirmDeleteId(null)
    }
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingExpense) return
    setSaving(true)
    
    try {
        const res = await updateExpense(editingExpense.id, {
            amount: editingExpense.amount,
            categoryId: (editingExpense as any).categoryId,
            date: editingExpense.date,
            notes: editingExpense.notes
        })
        if (res.error) {
            alert(res.error)
        } else {
            clearDraft(editingExpense.id)
            setEditingExpense(null)
        }
    } catch (err: any) {
        alert(err.message || 'Failed to save')
    }
    
    setSaving(false)
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Expense Ledger</h1>
          <p className="text-slate-400 mt-2">Centralized ledger for all EOD and Vendor expenses.</p>
        </div>
        
        {!isReadOnly && (
          <button className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-xl transition-colors border border-white/10 text-sm font-semibold">
             <Download className="w-4 h-4" /> Export CSV
          </button>
        )}
      </div>

      <div className="bg-card p-4 rounded-2xl border border-white/5 shadow-sm flex flex-col md:flex-row gap-4 items-center">
         <div className="flex relative items-center w-full md:w-auto">
           <Store className="w-4 h-4 absolute left-3 text-slate-400" />
           <select
             className="w-full pl-9 pr-10 py-2.5 bg-[#1e1b2e] border border-[#3b3054] rounded-xl text-sm focus:border-[#c084fc] focus:outline-none focus:ring-0 cursor-pointer text-slate-200 disabled:opacity-50"
             value={selectedBranch}
             onChange={e => setSelectedBranch(e.target.value)}
           >
             <option value="">All Branches</option>
             {branches.map(b => (
               <option key={b.id} value={b.id}>{b.name}</option>
             ))}
           </select>
         </div>

         <div className="flex relative items-center w-full md:w-auto">
           <CalendarIcon className="w-4 h-4 absolute left-3 text-slate-400" />
           <input
             type="date"
             className="w-full pl-9 pr-4 py-2.5 bg-[#1e1b2e] border border-white/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary text-slate-200"
             value={dateFilter}
             onChange={e => setDateFilter(e.target.value)}
           />
         </div>

         <div className="flex relative items-center w-full md:w-auto flex-1 md:max-w-xs ml-auto">
           <Search className="w-4 h-4 absolute left-3 text-slate-400" />
           <input
             type="text"
             placeholder="Search category or notes..."
             className="w-full pl-9 pr-4 py-2.5 bg-[#1e1b2e] border border-white/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary text-slate-200"
             value={search}
             onChange={e => setSearch(e.target.value)}
           />
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
         <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-5">
            <h3 className="text-amber-400 text-sm font-bold uppercase tracking-wider mb-2">Filtered Total</h3>
            <span className="text-3xl font-black text-amber-500">₹{totalFiltered.toLocaleString('en-IN')}</span>
         </div>
      </div>

      <div className="bg-card border border-white/5 rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-white/5 bg-white/5">
              <th className="p-4 font-medium text-slate-300">Date</th>
              <th className="p-4 font-medium text-slate-300">Category</th>
              <th className="p-4 font-medium text-slate-300">Source</th>
              <th className="p-4 font-medium text-slate-300">Notes</th>
              <th className="p-4 font-medium text-slate-300 text-right">Amount</th>
              {isOwner && <th className="p-4 font-medium text-slate-300 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filteredExpenses.length === 0 ? (
              <tr><td colSpan={isOwner ? 6 : 5} className="p-8 text-center text-slate-500">No expenses found matching the criteria.</td></tr>
            ) : filteredExpenses.map((ex: Expense) => {
              const branchName = branches.find(b => b.id === ex.branchId)?.name || 'Unknown Branch'
              return (
                <tr key={ex.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="p-4 font-medium text-slate-200">{ex.date}</td>
                  <td className="p-4">
                     <span className="font-bold text-slate-300">{categories.find(c => c.id === (ex as any).categoryId)?.name || 'Unknown'}</span>
                     <div className="text-xs text-slate-500">{branchName}</div>
                  </td>
                  <td className="p-4">
                     <span className={`text-xs px-2 py-1 rounded-full border uppercase tracking-wider font-bold ${ex.source === 'eod' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-purple-500/10 text-purple-400 border-purple-500/20'}`}>
                        {ex.source}
                     </span>
                  </td>
                  <td className="p-4 text-slate-400 text-sm w-1/3">
                     {ex.notes || '-'}
                  </td>
                  <td className="p-4 text-right">
                     <span className="font-bold text-amber-400">₹{Number(ex.amount).toLocaleString('en-IN')}</span>
                  </td>
                  {isOwner && (
                     <td className="p-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => handleEditClick(ex)}
                            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors border border-white/5"
                            title="Edit Expense"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button 
                            onClick={() => setConfirmDeleteId(ex.id)}
                            className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors border border-red-500/10"
                            title="Delete Expense"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                     </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {editingExpense && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#1e1b2e] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white">Edit Expense</h2>
              <button onClick={() => { clearDraft(editingExpense.id); setEditingExpense(null); }} className="text-slate-400 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Date</label>
                <input 
                  type="date" 
                  value={editingExpense.date}
                  onChange={e => setEditingExpense({...editingExpense, date: e.target.value})}
                  className="w-full px-4 py-2.5 bg-[#131018] border border-white/10 rounded-xl text-slate-200 focus:ring-2 focus:ring-primary focus:outline-none"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Category</label>
                <select 
                  value={(editingExpense as any).categoryId}
                  onChange={e => setEditingExpense({...editingExpense, categoryId: e.target.value} as any)}
                  className="w-full px-4 py-2.5 bg-[#131018] border border-white/10 rounded-xl text-slate-200 focus:ring-2 focus:ring-primary focus:outline-none"
                  required
                >
                  <option value="">Select Category</option>
                  {categories.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Amount (₹)</label>
                <input 
                  type="number" 
                  step="1" min="0"
                  value={editingExpense.amount}
                  onChange={e => setEditingExpense({...editingExpense, amount: Number(e.target.value)})}
                  className="w-full px-4 py-2.5 bg-[#131018] border border-white/10 rounded-xl text-slate-200 focus:ring-2 focus:ring-primary focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Notes</label>
                <textarea 
                  value={editingExpense.notes || ''}
                  onChange={e => setEditingExpense({...editingExpense, notes: e.target.value})}
                  className="w-full px-4 py-2.5 bg-[#131018] border border-white/10 rounded-xl text-slate-200 focus:ring-2 focus:ring-primary focus:outline-none min-h-[80px]"
                />
              </div>
              
              <div className="flex gap-3 pt-4">
                <button 
                  type="button" 
                  onClick={() => { clearDraft(editingExpense.id); setEditingExpense(null); }}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={saving}
                  className="flex-1 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl font-semibold transition-colors shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : <><Save size={18}/> Save Changes</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#1e1b2e] border border-red-500/20 rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-500/10 rounded-lg border border-red-500/20">
                <Trash2 className="text-red-400" size={20} />
              </div>
              <h2 className="text-lg font-bold text-white">Delete Expense</h2>
            </div>
            <p className="text-slate-400 text-sm mb-6">Are you sure you want to delete this expense? This action cannot be undone.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDeleteId(null)}
                disabled={deleting}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-semibold transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : <><Trash2 size={16} /> Delete</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

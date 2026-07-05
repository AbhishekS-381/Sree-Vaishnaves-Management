'use client'

import { useState, useEffect } from 'react'
import { Calendar as CalendarIcon, Store, DollarSign, Edit3, Loader2, Save, ShoppingCart, Info, TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import { getEODByDate, getExpensesByDate } from '@/app/actions/eod'
import { useDraft } from '@/lib/useDraft'
import { useEODSave } from '@/hooks/useEODSave'

type Expense = {
  id: string
  amount: number
  category: string
  notes?: string
}

const DEFAULT_CATEGORIES = [
  'Raw materials', 'Gas / fuel', 'Electricity', 'Maintenance', 'Packaging', 'Miscellaneous'
]

export default function EODClientPage({ branches, categories }: { branches: any[], categories: any[] }) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [selectedBranch, setSelectedBranch] = useState(branches[0]?.id || '')
  
  const [income, setIncome] = useState({
    dineInCash: 0,
    dineInUpi: 0,
    takeawayCash: 0,
    takeawayUpi: 0
  })

  const [expenses, setExpenses] = useState<Expense[]>([])
  const [notes, setNotes] = useState('')
  const [openingFloat, setOpeningFloat] = useState<number | ''>('')
  const [actualClosingFloat, setActualClosingFloat] = useState<number | ''>('')
  const { isSaving, handleSave } = useEODSave(selectedBranch, date)
  
  // EOD info
  const [locked, setLocked] = useState(false)
  const [loadingInitial, setLoadingInitial] = useState(true)

  const { saveDraft, loadDraft, clearDraft } = useDraft('eod')

  useEffect(() => {
    if (!selectedBranch || !date) return;
    loadEODData()
  }, [date, selectedBranch])

  async function loadEODData() {
    setLoadingInitial(true)
    const eod = await getEODByDate(date, selectedBranch)
    const exs = await getExpensesByDate(date, selectedBranch)
    
    if (eod) {
      setIncome(eod.income)
      setNotes(eod.notes || '')
      setOpeningFloat(eod.openingFloat || '')
      setActualClosingFloat(eod.actualClosingFloat || '')
      setLocked(eod.status === 'locked')
    } else {
      setIncome({ dineInCash: 0, dineInUpi: 0, takeawayCash: 0, takeawayUpi: 0 })
      setNotes('')
      setOpeningFloat('')
      setActualClosingFloat('')
      setLocked(false)
    }

    if (exs && exs.length > 0) {
      setExpenses(exs.map(ex => ({
        id: ex.id,
        amount: ex.amount,
        category: ex.category,
        notes: ex.notes
      })))
    } else {
      setExpenses([])
    }

    // Draft check after server load
    if (!eod) {
      const draft = loadDraft(`${selectedBranch}_${date}`)
      if (draft) {
        if (window.confirm("You have an unsaved draft for this date and branch. Restore it?")) {
          setIncome(draft.income || { dineInCash: 0, dineInUpi: 0, takeawayCash: 0, takeawayUpi: 0 })
          setExpenses(draft.expenses || [])
          setNotes(draft.notes || '')
          setOpeningFloat(draft.openingFloat || '')
          setActualClosingFloat(draft.actualClosingFloat || '')
        } else {
          clearDraft(`${selectedBranch}_${date}`)
        }
      }
    } else {
      clearDraft(`${selectedBranch}_${date}`)
    }
    
    setLoadingInitial(false)
  }

  useEffect(() => {
    if (!loadingInitial && !locked && selectedBranch && date) {
      saveDraft(`${selectedBranch}_${date}`, {
        income, expenses, notes, openingFloat, actualClosingFloat
      })
    }
  }, [income, expenses, notes, openingFloat, actualClosingFloat, locked, selectedBranch, date, loadingInitial, saveDraft])

  const addExpense = (cat: string) => {
    if (locked) return;
    setExpenses([...expenses, {
      id: Math.random().toString(),
      amount: 0,
      category: cat,
      notes: ''
    }])
  }

  const updateExpense = (id: string, field: string, value: any) => {
    if (locked) return;
    setExpenses(expenses.map(ex => ex.id === id ? { ...ex, [field]: value } : ex))
  }

  const removeExpense = (id: string) => {
    if (locked) return;
    setExpenses(expenses.filter(ex => ex.id !== id))
  }

  const onSave = async () => {
    if (locked || selectedBranch === '') return;
    
    const { success } = await handleSave(income, expenses, notes, openingFloat, actualClosingFloat)
    
    if (success) {
      clearDraft(`${selectedBranch}_${date}`)
    }
  }

  const handleIncomeChange = (field: keyof typeof income, val: string) => {
    const numericVal = Math.max(0, Number(val) || 0)
    setIncome(prev => ({ ...prev, [field]: numericVal }))
  }

  const totalIncome = Object.values(income).reduce((sum, val) => sum + val, 0)
  const totalCashIncome = (income.dineInCash || 0) + (income.takeawayCash || 0)
  const totalExpenses = expenses.reduce((sum, ex) => sum + (Number(ex.amount) || 0), 0)
  const netIncome = totalIncome - totalExpenses

  const expectedClosingFloat = (Number(openingFloat) || 0) + totalCashIncome - totalExpenses
  const cashDiscrepancy = (Number(actualClosingFloat) || 0) - expectedClosingFloat

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-24">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Daily EOD Entry</h1>
          <p className="text-slate-400 mt-2">Log income, expenses, and track your daily net.</p>
        </div>
        
        <div className="flex bg-card border border-white/10 rounded-xl p-2 items-center gap-4 shadow-sm">
          <input 
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            max={new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })}
            className="bg-transparent border-none text-slate-200 outline-none p-2 font-medium"
            lang="en-IN"
            disabled={locked}
          />
        </div>
      </div>

      <div className="flex items-center gap-4 mt-2 mb-6">
        <div className="flex relative items-center w-full md:w-64">
           <Store className="w-5 h-5 absolute left-3 text-slate-400" />
           <select
             title="Select Branch"
             className="w-full pl-10 pr-10 py-3 bg-[#1e1b2e] border border-[#3b3054] rounded-xl text-sm focus:border-[#c084fc] focus:outline-none focus:ring-0 cursor-pointer text-slate-200 font-medium disabled:opacity-50"
             value={selectedBranch}
             onChange={e => setSelectedBranch(e.target.value)}
           >
             <option value="" disabled>Select Branch</option>
             {branches.map(b => (
               <option key={b.id} value={b.id}>{b.name}</option>
             ))}
           </select>
        </div>
        {locked && (
           <span className="bg-red-500/10 text-red-400 px-3 py-1.5 rounded-lg border border-red-500/20 text-xs font-bold uppercase tracking-wider">
             Locked Read-Only
           </span>
        )}
      </div>

      {selectedBranch && !loadingInitial ? (
       <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
         {/* Left col: Income */}
         <div className="space-y-6">
           <div className="bg-card border border-white/5 rounded-2xl p-6 shadow-sm">
             <div className="flex items-center gap-2 mb-6 border-b border-white/5 pb-4">
               <DollarSign className="text-emerald-400" />
               <h2 className="text-xl font-bold text-slate-100">Income Overview</h2>
             </div>

             <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
               <div className="space-y-4">
                 <h3 className="font-semibold text-slate-400 text-sm uppercase tracking-wider">Dine-In</h3>
                 <div className="space-y-1">
                   <label className="text-xs text-slate-500 font-medium">Cash</label>
                   <div className="relative">
                     <span className="absolute left-3 top-2.5 text-slate-500">₹</span>
                     <input
                        type="number"
                        className="pl-8 w-full bg-[#131018] border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:border-primary disabled:opacity-50"
                        value={income.dineInCash || ''}
                        onChange={e => handleIncomeChange('dineInCash', e.target.value)}
                        disabled={locked}
                        placeholder="0"
                     />
                   </div>
                 </div>
                 <div className="space-y-1">
                   <label className="text-xs text-slate-500 font-medium">UPI / Card</label>
                   <div className="relative">
                     <span className="absolute left-3 top-2.5 text-slate-500">₹</span>
                     <input
                        type="number"
                        className="pl-8 w-full bg-[#131018] border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:border-primary disabled:opacity-50"
                        value={income.dineInUpi || ''}
                        onChange={e => handleIncomeChange('dineInUpi', e.target.value)}
                        disabled={locked}
                        placeholder="0"
                     />
                   </div>
                 </div>
               </div>

               <div className="space-y-4">
                 <h3 className="font-semibold text-slate-400 text-sm uppercase tracking-wider">Takeaway</h3>
                 <div className="space-y-1">
                   <label className="text-xs text-slate-500 font-medium">Cash</label>
                   <div className="relative">
                     <span className="absolute left-3 top-2.5 text-slate-500">₹</span>
                     <input
                        type="number"
                        className="pl-8 w-full bg-[#131018] border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:border-primary disabled:opacity-50"
                        value={income.takeawayCash || ''}
                        onChange={e => handleIncomeChange('takeawayCash', e.target.value)}
                        disabled={locked}
                        placeholder="0"
                     />
                   </div>
                 </div>
                 <div className="space-y-1">
                   <label className="text-xs text-slate-500 font-medium">UPI / Card</label>
                   <div className="relative">
                     <span className="absolute left-3 top-2.5 text-slate-500">₹</span>
                     <input
                        type="number"
                        className="pl-8 w-full bg-[#131018] border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:border-primary disabled:opacity-50"
                        value={income.takeawayUpi || ''}
                        onChange={e => handleIncomeChange('takeawayUpi', e.target.value)}
                        disabled={locked}
                        placeholder="0"
                     />
                   </div>
                 </div>
               </div>
             </div>
             
             <div className="mt-8 pt-4 border-t border-white/5 flex items-center justify-between">
               <span className="font-medium text-slate-400">Total Income</span>
               <span className="text-2xl font-bold tracking-tight text-white">₹{totalIncome.toLocaleString()}</span>
             </div>
           </div>

            {/* Petty Cash section */}
            <div className="bg-card border border-white/5 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-6 border-b border-white/5 pb-4">
                <Wallet className="text-blue-400 w-5 h-5" />
                <h2 className="text-xl font-bold text-slate-100">Petty Cash Recon</h2>
              </div>
              <div className="space-y-6">
                 <div className="space-y-2">
                   <label className="text-sm text-slate-400 font-medium">Opening Float (Starting Till Cash)</label>
                   <div className="relative">
                     <span className="absolute left-3 top-2.5 text-slate-500 font-medium">₹</span>
                     <input
                        type="number"
                        className="pl-8 w-full bg-[#131018] border border-white/10 rounded-xl p-2.5 text-white focus:outline-none focus:border-primary disabled:opacity-50"
                        value={openingFloat}
                        onChange={e => setOpeningFloat(e.target.value === '' ? '' : Number(e.target.value))}
                        disabled={locked}
                        placeholder="0"
                     />
                   </div>
                 </div>
                 
                 <div className="space-y-2">
                   <label className="text-sm text-slate-400 font-medium">Actual Closing Float (Counted Cash)</label>
                   <div className="relative">
                     <span className="absolute left-3 top-2.5 text-slate-500 font-medium">₹</span>
                     <input
                        type="number"
                        className="pl-8 w-full bg-[#131018] border border-white/10 rounded-xl p-2.5 text-white focus:outline-none focus:border-primary disabled:opacity-50"
                        value={actualClosingFloat}
                        onChange={e => setActualClosingFloat(e.target.value === '' ? '' : Number(e.target.value))}
                        disabled={locked}
                        placeholder="0"
                     />
                   </div>
                 </div>

                 <div className="bg-[#131018] rounded-xl p-4 border border-white/5 space-y-3">
                   <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Expected Closing Float:</span>
                      <span className="font-bold text-slate-200">₹{expectedClosingFloat.toLocaleString()}</span>
                   </div>
                   <div className="flex justify-between text-sm border-t border-white/5 pt-3">
                      <span className="text-slate-400">Cash Discrepancy:</span>
                      <span className={`font-black ${cashDiscrepancy === 0 ? 'text-emerald-400' : cashDiscrepancy < 0 ? 'text-red-400' : 'text-amber-400'}`}>
                         {cashDiscrepancy > 0 ? '+' : ''}₹{cashDiscrepancy.toLocaleString()}
                      </span>
                   </div>
                   {cashDiscrepancy !== 0 && (
                      <div className="text-[10px] text-slate-500 text-right">
                         {cashDiscrepancy < 0 ? 'Shortage detected' : 'Overage detected'}
                      </div>
                   )}
                 </div>
              </div>
            </div>

           {/* Notes section */}
           <div className="bg-card border border-white/5 rounded-2xl p-6 shadow-sm">
             <div className="flex items-center gap-2 mb-4 border-b border-white/5 pb-4">
               <Edit3 className="text-blue-400 w-5 h-5" />
               <h2 className="text-lg font-bold text-slate-100">Daily Remarks</h2>
             </div>
             <textarea 
               value={notes}
               onChange={e => setNotes(e.target.value)}
               disabled={locked}
               placeholder="Write anything unusual about today (e.g. Ran out of fish curry by 1pm, Power cut for 2 hours)..."
               className="w-full h-32 bg-[#131018] border border-white/10 rounded-xl p-4 text-slate-300 text-sm focus:outline-none focus:border-primary disabled:opacity-50 resize-none"
             ></textarea>
           </div>
         </div>

         {/* Right col: Expenses & Summary */}
         <div className="space-y-6">
           <div className="bg-card border border-white/5 rounded-2xl p-6 shadow-sm flex flex-col h-full">
             <div className="flex items-center gap-2 mb-6 border-b border-white/5 pb-4">
               <ShoppingCart className="text-amber-400 w-5 h-5" />
               <h2 className="text-xl font-bold text-slate-100">Quick Daily Expenses</h2>
             </div>
             
             {!locked && (
                <div className="flex flex-wrap gap-2 mb-6">
                  {(categories && categories.length > 0 ? categories : DEFAULT_CATEGORIES.map(name => ({ name }))).map((cat: any) => (
                    <button key={cat.name} onClick={() => addExpense(cat.name)} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 transition" style={cat.color ? { borderColor: `${cat.color}40`, color: cat.color } : {}}>
                      + {cat.name}
                    </button>
                  ))}
                </div>
             )}

             <div className="space-y-3 flex-1 overflow-y-auto max-h-[400px]">
               {expenses.length === 0 ? (
                 <div className="h-full flex flex-col items-center justify-center text-slate-500 py-10">
                   <Info className="w-8 h-8 mb-2 opacity-50" />
                   <p className="text-sm">No expenses recorded yet.</p>
                 </div>
               ) : (
                 expenses.map((ex, idx) => (
                   <div key={ex.id || idx} className="p-3 rounded-xl border border-white/5 bg-[#131018] relative flex flex-col md:flex-row md:items-center gap-3">
                      <div className="flex-1">
                        <span 
                          className="text-xs font-bold uppercase tracking-wide block mb-1"
                          style={{ color: categories.find(c => c.name === ex.category)?.color || '#94a3b8' }}
                        >
                          {ex.category}
                        </span>
                        <input 
                          type="text" 
                          value={ex.notes || ''} 
                          onChange={(e) => updateExpense(ex.id, 'notes', e.target.value)} 
                          disabled={locked}
                          placeholder="Note (optional)"
                          className="w-full bg-transparent border-none text-sm text-slate-300 focus:outline-none disabled:opacity-50 placeholder:text-slate-600"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="relative">
                         <span className="absolute left-3 top-2 text-slate-500 font-medium">₹</span>
                         <input 
                           type="number" 
                           value={ex.amount || ''} 
                           onChange={(e) => updateExpense(ex.id, 'amount', Number(e.target.value))} 
                           disabled={locked}
                           placeholder="0"
                           className="w-24 pl-7 pr-3 py-2 bg-[#1e1b2e] rounded-lg border border-white/10 text-white font-semibold focus:outline-none focus:border-amber-500 disabled:opacity-50"
                         />
                        </div>
                        {!locked && (
                           <button onClick={() => removeExpense(ex.id)} className="text-red-400 hover:text-red-300 font-extrabold px-2">&times;</button>
                        )}
                      </div>
                   </div>
                 ))
               )}
             </div>

             <div className="mt-auto pt-6 border-t border-white/5 space-y-4">
               <div className="flex items-center justify-between text-slate-400 font-medium">
                 <span>Total Expenses</span>
                 <span className="text-amber-400 tracking-tight">₹{totalExpenses.toLocaleString()}</span>
               </div>
               
               <div className="flex items-center justify-between bg-[#131018] rounded-xl p-4 border border-white/5 shadow-inner">
                 <div className="flex items-center gap-2">
                   {netIncome >= 0 ? <TrendingUp className="text-emerald-400" /> : <TrendingDown className="text-red-400" />}
                   <span className="font-semibold text-slate-300">Net Profit for today</span>
                 </div>
                 <span className={`text-2xl font-black tracking-tight ${netIncome >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                   ₹{netIncome.toLocaleString()}
                 </span>
               </div>
             </div>
           </div>
         </div>
       </div>
      ) : selectedBranch === '' ? (
         <div className="text-center p-12 text-slate-500 font-medium">
             Please select a branch to view or enter EOD record.
         </div>
      ) : (
         <div className="flex items-center justify-center p-20">
             <Loader2 className="animate-spin w-8 h-8 text-primary" />
         </div>
      )}

      {/* Floating Save Button */}
      {!locked && selectedBranch !== '' && !loadingInitial && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-card/80 backdrop-blur-md border-t border-white/10 flex justify-end md:pl-72 z-40">
           <button 
             disabled={isSaving}
             onClick={onSave}
             className="bg-primary hover:bg-primary/90 text-white font-medium py-3 px-8 rounded-xl shadow-[0_0_20px_rgba(192,132,252,0.3)] transition-all disabled:opacity-50 flex items-center gap-2"
           >
             {isSaving ? <Loader2 className="animate-spin w-5 h-5" /> : <Save className="w-5 h-5" />}
             {isSaving ? "Saving EOD..." : "Submit EOD Entry"}
           </button>
        </div>
      )}
    </div>
  )
}

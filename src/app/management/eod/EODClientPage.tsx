'use client'

import { useState, useEffect } from 'react'
import {
  Calendar as CalendarIcon, Store, DollarSign, Edit3, Loader2, Save,
  ShoppingCart, Info, TrendingDown, TrendingUp, Wallet,
  ReceiptText, ChevronDown, Activity, Scale, AlertTriangle,
  AlertCircle, CheckCircle
} from 'lucide-react'
import { getEODByDate, getExpensesByDate } from '@/app/actions/eod'
import { useDraft } from '@/lib/useDraft'
import { useEODSave } from '@/hooks/useEODSave'

type Expense = {
  id: string
  amount: number
  categoryId: string
  notes?: string
}

export default function EODClientPage({
  branches, categories, attendance
}: {
  branches: any[], categories: any[], attendance: any[]
}) {
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
  
  const [locked, setLocked] = useState(false)
  const [loadingInitial, setLoadingInitial] = useState(true)

  // NEW state for billing section
  const [billingEnabled, setBillingEnabled] = useState(false)
  const [billing, setBilling] = useState({
    totalBillAmount: 0,
    billCount: 0,
    dineInCovers: 0,
    takeawayOrders: 0,
    cashCollectedAsBilled: 0,
    upiCollectedAsBilled: 0,
    voids: 0,
    discounts: 0,
    gstCollected: 0,
  })

  // NEW state for ops section
  const [opsEnabled, setOpsEnabled] = useState(false)
  const [ops, setOps] = useState({
    staffOnDuty: 0,
    powerCutHours: 0,
    unusualEvent: '',
    kitchenIssue: false,
    zeroRevenueConfirmed: false,
  })

  // NEW state for UI feedback
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [showZeroRevenueConfirm, setShowZeroRevenueConfirm] = useState(false)
  const [submitWarnings, setSubmitWarnings] = useState<string[]>([])
  const [showWarningModal, setShowWarningModal] = useState(false)

  const [showDraftBanner, setShowDraftBanner] = useState(false)
  const [pendingDraft, setPendingDraft] = useState<any>(null)

  const { isSaving, handleSave } = useEODSave(selectedBranch, date)
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

      // Restore billing if it exists
      if (eod.billing) {
        setBilling(eod.billing)
        setBillingEnabled(true)
      } else {
        setBillingEnabled(false)
      }

      // Restore ops if it exists
      if (eod.ops) {
        setOps(eod.ops)
        setOpsEnabled(true)
      } else {
        setOpsEnabled(false)
      }
    } else {
      setIncome({ dineInCash: 0, dineInUpi: 0, takeawayCash: 0, takeawayUpi: 0 })
      setNotes('')
      setOpeningFloat('')
      setActualClosingFloat('')
      setLocked(false)
      setBillingEnabled(false)
      setOpsEnabled(false)
      
      const draft = loadDraft(`${selectedBranch}_${date}`)
      if (draft && Object.keys(draft).length > 0) {
        setPendingDraft(draft)
        setShowDraftBanner(true)
      }
    }

    if (eod) {
      clearDraft(`${selectedBranch}_${date}`)
    }

    if (exs && exs.length > 0) {
      setExpenses(exs.map(ex => ({
        id: ex.id,
        amount: ex.amount,
        categoryId: (ex as any).categoryId,
        notes: ex.notes
      })))
    } else {
      setExpenses([])
    }

    // Auto-fill staffOnDuty from attendance
    if (attendance) {
      const todayAttendance = attendance.filter(
        (a: any) => a.date === date && a.branchId === selectedBranch && a.status === 'present'
      )
      if (todayAttendance.length > 0 && (!eod || !eod.ops) && eod?.status !== 'locked') {
        setOps(o => ({ ...o, staffOnDuty: todayAttendance.length }))
        setOpsEnabled(true)
      }
    }
    
    setLoadingInitial(false)
  }

  useEffect(() => {
    if (!loadingInitial && !locked && selectedBranch && date) {
      saveDraft(`${selectedBranch}_${date}`, {
        income, expenses, notes, openingFloat, actualClosingFloat,
        billing: billingEnabled ? billing : null,
        ops: opsEnabled ? ops : null,
        billingEnabled,
        opsEnabled,
      })
    }
  }, [income, expenses, notes, openingFloat, actualClosingFloat, billing, ops, billingEnabled, opsEnabled, locked, selectedBranch, date, loadingInitial, saveDraft])

  const restoreDraft = () => {
    if (!pendingDraft) return
    setIncome(pendingDraft.income || { dineInCash: 0, dineInUpi: 0, takeawayCash: 0, takeawayUpi: 0 })
    setExpenses(pendingDraft.expenses || [])
    setNotes(pendingDraft.notes || '')
    setOpeningFloat(pendingDraft.openingFloat || '')
    setActualClosingFloat(pendingDraft.actualClosingFloat || '')
    if (pendingDraft.billing) { setBilling(pendingDraft.billing); setBillingEnabled(true) }
    if (pendingDraft.ops) { setOps(pendingDraft.ops); setOpsEnabled(true) }
    setShowDraftBanner(false)
    setPendingDraft(null)
  }

  const discardDraft = () => {
    clearDraft(`${selectedBranch}_${date}`)
    setShowDraftBanner(false)
    setPendingDraft(null)
  }

  const addExpense = (catId: string) => {
    if (locked) return;
    setExpenses([...expenses, {
      id: Math.random().toString(),
      amount: 0,
      categoryId: catId,
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

  const handleIncomeChange = (field: keyof typeof income, val: string) => {
    const numericVal = Math.max(0, Number(val) || 0)
    setIncome(prev => ({ ...prev, [field]: numericVal }))
  }

  const onSave = async () => {
    if (locked || selectedBranch === '') return

    const warnings: string[] = []

    const totalIncomeCalc = income.dineInCash + income.dineInUpi + income.takeawayCash + income.takeawayUpi
    if (totalIncomeCalc === 0 && !ops.zeroRevenueConfirmed) {
      setShowZeroRevenueConfirm(true)
      return
    }

    if (openingFloat !== '' && actualClosingFloat === '') {
      warnings.push('Opening float entered but closing float is missing. Cash reconciliation will be incomplete.')
    }

    if (billingEnabled && billing.totalBillAmount > 0) {
      if (billing.cashCollectedAsBilled === 0 && billing.upiCollectedAsBilled === 0) {
        warnings.push('Billing total entered but cash/UPI split is missing. Reconciliation will be incomplete.')
      }
      const billingTotal = billing.totalBillAmount - billing.voids
      const collectedTotal = totalIncomeCalc
      const gap = Math.abs(billingTotal - collectedTotal)
      if (gap > 1000) {
        warnings.push(`Large billing gap: ₹${gap.toLocaleString('en-IN')} difference between billed (₹${billingTotal.toLocaleString('en-IN')}) and collected (₹${collectedTotal.toLocaleString('en-IN')}). Please verify.`)
      }
    }

    if (warnings.length > 0) {
      setSubmitWarnings(warnings)
      setShowWarningModal(true)
      return
    }

    await executeSave()
  }

  const executeSave = async () => {
    setSaveError(null)
    setSaveSuccess(false)
    setShowWarningModal(false)
    setShowZeroRevenueConfirm(false)

    const result = await handleSave(
      income,
      expenses,
      notes,
      openingFloat,
      actualClosingFloat,
      billingEnabled ? billing : null,
      opsEnabled ? ops : null
    )

    if (result?.error === 'ZERO_REVENUE_UNCONFIRMED') {
      setShowZeroRevenueConfirm(true)
      return
    }

    if (result?.error) {
      setSaveError(result.error)
      setTimeout(() => { setSaveError(null) }, 5000)
      return
    }

    clearDraft(`${selectedBranch}_${date}`)
    setSaveSuccess(true)
    setTimeout(() => { setSaveSuccess(false); setSaveError(null) }, 5000)

    if (result?.warning) {
      setSaveError(result.warning)
    }
  }

  const totalIncome = income.dineInCash + income.dineInUpi + income.takeawayCash + income.takeawayUpi
  const totalCashIncome = income.dineInCash + income.takeawayCash
  const totalUpiIncome = income.dineInUpi + income.takeawayUpi
  const totalExpenses = expenses.reduce((sum, ex) => sum + (Number(ex.amount) || 0), 0)
  const netIncome = totalIncome - totalExpenses
  
  const expectedClosingFloat = (Number(openingFloat) || 0) + totalCashIncome - totalExpenses
  const cashDiscrepancy = (Number(actualClosingFloat) || 0) - expectedClosingFloat

  const netBilledAmount = billingEnabled ? billing.totalBillAmount - billing.voids : 0
  const billingVsCollectionGap = billingEnabled ? totalIncome - netBilledAmount : 0
  const cashBillingGap = billingEnabled ? totalCashIncome - billing.cashCollectedAsBilled : 0
  const upiBillingGap = billingEnabled ? totalUpiIncome - billing.upiCollectedAsBilled : 0

  const avgCoverValue = billingEnabled && billing.dineInCovers > 0
    ? Math.round(totalIncome / billing.dineInCovers)
    : null

  const revenuePerStaff = opsEnabled && ops.staffOnDuty > 0
    ? Math.round(totalIncome / ops.staffOnDuty)
    : null

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-32">
      {saveSuccess && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 px-5 py-3 rounded-xl font-semibold text-sm shadow-2xl flex items-center gap-2 animate-in slide-in-from-top">
          <CheckCircle className="w-4 h-4" /> EOD saved successfully
        </div>
      )}

      {saveError && (
        <div className="fixed top-4 right-4 z-50 bg-red-500/20 border border-red-500/40 text-red-300 px-5 py-3 rounded-xl font-semibold text-sm shadow-2xl flex items-center gap-2 animate-in slide-in-from-top max-w-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {saveError}
        </div>
      )}

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

      <div className="flex flex-col gap-4 mt-2 mb-6">
        <div className="flex items-center gap-4">
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

        {showDraftBanner && (
          <div className="bg-violet-500/10 border border-violet-500/30 rounded-xl p-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-violet-300 font-semibold text-sm">Unsaved draft found</p>
              <p className="text-slate-400 text-xs mt-0.5">You have a draft for this date and branch. Restore it?</p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={restoreDraft} className="px-3 py-1.5 bg-violet-600 text-white text-xs rounded-lg font-bold">Restore</button>
              <button onClick={discardDraft} className="px-3 py-1.5 bg-slate-700 text-white text-xs rounded-lg">Discard</button>
            </div>
          </div>
        )}
      </div>

      {selectedBranch && !loadingInitial ? (
       <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
         {/* Left col: Income, Billing, Operations */}
         <div className="space-y-6">
           
           {/* CARD 1 — Collections */}
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
                        type="number" step="1" min="0"
                        className="pl-8 w-full bg-[#131018] border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:border-primary disabled:opacity-50 placeholder:text-amber-500/50"
                        value={income.dineInCash === 0 ? '' : income.dineInCash}
                        onChange={e => handleIncomeChange('dineInCash', e.target.value)}
                        disabled={locked}
                        placeholder="Required"
                     />
                   </div>
                 </div>
                 <div className="space-y-1">
                   <label className="text-xs text-slate-500 font-medium">UPI / Card</label>
                   <div className="relative">
                     <span className="absolute left-3 top-2.5 text-slate-500">₹</span>
                     <input
                        type="number" step="1" min="0"
                        className="pl-8 w-full bg-[#131018] border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:border-primary disabled:opacity-50 placeholder:text-amber-500/50"
                        value={income.dineInUpi === 0 ? '' : income.dineInUpi}
                        onChange={e => handleIncomeChange('dineInUpi', e.target.value)}
                        disabled={locked}
                        placeholder="Required"
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
                        type="number" step="1" min="0"
                        className="pl-8 w-full bg-[#131018] border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:border-primary disabled:opacity-50 placeholder:text-amber-500/50"
                        value={income.takeawayCash === 0 ? '' : income.takeawayCash}
                        onChange={e => handleIncomeChange('takeawayCash', e.target.value)}
                        disabled={locked}
                        placeholder="Required"
                     />
                   </div>
                 </div>
                 <div className="space-y-1">
                   <label className="text-xs text-slate-500 font-medium">UPI / Card</label>
                   <div className="relative">
                     <span className="absolute left-3 top-2.5 text-slate-500">₹</span>
                     <input
                        type="number" step="1" min="0"
                        className="pl-8 w-full bg-[#131018] border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:border-primary disabled:opacity-50 placeholder:text-amber-500/50"
                        value={income.takeawayUpi === 0 ? '' : income.takeawayUpi}
                        onChange={e => handleIncomeChange('takeawayUpi', e.target.value)}
                        disabled={locked}
                        placeholder="Required"
                     />
                   </div>
                 </div>
               </div>
             </div>
             
             {totalIncome > 0 && (
               <div className="mt-4 pt-4 border-t border-white/5 grid grid-cols-2 gap-3 text-sm">
                 <div className="bg-[#131018] rounded-lg p-3">
                   <span className="text-xs text-slate-500 block mb-1">Total Cash</span>
                   <span className="font-bold text-slate-200">₹{totalCashIncome.toLocaleString('en-IN')}</span>
                   <span className="text-xs text-slate-500 ml-2">{totalIncome > 0 ? Math.round(totalCashIncome/totalIncome*100) : 0}%</span>
                 </div>
                 <div className="bg-[#131018] rounded-lg p-3">
                   <span className="text-xs text-slate-500 block mb-1">Total UPI / Card</span>
                   <span className="font-bold text-slate-200">₹{totalUpiIncome.toLocaleString('en-IN')}</span>
                   <span className="text-xs text-slate-500 ml-2">{totalIncome > 0 ? Math.round(totalUpiIncome/totalIncome*100) : 0}%</span>
                 </div>
               </div>
             )}

             <div className="mt-8 pt-4 border-t border-white/5 flex items-center justify-between">
               <span className="font-medium text-slate-400">Total Income</span>
               <span className="text-2xl font-bold tracking-tight text-white">₹{totalIncome.toLocaleString('en-IN')}</span>
             </div>
           </div>

           {showZeroRevenueConfirm && (
             <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3">
               <span className="text-amber-400 text-2xl">⚠</span>
               <div className="flex-1">
                 <p className="text-amber-300 font-semibold text-sm">All income fields are ₹0</p>
                 <p className="text-slate-400 text-xs mt-1">Please confirm this branch genuinely had zero revenue today before submitting.</p>
                 <div className="flex gap-3 mt-3">
                   <button
                     onClick={() => { setOps(o => ({ ...o, zeroRevenueConfirmed: true })); setShowZeroRevenueConfirm(false); executeSave() }}
                     className="px-4 py-2 bg-amber-500 text-black text-xs font-bold rounded-lg"
                   >
                     Yes, confirm zero revenue
                   </button>
                   <button
                     onClick={() => setShowZeroRevenueConfirm(false)}
                     className="px-4 py-2 bg-slate-700 text-white text-xs rounded-lg"
                   >
                     Go back and check
                   </button>
                 </div>
               </div>
             </div>
           )}

           {/* CARD 2 — Billing System Report */}
           <div className="bg-card border border-white/5 rounded-2xl shadow-sm overflow-hidden">
             <button
               onClick={() => setBillingEnabled(!billingEnabled)}
               className="w-full flex items-center justify-between p-6 hover:bg-white/5 transition"
             >
               <div className="flex items-center gap-3">
                 <div className="p-2 bg-blue-500/10 rounded-lg">
                   <ReceiptText className="text-blue-400 w-5 h-5" />
                 </div>
                 <div className="text-left">
                   <h2 className="text-lg font-bold text-slate-100">Billing System Report</h2>
                   <p className="text-xs text-slate-500 mt-0.5">Enter Z-report figures from your billing machine</p>
                 </div>
               </div>
               <div className="flex items-center gap-2">
                 {!billingEnabled && (
                   <span className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded">Optional — click to add</span>
                 )}
                 <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${billingEnabled ? 'rotate-180' : ''}`} />
               </div>
             </button>

             {billingEnabled && (
               <div className="px-6 pb-6 space-y-6 border-t border-white/5 pt-6">
                 {/* Row 1 — Totals */}
                 <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                   <div className="space-y-1">
                     <label className="text-xs text-slate-500 font-medium">Total Billed Amount</label>
                     <div className="relative">
                       <span className="absolute left-3 top-2.5 text-slate-500">₹</span>
                       <input type="number" step="1" min="0"
                         value={billing.totalBillAmount || ''}
                         onChange={e => setBilling(b => ({ ...b, totalBillAmount: Number(e.target.value) || 0 }))}
                         disabled={locked}
                         placeholder="0"
                         className="pl-8 w-full bg-[#131018] border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-400 disabled:opacity-50"
                       />
                     </div>
                   </div>
                   <div className="space-y-1">
                     <label className="text-xs text-slate-500 font-medium">Number of Bills</label>
                     <input type="number" step="1" min="0"
                       value={billing.billCount || ''}
                       onChange={e => setBilling(b => ({ ...b, billCount: Number(e.target.value) || 0 }))}
                       disabled={locked}
                       placeholder="0"
                       className="w-full bg-[#131018] border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-400 disabled:opacity-50"
                     />
                   </div>
                   <div className="space-y-1">
                     <label className="text-xs text-slate-500 font-medium">GST Collected</label>
                     <div className="relative">
                       <span className="absolute left-3 top-2.5 text-slate-500">₹</span>
                       <input type="number" step="1" min="0"
                         value={billing.gstCollected || ''}
                         onChange={e => setBilling(b => ({ ...b, gstCollected: Number(e.target.value) || 0 }))}
                         disabled={locked}
                         placeholder="0"
                         className="pl-8 w-full bg-[#131018] border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-400 disabled:opacity-50"
                       />
                     </div>
                   </div>
                 </div>

                 {/* Row 2 — Covers */}
                 <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-1">
                     <label className="text-xs text-slate-500 font-medium">Dine-In Covers (customers)</label>
                     <input type="number" step="1" min="0"
                       value={billing.dineInCovers || ''}
                       onChange={e => setBilling(b => ({ ...b, dineInCovers: Number(e.target.value) || 0 }))}
                       disabled={locked}
                       placeholder="0"
                       className="w-full bg-[#131018] border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-400 disabled:opacity-50"
                     />
                   </div>
                   <div className="space-y-1">
                     <label className="text-xs text-slate-500 font-medium">Takeaway Orders</label>
                     <input type="number" step="1" min="0"
                       value={billing.takeawayOrders || ''}
                       onChange={e => setBilling(b => ({ ...b, takeawayOrders: Number(e.target.value) || 0 }))}
                       disabled={locked}
                       placeholder="0"
                       className="w-full bg-[#131018] border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-400 disabled:opacity-50"
                     />
                   </div>
                 </div>

                 {/* Row 3 — Payment split */}
                 <div>
                   <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                     As Per Billing Machine
                   </h3>
                   <div className="grid grid-cols-2 gap-4 items-end">
                     <div className="space-y-1">
                       <label className="text-xs text-slate-500 font-medium">Cash Collected</label>
                       <div className="relative">
                         <span className="absolute left-3 top-2.5 text-slate-500">₹</span>
                         <input type="number" step="1" min="0"
                           value={billing.cashCollectedAsBilled || ''}
                           onChange={e => setBilling(b => ({ ...b, cashCollectedAsBilled: Number(e.target.value) || 0 }))}
                           disabled={locked}
                           placeholder="0"
                           className="pl-8 w-full bg-[#131018] border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-400 disabled:opacity-50"
                         />
                       </div>
                     </div>
                     <div className="space-y-1">
                       <label className="text-xs text-slate-500 font-medium">UPI / Card Collected</label>
                       <div className="relative">
                         <span className="absolute left-3 top-2.5 text-slate-500">₹</span>
                         <input type="number" step="1" min="0"
                           value={billing.upiCollectedAsBilled || ''}
                           onChange={e => setBilling(b => ({ ...b, upiCollectedAsBilled: Number(e.target.value) || 0 }))}
                           disabled={locked}
                           placeholder="0"
                           className="pl-8 w-full bg-[#131018] border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-400 disabled:opacity-50"
                         />
                       </div>
                     </div>
                   </div>
                 </div>

                 {/* Row 4 — Deductions */}
                 <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-1">
                     <label className="text-xs text-slate-500 font-medium">Voids / Cancellations</label>
                     <div className="relative">
                       <span className="absolute left-3 top-2.5 text-slate-500">₹</span>
                       <input type="number" step="1" min="0"
                         value={billing.voids || ''}
                         onChange={e => setBilling(b => ({ ...b, voids: Number(e.target.value) || 0 }))}
                         disabled={locked}
                         placeholder="0"
                         className="pl-8 w-full bg-[#131018] border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-400 disabled:opacity-50"
                       />
                     </div>
                   </div>
                   <div className="space-y-1">
                     <label className="text-xs text-slate-500 font-medium">Discounts / Complimentary</label>
                     <div className="relative">
                       <span className="absolute left-3 top-2.5 text-slate-500">₹</span>
                       <input type="number" step="1" min="0"
                         value={billing.discounts || ''}
                         onChange={e => setBilling(b => ({ ...b, discounts: Number(e.target.value) || 0 }))}
                         disabled={locked}
                         placeholder="0"
                         className="pl-8 w-full bg-[#131018] border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-400 disabled:opacity-50"
                       />
                     </div>
                   </div>
                 </div>
               </div>
             )}
           </div>

           {/* CARD 3 — Billing Reconciliation */}
           {billingEnabled && billing.totalBillAmount > 0 && (
             <div className="bg-[#131018] border border-white/5 rounded-2xl p-6 space-y-4">
               <div className="flex items-center gap-2 mb-2">
                 <Scale className="text-violet-400 w-5 h-5" />
                 <h2 className="text-lg font-bold text-slate-100">Reconciliation</h2>
                 <span className="text-xs text-slate-500">(auto-computed)</span>
               </div>

               {/* Overall gap */}
               <div className="flex items-center justify-between py-3 border-b border-white/5">
                 <div>
                   <span className="text-sm text-slate-300 font-medium block">Net Billed vs Collected</span>
                   <span className="text-xs text-slate-500">
                     Billed ₹{netBilledAmount.toLocaleString('en-IN')} vs Collected ₹{totalIncome.toLocaleString('en-IN')}
                   </span>
                 </div>
                 <span className={`text-xl font-black ${
                   Math.abs(billingVsCollectionGap) < 100
                     ? 'text-emerald-400'
                     : Math.abs(billingVsCollectionGap) < 500
                     ? 'text-amber-400'
                     : 'text-red-400'
                 }`}>
                   {billingVsCollectionGap > 0 ? '+' : ''}₹{billingVsCollectionGap.toLocaleString('en-IN')}
                 </span>
               </div>

               {/* Cash breakdown */}
               <div className="flex items-center justify-between py-2 border-b border-white/5">
                 <span className="text-sm text-slate-400">Cash Gap</span>
                 <span className={`font-bold text-sm ${cashBillingGap === 0 ? 'text-emerald-400' : cashBillingGap > 0 ? 'text-amber-400' : 'text-red-400'}`}>
                   {cashBillingGap > 0 ? '+' : ''}₹{cashBillingGap.toLocaleString('en-IN')}
                   <span className="text-xs text-slate-500 ml-2">
                     ({cashBillingGap > 0 ? 'Over' : cashBillingGap < 0 ? 'Short' : 'Exact'})
                   </span>
                 </span>
               </div>

               {/* UPI breakdown */}
               <div className="flex items-center justify-between py-2">
                 <span className="text-sm text-slate-400">UPI / Card Gap</span>
                 <span className={`font-bold text-sm ${upiBillingGap === 0 ? 'text-emerald-400' : upiBillingGap > 0 ? 'text-amber-400' : 'text-red-400'}`}>
                   {upiBillingGap > 0 ? '+' : ''}₹{upiBillingGap.toLocaleString('en-IN')}
                   <span className="text-xs text-slate-500 ml-2">
                     ({upiBillingGap > 0 ? 'Over' : upiBillingGap < 0 ? 'Short' : 'Exact'})
                   </span>
                 </span>
               </div>

               {/* Avg cover value */}
               {avgCoverValue !== null && (
                 <div className="bg-[#1e1b2e] rounded-xl p-4 grid grid-cols-2 gap-4 mt-2">
                   <div>
                     <span className="text-xs text-slate-500 block mb-1">Avg Revenue / Cover</span>
                     <span className="text-lg font-bold text-violet-400">₹{avgCoverValue.toLocaleString('en-IN')}</span>
                   </div>
                   {revenuePerStaff !== null && (
                     <div>
                       <span className="text-xs text-slate-500 block mb-1">Revenue / Staff</span>
                       <span className="text-lg font-bold text-blue-400">₹{revenuePerStaff.toLocaleString('en-IN')}</span>
                     </div>
                   )}
                 </div>
               )}
             </div>
           )}

           {/* CARD 6 — Day Summary & Ops */}
           <div className="bg-card border border-white/5 rounded-2xl shadow-sm overflow-hidden">
             <button
               onClick={() => setOpsEnabled(!opsEnabled)}
               className="w-full flex items-center justify-between p-6 hover:bg-white/5 transition"
             >
               <div className="flex items-center gap-3">
                 <div className="p-2 bg-amber-500/10 rounded-lg">
                   <Activity className="text-amber-400 w-5 h-5" />
                 </div>
                 <div className="text-left">
                   <h2 className="text-lg font-bold text-slate-100">Day Summary & Operations</h2>
                   <p className="text-xs text-slate-500 mt-0.5">Staff count, unusual events, operational notes</p>
                 </div>
               </div>
               <div className="flex items-center gap-2">
                 {!opsEnabled && (
                   <span className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded">Optional — click to add</span>
                 )}
                 <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${opsEnabled ? 'rotate-180' : ''}`} />
               </div>
             </button>

             {opsEnabled && (
               <div className="px-6 pb-6 space-y-5 border-t border-white/5 pt-6">
                 {/* Staff on duty */}
                 <div className="grid grid-cols-2 gap-4 items-end">
                   <div className="space-y-1">
                     <label className="text-xs text-slate-500 font-medium">
                       Staff on Duty Today
                       <span className="text-slate-600 ml-1">(auto-filled from attendance)</span>
                     </label>
                     <input type="number" step="1" min="0"
                       value={ops.staffOnDuty || ''}
                       onChange={e => setOps(o => ({ ...o, staffOnDuty: Number(e.target.value) || 0 }))}
                       disabled={locked}
                       placeholder="0"
                       className="w-full bg-[#131018] border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:border-amber-400 disabled:opacity-50"
                     />
                   </div>
                   <div className="space-y-1">
                     <label className="text-xs text-slate-500 font-medium">Power Cut (hours, 0 = none)</label>
                     <input type="number" step="0.5" min="0" max="24"
                       value={ops.powerCutHours || ''}
                       onChange={e => setOps(o => ({ ...o, powerCutHours: Number(e.target.value) || 0 }))}
                       disabled={locked}
                       placeholder="0"
                       className="w-full bg-[#131018] border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:border-amber-400 disabled:opacity-50"
                     />
                   </div>
                 </div>

                 {/* Unusual event */}
                 <div className="space-y-2">
                   <label className="text-xs text-slate-500 font-medium">Unusual Event (if any)</label>
                   <div className="flex flex-wrap gap-2">
                     {['Festival', 'Rainy', 'Match day', 'Public Holiday', 'Strike', 'Exam day', 'Other'].map(tag => (
                       <button
                         key={tag}
                         type="button"
                         disabled={locked}
                         onClick={() => setOps(o => ({ ...o, unusualEvent: o.unusualEvent === tag ? '' : tag }))}
                         className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                           ops.unusualEvent === tag
                             ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                             : 'bg-slate-800 border-white/10 text-slate-400 hover:border-white/20'
                         } disabled:opacity-50`}
                       >
                         {tag}
                       </button>
                     ))}
                   </div>
                   {ops.unusualEvent === 'Other' && (
                     <input
                       type="text"
                       value={ops.unusualEvent === 'Other' ? '' : ops.unusualEvent}
                       onChange={e => setOps(o => ({ ...o, unusualEvent: e.target.value }))}
                       placeholder="Describe the event..."
                       className="w-full bg-[#131018] border border-white/10 rounded-lg p-2.5 text-white text-sm focus:outline-none focus:border-amber-400"
                     />
                   )}
                 </div>

                 {/* Kitchen issue toggle */}
                 <div className="flex items-center justify-between bg-[#131018] rounded-xl p-4 border border-white/5">
                   <div>
                     <span className="text-sm text-slate-300 font-medium block">Kitchen Issue Today</span>
                     <span className="text-xs text-slate-500">Equipment failure, shortage, staffing problem in kitchen</span>
                   </div>
                   <button
                     type="button"
                     disabled={locked}
                     onClick={() => setOps(o => ({ ...o, kitchenIssue: !o.kitchenIssue }))}
                     className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                       ops.kitchenIssue ? 'bg-red-500' : 'bg-slate-700'
                     } disabled:opacity-50`}
                   >
                     <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                       ops.kitchenIssue ? 'translate-x-5' : 'translate-x-0'
                     }`} />
                   </button>
                 </div>
               </div>
             )}
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

         {/* Right col: Expenses & Petty Cash */}
         <div className="space-y-6">
           {/* Petty Cash section - CARD 5 */}
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
                     <span className="font-bold text-slate-200">₹{expectedClosingFloat.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-sm border-t border-white/5 pt-3">
                     <span className="text-slate-400">Cash Discrepancy:</span>
                     <span className={`font-black ${cashDiscrepancy === 0 ? 'text-emerald-400' : cashDiscrepancy < 0 ? 'text-red-400' : 'text-amber-400'}`}>
                        {cashDiscrepancy > 0 ? '+' : ''}₹{cashDiscrepancy.toLocaleString('en-IN')}
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

           {/* Expenses - CARD 4 */}
           <div className="bg-card border border-white/5 rounded-2xl p-6 shadow-sm flex flex-col">
             <div className="flex items-center gap-2 mb-6 border-b border-white/5 pb-4">
               <ShoppingCart className="text-amber-400 w-5 h-5" />
               <h2 className="text-xl font-bold text-slate-100">Quick Daily Expenses</h2>
             </div>
             
             {!locked && (
                <div className="flex flex-wrap gap-2 mb-6">
                  {categories.map((cat: any) => (
                    <button key={cat.id} onClick={() => addExpense(cat.id)} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 transition" style={cat.color ? { borderColor: `${cat.color}40`, color: cat.color } : {}}>
                      + {cat.name}
                    </button>
                  ))}
                  {categories.length === 0 && (
                     <div className="text-sm text-slate-500 italic">No expense categories found. Add them in Settings.</div>
                  )}
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
                          style={{ color: categories.find(c => c.id === ex.categoryId)?.color || '#94a3b8' }}
                        >
                          {categories.find(c => c.id === ex.categoryId)?.name || 'Unknown'}
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
                 <span className="text-amber-400 tracking-tight">₹{totalExpenses.toLocaleString('en-IN')}</span>
               </div>
               
               <div className="flex items-center justify-between bg-[#131018] rounded-xl p-4 border border-white/5 shadow-inner">
                 <div className="flex items-center gap-2">
                   {netIncome >= 0 ? <TrendingUp className="text-emerald-400" /> : <TrendingDown className="text-red-400" />}
                   <span className="font-semibold text-slate-300">Net Profit for today</span>
                 </div>
                 <span className={`text-2xl font-black tracking-tight ${netIncome >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                   ₹{netIncome.toLocaleString('en-IN')}
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

      {/* Spacer to prevent fixed save button from overlapping content */}
      <div className="h-32 flex-shrink-0" />

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

      {/* Warning Modal */}
      {showWarningModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[#1e1b2e] border border-amber-500/30 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="text-amber-400 w-6 h-6 flex-shrink-0" />
              <h3 className="text-lg font-bold text-slate-100">Check Before Saving</h3>
            </div>
            <div className="space-y-3 mb-6">
              {submitWarnings.map((w, i) => (
                <div key={i} className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-sm text-amber-300">
                  {w}
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowWarningModal(false)}
                className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-xl font-medium transition"
              >
                Go Back & Fix
              </button>
              <button
                onClick={executeSave}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-black text-sm rounded-xl font-bold transition"
              >
                Save Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

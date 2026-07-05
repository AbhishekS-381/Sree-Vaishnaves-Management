"use client"

import { useState, useActionState } from 'react'
import { Store, Plus, Search, Truck, Loader2, IndianRupee, FileText, CheckCircle } from 'lucide-react'
import { addVendor, addVendorBill, markVendorBillAsPaid } from '@/app/actions/vendors'
import { useDraft } from '@/lib/useDraft'
import { useEffect } from 'react'

const initialState: any = { message: '', error: '' }

export default function VendorsClientPage({ branches, vendors, expenses, categories = [] }: { branches: any[], vendors: any[], expenses: any[], categories?: any[] }) {
  const [selectedBranch, setSelectedBranch] = useState(branches[0]?.id || '')
  const [search, setSearch] = useState('')
  
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [billTarget, setBillTarget] = useState<any>(null)

  const [addState, addAction, isAdding] = useActionState(addVendor, initialState)
  const [billState, billAction, isBilling] = useActionState(addVendorBill, initialState)

  const { saveDraft, loadDraft, clearDraft } = useDraft('vendors')
  const [addDraftState, setAddDraftState] = useState<any>({})
  const [billDraftState, setBillDraftState] = useState<any>({})

  const handleOpenAdd = () => {
     const draft = loadDraft('add') as any
     if (draft && draft.name) {
       if (window.confirm("You have an unsaved draft for a new vendor. Restore it?")) {
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

  const handleOpenBill = (vendor: any) => {
     const draft = loadDraft('bill_' + vendor.id) as any
     if (draft && draft.amount) {
       if (window.confirm("You have an unsaved draft for a bill for this vendor. Restore it?")) {
         setBillDraftState(draft)
       } else {
         clearDraft('bill_' + vendor.id)
         setBillDraftState({})
       }
     } else {
       setBillDraftState({})
     }
     setBillTarget(vendor)
  }

  const handleAddChange = (e: React.ChangeEvent<HTMLFormElement>) => {
    const fd = new FormData(e.currentTarget)
    const data = Object.fromEntries(fd.entries())
    setAddDraftState(data)
    saveDraft('add', data)
  }

  const handleBillChange = (e: React.ChangeEvent<HTMLFormElement>) => {
    const fd = new FormData(e.currentTarget)
    const data = Object.fromEntries(fd.entries())
    setBillDraftState(data)
    if (billTarget) saveDraft('bill_' + billTarget.id, data)
  }

  const filteredVendors = vendors.filter(v => {
    if (v.branchId !== selectedBranch) return false
    if (search && !v.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  // Calculate stats per vendor
  const vendorStats = filteredVendors.map(v => {
    const bills = expenses.filter(e => e.source === 'vendor' && e.branchId === v.branchId && e.notes?.includes(v.name))
    const totalPaid = bills.filter(b => b.isPaid !== false).reduce((sum, b) => sum + Number(b.amount), 0)
    const unpaidBills = bills.filter(b => b.isPaid === false)
    const totalUnpaid = unpaidBills.reduce((sum, b) => sum + Number(b.amount), 0)
    return { ...v, billsCount: bills.length, totalPaid, totalUnpaid, unpaidBills }
  })

  const vendorExpenses = expenses.filter(e => e.source === 'vendor' && e.branchId === selectedBranch).reverse()

  const handleMarkAsPaid = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (confirm('Mark this vendor bill as Paid?')) {
      await markVendorBillAsPaid(id)
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Vendors & Bills</h1>
          <p className="text-slate-400 mt-1">Manage supplier profiles and record purchase bills.</p>
        </div>
        
        <button 
           onClick={handleOpenAdd}
           className="bg-primary hover:bg-primary/90 text-white font-medium py-2.5 px-6 rounded-xl flex items-center gap-2"
        >
           <Plus size={18} /> Add Vendor
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
             placeholder="Search vendors..."
             className="w-full pl-9 pr-4 py-2.5 bg-[#1e1b2e] border border-white/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary text-slate-200"
             value={search}
             onChange={e => setSearch(e.target.value)}
           />
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
         {vendorStats.length === 0 ? (
           <div className="col-span-full p-12 text-center text-slate-500 bg-card rounded-2xl border border-white/5">
             No vendors found. Add a vendor to start recording bills.
           </div>
         ) : vendorStats.map(vendor => (
           <div key={vendor.id} className="bg-card border border-white/5 rounded-2xl p-6 shadow-sm flex flex-col hover:border-white/10 transition-colors">
              <div className="flex items-center gap-4 mb-4">
                 <div className="h-12 w-12 rounded-full bg-purple-500/10 flex items-center justify-center text-primary shrink-0 border border-purple-500/20">
                    <Truck size={24} />
                 </div>
                 <div>
                    <h3 className="font-bold text-slate-200 text-lg">{vendor.name}</h3>
                    <p className="text-sm text-slate-500 font-medium">{vendor.supplyType}</p>
                 </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                 <div className="bg-[#131018] p-3 rounded-xl border border-white/5">
                    <span className="text-slate-500 block mb-1">Total Bills</span>
                    <span className="font-bold text-slate-300 text-lg">{vendor.billsCount}</span>
                 </div>
                 <div className="bg-[#131018] p-3 rounded-xl border border-white/5">
                    <span className="text-slate-500 block mb-1">Lifetime Paid</span>
                    <span className="font-bold text-emerald-400 text-lg">₹{(vendor.totalPaid).toLocaleString()}</span>
                 </div>
                 {vendor.totalUnpaid > 0 && (
                   <div className="bg-[#131018] p-3 rounded-xl border border-red-500/20 col-span-2">
                      <span className="text-slate-500 block mb-1">Unpaid Balance</span>
                      <span className="font-bold text-red-500 text-lg">₹{(vendor.totalUnpaid).toLocaleString()}</span>
                   </div>
                 )}
              </div>
              
              <div className="mt-auto">
                 <button 
                   onClick={() => handleOpenBill(vendor)}
                   className="w-full py-2.5 rounded-xl border border-primary/30 text-primary font-semibold hover:bg-primary/10 transition-colors"
                 >
                   Record Purchase Bill
                 </button>
              </div>
           </div>
         ))}
      </div>

      <div className="bg-card rounded-2xl border border-card shadow-lg shadow-black/20 overflow-hidden min-h-[16rem]">
         <h3 className="font-semibold text-foreground p-6 border-b border-[#3b3054]">Recent Bills & Outstandings</h3>
         <div className="divide-y divide-[#3b3054]">
           {vendorExpenses.length > 0 ? vendorExpenses.slice(0, 15).map((ex: any) => (
             <div key={ex.id} className="p-4 hover:bg-[#2d283e] transition flex items-center justify-between group">
               <div>
                 <div className="font-medium text-white flex items-center gap-2">
                    {ex.isPaid === false ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400">UNPAID</span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">PAID</span>
                    )}
                    ₹{Number(ex.amount).toLocaleString()}
                 </div>
                 <div className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                   <span className="text-[#c084fc] font-medium">{ex.category}</span>
                   <span>• {ex.date}</span>
                 </div>
               </div>
               <div className="flex items-center gap-3">
                 <div className="text-right text-xs text-slate-500 italic max-w-[150px] truncate">
                   {ex.notes?.replace(/Vendor:.*?\| /, '')}
                 </div>
                 {ex.isPaid === false && (
                   <button 
                     onClick={(e) => handleMarkAsPaid(e, ex.id)}
                     title="Mark as Paid"
                     className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg transition-colors cursor-pointer"
                   >
                      <CheckCircle className="h-4 w-4" />
                   </button>
                 )}
               </div>
             </div>
           )) : (
             <div className="p-6 text-center text-slate-500 text-sm italic">
               No bills recorded yet.
             </div>
           )}
         </div>
      </div>

      {/* Add Vendor Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#13101c] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2"><Truck size={20} className="text-primary"/> Add New Vendor</h2>
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
                <label className="block text-sm font-medium text-slate-400 mb-1">Vendor Name / Business</label>
                <input required type="text" name="name" defaultValue={addDraftState.name || ''} placeholder="e.g. Fresh Veggies Market" className="w-full bg-[#1e1b2e] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-primary" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Phone Number</label>
                <input required type="text" name="phone" defaultValue={addDraftState.phone || ''} className="w-full bg-[#1e1b2e] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-primary" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Supply Type</label>
                <input required type="text" name="supplyType" defaultValue={addDraftState.supplyType || ''} placeholder="e.g. Vegetables, Meat, Groceries, Packaging" className="w-full bg-[#1e1b2e] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-primary" />
              </div>

              {addState?.error && <p className="text-red-400 text-sm">{addState.error}</p>}
              
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" disabled={isAdding} onClick={() => setIsAddOpen(false)} className="px-4 py-2 text-slate-300 hover:text-white font-medium">Cancel</button>
                <button type="submit" disabled={isAdding} className="bg-primary hover:bg-primary/90 text-white px-6 py-2 rounded-xl font-medium disabled:opacity-50 flex items-center gap-2">
                   {isAdding && <Loader2 className="w-4 h-4 animate-spin" />}
                   Save Vendor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Bill Modal */}
      {billTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#13101c] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2"><FileText size={20} className="text-emerald-400"/> Record Bill</h2>
              <button disabled={isBilling} onClick={() => setBillTarget(null)} className="text-slate-400 hover:text-white">&times;</button>
            </div>
            
            <form action={async (fd) => {
              await billAction(fd);
              clearDraft('bill_' + billTarget.id);
              setBillTarget(null);
            }} 
            onChange={handleBillChange}
            className="p-6 space-y-4">
              <input type="hidden" name="branchId" value={selectedBranch} />
              <input type="hidden" name="vendorId" value={billTarget.id} />
              <input type="hidden" name="vendorName" value={billTarget.name} />
              
              <div className="bg-white/5 p-4 rounded-xl flex items-center justify-between mb-2">
                 <span className="font-bold text-slate-200">{billTarget.name}</span>
                 <span className="text-xs uppercase bg-white/10 px-2 py-1 rounded text-slate-400">{billTarget.supplyType}</span>
              </div>

              <div className="flex gap-4">
                 <div className="flex-1">
                   <label className="block text-sm font-medium text-slate-400 mb-1">Date</label>
                   <input required type="date" name="date" defaultValue={billDraftState.date || new Date().toISOString().split('T')[0]} className="w-full bg-[#1e1b2e] border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-primary" />
                 </div>
                 
                 <div className="flex-1">
                   <label className="block text-sm font-medium text-slate-400 mb-1">Amount (₹)</label>
                   <div className="relative">
                     <IndianRupee className="w-4 h-4 absolute left-3 top-3.5 text-slate-500" />
                     <input required type="number" step="1" min="1" name="amount" defaultValue={billDraftState.amount || ''} className="w-full bg-[#1e1b2e] border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-white font-bold focus:outline-none focus:border-amber-500" />
                   </div>
                 </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Expense Category</label>
                <select required name="category" defaultValue={billDraftState.category || billTarget.supplyType} className="w-full bg-[#131018] border border-[#3b3054] rounded-xl px-4 py-2.5 text-white focus:border-[#c084fc] focus:outline-none">
                    <option value={billTarget.supplyType}>{billTarget.supplyType} (Default)</option>
                    {categories.map((c: any) => (
                       <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Invoice / Bill Ref (Optional)</label>
                <input type="text" name="invoiceRef" defaultValue={billDraftState.invoiceRef || ''} placeholder="#INV-001" className="w-full bg-[#1e1b2e] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-primary placeholder:text-slate-600" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1 flex items-center justify-between">
                  Payment Status
                  <div className="flex items-center gap-2 text-white">
                     <input type="checkbox" name="isPaid" id="isPaid" defaultChecked={true} className="w-4 h-4 rounded border-[#3b3054] text-primary focus:ring-primary bg-[#131018]" />
                     <label htmlFor="isPaid" className="text-sm font-medium cursor-pointer">Mark Paid</label>
                  </div>
                </label>
              </div>

              {billState?.error && <p className="text-red-400 text-sm">{billState.error}</p>}
              
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" disabled={isBilling} onClick={() => setBillTarget(null)} className="px-4 py-2 text-slate-300 hover:text-white font-medium">Cancel</button>
                <button type="submit" disabled={isBilling} className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2 rounded-xl font-medium disabled:opacity-50 flex items-center gap-2">
                   {isBilling && <Loader2 className="w-4 h-4 animate-spin" />}
                   Save Bill to Ledger
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}

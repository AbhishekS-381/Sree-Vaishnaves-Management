"use client"

import React, { useState, useActionState, useEffect } from 'react'
import { Store, Plus, Search, CheckCircle2, XCircle, Trash2, UtensilsCrossed, Pencil, ChevronDown, ArrowUp, ArrowDown } from 'lucide-react'
import { addMenuItem, setBranchItemAvailability, deleteMenuItem, updateBranchMenuItemPrice } from '@/app/actions/menu'
import { deleteMenuCategory, addMenuCategory, updateMenuCategory, setBranchCategoryAvailability } from '@/app/actions/menu_categories'
import { GenericEntityModal } from '@/components/GenericEntityModal'
import { useDraft } from '@/lib/useDraft'
import { useMenuFilters } from '@/hooks/useMenuFilters'

const initialState: any = { message: '', error: '' }

function PriceEditor({ item, branchId, onSave }: { item: any, branchId: string, onSave: (price: number | null) => Promise<any> }) {
  const [isEditing, setIsEditing] = useState(false)
  const [val, setVal] = useState(item.price)

  useEffect(() => { setVal(item.price) }, [item.price, branchId])

  if (!isEditing) {
    const isOverride = item.price !== item.basePrice && item.basePrice !== undefined;
    return (
      <div 
        onClick={() => setIsEditing(true)} 
        className="cursor-pointer group flex items-center gap-1 hover:bg-white/5 px-2 py-1 rounded transition-colors"
        title="Click to edit price"
      >
        <span className="text-lg font-bold text-emerald-400">₹{item.price}</span>
        {!isOverride ? (
           <span className="text-[10px] uppercase text-emerald-500/50 group-hover:text-emerald-400 border border-emerald-500/20 px-1 rounded transition-colors">Base</span>
        ) : (
           <span className="text-[10px] uppercase text-amber-500/80 group-hover:text-amber-400 border border-amber-500/20 px-1 rounded transition-colors">Override</span>
        )}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1 bg-black/40 p-1 rounded border border-[#c084fc]">
       <span className="text-sm font-bold text-emerald-400">₹</span>
       <input 
         autoFocus
         type="number"
         value={val}
         onChange={e => setVal(Number(e.target.value))}
         onKeyDown={async e => {
           if (e.key === 'Enter') {
             setIsEditing(false);
             if (val === (item.basePrice || 0)) await onSave(null);
             else await onSave(val);
           }
           if (e.key === 'Escape') {
             setIsEditing(false);
             setVal(item.price);
           }
         }}
         onBlur={() => {
           setIsEditing(false);
           setVal(item.price);
         }}
         className="w-16 bg-transparent text-emerald-400 text-lg font-bold outline-none px-1"
       />
    </div>
  )
}

export default function MenuClientPage({ 
  branches, 
  initialMenu, 
  categories,
  branchMenuItems,
  branchCategories,
  userRole,
  isGlobalAdmin
}: { 
  branches: any[], 
  initialMenu: any[], 
  categories: any[],
  branchMenuItems: any[],
  branchCategories: any[],
  userRole: string,
  isGlobalAdmin: boolean
}) {
  const canEditGlobal = isGlobalAdmin;
  const canEditBranch = isGlobalAdmin || userRole === 'manager';
  
  const [selectedBranch, setSelectedBranch] = useState(branches[0]?.id || '')
  const [activeTab, setActiveTab] = useState<'menu' | 'matrix' | 'categories'>('menu')

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [menuCatModal, setMenuCatModal] = useState({ open: false, data: null })

  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({})

  const toggleCategory = (catName: string) => {
    setCollapsedCategories(prev => ({
      ...prev,
      [catName]: !prev[catName]
    }))
  }

  const [state, formAction, isPending] = useActionState(addMenuItem, initialState)
  
  const [addDraftState, setAddDraftState] = useState<any>({})
  const { saveDraft, loadDraft, clearDraft } = useDraft('menu')

  const handleOpenAdd = () => {
     const draft = loadDraft('add') as any
     if (draft && draft.name) {
       if (window.confirm("You have an unsaved draft for a new menu item. Restore it?")) {
         setAddDraftState(draft)
       } else {
         clearDraft('add')
         setAddDraftState({})
       }
     } else {
       setAddDraftState({})
     }
     setIsModalOpen(true)
  }

  const handleAddChange = (e: React.ChangeEvent<HTMLFormElement>) => {
    const fd = new FormData(e.currentTarget)
    const data = Object.fromEntries(fd.entries())
    setAddDraftState(data)
    saveDraft('add', data)
  }

  const { search, setSearch, filteredMenu, groupedMenu, enrichedCategories } = useMenuFilters(initialMenu, selectedBranch, categories, branchMenuItems, branchCategories)

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Menu Management</h1>
          <p className="text-slate-400 mt-1">Manage items, pricing, and availability.</p>
        </div>
        
        {canEditGlobal && activeTab === 'menu' && (
          <button 
             onClick={handleOpenAdd}
             className="bg-primary hover:bg-primary/90 text-white font-medium py-2.5 px-6 rounded-xl flex items-center gap-2"
          >
             <Plus size={18} /> Add Menu Item
          </button>
        )}
      </div>

      {canEditGlobal && (
        <div className="flex gap-2 border-b border-white/10 pb-2 overflow-x-auto">
           <button onClick={() => setActiveTab('menu')} className={`px-4 py-2 font-bold whitespace-nowrap transition-colors ${activeTab === 'menu' ? 'text-primary border-b-2 border-primary' : 'text-slate-400 hover:text-slate-200'}`}>Menu</button>
           <button onClick={() => setActiveTab('matrix')} className={`px-4 py-2 font-bold whitespace-nowrap transition-colors ${activeTab === 'matrix' ? 'text-primary border-b-2 border-primary' : 'text-slate-400 hover:text-slate-200'}`}>Price Matrix</button>
           <button onClick={() => setActiveTab('categories')} className={`px-4 py-2 font-bold whitespace-nowrap transition-colors ${activeTab === 'categories' ? 'text-primary border-b-2 border-primary' : 'text-slate-400 hover:text-slate-200'}`}>Categories</button>
        </div>
      )}

      {activeTab === 'menu' && (
        <>
          <div className="bg-card p-4 rounded-2xl border border-white/5 flex flex-col md:flex-row gap-4 items-center">
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
                 placeholder="Search menu..."
                 className="w-full pl-9 pr-4 py-2.5 bg-[#1e1b2e] border border-white/10 rounded-xl text-sm focus:outline-none text-slate-200"
                 value={search}
                 onChange={e => setSearch(e.target.value)}
               />
             </div>
          </div>

          {Object.keys(groupedMenu).length === 0 ? (
             <div className="text-center p-12 text-slate-500 bg-card rounded-2xl border border-white/5">
                 No menu items found. Add some starting items!
             </div>
          ) : (
             Object.entries(groupedMenu).map(([category, items]) => {
                const catObj = enrichedCategories.find((c: any) => c.name === category);
                const isCatAvailable = catObj?.isAvailable;
                
                if (!canEditBranch && !isCatAvailable) return null;

                return (
                  <div key={category} className={`bg-card border border-white/5 rounded-2xl overflow-hidden shadow-sm mb-6 ${!isCatAvailable ? 'opacity-60 grayscale' : ''} transition-all`}>
                    <div 
                      className="bg-[#252033] px-6 py-3 border-b border-[#3b3054] flex items-center justify-between cursor-pointer hover:bg-[#2d283e] transition-colors"
                      onClick={() => toggleCategory(category)}
                    >
                       <div className="flex items-center gap-2">
                          <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${collapsedCategories[category] ? '-rotate-90' : ''}`} />
                          <h2 className="text-lg font-bold text-slate-200 uppercase tracking-wider">{category}</h2>
                       </div>
                       <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
                         {canEditBranch && catObj && (
                           <button 
                             onClick={async () => await setBranchCategoryAvailability(selectedBranch, catObj.id, !isCatAvailable)}
                             className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition-colors ${isCatAvailable ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20'}`}
                           >
                             {isCatAvailable ? <><CheckCircle2 size={14} /> Enabled</> : <><XCircle size={14} /> Disabled</>}
                           </button>
                         )}
                       </div>
                    </div>
                    {!collapsedCategories[category] && (
                      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 bg-[#1a1625]">
                         {(items as any[]).map(item => {
                            if (!canEditBranch && !item.isAvailable) return null;

                            return (
                              <div key={item.id} className="flex flex-col p-4 bg-[#252033] border border-white/5 rounded-xl hover:border-emerald-500/30 hover:bg-[#2d283e] transition-all group shadow-sm">
                                 <div className="flex justify-between items-start mb-3">
                                    <h3 className="font-semibold text-slate-100 truncate pr-2" title={item.name}>{item.name}</h3>
                                    {canEditGlobal && (
                                      <button 
                                        onClick={async () => {
                                          if(confirm('Delete ' + item.name + ' globally?')) await deleteMenuItem(item.id)
                                        }}
                                        className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all focus:opacity-100 -mt-1 -mr-1 p-1"
                                        title="Delete Item"
                                      >
                                         <Trash2 size={16} />
                                      </button>
                                    )}
                                 </div>
                                 
                                 <div className="flex items-end justify-between mt-auto gap-2">
                                    {canEditBranch ? (
                                       <PriceEditor 
                                          item={item} 
                                          branchId={selectedBranch} 
                                          onSave={async (price) => await updateBranchMenuItemPrice(selectedBranch, item.id, price)} 
                                       />
                                    ) : (
                                       <div className="flex items-center gap-1 text-lg font-bold text-emerald-400">
                                         ₹{item.price}
                                       </div>
                                    )}

                                    <div className="flex items-center">
                                      {canEditBranch ? (
                                        <button 
                                          onClick={async () => await setBranchItemAvailability(selectedBranch, item.id, !item.isAvailable)}
                                          className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] uppercase tracking-wider font-bold border transition-colors ${item.isAvailable ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20'}`}
                                        >
                                           {item.isAvailable ? 'On' : 'Off'}
                                        </button>
                                      ) : (
                                        <span className="px-2.5 py-1 rounded-md text-[10px] uppercase tracking-wider font-bold border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                                           On
                                        </span>
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

      {activeTab === 'matrix' && canEditGlobal && (
        <div className="bg-card rounded-2xl border border-white/5 overflow-x-auto shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#252033] border-b border-[#3b3054]">
                <th className="p-4 text-slate-300 font-bold min-w-[200px]">Item</th>
                <th className="p-4 text-slate-300 font-bold min-w-[120px]">Base Price</th>
                {branches.map(b => (
                   <th key={b.id} className="p-4 text-slate-300 font-bold min-w-[120px]">{b.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {enrichedCategories.map((cat: any) => {
                const catItems = initialMenu.filter(m => m.categoryId === cat.id && m.isActive !== false).sort((a,b) => (a.sortOrder||0) - (b.sortOrder||0))
                if (catItems.length === 0) return null;
                
                return (
                  <React.Fragment key={cat.id}>
                    <tr className="bg-[#1e1b2e] border-b border-[#3b3054]">
                       <td colSpan={2 + branches.length} className="px-4 py-2 font-bold text-pink-400 text-sm uppercase tracking-wider">
                         {cat.name}
                       </td>
                    </tr>
                    {catItems.map(item => (
                      <tr key={item.id} className="border-b border-[#3b3054]/50 hover:bg-white/[0.02]">
                        <td className="p-4 text-slate-200">{item.name}</td>
                        <td className="p-4 text-slate-400 font-medium flex items-center h-full">₹{item.basePrice || 0}</td>
                        {branches.map(b => {
                           const mapping = branchMenuItems.find((m: any) => m.menuItemId === item.id && m.branchId === b.id)
                           const itemPrice = mapping?.price ?? item.basePrice ?? 0
                           return (
                             <td key={b.id} className="p-4">
                                <PriceEditor 
                                  item={{ ...item, price: itemPrice }} 
                                  branchId={b.id}
                                  onSave={async (price) => await updateBranchMenuItemPrice(b.id, item.id, price)}
                                />
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

      {activeTab === 'categories' && canEditGlobal && (
        <section className="bg-card rounded-2xl border border-white/5 shadow-sm p-6 flex flex-col">
           <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                 <div className="p-2 bg-pink-500/10 text-pink-400 rounded-lg border border-pink-500/20 shadow-pink-500/10 shadow-lg">
                    <UtensilsCrossed className="h-5 w-5" />
                 </div>
                 <h2 className="text-lg font-bold text-white">Manage Food Categories</h2>
              </div>
              <button
                 onClick={() => setMenuCatModal({ open: true, data: null })}
                 className="bg-pink-500/10 text-pink-400 px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-pink-500/20 transition-colors flex items-center gap-1.5"
              >
                 <Plus className="h-4 w-4" /> Add Category
              </button>
           </div>

           <div className="flex flex-col gap-3">
              {enrichedCategories.map((c: any, index: number) => (
                 <div key={c.id} className="p-4 bg-[#252033] rounded-xl border border-white/5 flex items-center justify-between group hover:bg-[#2d283e] hover:border-pink-500/30 transition-all shadow-sm">
                    <div className="flex items-center gap-3">
                       <span className="font-semibold text-slate-200 group-hover:text-white transition-colors">{c.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                       <div className="flex items-center bg-black/20 rounded-md p-1 border border-white/5">
                          <button 
                             disabled={index === 0}
                             className="text-slate-400 hover:text-white disabled:opacity-30 p-1 rounded hover:bg-white/10 transition-colors"
                             onClick={async () => {
                                const prev = enrichedCategories[index - 1];
                                const fd1 = new FormData(); fd1.append('id', c.id); fd1.append('name', c.name); fd1.append('sortOrder', String(prev.sortOrder || index - 1));
                                const fd2 = new FormData(); fd2.append('id', prev.id); fd2.append('name', prev.name); fd2.append('sortOrder', String(c.sortOrder || index));
                                await updateMenuCategory(null, fd1);
                                await updateMenuCategory(null, fd2);
                             }}
                          ><ArrowUp size={16}/></button>
                          <div className="w-[1px] h-4 bg-white/10 mx-1"></div>
                          <button 
                             disabled={index === enrichedCategories.length - 1}
                             className="text-slate-400 hover:text-white disabled:opacity-30 p-1 rounded hover:bg-white/10 transition-colors"
                             onClick={async () => {
                                const next = enrichedCategories[index + 1];
                                const fd1 = new FormData(); fd1.append('id', c.id); fd1.append('name', c.name); fd1.append('sortOrder', String(next.sortOrder || index + 1));
                                const fd2 = new FormData(); fd2.append('id', next.id); fd2.append('name', next.name); fd2.append('sortOrder', String(c.sortOrder || index));
                                await updateMenuCategory(null, fd1);
                                await updateMenuCategory(null, fd2);
                             }}
                          ><ArrowDown size={16}/></button>
                       </div>
                       <button
                          onClick={() => setMenuCatModal({ open: true, data: c })}
                          className="text-slate-400 hover:text-white transition-colors p-2 bg-black/20 rounded-md hover:bg-white/10 border border-transparent hover:border-white/10"
                       >
                          <Pencil className="h-4 w-4" />
                       </button>
                       <button
                          onClick={async () => {
                             if (confirm(`Are you sure you want to delete the ${c.name} category globally?`)) {
                                await deleteMenuCategory(c.id)
                             }
                          }}
                          className="text-slate-400 hover:text-red-400 transition-colors p-2 bg-black/20 rounded-md hover:bg-red-500/10 border border-transparent hover:border-red-500/20"
                       >
                          <Trash2 className="h-4 w-4" />
                       </button>
                    </div>
                 </div>
              ))}
              {enrichedCategories.length === 0 && (
                 <div className="text-center py-10 text-slate-500 text-sm italic border-2 border-dashed border-[#3b3054] rounded-2xl flex items-center justify-center">
                    No menu categories added yet. Add one to classify your menu items.
                 </div>
              )}
           </div>
        </section>
      )}

      {/* Add Menu Item Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#13101c] border border-[#2d2438] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-[#2d2438] flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Add Menu Item</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white bg-black/20 p-2 rounded-full hover:bg-white/10 transition-colors">&times;</button>
            </div>
            <form action={async (fd) => {
              await formAction(fd);
              clearDraft('add');
              setIsModalOpen(false);
            }} 
            onChange={handleAddChange}
            className="p-6 space-y-5">
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Item Name</label>
                <input required type="text" name="name" defaultValue={addDraftState.name || ''} placeholder="e.g. Garlic Naan" className="w-full bg-[#1e1b2e] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-inner" />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Category</label>
                <select name="categoryId" required defaultValue={addDraftState.categoryId || ''} className="w-full bg-[#1e1b2e] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-inner">
                   <option value="">Select Category</option>
                   {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Base Price (₹)</label>
                <input required type="number" name="basePrice" defaultValue={addDraftState.basePrice || ''} placeholder="0" className="w-full bg-[#1e1b2e] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-inner" />
                <p className="text-[11px] text-slate-500 mt-1.5 font-medium">Applies to all branches unless overridden.</p>
              </div>
              
              <div className="mt-2 border-t border-[#3b3054] pt-5">
                 <label className="block text-sm font-medium text-slate-300 mb-3">Availability</label>
                 <label className="flex items-center gap-3 text-slate-300 text-sm mb-3 cursor-pointer hover:text-white p-2 rounded-lg hover:bg-white/5 transition-colors">
                    <input type="radio" name="isAvailableGlobally" value="true" defaultChecked={!addDraftState.isAvailableGlobally || addDraftState.isAvailableGlobally === "true"} className="accent-primary w-4 h-4" />
                    Available in all branches by default
                 </label>
                 <label className="flex items-center gap-3 text-slate-300 text-sm cursor-pointer hover:text-white p-2 rounded-lg hover:bg-white/5 transition-colors">
                    <input type="radio" name="isAvailableGlobally" value="false" defaultChecked={addDraftState.isAvailableGlobally === "false"} className="accent-primary w-4 h-4" />
                    No, I'll enable per branch
                 </label>
              </div>

              {state?.error && <p className="text-red-400 text-sm font-medium">{state.error}</p>}
              
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-slate-400 hover:text-white font-medium hover:bg-white/5 rounded-xl transition-colors">Cancel</button>
                <button type="submit" disabled={isPending} className="bg-primary hover:bg-primary/90 text-white px-6 py-2.5 rounded-xl font-bold disabled:opacity-50 shadow-lg shadow-primary/20 transition-all">Save Item</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <GenericEntityModal
        isOpen={menuCatModal.open}
        onClose={() => setMenuCatModal({ ...menuCatModal, open: false })}
        title="Menu Category"
        editData={menuCatModal.data}
        addAction={addMenuCategory}
        updateAction={updateMenuCategory}
        fields={[
          { name: 'name', label: 'Category Name', type: 'text', required: true, placeholder: 'e.g. Starters, Main Course, Beverages' }
        ]}
      />
    </div>
  )
}

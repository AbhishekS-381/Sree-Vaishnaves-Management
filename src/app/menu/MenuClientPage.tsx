"use client"

import { useState, useActionState } from 'react'
import { Store, Plus, Search, CheckCircle2, XCircle, Trash2, Edit, UtensilsCrossed, Pencil, ChevronDown } from 'lucide-react'
import { addMenuItem, toggleMenuItemStatus, deleteMenuItem, updateBranchMenuItemPrice } from '@/app/actions/menu'
import { deleteMenuCategory, addMenuCategory, updateMenuCategory, toggleBranchCategory } from '@/app/actions/menu_categories'
import { GenericEntityModal } from '@/components/GenericEntityModal'
import { useDraft } from '@/lib/useDraft'
import { useEffect } from 'react'
import { useMenuFilters } from '@/hooks/useMenuFilters'

const initialState: any = { message: '', error: '' }

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
  const canEdit = isGlobalAdmin;
  const [selectedBranch, setSelectedBranch] = useState(branches[0]?.id || '')

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
        
        {canEdit && (
          <button 
             onClick={handleOpenAdd}
             className="bg-primary hover:bg-primary/90 text-white font-medium py-2.5 px-6 rounded-xl flex items-center gap-2"
          >
             <Plus size={18} /> Add Menu Item
          </button>
        )}
      </div>

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
            const catObj = enrichedCategories.find(c => c.name === category);
            const isCatAvailable = catObj?.isAvailable;
            
            // If the user can't edit and the category is disabled for this branch, we skip rendering it
            if (!canEdit && !isCatAvailable) return null;

            return (
              <div key={category} className={`bg-card border border-white/5 rounded-2xl overflow-hidden shadow-sm mb-6 ${!isCatAvailable ? 'opacity-60' : ''}`}>
                <div 
                  className="bg-[#252033] px-6 py-3 border-b border-[#3b3054] flex items-center justify-between cursor-pointer hover:bg-[#2d283e] transition-colors"
                  onClick={() => toggleCategory(category)}
                >
                   <div className="flex items-center gap-2">
                      <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${collapsedCategories[category] ? '-rotate-90' : ''}`} />
                      <h2 className="text-lg font-bold text-slate-200 uppercase tracking-wider">{category}</h2>
                   </div>
                   <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
                     {canEdit && catObj && (
                       <button 
                         onClick={async () => await toggleBranchCategory(selectedBranch, catObj.id, isCatAvailable)}
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
                        if (!canEdit && !item.isAvailable) return null; // Hide disabled items from non-admins

                        return (
                          <div key={item.id} className="flex flex-col p-4 bg-[#252033] border border-white/5 rounded-xl hover:border-emerald-500/30 hover:bg-[#2d283e] transition-all group">
                             <div className="flex justify-between items-start mb-3">
                                <h3 className="font-semibold text-slate-100 truncate pr-2" title={item.name}>{item.name}</h3>
                                {canEdit && (
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
                                <div className="flex items-center gap-1">
                                  <span className="text-sm font-bold text-emerald-400">₹</span>
                                  {canEdit ? (
                                    <input 
                                      type="number" 
                                      defaultValue={item.price} 
                                      onBlur={(e) => updateBranchMenuItemPrice(selectedBranch, item.id, Number(e.target.value))}
                                      className="w-16 bg-transparent border-b border-transparent hover:border-[#3b3054] focus:border-emerald-400 text-emerald-400 text-lg font-bold outline-none px-1" 
                                    />
                                  ) : (
                                    <span className="text-lg font-bold text-emerald-400">{item.price}</span>
                                  )}
                                </div>
                                <div className="flex items-center">
                                  {canEdit ? (
                                    <button 
                                      onClick={async () => await toggleMenuItemStatus(selectedBranch, item.id, item.isAvailable)}
                                      className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] uppercase tracking-wider font-bold border transition-colors ${item.isAvailable ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20'}`}
                                    >
                                       {item.isAvailable ? 'Available' : 'Unavailable'}
                                    </button>
                                  ) : (
                                    <span className="px-2.5 py-1 rounded-md text-[10px] uppercase tracking-wider font-bold border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                                       Available
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

      {/* Menu Categories Management Section */}
      {canEdit && (
        <section className="bg-card rounded-2xl border border-white/5 shadow-sm p-6 flex flex-col mt-8">
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

           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 flex-1">
              {categories.map((c: any) => (
                 <div key={c.id} className="p-3 bg-[#252033] rounded-lg border border-white/5 flex items-center justify-between group hover:bg-[#2d283e] hover:border-pink-500/30 transition-all">
                    <div className="flex items-center gap-3">
                       <span className="font-medium text-slate-300 group-hover:text-white transition-colors">{c.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                       <button
                          onClick={() => setMenuCatModal({ open: true, data: c })}
                          className="text-slate-500 hover:text-white transition-colors p-1"
                       >
                          <Pencil className="h-4 w-4" />
                       </button>
                       <button
                          onClick={async () => {
                             if (confirm(`Are you sure you want to delete the ${c.name} category globally?`)) {
                                await deleteMenuCategory(c.id)
                             }
                          }}
                          className="text-slate-500 hover:text-red-400 transition-colors p-1"
                       >
                          <Trash2 className="h-4 w-4" />
                       </button>
                    </div>
                 </div>
              ))}
              {categories.length === 0 && (
                 <div className="col-span-full text-center py-8 text-slate-500 text-sm italic border-2 border-dashed border-[#3b3054] rounded-xl flex items-center justify-center">
                    No menu categories added yet. Add one to classify your menu items.
                 </div>
              )}
           </div>
        </section>
      )}

      {/* Add Menu Item Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-[#13101c] border border-[#2d2438] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-[#2d2438] flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Add Menu Item</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">&times;</button>
            </div>
            <form action={async (fd) => {
              await formAction(fd);
              clearDraft('add');
              setIsModalOpen(false);
            }} 
            onChange={handleAddChange}
            className="p-6 space-y-4">
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                <p className="text-xs text-blue-400 leading-relaxed">
                  <strong>Note:</strong> Items are created globally with a base price of ₹0 and are disabled by default. After creating, use the branch selector to enable the item and set its specific price for that branch.
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Item Name</label>
                <input required type="text" name="name" defaultValue={addDraftState.name || ''} className="w-full bg-[#1e1b2e] border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-primary" />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Category</label>
                <select name="categoryId" required defaultValue={addDraftState.categoryId || ''} className="w-full bg-[#131018] border border-[#3b3054] rounded-xl px-4 py-2 text-white focus:border-[#c084fc] focus:outline-none">
                   <option value="">Select Category</option>
                   {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              


              {state?.error && <p className="text-red-400 text-sm">{state.error}</p>}
              
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-300 hover:text-white font-medium">Cancel</button>
                <button type="submit" disabled={isPending} className="bg-primary hover:bg-primary/90 text-white px-6 py-2 rounded-xl font-medium disabled:opacity-50">Save Item</button>
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

"use client"

import { useState } from 'react'
import { Briefcase, Layers, Pencil, Plus, ToggleRight, LayoutTemplate, Tag } from 'lucide-react'
import { GenericEntityModal } from '@/components/GenericEntityModal'
import { addDepartment, updateDepartment, deleteDepartment, deleteRole } from '@/app/actions/settings'
import { addCategory, updateCategory, deleteCategory } from '@/app/actions/categories'
import { RoleModal } from '@/components/RoleModal'
import { toggleModule } from '@/app/actions/config'
import { UserModal } from '@/components/UserModal'
import { deleteUser } from '@/app/actions/users'
import { FileWarning, Trash2 } from 'lucide-react'

type Props = {
  roles: any[]
  departments: any[]
  categories: any[]
  config: any
  users: any[]
  sessionRole?: string
}

export default function SettingsClientPage({ roles, departments, categories, config, users, sessionRole }: Props) {
  const [deptModal, setDeptModal] = useState({ open: false, data: null })
  const [roleModal, setRoleModal] = useState({ open: false, data: null })
  const [catModal, setCatModal] = useState({ open: false, data: null })
  const [userModal, setUserModal] = useState({ open: false, data: null })

  const handleToggle = async (moduleName: string, currentlyActive: boolean) => {
    // Optimistic UI could be added, but simple toggle action is fine
    await toggleModule(moduleName as any, !currentlyActive)
  }

  const modulesApp = [
    { id: 'attendance', name: 'Daily Attendance', description: 'Track staff presence and half-days.', type: 'Layer' },
    { id: 'payroll', name: 'Payroll', description: 'Auto-calculate monthly salaries based on attendance.', type: 'Layer' },
    { id: 'vendors', name: 'Vendors & Bills', description: 'Manage suppliers and record purchase bills.', type: 'Layer' },
    { id: 'inventory', name: 'Inventory & Stock', description: 'Track raw materials and low-stock alerts.', type: 'Layer' },
    { id: 'reports', name: 'Reports & Analytics', description: 'Generate monthly P&L and trend charts.', type: 'Layer' },
    { id: 'menu', name: 'Menu Management', description: 'Digital catalog for items and prices.', type: 'Optional' },
  ]

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Settings</h1>
          <p className="text-slate-400 mt-1">Configure your master data.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* Departments */}
        <section className="bg-card rounded-2xl border border-card shadow-lg shadow-black/20 p-6 flex flex-col h-full">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg border border-blue-500/20 shadow-blue-500/10 shadow-lg">
                <Layers className="h-5 w-5" />
              </div>
              <h2 className="text-lg font-bold text-white">Departments</h2>
            </div>
            <button
              onClick={() => setDeptModal({ open: true, data: null })}
              className="bg-blue-500/10 text-blue-400 px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-blue-500/20 transition-colors flex items-center gap-1.5"
            >
              <Plus className="h-4 w-4" /> Add
            </button>
          </div>

          <div className="space-y-2 flex-1">
            {departments.map((d: any) => (
              <div key={d.id} className="p-3 bg-[#252033] rounded-lg border border-white/5 flex items-center justify-between group hover:bg-[#2d283e] hover:border-primary/30 transition-all">
                <span className="font-medium text-slate-300 group-hover:text-white transition-colors">{d.name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-600 font-mono opacity-0 group-hover:opacity-100 transition-opacity">{d.id}</span>
                  <button
                    onClick={() => setDeptModal({ open: true, data: d })}
                    className="text-slate-500 hover:text-white transition-colors p-1"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={async () => {
                      if (confirm(`Are you sure you want to delete the ${d.name} department?`)) {
                        await deleteDepartment(d.id)
                      }
                    }}
                    className="text-slate-500 hover:text-red-400 transition-colors p-1"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
            {departments.length === 0 && (
              <div className="text-center py-8 text-slate-500 text-sm italic border-2 border-dashed border-[#3b3054] rounded-xl">
                No departments added yet.
              </div>
            )}
          </div>
        </section>

        {/* Roles */}
        <section className="bg-card rounded-2xl border border-card shadow-lg shadow-black/20 p-6 flex flex-col h-full">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/10 text-purple-400 rounded-lg border border-purple-500/20 shadow-purple-500/10 shadow-lg">
                <Briefcase className="h-5 w-5" />
              </div>
              <h2 className="text-lg font-bold text-white">Roles</h2>
            </div>
            <button
              onClick={() => setRoleModal({ open: true, data: null })}
              className="bg-purple-500/10 text-purple-400 px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-purple-500/20 transition-colors flex items-center gap-1.5"
            >
              <Plus className="h-4 w-4" /> Add
            </button>
          </div>

          <div className="space-y-2 flex-1">
            {roles.map((r: any) => (
              <div key={r.id} className="p-3 bg-[#252033] rounded-lg border border-white/5 flex items-center justify-between group hover:bg-[#2d283e] hover:border-primary/30 transition-all">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-medium text-slate-300 group-hover:text-white transition-colors">{r.name}</span>
                  
                  {r.departmentIds?.length > 0 && <span className="bg-blue-500/10 text-blue-400 text-[10px] px-2 py-0.5 rounded-full font-bold border border-blue-500/20">{r.departmentIds.length} Dept{r.departmentIds.length > 1 ? 's' : ''}</span>}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setRoleModal({ open: true, data: r })}
                    className="text-slate-500 hover:text-white transition-colors p-1"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={async () => {
                      if (confirm(`Are you sure you want to delete the ${r.name} role?`)) {
                        await deleteRole(r.id)
                      }
                    }}
                    className="text-slate-500 hover:text-red-400 transition-colors p-1"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
            {roles.length === 0 && (
              <div className="text-center py-8 text-slate-500 text-sm italic border-2 border-dashed border-[#3b3054] rounded-xl">
                No roles added yet.
              </div>
            )}
          </div>
        </section>

      </div>

      {/* Expense Categories */}
      <section className="bg-card rounded-2xl border border-card shadow-lg shadow-black/20 p-6 flex flex-col h-full mt-8">
         <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
               <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg border border-amber-500/20 shadow-amber-500/10 shadow-lg">
                  <Tag className="h-5 w-5" />
               </div>
               <h2 className="text-lg font-bold text-white">Expense Categories</h2>
            </div>
            <button
               onClick={() => setCatModal({ open: true, data: null })}
               className="bg-amber-500/10 text-amber-400 px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-amber-500/20 transition-colors flex items-center gap-1.5"
            >
               <Plus className="h-4 w-4" /> Add
            </button>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 flex-1">
            {categories.map((c: any) => (
               <div key={c.id} className="p-3 bg-[#252033] rounded-lg border border-white/5 flex items-center justify-between group hover:bg-[#2d283e] hover:border-primary/30 transition-all">
                  <div className="flex items-center gap-3">
                     <span className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color || '#64748b' }}></span>
                     <span className="font-medium text-slate-300 group-hover:text-white transition-colors">{c.name}</span>
                  </div>
                  <div className="flex items-center gap-1">
                     <button
                        onClick={() => setCatModal({ open: true, data: c })}
                        className="text-slate-500 hover:text-white transition-colors p-1"
                     >
                        <Pencil className="h-4 w-4" />
                     </button>
                     <button
                        onClick={async () => {
                          if (confirm(`Are you sure you want to delete the ${c.name} category?`)) {
                            await deleteCategory(c.id)
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
                  No expense categories added yet.
               </div>
            )}
         </div>
      </section>

      <section className="bg-card rounded-2xl border border-card shadow-lg shadow-black/20 p-6 flex flex-col h-full mt-8">
         <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
               <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20 shadow-emerald-500/10 shadow-lg">
                  <LayoutTemplate className="h-5 w-5" />
               </div>
               <h2 className="text-lg font-bold text-white">Module Features</h2>
            </div>
            <div className="text-sm text-slate-400 italic">Toggle Layer & Optional modules</div>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {modulesApp.map(mod => {
               const isActive = config[mod.id] !== false
               return (
                  <div key={mod.id} className={`p-4 rounded-2xl border transition-all flex items-center justify-between ${isActive ? 'bg-[#252033] border-primary/30' : 'bg-[#131018] border-white/5 opacity-70'}`}>
                     <div>
                        <div className="flex items-center gap-2">
                           <h3 className="font-bold text-white">{mod.name}</h3>
                           <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${mod.type === 'Layer' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' : 'bg-blue-500/10 text-blue-400 border border-blue-500/30'}`}>
                             {mod.type}
                           </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">{mod.description}</p>
                     </div>
                     <button 
                        onClick={() => handleToggle(mod.id, isActive)}
                        className={`p-2 rounded-full transition-colors ${isActive ? 'text-primary hover:bg-primary/20 bg-primary/10' : 'text-slate-600 hover:text-slate-400'}`}
                     >
                        <ToggleRight className={`h-8 w-8 transition-transform ${isActive ? 'rotate-0' : 'rotate-180'}`} />
                     </button>
                  </div>
               )
            })}
         </div>
      </section>

      {/* System Users Settings (Owner Only) */}
      {sessionRole === 'owner' && (
        <section className="bg-card rounded-2xl border border-card shadow-lg shadow-black/20 p-6 flex flex-col h-full mt-8">
           <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                 <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20 shadow-emerald-500/10 shadow-lg">
                    <FileWarning className="h-5 w-5" />
                 </div>
                 <h2 className="text-lg font-bold text-white">System Users & Access</h2>
              </div>
              <button
                 onClick={() => setUserModal({ open: true, data: null })}
                 className="bg-emerald-500/10 text-emerald-400 px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-emerald-500/20 transition-colors flex items-center gap-1.5"
              >
                 <Plus className="h-4 w-4" /> Add User
              </button>
           </div>
           
           <div className="space-y-2">
              {users.map((u: any) => (
                 <div key={u.id} className="p-4 bg-[#252033] rounded-lg border border-white/5 flex items-center justify-between group hover:bg-[#2d283e] hover:border-emerald-500/30 transition-all">
                    <div>
                       <div className="flex items-center gap-3">
                         <span className="font-bold text-white tracking-wide">{u.name}</span>
                         <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border ${u.role === 'owner' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : u.role === 'manager' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-slate-500/10 text-slate-400 border-slate-500/20'}`}>
                            {u.role}
                         </span>
                         {u.isGlobalOwner && (
                            <span className="bg-purple-500/20 text-purple-300 text-[10px] px-2 py-0.5 rounded-full font-bold border border-purple-500/30 uppercase tracking-wide">
                              Owner
                            </span>
                         )}
                       </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                       <button
                          onClick={() => setUserModal({ open: true, data: u })}
                          className="text-slate-500 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/5"
                       >
                         <Pencil className="h-4 w-4" />
                       </button>
                       {!u.isGlobalOwner && (
                         <button
                            onClick={async () => {
                               if(confirm(`Remove ${u.name}?`)) {
                                  await deleteUser(u.id);
                               }
                            }}
                            className="text-slate-500 hover:text-red-400 transition-colors p-2 rounded-lg hover:bg-red-500/10"
                         >
                           <Trash2 className="h-4 w-4" />
                         </button>
                       )}
                    </div>
                 </div>
              ))}
              {users.length === 0 && (
                 <div className="text-center py-6 text-slate-500 text-sm italic border-2 border-dashed border-[#3b3054] rounded-xl">
                    No users created yet.
                 </div>
              )}
           </div>
        </section>
      )}

      <GenericEntityModal
        isOpen={deptModal.open}
        onClose={() => setDeptModal({ ...deptModal, open: false })}
        title="Department"
        editData={deptModal.data}
        addAction={addDepartment}
        updateAction={updateDepartment}
        fields={[
          { name: 'name', label: 'Department Name', type: 'text', required: true, placeholder: 'e.g. Kitchen, Front of House' }
        ]}
      />

      <RoleModal
        isOpen={roleModal.open}
        onClose={() => setRoleModal({ ...roleModal, open: false })}
        editData={roleModal.data}
        departments={departments}
      />

      <GenericEntityModal
        isOpen={catModal.open}
        onClose={() => setCatModal({ ...catModal, open: false })}
        title="Expense Category"
        editData={catModal.data}
        addAction={addCategory}
        updateAction={updateCategory}
        fields={[
          { name: 'name', label: 'Category Name', type: 'text', required: true, placeholder: 'e.g. Raw materials' },
          { name: 'color', label: 'Color Tag', type: 'color', defaultValue: '#64748b' }
        ]}
      />

      <UserModal
        isOpen={userModal.open}
        onClose={() => setUserModal({ ...userModal, open: false })}
        editData={userModal.data}
      />
    </div>
  )
}

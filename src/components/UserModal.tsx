'use client'

import { useActionState } from 'react'
import { Plus, X, Loader2, User } from 'lucide-react'
import { addUser, updateUser } from '@/app/actions/users'

const initialState: any = { message: '', error: '' }

export function UserModal({ isOpen, onClose, editData }: { isOpen: boolean, onClose: () => void, editData?: any }) {
  const [state, action, isPending] = useActionState(editData ? updateUser : addUser, initialState)

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none md:pl-72">
        <div className="bg-[#13101c] border border-white/10 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 pointer-events-auto">
          <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <User size={20} className={editData ? "text-amber-400" : "text-emerald-400"}/> 
              {editData ? 'Edit System User' : 'Add System User'}
            </h2>
            <button disabled={isPending} onClick={onClose} className="text-slate-400 hover:text-white">&times;</button>
          </div>
          
          <form action={async (fd) => {
             await action(fd)
             onClose()
          }} className="p-6 space-y-4">
            
            {editData && <input type="hidden" name="id" value={editData.id} />}
            
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Username / Name</label>
              <input 
                required 
                type="text" 
                name="name" 
                defaultValue={editData?.name}
                placeholder="e.g. jsmith or John Smith" 
                className="w-full bg-[#1e1b2e] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-primary placeholder:text-slate-600" 
              />
            </div>

            <div>
               <label className="block text-sm font-medium text-slate-400 mb-1">
                   Password 
                   {editData && <span className="text-slate-500 text-xs ml-2 font-normal">(Leave blank to keep existing)</span>}
               </label>
               <input 
                 required={!editData} 
                 type="password" 
                 name="password" 
                 placeholder={editData ? "••••••••" : "Enter robust password"} 
                 className="w-full bg-[#1e1b2e] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-primary placeholder:text-slate-600" 
               />
            </div>

            <div>
               <label className="block text-sm font-medium text-slate-400 mb-1">System Role</label>
               <select required name="role" defaultValue={editData?.role || 'manager'} className="w-full bg-[#131018] border border-[#3b3054] rounded-xl px-4 py-2.5 text-white focus:border-[#c084fc] focus:outline-none">
                   <option value="owner">Owner (Full Settings Access)</option>
                   <option value="manager">Manager (App Operation Access)</option>
                   <option value="readonly">Read-Only Analyst</option>
               </select>
            </div>

            {state?.error && <p className="text-red-400 text-sm">{state.error}</p>}
            
            <div className="pt-4 flex justify-end gap-3">
              <button type="button" disabled={isPending} onClick={onClose} className="px-4 py-2 text-slate-300 hover:text-white font-medium">Cancel</button>
              <button type="submit" disabled={isPending} className={`${editData ? "bg-amber-500 hover:bg-amber-600" : "bg-emerald-500 hover:bg-emerald-600"} text-white px-6 py-2 rounded-xl font-medium disabled:opacity-50 flex items-center gap-2`}>
                 {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                 {editData ? 'Update User' : 'Create User'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

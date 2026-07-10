"use client"

import { useState } from 'react'
import { addRole, updateRole } from '@/app/actions/settings'
import { X, Loader2 } from 'lucide-react'

type Props = {
  isOpen: boolean
  onClose: () => void
  editData?: any
  departments?: any[]
}

export function RoleModal({ isOpen, onClose, editData, departments = [] }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const formData = new FormData(e.currentTarget)

    if (formData.getAll('departmentIds').length === 0) {
      setError('Please select at least 1 department.')
      setLoading(false)
      return
    }

    try {
      const result = editData
        ? await updateRole(null, formData)
        : await addRole(null, formData)

      if (result?.error) {
        setError(result.error)
        return
      }
      onClose()
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100]">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none md:pl-72">
        <div className="relative w-full max-w-md bg-[#1e1b2e] rounded-2xl border border-[#3b3054] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 pointer-events-auto">
          <div className="flex items-center justify-between p-6 border-b border-[#3b3054]">
            <h2 className="text-xl font-bold text-white">
              {editData ? 'Edit Role' : 'New Role'}
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-[#252033] rounded-lg text-slate-400 hover:text-white transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {editData && <input type="hidden" name="id" value={editData.id} />}
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1.5">Role Name</label>
              <input
                name="name"
                defaultValue={editData?.name}
                required
                placeholder="e.g. Manager, Chef"
                className="w-full px-4 py-2.5 rounded-xl bg-[#131018] border border-[#3b3054] text-white focus:border-[#c084fc] outline-none"
              />
            </div>

            <div className="space-y-3">
               <div className="flex items-center gap-3 p-3 rounded-xl bg-[#131018] border border-[#3b3054]">
                 <input
                   type="checkbox"
                   name="isChef"
                   id="isChef"
                   defaultChecked={editData?.isChef}
                   className="w-5 h-5 rounded border-[#3b3054] text-rose-400 focus:ring-rose-400 bg-[#1e1b2e]"
                 />
                 <label htmlFor="isChef" className="text-sm font-medium text-slate-300">
                   Is Chef / Cook Role?
                   <span className="block text-xs text-slate-500 font-normal">Allows assigning specialized food categories</span>
                 </label>
               </div>
            </div>

            <div className="bg-[#131018] p-4 rounded-xl border border-[#3b3054] space-y-2">
               <label className="block text-sm font-semibold text-slate-300 mb-2">Linked Departments</label>
               <p className="text-xs text-slate-500 mb-3">Select which departments this role belongs to natively.</p>
               <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                  {departments.map((d: any) => (
                     <label key={d.id} className="flex items-center gap-2 cursor-pointer p-2 border border-white/5 rounded-lg hover:bg-white/5 transition-colors">
                        <input 
                           type="checkbox" 
                           name="departmentIds" 
                           value={d.id} 
                           defaultChecked={editData?.departmentIds?.includes(d.id)}
                           className="w-4 h-4 rounded border-[#3b3054] text-[#c084fc] focus:ring-[#c084fc] bg-[#1e1b2e]" 
                        />
                        <span className="text-sm font-medium text-slate-400">{d.name}</span>
                     </label>
                  ))}
                  {departments.length === 0 && (
                     <span className="text-xs text-red-400 italic">No departments created yet.</span>
                  )}
               </div>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-900/20 border border-red-900/50 text-red-300 text-sm font-medium text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#c084fc] text-[#131018] font-bold rounded-xl hover:bg-[#d8b4fe] transition-colors flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Save
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

"use client"

import { useState, useEffect } from 'react'
import { saveRequirement } from '@/app/actions/staff_requirements'
import { X, Loader2 } from 'lucide-react'

type Props = {
  isOpen: boolean
  onClose: () => void
  editData?: any
  branches: any[]
  departments: any[]
  roles: any[]
  menuCategories?: any[]
}

export function RequirementModal({ isOpen, onClose, editData, branches, departments, roles, menuCategories = [] }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedDept, setSelectedDept] = useState(editData?.departmentId || '')
  const [selectedRole, setSelectedRole] = useState(editData?.roleId || '')

  useEffect(() => {
    if (isOpen) {
      setSelectedDept(editData?.departmentId || '')
      setSelectedRole(editData?.roleId || '')
      setError('')
    }
  }, [isOpen, editData])

  const filteredRoles = roles.filter(r => {
    if (!selectedDept) return false
    return r.departmentIds && r.departmentIds.includes(selectedDept)
  })

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const formData = new FormData(e.currentTarget)
    const branchId = formData.get('branchId') as string
    const departmentId = formData.get('departmentId') as string
    const roleId = formData.get('roleId') as string
    const specialtyId = formData.get('specialtyId') as string || undefined
    const requiredCount = parseInt(formData.get('requiredCount') as string)
    const defaultSalaryStr = formData.get('defaultSalary') as string
    const defaultSalary = defaultSalaryStr ? parseInt(defaultSalaryStr) : undefined
    const startTime = formData.get('startTime') as string || undefined
    const endTime = formData.get('endTime') as string || undefined
    const responsibility = formData.get('responsibility') as string || undefined

    try {
      const result = await saveRequirement(editData?.id || null, branchId, departmentId, roleId, requiredCount, specialtyId, defaultSalary, startTime, endTime, responsibility)

      if (result?.error) {
        setError(result.error)
      } else {
        if (result?.warning) {
          alert(`⚠️ ${result.warning}`)
        }
        onClose()
      }
    } catch (err) {
      setError('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100]">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none md:pl-72">
        <div className="relative w-full max-w-md max-h-[90vh] flex flex-col bg-[#1e1b2e] rounded-2xl border border-[#3b3054] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 pointer-events-auto">
          <div className="flex items-center justify-between p-6 border-b border-[#3b3054] shrink-0">
            <h2 className="text-xl font-bold text-white">
              {editData ? 'Edit Position Requirement' : 'Add Position Requirement'}
            </h2>
            <button type="button" onClick={onClose} className="p-2 hover:bg-[#252033] rounded-lg text-slate-400 hover:text-white transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Branch</label>
                <select
                  name="branchId"
                  defaultValue={editData?.branchId}
                  required
                  className="w-full px-4 py-2.5 rounded-xl bg-[#131018] border border-[#3b3054] text-white focus:border-[#c084fc] outline-none"
                >
                  <option value="">Select Branch</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Department</label>
                <select
                  name="departmentId"
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 rounded-xl bg-[#131018] border border-[#3b3054] text-white focus:border-[#c084fc] outline-none"
                >
                  <option value="">Select Dept</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Role</label>
                <select
                  name="roleId"
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 rounded-xl bg-[#131018] border border-[#3b3054] text-white focus:border-[#c084fc] outline-none disabled:opacity-50"
                  disabled={!selectedDept}
                >
                  <option value="">{selectedDept ? "Select Role" : "Select Dept First"}</option>
                  {filteredRoles.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>

              {/* Conditional Specialty Field */}
              {roles.find(r => r.id === selectedRole)?.isChef && (
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">Food Category / Specialty</label>
                  <select
                    name="specialtyId"
                    defaultValue={editData?.specialtyId}
                    required
                    className="w-full px-4 py-2.5 rounded-xl bg-[#131018] border border-[#3b3054] text-white focus:border-rose-400 outline-none"
                  >
                    <option value="">Select Specialty</option>
                    {menuCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">Start Time</label>
                  <input
                    name="startTime"
                    type="time"
                    defaultValue={editData?.startTime || ''}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#131018] border border-[#3b3054] text-white focus:border-[#c084fc] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">End Time</label>
                  <input
                    name="endTime"
                    type="time"
                    defaultValue={editData?.endTime || ''}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#131018] border border-[#3b3054] text-white focus:border-[#c084fc] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Default Monthly Salary (₹)</label>
                <input
                  name="defaultSalary"
                  type="number"
                  min="0"
                  defaultValue={editData?.defaultSalary || ''}
                  placeholder="Optional default pay"
                  className="w-full px-4 py-2.5 rounded-xl bg-[#131018] border border-[#3b3054] text-white focus:border-[#c084fc] outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Required Count</label>
                <input
                  name="requiredCount"
                  type="number"
                  min="0"
                  defaultValue={editData?.requiredCount || 1}
                  required
                  className="w-full px-4 py-2.5 rounded-xl bg-[#131018] border border-[#3b3054] text-white focus:border-[#c084fc] outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Responsibility / Description</label>
                <textarea
                  name="responsibility"
                  defaultValue={editData?.responsibility || ''}
                  placeholder="Describe the responsibilities for this position..."
                  rows={4}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#131018] border border-[#3b3054] text-white focus:border-[#c084fc] outline-none resize-y"
                />
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-red-900/20 border border-red-900/50 text-red-300 text-sm font-medium text-center">
                  {error}
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-[#c084fc] text-[#131018] font-bold rounded-xl hover:bg-[#d8b4fe] transition-colors flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editData ? 'Save Changes' : 'Create Requirement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

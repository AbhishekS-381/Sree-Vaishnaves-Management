"use client"

import { useState } from 'react'
import { addStaff, updateStaff } from '@/app/actions/staff'
import { X, Loader2 } from 'lucide-react'
import { useDraft } from '@/lib/useDraft'
import { useEffect } from 'react'


type Props = {
  isOpen: boolean
  onClose: () => void
  editData?: any
  preselectedPositionId?: string | null
  requirements?: any[]
  staff?: any[]
  branches: any[]
  departments: any[]
  roles: any[]
  menuCategories?: any[]
}

export function StaffModal({ isOpen, onClose, editData, preselectedPositionId, requirements = [], staff = [], branches, departments, roles, menuCategories = [] }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedDept, setSelectedDept] = useState(editData?.departmentId || '')
  const [selectedRole, setSelectedRole] = useState(editData?.roleId || '')
  const [selectedBranch, setSelectedBranch] = useState(editData?.branchId || '')
  const [selectedSpecialty, setSelectedSpecialty] = useState(editData?.specialtyId || '')
  const [selectedPositionId, setSelectedPositionId] = useState(editData?.positionId || preselectedPositionId || '')

  const { saveDraft, loadDraft, clearDraft } = useDraft('staff')
  const [draftData, setDraftData] = useState<any>({})
  const [salary, setSalary] = useState<string | number>(editData?.monthlySalary || '')
  const [startTime, setStartTime] = useState<string>(editData?.startTime || '')
  const [endTime, setEndTime] = useState<string>(editData?.endTime || '')
  const [shiftType, setShiftType] = useState<string>(editData?.shiftType || draftData?.shiftType || 'full')
  const [showDraftBanner, setShowDraftBanner] = useState(false)
  const [pendingDraft, setPendingDraft] = useState<any>(null)


  useEffect(() => {
    if (isOpen) {
      if (editData) {
        setSelectedDept(editData.departmentId || '')
        setSelectedRole(editData.roleId || '')
        setSelectedBranch(editData.branchId || '')
        setSelectedSpecialty(editData.specialtyId || '')
        setSelectedPositionId(editData.positionId || '')
        setSalary(editData.monthlySalary || '')
        setStartTime(editData.startTime || '')
        setEndTime(editData.endTime || '')
      } else {
        // Set defaults first (including preselectedPositionId from Quick Hire)
        if (preselectedPositionId) {
          setSelectedPositionId(preselectedPositionId)
        } else {
          setSelectedPositionId('')
          setSelectedDept('')
          setSelectedRole('')
          setSelectedBranch('')
          setSelectedSpecialty('')
        }
        setSalary('')
        setStartTime('')
        setEndTime('')

        // Check for draft — show banner instead of blocking window.confirm
        const d = loadDraft('add') as any
        if (d && Object.keys(d).length > 0) {
          setPendingDraft(d)
          setShowDraftBanner(true)
        } else {
          setShowDraftBanner(false)
          setPendingDraft(null)
        }
      }
    } else {
      setDraftData({})
      setSelectedPositionId('')
      setSelectedDept('')
      setSelectedRole('')
      setSelectedBranch('')
      setSelectedSpecialty('')
      setSalary('')
      setStartTime('')
      setEndTime('')
      setShowDraftBanner(false)
      setPendingDraft(null)
    }
  }, [isOpen, editData, preselectedPositionId, loadDraft, clearDraft])

  // Issue 10: Only auto-fill from position when adding new staff, not editing
  useEffect(() => {
    if (selectedPositionId && requirements.length > 0 && !editData) {
      const req = requirements.find(r => r.id === selectedPositionId)
      if (req) {
        setSelectedDept(req.departmentId)
        setSelectedRole(req.roleId)
        setSelectedBranch(req.branchId)
        setSelectedSpecialty(req.specialtyId || '')
        if (req.defaultSalary !== undefined) {
          setSalary(req.defaultSalary)
        }
        if (req.startTime) {
          setStartTime(req.startTime)
        }
        if (req.endTime) {
          setEndTime(req.endTime)
        }
      }
    }
  }, [selectedPositionId, requirements, editData])

  const filteredRoles = roles.filter(r => {
     if (!selectedDept) return false
     return r.departmentIds && r.departmentIds.includes(selectedDept)
  })

  // Issue 9: Filter positions to only show open ones (not at capacity)
  const openRequirements = requirements.filter(req => {
    // When editing, always include the staff member's current position
    if (editData?.positionId === req.id) return true
    const filled = staff.filter(s => s.isActive === true && s.positionId === req.id).length
    return filled < req.requiredCount
  })

  // Draft banner handlers
  const restoreDraft = () => {
    if (pendingDraft) {
      setDraftData(pendingDraft)
      if (pendingDraft.departmentId) setSelectedDept(pendingDraft.departmentId)
      if (pendingDraft.roleId) setSelectedRole(pendingDraft.roleId)
      if (pendingDraft.branchId) setSelectedBranch(pendingDraft.branchId)
      if (pendingDraft.specialtyId) setSelectedSpecialty(pendingDraft.specialtyId)
      if (pendingDraft.positionId) setSelectedPositionId(pendingDraft.positionId)
      if (pendingDraft.salary) setSalary(pendingDraft.salary)
      if (pendingDraft.startTime) setStartTime(pendingDraft.startTime)
      if (pendingDraft.endTime) setEndTime(pendingDraft.endTime)
    }
    setShowDraftBanner(false)
    setPendingDraft(null)
  }

  const discardDraft = () => {
    clearDraft('add')
    setShowDraftBanner(false)
    setPendingDraft(null)
  }

  if (!isOpen) return null

  const handleChange = (e: React.FormEvent<HTMLFormElement>) => {
     if (!editData) {
       const fd = new FormData(e.currentTarget)
       const data = Object.fromEntries(fd.entries())
       if (selectedPositionId) {
         data.positionId = selectedPositionId
         data.departmentId = selectedDept
         data.roleId = selectedRole
         data.branchId = selectedBranch
         data.specialtyId = selectedSpecialty
       }
       saveDraft('add', data)
       setDraftData(data)
     }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const formData = new FormData(e.currentTarget)

    try {
      // Wrap update vs add logic
      const result = editData
        ? await updateStaff(null, formData)
        : await addStaff(null, formData)

      if (result?.error) {
        setError(result.error)
      } else {
        if (!editData) clearDraft('add')
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

      <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
        <div className="relative w-full max-w-lg max-h-[90vh] flex flex-col bg-[#1e1b2e] rounded-2xl border border-[#3b3054] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 pointer-events-auto">
          <div className="flex items-center justify-between p-6 border-b border-[#3b3054] shrink-0">
            <h2 className="text-xl font-bold text-white">
              {editData ? 'Edit Staff Member' : 'Add New Staff'}
            </h2>
            <button type="button" onClick={onClose} className="p-2 hover:bg-[#252033] rounded-lg text-slate-400 hover:text-white transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {showDraftBanner && (
              <div className="mx-6 mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between gap-3">
                <span className="text-amber-400 text-sm">You have an unsaved draft. Restore it?</span>
                <div className="flex gap-2 shrink-0">
                  <button type="button" onClick={restoreDraft} className="text-xs px-3 py-1 bg-amber-500 text-black rounded font-bold hover:bg-amber-400 transition-colors">Restore</button>
                  <button type="button" onClick={discardDraft} className="text-xs px-3 py-1 bg-slate-700 text-white rounded hover:bg-slate-600 transition-colors">Discard</button>
                </div>
              </div>
            )}
            <form onSubmit={handleSubmit} onChange={handleChange} className="p-6 space-y-4">
            {editData && <input type="hidden" name="id" value={editData.id} />}
            {selectedPositionId && <input type="hidden" name="positionId" value={selectedPositionId} />}

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1.5">Map to Position / Budget Slot (Optional)</label>
              <select
                value={selectedPositionId}
                onChange={(e) => {
                  const val = e.target.value
                  setSelectedPositionId(val)
                  if (!val) {
                    // Reset fields if unselected
                    setSelectedDept('')
                    setSelectedRole('')
                    setSelectedBranch('')
                    setSelectedSpecialty('')
                  }
                }}
                className="w-full px-4 py-2.5 rounded-xl bg-[#131018] border border-[#3b3054] text-white focus:border-[#c084fc] outline-none"
              >
                <option value="">Direct Hire / No Position Mapping</option>
                {openRequirements.map((req: any) => {
                  const branchName = branches.find(b => b.id === req.branchId)?.name || req.branchId
                  const deptName = departments.find(d => d.id === req.departmentId)?.name || req.departmentId
                  const roleName = roles.find(r => r.id === req.roleId)?.name || req.roleId
                  const filled = staff.filter(s => s.isActive === true && s.positionId === req.id).length
                  const remaining = req.requiredCount - filled
                  const specialtyName = req.specialtyId ? ` (${menuCategories.find((c: any) => c.id === req.specialtyId)?.name || req.specialtyId})` : ''
                  return (
                    <option key={req.id} value={req.id}>
                      {branchName} - {deptName} - {roleName}{specialtyName} [{remaining} open]
                    </option>
                  )
                })}
              </select>
              {selectedPositionId && (
                <p className="text-xs text-[#c084fc] mt-1.5">Note: Branch, Department, Role, and Specialty are locked to this position definition.</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1.5">Full Name</label>
              <input
                name="name"
                defaultValue={editData?.name || draftData?.name || ''}
                required
                className="w-full px-4 py-2.5 rounded-xl bg-[#131018] border border-[#3b3054] text-white focus:border-[#c084fc] outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1.5">Phone Number</label>
              <input
                name="phone"
                defaultValue={editData?.phone || draftData?.phone || ''}
                required
                pattern="[0-9]*"
                maxLength={10}
                className="w-full px-4 py-2.5 rounded-xl bg-[#131018] border border-[#3b3054] text-white focus:border-[#c084fc] outline-none"
              />
            </div>

            {selectedPositionId ? (
              /* Position locked — show read-only display with hidden inputs */
              <>
                <input type="hidden" name="branchId" value={selectedBranch} />
                <input type="hidden" name="departmentId" value={selectedDept} />
                <input type="hidden" name="roleId" value={selectedRole} />
                {selectedSpecialty && <input type="hidden" name="specialtyId" value={selectedSpecialty} />}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1.5">Department</label>
                    <div className="w-full px-4 py-2.5 rounded-xl bg-[#131018] border border-[#3b3054] text-slate-400 cursor-not-allowed opacity-60">
                      {departments.find(d => d.id === selectedDept)?.name || 'Unknown'}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1.5">Role</label>
                    <div className="w-full px-4 py-2.5 rounded-xl bg-[#131018] border border-[#3b3054] text-slate-400 cursor-not-allowed opacity-60">
                      {roles.find(r => r.id === selectedRole)?.name || 'Unknown'}
                    </div>
                  </div>
                </div>
                {roles.find(r => r.id === selectedRole)?.isChef && selectedSpecialty && (
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1.5">Food Category / Specialty</label>
                    <div className="w-full px-4 py-2.5 rounded-xl bg-[#131018] border border-[#3b3054] text-slate-400 cursor-not-allowed opacity-60">
                      {menuCategories.find(c => c.id === selectedSpecialty)?.name || 'Unknown'}
                    </div>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">Branch Assignment</label>
                  <div className="w-full px-4 py-2.5 rounded-xl bg-[#131018] border border-[#3b3054] text-slate-400 cursor-not-allowed opacity-60">
                    {branches.find(b => b.id === selectedBranch)?.name || 'Unknown'}
                  </div>
                </div>
              </>
            ) : (
              /* No position — interactive selects */
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1.5">Department</label>
                    <select
                      name="departmentId"
                      value={selectedDept}
                      onChange={(e) => {
                        setSelectedDept(e.target.value)
                        setSelectedRole('')
                      }}
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
                      disabled={!selectedDept}
                      className="w-full px-4 py-2.5 rounded-xl bg-[#131018] border border-[#3b3054] text-white focus:border-[#c084fc] outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="">{selectedDept ? "Select Role" : "Select Dept First"}</option>
                      {filteredRoles.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </div>
                </div>

                {/* Conditional Specialty Field */}
                {roles.find(r => r.id === selectedRole)?.isChef && (
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1.5">Food Category / Specialty</label>
                    <select
                      name="specialtyId"
                      value={selectedSpecialty}
                      onChange={(e) => setSelectedSpecialty(e.target.value)}
                      required
                      className="w-full px-4 py-2.5 rounded-xl bg-[#131018] border border-[#3b3054] text-white focus:border-rose-400 outline-none"
                    >
                      <option value="">Select Specialty</option>
                      {menuCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">Branch Assignment</label>
                  <select
                    name="branchId"
                    value={selectedBranch}
                    onChange={(e) => setSelectedBranch(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 rounded-xl bg-[#131018] border border-[#3b3054] text-white focus:border-[#c084fc] outline-none"
                  >
                    <option value="">Select Branch</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1.5">Custom Label / Tag (Optional)</label>
              <input
                name="label"
                defaultValue={editData?.label || draftData?.label || ''}
                placeholder="e.g. Senior, Part-time, Night Shift"
                className="w-full px-4 py-2.5 rounded-xl bg-[#131018] border border-[#3b3054] text-white focus:border-[#c084fc] outline-none placeholder:text-slate-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1.5">Monthly Salary (₹)</label>
              <input
                name="salary"
                type="number"
                value={salary}
                onChange={(e) => setSalary(e.target.value)}
                placeholder="0.00"
                className="w-full px-4 py-2.5 rounded-xl bg-[#131018] border border-[#3b3054] text-white focus:border-[#c084fc] outline-none placeholder:text-slate-600"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Start Time</label>
                <input
                  name="startTime"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#131018] border border-[#3b3054] text-white focus:border-[#c084fc] outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">End Time</label>
                <input
                  name="endTime"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#131018] border border-[#3b3054] text-white focus:border-[#c084fc] outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1.5">Shift Type</label>
              <select
                name="shiftType"
                value={shiftType}
                onChange={(e) => {
                  const val = e.target.value;
                  setShiftType(val);
                  if (val === 'morning') {
                    setStartTime('06:00'); setEndTime('14:00');
                  } else if (val === 'evening') {
                    setStartTime('14:00'); setEndTime('22:00');
                  } else if (val === 'full') {
                    setStartTime('09:00'); setEndTime('21:00');
                  }
                }}
                className="w-full px-4 py-2.5 rounded-xl bg-[#131018] border border-[#3b3054] text-white focus:border-[#c084fc] outline-none"
              >
                <option value="morning">Morning Shift (06:00 - 14:00)</option>
                <option value="evening">Evening Shift (14:00 - 22:00)</option>
                <option value="full">Full Day (09:00 - 21:00)</option>
              </select>
            </div>


            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Joining Date</label>
                <input
                  name="joinedAt"
                  type="date"
                  defaultValue={editData?.joinedAt || new Date().toISOString().split('T')[0]}
                  required
                  className="w-full px-4 py-2.5 rounded-xl bg-[#131018] border border-[#3b3054] text-white focus:border-[#c084fc] outline-none"
                />
              </div>
              {editData && (
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1.5">Exit Date</label>
                  <input
                    name="exitDate"
                    type="date"
                    defaultValue={editData?.exitDate}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#131018] border border-[#3b3054] text-white focus:border-[#c084fc] outline-none"
                  />
                </div>
              )}
            </div>

            {editData && (
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Status</label>
                <select
                  name="status"
                  defaultValue={editData?.isActive ? 'active' : 'inactive'}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#131018] border border-[#3b3054] text-white focus:border-[#c084fc] outline-none"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive / Terminated</option>
                </select>
              </div>
            )}

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
                {editData ? 'Save Changes' : 'Create Staff Member'}
              </button>
            </div>
          </form>
          </div>
        </div>
      </div>
    </div>
  )
}

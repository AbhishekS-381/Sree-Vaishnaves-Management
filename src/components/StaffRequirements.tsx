"use client"

import { useState, useMemo } from "react"
import { deleteRequirement } from "@/app/actions/staff_requirements"
import { Plus, Pencil, Trash2, UserPlus, Search, Loader2 } from "lucide-react"
import { RequirementModal } from "./RequirementModal"
import { PositionsSummaryCards } from "./PositionsSummaryCards"

type Requirement = {
  id: string
  branchId: string
  departmentId: string
  roleId: string
  specialtyId?: string
  requiredCount: number
  defaultSalary?: number
  responsibility?: string
}

type Props = {
  requirements: Requirement[]
  staff: any[]
  branches: any[]
  departments: any[]
  roles: any[]
  menuCategories?: any[]
  onQuickHire?: (id: string) => void
  isReadOnly?: boolean
  isPending?: boolean
}

export function StaffRequirements({ requirements, staff, branches, departments, roles, menuCategories = [], onQuickHire, isReadOnly = false, isPending = false }: Props) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingReq, setEditingReq] = useState<Requirement | null>(null)

  const [searchRole, setSearchRole] = useState("")
  const [filterBranch, setFilterBranch] = useState("")
  const [filterDept, setFilterDept] = useState("")

  const handleEdit = (req: Requirement) => {
    setEditingReq(req)
    setIsModalOpen(true)
  }

  const handleNew = () => {
    setEditingReq(null)
    setIsModalOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to remove this position requirement?")) {
      await deleteRequirement(id)
    }
  }

  // Helpers
  const getRole = (id: string) => roles.find((r) => r.id === id)?.name || id
  const getDept = (id: string) => departments.find((d) => d.id === id)?.name || id
  const getBranch = (id: string) => branches.find((b) => b.id === id)?.name || id
  const getSpecialty = (id?: string) => id ? menuCategories.find((c: any) => c.id === id)?.name : null

  // Memoised filtered list — used by both the summary cards and the table
  const filteredRequirements = useMemo(() => {
    return requirements.filter(req => {
      if (filterBranch && req.branchId !== filterBranch) return false
      if (filterDept && req.departmentId !== filterDept) return false
      if (searchRole) {
        const roleName = getRole(req.roleId).toLowerCase()
        if (!roleName.includes(searchRole.toLowerCase())) return false
      }
      return true
    })
  }, [requirements, filterBranch, filterDept, searchRole, roles])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Configured Positions</h2>
          <p className="text-sm text-slate-400">Define the required headcount for specific roles across branches.</p>
        </div>
        {!isReadOnly && (
          <button
            onClick={handleNew}
            className="bg-primary text-[#131018] px-4 py-2 rounded-lg text-sm font-bold hover:bg-accent transition-colors flex items-center gap-2"
          >
            <Plus className="h-4 w-4" /> Add Requirement
          </button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by role name..."
            value={searchRole}
            onChange={(e) => setSearchRole(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-[#131018] border border-[#3b3054] rounded-xl text-sm text-white focus:border-[#c084fc] outline-none"
          />
        </div>
        <select
          value={filterBranch}
          onChange={(e) => setFilterBranch(e.target.value)}
          className="px-4 py-2 bg-[#131018] border border-[#3b3054] rounded-xl text-sm text-white focus:border-[#c084fc] outline-none"
        >
          <option value="">All Branches</option>
          {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select
          value={filterDept}
          onChange={(e) => setFilterDept(e.target.value)}
          className="px-4 py-2 bg-[#131018] border border-[#3b3054] rounded-xl text-sm text-white focus:border-[#c084fc] outline-none"
        >
          <option value="">All Departments</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>

      {/* Summary Cards — reactive to current filters */}
      <PositionsSummaryCards requirements={filteredRequirements} staff={staff} />

      <div className="relative bg-card rounded-2xl border border-card shadow-lg shadow-black/20 overflow-hidden">
        {isPending && (
          <div className="absolute inset-0 bg-[#131018]/60 backdrop-blur-[2px] z-10 flex items-center justify-center rounded-2xl">
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <Loader2 className="h-5 w-5 animate-spin text-[#c084fc]" />
              Refreshing…
            </div>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[#1e1b2e] border-b border-[#3b3054] text-slate-400 text-xs uppercase font-semibold tracking-wider">
              <tr>
                <th className="px-6 py-4">Branch</th>
                <th className="px-6 py-4">Department</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4 text-center">Salary</th>
                <th className="px-6 py-4 text-center">Required</th>
                <th className="px-6 py-4 text-center">Filled</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3b3054]">
              {filteredRequirements.length > 0 ? (
                filteredRequirements.map((req) => {
                  const assignedStaff = staff.filter((s) => 
                    s.isActive && s.positionId === req.id
                  )
                  const filled = assignedStaff.length
                  const open = req.requiredCount - filled
                  const specialtyName = getSpecialty(req.specialtyId)

                  return (
                    <tr key={req.id} className="hover:bg-[#2d283e] transition-colors">
                      <td className="px-6 py-4 text-sm text-white">{getBranch(req.branchId)}</td>
                      <td className="px-6 py-4 text-sm text-slate-300">{getDept(req.departmentId)}</td>
                      <td className="px-6 py-4 text-sm text-white font-medium">
                        <div>
                          {getRole(req.roleId)}
                          {specialtyName && <span className="ml-2 bg-rose-500/10 text-rose-400 text-[10px] px-2 py-0.5 rounded-full font-bold border border-rose-500/20">{specialtyName}</span>}
                        </div>
                        {req.responsibility && (
                          <div className="text-xs text-slate-500 mt-1 line-clamp-2 max-w-xs font-normal" title={req.responsibility}>
                            {req.responsibility}
                          </div>
                        )}
                        {assignedStaff.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5 max-w-xs">
                            {assignedStaff.map((s) => (
                              <span key={s.id} className="inline-flex items-center px-1.5 py-0.5 rounded bg-[#252033] text-slate-300 text-[10px] border border-[#3b3054] font-normal" title={`${s.name} (${s.phone})`}>
                                {s.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center text-sm text-emerald-400 font-medium">
                        {req.defaultSalary ? `₹${req.defaultSalary.toLocaleString()}` : '-'}
                      </td>
                      <td className="px-6 py-4 text-center text-sm">{req.requiredCount}</td>
                      <td className="px-6 py-4 text-center text-sm font-medium">{filled}</td>
                      <td className="px-6 py-4 text-center">
                        {open > 0 ? (
                          <span className="inline-flex items-center px-2 py-1 rounded bg-rose-500/10 text-rose-400 text-xs font-bold border border-rose-500/20">
                            {open} Open
                          </span>
                        ) : open < 0 ? (
                          <div className="flex flex-col items-center gap-1">
                            <span className="inline-flex items-center px-2 py-1 rounded bg-amber-500/10 text-amber-400 text-xs font-bold border border-amber-500/20"
                              title={`Excess staff: ${assignedStaff.slice(req.requiredCount).map(s => s.name).join(', ')}`}
                            >
                              {Math.abs(open)} Over
                            </span>
                            <div className="flex flex-wrap gap-0.5 justify-center max-w-[120px]">
                              {assignedStaff.slice(req.requiredCount).map((s) => (
                                <span key={s.id} className="text-[9px] text-amber-400/80 bg-amber-500/5 px-1 rounded border border-amber-500/10 truncate max-w-[100px]" title={`${s.name} — consider reassigning`}>
                                  {s.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 text-xs font-bold border border-emerald-500/20">
                            Balanced
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {!isReadOnly && onQuickHire && (
                            <button
                              onClick={() => onQuickHire(req.id)}
                              className="p-2 hover:bg-[#3b3054] rounded-lg text-[#c084fc] hover:text-white transition-colors"
                              title="Fill Position (Assign Staff)"
                            >
                              <UserPlus className="h-4 w-4" />
                            </button>
                          )}
                          {!isReadOnly && (
                            <>
                              <button
                                onClick={() => handleEdit(req)}
                                className="p-2 hover:bg-[#3b3054] rounded-lg text-slate-400 hover:text-white transition-colors"
                                title="Edit"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(req.id)}
                                className="p-2 hover:bg-red-900/20 rounded-lg text-slate-400 hover:text-red-400 transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500 text-sm italic">
                    No position requirements defined yet. Click "Add Requirement" to start.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <RequirementModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        editData={editingReq}
        branches={branches}
        departments={departments}
        roles={roles}
        menuCategories={menuCategories}
      />
    </div>
  )
}

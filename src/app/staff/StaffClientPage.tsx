"use client"

import { useState, useMemo } from 'react'
import { User, Phone, Plus, Pencil, Trash2 } from 'lucide-react'
import { deleteStaff } from '@/app/actions/staff'
import { StaffFilters } from '@/components/StaffFilters'
import { StaffModal } from '@/components/StaffModal'
import { StaffRequirements } from '@/components/StaffRequirements'
import { ScheduleTimeline } from '@/components/ScheduleTimeline'
import { useStaffFilters } from '@/hooks/useStaffFilters'
import { useRouter } from 'next/navigation'

type Staff = {
  id: string
  name: string
  roleId: string
  departmentId: string
  branchId: string
  phone: string
  label?: string
  shiftType?: 'morning' | 'evening' | 'full'
  isActive: boolean
  specialtyId?: string
  positionId?: string
  monthlySalary?: number
}

type Props = {
  initialStaff: Staff[]
  branches: any[]
  departments: any[]
  roles: any[]
  requirements: any[]
  menuCategories?: any[]
}

export default function StaffClientPage({ initialStaff, branches, departments, roles, requirements, menuCategories = [] }: Props) {
  const [activeTab, setActiveTab] = useState<'staff' | 'requirements' | 'timeline'>('staff')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null)
  const [preselectedPositionId, setPreselectedPositionId] = useState<string | null>(null)

  const { filters, setFilters, filteredStaff } = useStaffFilters(initialStaff)
  const router = useRouter()

  // Helpers
  const getRole = (id: string) => roles.find(r => r.id === id)?.name || id
  const getDept = (id: string) => departments.find(d => d.id === id)?.name || id
  const getBranch = (id: string) => branches.find(b => b.id === id)?.name || id

  const handleEdit = (staff: Staff) => {
    setEditingStaff(staff)
    setPreselectedPositionId(staff.positionId || null)
    setIsModalOpen(true)
  }

  const handleNew = () => {
    setEditingStaff(null)
    setPreselectedPositionId(null)
    setIsModalOpen(true)
  }

  const handleNewWithPosition = (posId: string) => {
    setEditingStaff(null)
    setPreselectedPositionId(posId)
    setIsModalOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Staff</h1>
          <p className="text-slate-400 mt-1">Manage your team members.</p>
        </div>
        <button
          onClick={handleNew}
          className="bg-primary text-[#131018] px-4 py-2 rounded-lg text-sm font-bold hover:bg-accent transition-colors flex items-center gap-2"
        >
          <Plus className="h-4 w-4" /> Add Staff
        </button>
      </div>

      <div className="flex bg-[#252033] p-1 rounded-xl w-fit border border-[#3b3054] shadow-inner mb-6">
        <button 
          onClick={() => setActiveTab('staff')} 
          className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'staff' ? 'bg-[#c084fc] text-[#131018] shadow-md' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
        >
          Staff Directory
        </button>
        <button 
          onClick={() => setActiveTab('requirements')} 
          className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'requirements' ? 'bg-[#c084fc] text-[#131018] shadow-md' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
        >
          Open Positions
        </button>
        <button 
          onClick={() => setActiveTab('timeline')} 
          className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'timeline' ? 'bg-[#c084fc] text-[#131018] shadow-md' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
        >
          Timeline Schedule
        </button>
      </div>

      {activeTab === 'timeline' ? (
        <ScheduleTimeline
          staff={initialStaff}
          requirements={requirements || []}
          branches={branches}
          departments={departments}
          roles={roles}
        />
      ) : activeTab === 'requirements' ? (
        <StaffRequirements 
          requirements={requirements || []} 
          staff={initialStaff} 
          branches={branches} 
          departments={departments} 
          roles={roles} 
          menuCategories={menuCategories}
          onQuickHire={handleNewWithPosition}
        />
      ) : (
      <>
        {/* Filters Component */}
      <StaffFilters
        branches={branches}
        departments={departments}
        roles={roles}
        onFilterChange={setFilters}
      />

      <div className="bg-card rounded-2xl border border-card shadow-lg shadow-black/20 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[#252033] border-b border-[#3b3054] text-accent text-xs uppercase font-semibold tracking-wider">
              <tr>
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4 hidden sm:table-cell">Role</th>
                <th className="px-6 py-4 hidden md:table-cell">Department</th>
                <th className="px-6 py-4 hidden lg:table-cell">Branch</th>
                <th className="px-6 py-4 hidden sm:table-cell">Salary</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3b3054]">
              {filteredStaff.length > 0 ? filteredStaff.map((s) => (
                 <tr key={s.id} className="hover:bg-[#2d283e] transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-[#3b3054] flex items-center justify-center text-accent border border-white/5">
                        <User className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium text-white">{s.name}</p>
                        <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                          <div className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {s.phone}
                          </div>
                          {s.shiftType && (
                            <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 text-[10px] font-bold uppercase tracking-wider border border-blue-500/20">
                              {s.shiftType}
                            </span>
                          )}
                          {s.label && (
                            <span className="px-1.5 py-0.5 rounded bg-primary/20 text-accent text-[10px] font-medium border border-primary/30">
                              {s.label}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-300 hidden sm:table-cell">
                    {getRole(s.roleId)}
                    {s.specialtyId && (
                       <div className="mt-1 inline-block bg-rose-500/10 text-rose-400 text-[10px] px-2 py-0.5 rounded-full font-bold border border-rose-500/20 whitespace-nowrap">
                         {menuCategories.find(c => c.id === s.specialtyId)?.name}
                       </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-300 hidden md:table-cell">
                    {getDept(s.departmentId)}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-300 hidden lg:table-cell">
                    {getBranch(s.branchId)}
                  </td>
                  <td className="px-6 py-4 text-sm text-emerald-400 font-medium hidden sm:table-cell">
                    {s.monthlySalary ? `₹${s.monthlySalary.toLocaleString()}` : '-'}
                  </td>
                  <td className="px-6 py-4">
                    {s.isActive ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold border border-emerald-500/20 shadow-[0_0_10px_rgba(52,211,153,0.1)]">
                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-400"></div>
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 text-red-400 text-xs font-medium border border-red-500/20">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleEdit(s)}
                        className="p-2 hover:bg-[#3b3054] rounded-lg text-slate-400 hover:text-white transition-colors"
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={async () => {
                          if (confirm('Are you sure you want to delete this staff member? This action cannot be undone.')) {
                            await deleteStaff(s.id)
                            router.refresh()
                          }
                        }}
                        className="p-2 hover:bg-red-900/20 rounded-lg text-slate-400 hover:text-red-400 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                 </tr>
              )) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500 text-sm italic">
                    No staff members found matching these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      </>
      )}

      <StaffModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setPreselectedPositionId(null)
        }}
        editData={editingStaff}
        preselectedPositionId={preselectedPositionId}
        requirements={requirements}
        branches={branches}
        departments={departments}
        roles={roles}
        menuCategories={menuCategories}
      />
    </div>
  )
}

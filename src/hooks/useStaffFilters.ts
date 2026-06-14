import { useState, useMemo } from 'react'

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

export function useStaffFilters(initialStaff: Staff[]) {
  const [filters, setFilters] = useState({
    search: '',
    branchId: '',
    departmentId: '',
    roleId: '',
    showInactive: false
  })

  const filteredStaff = useMemo(() => {
    return initialStaff.filter(s => {
      // 1. Inactive toggle
      if (!s.isActive && !filters.showInactive) return false

      // 2. Search
      if (filters.search) {
        const q = filters.search.toLowerCase()
        if (!s.name.toLowerCase().includes(q) && !s.phone.includes(q)) return false
      }

      // 3. Dropdowns
      if (filters.branchId && s.branchId !== filters.branchId) return false
      if (filters.departmentId && s.departmentId !== filters.departmentId) return false
      if (filters.roleId && s.roleId !== filters.roleId) return false

      return true
    })
  }, [initialStaff, filters])

  return { filters, setFilters, filteredStaff }
}

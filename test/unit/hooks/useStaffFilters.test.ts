import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useStaffFilters } from '@/hooks/useStaffFilters'

const mockStaff = [
  { id: 's1', name: 'Alice', phone: '9001', roleId: 'r1', departmentId: 'd1', branchId: 'b1', isActive: true },
  { id: 's2', name: 'Bob', phone: '9002', roleId: 'r2', departmentId: 'd2', branchId: 'b2', isActive: false },
  { id: 's3', name: 'Carol', phone: '9003', roleId: 'r1', departmentId: 'd1', branchId: 'b1', isActive: true },
]

describe('useStaffFilters', () => {
  it('returns all active staff by default', () => {
    const { result } = renderHook(() => useStaffFilters(mockStaff))
    expect(result.current.filteredStaff).toHaveLength(2) // Alice + Carol (active)
  })

  it('shows inactive staff when showInactive=true', () => {
    const { result } = renderHook(() => useStaffFilters(mockStaff))
    act(() => {
      result.current.setFilters(f => ({ ...f, showInactive: true }))
    })
    expect(result.current.filteredStaff).toHaveLength(3)
  })

  it('filters by name search', () => {
    const { result } = renderHook(() => useStaffFilters(mockStaff))
    act(() => {
      result.current.setFilters(f => ({ ...f, search: 'alice' }))
    })
    expect(result.current.filteredStaff).toHaveLength(1)
    expect(result.current.filteredStaff[0].name).toBe('Alice')
  })

  it('filters by phone search', () => {
    const { result } = renderHook(() => useStaffFilters(mockStaff))
    act(() => {
      result.current.setFilters(f => ({ ...f, search: '9003' }))
    })
    expect(result.current.filteredStaff).toHaveLength(1)
    expect(result.current.filteredStaff[0].name).toBe('Carol')
  })

  it('filters by branchId', () => {
    const { result } = renderHook(() => useStaffFilters(mockStaff))
    act(() => {
      result.current.setFilters(f => ({ ...f, branchId: 'b1' }))
    })
    expect(result.current.filteredStaff).toHaveLength(2)
    expect(result.current.filteredStaff.every(s => s.branchId === 'b1')).toBe(true)
  })

  it('filters by departmentId', () => {
    const { result } = renderHook(() => useStaffFilters(mockStaff))
    act(() => {
      result.current.setFilters(f => ({ ...f, departmentId: 'd1' }))
    })
    expect(result.current.filteredStaff).toHaveLength(2)
  })

  it('filters by roleId', () => {
    const { result } = renderHook(() => useStaffFilters(mockStaff))
    act(() => {
      result.current.setFilters(f => ({ ...f, roleId: 'r1' }))
    })
    expect(result.current.filteredStaff).toHaveLength(2)
  })

  it('returns empty when filters match no staff', () => {
    const { result } = renderHook(() => useStaffFilters(mockStaff))
    act(() => {
      result.current.setFilters(f => ({ ...f, search: 'Zxy123' }))
    })
    expect(result.current.filteredStaff).toHaveLength(0)
  })
})

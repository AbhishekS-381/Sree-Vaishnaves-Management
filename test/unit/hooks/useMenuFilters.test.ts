import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useMenuFilters } from '@/hooks/useMenuFilters'

const mockMenu = [
  { id: 'm1', name: 'Dosa', categoryId: 'cat1', branchId: 'b1', isAvailable: true },
  { id: 'm2', name: 'Idli', categoryId: 'cat1', branchId: 'b1', isAvailable: true },
  { id: 'm3', name: 'Pizza', categoryId: 'cat2', branchId: 'b2', isAvailable: false },
  { id: 'm4', name: 'Sambar', categoryId: 'cat1', branchId: 'b1', isAvailable: true },
]

const mockCategories = [
  { id: 'cat1', name: 'Breakfast' },
  { id: 'cat2', name: 'Fast Food' }
]

describe('useMenuFilters', () => {
  it('returns only items for the selected branch', () => {
    const { result } = renderHook(() => useMenuFilters(mockMenu, 'b1', mockCategories as any))
    expect(result.current.filteredMenu).toHaveLength(3)
    expect(result.current.filteredMenu.every(m => m.branchId === 'b1')).toBe(true)
  })

  it('filters by search term on name', () => {
    const { result } = renderHook(() => useMenuFilters(mockMenu, 'b1', mockCategories as any))
    act(() => {
      result.current.setSearch('dosa')
    })
    expect(result.current.filteredMenu).toHaveLength(1)
    expect(result.current.filteredMenu[0].name).toBe('Dosa')
  })

  it('filters by search term on category', () => {
    const { result } = renderHook(() => useMenuFilters(mockMenu, 'b1', mockCategories as any))
    act(() => {
      result.current.setSearch('Breakfast')
    })
    expect(result.current.filteredMenu).toHaveLength(3)
  })

  it('returns empty array when search finds nothing', () => {
    const { result } = renderHook(() => useMenuFilters(mockMenu, 'b1', mockCategories as any))
    act(() => {
      result.current.setSearch('Sushi')
    })
    expect(result.current.filteredMenu).toHaveLength(0)
  })

  it('groups filtered menu by category', () => {
    const { result } = renderHook(() => useMenuFilters(mockMenu, 'b1', mockCategories as any))
    const grouped = result.current.groupedMenu
    expect(grouped['Breakfast']).toHaveLength(3)
    expect(grouped['Fast Food']).toBeUndefined() // b2 item excluded
  })

  it('returns empty results for unmatched branch', () => {
    const { result } = renderHook(() => useMenuFilters(mockMenu, 'b99', mockCategories as any))
    expect(result.current.filteredMenu).toHaveLength(0)
    expect(result.current.groupedMenu).toEqual({})
  })
})

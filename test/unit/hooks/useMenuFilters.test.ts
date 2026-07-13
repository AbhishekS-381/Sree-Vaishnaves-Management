import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useMenuFilters } from '@/hooks/useMenuFilters'

const mockMenu = [
  { id: 'm1', name: 'Dosa', categoryId: 'cat1' },
  { id: 'm2', name: 'Idli', categoryId: 'cat1' },
  { id: 'm3', name: 'Pizza', categoryId: 'cat2' },
  { id: 'm4', name: 'Sambar', categoryId: 'cat1' },
]

const mockCategories = [
  { id: 'cat1', name: 'Breakfast' },
  { id: 'cat2', name: 'Fast Food' }
]

const mockBranchMenuItems = [
  { branchId: 'b1', menuItemId: 'm1', isAvailable: true, price: 50 },
  { branchId: 'b1', menuItemId: 'm2', isAvailable: true, price: 40 },
  { branchId: 'b2', menuItemId: 'm3', isAvailable: true, price: 150 },
  { branchId: 'b1', menuItemId: 'm4', isAvailable: true, price: 60 },
]

const mockBranchCategories = [
  { branchId: 'b1', categoryId: 'cat1', isAvailable: true },
  { branchId: 'b2', categoryId: 'cat2', isAvailable: true }
]

describe('useMenuFilters', () => {
  it('returns items enriched with their branch-specific price and availability', () => {
    const { result } = renderHook(() => useMenuFilters(mockMenu, 'b1', mockCategories as any, mockBranchMenuItems, mockBranchCategories))
    expect(result.current.filteredMenu).toHaveLength(4) // It returns all global items
    
    // Check enrichment
    const dosa = result.current.filteredMenu.find(m => m.name === 'Dosa')
    expect(dosa?.price).toBe(50)
    expect(dosa?.isAvailable).toBe(true)

    const pizza = result.current.filteredMenu.find(m => m.name === 'Pizza')
    expect(pizza?.price).toBe(0) // Not mapped in b1
    expect(pizza?.isAvailable).toBe(false)
  })

  it('filters by search term on name', () => {
    const { result } = renderHook(() => useMenuFilters(mockMenu, 'b1', mockCategories as any, mockBranchMenuItems, mockBranchCategories))
    act(() => {
      result.current.setSearch('dosa')
    })
    expect(result.current.filteredMenu).toHaveLength(1)
    expect(result.current.filteredMenu[0].name).toBe('Dosa')
  })

  it('filters by search term on category', () => {
    const { result } = renderHook(() => useMenuFilters(mockMenu, 'b1', mockCategories as any, mockBranchMenuItems, mockBranchCategories))
    act(() => {
      result.current.setSearch('Breakfast')
    })
    expect(result.current.filteredMenu).toHaveLength(3)
  })

  it('returns empty array when search finds nothing', () => {
    const { result } = renderHook(() => useMenuFilters(mockMenu, 'b1', mockCategories as any, mockBranchMenuItems, mockBranchCategories))
    act(() => {
      result.current.setSearch('Sushi')
    })
    expect(result.current.filteredMenu).toHaveLength(0)
  })

  it('groups filtered menu by category', () => {
    const { result } = renderHook(() => useMenuFilters(mockMenu, 'b1', mockCategories as any, mockBranchMenuItems, mockBranchCategories))
    const grouped = result.current.groupedMenu
    expect(grouped['Breakfast']).toHaveLength(3)
    expect(grouped['Fast Food']).toHaveLength(1) // All items are shown, just disabled if unmapped
  })
})

import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useMenuResolver } from '@/hooks/useMenuResolver'

const categories = [
  { id: 'c1', name: 'Breakfast', sortOrder: 0 },
  { id: 'c2', name: 'Mains', sortOrder: 1 },
  { id: 'c3', name: 'Retired', sortOrder: 2, isActive: false },
]

const menu = [
  { id: 'm1', name: 'Idli', categoryId: 'c1', basePrice: 40, costPrice: 10, sortOrder: 1, isActive: true, dietary: ['jain'] },
  { id: 'm2', name: 'Masala Dosa', categoryId: 'c1', basePrice: 80, sortOrder: 0, isActive: true },
  { id: 'm3', name: 'Thali', categoryId: 'c2', basePrice: 150, sortOrder: 0, isActive: true },
  { id: 'm4', name: 'Old Item', categoryId: 'c2', basePrice: 10, sortOrder: 9, isActive: false },
]

const variants = [
  { id: 'v1', menuItemId: 'm3', name: 'Half', basePrice: 90, sortOrder: 0, isActive: true },
]

const branchMenuItems = [
  { menuItemId: 'm1', price: 35, isAvailable: true },      // overridden
  { menuItemId: 'm2', price: null, isAvailable: false },   // unavailable
  { menuItemId: 'm3', price: null, isAvailable: true },
]

const branchCategories = [{ categoryId: 'c2', isAvailable: true }]

// 10:00 on a Wednesday — fixed so windowed items are deterministic
const now = new Date(2026, 8, 30, 10, 0, 0)

const setup = (over: Partial<Parameters<typeof useMenuResolver>[0]> = {}) =>
  renderHook(() =>
    useMenuResolver({
      menu, variants, categories, branchMenuItems, branchCategories,
      selectedBranch: 'b1', now, ...over,
    })
  )

describe('useMenuResolver', () => {
  it('resolves prices with branch overrides and inheritance', () => {
    const { result } = setup()
    const byId = (id: string) => result.current.resolvedItems.find(i => i.id === id)!
    expect(byId('m1').price).toBe(35)
    expect(byId('m1').isOverridden).toBe(true)
    expect(byId('m2').price).toBe(80)        // null override → inherits base
    expect(byId('m2').isOverridden).toBe(false)
  })

  it('resolves availability from the branch mapping', () => {
    const { result } = setup()
    const byId = (id: string) => result.current.resolvedItems.find(i => i.id === id)!
    expect(byId('m1').isAvailable).toBe(true)
    expect(byId('m2').isAvailable).toBe(false)
  })

  it('excludes archived items from the active list and exposes them separately', () => {
    const { result } = setup()
    expect(result.current.resolvedItems.map(i => i.id)).not.toContain('m4')
    expect(result.current.archivedItems.map((i: any) => i.id)).toEqual(['m4'])
    expect(result.current.counts.archived).toBe(1)
  })

  it('computes margin only when cost price is present', () => {
    const { result } = setup()
    const byId = (id: string) => result.current.resolvedItems.find(i => i.id === id)!
    expect(byId('m1').margin).toEqual({ profit: 25, foodCostPct: 28.6 })
    expect(byId('m3').margin).toBeNull()
  })

  it('rolls up variants with their own prices', () => {
    const { result } = setup()
    const thali = result.current.resolvedItems.find(i => i.id === 'm3')!
    expect(thali.variants).toHaveLength(1)
    expect(thali.variants[0]).toMatchObject({ name: 'Half', basePrice: 90, price: 90 })
  })

  it('drops inactive categories and applies branch category availability', () => {
    const { result } = setup()
    expect(result.current.enrichedCategories.map(c => c.id)).toEqual(['c1', 'c2'])
    expect(result.current.enrichedCategories.find(c => c.id === 'c2')!.isAvailable).toBe(true)
    expect(result.current.enrichedCategories.find(c => c.id === 'c1')!.isAvailable).toBe(true) // default
  })

  it('groups items by category in category order, respecting item sortOrder', () => {
    const { result } = setup()
    const groups = result.current.groupedItems
    expect(groups.map(g => g.category.id)).toEqual(['c1', 'c2'])
    expect(groups[0].items.map(i => i.name)).toEqual(['Masala Dosa', 'Idli']) // sortOrder 0,1
  })

  it('filters by search across name and category', () => {
    const { result } = setup()
    act(() => result.current.setSearch('dosa'))
    expect(result.current.filteredItems.map(i => i.id)).toEqual(['m2'])
    act(() => result.current.setSearch('mains'))
    expect(result.current.filteredItems.map(i => i.id)).toEqual(['m3'])
  })

  it('filters by availability', () => {
    const { result } = setup()
    act(() => result.current.setFilters(f => ({ ...f, availability: 'unavailable' })))
    expect(result.current.filteredItems.map(i => i.id)).toEqual(['m2'])
    act(() => result.current.setFilters(f => ({ ...f, availability: 'available' })))
    expect(result.current.filteredItems.map(i => i.id).sort()).toEqual(['m1', 'm3'])
  })

  it('filters by category and by overridden-only', () => {
    const { result } = setup()
    act(() => result.current.setFilters(f => ({ ...f, categoryIds: ['c2'] })))
    expect(result.current.filteredItems.map(i => i.id)).toEqual(['m3'])

    act(() => result.current.resetFilters())
    act(() => result.current.setFilters(f => ({ ...f, overriddenOnly: true })))
    expect(result.current.filteredItems.map(i => i.id)).toEqual(['m1'])
  })

  it('filters by dietary tags', () => {
    const { result } = setup()
    act(() => result.current.setFilters(f => ({ ...f, dietary: ['jain'] })))
    expect(result.current.filteredItems.map(i => i.id)).toEqual(['m1'])
  })

  it('sorts by name and by price', () => {
    const { result } = setup()
    act(() => result.current.setFilters(f => ({ ...f, sort: 'name' })))
    expect(result.current.filteredItems.map(i => i.name)).toEqual(['Idli', 'Masala Dosa', 'Thali'])

    act(() => result.current.setFilters(f => ({ ...f, sort: 'price-asc' })))
    expect(result.current.filteredItems.map(i => i.price)).toEqual([35, 80, 150])

    act(() => result.current.setFilters(f => ({ ...f, sort: 'price-desc' })))
    expect(result.current.filteredItems.map(i => i.price)).toEqual([150, 80, 35])
  })

  it('hides items whose availability window has passed', () => {
    const windowed = [{
      id: 'mw', name: 'Breakfast Only', categoryId: 'c1', basePrice: 50, sortOrder: 5, isActive: true,
      availability: { startTime: '06:00', endTime: '09:00' },
    }]
    const { result } = setup({ menu: [...menu, ...windowed], branchMenuItems: [] })
    const item = result.current.resolvedItems.find(i => i.id === 'mw')!
    expect(item.hasWindow).toBe(true)
    expect(item.isAvailable).toBe(false) // now = 10:00
  })

  it('places items with an unknown category into an Uncategorised group', () => {
    const orphan = [{ id: 'mo', name: 'Orphan', categoryId: 'ghost', basePrice: 10, sortOrder: 0, isActive: true }]
    const { result } = setup({ menu: orphan, branchMenuItems: [] })
    expect(result.current.groupedItems.map(g => g.category.name)).toEqual(['Uncategorised'])
  })

  it('reports counts and resolves category names', () => {
    const { result } = setup()
    expect(result.current.counts).toMatchObject({ total: 3, shown: 3, available: 2, overridden: 1 })
    expect(result.current.categoryName('c1')).toBe('Breakfast')
    expect(result.current.categoryName('nope')).toBe('Uncategorised')
  })

  it('resetFilters clears every filter', () => {
    const { result } = setup()
    act(() => result.current.setFilters(f => ({ ...f, search: 'x', overriddenOnly: true, sort: 'name' })))
    act(() => result.current.resetFilters())
    expect(result.current.filters).toMatchObject({
      search: '', categoryIds: [], availability: 'all', overriddenOnly: false, dietary: [], sort: 'menu',
    })
  })
})

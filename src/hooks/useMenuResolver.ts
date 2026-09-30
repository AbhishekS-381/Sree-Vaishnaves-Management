import { useMemo, useState } from 'react'
import {
  resolveItemForBranch,
  sortItems,
  type ResolvedItem,
  type ResolverBranchCategory,
  type ResolverBranchMapping,
  type ResolverMenuItem,
  type ResolverVariant,
} from '@/lib/menuResolver'

export type MenuSort = 'menu' | 'name' | 'price-asc' | 'price-desc'
export type AvailabilityFilter = 'all' | 'available' | 'unavailable'

export type MenuFilters = {
  search: string
  categoryIds: string[]
  availability: AvailabilityFilter
  overriddenOnly: boolean
  dietary: string[]
  sort: MenuSort
}

const DEFAULT_FILTERS: MenuFilters = {
  search: '',
  categoryIds: [],
  availability: 'all',
  overriddenOnly: false,
  dietary: [],
  sort: 'menu',
}

type Category = { id: string; name: string; sortOrder?: number; isActive?: boolean }

/**
 * Resolves the global catalog against one branch's overrides and applies the
 * user's filters/sort. All pricing and availability maths lives in
 * `@/lib/menuResolver` so it stays pure and unit-tested.
 */
export function useMenuResolver(args: {
  menu: ResolverMenuItem[]
  variants: ResolverVariant[]
  categories: Category[]
  branchMenuItems: ResolverBranchMapping[]
  branchCategories: ResolverBranchCategory[]
  selectedBranch: string
  /** injectable for deterministic tests */
  now?: Date
}) {
  const {
    menu, variants, categories, branchMenuItems, branchCategories, selectedBranch,
  } = args

  const [filters, setFilters] = useState<MenuFilters>(DEFAULT_FILTERS)
  const now = args.now ?? new Date()
  const nowKey = Math.floor(now.getTime() / 60000) // re-resolve at most once a minute

  /** Categories with this branch's availability applied, in display order. */
  const enrichedCategories = useMemo(() => {
    return sortItems(
      categories
        .filter(c => c.isActive !== false)
        .map(c => ({
          ...c,
          isAvailable: branchCategories.find(b => b.categoryId === c.id)?.isAvailable ?? true,
        }))
    )
  }, [categories, branchCategories])

  /** Every active item resolved for the selected branch. */
  const resolvedItems: ResolvedItem[] = useMemo(() => {
    const scopedMappings = branchMenuItems
    const scopedCategories = branchCategories
    return menu
      .filter(m => m.isActive !== false)
      .map(item =>
        resolveItemForBranch({
          item,
          variants,
          branchMappings: scopedMappings,
          branchCategories: scopedCategories,
          now,
        })
      )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menu, variants, branchMenuItems, branchCategories, selectedBranch, nowKey])

  /** Soft-deleted items, for the Archive tab. */
  const archivedItems = useMemo(
    () => sortItems(menu.filter(m => m.isActive === false)),
    [menu]
  )

  const categoryName = useMemo(() => {
    const map = new Map(categories.map(c => [c.id, c.name]))
    return (id: string) => map.get(id) ?? 'Uncategorised'
  }, [categories])

  const filteredItems = useMemo(() => {
    const q = filters.search.trim().toLowerCase()

    let out = resolvedItems.filter(item => {
      if (filters.categoryIds.length > 0 && !filters.categoryIds.includes(item.categoryId)) return false
      if (filters.availability === 'available' && !item.isAvailable) return false
      if (filters.availability === 'unavailable' && item.isAvailable) return false
      if (filters.overriddenOnly && !item.isOverridden) return false
      if (filters.dietary.length > 0) {
        const tags = item.dietary ?? []
        if (!filters.dietary.every(d => tags.includes(d))) return false
      }
      if (q) {
        const haystack = `${item.name} ${categoryName(item.categoryId)} ${item.description ?? ''}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })

    if (filters.sort === 'name') out = [...out].sort((a, b) => a.name.localeCompare(b.name))
    else if (filters.sort === 'price-asc') out = [...out].sort((a, b) => a.price - b.price)
    else if (filters.sort === 'price-desc') out = [...out].sort((a, b) => b.price - a.price)
    else out = sortItems(out)

    return out
  }, [resolvedItems, filters, categoryName])

  /** Grouped by category, in category display order. */
  const groupedItems = useMemo(() => {
    const groups: { category: Category & { isAvailable: boolean }; items: ResolvedItem[] }[] = []
    for (const cat of enrichedCategories) {
      const items = filteredItems.filter(i => i.categoryId === cat.id)
      if (items.length > 0) groups.push({ category: cat, items })
    }
    // items whose category is missing/inactive still need somewhere to live
    const orphans = filteredItems.filter(i => !enrichedCategories.some(c => c.id === i.categoryId))
    if (orphans.length > 0) {
      groups.push({
        category: { id: '__orphan', name: 'Uncategorised', isAvailable: true },
        items: orphans,
      })
    }
    return groups
  }, [enrichedCategories, filteredItems])

  const counts = useMemo(() => ({
    total: resolvedItems.length,
    shown: filteredItems.length,
    available: resolvedItems.filter(i => i.isAvailable).length,
    overridden: resolvedItems.filter(i => i.isOverridden).length,
    archived: archivedItems.length,
  }), [resolvedItems, filteredItems, archivedItems])

  const resetFilters = () => setFilters(DEFAULT_FILTERS)

  return {
    filters,
    setFilters,
    resetFilters,
    // keep a thin search alias so callers can bind an input directly
    search: filters.search,
    setSearch: (search: string) => setFilters(f => ({ ...f, search })),
    resolvedItems,
    filteredItems,
    groupedItems,
    archivedItems,
    enrichedCategories,
    categoryName,
    counts,
  }
}

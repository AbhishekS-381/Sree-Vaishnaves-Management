import { useState, useMemo } from 'react'

export function useMenuFilters(initialMenu: any[], selectedBranch: string, categories: any[], branchMenuItems: any[], branchCategories: any[]) {
  const [search, setSearch] = useState('')

  const enrichedMenu = useMemo(() => {
    return initialMenu
      .filter(m => m.isActive !== false)
      .map(m => {
        const mapping = branchMenuItems.find((b: any) => b.menuItemId === m.id && b.branchId === selectedBranch)
        return {
          ...m,
          price: mapping?.price ?? m.basePrice ?? 0,
          isAvailable: mapping ? mapping.isAvailable : true
        }
      })
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
  }, [initialMenu, branchMenuItems, selectedBranch])

  const enrichedCategories = useMemo(() => {
    return categories
      .filter(c => c.isActive !== false)
      .map((c: any) => {
        const mapping = branchCategories.find((b: any) => b.categoryId === c.id && b.branchId === selectedBranch)
        return {
          ...c,
          isAvailable: mapping ? mapping.isAvailable : true
        }
      })
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
  }, [categories, branchCategories, selectedBranch])

  const filteredMenu = useMemo(() => {
    return enrichedMenu.filter(m => {
      const catName = categories.find((c: any) => c.id === m.categoryId)?.name || 'Unknown'
      if (search && !m.name.toLowerCase().includes(search.toLowerCase()) && !catName.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [enrichedMenu, search, categories])

  const groupedMenu = useMemo(() => {
    return filteredMenu.reduce((acc, curr) => {
      const catName = categories.find(c => c.id === curr.categoryId)?.name || 'Unknown'
      if (!acc[catName]) acc[catName] = []
      acc[catName].push(curr)
      return acc
    }, {} as Record<string, any[]>)
  }, [filteredMenu, categories])

  return { search, setSearch, filteredMenu, groupedMenu, enrichedCategories }
}

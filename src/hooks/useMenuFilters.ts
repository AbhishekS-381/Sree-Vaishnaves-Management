import { useState, useMemo } from 'react'

export function useMenuFilters(initialMenu: any[], selectedBranch: string, categories: any[]) {
  const [search, setSearch] = useState('')

  const filteredMenu = useMemo(() => {
    return initialMenu.filter(m => {
      if (m.branchId !== selectedBranch) return false
      
      const catName = categories.find(c => c.id === m.categoryId)?.name || 'Unknown'
      
      if (search && !m.name.toLowerCase().includes(search.toLowerCase()) && !catName.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [initialMenu, search, selectedBranch, categories])

  const groupedMenu = useMemo(() => {
    return filteredMenu.reduce((acc, curr) => {
      const catName = categories.find(c => c.id === curr.categoryId)?.name || 'Unknown'
      if (!acc[catName]) acc[catName] = []
      acc[catName].push(curr)
      return acc
    }, {} as Record<string, any[]>)
  }, [filteredMenu, categories])

  return { search, setSearch, filteredMenu, groupedMenu }
}

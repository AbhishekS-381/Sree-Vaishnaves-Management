import { useState, useMemo } from 'react'

export function useMenuFilters(initialMenu: any[], selectedBranch: string) {
  const [search, setSearch] = useState('')

  const filteredMenu = useMemo(() => {
    return initialMenu.filter(m => {
      if (m.branchId !== selectedBranch) return false
      if (search && !m.name.toLowerCase().includes(search.toLowerCase()) && !m.category.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [initialMenu, search, selectedBranch])

  const groupedMenu = useMemo(() => {
    return filteredMenu.reduce((acc, curr) => {
      if (!acc[curr.category]) acc[curr.category] = []
      acc[curr.category].push(curr)
      return acc
    }, {} as Record<string, any[]>)
  }, [filteredMenu])

  return { search, setSearch, filteredMenu, groupedMenu }
}

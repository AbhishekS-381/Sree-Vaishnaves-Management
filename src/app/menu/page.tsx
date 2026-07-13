import { readJSON, DB_FILES } from '@/lib/db'
import MenuClientPage from './MenuClientPage'
import { getSession } from '@/app/actions/auth'

export default async function MenuPage() {
  const session = await getSession();
  let branches = await readJSON<any>(DB_FILES.BRANCHES)
  let menu = await readJSON<any>(DB_FILES.MENU)
  const categories = await readJSON<any>(DB_FILES.MENU_CATEGORIES).catch(() => [])
  
  let branchMenuItems = await readJSON<any>(DB_FILES.BRANCH_MENU_ITEMS).catch(() => [])
  let branchCategories = await readJSON<any>(DB_FILES.BRANCH_CATEGORIES).catch(() => [])

  if (!session?.isGlobalAdmin && session?.role !== 'readonly') {
    branches = branches.filter((b: any) => b.id === session?.branchId)
    // For local users, we only send mappings for their branch.
    // The menu items and categories remain global, but the UI will only show what's mapped or allow viewing them.
    branchMenuItems = branchMenuItems.filter((m: any) => m.branchId === session?.branchId)
    branchCategories = branchCategories.filter((c: any) => c.branchId === session?.branchId)
  }

  branches = branches.filter((b: any) => b.isActive !== false)

  return (
    <MenuClientPage 
      branches={branches} 
      initialMenu={menu} 
      categories={categories} 
      branchMenuItems={branchMenuItems}
      branchCategories={branchCategories}
      userRole={session?.role || ''}
      isGlobalAdmin={session?.isGlobalAdmin || false}
    />
  )
}

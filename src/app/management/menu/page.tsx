import { readJSON, readBranchMenuItems, DB_FILES } from '@/lib/db'
import MenuClientPage from './MenuClientPage'
import { getSession } from '@/app/actions/auth'

export default async function MenuPage() {
  const session = await getSession()

  const [allBranches, menu, categories, variants, branchCategoriesAll] = await Promise.all([
    readJSON<any>(DB_FILES.BRANCHES),
    readJSON<any>(DB_FILES.MENU),
    readJSON<any>(DB_FILES.MENU_CATEGORIES).catch(() => []),
    readJSON<any>(DB_FILES.MENU_ITEM_VARIANTS).catch(() => []),
    readJSON<any>(DB_FILES.BRANCH_CATEGORIES).catch(() => []),
  ])

  const isGlobalAdmin = Boolean(session?.isGlobalAdmin)
  const isReadonly = session?.role === 'readonly'

  // Managers are confined to their own branch; admins/owners/analysts see all.
  let branches = allBranches.filter((b: any) => b.isActive !== false)
  if (!isGlobalAdmin && !isReadonly && session?.branchId) {
    branches = branches.filter((b: any) => b.id === session.branchId)
  }

  // Read only the shards we actually need (one per in-scope branch), instead of
  // the whole item × branch cross-product.
  const shards = await Promise.all(
    branches.map((b: any) => readBranchMenuItems<any>(b.id).catch(() => []))
  )
  const branchMenuItems = shards.flat()

  const inScope = new Set(branches.map((b: any) => b.id))
  const branchCategories = branchCategoriesAll.filter((c: any) => inScope.has(c.branchId))

  return (
    <MenuClientPage
      branches={branches}
      initialMenu={menu}
      categories={categories}
      variants={variants}
      branchMenuItems={branchMenuItems}
      branchCategories={branchCategories}
      userRole={session?.role || ''}
      isGlobalAdmin={isGlobalAdmin}
    />
  )
}

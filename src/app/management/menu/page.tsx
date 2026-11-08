import {
  db,
  branches as branchesTable,
  menuItems as menuItemsTable,
  menuCategories as menuCategoriesTable,
  menuItemVariants as menuItemVariantsTable,
  branchCategories as branchCategoriesTable,
  branchMenuItems as branchMenuItemsTable,
} from '@/lib/db'
import { eq, and, isNull, inArray } from 'drizzle-orm'
import MenuClientPage from './MenuClientPage'
import { getSession } from '@/app/actions/auth'

export default async function MenuPage() {
  const session = await getSession()

  const [allBranches, menu, categories, variants, branchCategoriesAll] = await Promise.all([
    db.select().from(branchesTable).where(and(eq(branchesTable.isActive, true), isNull(branchesTable.deletedAt))).catch(() => []),
    db.select().from(menuItemsTable).where(isNull(menuItemsTable.deletedAt)).catch(() => []),
    db.select().from(menuCategoriesTable).where(isNull(menuCategoriesTable.deletedAt)).catch(() => []),
    db.select().from(menuItemVariantsTable).catch(() => []),
    db.select().from(branchCategoriesTable).catch(() => []),
  ])

  const isGlobalAdmin = Boolean(session?.isGlobalAdmin)
  const isReadonly = session?.role === 'readonly'

  let branches = allBranches
  if (!isGlobalAdmin && !isReadonly && session?.branchId) {
    branches = branches.filter((b: any) => b.id === session.branchId)
  }

  const inScopeBranchIds = branches.map((b: any) => b.id)
  let branchMenuItems: any[] = []
  if (inScopeBranchIds.length > 0) {
    branchMenuItems = await db
      .select()
      .from(branchMenuItemsTable)
      .where(inArray(branchMenuItemsTable.branchId, inScopeBranchIds))
      .catch(() => [])
  }

  const inScope = new Set(inScopeBranchIds)
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

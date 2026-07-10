import { readJSON, DB_FILES } from '@/lib/db'
import MenuClientPage from './MenuClientPage'
import { getSession } from '@/app/actions/auth'

export default async function MenuPage() {
  const session = await getSession();
  let branches = await readJSON<any>(DB_FILES.BRANCHES)
  let menu = await readJSON<any>(DB_FILES.MENU)
  const categories = await readJSON<any>(DB_FILES.MENU_CATEGORIES).catch(() => [])

  if (!session?.isGlobalAdmin && session?.role !== 'readonly') {
    branches = branches.filter((b: any) => b.id === session?.branchId)
    menu = menu.filter((m: any) => m.branchId === session?.branchId)
  }

  branches = branches.filter((b: any) => b.isActive !== false)

  return (
    <MenuClientPage branches={branches} initialMenu={menu} categories={categories} />
  )
}

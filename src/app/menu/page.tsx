import { readJSON, DB_FILES } from '@/lib/db'
import MenuClientPage from './MenuClientPage'

export default async function MenuPage() {
  const branches = await readJSON<any>(DB_FILES.BRANCHES)
  const menu = await readJSON<any>(DB_FILES.MENU)
  const categories = await readJSON<any>(DB_FILES.MENU_CATEGORIES).catch(() => [])

  return (
    <MenuClientPage branches={branches} initialMenu={menu} categories={categories} />
  )
}

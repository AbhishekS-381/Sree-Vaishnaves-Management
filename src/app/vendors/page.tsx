import { readJSON, DB_FILES } from '@/lib/db'
import VendorsClientPage from './VendorsClientPage'

export default async function VendorsPage() {
  const branches = await readJSON<any>(DB_FILES.BRANCHES)
  const vendors = await readJSON<any>(DB_FILES.VENDORS).catch(() => [])
  const expenses = await readJSON<any>(DB_FILES.EXPENSES).catch(() => [])
  const categories = await readJSON<any>(DB_FILES.CATEGORIES).catch(() => [])

  return (
    <VendorsClientPage branches={branches} vendors={vendors} expenses={expenses} categories={categories} />
  )
}

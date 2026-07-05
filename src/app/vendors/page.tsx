import { readJSON, DB_FILES } from '@/lib/db'
import VendorsClientPage from './VendorsClientPage'
import { getSession } from '@/app/actions/auth'

export default async function VendorsPage() {
  const session = await getSession();
  let branches = await readJSON<any>(DB_FILES.BRANCHES)
  let vendors = await readJSON<any>(DB_FILES.VENDORS).catch(() => [])
  let expenses = await readJSON<any>(DB_FILES.EXPENSES).catch(() => [])
  const categories = await readJSON<any>(DB_FILES.CATEGORIES).catch(() => [])

  if (!session?.isGlobalAdmin) {
    branches = branches.filter((b: any) => b.id === session?.branchId)
    vendors = vendors.filter((v: any) => v.branchId === session?.branchId)
    expenses = expenses.filter((e: any) => e.branchId === session?.branchId)
  }

  branches = branches.filter((b: any) => b.isActive !== false)

  return (
    <VendorsClientPage branches={branches} vendors={vendors} expenses={expenses} categories={categories} />
  )
}

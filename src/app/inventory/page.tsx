import { readJSON, DB_FILES } from '@/lib/db'
import InventoryClientPage from './InventoryClientPage'
import { getSession } from '@/app/actions/auth'

export default async function InventoryPage() {
  const session = await getSession();
  let branches = await readJSON<any>(DB_FILES.BRANCHES)
  let items = await readJSON<any>(DB_FILES.INVENTORY).catch(() => [])

  if (!session?.isGlobalOwner && session?.role !== 'readonly') {
    branches = branches.filter((b: any) => b.id === session?.branchId)
    items = items.filter((i: any) => i.branchId === session?.branchId)
  }

  return (
    <InventoryClientPage branches={branches} inventory={items} />
  )
}

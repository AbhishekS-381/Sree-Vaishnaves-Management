import { readJSON, DB_FILES } from '@/lib/db'
import InventoryClientPage from './InventoryClientPage'

export default async function InventoryPage() {
  const branches = await readJSON<any>(DB_FILES.BRANCHES)
  const items = await readJSON<any>(DB_FILES.INVENTORY).catch(() => [])

  return (
    <InventoryClientPage branches={branches} inventory={items} />
  )
}

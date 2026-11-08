import {
  db,
  branches as branchesTable,
  inventory as inventoryTable,
} from '@/lib/db'
import { eq, and, isNull } from 'drizzle-orm'
import InventoryClientPage from './InventoryClientPage'
import { getSession } from '@/app/actions/auth'

export default async function InventoryPage() {
  const session = await getSession()
  const isGlobal = session?.isGlobalAdmin || session?.role === 'readonly'
  const branchId = session?.branchId

  const [branches, items] = await Promise.all([
    db
      .select()
      .from(branchesTable)
      .where(
        and(
          !isGlobal && branchId ? eq(branchesTable.id, branchId) : undefined,
          eq(branchesTable.isActive, true),
          isNull(branchesTable.deletedAt)
        )
      )
      .catch(() => []),
    (!isGlobal && branchId
      ? db.select().from(inventoryTable).where(eq(inventoryTable.branchId, branchId))
      : db.select().from(inventoryTable)
    ).catch(() => []),
  ])

  return (
    <InventoryClientPage branches={branches} inventory={items} />
  )
}

import { db, branches as branchesTable } from '@/lib/db'
import BranchesClientPage from './BranchesClientPage'
import { getSession } from '@/app/actions/auth'
import { eq, and, isNull } from 'drizzle-orm'

export default async function BranchesPage() {
  const session = await getSession()
  const isReadOnly = session?.role === 'readonly' || session?.role === 'manager'

  let query = db
    .select()
    .from(branchesTable)
    .where(and(eq(branchesTable.isActive, true), isNull(branchesTable.deletedAt)))

  if (!session?.isGlobalAdmin && session?.role !== 'readonly' && session?.branchId) {
    query = db
      .select()
      .from(branchesTable)
      .where(
        and(
          eq(branchesTable.id, session.branchId),
          eq(branchesTable.isActive, true),
          isNull(branchesTable.deletedAt)
        )
      )
  }

  const branchesRaw = await query.catch(() => [])
  const branches = branchesRaw.map((b: any) => ({
    id: b.id,
    name: b.name,
    address: b.address || '',
    phone: b.phone || '',
    status: b.status || undefined,
    gstin: b.gstin || undefined,
    internalStartTime: b.internalStartTime || undefined,
    internalEndTime: b.internalEndTime || undefined,
    customerStartTime: b.customerStartTime || undefined,
    customerEndTime: b.customerEndTime || undefined,
  }))

  return <BranchesClientPage branches={branches} isReadOnly={isReadOnly} />
}

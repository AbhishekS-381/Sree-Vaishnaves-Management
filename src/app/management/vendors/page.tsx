import {
  db,
  branches as branchesTable,
  vendors as vendorsTable,
  expenses as expensesTable,
  categories as categoriesTable,
} from '@/lib/db'
import { eq, and, isNull } from 'drizzle-orm'
import VendorsClientPage from './VendorsClientPage'
import { getSession } from '@/app/actions/auth'

export default async function VendorsPage() {
  const session = await getSession()
  const isGlobal = session?.isGlobalAdmin || session?.role === 'readonly'
  const branchId = session?.branchId

  const isScoped = !isGlobal && Boolean(branchId)

  const [branches, vendors, expenses, categories] = await Promise.all([
    (isScoped
      ? db
          .select()
          .from(branchesTable)
          .where(and(eq(branchesTable.id, branchId!), eq(branchesTable.isActive, true), isNull(branchesTable.deletedAt)))
      : db
          .select()
          .from(branchesTable)
          .where(and(eq(branchesTable.isActive, true), isNull(branchesTable.deletedAt)))
    ).catch(() => []),
    (isScoped
      ? db.select().from(vendorsTable).where(eq(vendorsTable.branchId, branchId!))
      : db.select().from(vendorsTable)
    ).catch(() => []),
    (isScoped
      ? db.select().from(expensesTable).where(eq(expensesTable.branchId, branchId!))
      : db.select().from(expensesTable)
    ).catch(() => []),
    db.select().from(categoriesTable).catch(() => []),
  ])

  return (
    <VendorsClientPage branches={branches} vendors={vendors} expenses={expenses} categories={categories} />
  )
}

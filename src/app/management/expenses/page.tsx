import {
  db,
  branches as branchesTable,
  expenses as expensesTable,
  categories as categoriesTable,
} from '@/lib/db'
import { eq, and, isNull } from 'drizzle-orm'
import { getSession } from '@/app/actions/auth'
import ExpensesClientPage from './ExpensesClientPage'

export default async function ExpensesPage() {
  const session = await getSession()
  const userRole = session?.role
  const isGlobal = session?.isGlobalAdmin || session?.role === 'readonly'
  const branchId = session?.branchId

  const [branches, expenses, categories] = await Promise.all([
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
      ? db.select().from(expensesTable).where(eq(expensesTable.branchId, branchId))
      : db.select().from(expensesTable)
    ).catch(() => []),
    db.select().from(categoriesTable).catch(() => []),
  ])

  return (
    <ExpensesClientPage
      branches={branches}
      expenses={expenses}
      categories={categories}
      userRole={userRole || ''}
      isGlobalAdmin={session?.isGlobalAdmin ?? false}
      isReadOnly={session?.role === 'readonly'}
    />
  )
}

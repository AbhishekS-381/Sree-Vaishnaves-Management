import { readJSON, DB_FILES } from '@/lib/db'
import { getSessionRole, getSession } from '@/app/actions/auth'
import ExpensesClientPage from './ExpensesClientPage'

export default async function ExpensesPage() {
  let branches = await readJSON<any>(DB_FILES.BRANCHES)
  let expenses = await readJSON<any>(DB_FILES.EXPENSES)
  const session = await getSession()
  const userRole = session?.role

  if (!session?.isGlobalAdmin && session?.role !== 'readonly') {
    branches = branches.filter((b: any) => b.id === session?.branchId)
    expenses = expenses.filter((e: any) => e.branchId === session?.branchId)
  }

  branches = branches.filter((b: any) => b.isActive !== false)
  const categories = await readJSON<any>(DB_FILES.CATEGORIES).catch(() => [])

  return (
    <ExpensesClientPage branches={branches} expenses={expenses} categories={categories} userRole={userRole || ''} isGlobalAdmin={session?.isGlobalAdmin ?? false} isReadOnly={session?.role === 'readonly'} />
  )
}

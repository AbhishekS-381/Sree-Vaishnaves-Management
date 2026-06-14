import { readJSON, DB_FILES } from '@/lib/db'
import { getSessionRole } from '@/app/actions/auth'
import ExpensesClientPage from './ExpensesClientPage'

export default async function ExpensesPage() {
  const branches = await readJSON<any>(DB_FILES.BRANCHES)
  const expenses = await readJSON<any>(DB_FILES.EXPENSES)
  const userRole = await getSessionRole()

  return (
    <ExpensesClientPage branches={branches} expenses={expenses} userRole={userRole || ''} />
  )
}

import { readJSON, DB_FILES } from '@/lib/db'
import BranchesClientPage from './BranchesClientPage'
import { getSession } from '@/app/actions/auth'
import { redirect } from 'next/navigation'

export default async function BranchesPage() {
  const session = await getSession()
  const isReadOnly = session?.role === 'readonly' || session?.role === 'manager'
  let branches = await readJSON<any>(DB_FILES.BRANCHES)

  if (!session?.isGlobalAdmin && session?.role !== 'readonly') {
    branches = branches.filter((b: any) => b.id === session?.branchId)
  }

  branches = branches.filter((b: any) => b.isActive !== false)
  return <BranchesClientPage branches={branches} isReadOnly={isReadOnly} />
}

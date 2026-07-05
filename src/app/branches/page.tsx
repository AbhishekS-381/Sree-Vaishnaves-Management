import { readJSON, DB_FILES } from '@/lib/db'
import BranchesClientPage from './BranchesClientPage'
import { getSessionRole } from '@/app/actions/auth'
import { redirect } from 'next/navigation'

export default async function BranchesPage() {
  const sessionRole = await getSessionRole()
  if (sessionRole !== 'owner' && sessionRole !== 'admin') {
    redirect('/')
  }
  let branches = await readJSON<any>(DB_FILES.BRANCHES)
  branches = branches.filter((b: any) => b.isActive !== false)
  // Ensure we sort or prep data if needed, but for now direct pass
  return <BranchesClientPage branches={branches} />
}

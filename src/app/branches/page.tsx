import { readJSON, DB_FILES } from '@/lib/db'
import BranchesClientPage from './BranchesClientPage'

export default async function BranchesPage() {
  const branches = await readJSON<any>(DB_FILES.BRANCHES)
  // Ensure we sort or prep data if needed, but for now direct pass
  return <BranchesClientPage branches={branches} />
}

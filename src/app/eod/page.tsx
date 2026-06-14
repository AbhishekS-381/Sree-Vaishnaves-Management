import { readJSON, DB_FILES } from '@/lib/db'
import EODClientPage from './EODClientPage'

export default async function EODPage() {
  const branches = await readJSON<any>(DB_FILES.BRANCHES)
  const categories = await readJSON<any>(DB_FILES.CATEGORIES).catch(() => [])

  return (
    <EODClientPage branches={branches} categories={categories} />
  )
}

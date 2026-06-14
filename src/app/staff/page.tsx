import { readJSON, DB_FILES } from '@/lib/db'
import StaffClientPage from './StaffClientPage'

export default async function StaffPage() {
  const staff = await readJSON<any>(DB_FILES.STAFF)
  const roles = await readJSON<any>(DB_FILES.ROLES)
  const depts = await readJSON<any>(DB_FILES.DEPARTMENTS)
  const branches = await readJSON<any>(DB_FILES.BRANCHES)
  const requirements = await readJSON<any>(DB_FILES.STAFF_REQUIREMENTS)
  const menuCategories = await readJSON<any>(DB_FILES.MENU_CATEGORIES).catch(() => [])

  return (
    <StaffClientPage
      initialStaff={staff}
      branches={branches}
      departments={depts}
      roles={roles}
      requirements={requirements}
      menuCategories={menuCategories}
    />
  )
}

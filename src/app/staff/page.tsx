import { readJSON, DB_FILES } from '@/lib/db'
import StaffClientPage from './StaffClientPage'

export default async function StaffPage() {
  const [staff, roles, depts, branches, requirements, menuCategories] = await Promise.all([
    readJSON<any>(DB_FILES.STAFF),
    readJSON<any>(DB_FILES.ROLES),
    readJSON<any>(DB_FILES.DEPARTMENTS),
    readJSON<any>(DB_FILES.BRANCHES),
    readJSON<any>(DB_FILES.STAFF_REQUIREMENTS),
    readJSON<any>(DB_FILES.MENU_CATEGORIES).catch(() => [])
  ]);

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

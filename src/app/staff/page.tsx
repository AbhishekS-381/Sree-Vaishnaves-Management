import { readJSON, DB_FILES } from '@/lib/db'
import StaffClientPage from './StaffClientPage'
import { getSession } from '@/app/actions/auth'

export default async function StaffPage() {
  const session = await getSession();
  let [staff, roles, depts, branches, requirements, menuCategories] = await Promise.all([
    readJSON<any>(DB_FILES.STAFF),
    readJSON<any>(DB_FILES.ROLES),
    readJSON<any>(DB_FILES.DEPARTMENTS),
    readJSON<any>(DB_FILES.BRANCHES),
    readJSON<any>(DB_FILES.STAFF_REQUIREMENTS),
    readJSON<any>(DB_FILES.MENU_CATEGORIES).catch(() => [])
  ]);

  if (!session?.isGlobalOwner) {
    staff = staff.filter((s: any) => s.branchId === session?.branchId)
    requirements = requirements.filter((r: any) => r.branchId === session?.branchId)
  }

  staff = staff.filter((s: any) => s.isActive !== false)
  requirements = requirements.filter((r: any) => r.isActive !== false)

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

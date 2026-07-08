import { readJSON, DB_FILES } from '@/lib/db'
import { getSessionRole, getSession } from '@/app/actions/auth'
import AttendanceClientPage from './AttendanceClientPage'

export default async function AttendancePage() {
  const session = await getSession();
  let [[staff, branches, roles], userRole] = await Promise.all([
    Promise.all([
      readJSON<any>(DB_FILES.STAFF),
      readJSON<any>(DB_FILES.BRANCHES),
      readJSON<any>(DB_FILES.ROLES)
    ]),
    getSessionRole()
  ]);

  if (!session?.isGlobalOwner) {
    staff = staff.filter((s: any) => s.branchId === session?.branchId)
    branches = branches.filter((b: any) => b.id === session?.branchId)
  }

  staff = staff.filter((s: any) => s.isActive !== false)
  branches = branches.filter((b: any) => b.isActive !== false)
  roles = roles.filter((r: any) => r.isActive !== false)

  return (
    <AttendanceClientPage
      staff={staff}
      branches={branches}
      roles={roles}
      userRole={userRole || ''}
    />
  )
}

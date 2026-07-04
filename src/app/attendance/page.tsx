import { readJSON, DB_FILES } from '@/lib/db'
import { getSessionRole } from '@/app/actions/auth'
import AttendanceClientPage from './AttendanceClientPage'

export default async function AttendancePage() {
  const [[staff, branches, roles], userRole] = await Promise.all([
    Promise.all([
      readJSON<any>(DB_FILES.STAFF),
      readJSON<any>(DB_FILES.BRANCHES),
      readJSON<any>(DB_FILES.ROLES)
    ]),
    getSessionRole()
  ]);

  return (
    <AttendanceClientPage
      staff={staff}
      branches={branches}
      roles={roles}
      userRole={userRole || ''}
    />
  )
}

import { readJSON, DB_FILES } from '@/lib/db'
import { getSessionRole } from '@/app/actions/auth'
import AttendanceClientPage from './AttendanceClientPage'

export default async function AttendancePage() {
  const staff = await readJSON<any>(DB_FILES.STAFF)
  const branches = await readJSON<any>(DB_FILES.BRANCHES)
  const roles = await readJSON<any>(DB_FILES.ROLES)
  const userRole = await getSessionRole()

  return (
    <AttendanceClientPage
      staff={staff}
      branches={branches}
      roles={roles}
      userRole={userRole || ''}
    />
  )
}

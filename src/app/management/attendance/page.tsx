import {
  db,
  staff as staffTable,
  branches as branchesTable,
  roles as rolesTable,
} from '@/lib/db'
import { getSessionRole, getSession } from '@/app/actions/auth'
import AttendanceClientPage from './AttendanceClientPage'
import { eq, and, isNull } from 'drizzle-orm'

export default async function AttendancePage() {
  const session = await getSession()
  const isGlobal = session?.isGlobalAdmin || session?.role === 'readonly'
  const branchId = session?.branchId

  let staffQuery = db
    .select()
    .from(staffTable)
    .where(and(eq(staffTable.isActive, true), isNull(staffTable.deletedAt)))

  let branchesQuery = db
    .select()
    .from(branchesTable)
    .where(and(eq(branchesTable.isActive, true), isNull(branchesTable.deletedAt)))

  if (!isGlobal && branchId) {
    staffQuery = db
      .select()
      .from(staffTable)
      .where(and(eq(staffTable.branchId, branchId), eq(staffTable.isActive, true), isNull(staffTable.deletedAt)))

    branchesQuery = db
      .select()
      .from(branchesTable)
      .where(and(eq(branchesTable.id, branchId), eq(branchesTable.isActive, true), isNull(branchesTable.deletedAt)))
  }

  const [staff, branches, roles, userRole] = await Promise.all([
    staffQuery.catch(() => []),
    branchesQuery.catch(() => []),
    db.select().from(rolesTable).where(eq(rolesTable.isActive, true)).catch(() => []),
    getSessionRole(),
  ])

  return (
    <AttendanceClientPage
      staff={staff}
      branches={branches}
      roles={roles}
      userRole={userRole || ''}
    />
  )
}

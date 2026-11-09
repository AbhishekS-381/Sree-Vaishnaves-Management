import {
  db,
  staff as staffTable,
  roles as rolesTable,
  departments as departmentsTable,
  branches as branchesTable,
  staffRequirements as staffRequirementsTable,
  menuCategories as menuCategoriesTable,
} from '@/lib/db'
import { eq, and, isNull } from 'drizzle-orm'
import StaffClientPage from './StaffClientPage'
import { getSession } from '@/app/actions/auth'

export default async function StaffPage() {
  const session = await getSession()
  const isGlobal = session?.isGlobalAdmin || session?.role === 'readonly'
  const branchId = session?.branchId

  let staffQuery = db
    .select()
    .from(staffTable)
    .where(isNull(staffTable.deletedAt))

  let requirementsQuery = db
    .select()
    .from(staffRequirementsTable)
    .where(eq(staffRequirementsTable.isActive, true))

  if (!isGlobal && branchId) {
    staffQuery = db
      .select()
      .from(staffTable)
      .where(and(eq(staffTable.branchId, branchId), isNull(staffTable.deletedAt)))

    requirementsQuery = db
      .select()
      .from(staffRequirementsTable)
      .where(and(eq(staffRequirementsTable.branchId, branchId), eq(staffRequirementsTable.isActive, true)))
  }

  const [staffRaw, roles, depts, branches, requirements, menuCategories] = await Promise.all([
    staffQuery.catch(() => []),
    db.select().from(rolesTable).where(eq(rolesTable.isActive, true)).catch(() => []),
    db.select().from(departmentsTable).where(eq(departmentsTable.isActive, true)).catch(() => []),
    db.select().from(branchesTable).where(and(eq(branchesTable.isActive, true), isNull(branchesTable.deletedAt))).catch(() => []),
    requirementsQuery.catch(() => []),
    db.select().from(menuCategoriesTable).where(isNull(menuCategoriesTable.deletedAt)).catch(() => []),
  ])

  const staff = staffRaw.map((s: any) => ({ ...s, isActive: s.isActive !== false }))

  return (
    <StaffClientPage
      initialStaff={staff}
      branches={branches}
      departments={depts}
      roles={roles}
      requirements={requirements}
      menuCategories={menuCategories}
      isReadOnly={session?.role === 'readonly'}
    />
  )
}

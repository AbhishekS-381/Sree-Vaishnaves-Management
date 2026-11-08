import {
  db,
  roles as rolesTable,
  departments as departmentsTable,
  categories as categoriesTable,
  users as usersTable,
  branches as branchesTable,
  config as configTable,
} from '@/lib/db'
import { eq, and, isNull } from 'drizzle-orm'
import SettingsClientPage from './SettingsClientPage'
import { getSession } from '@/app/actions/auth'
import { redirect } from 'next/navigation'

export default async function SettingsPage() {
  const session = await getSession()
  if (session?.role !== 'admin') {
    redirect('/management')
  }

  const [roles, depts, categories, rawUsers, branches, configList] = await Promise.all([
    db.select().from(rolesTable).where(eq(rolesTable.isActive, true)).catch(() => []),
    db.select().from(departmentsTable).where(eq(departmentsTable.isActive, true)).catch(() => []),
    db.select().from(categoriesTable).catch(() => []),
    db.select().from(usersTable).where(eq(usersTable.isActive, true)).catch(() => []),
    db.select().from(branchesTable).where(and(eq(branchesTable.isActive, true), isNull(branchesTable.deletedAt))).catch(() => []),
    db.select().from(configTable).limit(1).catch(() => []),
  ])

  // Sanitize users to avoid leaking passwords to the client
  const users = rawUsers
    .filter((u: any) => u.isActive !== false)
    .map(({ password, ...u }: any) => u)
  
  const config = configList[0] || {
    attendance: true,
    payroll: true,
    vendors: true,
    inventory: true,
    menu: true,
    reports: true,
    pos: false,
    posDefaultGstPercent: 0,
    posDefaultParcelPercent: 0,
    posDefaultAcPercent: 0,
    posPricingMode: 'percentage',
  }

  return (
    <SettingsClientPage
      roles={roles}
      departments={depts}
      categories={categories}
      config={config}
      users={users}
      sessionRole={session.role as string}
      branches={branches}
    />
  )
}

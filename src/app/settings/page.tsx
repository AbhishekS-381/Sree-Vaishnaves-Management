import { readJSON, DB_FILES } from '@/lib/db'
import SettingsClientPage from './SettingsClientPage'
import { getSessionRole } from '@/app/actions/auth'
import { redirect } from 'next/navigation'

export default async function SettingsPage() {
  const sessionRole = await getSessionRole()
  if (sessionRole !== 'owner' && sessionRole !== 'admin') {
    redirect('/')
  }

  let [[roles, depts, categories, rawUsers], configList] = await Promise.all([
    Promise.all([
      readJSON<any>(DB_FILES.ROLES),
      readJSON<any>(DB_FILES.DEPARTMENTS),
      readJSON<any>(DB_FILES.CATEGORIES).catch(() => []),
      readJSON<any>(DB_FILES.USERS).catch(() => [])
    ]),
    readJSON<any>(DB_FILES.CONFIG).catch(() => [])
  ]);

  roles = roles.filter((r: any) => r.isActive !== false)
  depts = depts.filter((d: any) => d.isActive !== false)

  // Sanitize users to avoid leaking passwords to the client
  const users = rawUsers
    .filter((u: any) => u.isActive !== false)
    .map(({ password, ...u }: any) => u)
  
  let config = configList[0] || {
    attendance: true,
    payroll: true,
    vendors: true,
    inventory: true,
    menu: true,
    reports: true
  }


  return (
    <SettingsClientPage roles={roles} departments={depts} categories={categories} config={config} users={users} sessionRole={sessionRole as string} />
  )
}

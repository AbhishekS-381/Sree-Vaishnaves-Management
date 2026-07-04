import { readJSON, DB_FILES } from '@/lib/db'
import SettingsClientPage from './SettingsClientPage'
import { getSessionRole } from '@/app/actions/auth'

export default async function SettingsPage() {
  let [[roles, depts, categories, rawUsers], configList] = await Promise.all([
    Promise.all([
      readJSON<any>(DB_FILES.ROLES),
      readJSON<any>(DB_FILES.DEPARTMENTS),
      readJSON<any>(DB_FILES.CATEGORIES).catch(() => []),
      readJSON<any>(DB_FILES.USERS).catch(() => [])
    ]),
    readJSON<any>(DB_FILES.CONFIG).catch(() => [])
  ]);

  // Sanitize users to avoid leaking passwords to the client
  const users = rawUsers.map(({ password, ...u }: any) => u)
  
  let config = configList[0] || {
    attendance: true,
    payroll: true,
    vendors: true,
    inventory: true,
    menu: true,
    reports: true
  }

  const sessionRole = await getSessionRole()

  return (
    <SettingsClientPage roles={roles} departments={depts} categories={categories} config={config} users={users} sessionRole={sessionRole as string} />
  )
}

import { readJSON, DB_FILES } from '@/lib/db'
import SettingsClientPage from './SettingsClientPage'
import { cookies } from 'next/headers'

export default async function SettingsPage() {
  const roles = await readJSON<any>(DB_FILES.ROLES)
  const depts = await readJSON<any>(DB_FILES.DEPARTMENTS)
  const categories = await readJSON<any>(DB_FILES.CATEGORIES).catch(() => [])
  const users = await readJSON<any>(DB_FILES.USERS).catch(() => [])
  
  let configList = await readJSON<any>(DB_FILES.CONFIG).catch(() => [])
  let config = configList[0] || {
    attendance: true,
    payroll: true,
    vendors: true,
    inventory: true,
    menu: true,
    reports: true
  }

  const sessionRole = (await cookies()).get('session_role')?.value

  return (
    <SettingsClientPage roles={roles} departments={depts} categories={categories} config={config} users={users} sessionRole={sessionRole} />
  )
}

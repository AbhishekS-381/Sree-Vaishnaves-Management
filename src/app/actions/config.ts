'use server'

import { readJSON, writeJSON, DB_FILES } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { getSession } from '@/app/actions/auth'

export type Config = {
  id: string
  attendance: boolean
  payroll: boolean
  vendors: boolean
  inventory: boolean
  menu: boolean
  reports: boolean
}

export async function toggleModule(moduleId: keyof Config, isActive: boolean) {
  const session = await getSession();
  if (session?.role !== 'admin') {
    return { error: 'Forbidden: Only admin can toggle modules' };
  }

  let configList = await readJSON<Config>(DB_FILES.CONFIG).catch(() => [])

  if (configList.length === 0) {
    configList = [{
      id: 'global',
      attendance: true,
      payroll: true,
      vendors: true,
      inventory: true,
      menu: true,
      reports: true
    }]
  }

  const globalConfig = configList[0]
  if (moduleId !== 'id') {
     globalConfig[moduleId] = isActive
  }
  
  configList[0] = globalConfig

  await writeJSON(DB_FILES.CONFIG, configList)
  revalidatePath('/', 'layout')
  
  return { success: true }
}

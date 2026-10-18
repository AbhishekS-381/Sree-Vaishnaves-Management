'use server'

import { z } from 'zod'
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
  pos: boolean
  posDefaultGstPercent?: number
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
      reports: true,
      pos: false
    }]
  }

  const globalConfig = configList[0]
  if (moduleId !== 'id' && moduleId !== 'posDefaultGstPercent') {
     (globalConfig as Record<string, unknown>)[moduleId] = isActive
  }
  
  configList[0] = globalConfig

  await writeJSON(DB_FILES.CONFIG, configList)
  revalidatePath('/management', 'layout')
  
  return { success: true }
}

export async function updatePosGstRate(prevState: unknown, formData: FormData) {
  const session = await getSession()
  if (!session || (session.role !== 'admin' && !session.isRootAdmin)) {
    return { error: 'Forbidden' }
  }

  const rateRaw = formData.get('posDefaultGstPercent')
  const rate = Number(rateRaw)
  const parsed = z.number().int().min(0).max(28).safeParse(rate)
  if (!parsed.success) {
    return { error: 'Invalid GST rate. Must be an integer between 0 and 28.' }
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
      reports: true,
      pos: false
    }]
  }

  configList[0].posDefaultGstPercent = parsed.data
  await writeJSON(DB_FILES.CONFIG, configList)
  revalidatePath('/management/settings')

  return { success: true }
}

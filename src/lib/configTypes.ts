export const GLOBAL_CONFIG_ID = '00000000-0000-0000-0000-000000000001'

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
  posDefaultParcelPercent?: number
  posDefaultAcPercent?: number
  posPricingMode?: 'percentage' | 'item_price'
}


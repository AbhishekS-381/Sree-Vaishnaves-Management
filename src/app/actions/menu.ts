'use server'

import {
  withTransaction,
  readJSON,
  writeJSON,
  DB_FILES,
  readBranchMenuItems,
  withBranchMenuTransaction,
} from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { randomUUID } from 'crypto'
import { getSession, requireBranchAccess } from './auth'
import { logAction } from '@/lib/audit'
import { applyPriceChange, resolveEffectiveBasePrice } from '@/lib/menuResolver'
import { z } from 'zod'

// ── types ────────────────────────────────────────────────────────────────────

export type AvailabilityWindow = {
  days?: number[]
  startTime?: string
  endTime?: string
}

export type MenuItem = {
  id: string
  name: string
  categoryId: string
  basePrice: number
  sortOrder: number
  isActive: boolean
  createdAt: string
  updatedAt: string
  // optional metadata (Menu v2)
  description?: string
  imageUrl?: string
  costPrice?: number
  dietary?: string[]
  spiceLevel?: number
  allergens?: string[]
  isSignature?: boolean
  prepTimeMins?: number
  availability?: AvailabilityWindow
  deletedAt?: string
}

export type BranchMenuItem = {
  id: string
  branchId: string
  menuItemId: string
  variantId?: string
  price: number | null
  isAvailable: boolean
}

export type MenuItemVariant = {
  id: string
  menuItemId: string
  name: string
  basePrice: number
  sortOrder: number
  isActive: boolean
}

export type MenuPriceChange = {
  id: string
  menuItemId: string
  variantId?: string
  branchId?: string
  scope: 'base' | 'branch'
  oldPrice: number | null
  newPrice: number | null
  changedBy: string
  changedByName: string
  changedAt: string
}

const MAX_PRICE_HISTORY = 5000

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/
const DIETARY = ['jain', 'no-onion-garlic', 'vegan', 'contains-dairy'] as const

// ── validation ───────────────────────────────────────────────────────────────

const metadataSchema = {
  description: z.string().max(1000).optional(),
  imageUrl: z.string().url('Image URL must be a valid URL').max(500).optional().or(z.literal('')),
  costPrice: z.number().int('Cost must be a whole number').min(0).optional(),
  dietary: z.array(z.enum(DIETARY)).max(4).optional(),
  spiceLevel: z.number().int().min(0).max(3).optional(),
  allergens: z.array(z.string().max(40)).max(20).optional(),
  isSignature: z.boolean().optional(),
  prepTimeMins: z.number().int().min(0).max(240).optional(),
  availStart: z.string().regex(TIME_RE, 'Invalid start time (HH:MM)').optional().or(z.literal('')),
  availEnd: z.string().regex(TIME_RE, 'Invalid end time (HH:MM)').optional().or(z.literal('')),
  availDays: z.array(z.number().int().min(0).max(6)).max(7).optional(),
}

const addMenuItemSchema = z.object({
  name: z.string().min(1, 'Item name is required').max(150, 'Name too long').trim(),
  categoryId: z.string().min(1, 'Category is required'),
  basePrice: z.number().int('Price must be a whole number').min(0, 'Price cannot be negative'),
  ...metadataSchema,
})

const updateMenuItemSchema = addMenuItemSchema.extend({
  id: z.string().min(1, 'Item id is required'),
})

// ── helpers ──────────────────────────────────────────────────────────────────

function parseMetadata(formData: FormData) {
  const num = (k: string) => {
    const raw = formData.get(k)
    if (raw === null || raw === '') return undefined
    const n = Number(raw)
    return Number.isFinite(n) ? n : undefined
  }
  const str = (k: string) => {
    const raw = formData.get(k)
    return raw === null || raw === '' ? undefined : String(raw)
  }
  const list = (k: string) => {
    const all = formData.getAll(k).map(String).filter(Boolean)
    return all.length > 0 ? all : undefined
  }

  return {
    description: str('description'),
    imageUrl: str('imageUrl'),
    costPrice: num('costPrice'),
    dietary: list('dietary'),
    spiceLevel: num('spiceLevel'),
    allergens: list('allergens'),
    isSignature: formData.get('isSignature') === 'on' || formData.get('isSignature') === 'true',
    prepTimeMins: num('prepTimeMins'),
    availStart: str('availStart'),
    availEnd: str('availEnd'),
    availDays: formData.getAll('availDays').map(Number).filter(n => Number.isFinite(n)),
  }
}

/** Build the optional availability window, or undefined when nothing is set. */
function buildWindow(meta: ReturnType<typeof parseMetadata>): AvailabilityWindow | undefined {
  const days = meta.availDays && meta.availDays.length > 0 ? meta.availDays : undefined
  const startTime = meta.availStart || undefined
  const endTime = meta.availEnd || undefined
  if (!days && !startTime && !endTime) return undefined
  return { ...(days ? { days } : {}), ...(startTime ? { startTime } : {}), ...(endTime ? { endTime } : {}) }
}

/** Strip empty-string / undefined so we never persist noise. */
function applyMetadata(target: MenuItem, meta: ReturnType<typeof parseMetadata>) {
  target.description = meta.description
  target.imageUrl = meta.imageUrl || undefined
  target.costPrice = meta.costPrice
  target.dietary = meta.dietary
  target.spiceLevel = meta.spiceLevel
  target.allergens = meta.allergens
  target.isSignature = meta.isSignature || undefined
  target.prepTimeMins = meta.prepTimeMins
  target.availability = buildWindow(meta)
}

async function recordPriceChange(entry: Omit<MenuPriceChange, 'id' | 'changedAt' | 'changedBy' | 'changedByName'>) {
  try {
    const session = await getSession().catch(() => null)
    await withTransaction<MenuPriceChange>(DB_FILES.MENU_PRICE_HISTORY, (list) => {
      list.push({
        ...entry,
        id: `mph_${randomUUID()}`,
        changedBy: session?.userId ?? 'system',
        changedByName: session?.name ?? 'system',
        changedAt: new Date().toISOString(),
      })
      return list.length > MAX_PRICE_HISTORY ? list.slice(list.length - MAX_PRICE_HISTORY) : list
    })
  } catch {
    // Price history must never break the price change itself.
  }
}

// ── catalog: create / update / delete / restore ───────────────────────────────

export async function addMenuItem(prevState: any, formData: FormData) {
  const session = await getSession()
  if (!session?.isGlobalAdmin) return { error: 'Forbidden: Admin or Owner access required' }

  const name = formData.get('name') as string
  const categoryId = formData.get('categoryId') as string
  const basePrice = Number(formData.get('basePrice')) || 0
  const isAvailableGlobally = formData.get('isAvailableGlobally') !== 'false'
  const meta = parseMetadata(formData)

  const parsed = addMenuItemSchema.safeParse({ name, categoryId, basePrice, ...meta })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const now = new Date().toISOString()
  const newItem: MenuItem = {
    id: `mn_${randomUUID()}`,
    name,
    categoryId,
    basePrice,
    sortOrder: Date.now(),
    isActive: true,
    createdAt: now,
    updatedAt: now,
  }
  applyMetadata(newItem, meta)

  let alreadyExists = false
  const success = await withTransaction<MenuItem>(DB_FILES.MENU, (menu) => {
    if (menu.some(m => m.name.toLowerCase() === name.toLowerCase() && m.categoryId === categoryId && m.isActive !== false)) {
      alreadyExists = true
      return menu
    }
    menu.push(newItem)
    return menu
  })

  if (alreadyExists) return { error: 'A menu item with this name already exists in this category' }
  if (!success) return { error: 'Failed to add menu item' }

  // Seed a branch mapping per active branch, written to that branch's own shard.
  const branches = await readJSON<any>(DB_FILES.BRANCHES)
  const activeBranches = branches.filter((b: any) => b.isActive !== false)

  for (const branch of activeBranches) {
    await withBranchMenuTransaction<BranchMenuItem>(branch.id, (items) => {
      items.push({
        id: `bmi_${randomUUID()}`,
        branchId: branch.id,
        menuItemId: newItem.id,
        price: null,
        isAvailable: isAvailableGlobally,
      })
      return items
    })
  }

  await logAction('CREATE_MENU_ITEM', 'MENU_ITEM', JSON.stringify({ name, categoryId, basePrice }), newItem.id)
  revalidatePath('/management/menu')
  return { success: true }
}

export async function updateMenuItem(prevState: any, formData: FormData) {
  const session = await getSession()
  if (!session?.isGlobalAdmin) return { error: 'Forbidden: Admin or Owner access required' }

  const id = formData.get('id') as string
  const name = formData.get('name') as string
  const categoryId = formData.get('categoryId') as string
  const basePrice = Number(formData.get('basePrice')) || 0
  const meta = parseMetadata(formData)

  const parsed = updateMenuItemSchema.safeParse({ id, name, categoryId, basePrice, ...meta })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  let notFound = false
  let alreadyExists = false
  let oldBasePrice: number | null = null
  let categoryChanged = false

  const success = await withTransaction<MenuItem>(DB_FILES.MENU, (menu) => {
    const index = menu.findIndex(m => m.id === id)
    if (index === -1) { notFound = true; return menu }

    if (menu.some(m => m.id !== id && m.isActive !== false
        && m.name.toLowerCase() === name.toLowerCase() && m.categoryId === categoryId)) {
      alreadyExists = true
      return menu
    }

    oldBasePrice = menu[index].basePrice ?? null
    categoryChanged = menu[index].categoryId !== categoryId

    menu[index] = {
      ...menu[index],
      name,
      categoryId,
      basePrice,
      updatedAt: new Date().toISOString(),
    }
    applyMetadata(menu[index], meta)
    return menu
  })

  if (notFound) return { error: 'Menu item not found' }
  if (alreadyExists) return { error: 'A menu item with this name already exists in this category' }
  if (!success) return { error: 'Transaction failed' }

  if (oldBasePrice !== basePrice) {
    await recordPriceChange({ menuItemId: id, scope: 'base', oldPrice: oldBasePrice, newPrice: basePrice })
  }

  await logAction('UPDATE_MENU_ITEM', 'MENU_ITEM', JSON.stringify({ name, categoryId, basePrice, categoryChanged }), id)
  revalidatePath('/management/menu')
  revalidatePath('/management/staff') // categories double as chef specialties

  return categoryChanged
    ? { success: true, warning: 'Category changed — verify any chef specialty mapped to this item.' }
    : { success: true }
}

export async function deleteMenuItem(id: string) {
  const session = await getSession()
  if (!session?.isGlobalAdmin) return { error: 'Forbidden: Admin or Owner access required' }

  let notFound = false
  const success = await withTransaction<MenuItem>(DB_FILES.MENU, (menu) => {
    const item = menu.find(m => m.id === id)
    if (!item) { notFound = true; return menu }
    item.isActive = false
    item.deletedAt = new Date().toISOString()
    item.updatedAt = new Date().toISOString()
    return menu
  })

  if (notFound) return { error: 'Menu item not found' }
  if (!success) return { error: 'Transaction failed' }

  // Branch mappings are intentionally preserved for historical accuracy.
  await logAction('DELETE_MENU_ITEM', 'MENU_ITEM', 'Archived menu item', id)
  revalidatePath('/management/menu')
  return { success: true }
}

export async function restoreMenuItem(id: string) {
  const session = await getSession()
  if (!session?.isGlobalAdmin) return { error: 'Forbidden: Admin or Owner access required' }

  let notFound = false
  const success = await withTransaction<MenuItem>(DB_FILES.MENU, (menu) => {
    const item = menu.find(m => m.id === id)
    if (!item) { notFound = true; return menu }
    item.isActive = true
    item.deletedAt = undefined
    item.updatedAt = new Date().toISOString()
    return menu
  })

  if (notFound) return { error: 'Menu item not found' }
  if (!success) return { error: 'Transaction failed' }

  await logAction('RESTORE_MENU_ITEM', 'MENU_ITEM', 'Restored menu item', id)
  revalidatePath('/management/menu')
  return { success: true }
}

/** Persist an explicit item order within a category — one atomic write. */
export async function reorderMenuItems(categoryId: string, orderedIds: string[]) {
  const session = await getSession()
  if (!session?.isGlobalAdmin) return { error: 'Forbidden: Admin or Owner access required' }
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) return { error: 'Nothing to reorder' }

  const success = await withTransaction<MenuItem>(DB_FILES.MENU, (menu) => {
    orderedIds.forEach((itemId, index) => {
      const item = menu.find(m => m.id === itemId && m.categoryId === categoryId)
      if (item) item.sortOrder = index
    })
    return menu
  })

  if (!success) return { error: 'Transaction failed' }
  await logAction('REORDER_MENU_ITEMS', 'MENU_ITEM', JSON.stringify({ categoryId, count: orderedIds.length }))
  revalidatePath('/management/menu')
  return { success: true }
}

// ── variants (optional feature) ──────────────────────────────────────────────

const variantSchema = z.object({
  menuItemId: z.string().min(1),
  name: z.string().min(1, 'Variant name is required').max(60, 'Name too long').trim(),
  basePrice: z.number().int('Price must be a whole number').min(0, 'Price cannot be negative'),
})

export async function addVariant(menuItemId: string, name: string, basePrice: number) {
  const session = await getSession()
  if (!session?.isGlobalAdmin) return { error: 'Forbidden: Admin or Owner access required' }

  const parsed = variantSchema.safeParse({ menuItemId, name, basePrice })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  let duplicate = false
  const success = await withTransaction<MenuItemVariant>(DB_FILES.MENU_ITEM_VARIANTS, (list) => {
    if (list.some(v => v.menuItemId === menuItemId && v.isActive !== false
        && v.name.toLowerCase() === name.trim().toLowerCase())) {
      duplicate = true
      return list
    }
    list.push({
      id: `mv_${randomUUID()}`,
      menuItemId,
      name: name.trim(),
      basePrice,
      sortOrder: list.filter(v => v.menuItemId === menuItemId).length,
      isActive: true,
    })
    return list
  })

  if (duplicate) return { error: 'This item already has a variant with that name' }
  if (!success) return { error: 'Transaction failed' }
  await logAction('CREATE_MENU_VARIANT', 'MENU_VARIANT', JSON.stringify({ menuItemId, name, basePrice }))
  revalidatePath('/management/menu')
  return { success: true }
}

export async function updateVariant(id: string, name: string, basePrice: number) {
  const session = await getSession()
  if (!session?.isGlobalAdmin) return { error: 'Forbidden: Admin or Owner access required' }
  if (!id) return { error: 'Variant id is required' }
  if (!name || name.trim().length === 0) return { error: 'Variant name is required' }
  if (!Number.isInteger(basePrice) || basePrice < 0) return { error: 'Price must be a whole number' }

  let notFound = false
  let oldPrice: number | null = null
  let menuItemId = ''

  const success = await withTransaction<MenuItemVariant>(DB_FILES.MENU_ITEM_VARIANTS, (list) => {
    const v = list.find(x => x.id === id)
    if (!v) { notFound = true; return list }
    oldPrice = v.basePrice
    menuItemId = v.menuItemId
    v.name = name.trim()
    v.basePrice = basePrice
    return list
  })

  if (notFound) return { error: 'Variant not found' }
  if (!success) return { error: 'Transaction failed' }

  if (oldPrice !== basePrice) {
    await recordPriceChange({ menuItemId, variantId: id, scope: 'base', oldPrice, newPrice: basePrice })
  }
  await logAction('UPDATE_MENU_VARIANT', 'MENU_VARIANT', JSON.stringify({ name, basePrice }), id)
  revalidatePath('/management/menu')
  return { success: true }
}

export async function deleteVariant(id: string) {
  const session = await getSession()
  if (!session?.isGlobalAdmin) return { error: 'Forbidden: Admin or Owner access required' }

  let notFound = false
  const success = await withTransaction<MenuItemVariant>(DB_FILES.MENU_ITEM_VARIANTS, (list) => {
    const v = list.find(x => x.id === id)
    if (!v) { notFound = true; return list }
    v.isActive = false
    return list
  })

  if (notFound) return { error: 'Variant not found' }
  if (!success) return { error: 'Transaction failed' }
  await logAction('DELETE_MENU_VARIANT', 'MENU_VARIANT', 'Archived variant', id)
  revalidatePath('/management/menu')
  return { success: true }
}

// ── branch config: availability & price (managers allowed) ────────────────────

export async function setBranchItemAvailability(
  branchId: string,
  menuItemId: string,
  isAvailable: boolean,
  variantId?: string
) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }

  let enforcedBranch: string
  try {
    enforcedBranch = await requireBranchAccess(branchId)
  } catch (e: any) {
    return { error: e?.message || 'Forbidden' }
  }
  if (!enforcedBranch) return { error: 'Branch is required' }

  const success = await withBranchMenuTransaction<BranchMenuItem>(enforcedBranch, (items) => {
    const row = items.find(m => m.menuItemId === menuItemId && (m.variantId ?? undefined) === variantId)
    if (row) {
      row.isAvailable = isAvailable
    } else {
      items.push({
        id: `bmi_${randomUUID()}`,
        branchId: enforcedBranch,
        menuItemId,
        variantId,
        price: null,
        isAvailable,
      })
    }
    return items
  })

  if (!success) return { error: 'Failed to update availability' }
  await logAction(
    'SET_MENU_AVAILABILITY', 'BRANCH_MENU_ITEM',
    JSON.stringify({ branchId: enforcedBranch, menuItemId, variantId, isAvailable }), menuItemId
  )
  return { success: true }
}

export async function updateBranchMenuItemPrice(
  branchId: string,
  menuItemId: string,
  price: number | null,
  variantId?: string
) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  if (price !== null && (!Number.isInteger(price) || price < 0)) {
    return { error: 'Price must be a whole number and cannot be negative' }
  }

  let enforcedBranch: string
  try {
    enforcedBranch = await requireBranchAccess(branchId)
  } catch (e: any) {
    return { error: e?.message || 'Forbidden' }
  }
  if (!enforcedBranch) return { error: 'Branch is required' }

  let oldPrice: number | null = null
  const success = await withBranchMenuTransaction<BranchMenuItem>(enforcedBranch, (items) => {
    const row = items.find(m => m.menuItemId === menuItemId && (m.variantId ?? undefined) === variantId)
    if (row) {
      oldPrice = row.price
      row.price = price
    } else {
      items.push({
        id: `bmi_${randomUUID()}`,
        branchId: enforcedBranch,
        menuItemId,
        variantId,
        price,
        isAvailable: true,
      })
    }
    return items
  })

  if (!success) return { error: 'Failed to update price' }

  await recordPriceChange({
    menuItemId, variantId, branchId: enforcedBranch, scope: 'branch', oldPrice, newPrice: price,
  })
  await logAction(
    'UPDATE_BRANCH_PRICE', 'BRANCH_MENU_ITEM',
    JSON.stringify({ branchId: enforcedBranch, menuItemId, variantId, oldPrice, newPrice: price }), menuItemId
  )
  return { success: true }
}

// ── bulk operations ──────────────────────────────────────────────────────────

export async function bulkSetBranchAvailability(
  branchId: string,
  menuItemIds: string[],
  isAvailable: boolean
) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  if (!Array.isArray(menuItemIds) || menuItemIds.length === 0) return { error: 'No items selected' }

  let enforcedBranch: string
  try {
    enforcedBranch = await requireBranchAccess(branchId)
  } catch (e: any) {
    return { error: e?.message || 'Forbidden' }
  }

  let changed = 0
  const success = await withBranchMenuTransaction<BranchMenuItem>(enforcedBranch, (items) => {
    for (const menuItemId of menuItemIds) {
      const row = items.find(m => m.menuItemId === menuItemId && !m.variantId)
      if (row) {
        if (row.isAvailable !== isAvailable) changed++
        row.isAvailable = isAvailable
      } else {
        items.push({
          id: `bmi_${randomUUID()}`,
          branchId: enforcedBranch,
          menuItemId,
          price: null,
          isAvailable,
        })
        changed++
      }
    }
    return items
  })

  if (!success) return { error: 'Bulk availability update failed' }
  await logAction(
    'BULK_SET_MENU_AVAILABILITY', 'BRANCH_MENU_ITEM',
    JSON.stringify({ branchId: enforcedBranch, count: menuItemIds.length, changed, isAvailable })
  )
  revalidatePath('/management/menu')
  return { success: true, changed }
}

export async function bulkUpdateBranchPrices(
  branchId: string,
  menuItemIds: string[],
  mode: 'percent' | 'flat' | 'set',
  value: number
) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  if (!Array.isArray(menuItemIds) || menuItemIds.length === 0) return { error: 'No items selected' }
  if (!['percent', 'flat', 'set'].includes(mode)) return { error: 'Invalid price change mode' }
  if (!Number.isFinite(value)) return { error: 'Invalid value' }
  if (mode === 'set' && value < 0) return { error: 'Price cannot be negative' }

  let enforcedBranch: string
  try {
    enforcedBranch = await requireBranchAccess(branchId)
  } catch (e: any) {
    return { error: e?.message || 'Forbidden' }
  }

  const menu = await readJSON<MenuItem>(DB_FILES.MENU)
  const changes: { menuItemId: string; oldPrice: number | null; newPrice: number }[] = []

  const success = await withBranchMenuTransaction<BranchMenuItem>(enforcedBranch, (items) => {
    for (const menuItemId of menuItemIds) {
      const item = menu.find(m => m.id === menuItemId)
      if (!item) continue

      const row = items.find(m => m.menuItemId === menuItemId && !m.variantId)
      const base = resolveEffectiveBasePrice(item)
      const current = row?.price ?? base
      const next = applyPriceChange(current, mode, value)

      if (row) {
        if (row.price !== next) changes.push({ menuItemId, oldPrice: row.price, newPrice: next })
        row.price = next
      } else {
        changes.push({ menuItemId, oldPrice: null, newPrice: next })
        items.push({
          id: `bmi_${randomUUID()}`,
          branchId: enforcedBranch,
          menuItemId,
          price: next,
          isAvailable: true,
        })
      }
    }
    return items
  })

  if (!success) return { error: 'Bulk price update failed' }

  for (const c of changes) {
    await recordPriceChange({
      menuItemId: c.menuItemId, branchId: enforcedBranch, scope: 'branch',
      oldPrice: c.oldPrice, newPrice: c.newPrice,
    })
  }
  await logAction(
    'BULK_UPDATE_BRANCH_PRICES', 'BRANCH_MENU_ITEM',
    JSON.stringify({ branchId: enforcedBranch, mode, value, changed: changes.length })
  )
  revalidatePath('/management/menu')
  return { success: true, changed: changes.length }
}

// ── clone one branch's configuration onto another ─────────────────────────────

export async function cloneBranchMenuConfig(
  fromBranchId: string,
  toBranchId: string,
  options: { prices?: boolean; availability?: boolean } = { prices: true, availability: true }
) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  if (!fromBranchId || !toBranchId) return { error: 'Both source and target branches are required' }
  if (fromBranchId === toBranchId) return { error: 'Source and target branches must differ' }
  if (!options.prices && !options.availability) return { error: 'Select at least prices or availability to copy' }

  // The writer must have access to the TARGET branch.
  let enforcedTarget: string
  try {
    enforcedTarget = await requireBranchAccess(toBranchId)
  } catch (e: any) {
    return { error: e?.message || 'Forbidden' }
  }

  const source = await readBranchMenuItems<BranchMenuItem>(fromBranchId)
  if (source.length === 0) return { error: 'Source branch has no menu configuration to copy' }

  let applied = 0
  const success = await withBranchMenuTransaction<BranchMenuItem>(enforcedTarget, (items) => {
    for (const src of source) {
      const row = items.find(
        m => m.menuItemId === src.menuItemId && (m.variantId ?? undefined) === (src.variantId ?? undefined)
      )
      if (row) {
        if (options.prices) row.price = src.price
        if (options.availability) row.isAvailable = src.isAvailable
      } else {
        items.push({
          id: `bmi_${randomUUID()}`,
          branchId: enforcedTarget,
          menuItemId: src.menuItemId,
          variantId: src.variantId,
          price: options.prices ? src.price : null,
          isAvailable: options.availability ? src.isAvailable : true,
        })
      }
      applied++
    }
    return items
  })

  if (!success) return { error: 'Clone failed' }
  await logAction(
    'CLONE_BRANCH_MENU_CONFIG', 'BRANCH_MENU_ITEM',
    JSON.stringify({ from: fromBranchId, to: enforcedTarget, applied, options })
  )
  revalidatePath('/management/menu')
  return { success: true, applied }
}

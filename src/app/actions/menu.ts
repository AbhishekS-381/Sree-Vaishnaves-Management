'use server'

import {
  db,
  menuItems,
  branchMenuItems,
  menuItemVariants,
  menuPriceHistory,
  branches,
  withDbTransaction,
} from '@/lib/db'
import { eq, and, ilike, ne, isNull, inArray, sql, asc } from 'drizzle-orm'
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
  deletedAt?: string
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
  acPrice: z.number().int('AC price must be a whole number').min(0, 'AC price cannot be negative').optional().nullable(),
  parcelPrice: z.number().int('Parcel price must be a whole number').min(0, 'Parcel price cannot be negative').optional().nullable(),
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
    availDays: formData.getAll('availDays').map(Number).filter((n) => Number.isFinite(n)),
  }
}

function buildWindow(meta: ReturnType<typeof parseMetadata>): AvailabilityWindow | undefined {
  const days = meta.availDays && meta.availDays.length > 0 ? meta.availDays : undefined
  const startTime = meta.availStart || undefined
  const endTime = meta.availEnd || undefined
  if (!days && !startTime && !endTime) return undefined
  return { ...(days ? { days } : {}), ...(startTime ? { startTime } : {}), ...(endTime ? { endTime } : {}) }
}

async function recordPriceChange(entry: Omit<MenuPriceChange, 'id' | 'changedAt' | 'changedBy' | 'changedByName'>) {
  try {
    const session = await getSession().catch(() => null)
    await db.insert(menuPriceHistory).values({
      id: randomUUID(),
      menuItemId: entry.menuItemId,
      variantId: entry.variantId || null,
      branchId: entry.branchId || null,
      scope: entry.scope,
      oldPrice: entry.oldPrice ?? null,
      newPrice: entry.newPrice ?? null,
      changedBy: session?.userId ?? 'system',
      changedByName: session?.name ?? 'system',
      changedAt: new Date(),
    })

    // Trimming outside any transaction using pk surrogate key (Req 8.5)
    const countResult = await db.select({ count: sql<number>`count(*)::int` }).from(menuPriceHistory)
    const currentCount = Number(countResult[0]?.count ?? 0)
    if (currentCount > MAX_PRICE_HISTORY) {
      const deleteCount = currentCount - MAX_PRICE_HISTORY
      const oldest = await db
        .select({ pk: menuPriceHistory.pk })
        .from(menuPriceHistory)
        .orderBy(asc(menuPriceHistory.pk))
        .limit(deleteCount)

      if (oldest.length > 0) {
        const pksToDelete = oldest.map((r) => r.pk)
        await db.delete(menuPriceHistory).where(inArray(menuPriceHistory.pk, pksToDelete))
      }
    }
  } catch {
    // Price history must never break the price change itself.
  }
}

// ── catalog: create / update / delete / restore ───────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function addMenuItem(prevState: any, formData: FormData) {
  const session = await getSession()
  if (!session?.isGlobalAdmin) return { error: 'Forbidden: Admin or Owner access required' }

  const name = formData.get('name') as string
  const categoryId = formData.get('categoryId') as string
  const basePrice = Number(formData.get('basePrice')) || 0
  const acPriceRaw = formData.get('acPrice')
  const acPrice = acPriceRaw !== null && acPriceRaw !== '' ? Number(acPriceRaw) : null
  const parcelPriceRaw = formData.get('parcelPrice')
  const parcelPrice = parcelPriceRaw !== null && parcelPriceRaw !== '' ? Number(parcelPriceRaw) : null
  const isAvailableGlobally = formData.get('isAvailableGlobally') !== 'false'
  const meta = parseMetadata(formData)

  const parsed = addMenuItemSchema.safeParse({ name, categoryId, basePrice, acPrice, parcelPrice, ...meta })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  try {
    const existing = await db
      .select({ id: menuItems.id })
      .from(menuItems)
      .where(
        and(
          ilike(menuItems.name, name),
          eq(menuItems.categoryId, categoryId),
          eq(menuItems.isActive, true),
          isNull(menuItems.deletedAt)
        )
      )
      .limit(1)

    if (existing.length > 0) {
      return { error: 'A menu item with this name already exists in this category' }
    }

    const newItemId = randomUUID()
    const now = new Date()
    const availWindow = buildWindow(meta)

    // Atomic transaction: menu item + bulk branch_menu_items for all active branches (Req 8.1, 15.5)
    await withDbTransaction(async (tx) => {
      await tx.insert(menuItems).values({
        id: newItemId,
        name,
        categoryId,
        basePrice,
        acPrice: parsed.data.acPrice ?? null,
        parcelPrice: parsed.data.parcelPrice ?? null,
        sortOrder: Date.now(),
        isActive: true,
        description: meta.description || null,
        imageUrl: meta.imageUrl || null,
        costPrice: meta.costPrice || null,
        dietary: meta.dietary || null,
        spiceLevel: meta.spiceLevel ?? null,
        allergens: meta.allergens || null,
        isSignature: meta.isSignature || null,
        prepTimeMins: meta.prepTimeMins || null,
        availability: availWindow || null,
        createdAt: now,
        updatedAt: now,
      })

      const activeBranches = await tx
        .select({ id: branches.id })
        .from(branches)
        .where(and(eq(branches.isActive, true), isNull(branches.deletedAt)))

      if (activeBranches.length > 0) {
        await tx.insert(branchMenuItems).values(
          activeBranches.map((b) => ({
            id: randomUUID(),
            branchId: b.id,
            menuItemId: newItemId,
            price: null,
            isAvailable: isAvailableGlobally,
          }))
        )
      }
    })

    await logAction('CREATE_MENU_ITEM', 'MENU_ITEM', JSON.stringify({ name, categoryId, basePrice }), newItemId)
    revalidatePath('/management/menu')
    return { success: true }
  } catch (error) {
    console.error('Failed to add menu item:', error)
    return { error: 'Failed to add menu item' }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateMenuItem(prevState: any, formData: FormData) {
  const session = await getSession()
  if (!session?.isGlobalAdmin) return { error: 'Forbidden: Admin or Owner access required' }

  const id = formData.get('id') as string
  const name = formData.get('name') as string
  const categoryId = formData.get('categoryId') as string
  const basePrice = Number(formData.get('basePrice')) || 0
  const acPriceRaw = formData.get('acPrice')
  const acPrice = acPriceRaw !== null && acPriceRaw !== '' ? Number(acPriceRaw) : null
  const parcelPriceRaw = formData.get('parcelPrice')
  const parcelPrice = parcelPriceRaw !== null && parcelPriceRaw !== '' ? Number(parcelPriceRaw) : null
  const meta = parseMetadata(formData)

  const parsed = updateMenuItemSchema.safeParse({ id, name, categoryId, basePrice, acPrice, parcelPrice, ...meta })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  try {
    const existing = await db
      .select()
      .from(menuItems)
      .where(and(eq(menuItems.id, id), isNull(menuItems.deletedAt)))
      .limit(1)

    if (existing.length === 0) return { error: 'Menu item not found' }

    const item = existing[0]

    const duplicate = await db
      .select({ id: menuItems.id })
      .from(menuItems)
      .where(
        and(
          ilike(menuItems.name, name),
          eq(menuItems.categoryId, categoryId),
          eq(menuItems.isActive, true),
          isNull(menuItems.deletedAt),
          ne(menuItems.id, id)
        )
      )
      .limit(1)

    if (duplicate.length > 0) {
      return { error: 'A menu item with this name already exists in this category' }
    }

    const oldBasePrice = item.basePrice
    const categoryChanged = item.categoryId !== categoryId
    const availWindow = buildWindow(meta)
    const now = new Date()

    await db
      .update(menuItems)
      .set({
        name,
        categoryId,
        basePrice,
        acPrice: parsed.data.acPrice ?? null,
        parcelPrice: parsed.data.parcelPrice ?? null,
        description: meta.description || null,
        imageUrl: meta.imageUrl || null,
        costPrice: meta.costPrice || null,
        dietary: meta.dietary || null,
        spiceLevel: meta.spiceLevel ?? null,
        allergens: meta.allergens || null,
        isSignature: meta.isSignature || null,
        prepTimeMins: meta.prepTimeMins || null,
        availability: availWindow || null,
        updatedAt: now,
      })
      .where(eq(menuItems.id, id))

    if (oldBasePrice !== basePrice) {
      await recordPriceChange({ menuItemId: id, scope: 'base', oldPrice: oldBasePrice, newPrice: basePrice })
    }

    await logAction('UPDATE_MENU_ITEM', 'MENU_ITEM', JSON.stringify({ name, categoryId, basePrice, categoryChanged }), id)
    revalidatePath('/management/menu')
    revalidatePath('/management/staff')

    return categoryChanged
      ? { success: true, warning: 'Category changed — verify any chef specialty mapped to this item.' }
      : { success: true }
  } catch (error) {
    console.error('Failed to update menu item:', error)
    return { error: 'Transaction failed' }
  }
}

export async function deleteMenuItem(id: string) {
  const session = await getSession()
  if (!session?.isGlobalAdmin) return { error: 'Forbidden: Admin or Owner access required' }

  try {
    const existing = await db
      .select({ id: menuItems.id })
      .from(menuItems)
      .where(and(eq(menuItems.id, id), isNull(menuItems.deletedAt)))
      .limit(1)

    if (existing.length === 0) return { error: 'Menu item not found' }

    const now = new Date()
    await db
      .update(menuItems)
      .set({
        isActive: false,
        deletedAt: now,
        updatedAt: now,
      })
      .where(eq(menuItems.id, id))

    await logAction('DELETE_MENU_ITEM', 'MENU_ITEM', 'Archived menu item', id)
    revalidatePath('/management/menu')
    return { success: true }
  } catch (error) {
    console.error('Failed to delete menu item:', error)
    return { error: 'Transaction failed' }
  }
}

export async function restoreMenuItem(id: string) {
  const session = await getSession()
  if (!session?.isGlobalAdmin) return { error: 'Forbidden: Admin or Owner access required' }

  try {
    const existing = await db
      .select({ id: menuItems.id })
      .from(menuItems)
      .where(eq(menuItems.id, id))
      .limit(1)

    if (existing.length === 0) return { error: 'Menu item not found' }

    const now = new Date()
    await db
      .update(menuItems)
      .set({
        isActive: true,
        deletedAt: null,
        updatedAt: now,
      })
      .where(eq(menuItems.id, id))

    await logAction('RESTORE_MENU_ITEM', 'MENU_ITEM', 'Restored menu item', id)
    revalidatePath('/management/menu')
    return { success: true }
  } catch (error) {
    console.error('Failed to restore menu item:', error)
    return { error: 'Transaction failed' }
  }
}

export async function reorderMenuItems(categoryId: string, orderedIds: string[]) {
  const session = await getSession()
  if (!session?.isGlobalAdmin) return { error: 'Forbidden: Admin or Owner access required' }
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) return { error: 'Nothing to reorder' }

  try {
    await withDbTransaction(async (tx) => {
      for (let index = 0; index < orderedIds.length; index++) {
        const itemId = orderedIds[index]
        await tx
          .update(menuItems)
          .set({ sortOrder: index })
          .where(and(eq(menuItems.id, itemId), eq(menuItems.categoryId, categoryId)))
      }
    })

    await logAction('REORDER_MENU_ITEMS', 'MENU_ITEM', JSON.stringify({ categoryId, count: orderedIds.length }))
    revalidatePath('/management/menu')
    return { success: true }
  } catch (error) {
    console.error('Failed to reorder menu items:', error)
    return { error: 'Transaction failed' }
  }
}

// ── variants ─────────────────────────────────────────────────────────────────

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

  try {
    const existing = await db
      .select({ id: menuItemVariants.id })
      .from(menuItemVariants)
      .where(
        and(
          eq(menuItemVariants.menuItemId, menuItemId),
          ilike(menuItemVariants.name, name.trim()),
          eq(menuItemVariants.isActive, true),
          isNull(menuItemVariants.deletedAt)
        )
      )
      .limit(1)

    if (existing.length > 0) {
      return { error: 'This item already has a variant with that name' }
    }

    const currentVariants = await db
      .select({ id: menuItemVariants.id })
      .from(menuItemVariants)
      .where(eq(menuItemVariants.menuItemId, menuItemId))

    await db.insert(menuItemVariants).values({
      id: randomUUID(),
      menuItemId,
      name: name.trim(),
      basePrice,
      sortOrder: currentVariants.length,
      isActive: true,
    })

    await logAction('CREATE_MENU_VARIANT', 'MENU_VARIANT', JSON.stringify({ menuItemId, name, basePrice }))
    revalidatePath('/management/menu')
    return { success: true }
  } catch (error) {
    console.error('Failed to add variant:', error)
    return { error: 'Transaction failed' }
  }
}

export async function updateVariant(id: string, name: string, basePrice: number) {
  const session = await getSession()
  if (!session?.isGlobalAdmin) return { error: 'Forbidden: Admin or Owner access required' }
  if (!id) return { error: 'Variant id is required' }
  if (!name || name.trim().length === 0) return { error: 'Variant name is required' }
  if (!Number.isInteger(basePrice) || basePrice < 0) return { error: 'Price must be a whole number' }

  try {
    const existing = await db
      .select()
      .from(menuItemVariants)
      .where(and(eq(menuItemVariants.id, id), isNull(menuItemVariants.deletedAt)))
      .limit(1)

    if (existing.length === 0) return { error: 'Variant not found' }

    const v = existing[0]
    const oldPrice = v.basePrice

    await db
      .update(menuItemVariants)
      .set({
        name: name.trim(),
        basePrice,
      })
      .where(eq(menuItemVariants.id, id))

    if (oldPrice !== basePrice) {
      await recordPriceChange({ menuItemId: v.menuItemId, variantId: id, scope: 'base', oldPrice, newPrice: basePrice })
    }

    await logAction('UPDATE_MENU_VARIANT', 'MENU_VARIANT', JSON.stringify({ name, basePrice }), id)
    revalidatePath('/management/menu')
    return { success: true }
  } catch (error) {
    console.error('Failed to update variant:', error)
    return { error: 'Transaction failed' }
  }
}

export async function deleteVariant(id: string) {
  const session = await getSession()
  if (!session?.isGlobalAdmin) return { error: 'Forbidden: Admin or Owner access required' }

  try {
    const existing = await db
      .select({ id: menuItemVariants.id })
      .from(menuItemVariants)
      .where(and(eq(menuItemVariants.id, id), isNull(menuItemVariants.deletedAt)))
      .limit(1)

    if (existing.length === 0) return { error: 'Variant not found' }

    await db
      .update(menuItemVariants)
      .set({
        isActive: false,
        deletedAt: new Date(),
      })
      .where(eq(menuItemVariants.id, id))

    await logAction('DELETE_MENU_VARIANT', 'MENU_VARIANT', 'Archived variant', id)
    revalidatePath('/management/menu')
    return { success: true }
  } catch (error) {
    console.error('Failed to delete variant:', error)
    return { error: 'Transaction failed' }
  }
}

// ── branch config: availability & price ──────────────────────────────────────

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    return { error: e?.message || 'Forbidden' }
  }
  if (!enforcedBranch) return { error: 'Branch is required' }

  try {
    const conditions = [
      eq(branchMenuItems.branchId, enforcedBranch),
      eq(branchMenuItems.menuItemId, menuItemId),
    ]
    if (variantId) {
      conditions.push(eq(branchMenuItems.variantId, variantId))
    } else {
      conditions.push(isNull(branchMenuItems.variantId))
    }

    const existing = await db
      .select({ id: branchMenuItems.id })
      .from(branchMenuItems)
      .where(and(...conditions))
      .limit(1)

    if (existing.length > 0) {
      await db
        .update(branchMenuItems)
        .set({ isAvailable })
        .where(eq(branchMenuItems.id, existing[0].id))
    } else {
      await db.insert(branchMenuItems).values({
        id: randomUUID(),
        branchId: enforcedBranch,
        menuItemId,
        variantId: variantId || null,
        price: null,
        isAvailable,
      })
    }

    await logAction(
      'SET_MENU_AVAILABILITY',
      'BRANCH_MENU_ITEM',
      JSON.stringify({ branchId: enforcedBranch, menuItemId, variantId, isAvailable }),
      menuItemId
    )
    return { success: true }
  } catch (error) {
    console.error('Failed to update branch item availability:', error)
    return { error: 'Failed to update availability' }
  }
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    return { error: e?.message || 'Forbidden' }
  }
  if (!enforcedBranch) return { error: 'Branch is required' }

  try {
    const conditions = [
      eq(branchMenuItems.branchId, enforcedBranch),
      eq(branchMenuItems.menuItemId, menuItemId),
    ]
    if (variantId) {
      conditions.push(eq(branchMenuItems.variantId, variantId))
    } else {
      conditions.push(isNull(branchMenuItems.variantId))
    }

    const existing = await db
      .select()
      .from(branchMenuItems)
      .where(and(...conditions))
      .limit(1)

    let oldPrice: number | null = null
    if (existing.length > 0) {
      oldPrice = existing[0].price
      await db
        .update(branchMenuItems)
        .set({ price })
        .where(eq(branchMenuItems.id, existing[0].id))
    } else {
      await db.insert(branchMenuItems).values({
        id: randomUUID(),
        branchId: enforcedBranch,
        menuItemId,
        variantId: variantId || null,
        price,
        isAvailable: true,
      })
    }

    await recordPriceChange({
      menuItemId,
      variantId,
      branchId: enforcedBranch,
      scope: 'branch',
      oldPrice,
      newPrice: price,
    })

    await logAction(
      'UPDATE_BRANCH_PRICE',
      'BRANCH_MENU_ITEM',
      JSON.stringify({ branchId: enforcedBranch, menuItemId, variantId, oldPrice, newPrice: price }),
      menuItemId
    )
    return { success: true }
  } catch (error) {
    console.error('Failed to update branch item price:', error)
    return { error: 'Failed to update price' }
  }
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    return { error: e?.message || 'Forbidden' }
  }

  let changed = 0
  try {
    await withDbTransaction(async (tx) => {
      // 1. Fetch all existing branch item rows for selected items in ONE query
      const existingRows = await tx
        .select()
        .from(branchMenuItems)
        .where(
          and(
            eq(branchMenuItems.branchId, enforcedBranch),
            inArray(branchMenuItems.menuItemId, menuItemIds),
            isNull(branchMenuItems.variantId)
          )
        )

      const existingMap = new Map(existingRows.map((r) => [r.menuItemId, r]))
      const toInsert: any[] = []
      const toUpdate: { id: string }[] = []

      for (const menuItemId of menuItemIds) {
        const existing = existingMap.get(menuItemId)
        if (existing) {
          if (existing.isAvailable !== isAvailable) {
            changed++
            toUpdate.push({ id: existing.id })
          }
        } else {
          changed++
          toInsert.push({
            id: randomUUID(),
            branchId: enforcedBranch,
            menuItemId,
            price: null,
            isAvailable,
          })
        }
      }

      if (toInsert.length > 0) {
        await tx.insert(branchMenuItems).values(toInsert)
      }

      for (const item of toUpdate) {
        await tx
          .update(branchMenuItems)
          .set({ isAvailable })
          .where(eq(branchMenuItems.id, item.id))
      }
    })

    await logAction(
      'BULK_SET_MENU_AVAILABILITY',
      'BRANCH_MENU_ITEM',
      JSON.stringify({ branchId: enforcedBranch, count: menuItemIds.length, changed, isAvailable })
    )
    revalidatePath('/management/menu')
    return { success: true, changed }
  } catch (error) {
    console.error('Failed to bulk set availability:', error)
    return { error: 'Bulk availability update failed' }
  }
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    return { error: e?.message || 'Forbidden' }
  }

  try {
    const items = await db.select().from(menuItems).where(inArray(menuItems.id, menuItemIds))
    const changes: { menuItemId: string; oldPrice: number | null; newPrice: number }[] = []

    await withDbTransaction(async (tx) => {
      for (const item of items) {
        const existing = await tx
          .select()
          .from(branchMenuItems)
          .where(
            and(
              eq(branchMenuItems.branchId, enforcedBranch),
              eq(branchMenuItems.menuItemId, item.id),
              isNull(branchMenuItems.variantId)
            )
          )
          .limit(1)

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const base = resolveEffectiveBasePrice(item as any)
        const current = existing[0]?.price ?? base
        const next = applyPriceChange(current, mode, value)

        if (existing.length > 0) {
          if (existing[0].price !== next) {
            changes.push({ menuItemId: item.id, oldPrice: existing[0].price, newPrice: next })
          }
          await tx
            .update(branchMenuItems)
            .set({ price: next })
            .where(eq(branchMenuItems.id, existing[0].id))
        } else {
          changes.push({ menuItemId: item.id, oldPrice: null, newPrice: next })
          await tx.insert(branchMenuItems).values({
            id: randomUUID(),
            branchId: enforcedBranch,
            menuItemId: item.id,
            price: next,
            isAvailable: true,
          })
        }
      }
    })

    for (const c of changes) {
      await recordPriceChange({
        menuItemId: c.menuItemId,
        branchId: enforcedBranch,
        scope: 'branch',
        oldPrice: c.oldPrice,
        newPrice: c.newPrice,
      })
    }

    await logAction(
      'BULK_UPDATE_BRANCH_PRICES',
      'BRANCH_MENU_ITEM',
      JSON.stringify({ branchId: enforcedBranch, mode, value, changed: changes.length })
    )
    revalidatePath('/management/menu')
    return { success: true, changed: changes.length }
  } catch (error) {
    console.error('Failed to bulk update branch prices:', error)
    return { error: 'Bulk price update failed' }
  }
}

// ── clone branch menu configuration ───────────────────────────────────────────

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

  let enforcedTarget: string
  try {
    enforcedTarget = await requireBranchAccess(toBranchId)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    return { error: e?.message || 'Forbidden' }
  }

  try {
    const source = await db.select().from(branchMenuItems).where(eq(branchMenuItems.branchId, fromBranchId))
    if (source.length === 0) return { error: 'Source branch has no menu configuration to copy' }

    let applied = 0
    await withDbTransaction(async (tx) => {
      // 1. Fetch all existing target branch items in ONE query to eliminate N+1 select waterfall
      const existingTargetRows = await tx
        .select()
        .from(branchMenuItems)
        .where(eq(branchMenuItems.branchId, enforcedTarget))

      const existingMap = new Map(
        existingTargetRows.map((r) => [`${r.menuItemId}_${r.variantId || ''}`, r])
      )

      const toInsert: any[] = []

      for (const src of source) {
        const key = `${src.menuItemId}_${src.variantId || ''}`
        const existing = existingMap.get(key)

        if (existing) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const updateData: Record<string, any> = {}
          if (options.prices) updateData.price = src.price
          if (options.availability) updateData.isAvailable = src.isAvailable
          await tx.update(branchMenuItems).set(updateData).where(eq(branchMenuItems.id, existing.id))
        } else {
          toInsert.push({
            id: randomUUID(),
            branchId: enforcedTarget,
            menuItemId: src.menuItemId,
            variantId: src.variantId,
            price: options.prices ? src.price : null,
            isAvailable: options.availability ? src.isAvailable : true,
          })
        }
        applied++
      }

      if (toInsert.length > 0) {
        await tx.insert(branchMenuItems).values(toInsert)
      }
    })

    await logAction(
      'CLONE_BRANCH_MENU_CONFIG',
      'BRANCH_MENU_ITEM',
      JSON.stringify({ from: fromBranchId, to: enforcedTarget, applied, options })
    )
    revalidatePath('/management/menu')
    return { success: true, applied }
  } catch (error) {
    console.error('Failed to clone branch menu config:', error)
    return { error: 'Clone failed' }
  }
}

/**
 * Pure resolution logic for Menu Management.
 *
 * No side effects, no I/O — everything here is a pure function so the domain
 * rules (pricing inheritance, availability windows, margin, ordering) can be
 * unit tested exhaustively and reused by both the server loader and the client.
 *
 * Pricing model:
 *   effective base = variant.basePrice ?? item.basePrice
 *   final price     = branchOverride.price ?? effective base
 *   A `null` branch override means "inherit the base price" (not "free").
 *
 * Availability model — a conjunction; any false wins:
 *   item active AND branch-category available AND branch-item available
 *   AND inside the item's optional day/time window
 */

export type AvailabilityWindow = {
  /** 0 = Sunday … 6 = Saturday. Empty/omitted = every day. */
  days?: number[]
  /** "HH:MM" 24h. Omitted (with endTime) = all day. */
  startTime?: string
  endTime?: string
}

export type ResolverMenuItem = {
  id: string
  name: string
  categoryId: string
  basePrice?: number
  costPrice?: number
  sortOrder?: number
  isActive?: boolean
  availability?: AvailabilityWindow
  // Optional descriptive metadata (Menu v2). Kept here so `ResolvedItem`
  // carries it through to the UI without a second lookup.
  description?: string
  imageUrl?: string
  dietary?: string[]
  spiceLevel?: number
  allergens?: string[]
  isSignature?: boolean
  prepTimeMins?: number
  deletedAt?: string
}

export type ResolverVariant = {
  id: string
  menuItemId: string
  name: string
  basePrice: number
  sortOrder?: number
  isActive?: boolean
}

export type ResolverBranchMapping = {
  menuItemId: string
  variantId?: string
  price: number | null
  isAvailable: boolean
}

export type ResolverBranchCategory = {
  categoryId: string
  isAvailable: boolean
}

export type Margin = {
  profit: number
  /** cost as a percentage of selling price, 1 decimal place */
  foodCostPct: number
}

// ── time helpers ─────────────────────────────────────────────────────────────

/** "HH:MM" → minutes since midnight. Invalid/blank → 0. */
export function toMins(time?: string): number {
  if (!time) return 0
  const [h, m] = time.split(':').map(Number)
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0)
}

/**
 * Is `now` inside the window?
 * Opt-in by design: no window configured → always true, so existing items are
 * unaffected. Supports overnight windows (e.g. 22:00 → 02:00) via wrap-around.
 */
export function withinWindow(window: AvailabilityWindow | undefined, now: Date): boolean {
  if (!window) return true

  if (window.days && window.days.length > 0 && !window.days.includes(now.getDay())) {
    return false
  }

  if (!window.startTime || !window.endTime) return true

  const mins = now.getHours() * 60 + now.getMinutes()
  const start = toMins(window.startTime)
  const end = toMins(window.endTime)

  // start === end is treated as "all day" rather than a zero-length window.
  if (start === end) return true

  return start < end
    ? mins >= start && mins < end   // same-day window
    : mins >= start || mins < end   // overnight wrap-around
}

// ── pricing ──────────────────────────────────────────────────────────────────

/** variant price wins over the item price; missing values collapse to 0. */
export function resolveEffectiveBasePrice(
  item: Pick<ResolverMenuItem, 'basePrice'>,
  variant?: Pick<ResolverVariant, 'basePrice'> | null
): number {
  if (variant && typeof variant.basePrice === 'number') return variant.basePrice
  return item.basePrice ?? 0
}

/** A null/undefined override inherits the base price. */
export function resolvePrice(override: number | null | undefined, basePrice: number): number {
  return override ?? basePrice
}

/** True when the branch stores its own price and it differs from the base. */
export function isPriceOverridden(
  override: number | null | undefined,
  basePrice: number
): boolean {
  return override !== null && override !== undefined && override !== basePrice
}

/** null when cost is unknown or price is 0 (percentage undefined). */
export function computeMargin(price: number, costPrice?: number): Margin | null {
  if (costPrice === null || costPrice === undefined) return null
  if (!Number.isFinite(price) || price <= 0) return null
  return {
    profit: price - costPrice,
    foodCostPct: Number(((costPrice / price) * 100).toFixed(1)),
  }
}

/**
 * Apply a bulk price change to a base price.
 * Results are rounded to whole rupees and floored at 0.
 */
export function applyPriceChange(
  current: number,
  mode: 'percent' | 'flat' | 'set',
  value: number
): number {
  let next: number
  if (mode === 'percent') next = current + (current * value) / 100
  else if (mode === 'flat') next = current + value
  else next = value
  return Math.max(0, Math.round(next))
}

// ── availability ─────────────────────────────────────────────────────────────

export function resolveAvailability(args: {
  item: Pick<ResolverMenuItem, 'isActive' | 'availability'>
  branchItem?: Pick<ResolverBranchMapping, 'isAvailable'> | null
  branchCategory?: Pick<ResolverBranchCategory, 'isAvailable'> | null
  now: Date
}): boolean {
  const { item, branchItem, branchCategory, now } = args
  if (item.isActive === false) return false
  if (branchCategory && branchCategory.isAvailable === false) return false
  if (branchItem && branchItem.isAvailable === false) return false
  return withinWindow(item.availability, now)
}

// ── ordering ─────────────────────────────────────────────────────────────────

/** Stable sort by sortOrder then name. Returns a new array. */
export function sortItems<T extends { sortOrder?: number; name: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const ao = a.sortOrder ?? 0
    const bo = b.sortOrder ?? 0
    if (ao !== bo) return ao - bo
    return a.name.localeCompare(b.name)
  })
}

// ── composition ──────────────────────────────────────────────────────────────

export type ResolvedVariant = {
  id: string
  name: string
  basePrice: number
  price: number
  isOverridden: boolean
  isAvailable: boolean
}

export type ResolvedItem = ResolverMenuItem & {
  basePriceEffective: number
  price: number
  isOverridden: boolean
  isAvailable: boolean
  hasWindow: boolean
  margin: Margin | null
  variants: ResolvedVariant[]
}

/**
 * Resolve one item (and its variants) for a given branch at a given time.
 * `branchMappings` / `branchCategories` should already be scoped to the branch.
 */
export function resolveItemForBranch(args: {
  item: ResolverMenuItem
  variants: ResolverVariant[]
  branchMappings: ResolverBranchMapping[]
  branchCategories: ResolverBranchCategory[]
  now: Date
}): ResolvedItem {
  const { item, variants, branchMappings, branchCategories, now } = args

  const itemMapping =
    branchMappings.find(m => m.menuItemId === item.id && !m.variantId) ?? null
  const categoryMapping =
    branchCategories.find(c => c.categoryId === item.categoryId) ?? null

  const basePriceEffective = resolveEffectiveBasePrice(item)
  const price = resolvePrice(itemMapping?.price, basePriceEffective)

  const resolvedVariants: ResolvedVariant[] = sortItems(
    variants.filter(v => v.menuItemId === item.id && v.isActive !== false)
  ).map(v => {
    const vMapping =
      branchMappings.find(m => m.menuItemId === item.id && m.variantId === v.id) ?? null
    const vBase = resolveEffectiveBasePrice(item, v)
    return {
      id: v.id,
      name: v.name,
      basePrice: vBase,
      price: resolvePrice(vMapping?.price, vBase),
      isOverridden: isPriceOverridden(vMapping?.price, vBase),
      isAvailable: vMapping ? vMapping.isAvailable !== false : true,
    }
  })

  return {
    ...item,
    basePriceEffective,
    price,
    isOverridden: isPriceOverridden(itemMapping?.price, basePriceEffective),
    isAvailable: resolveAvailability({
      item,
      branchItem: itemMapping,
      branchCategory: categoryMapping,
      now,
    }),
    hasWindow: Boolean(item.availability),
    margin: computeMargin(price, item.costPrice),
    variants: resolvedVariants,
  }
}

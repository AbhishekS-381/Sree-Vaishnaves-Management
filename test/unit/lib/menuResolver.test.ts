import { describe, it, expect } from 'vitest'
import {
  toMins,
  withinWindow,
  resolveEffectiveBasePrice,
  resolvePrice,
  isPriceOverridden,
  computeMargin,
  applyPriceChange,
  resolveAvailability,
  sortItems,
  resolveItemForBranch,
} from '@/lib/menuResolver'

const at = (h: number, m = 0, day = 3 /* Wednesday */) => {
  const d = new Date(2026, 8, 30, h, m, 0) // 2026-09-30 is a Wednesday
  if (d.getDay() !== day) {
    // shift to the requested weekday while keeping the time
    d.setDate(d.getDate() + ((day - d.getDay() + 7) % 7))
  }
  return d
}

describe('menuResolver — toMins', () => {
  it('converts HH:MM to minutes', () => {
    expect(toMins('00:00')).toBe(0)
    expect(toMins('06:30')).toBe(390)
    expect(toMins('23:59')).toBe(1439)
  })
  it('returns 0 for missing or malformed input', () => {
    expect(toMins(undefined)).toBe(0)
    expect(toMins('')).toBe(0)
    expect(toMins('abc')).toBe(0)
  })
})

describe('menuResolver — withinWindow', () => {
  it('is always true when no window is configured (opt-in)', () => {
    expect(withinWindow(undefined, at(3))).toBe(true)
  })

  it('is true when only days are set and today matches', () => {
    expect(withinWindow({ days: [3] }, at(10, 0, 3))).toBe(true)
  })

  it('is false when today is not in the allowed days', () => {
    expect(withinWindow({ days: [0, 6] }, at(10, 0, 3))).toBe(false)
  })

  it('treats an empty days array as every day', () => {
    expect(withinWindow({ days: [] }, at(10))).toBe(true)
  })

  it('is true when a window is partially configured (missing endTime)', () => {
    expect(withinWindow({ startTime: '06:00' }, at(23))).toBe(true)
    expect(withinWindow({ endTime: '11:00' }, at(23))).toBe(true)
  })

  it('handles a same-day window inclusively at start and exclusively at end', () => {
    const w = { startTime: '06:00', endTime: '11:00' }
    expect(withinWindow(w, at(6, 0))).toBe(true)    // start boundary
    expect(withinWindow(w, at(9, 30))).toBe(true)   // middle
    expect(withinWindow(w, at(10, 59))).toBe(true)
    expect(withinWindow(w, at(11, 0))).toBe(false)  // end boundary excluded
    expect(withinWindow(w, at(5, 59))).toBe(false)
    expect(withinWindow(w, at(20, 0))).toBe(false)
  })

  it('handles an overnight wrap-around window', () => {
    const w = { startTime: '22:00', endTime: '02:00' }
    expect(withinWindow(w, at(22, 0))).toBe(true)
    expect(withinWindow(w, at(23, 30))).toBe(true)
    expect(withinWindow(w, at(1, 0))).toBe(true)
    expect(withinWindow(w, at(2, 0))).toBe(false)
    expect(withinWindow(w, at(12, 0))).toBe(false)
  })

  it('treats start === end as all day', () => {
    expect(withinWindow({ startTime: '09:00', endTime: '09:00' }, at(3))).toBe(true)
  })

  it('combines days and time', () => {
    const w = { days: [3], startTime: '06:00', endTime: '11:00' }
    expect(withinWindow(w, at(8, 0, 3))).toBe(true)
    expect(withinWindow(w, at(8, 0, 1))).toBe(false) // right time, wrong day
  })
})

describe('menuResolver — pricing', () => {
  it('resolveEffectiveBasePrice prefers the variant price', () => {
    expect(resolveEffectiveBasePrice({ basePrice: 100 }, { basePrice: 60 })).toBe(60)
  })
  it('resolveEffectiveBasePrice falls back to the item price', () => {
    expect(resolveEffectiveBasePrice({ basePrice: 100 })).toBe(100)
    expect(resolveEffectiveBasePrice({ basePrice: 100 }, null)).toBe(100)
  })
  it('resolveEffectiveBasePrice collapses missing values to 0', () => {
    expect(resolveEffectiveBasePrice({})).toBe(0)
    expect(resolveEffectiveBasePrice({}, { basePrice: 0 })).toBe(0)
  })

  it('resolvePrice inherits the base when override is null/undefined', () => {
    expect(resolvePrice(null, 100)).toBe(100)
    expect(resolvePrice(undefined, 100)).toBe(100)
  })
  it('resolvePrice uses the override when present, including 0', () => {
    expect(resolvePrice(80, 100)).toBe(80)
    expect(resolvePrice(0, 100)).toBe(0)
  })

  it('isPriceOverridden is false for null/undefined or equal-to-base', () => {
    expect(isPriceOverridden(null, 100)).toBe(false)
    expect(isPriceOverridden(undefined, 100)).toBe(false)
    expect(isPriceOverridden(100, 100)).toBe(false)
  })
  it('isPriceOverridden is true when it differs from base', () => {
    expect(isPriceOverridden(90, 100)).toBe(true)
    expect(isPriceOverridden(0, 100)).toBe(true)
  })
})

describe('menuResolver — computeMargin', () => {
  it('returns null when cost is unknown', () => {
    expect(computeMargin(100, undefined)).toBeNull()
    expect(computeMargin(100)).toBeNull()
  })
  it('returns null when the price is zero or negative', () => {
    expect(computeMargin(0, 10)).toBeNull()
    expect(computeMargin(-5, 10)).toBeNull()
  })
  it('computes profit and food-cost percentage', () => {
    expect(computeMargin(100, 30)).toEqual({ profit: 70, foodCostPct: 30 })
    expect(computeMargin(60, 25)).toEqual({ profit: 35, foodCostPct: 41.7 })
  })
  it('handles a cost above the price (negative profit)', () => {
    expect(computeMargin(50, 80)).toEqual({ profit: -30, foodCostPct: 160 })
  })
})

describe('menuResolver — applyPriceChange', () => {
  it('applies a percentage increase and decrease with rounding', () => {
    expect(applyPriceChange(100, 'percent', 10)).toBe(110)
    expect(applyPriceChange(100, 'percent', -10)).toBe(90)
    expect(applyPriceChange(95, 'percent', 8)).toBe(103) // 102.6 → 103
  })
  it('applies a flat delta', () => {
    expect(applyPriceChange(100, 'flat', 15)).toBe(115)
    expect(applyPriceChange(100, 'flat', -15)).toBe(85)
  })
  it('sets an absolute value', () => {
    expect(applyPriceChange(100, 'set', 250)).toBe(250)
  })
  it('floors the result at 0', () => {
    expect(applyPriceChange(50, 'flat', -200)).toBe(0)
    expect(applyPriceChange(50, 'percent', -500)).toBe(0)
    expect(applyPriceChange(50, 'set', -10)).toBe(0)
  })
})

describe('menuResolver — resolveAvailability', () => {
  const now = at(10)

  it('is true by default when nothing blocks it', () => {
    expect(resolveAvailability({ item: {}, now })).toBe(true)
  })
  it('is false when the item is inactive', () => {
    expect(resolveAvailability({ item: { isActive: false }, now })).toBe(false)
  })
  it('is false when the branch category is disabled', () => {
    expect(resolveAvailability({ item: {}, branchCategory: { isAvailable: false }, now })).toBe(false)
  })
  it('is false when the branch item mapping is disabled', () => {
    expect(resolveAvailability({ item: {}, branchItem: { isAvailable: false }, now })).toBe(false)
  })
  it('is false when outside the configured window', () => {
    expect(resolveAvailability({
      item: { availability: { startTime: '06:00', endTime: '09:00' } }, now,
    })).toBe(false)
  })
  it('is true when inside the configured window and all mappings allow it', () => {
    expect(resolveAvailability({
      item: { isActive: true, availability: { startTime: '06:00', endTime: '14:00' } },
      branchItem: { isAvailable: true },
      branchCategory: { isAvailable: true },
      now,
    })).toBe(true)
  })
  it('ignores null mappings', () => {
    expect(resolveAvailability({ item: {}, branchItem: null, branchCategory: null, now })).toBe(true)
  })
})

describe('menuResolver — sortItems', () => {
  it('sorts by sortOrder then name and does not mutate the input', () => {
    const input = [
      { name: 'Zeta', sortOrder: 2 },
      { name: 'Alpha', sortOrder: 2 },
      { name: 'Mid', sortOrder: 1 },
    ]
    const out = sortItems(input)
    expect(out.map(i => i.name)).toEqual(['Mid', 'Alpha', 'Zeta'])
    expect(input[0].name).toBe('Zeta') // original untouched
  })
  it('treats a missing sortOrder as 0', () => {
    const out = sortItems([{ name: 'B', sortOrder: 1 }, { name: 'A' }])
    expect(out.map(i => i.name)).toEqual(['A', 'B'])
  })
  it('falls back to name when both sortOrders are missing', () => {
    const out = sortItems([{ name: 'Beta' }, { name: 'Alpha' }])
    expect(out.map(i => i.name)).toEqual(['Alpha', 'Beta'])
  })
})

describe('menuResolver — resolveItemForBranch', () => {
  const item = {
    id: 'mn1', name: 'Masala Dosa', categoryId: 'c1',
    basePrice: 100, costPrice: 40, sortOrder: 1, isActive: true,
  }
  const now = at(10)

  it('inherits the base price when there is no override', () => {
    const r = resolveItemForBranch({ item, variants: [], branchMappings: [], branchCategories: [], now })
    expect(r.price).toBe(100)
    expect(r.basePriceEffective).toBe(100)
    expect(r.isOverridden).toBe(false)
    expect(r.isAvailable).toBe(true)
    expect(r.hasWindow).toBe(false)
    expect(r.margin).toEqual({ profit: 60, foodCostPct: 40 })
    expect(r.variants).toEqual([])
  })

  it('applies a branch override and flags it', () => {
    const r = resolveItemForBranch({
      item, variants: [],
      branchMappings: [{ menuItemId: 'mn1', price: 85, isAvailable: true }],
      branchCategories: [], now,
    })
    expect(r.price).toBe(85)
    expect(r.isOverridden).toBe(true)
    expect(r.margin).toEqual({ profit: 45, foodCostPct: 47.1 })
  })

  it('treats a null override as inheriting', () => {
    const r = resolveItemForBranch({
      item, variants: [],
      branchMappings: [{ menuItemId: 'mn1', price: null, isAvailable: true }],
      branchCategories: [], now,
    })
    expect(r.price).toBe(100)
    expect(r.isOverridden).toBe(false)
  })

  it('marks unavailable when the branch item mapping is off', () => {
    const r = resolveItemForBranch({
      item, variants: [],
      branchMappings: [{ menuItemId: 'mn1', price: null, isAvailable: false }],
      branchCategories: [], now,
    })
    expect(r.isAvailable).toBe(false)
  })

  it('marks unavailable when the branch category is off', () => {
    const r = resolveItemForBranch({
      item, variants: [], branchMappings: [],
      branchCategories: [{ categoryId: 'c1', isAvailable: false }], now,
    })
    expect(r.isAvailable).toBe(false)
  })

  it('reports hasWindow and respects it', () => {
    const windowed = { ...item, availability: { startTime: '06:00', endTime: '09:00' } }
    const r = resolveItemForBranch({ item: windowed, variants: [], branchMappings: [], branchCategories: [], now })
    expect(r.hasWindow).toBe(true)
    expect(r.isAvailable).toBe(false) // now = 10:00, window ends 09:00
  })

  it('resolves variants with their own prices, overrides and availability', () => {
    const variants = [
      { id: 'v2', menuItemId: 'mn1', name: 'Full', basePrice: 120, sortOrder: 2 },
      { id: 'v1', menuItemId: 'mn1', name: 'Half', basePrice: 70, sortOrder: 1 },
      { id: 'vX', menuItemId: 'other', name: 'Ignore me', basePrice: 10 },
      { id: 'vDead', menuItemId: 'mn1', name: 'Retired', basePrice: 10, isActive: false },
    ]
    const r = resolveItemForBranch({
      item, variants,
      branchMappings: [
        { menuItemId: 'mn1', variantId: 'v1', price: 65, isAvailable: true },
        { menuItemId: 'mn1', variantId: 'v2', price: null, isAvailable: false },
      ],
      branchCategories: [], now,
    })
    expect(r.variants.map(v => v.name)).toEqual(['Half', 'Full']) // sorted, filtered
    expect(r.variants[0]).toMatchObject({ basePrice: 70, price: 65, isOverridden: true, isAvailable: true })
    expect(r.variants[1]).toMatchObject({ basePrice: 120, price: 120, isOverridden: false, isAvailable: false })
  })

  it('defaults a variant with no branch mapping to base price and available', () => {
    const r = resolveItemForBranch({
      item,
      variants: [{ id: 'v1', menuItemId: 'mn1', name: 'Half', basePrice: 70 }],
      branchMappings: [],   // no mapping for the variant at all
      branchCategories: [], now,
    })
    expect(r.variants[0]).toMatchObject({
      name: 'Half', basePrice: 70, price: 70, isOverridden: false, isAvailable: true,
    })
  })

  it('returns a null margin when cost is not set', () => {
    const r = resolveItemForBranch({
      item: { ...item, costPrice: undefined }, variants: [],
      branchMappings: [], branchCategories: [], now,
    })
    expect(r.margin).toBeNull()
  })
})

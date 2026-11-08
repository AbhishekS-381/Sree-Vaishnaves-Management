import { describe, it, expect } from 'vitest'
import { resolveItemPriceAndName } from '@/lib/posUtils'
import type { CatalogItem } from '@/app/actions/posTypes'

describe('resolveItemPriceAndName pricing strategy', () => {
  const itemWithOverrides: CatalogItem = {
    menuItemId: 'm1',
    name: 'Masala Dosa',
    categoryId: 'c1',
    effectivePrice: 60,
    acPrice: 75,
    parcelPrice: 70,
  }

  const itemWithoutOverrides: CatalogItem = {
    menuItemId: 'm2',
    name: 'Tea',
    categoryId: 'c1',
    effectivePrice: 15,
  }

  describe('Static Item Pricing Mode (item_price)', () => {
    it('uses parcel price and prefixes name with Parcel for takeaway orders', () => {
      const res = resolveItemPriceAndName(
        itemWithOverrides,
        { orderType: 'takeaway' },
        false,
        'item_price'
      )
      expect(res.unitPrice).toBe(70)
      expect(res.nameSnapshot).toBe('Parcel Masala Dosa')
    })

    it('falls back to base price when item has no parcel price in takeaway', () => {
      const res = resolveItemPriceAndName(
        itemWithoutOverrides,
        { orderType: 'takeaway' },
        false,
        'item_price'
      )
      expect(res.unitPrice).toBe(15)
      expect(res.nameSnapshot).toBe('Parcel Tea')
    })

    it('uses AC price and prefixes name with AC for AC table dine-in orders', () => {
      const res = resolveItemPriceAndName(
        itemWithOverrides,
        { orderType: 'dine-in', tableId: 't1' },
        true, // isTableAc = true
        'item_price'
      )
      expect(res.unitPrice).toBe(75)
      expect(res.nameSnapshot).toBe('AC Masala Dosa')
    })

    it('falls back to base price when item has no AC price in AC table dine-in', () => {
      const res = resolveItemPriceAndName(
        itemWithoutOverrides,
        { orderType: 'dine-in', tableId: 't1' },
        true,
        'item_price'
      )
      expect(res.unitPrice).toBe(15)
      expect(res.nameSnapshot).toBe('AC Tea')
    })

    it('uses base price and standard name for non-AC table dine-in', () => {
      const res = resolveItemPriceAndName(
        itemWithOverrides,
        { orderType: 'dine-in', tableId: 't1' },
        false, // isTableAc = false
        'item_price'
      )
      expect(res.unitPrice).toBe(60)
      expect(res.nameSnapshot).toBe('Masala Dosa')
    })

    it('uses parcel price and prefixes name with Parcel for mixed parcel items on dine-in orders', () => {
      const res = resolveItemPriceAndName(
        itemWithOverrides,
        { orderType: 'dine-in', tableId: 't1' },
        true, // table is AC
        'item_price',
        true // isItemParcel = true
      )
      expect(res.unitPrice).toBe(70)
      expect(res.nameSnapshot).toBe('Parcel Masala Dosa')
    })

    it('does not duplicate prefix if item name already starts with Parcel or AC', () => {
      const alreadyAcItem: CatalogItem = {
        ...itemWithOverrides,
        name: 'AC Masala Dosa',
      }
      const res = resolveItemPriceAndName(
        alreadyAcItem,
        { orderType: 'dine-in', tableId: 't1' },
        true,
        'item_price'
      )
      expect(res.nameSnapshot).toBe('AC Masala Dosa')
    })
  })

  describe('Percentage Pricing Mode (percentage)', () => {
    it('uses base price and standard name for takeaway orders (surcharge calculated on bill)', () => {
      const res = resolveItemPriceAndName(
        itemWithOverrides,
        { orderType: 'takeaway' },
        false,
        'percentage'
      )
      expect(res.unitPrice).toBe(60)
      expect(res.nameSnapshot).toBe('Masala Dosa')
    })

    it('uses base price and standard name for AC table dine-in (surcharge calculated on bill)', () => {
      const res = resolveItemPriceAndName(
        itemWithOverrides,
        { orderType: 'dine-in', tableId: 't1' },
        true,
        'percentage'
      )
      expect(res.unitPrice).toBe(60)
      expect(res.nameSnapshot).toBe('Masala Dosa')
    })
  })
})


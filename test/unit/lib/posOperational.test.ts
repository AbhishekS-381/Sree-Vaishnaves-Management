import { describe, it, expect } from 'vitest'
import {
  getElapsedMinutes,
  getKotUrgencyTier,
  formatElapsedDuration,
  detectNewIncomingKots,
  getOperationalPollingInterval,
} from '@/lib/posOperational'
import type { PosKot } from '@/app/actions/posTypes'

describe('POS Kitchen & Billing Operational Helpers - posOperational.test.ts', () => {
  const baseTime = 1760870400000 // 2026-10-19T10:40:00.000Z

  const sampleKot: PosKot = {
    id: 'kot-101',
    orderId: 'ord-1',
    branchId: 'br-1',
    kotNumber: 1,
    status: 'pending',
    firedBy: 'usr-1',
    firedAt: new Date(baseTime).toISOString(),
    updatedAt: new Date(baseTime).toISOString(),
    items: [{ menuItemId: 'm1', nameSnapshot: 'Dosa', quantity: 1 }],
  }

  // =========================================================================
  // 1. getElapsedMinutes
  // =========================================================================
  describe('getElapsedMinutes', () => {
    it('returns 0 when elapsed time is under 1 minute', () => {
      const now = baseTime + 30 * 1000 // 30 seconds later
      expect(getElapsedMinutes(sampleKot.firedAt, now)).toBe(0)
    })

    it('returns exact whole minutes elapsed', () => {
      const now = baseTime + 7 * 60 * 1000 + 45 * 1000 // 7 mins 45 secs
      expect(getElapsedMinutes(sampleKot.firedAt, now)).toBe(7)
    })

    it('handles tickets over an hour old', () => {
      const now = baseTime + 75 * 60 * 1000 // 75 mins
      expect(getElapsedMinutes(sampleKot.firedAt, now)).toBe(75)
    })

    it('returns 0 for invalid ISO timestamp string', () => {
      expect(getElapsedMinutes('invalid-timestamp-string', baseTime)).toBe(0)
    })

    it('clamps future timestamps to 0 to prevent negative elapsed times', () => {
      const nowInPast = baseTime - 60 * 1000 // 1 minute in the past
      expect(getElapsedMinutes(sampleKot.firedAt, nowInPast)).toBe(0)
    })
  })

  // =========================================================================
  // 2. getKotUrgencyTier
  // =========================================================================
  describe('getKotUrgencyTier', () => {
    it('returns "normal" for elapsed minutes < 10', () => {
      expect(getKotUrgencyTier(0)).toBe('normal')
      expect(getKotUrgencyTier(5)).toBe('normal')
      expect(getKotUrgencyTier(9)).toBe('normal')
    })

    it('returns "warning" for elapsed minutes between 10 and 19', () => {
      expect(getKotUrgencyTier(10)).toBe('warning')
      expect(getKotUrgencyTier(15)).toBe('warning')
      expect(getKotUrgencyTier(19)).toBe('warning')
    })

    it('returns "critical" for elapsed minutes >= 20', () => {
      expect(getKotUrgencyTier(20)).toBe('critical')
      expect(getKotUrgencyTier(25)).toBe('critical')
      expect(getKotUrgencyTier(60)).toBe('critical')
    })
  })

  // =========================================================================
  // 3. formatElapsedDuration
  // =========================================================================
  describe('formatElapsedDuration', () => {
    it('formats 0 seconds as "00:00"', () => {
      expect(formatElapsedDuration(sampleKot.firedAt, baseTime)).toBe('00:00')
    })

    it('formats seconds under a minute with zero-padded seconds "00:45"', () => {
      const now = baseTime + 45 * 1000
      expect(formatElapsedDuration(sampleKot.firedAt, now)).toBe('00:45')
    })

    it('formats minutes and seconds accurately "04:09"', () => {
      const now = baseTime + (4 * 60 + 9) * 1000
      expect(formatElapsedDuration(sampleKot.firedAt, now)).toBe('04:09')
    })

    it('formats over 10 minutes with two digits "18:32"', () => {
      const now = baseTime + (18 * 60 + 32) * 1000
      expect(formatElapsedDuration(sampleKot.firedAt, now)).toBe('18:32')
    })

    it('formats hours into total minutes "85:12"', () => {
      const now = baseTime + (85 * 60 + 12) * 1000
      expect(formatElapsedDuration(sampleKot.firedAt, now)).toBe('85:12')
    })

    it('returns "00:00" for invalid ISO string', () => {
      expect(formatElapsedDuration('not-a-date', baseTime)).toBe('00:00')
    })
  })

  // =========================================================================
  // 4. detectNewIncomingKots
  // =========================================================================
  describe('detectNewIncomingKots', () => {
    it('returns empty array on initial page load (when previousKotIds is empty) to prevent initial blast', () => {
      const previous = new Set<string>()
      const incoming = [sampleKot]
      const toChime = detectNewIncomingKots(previous, incoming)
      expect(toChime).toEqual([])
    })

    it('returns empty array when incoming KOTs were already known', () => {
      const previous = new Set<string>(['kot-101'])
      const incoming = [sampleKot]
      const toChime = detectNewIncomingKots(previous, incoming)
      expect(toChime).toEqual([])
    })

    it('detects a new KOT ID and returns it for audio notification', () => {
      const previous = new Set<string>(['kot-101'])
      const newKot: PosKot = {
        ...sampleKot,
        id: 'kot-102',
        kotNumber: 2,
      }
      const incoming = [sampleKot, newKot]
      const toChime = detectNewIncomingKots(previous, incoming)

      expect(toChime).toHaveLength(1)
      expect(toChime[0].id).toBe('kot-102')
    })

    it('detects multiple newly arrived KOTs simultaneously', () => {
      const previous = new Set<string>(['kot-100'])
      const kotA: PosKot = { ...sampleKot, id: 'kot-101' }
      const kotB: PosKot = { ...sampleKot, id: 'kot-102' }
      const incoming = [kotA, kotB]

      const toChime = detectNewIncomingKots(previous, incoming)
      expect(toChime).toHaveLength(2)
      expect(toChime.map(k => k.id)).toEqual(['kot-101', 'kot-102'])
    })

    it('returns empty array when incoming KOTs list is empty', () => {
      const previous = new Set<string>(['kot-101'])
      expect(detectNewIncomingKots(previous, [])).toEqual([])
    })
  })

  // =========================================================================
  // 5. getOperationalPollingInterval
  // =========================================================================
  describe('getOperationalPollingInterval', () => {
    it('returns 10,000ms by default when tab is active (not hidden)', () => {
      expect(getOperationalPollingInterval(false)).toBe(10000)
    })

    it('returns custom base interval when provided and tab is active', () => {
      expect(getOperationalPollingInterval(false, 5000)).toBe(5000)
    })

    it('throttles to 30,000ms when document is hidden to conserve background battery/network', () => {
      expect(getOperationalPollingInterval(true, 5000)).toBe(30000)
      expect(getOperationalPollingInterval(true, 10000)).toBe(30000)
    })
  })
})

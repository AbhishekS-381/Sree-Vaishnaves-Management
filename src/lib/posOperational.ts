/**
 * Pure operational utilities for POS Kitchen Displays, Billing queues,
 * ticket aging timers, urgency tiers, and notification triggers.
 */

import type { PosKot } from '@/app/actions/posTypes'

export type UrgencyTier = 'normal' | 'warning' | 'critical'

/**
 * Computes elapsed time in minutes from an ISO timestamp to now.
 */
export function getElapsedMinutes(isoTimestamp: string, nowMs: number = Date.now()): number {
  const firedMs = new Date(isoTimestamp).getTime()
  if (isNaN(firedMs)) return 0
  const diffMs = Math.max(0, nowMs - firedMs)
  return Math.floor(diffMs / (1000 * 60))
}

/**
 * Categorizes KOT urgency based on elapsed minutes:
 * - normal: < 10 mins
 * - warning: 10 to 20 mins
 * - critical: > 20 mins
 */
export function getKotUrgencyTier(elapsedMinutes: number): UrgencyTier {
  if (elapsedMinutes >= 20) return 'critical'
  if (elapsedMinutes >= 10) return 'warning'
  return 'normal'
}

/**
 * Formats elapsed time as MM:SS string for live dashboard timers.
 */
export function formatElapsedDuration(isoTimestamp: string, nowMs: number = Date.now()): string {
  const firedMs = new Date(isoTimestamp).getTime()
  if (isNaN(firedMs)) return '00:00'
  const diffSec = Math.max(0, Math.floor((nowMs - firedMs) / 1000))
  const minutes = Math.floor(diffSec / 60)
  const seconds = diffSec % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

/**
 * Compares current incoming KOTs against previously known KOT IDs
 * and returns the list of newly arrived KOT IDs that should trigger an audio chime.
 */
export function detectNewIncomingKots(
  previousKotIds: Set<string>,
  incomingKots: PosKot[]
): PosKot[] {
  if (previousKotIds.size === 0) return [] // Initial page load does not chime
  return incomingKots.filter(kot => !previousKotIds.has(kot.id))
}

/**
 * Returns dynamic polling interval in ms based on browser tab visibility:
 * - Active tab: 10,000ms (10s)
 * - Inactive / hidden tab: 30,000ms (30s) or paused (0)
 */
export function getOperationalPollingInterval(
  isDocumentHidden: boolean,
  baseIntervalMs: number = 10000
): number {
  if (isDocumentHidden) return 30000 // Slow down polling to save resources
  return baseIntervalMs
}

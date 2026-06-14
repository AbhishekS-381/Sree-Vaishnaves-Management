import { describe, it, expect } from 'vitest'
import { cn } from '@/lib/utils'

describe('utils.ts - cn()', () => {
  it('merges class names correctly', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('handles conditional classes', () => {
    expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz')
  })

  it('deduplicates tailwind conflicting classes (last wins)', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
  })

  it('handles undefined and null gracefully', () => {
    expect(cn(undefined, null as any, 'base')).toBe('base')
  })

  it('returns empty string for no arguments', () => {
    expect(cn()).toBe('')
  })
})

import { describe, it, expect } from 'vitest'
import { computePositionsSummary } from '@/lib/positionsSummary'

describe('computePositionsSummary', () => {
  it('returns zeros when both arrays are empty', () => {
    const result = computePositionsSummary([], [])
    expect(result).toEqual({
      totalPositions: 0,
      filledPositions: 0,
      vacantPositions: 0,
      totalSalary: 0,
    })
  })

  it('sums totalPositions from requiredCount', () => {
    const requirements = [
      { id: 'r1', requiredCount: 3 },
      { id: 'r2', requiredCount: 2 },
    ]
    const result = computePositionsSummary(requirements, [])
    expect(result.totalPositions).toBe(5)
  })

  it('counts filled positions from active staff with matching positionId', () => {
    const requirements = [
      { id: 'r1', requiredCount: 3 },
    ]
    const staff = [
      { positionId: 'r1', isActive: true },
      { positionId: 'r1', isActive: true },
      { positionId: 'r1', isActive: false }, // inactive — should not count
      { positionId: 'r2', isActive: true },  // different position — should not count
    ]
    const result = computePositionsSummary(requirements, staff)
    expect(result.filledPositions).toBe(2)
  })

  it('computes vacant as totalPositions minus filledPositions', () => {
    const requirements = [
      { id: 'r1', requiredCount: 5 },
    ]
    const staff = [
      { positionId: 'r1', isActive: true },
      { positionId: 'r1', isActive: true },
    ]
    const result = computePositionsSummary(requirements, staff)
    expect(result.vacantPositions).toBe(3)
  })

  it('clamps vacant to zero when over-filled', () => {
    const requirements = [
      { id: 'r1', requiredCount: 1 },
    ]
    const staff = [
      { positionId: 'r1', isActive: true },
      { positionId: 'r1', isActive: true },
      { positionId: 'r1', isActive: true },
    ]
    const result = computePositionsSummary(requirements, staff)
    expect(result.vacantPositions).toBe(0)
    expect(result.filledPositions).toBe(3)
  })

  it('computes totalSalary as defaultSalary × requiredCount per requirement', () => {
    const requirements = [
      { id: 'r1', requiredCount: 2, defaultSalary: 30000 },
      { id: 'r2', requiredCount: 3, defaultSalary: 20000 },
    ]
    const result = computePositionsSummary(requirements, [])
    // (2 × 30000) + (3 × 20000) = 60000 + 60000 = 120000
    expect(result.totalSalary).toBe(120000)
  })

  it('treats missing defaultSalary as zero', () => {
    const requirements = [
      { id: 'r1', requiredCount: 4 },
      { id: 'r2', requiredCount: 2, defaultSalary: 15000 },
    ]
    const result = computePositionsSummary(requirements, [])
    expect(result.totalSalary).toBe(30000) // 0 + 30000
  })

  it('handles multiple requirements with mixed staff', () => {
    const requirements = [
      { id: 'r1', requiredCount: 3, defaultSalary: 25000 },
      { id: 'r2', requiredCount: 2, defaultSalary: 18000 },
    ]
    const staff = [
      { positionId: 'r1', isActive: true },
      { positionId: 'r1', isActive: true },
      { positionId: 'r2', isActive: true },
      { positionId: 'r2', isActive: false }, // inactive
      { isActive: true },                     // no positionId
    ]
    const result = computePositionsSummary(requirements, staff)
    expect(result.totalPositions).toBe(5)
    expect(result.filledPositions).toBe(3)  // 2 for r1 + 1 for r2
    expect(result.vacantPositions).toBe(2)  // 5 - 3
    expect(result.totalSalary).toBe(111000) // (3×25000) + (2×18000)
  })

  it('ignores staff without positionId', () => {
    const requirements = [
      { id: 'r1', requiredCount: 2 },
    ]
    const staff = [
      { isActive: true },
      { isActive: true },
    ]
    const result = computePositionsSummary(requirements, staff)
    expect(result.filledPositions).toBe(0)
    expect(result.vacantPositions).toBe(2)
  })
})

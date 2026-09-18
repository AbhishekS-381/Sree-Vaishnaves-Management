import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useEODSave } from '@/hooks/useEODSave'

vi.mock('@/app/actions/eod', () => ({
  saveEODEntry: vi.fn()
}))

describe('useEODSave', () => {
  const income = { dineInCash: 100, dineInUpi: 50, takeawayCash: 30, takeawayUpi: 20 }
  const expenses = [{ id: 'e1', amount: 10, categoryId: 'Food', notes: 'Lunch' }]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns error when branch or date missing', async () => {
    const { result } = renderHook(() => useEODSave('', '2023-10-01'))
    let res: any
    await act(async () => {
      res = await result.current.handleSave(income, expenses as any, 'notes', 100, 90, null, null)
    })
    expect(res).toEqual({ error: 'Branch and Date are required' })
  })

  it('returns error when date missing', async () => {
    const { result } = renderHook(() => useEODSave('b1', ''))
    let res: any
    await act(async () => {
      res = await result.current.handleSave(income, expenses as any, 'notes', 100, 90, null, null)
    })
    expect(res).toEqual({ error: 'Branch and Date are required' })
  })

  it('saves successfully and returns success', async () => {
    const { saveEODEntry } = await import('@/app/actions/eod')
    vi.mocked(saveEODEntry).mockResolvedValue({ success: true })
    const { result } = renderHook(() => useEODSave('b1', '2023-10-01'))
    
    const billing = { totalBillAmount: 1000, billCount: 5, dineInCovers: 20, takeawayOrders: 2, cashCollectedAsBilled: 500, upiCollectedAsBilled: 500, voids: 0, discounts: 0, gstCollected: 50 }
    const ops = { staffOnDuty: 5, powerCutHours: 0, unusualEvent: 'Festival', kitchenIssue: false, zeroRevenueConfirmed: false }
    
    let res: any
    await act(async () => {
      res = await result.current.handleSave(income, expenses as any, 'Good day', 100, 90, billing, ops)
    })
    expect(res).toEqual({ success: true })
    expect(saveEODEntry).toHaveBeenCalledWith(
      expect.objectContaining({ branchId: 'b1', date: '2023-10-01', billing, ops }), 
      expect.arrayContaining([expect.objectContaining({ categoryId: 'Food' })])
    )
  })

  it('handles server error response', async () => {
    const { saveEODEntry } = await import('@/app/actions/eod')
    vi.mocked(saveEODEntry).mockResolvedValue({ error: 'EOD is locked' })
    const { result } = renderHook(() => useEODSave('b1', '2023-10-01'))
    let res: any
    await act(async () => {
      res = await result.current.handleSave(income, [], 'notes', 0, 0, null, null)
    })
    expect(res).toEqual({ error: 'EOD is locked' })
  })

  it('handles network exception', async () => {
    const { saveEODEntry } = await import('@/app/actions/eod')
    vi.mocked(saveEODEntry).mockRejectedValue(new Error('Network error'))
    const { result } = renderHook(() => useEODSave('b1', '2023-10-01'))
    let res: any
    await act(async () => {
      res = await result.current.handleSave(income, [], 'notes', 0, 0, null, null)
    })
    expect(res).toEqual({ error: 'Failed to save EOD. Please try again.' })
  })

  it('bubbles up ZERO_REVENUE_UNCONFIRMED', async () => {
    const { saveEODEntry } = await import('@/app/actions/eod')
    vi.mocked(saveEODEntry).mockResolvedValue({ error: 'ZERO_REVENUE_UNCONFIRMED' })
    const { result } = renderHook(() => useEODSave('b1', '2023-10-01'))
    let res: any
    await act(async () => {
      res = await result.current.handleSave(income, [], 'notes', 0, 0, null, null)
    })
    expect(res).toEqual({ error: 'ZERO_REVENUE_UNCONFIRMED' })
  })

  it('isSaving is false when idle', () => {
    const { result } = renderHook(() => useEODSave('b1', '2023-10-01'))
    expect(result.current.isSaving).toBe(false)
  })
})

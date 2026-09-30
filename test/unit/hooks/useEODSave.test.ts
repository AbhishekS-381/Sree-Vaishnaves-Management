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

  it('converts empty-string floats to undefined rather than 0', async () => {
    const { saveEODEntry } = await import('@/app/actions/eod')
    vi.mocked(saveEODEntry).mockResolvedValue({ success: true })
    const { result } = renderHook(() => useEODSave('b1', '2023-10-01'))

    await act(async () => {
      await result.current.handleSave(income, [], 'notes', '', '', null, null)
    })

    const entry = vi.mocked(saveEODEntry).mock.calls[0][0] as any
    expect(entry.openingFloat).toBeUndefined()
    expect(entry.actualClosingFloat).toBeUndefined()
  })

  it('passes numeric floats through', async () => {
    const { saveEODEntry } = await import('@/app/actions/eod')
    vi.mocked(saveEODEntry).mockResolvedValue({ success: true })
    const { result } = renderHook(() => useEODSave('b1', '2023-10-01'))

    await act(async () => {
      await result.current.handleSave(income, [], 'notes', 500, 480, null, null)
    })

    const entry = vi.mocked(saveEODEntry).mock.calls[0][0] as any
    expect(entry.openingFloat).toBe(500)
    expect(entry.actualClosingFloat).toBe(480)
  })

  it('normalises null billing/ops to undefined', async () => {
    const { saveEODEntry } = await import('@/app/actions/eod')
    vi.mocked(saveEODEntry).mockResolvedValue({ success: true })
    const { result } = renderHook(() => useEODSave('b1', '2023-10-01'))

    await act(async () => {
      await result.current.handleSave(income, [], '', 0, 0, null, null)
    })

    const entry = vi.mocked(saveEODEntry).mock.calls[0][0] as any
    expect(entry.billing).toBeUndefined()
    expect(entry.ops).toBeUndefined()
  })

  it('maps each expense onto the branch and date', async () => {
    const { saveEODEntry } = await import('@/app/actions/eod')
    vi.mocked(saveEODEntry).mockResolvedValue({ success: true })
    const { result } = renderHook(() => useEODSave('b1', '2023-10-01'))

    await act(async () => {
      await result.current.handleSave(
        income,
        [{ id: 'e1', amount: 10, categoryId: 'c1', notes: 'x' },
         { id: 'e2', amount: 20, categoryId: 'c2' }] as any,
        '', 0, 0, null, null
      )
    })

    const expensesOut = vi.mocked(saveEODEntry).mock.calls[0][1] as any[]
    expect(expensesOut).toHaveLength(2)
    expensesOut.forEach(e => {
      expect(e.branchId).toBe('b1')
      expect(e.date).toBe('2023-10-01')
    })
  })

  it('resets isSaving after a failed save', async () => {
    const { saveEODEntry } = await import('@/app/actions/eod')
    vi.mocked(saveEODEntry).mockRejectedValue(new Error('boom'))
    const { result } = renderHook(() => useEODSave('b1', '2023-10-01'))

    await act(async () => {
      await result.current.handleSave(income, [], '', 0, 0, null, null)
    })
    expect(result.current.isSaving).toBe(false)
  })
})

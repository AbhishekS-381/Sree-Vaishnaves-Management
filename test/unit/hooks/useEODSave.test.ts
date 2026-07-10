import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useEODSave } from '@/hooks/useEODSave'

vi.mock('@/app/actions/eod', () => ({
  saveEODEntry: vi.fn()
}))

// Suppress alert/window.alert in tests
vi.stubGlobal('alert', vi.fn())

describe('useEODSave', () => {
  const income = { dineInCash: 100, dineInUpi: 50, takeawayCash: 30, takeawayUpi: 20 }
  const expenses = [{ id: 'e1', amount: 10, category: 'Food', notes: 'Lunch' }]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns error when branch or date missing', async () => {
    const { result } = renderHook(() => useEODSave('', '2023-10-01'))
    let res: any
    await act(async () => {
      res = await result.current.handleSave(income, expenses, 'notes', 100, 90)
    })
    expect(res).toEqual({ error: 'Branch and Date are required' })
  })

  it('returns error when date missing', async () => {
    const { result } = renderHook(() => useEODSave('b1', ''))
    let res: any
    await act(async () => {
      res = await result.current.handleSave(income, expenses, 'notes', 100, 90)
    })
    expect(res).toEqual({ error: 'Branch and Date are required' })
  })

  it('saves successfully and returns success', async () => {
    const { saveEODEntry } = await import('@/app/actions/eod')
    vi.mocked(saveEODEntry).mockResolvedValue({ success: true })
    const { result } = renderHook(() => useEODSave('b1', '2023-10-01'))
    let res: any
    await act(async () => {
      res = await result.current.handleSave(income, expenses, 'Good day', 100, 90)
    })
    expect(res).toEqual({ success: true })
    expect(saveEODEntry).toHaveBeenCalledTimes(1)
  })

  it('handles server error response', async () => {
    const { saveEODEntry } = await import('@/app/actions/eod')
    vi.mocked(saveEODEntry).mockResolvedValue({ error: 'EOD is locked' })
    const { result } = renderHook(() => useEODSave('b1', '2023-10-01'))
    let res: any
    await act(async () => {
      res = await result.current.handleSave(income, [], 'notes', '', '')
    })
    expect(res).toEqual({ success: false })
    expect(alert).toHaveBeenCalledWith('EOD is locked')
  })

  it('handles network exception', async () => {
    const { saveEODEntry } = await import('@/app/actions/eod')
    vi.mocked(saveEODEntry).mockRejectedValue(new Error('Network error'))
    const { result } = renderHook(() => useEODSave('b1', '2023-10-01'))
    let res: any
    await act(async () => {
      res = await result.current.handleSave(income, [], 'notes', 0, 0)
    })
    expect(res).toEqual({ success: false })
    expect(alert).toHaveBeenCalledWith('Failed to save EOD')
  })

  it('isSaving is false when idle', () => {
    const { result } = renderHook(() => useEODSave('b1', '2023-10-01'))
    expect(result.current.isSaving).toBe(false)
  })
})

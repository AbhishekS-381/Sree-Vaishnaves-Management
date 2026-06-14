import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDraft } from '@/lib/useDraft'

// jsdom provides localStorage out of the box
describe('useDraft hook', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('saveDraft stores data in localStorage', () => {
    const { result } = renderHook(() => useDraft('test'))
    act(() => {
      result.current.saveDraft('add', { name: 'Pizza' })
    })
    const stored = JSON.parse(window.localStorage.getItem('draft_test_add')!)
    expect(stored).toEqual({ name: 'Pizza' })
  })

  it('loadDraft retrieves stored data', () => {
    window.localStorage.setItem('draft_test_edit', JSON.stringify({ name: 'Burger' }))
    const { result } = renderHook(() => useDraft('test'))
    let loaded: any
    act(() => {
      loaded = result.current.loadDraft('edit')
    })
    expect(loaded).toEqual({ name: 'Burger' })
  })

  it('loadDraft returns null when no draft exists', () => {
    const { result } = renderHook(() => useDraft('test'))
    let loaded: any
    act(() => {
      loaded = result.current.loadDraft('nonexistent')
    })
    expect(loaded).toBeNull()
  })

  it('clearDraft removes data from localStorage', () => {
    window.localStorage.setItem('draft_test_add', JSON.stringify({ name: 'Pizza' }))
    const { result } = renderHook(() => useDraft('test'))
    act(() => {
      result.current.clearDraft('add')
    })
    expect(window.localStorage.getItem('draft_test_add')).toBeNull()
  })

  it('saveDraft handles localStorage errors gracefully', () => {
    const originalSetItem = window.localStorage.setItem
    window.localStorage.setItem = () => { throw new Error('Storage full') }
    const { result } = renderHook(() => useDraft('test'))
    // Should not throw
    expect(() => act(() => { result.current.saveDraft('add', { name: 'test' }) })).not.toThrow()
    window.localStorage.setItem = originalSetItem
  })

  it('loadDraft handles localStorage errors gracefully (returns null)', () => {
    window.localStorage.setItem('draft_test_bad', 'invalid-json{{{')
    const { result } = renderHook(() => useDraft('test'))
    let loaded: any
    act(() => {
      loaded = result.current.loadDraft('bad')
    })
    expect(loaded).toBeNull()
  })

  it('clearDraft handles localStorage errors gracefully', () => {
    const originalRemoveItem = window.localStorage.removeItem
    window.localStorage.removeItem = () => { throw new Error('Error') }
    const { result } = renderHook(() => useDraft('test'))
    expect(() => act(() => { result.current.clearDraft('add') })).not.toThrow()
    window.localStorage.removeItem = originalRemoveItem
  })
})

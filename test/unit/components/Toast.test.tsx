import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { renderHook } from '@testing-library/react'
import { useToast, ToastStack } from '@/components/Toast'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('useToast', () => {
  it('starts with no messages', () => {
    const { result } = renderHook(() => useToast())
    expect(result.current.messages).toEqual([])
  })

  it('pushes success, error and info messages with the right kind', () => {
    const { result } = renderHook(() => useToast())
    act(() => { result.current.success('saved') })
    act(() => { result.current.error('boom') })
    act(() => { result.current.info('fyi') })

    expect(result.current.messages).toHaveLength(3)
    expect(result.current.messages.map(m => m.kind)).toEqual(['success', 'error', 'info'])
    expect(result.current.messages.map(m => m.text)).toEqual(['saved', 'boom', 'fyi'])
  })

  it('auto-dismisses non-error toasts after 3s', () => {
    const { result } = renderHook(() => useToast())
    act(() => { result.current.success('saved') })
    expect(result.current.messages).toHaveLength(1)

    act(() => { vi.advanceTimersByTime(2999) })
    expect(result.current.messages).toHaveLength(1)

    act(() => { vi.advanceTimersByTime(1) })
    expect(result.current.messages).toHaveLength(0)
  })

  it('keeps error toasts for 6s', () => {
    const { result } = renderHook(() => useToast())
    act(() => { result.current.error('boom') })

    act(() => { vi.advanceTimersByTime(3000) })
    expect(result.current.messages).toHaveLength(1)   // still visible

    act(() => { vi.advanceTimersByTime(3000) })
    expect(result.current.messages).toHaveLength(0)
  })

  it('dismisses a specific message by id and leaves the rest', () => {
    const { result } = renderHook(() => useToast())
    act(() => { result.current.success('one') })
    act(() => { result.current.success('two') })
    const firstId = result.current.messages[0].id

    act(() => { result.current.dismiss(firstId) })
    expect(result.current.messages.map(m => m.text)).toEqual(['two'])
  })

  it('assigns unique ids even for simultaneous pushes', () => {
    const { result } = renderHook(() => useToast())
    act(() => {
      result.current.success('a')
      result.current.success('b')
    })
    const ids = result.current.messages.map(m => m.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('ToastStack', () => {
  it('renders nothing when there are no messages', () => {
    const { container } = render(<ToastStack messages={[]} onDismiss={vi.fn()} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders each message with an accessible live region', () => {
    render(
      <ToastStack
        messages={[
          { id: 1, kind: 'success', text: 'Saved' },
          { id: 2, kind: 'error', text: 'Failed' },
        ]}
        onDismiss={vi.fn()}
      />
    )
    const stack = screen.getByTestId('toast-stack')
    expect(stack.getAttribute('aria-live')).toBe('polite')
    expect(stack.textContent).toContain('Saved')
    expect(stack.textContent).toContain('Failed')
  })

  it('applies a distinct style per kind', () => {
    const { container } = render(
      <ToastStack
        messages={[
          { id: 1, kind: 'success', text: 's' },
          { id: 2, kind: 'error', text: 'e' },
          { id: 3, kind: 'info', text: 'i' },
        ]}
        onDismiss={vi.fn()}
      />
    )
    expect(container.querySelector('.border-emerald-500\\/30')).toBeTruthy()
    expect(container.querySelector('.border-red-500\\/30')).toBeTruthy()
    expect(container.querySelector('.border-blue-500\\/30')).toBeTruthy()
  })

  it('calls onDismiss with the message id when the close button is clicked', () => {
    const onDismiss = vi.fn()
    render(
      <ToastStack messages={[{ id: 42, kind: 'info', text: 'hi' }]} onDismiss={onDismiss} />
    )
    fireEvent.click(screen.getByLabelText('Dismiss'))
    expect(onDismiss).toHaveBeenCalledWith(42)
  })
})

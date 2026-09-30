import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BulkActionBar } from '@/components/BulkActionBar'

vi.mock('lucide-react')

const setup = (over: Partial<React.ComponentProps<typeof BulkActionBar>> = {}) => {
  const onClear = vi.fn()
  const onSetAvailability = vi.fn().mockResolvedValue(undefined)
  const onPriceChange = vi.fn().mockResolvedValue(undefined)
  const utils = render(
    <BulkActionBar
      selectedCount={3}
      branchName="Main"
      onClear={onClear}
      onSetAvailability={onSetAvailability}
      onPriceChange={onPriceChange}
      {...over}
    />
  )
  return { ...utils, onClear, onSetAvailability, onPriceChange }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})

describe('BulkActionBar — visibility', () => {
  it('renders nothing when nothing is selected', () => {
    const { container } = setup({ selectedCount: 0 })
    expect(container.firstChild).toBeNull()
  })

  it('shows the selected count and the branch-scoped controls', () => {
    setup()
    expect(screen.getByTestId('bulk-action-bar')).toBeTruthy()
    expect(screen.getByText('3 selected')).toBeTruthy()
    expect(screen.getByText('Enable')).toBeTruthy()
    expect(screen.getByText('Disable')).toBeTruthy()
  })

  it('calls onClear', () => {
    const { onClear } = setup()
    fireEvent.click(screen.getByText('Clear'))
    expect(onClear).toHaveBeenCalled()
  })
})

describe('BulkActionBar — availability', () => {
  it('enables after confirmation', async () => {
    const { onSetAvailability } = setup()
    fireEvent.click(screen.getByText('Enable'))
    await waitFor(() => expect(onSetAvailability).toHaveBeenCalledWith(true))
  })

  it('disables after confirmation', async () => {
    const { onSetAvailability } = setup()
    fireEvent.click(screen.getByText('Disable'))
    await waitFor(() => expect(onSetAvailability).toHaveBeenCalledWith(false))
  })

  it('aborts when the confirmation is declined', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const { onSetAvailability } = setup()
    fireEvent.click(screen.getByText('Enable'))
    await waitFor(() => expect(onSetAvailability).not.toHaveBeenCalled())
  })

  it('includes the branch name in the confirmation', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    setup({ branchName: 'Talap' })
    fireEvent.click(screen.getByText('Disable'))
    await waitFor(() => expect(confirmSpy.mock.calls[0][0]).toContain('Talap'))
  })

  it('disables the buttons while busy', () => {
    setup({ busy: true })
    expect((screen.getByText('Enable').closest('button') as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByText('Disable').closest('button') as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('BulkActionBar — price change', () => {
  const value = () => screen.getByLabelText('Price change value') as HTMLInputElement
  const mode = () => screen.getByLabelText('Price change mode') as HTMLSelectElement
  const apply = () => screen.getByText('Apply').closest('button') as HTMLButtonElement

  it('keeps Apply disabled until a valid value is entered', () => {
    setup()
    expect(apply().disabled).toBe(true)
    fireEvent.change(value(), { target: { value: '10' } })
    expect(apply().disabled).toBe(false)
  })

  it('applies a percentage change', async () => {
    const { onPriceChange } = setup()
    fireEvent.change(value(), { target: { value: '10' } })
    fireEvent.click(apply())
    await waitFor(() => expect(onPriceChange).toHaveBeenCalledWith('percent', 10))
  })

  it('accepts a negative percentage', async () => {
    const { onPriceChange } = setup()
    fireEvent.change(value(), { target: { value: '-5' } })
    fireEvent.click(apply())
    await waitFor(() => expect(onPriceChange).toHaveBeenCalledWith('percent', -5))
  })

  it('applies a flat change', async () => {
    const { onPriceChange } = setup()
    fireEvent.change(mode(), { target: { value: 'flat' } })
    fireEvent.change(value(), { target: { value: '20' } })
    fireEvent.click(apply())
    await waitFor(() => expect(onPriceChange).toHaveBeenCalledWith('flat', 20))
  })

  it('applies an absolute set', async () => {
    const { onPriceChange } = setup()
    fireEvent.change(mode(), { target: { value: 'set' } })
    fireEvent.change(value(), { target: { value: '199' } })
    fireEvent.click(apply())
    await waitFor(() => expect(onPriceChange).toHaveBeenCalledWith('set', 199))
  })

  it('rejects a negative absolute price (Apply stays disabled)', () => {
    setup()
    fireEvent.change(mode(), { target: { value: 'set' } })
    fireEvent.change(value(), { target: { value: '-1' } })
    expect(apply().disabled).toBe(true)
  })

  it('clears the value after a successful apply', async () => {
    setup()
    fireEvent.change(value(), { target: { value: '10' } })
    fireEvent.click(apply())
    await waitFor(() => expect(value().value).toBe(''))
  })

  it('aborts the price change when the confirmation is declined', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const { onPriceChange } = setup()
    fireEvent.change(value(), { target: { value: '10' } })
    fireEvent.click(apply())
    await waitFor(() => expect(onPriceChange).not.toHaveBeenCalled())
  })

  it('states that only branch prices change in the confirmation', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    setup()
    fireEvent.change(value(), { target: { value: '10' } })
    fireEvent.click(apply())
    await waitFor(() => expect(confirmSpy.mock.calls[0][0]).toMatch(/base prices are unchanged/i))
  })

  it('describes the pending change for each mode', () => {
    const { container } = setup()
    fireEvent.change(value(), { target: { value: '10' } })
    expect(container.textContent).toContain('+10% on 3 item(s)')

    fireEvent.change(mode(), { target: { value: 'flat' } })
    expect(container.textContent).toContain('+₹10 on 3 item(s)')

    fireEvent.change(mode(), { target: { value: 'set' } })
    expect(container.textContent).toContain('Set ₹10 on 3 item(s)')
  })

  it('changes the placeholder hint with the mode', () => {
    setup()
    expect(value().placeholder).toMatch(/e\.g\. 10 or -5/)
    fireEvent.change(mode(), { target: { value: 'flat' } })
    expect(value().placeholder).toMatch(/e\.g\. 20/)
  })
})

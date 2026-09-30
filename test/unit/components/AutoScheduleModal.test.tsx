import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { AutoScheduleModal } from '@/components/AutoScheduleModal'

vi.mock('lucide-react')

const generateSchedulesMock = vi.fn(() => [
  { positionIndex: 0, shifts: [{ id: 's1', start: '06:00', end: '14:00' }] },
])
vi.mock('@/lib/scheduleGenerator', () => ({
  generateSchedules: (...args: any[]) => generateSchedulesMock(...args),
}))

const baseProps = {
  roleName: 'Cook - Main',
  positionCount: 2,
  branchStartTime: '05:00',
  branchEndTime: '23:00',
}

describe('AutoScheduleModal', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns null when isOpen=false', () => {
    const { container } = render(
      <AutoScheduleModal isOpen={false} onClose={vi.fn()} onGenerate={vi.fn()} {...baseProps} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders header with role name and position count', () => {
    const { getByText, container } = render(
      <AutoScheduleModal isOpen={true} onClose={vi.fn()} onGenerate={vi.fn()} {...baseProps} />
    )
    expect(getByText('Auto-Schedule Generator')).toBeTruthy()
    expect(container.textContent).toContain('Cook - Main')
    expect(container.textContent).toContain('2 positions')
  })

  it('seeds three default peak periods', () => {
    const { container } = render(
      <AutoScheduleModal isOpen={true} onClose={vi.fn()} onGenerate={vi.fn()} {...baseProps} />
    )
    const textInputs = container.querySelectorAll('input[type="text"]')
    // one label input per peak period
    expect(textInputs.length).toBe(3)
  })

  it('adds a peak period when "Add Peak" is clicked', () => {
    const { getByText, container } = render(
      <AutoScheduleModal isOpen={true} onClose={vi.fn()} onGenerate={vi.fn()} {...baseProps} />
    )
    fireEvent.click(getByText('Add Peak'))
    expect(container.querySelectorAll('input[type="text"]').length).toBe(4)
  })

  it('closes on backdrop click', () => {
    const onClose = vi.fn()
    const { container } = render(
      <AutoScheduleModal isOpen={true} onClose={onClose} onGenerate={vi.fn()} {...baseProps} />
    )
    fireEvent.click(container.querySelector('.absolute.inset-0') as HTMLElement)
    expect(onClose).toHaveBeenCalled()
  })

  it('updates the max-hours input', () => {
    const { container } = render(
      <AutoScheduleModal isOpen={true} onClose={vi.fn()} onGenerate={vi.fn()} {...baseProps} />
    )
    const numberInput = container.querySelector('input[type="number"]') as HTMLInputElement
    fireEvent.change(numberInput, { target: { value: '8' } })
    expect(numberInput.value).toBe('8')
  })

  it('updates min-segment and max-breaks controls', () => {
    const { container } = render(
      <AutoScheduleModal isOpen={true} onClose={vi.fn()} onGenerate={vi.fn()} {...baseProps} />
    )
    const numberInputs = container.querySelectorAll('input[type="number"]')
    fireEvent.change(numberInputs[1], { target: { value: '3' } }) // min segment hours
    expect((numberInputs[1] as HTMLInputElement).value).toBe('3')
    const select = container.querySelector('select') as HTMLSelectElement
    fireEvent.change(select, { target: { value: '1' } })          // max breaks
    expect(select.value).toBe('1')
  })

  it('edits a peak label and removes a peak period', () => {
    const { container } = render(
      <AutoScheduleModal isOpen={true} onClose={vi.fn()} onGenerate={vi.fn()} {...baseProps} />
    )
    const firstLabel = container.querySelector('input[type="text"]') as HTMLInputElement
    fireEvent.change(firstLabel, { target: { value: 'Brunch Rush' } })
    expect(firstLabel.value).toBe('Brunch Rush')

    // remove buttons are the trash icons next to each peak; click one and expect one fewer row
    const before = container.querySelectorAll('input[type="text"]').length
    const removeButtons = container.querySelectorAll('.space-y-3 button')
    fireEvent.click(removeButtons[removeButtons.length - 1] as HTMLElement)
    expect(container.querySelectorAll('input[type="text"]').length).toBe(before - 1)
  })

  it('edits a peak start/end time', () => {
    const { container } = render(
      <AutoScheduleModal isOpen={true} onClose={vi.fn()} onGenerate={vi.fn()} {...baseProps} />
    )
    const timeInput = container.querySelector('input[type="time"]') as HTMLInputElement
    fireEvent.change(timeInput, { target: { value: '07:30' } })
    expect(timeInput.value).toBe('07:30')
  })

  it('generates schedules and calls onGenerate + onClose', () => {
    const onGenerate = vi.fn()
    const onClose = vi.fn()
    const { getByText } = render(
      <AutoScheduleModal isOpen={true} onClose={onClose} onGenerate={onGenerate} {...baseProps} />
    )
    fireEvent.click(getByText('Generate Optimal Baseline'))
    expect(generateSchedulesMock).toHaveBeenCalledWith(
      expect.objectContaining({ positionCount: 2, branchStartTime: '05:00', branchEndTime: '23:00' })
    )
    expect(onGenerate).toHaveBeenCalledWith([
      { positionIndex: 0, shifts: [{ id: 's1', start: '06:00', end: '14:00' }] },
    ])
    expect(onClose).toHaveBeenCalled()
  })
})

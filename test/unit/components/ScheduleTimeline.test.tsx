import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, within } from '@testing-library/react'
import { ScheduleTimeline } from '@/components/ScheduleTimeline'

vi.mock('lucide-react')

const updateRequirementSchedules = vi.fn().mockResolvedValue({ success: true })
vi.mock('@/app/actions/staff_requirements', () => ({
  updateRequirementSchedules: (...args: any[]) => updateRequirementSchedules(...args),
}))
// Keep the AutoScheduleModal light — assert it opens by role
vi.mock('@/components/AutoScheduleModal', () => ({
  AutoScheduleModal: ({ isOpen }: any) => (isOpen ? <div data-testid="auto-modal" /> : null),
}))

const branches = [
  { id: 'b1', name: 'Main', internalStartTime: '06:00', internalEndTime: '22:00' },
  { id: 'b2', name: 'Classic', internalStartTime: '05:00', internalEndTime: '23:00' },
]
const departments = [
  { id: 'd1', name: 'Kitchen' },
  { id: 'd2', name: 'Service' },
]
const roles = [
  { id: 'r1', name: 'Cook' },
  { id: 'r2', name: 'Waiter' },
]
const requirements = [
  {
    id: 'req1', branchId: 'b1', departmentId: 'd1', roleId: 'r1', requiredCount: 1,
    schedules: [{ positionIndex: 0, shifts: [{ id: 's1', start: '08:00', end: '12:00' }] }],
  },
  {
    id: 'req2', branchId: 'b1', departmentId: 'd2', roleId: 'r2', requiredCount: 2,
    schedules: [],
  },
]
const staff = [
  { id: 'st1', name: 'Alice', branchId: 'b1', roleId: 'r1', isActive: true, positionId: 'req1', positionIndex: 0 },
  { id: 'st2', name: 'Bob', branchId: 'b1', roleId: 'r2', isActive: true, startTime: '09:00', endTime: '17:00' },
]

const renderTimeline = (over: Partial<Record<string, any>> = {}) =>
  render(
    <ScheduleTimeline
      staff={over.staff ?? staff}
      requirements={over.requirements ?? requirements}
      branches={over.branches ?? branches}
      departments={over.departments ?? departments}
      roles={over.roles ?? roles}
      isReadOnly={over.isReadOnly ?? false}
    />
  )

describe('ScheduleTimeline', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders role rows for the default (first) branch', () => {
    const { container } = renderTimeline()
    expect(container.textContent).toContain('Cook')
    expect(container.textContent).toContain('Waiter')
  })

  it('shows the empty state when no requirements match the branch', () => {
    const { getByText } = renderTimeline({ requirements: [] })
    expect(getByText(/No configured positions/i)).toBeTruthy()
  })

  it('filters rows by department', () => {
    const { container } = renderTimeline()
    const deptSelect = container.querySelectorAll('select')[1] as HTMLSelectElement
    fireEvent.change(deptSelect, { target: { value: 'd1' } })
    expect(container.textContent).toContain('Cook')
    expect(container.textContent).not.toContain('Waiter')
  })

  it('hides the edit toggle and auto-schedule button when read-only', () => {
    const { queryByText } = renderTimeline({ isReadOnly: true })
    expect(queryByText('Edit Schedule')).toBeNull()
    expect(queryByText('Auto-Schedule')).toBeNull()
  })

  it('toggles edit mode on', () => {
    const { getByText, container } = renderTimeline()
    const toggle = getByText('Edit Schedule').parentElement?.querySelector('button') as HTMLElement
    fireEvent.click(toggle)
    // crosshair class appears on position rows in edit mode
    expect(container.querySelector('.cursor-crosshair')).toBeTruthy()
  })

  it('opens the auto-schedule modal', () => {
    const { getAllByText, getByTestId } = renderTimeline()
    fireEvent.click(getAllByText('Auto-Schedule')[0])
    expect(getByTestId('auto-modal')).toBeTruthy()
  })

  it('opens the hour-slot coverage panel and lists working staff', () => {
    const { container, getByText } = renderTimeline()
    // hour markers are clickable; click the first one
    const hourMarker = container.querySelector('.cursor-pointer') as HTMLElement
    fireEvent.click(hourMarker)
    // panel header shows "Working Staff at <hour>"
    expect(getByText(/Working Staff at/i)).toBeTruthy()
  })

  it('creates a shift by pointer-dragging on a position row in edit mode', async () => {
    // jsdom lacks pointer capture APIs — stub them
    Element.prototype.setPointerCapture = vi.fn() as any
    Element.prototype.releasePointerCapture = vi.fn() as any

    const { getByText, container } = renderTimeline()
    // enter edit mode
    const toggle = getByText('Edit Schedule').parentElement?.querySelector('button') as HTMLElement
    fireEvent.click(toggle)

    const row = container.querySelector('.cursor-crosshair') as HTMLElement
    // getBoundingClientRect returns zeros in jsdom; that's fine — handler still runs
    fireEvent.pointerDown(row, { clientX: 100, pointerId: 1 })
    fireEvent.pointerMove(row, { clientX: 160, pointerId: 1 })
    fireEvent.pointerUp(row, { clientX: 160, pointerId: 1 })

    // onSave path calls the server action
    await vi.waitFor(() => expect(updateRequirementSchedules).toHaveBeenCalled())
  })

  it('renders shift blocks for a requirement that already has schedules', () => {
    const { container } = renderTimeline()
    // req1 has a shift 08:00–12:00 → at least one gradient shift block is rendered
    expect(container.querySelector('.bg-gradient-to-r')).toBeTruthy()
  })
})

import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { StaffModal } from '@/components/StaffModal'

vi.mock('lucide-react')
vi.mock('@/app/actions/staff', () => ({
  addStaff: vi.fn().mockResolvedValue({ success: true }),
  updateStaff: vi.fn().mockResolvedValue({ success: true })
}))
const mockSaveDraft = vi.fn()
const mockLoadDraft = vi.fn().mockReturnValue(null)
const mockClearDraft = vi.fn()

vi.mock('@/lib/useDraft', () => ({
  useDraft: () => ({ saveDraft: mockSaveDraft, loadDraft: mockLoadDraft, clearDraft: mockClearDraft })
}))

const branches = [{ id: 'b1', name: 'Main' }]
const departments = [{ id: 'd1', name: 'Kitchen' }]
const roles = [{ id: 'r1', name: 'Chef', departmentIds: ['d1'], isChef: true }]

describe('StaffModal', () => {
  it('returns null when isOpen=false', () => {
    const { container } = render(<StaffModal isOpen={false} onClose={vi.fn()} branches={branches} departments={departments} roles={roles} />)
    expect(container.firstChild).toBeNull()
  })
  it('renders Add Staff form', () => {
    const { getByText } = render(<StaffModal isOpen={true} onClose={vi.fn()} branches={branches} departments={departments} roles={roles} />)
    expect(getByText('Add New Staff')).toBeTruthy()
  })
  it('renders Edit Staff form when editData provided', () => {
    const { getByText } = render(<StaffModal isOpen={true} onClose={vi.fn()} branches={branches} departments={departments} roles={roles} editData={{ id: 's1', name: 'Alice', phone: '9000', branchId: 'b1', departmentId: 'd1', roleId: 'r1', isActive: true }} />)
    expect(getByText('Edit Staff Member')).toBeTruthy()
  })
  it('renders name and phone inputs', () => {
    const { container } = render(<StaffModal isOpen={true} onClose={vi.fn()} branches={branches} departments={departments} roles={roles} />)
    expect(container.querySelectorAll('input[name="name"]').length).toBeGreaterThanOrEqual(1)
    expect(container.querySelectorAll('input[name="phone"]').length).toBeGreaterThanOrEqual(1)
  })
  it('renders select elements for branch, dept, role, shift', () => {
    const { container } = render(<StaffModal isOpen={true} onClose={vi.fn()} branches={branches} departments={departments} roles={roles} />)
    expect(container.querySelectorAll('select').length).toBeGreaterThan(0)
  })

  it('shows a draft-restore banner when a draft exists', () => {
    mockLoadDraft.mockReturnValueOnce({ name: 'Draft Person', phone: '9111' })
    const { getByText } = render(<StaffModal isOpen={true} onClose={vi.fn()} branches={branches} departments={departments} roles={roles} />)
    expect(getByText(/unsaved draft/i)).toBeTruthy()
    expect(getByText('Restore')).toBeTruthy()
    expect(getByText('Discard')).toBeTruthy()
  })

  it('discards a draft when Discard is clicked', () => {
    mockLoadDraft.mockReturnValueOnce({ name: 'Draft Person' })
    const { getByText, queryByText } = render(<StaffModal isOpen={true} onClose={vi.fn()} branches={branches} departments={departments} roles={roles} />)
    fireEvent.click(getByText('Discard'))
    expect(mockClearDraft).toHaveBeenCalledWith('add')
    expect(queryByText(/unsaved draft/i)).toBeNull()
  })

  it('restores a draft into the form when Restore is clicked', () => {
    mockLoadDraft.mockReturnValueOnce({
      name: 'Draft Person', phone: '9222', branchId: 'b1', departmentId: 'd1', roleId: 'r1', salary: '15000',
    })
    const { getByText, queryByText } = render(<StaffModal isOpen={true} onClose={vi.fn()} branches={branches} departments={departments} roles={roles} />)
    fireEvent.click(getByText('Restore'))
    // banner disappears after restoring
    expect(queryByText(/unsaved draft/i)).toBeNull()
  })

  it('locks branch/dept/role fields when a position is preselected', () => {
    const requirements = [
      { id: 'req1', branchId: 'b1', departmentId: 'd1', roleId: 'r1', requiredCount: 3, specialtyId: undefined },
    ]
    const { container } = render(
      <StaffModal isOpen={true} onClose={vi.fn()} branches={branches} departments={departments} roles={roles}
        requirements={requirements} staff={[]} preselectedPositionId="req1" />
    )
    // When a position is locked, branch/dept/role become hidden inputs (not selects)
    expect(container.querySelector('input[name="positionId"]')).toBeTruthy()
    expect((container.querySelector('input[name="branchId"]') as HTMLInputElement)?.value).toBe('b1')
    expect((container.querySelector('input[name="roleId"]') as HTMLInputElement)?.value).toBe('r1')
  })

  it('autofills start/end time when a shift type is chosen', () => {
    const { container } = render(<StaffModal isOpen={true} onClose={vi.fn()} branches={branches} departments={departments} roles={roles} />)
    const shiftSelect = container.querySelector('select[name="shiftType"]') as HTMLSelectElement
    fireEvent.change(shiftSelect, { target: { value: 'morning' } })
    expect((container.querySelector('input[name="startTime"]') as HTMLInputElement).value).toBe('06:00')
    expect((container.querySelector('input[name="endTime"]') as HTMLInputElement).value).toBe('14:00')
  })

  it('closes on backdrop click', () => {
    const onClose = vi.fn()
    const { container } = render(<StaffModal isOpen={true} onClose={onClose} branches={branches} departments={departments} roles={roles} />)
    fireEvent.click(container.querySelector('.absolute.inset-0') as HTMLElement)
    expect(onClose).toHaveBeenCalled()
  })

  it('submits addStaff and closes on success', async () => {
    const staffActions = await import('@/app/actions/staff')
    const onClose = vi.fn()
    const { container } = render(<StaffModal isOpen={true} onClose={onClose} branches={branches} departments={departments} roles={roles} />)
    fireEvent.change(container.querySelector('input[name="name"]') as HTMLElement, { target: { value: 'New Person' } })
    fireEvent.change(container.querySelector('input[name="phone"]') as HTMLElement, { target: { value: '9000000000' } })
    fireEvent.submit(container.querySelector('form') as HTMLFormElement)
    await vi.waitFor(() => expect(staffActions.addStaff).toHaveBeenCalled())
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(mockClearDraft).toHaveBeenCalledWith('add')
  })

  it('submits updateStaff when editing', async () => {
    const staffActions = await import('@/app/actions/staff')
    const editData = { id: 's1', name: 'Alice', phone: '9000', branchId: 'b1', departmentId: 'd1', roleId: 'r1', isActive: true }
    const { container } = render(<StaffModal isOpen={true} onClose={vi.fn()} branches={branches} departments={departments} roles={roles} editData={editData} />)
    fireEvent.submit(container.querySelector('form') as HTMLFormElement)
    await vi.waitFor(() => expect(staffActions.updateStaff).toHaveBeenCalled())
  })

  it('shows the error message returned by the action', async () => {
    const staffActions = await import('@/app/actions/staff')
    vi.mocked(staffActions.addStaff).mockResolvedValueOnce({ error: 'Phone too short' } as any)
    const { container, findByText } = render(<StaffModal isOpen={true} onClose={vi.fn()} branches={branches} departments={departments} roles={roles} />)
    fireEvent.change(container.querySelector('input[name="name"]') as HTMLElement, { target: { value: 'X' } })
    fireEvent.change(container.querySelector('input[name="phone"]') as HTMLElement, { target: { value: '1' } })
    fireEvent.submit(container.querySelector('form') as HTMLFormElement)
    expect(await findByText('Phone too short')).toBeTruthy()
  })
})

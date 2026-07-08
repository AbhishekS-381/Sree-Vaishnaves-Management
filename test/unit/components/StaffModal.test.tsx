import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
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
})

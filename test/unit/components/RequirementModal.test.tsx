import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { RequirementModal } from '@/components/RequirementModal'

vi.mock('lucide-react')
vi.mock('@/app/actions/staff_requirements', () => ({
  saveRequirement: vi.fn().mockResolvedValue({ success: true })
}))

const branches = [{ id: 'b1', name: 'Main' }]
const departments = [{ id: 'd1', name: 'Kitchen' }]
const roles = [
  { id: 'r1', name: 'Chef', departmentIds: ['d1'], isChef: true },
  { id: 'r2', name: 'Waiter', departmentIds: ['d1'], isChef: false }
]

describe('RequirementModal', () => {
  it('returns null when isOpen=false', () => {
    const { container } = render(<RequirementModal isOpen={false} onClose={vi.fn()} branches={branches} departments={departments} roles={roles} />)
    expect(container.firstChild).toBeNull()
  })
  it('renders Add form', () => {
    const { getByText } = render(<RequirementModal isOpen={true} onClose={vi.fn()} branches={branches} departments={departments} roles={roles} />)
    expect(getByText('Add Position Requirement')).toBeTruthy()
  })
  it('renders Edit form when editData provided', () => {
    const { getByText } = render(<RequirementModal isOpen={true} onClose={vi.fn()} branches={branches} departments={departments} roles={roles} editData={{ id: 'req1', branchId: 'b1', departmentId: 'd1', roleId: 'r1', requiredCount: 3 }} />)
    expect(getByText('Edit Position Requirement')).toBeTruthy()
  })
  it('closes on backdrop click', () => {
    const onClose = vi.fn()
    const { container } = render(<RequirementModal isOpen={true} onClose={onClose} branches={branches} departments={departments} roles={roles} />)
    fireEvent.click(container.querySelector('.absolute.inset-0') as HTMLElement)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
  it('populates roles after dept selected', () => {
    const { container } = render(<RequirementModal isOpen={true} onClose={vi.fn()} branches={branches} departments={departments} roles={roles} />)
    fireEvent.change(container.querySelector('select[name="departmentId"]') as HTMLElement, { target: { value: 'd1' } })
    const roleSelect = container.querySelector('select[name="roleId"]') as HTMLSelectElement
    expect(roleSelect.options.length).toBeGreaterThan(1)
  })
})

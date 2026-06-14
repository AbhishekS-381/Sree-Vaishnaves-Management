import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { StaffRequirements } from '@/components/StaffRequirements'

vi.mock('lucide-react')
vi.mock('@/app/actions/staff_requirements', () => ({ deleteRequirement: vi.fn().mockResolvedValue({ success: true }) }))
vi.mock('@/components/RequirementModal', () => ({ RequirementModal: ({ isOpen }: any) => isOpen ? <div data-testid="req-modal" /> : null }))
vi.stubGlobal('confirm', vi.fn().mockReturnValue(true))

const branches = [{ id: 'b1', name: 'Main' }]
const departments = [{ id: 'd1', name: 'Kitchen' }]
const roles = [{ id: 'r1', name: 'Chef' }]
const req1 = { id: 'req1', branchId: 'b1', departmentId: 'd1', roleId: 'r1', requiredCount: 2 }

describe('StaffRequirements', () => {
  it('shows empty state', () => {
    const { getByText } = render(<StaffRequirements requirements={[]} staff={[]} branches={branches} departments={departments} roles={roles} />)
    expect(getByText(/No position requirements defined yet/)).toBeTruthy()
  })
  it('shows Balanced when filled === required', () => {
    const staff = [{ id: 's1', branchId: 'b1', departmentId: 'd1', roleId: 'r1', isActive: true }, { id: 's2', branchId: 'b1', departmentId: 'd1', roleId: 'r1', isActive: true }]
    const { getByText } = render(<StaffRequirements requirements={[req1]} staff={staff} branches={branches} departments={departments} roles={roles} />)
    expect(getByText('Balanced')).toBeTruthy()
  })
  it('shows Open status when unfilled', () => {
    const { container } = render(<StaffRequirements requirements={[req1]} staff={[]} branches={branches} departments={departments} roles={roles} />)
    expect(container.textContent).toContain('Open')
  })
  it('shows Over status when overfilled', () => {
    const staff = Array.from({ length: 5 }, (_, i) => ({ id: `s${i}`, branchId: 'b1', departmentId: 'd1', roleId: 'r1', isActive: true }))
    const { container } = render(<StaffRequirements requirements={[req1]} staff={staff} branches={branches} departments={departments} roles={roles} />)
    expect(container.textContent).toContain('Over')
  })
  it('opens modal on Add Requirement click', () => {
    const { getByText, getByTestId } = render(<StaffRequirements requirements={[]} staff={[]} branches={branches} departments={departments} roles={roles} />)
    fireEvent.click(getByText('Add Requirement'))
    expect(getByTestId('req-modal')).toBeTruthy()
  })
  it('calls deleteRequirement on delete', async () => {
    const { deleteRequirement } = await import('@/app/actions/staff_requirements')
    const { container } = render(<StaffRequirements requirements={[req1]} staff={[]} branches={branches} departments={departments} roles={roles} />)
    const buttons = container.querySelectorAll('button')
    fireEvent.click(buttons[buttons.length - 1])
    expect(deleteRequirement).toHaveBeenCalledWith('req1')
  })
})

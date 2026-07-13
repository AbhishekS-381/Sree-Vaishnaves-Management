import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { StaffRequirements } from '@/components/StaffRequirements'

vi.mock('lucide-react')
vi.mock('@/app/actions/staff_requirements', () => ({ deleteRequirement: vi.fn().mockResolvedValue({ success: true }) }))
vi.mock('@/components/RequirementModal', () => ({ RequirementModal: ({ isOpen }: any) => isOpen ? <div data-testid="req-modal" /> : null }))
vi.mock('@/components/PositionsSummaryCards', () => ({ PositionsSummaryCards: ({ requirements, staff }: any) => <div data-testid="positions-summary" data-reqs={requirements.length} data-staff={staff.length} /> }))
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
    const staff = [{ id: 's1', branchId: 'b1', departmentId: 'd1', roleId: 'r1', positionId: 'req1', isActive: true }, { id: 's2', branchId: 'b1', departmentId: 'd1', roleId: 'r1', positionId: 'req1', isActive: true }]
    const { getByText } = render(<StaffRequirements requirements={[req1]} staff={staff} branches={branches} departments={departments} roles={roles} />)
    expect(getByText('Balanced')).toBeTruthy()
  })
  it('shows Open status when unfilled', () => {
    const { container } = render(<StaffRequirements requirements={[req1]} staff={[]} branches={branches} departments={departments} roles={roles} />)
    expect(container.textContent).toContain('Open')
  })
  it('shows Over status when overfilled', () => {
    const staff = Array.from({ length: 5 }, (_, i) => ({ id: `s${i}`, branchId: 'b1', departmentId: 'd1', roleId: 'r1', positionId: 'req1', isActive: true }))
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
  it('renders PositionsSummaryCards with all requirements initially', () => {
    const { getByTestId } = render(<StaffRequirements requirements={[req1]} staff={[]} branches={branches} departments={departments} roles={roles} />)
    const summary = getByTestId('positions-summary')
    expect(summary.getAttribute('data-reqs')).toBe('1')
  })
  it('passes filtered requirements to summary cards when branch filter applied', () => {
    const req2 = { id: 'req2', branchId: 'b2', departmentId: 'd1', roleId: 'r1', requiredCount: 1 }
    const extraBranches = [...branches, { id: 'b2', name: 'Branch 2' }]
    const { getByTestId, container } = render(
      <StaffRequirements requirements={[req1, req2]} staff={[]} branches={extraBranches} departments={departments} roles={roles} />
    )
    // Initially both requirements are shown
    expect(getByTestId('positions-summary').getAttribute('data-reqs')).toBe('2')
    // Filter by branch b1
    const selects = container.querySelectorAll('select')
    fireEvent.change(selects[0], { target: { value: 'b1' } })
    expect(getByTestId('positions-summary').getAttribute('data-reqs')).toBe('1')
  })
  it('passes filtered requirements to summary cards when search applied', () => {
    const roles2 = [{ id: 'r1', name: 'Chef' }, { id: 'r2', name: 'Waiter' }]
    const req2 = { id: 'req2', branchId: 'b1', departmentId: 'd1', roleId: 'r2', requiredCount: 1 }
    const { getByTestId, container } = render(
      <StaffRequirements requirements={[req1, req2]} staff={[]} branches={branches} departments={departments} roles={roles2} />
    )
    expect(getByTestId('positions-summary').getAttribute('data-reqs')).toBe('2')
    const searchInput = container.querySelector('input[type="text"]') as HTMLInputElement
    fireEvent.change(searchInput, { target: { value: 'Chef' } })
    expect(getByTestId('positions-summary').getAttribute('data-reqs')).toBe('1')
  })
})

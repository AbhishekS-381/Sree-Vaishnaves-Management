import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { RoleModal } from '@/components/RoleModal'

vi.mock('lucide-react')
vi.mock('@/app/actions/settings', () => ({
  addRole: vi.fn().mockResolvedValue({ success: true }),
  updateRole: vi.fn().mockResolvedValue({ success: true })
}))

const departments = [{ id: 'd1', name: 'Kitchen' }, { id: 'd2', name: 'Service' }]

describe('RoleModal component', () => {
  it('returns null when isOpen=false', () => {
    const { container } = render(<RoleModal isOpen={false} onClose={vi.fn()} departments={departments} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders New Role form when no editData', () => {
    const { getByText } = render(<RoleModal isOpen={true} onClose={vi.fn()} departments={departments} />)
    expect(getByText('New Role')).toBeTruthy()
  })

  it('renders Edit Role form when editData provided', () => {
    const { getByText } = render(
      <RoleModal 
        isOpen={true} 
        onClose={vi.fn()} 
        departments={[{ id: 'd1', name: 'Kitchen' } as any]} 
        editData={{ id: 'r1', name: 'Manager', departmentIds: ['d1'] } as any}
      />
    )
    expect(getByText('Edit Role')).toBeTruthy()
  })

  it('renders department checkboxes for each department', () => {
    const { getByText } = render(<RoleModal isOpen={true} onClose={vi.fn()} departments={departments} />)
    expect(getByText('Kitchen')).toBeTruthy()
    expect(getByText('Service')).toBeTruthy()
  })

  it('shows empty state message when no departments', () => {
    const { getByText } = render(<RoleModal isOpen={true} onClose={vi.fn()} departments={[]} />)
    expect(getByText('No departments created yet.')).toBeTruthy()
  })

  it('renders isChef checkboxes', () => {
    const { container } = render(<RoleModal isOpen={true} onClose={() => {}} editData={{ id: 'r1', name: 'Cook', isChef: true, departmentIds: ['d1'] } as any} departments={[]} />)
    expect(container.querySelector('#isChef')).toBeTruthy()
  })

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn()
    const { container } = render(<RoleModal isOpen={true} onClose={onClose} departments={[]} />)
    const backdrop = container.querySelector('.absolute.inset-0') as HTMLElement
    fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

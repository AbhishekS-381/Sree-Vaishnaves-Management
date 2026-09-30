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

  it('shows validation error when no department is selected on submit', async () => {
    const { container, findByText } = render(<RoleModal isOpen={true} onClose={vi.fn()} departments={departments} />)
    fireEvent.change(container.querySelector('input[name="name"]') as HTMLElement, { target: { value: 'Cook' } })
    fireEvent.submit(container.querySelector('form') as HTMLFormElement)
    expect(await findByText(/select at least 1 department/i)).toBeTruthy()
  })

  it('submits (addRole) and closes on success', async () => {
    const settings = await import('@/app/actions/settings')
    const onClose = vi.fn()
    const { container } = render(<RoleModal isOpen={true} onClose={onClose} departments={departments} />)
    fireEvent.change(container.querySelector('input[name="name"]') as HTMLElement, { target: { value: 'Cook' } })
    fireEvent.click(container.querySelector('input[name="departmentIds"]') as HTMLElement)
    fireEvent.submit(container.querySelector('form') as HTMLFormElement)
    await vi.waitFor(() => expect(settings.addRole).toHaveBeenCalled())
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('submits (updateRole) when editing', async () => {
    const settings = await import('@/app/actions/settings')
    const { container } = render(
      <RoleModal isOpen={true} onClose={vi.fn()} departments={departments}
        editData={{ id: 'r1', name: 'Manager', departmentIds: ['d1'] } as any} />
    )
    fireEvent.submit(container.querySelector('form') as HTMLFormElement)
    await vi.waitFor(() => expect(settings.updateRole).toHaveBeenCalled())
  })
})

import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { UserModal } from '@/components/UserModal'

vi.mock('lucide-react')
vi.mock('@/app/actions/users', () => ({
  addUser: vi.fn().mockResolvedValue({ success: true }),
  updateUser: vi.fn().mockResolvedValue({ success: true })
}))

describe('UserModal component', () => {
  it('returns null when isOpen=false', () => {
    const { container } = render(<UserModal isOpen={false} onClose={vi.fn()} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders Add form when no editData', () => {
    const { getByText } = render(<UserModal isOpen={true} onClose={vi.fn()} />)
    expect(getByText('Add System User')).toBeTruthy()
    expect(getByText('Create User')).toBeTruthy()
  })

  it('renders Edit form when editData provided', () => {
    const { getByText } = render(
      <UserModal isOpen={true} onClose={vi.fn()} editData={{ id: 'u1', name: 'alice', role: 'manager' }} />
    )
    expect(getByText('Edit System User')).toBeTruthy()
    expect(getByText('Update User')).toBeTruthy()
  })

  it('password field is NOT required in edit mode', () => {
    const { container } = render(
      <UserModal isOpen={true} onClose={vi.fn()} editData={{ id: 'u1', name: 'alice', role: 'manager' }} />
    )
    const pw = container.querySelector('input[type="password"]') as HTMLInputElement
    expect(pw.required).toBe(false)
  })

  it('password field IS required in add mode', () => {
    const { container } = render(<UserModal isOpen={true} onClose={vi.fn()} />)
    const pw = container.querySelector('input[type="password"]') as HTMLInputElement
    expect(pw.required).toBe(true)
  })

  it('role select has 3 options (owner, manager, readonly)', () => {
    const { container } = render(<UserModal isOpen={true} onClose={vi.fn()} />)
    const select = container.querySelector('select[name="role"]') as HTMLSelectElement
    expect(select.options.length).toBe(3)
  })

  it('cancel button calls onClose', () => {
    const onClose = vi.fn()
    const { getByText } = render(<UserModal isOpen={true} onClose={onClose} />)
    fireEvent.click(getByText('Cancel'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('shows the branch selector when role is manager', () => {
    const { container } = render(
      <UserModal isOpen={true} onClose={vi.fn()} editData={{ id: 'u1', name: 'm', role: 'manager' }} branches={[{ id: 'b1', name: 'Main' }]} />
    )
    expect(container.querySelector('select[name="branchId"]')).toBeTruthy()
  })

  it('submits addUser and calls onClose on success', async () => {
    const users = await import('@/app/actions/users')
    const onClose = vi.fn()
    const { container } = render(<UserModal isOpen={true} onClose={onClose} branches={[{ id: 'b1', name: 'Main' }]} />)
    fireEvent.change(container.querySelector('input[name="name"]') as HTMLElement, { target: { value: 'newuser' } })
    fireEvent.change(container.querySelector('input[name="password"]') as HTMLElement, { target: { value: 'Secret1!' } })
    fireEvent.submit(container.querySelector('form') as HTMLFormElement)
    await vi.waitFor(() => expect(users.addUser).toHaveBeenCalled())
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('submits updateUser when editing', async () => {
    const users = await import('@/app/actions/users')
    const { container } = render(
      <UserModal isOpen={true} onClose={vi.fn()} editData={{ id: 'u1', name: 'alice', role: 'owner' }} />
    )
    fireEvent.submit(container.querySelector('form') as HTMLFormElement)
    await vi.waitFor(() => expect(users.updateUser).toHaveBeenCalled())
  })
})

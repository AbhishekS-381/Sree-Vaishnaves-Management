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
})

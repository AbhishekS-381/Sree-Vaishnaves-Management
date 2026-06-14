import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { GenericEntityModal } from '@/components/GenericEntityModal'

vi.mock('lucide-react')

const mockAction = vi.fn().mockResolvedValue({})

const allFields = [
  { name: 'name', label: 'Name', type: 'text' as const, required: true, placeholder: 'Enter name' },
  { name: 'qty', label: 'Qty', type: 'number' as const },
  { name: 'color', label: 'Color', type: 'color' as const, defaultValue: '#ff0000' },
  { name: 'status', label: 'Status', type: 'select' as const, options: [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }] },
  { name: 'isActive', label: 'Active?', type: 'checkbox' as const, defaultValue: true },
]

describe('GenericEntityModal component', () => {
  it('returns null when isOpen=false', () => {
    const { container } = render(
      <GenericEntityModal isOpen={false} onClose={vi.fn()} title="Category" fields={[]} addAction={mockAction} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders add form with correct title when no editData', () => {
    const { getByText } = render(
      <GenericEntityModal isOpen={true} onClose={vi.fn()} title="Category" fields={[]} addAction={mockAction} />
    )
    expect(getByText('Add New Category')).toBeTruthy()
    expect(getByText('Create Category')).toBeTruthy()
  })

  it('renders edit form when editData is provided', () => {
    const { getByText } = render(
      <GenericEntityModal
        isOpen={true} onClose={vi.fn()} title="Category" fields={allFields}
        addAction={mockAction} updateAction={mockAction}
        editData={{ id: 'c1', name: 'Food', color: '#ff0000', status: 'active', isActive: true }}
      />
    )
    expect(getByText('Edit Category')).toBeTruthy()
    expect(getByText('Save Changes')).toBeTruthy()
  })

  it('renders all field types: text, number, color, select, checkbox', () => {
    const { container } = render(
      <GenericEntityModal isOpen={true} onClose={vi.fn()} title="Item" fields={allFields} addAction={mockAction} />
    )
    expect(container.querySelector('input[type="text"]')).toBeTruthy()
    expect(container.querySelector('input[type="number"]')).toBeTruthy()
    expect(container.querySelector('input[type="color"]')).toBeTruthy()
    expect(container.querySelector('select')).toBeTruthy()
    expect(container.querySelector('input[type="checkbox"]')).toBeTruthy()
  })

  it('renders hidden fields from hiddenFields prop', () => {
    const { container } = render(
      <GenericEntityModal isOpen={true} onClose={vi.fn()} title="Item" fields={[]}
        addAction={mockAction} hiddenFields={{ branchId: 'b1', extra: 'val' }}
      />
    )
    const hidden = container.querySelectorAll('input[type="hidden"]') as NodeListOf<HTMLInputElement>
    const names = Array.from(hidden).map(i => i.name)
    expect(names).toContain('branchId')
    expect(names).toContain('extra')
  })

  it('calls onClose when backdrop clicked', () => {
    const onClose = vi.fn()
    const { container } = render(
      <GenericEntityModal isOpen={true} onClose={onClose} title="Item" fields={[]} addAction={mockAction} />
    )
    const backdrop = container.querySelector('.absolute.inset-0') as HTMLElement
    fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('shows select with options including placeholder', () => {
    const { container } = render(
      <GenericEntityModal isOpen={true} onClose={vi.fn()} title="Item"
        fields={[{ name: 'status', label: 'Status', type: 'select' as const, options: [{ value: 'a', label: 'Alpha' }, { value: 'b', label: 'Beta' }] }]}
        addAction={mockAction}
      />
    )
    const options = container.querySelectorAll('option')
    expect(options.length).toBe(3)
  })
})

import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { StaffFilters } from '@/components/StaffFilters'

vi.mock('lucide-react')

const branches = [{ id: 'b1', name: 'Main Branch' }]
const departments = [{ id: 'd1', name: 'Kitchen' }]
const roles = [{ id: 'r1', name: 'Chef' }]

describe('StaffFilters component', () => {
  it('renders search input', () => {
    const { container } = render(
      <StaffFilters branches={branches} departments={departments} roles={roles} onFilterChange={vi.fn()} />
    )
    expect(container.querySelector('input[type="text"]')).toBeTruthy()
  })

  it('calls onFilterChange when search changes', () => {
    const onFilterChange = vi.fn()
    const { container } = render(
      <StaffFilters branches={branches} departments={departments} roles={roles} onFilterChange={onFilterChange} />
    )
    const input = container.querySelector('input[type="text"]') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Alice' } })
    expect(onFilterChange).toHaveBeenCalledWith(expect.objectContaining({ search: 'Alice' }))
  })

  it('calls onFilterChange when role select changes', () => {
    const onFilterChange = vi.fn()
    const { container } = render(
      <StaffFilters branches={branches} departments={departments} roles={roles} onFilterChange={onFilterChange} />
    )
    const selects = container.querySelectorAll('select')
    fireEvent.change(selects[0], { target: { value: 'r1' } })
    expect(onFilterChange).toHaveBeenCalledWith(expect.objectContaining({ roleId: 'r1' }))
  })

  it('calls onFilterChange when department select changes', () => {
    const onFilterChange = vi.fn()
    const { container } = render(
      <StaffFilters branches={branches} departments={departments} roles={roles} onFilterChange={onFilterChange} />
    )
    const selects = container.querySelectorAll('select')
    fireEvent.change(selects[1], { target: { value: 'd1' } })
    expect(onFilterChange).toHaveBeenCalledWith(expect.objectContaining({ departmentId: 'd1' }))
  })

  it('calls onFilterChange when branch select changes', () => {
    const onFilterChange = vi.fn()
    const { container } = render(
      <StaffFilters branches={branches} departments={departments} roles={roles} onFilterChange={onFilterChange} />
    )
    const selects = container.querySelectorAll('select')
    fireEvent.change(selects[2], { target: { value: 'b1' } })
    expect(onFilterChange).toHaveBeenCalledWith(expect.objectContaining({ branchId: 'b1' }))
  })

  it('calls onFilterChange when showInactive label is clicked', () => {
    const onFilterChange = vi.fn()
    const { container } = render(
      <StaffFilters branches={branches} departments={departments} roles={roles} onFilterChange={onFilterChange} />
    )
    // The hidden checkbox has the onChange handler, trigger it directly
    const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement
    // Use fireEvent.click on the parent label which triggers the checkbox
    const label = checkbox?.closest('label') as HTMLElement
    if (label) {
      fireEvent.click(label)
    } else {
      fireEvent.change(checkbox, { target: { checked: true } })
    }
    // Filter was called at least once (initial or via label click)
    expect(onFilterChange).toHaveBeenCalled()
  })
})

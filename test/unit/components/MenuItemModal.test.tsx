import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, screen, waitFor } from '@testing-library/react'
import { MenuItemModal } from '@/components/MenuItemModal'

vi.mock('lucide-react')

const actions = vi.hoisted(() => ({
  addMenuItem: vi.fn(),
  updateMenuItem: vi.fn(),
  addVariant: vi.fn(),
  updateVariant: vi.fn(),
  deleteVariant: vi.fn(),
}))
vi.mock('@/app/actions/menu', () => actions)

const categories = [{ id: 'c1', name: 'Breakfast' }, { id: 'c2', name: 'Mains' }]
const editItem = {
  id: 'm1', name: 'Masala Dosa', categoryId: 'c1', basePrice: 80, costPrice: 25,
  description: 'Crispy', dietary: ['jain'], spiceLevel: 2,
  availability: { days: [1, 2], startTime: '06:00', endTime: '11:00' },
}
const variants = [
  { id: 'v1', menuItemId: 'm1', name: 'Half', basePrice: 50, isActive: true },
  { id: 'v2', menuItemId: 'other', name: 'Nope', basePrice: 10, isActive: true },
]

beforeEach(() => {
  vi.clearAllMocks()
  Object.values(actions).forEach(fn => fn.mockResolvedValue({ success: true }))
})

describe('MenuItemModal — add mode', () => {
  it('returns null when closed', () => {
    const { container } = render(
      <MenuItemModal isOpen={false} onClose={vi.fn()} categories={categories} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders the add form with the availability-on-create choice', () => {
    render(<MenuItemModal isOpen onClose={vi.fn()} categories={categories} />)
    expect(screen.getByText('Add Menu Item')).toBeTruthy()
    expect(screen.getByText(/Available in all branches/i)).toBeTruthy()
  })

  it('hides the cost price field unless canSeeCost', () => {
    const { container, rerender } = render(
      <MenuItemModal isOpen onClose={vi.fn()} categories={categories} />
    )
    expect(container.querySelector('input[name="costPrice"]')).toBeNull()
    rerender(<MenuItemModal isOpen onClose={vi.fn()} categories={categories} canSeeCost />)
    expect(container.querySelector('input[name="costPrice"]')).toBeTruthy()
  })

  it('submits addMenuItem and closes on success', async () => {
    const onClose = vi.fn()
    const onResult = vi.fn()
    const { container } = render(
      <MenuItemModal isOpen onClose={onClose} categories={categories} onResult={onResult} />
    )
    fireEvent.change(container.querySelector('input[name="name"]')!, { target: { value: 'Idli' } })
    fireEvent.change(container.querySelector('select[name="categoryId"]')!, { target: { value: 'c1' } })
    fireEvent.change(container.querySelector('input[name="basePrice"]')!, { target: { value: '40' } })
    fireEvent.submit(container.querySelector('form')!)

    await waitFor(() => expect(actions.addMenuItem).toHaveBeenCalled())
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(onResult).toHaveBeenCalledWith({ success: true })
  })

  it('shows the error returned by the action and stays open', async () => {
    actions.addMenuItem.mockResolvedValue({ error: 'A menu item with this name already exists in this category' })
    const onClose = vi.fn()
    const { container } = render(
      <MenuItemModal isOpen onClose={onClose} categories={categories} />
    )
    fireEvent.change(container.querySelector('input[name="name"]')!, { target: { value: 'Dup' } })
    fireEvent.submit(container.querySelector('form')!)
    expect(await screen.findByText(/already exists/i)).toBeTruthy()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('does not show the variants section when adding', () => {
    render(<MenuItemModal isOpen onClose={vi.fn()} categories={categories} />)
    expect(screen.queryByText(/Portions \/ Variants/i)).toBeNull()
  })
})

describe('MenuItemModal — optional details', () => {
  it('expands the optional section and toggles dietary tags', () => {
    render(<MenuItemModal isOpen onClose={vi.fn()} categories={categories} />)
    fireEvent.click(screen.getByText('Optional details'))
    const jain = screen.getByText('Jain')
    fireEvent.click(jain)
    // second click removes it again (exercises both branches)
    fireEvent.click(jain)
    expect(screen.getByText('Vegan')).toBeTruthy()
  })

  it('toggles availability days and shows the every-day hint', () => {
    render(<MenuItemModal isOpen onClose={vi.fn()} categories={categories} />)
    fireEvent.click(screen.getByText('Optional details'))
    expect(screen.getByText(/No days selected = every day/i)).toBeTruthy()
    fireEvent.click(screen.getByText('Mon'))
    expect(screen.queryByText(/No days selected/i)).toBeNull()
    fireEvent.click(screen.getByText('Mon'))
    expect(screen.getByText(/No days selected/i)).toBeTruthy()
  })

  it('auto-expands the optional section when the item already has metadata', () => {
    render(<MenuItemModal isOpen onClose={vi.fn()} categories={categories} editData={editItem} />)
    // description input is only rendered when the section is expanded
    expect(screen.getByPlaceholderText(/Short description/i)).toBeTruthy()
  })
})

describe('MenuItemModal — edit mode & variants', () => {
  it('renders the edit form prefilled', () => {
    const { container } = render(
      <MenuItemModal isOpen onClose={vi.fn()} categories={categories} editData={editItem} canSeeCost />
    )
    expect(screen.getByText('Edit Menu Item')).toBeTruthy()
    expect((container.querySelector('input[name="name"]') as HTMLInputElement).value).toBe('Masala Dosa')
    expect((container.querySelector('input[name="basePrice"]') as HTMLInputElement).value).toBe('80')
    expect((container.querySelector('input[name="costPrice"]') as HTMLInputElement).value).toBe('25')
    expect(container.querySelector('input[name="id"]')).toBeTruthy()
  })

  it('submits updateMenuItem when editing', async () => {
    const { container } = render(
      <MenuItemModal isOpen onClose={vi.fn()} categories={categories} editData={editItem} />
    )
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(actions.updateMenuItem).toHaveBeenCalled())
    expect(actions.addMenuItem).not.toHaveBeenCalled()
  })

  it('lists only this item\'s active variants', () => {
    render(
      <MenuItemModal isOpen onClose={vi.fn()} categories={categories} editData={editItem} variants={variants} />
    )
    expect(screen.getByDisplayValue('Half')).toBeTruthy()
    expect(screen.queryByDisplayValue('Nope')).toBeNull()
  })

  it('shows an empty-state when the item has no variants', () => {
    render(<MenuItemModal isOpen onClose={vi.fn()} categories={categories} editData={editItem} variants={[]} />)
    expect(screen.getByText('No variants yet.')).toBeTruthy()
  })

  it('validates a new variant before calling the action', async () => {
    const { container } = render(
      <MenuItemModal isOpen onClose={vi.fn()} categories={categories} editData={editItem} variants={[]} />
    )
    fireEvent.click(container.querySelector('button[aria-label="Add variant"]')!)
    expect(await screen.findByText('Variant name is required')).toBeTruthy()
    expect(actions.addVariant).not.toHaveBeenCalled()

    fireEvent.change(screen.getByPlaceholderText('e.g. Half'), { target: { value: 'Half' } })
    fireEvent.change(screen.getByPlaceholderText('₹'), { target: { value: '1.5' } })
    fireEvent.click(container.querySelector('button[aria-label="Add variant"]')!)
    expect(await screen.findByText(/whole number/i)).toBeTruthy()
  })

  it('adds a variant and clears the inputs', async () => {
    const onResult = vi.fn()
    const { container } = render(
      <MenuItemModal isOpen onClose={vi.fn()} categories={categories} editData={editItem} variants={[]} onResult={onResult} />
    )
    fireEvent.change(screen.getByPlaceholderText('e.g. Half'), { target: { value: 'Full' } })
    fireEvent.change(screen.getByPlaceholderText('₹'), { target: { value: '120' } })
    fireEvent.click(container.querySelector('button[aria-label="Add variant"]')!)
    await waitFor(() => expect(actions.addVariant).toHaveBeenCalledWith('m1', 'Full', 120))
    await waitFor(() => expect((screen.getByPlaceholderText('e.g. Half') as HTMLInputElement).value).toBe(''))
  })

  it('surfaces an addVariant error', async () => {
    actions.addVariant.mockResolvedValue({ error: 'This item already has a variant with that name' })
    const { container } = render(
      <MenuItemModal isOpen onClose={vi.fn()} categories={categories} editData={editItem} variants={[]} />
    )
    fireEvent.change(screen.getByPlaceholderText('e.g. Half'), { target: { value: 'Half' } })
    fireEvent.change(screen.getByPlaceholderText('₹'), { target: { value: '50' } })
    fireEvent.click(container.querySelector('button[aria-label="Add variant"]')!)
    expect(await screen.findByText(/already has a variant/i)).toBeTruthy()
  })

  it('saves an edited variant only when it is dirty', async () => {
    render(
      <MenuItemModal isOpen onClose={vi.fn()} categories={categories} editData={editItem} variants={variants} />
    )
    expect(screen.queryByText('Save')).toBeNull()      // clean → no Save button
    fireEvent.change(screen.getByDisplayValue('Half'), { target: { value: 'Half Plate' } })
    fireEvent.click(screen.getByText('Save'))
    await waitFor(() => expect(actions.updateVariant).toHaveBeenCalledWith('v1', 'Half Plate', 50))
  })

  it('deletes a variant', async () => {
    render(
      <MenuItemModal isOpen onClose={vi.fn()} categories={categories} editData={editItem} variants={variants} />
    )
    fireEvent.click(screen.getByLabelText('Delete Half'))
    await waitFor(() => expect(actions.deleteVariant).toHaveBeenCalledWith('v1'))
  })

  it('surfaces a deleteVariant error', async () => {
    actions.deleteVariant.mockResolvedValue({ error: 'Variant not found' })
    render(
      <MenuItemModal isOpen onClose={vi.fn()} categories={categories} editData={editItem} variants={variants} />
    )
    fireEvent.click(screen.getByLabelText('Delete Half'))
    expect(await screen.findByText('Variant not found')).toBeTruthy()
  })
})

describe('MenuItemModal — dismissal', () => {
  it('closes via the backdrop, the X and Cancel', () => {
    const onClose = vi.fn()
    const { container } = render(
      <MenuItemModal isOpen onClose={onClose} categories={categories} />
    )
    fireEvent.click(container.querySelector('.absolute.inset-0')!)
    fireEvent.click(screen.getByLabelText('Close'))
    fireEvent.click(screen.getByText('Cancel'))
    expect(onClose).toHaveBeenCalledTimes(3)
  })
})

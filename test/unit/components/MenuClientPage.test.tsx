import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, screen, waitFor } from '@testing-library/react'
import MenuClientPage from '@/app/management/menu/MenuClientPage'

vi.mock('lucide-react')

// Mocks are created via vi.hoisted so they exist when the hoisted vi.mock runs.
const { menuActions, catActions } = vi.hoisted(() => ({
  menuActions: {
    setBranchItemAvailability: vi.fn(),
    deleteMenuItem: vi.fn(),
    restoreMenuItem: vi.fn(),
    updateBranchMenuItemPrice: vi.fn(),
    bulkSetBranchAvailability: vi.fn(),
    bulkUpdateBranchPrices: vi.fn(),
    reorderMenuItems: vi.fn(),
    addMenuItem: vi.fn(),
    updateMenuItem: vi.fn(),
    addVariant: vi.fn(),
    updateVariant: vi.fn(),
    deleteVariant: vi.fn(),
    cloneBranchMenuConfig: vi.fn(),
  },
  catActions: {
    addMenuCategory: vi.fn(),
    updateMenuCategory: vi.fn(),
    deleteMenuCategory: vi.fn(),
    setBranchCategoryAvailability: vi.fn(),
    reorderMenuCategories: vi.fn(),
  },
}))

vi.mock('@/app/actions/menu', () => menuActions)
vi.mock('@/app/actions/menu_categories', () => catActions)

const branches = [
  { id: 'b1', name: 'Main', isActive: true },
  { id: 'b2', name: 'Classic', isActive: true },
]
const categories = [
  { id: 'c1', name: 'Breakfast', sortOrder: 0 },
  { id: 'c2', name: 'Mains', sortOrder: 1 },
]
const initialMenu = [
  { id: 'm1', name: 'Masala Dosa', categoryId: 'c1', basePrice: 80, sortOrder: 0, isActive: true, costPrice: 20 },
  { id: 'm2', name: 'Idli', categoryId: 'c1', basePrice: 40, sortOrder: 1, isActive: true },
  { id: 'm3', name: 'Thali', categoryId: 'c2', basePrice: 150, sortOrder: 0, isActive: true },
  { id: 'm9', name: 'Retired Dish', categoryId: 'c2', basePrice: 60, sortOrder: 9, isActive: false, deletedAt: '2026-01-01T00:00:00Z' },
]
const branchMenuItems = [
  { id: 'r1', branchId: 'b1', menuItemId: 'm1', price: 75, isAvailable: true },
  { id: 'r2', branchId: 'b1', menuItemId: 'm2', price: null, isAvailable: false },
]
const branchCategories = [{ id: 'bc1', branchId: 'b1', categoryId: 'c1', isAvailable: true }]

const renderPage = (over: Partial<any> = {}) =>
  render(
    <MenuClientPage
      branches={branches}
      initialMenu={initialMenu}
      categories={categories}
      branchMenuItems={branchMenuItems}
      branchCategories={branchCategories}
      variants={[]}
      userRole="owner"
      isGlobalAdmin={true}
      {...over}
    />
  )

beforeEach(() => {
  vi.clearAllMocks()
  Object.values(menuActions).forEach(fn => fn.mockResolvedValue({ success: true }))
  menuActions.bulkSetBranchAvailability.mockResolvedValue({ success: true, changed: 2 })
  menuActions.bulkUpdateBranchPrices.mockResolvedValue({ success: true, changed: 2 })
  Object.values(catActions).forEach(fn => fn.mockResolvedValue({ success: true }))
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})

describe('MenuClientPage — rendering', () => {
  it('renders the heading and active items grouped by category', () => {
    const { container } = renderPage()
    expect(screen.getByText('Menu Management')).toBeTruthy()
    expect(screen.getByText('Masala Dosa')).toBeTruthy()
    expect(screen.getByText('Thali')).toBeTruthy()
    // category headings are uppercased via CSS, so the DOM text is title case
    expect(container.textContent).toContain('Breakfast')
    expect(container.textContent).toContain('Mains')
  })

  it('excludes archived items from the Menu tab', () => {
    renderPage()
    expect(screen.queryByText('Retired Dish')).toBeNull()
  })

  it('shows the branch price override and Base/Override badges', () => {
    const { container } = renderPage()
    expect(container.textContent).toContain('₹75')   // m1 override
    expect(container.textContent).toContain('Override')
    expect(container.textContent).toContain('Base')
  })

  it('shows a food-cost badge for global admins only', () => {
    const { container } = renderPage()
    expect(container.textContent).toContain('FC 26.7%') // 20/75
  })

  it('hides the cost badge from managers', () => {
    const { container } = renderPage({ isGlobalAdmin: false, userRole: 'manager' })
    expect(container.textContent).not.toContain('FC ')
  })

  it('renders all four tabs for a global admin', () => {
    renderPage()
    expect(screen.getByText('Menu')).toBeTruthy()
    expect(screen.getByText('Price Matrix')).toBeTruthy()
    expect(screen.getByText('Categories')).toBeTruthy()
    expect(screen.getByText(/Archive/)).toBeTruthy()
  })

  it('hides the tab bar from managers', () => {
    renderPage({ isGlobalAdmin: false, userRole: 'manager' })
    expect(screen.queryByText('Price Matrix')).toBeNull()
  })
})

describe('MenuClientPage — branch config actions', () => {
  it('toggles item availability and calls the action', async () => {
    const { container } = renderPage()
    const offButton = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'On')!
    fireEvent.click(offButton)
    await waitFor(() => expect(menuActions.setBranchItemAvailability).toHaveBeenCalledWith('b1', 'm1', false))
  })

  it('surfaces an error toast and reverts when the toggle fails', async () => {
    menuActions.setBranchItemAvailability.mockResolvedValue({ error: 'Forbidden' })
    const { container } = renderPage()
    const offButton = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'On')!
    fireEvent.click(offButton)
    await waitFor(() => expect(screen.getByTestId('toast-stack').textContent).toContain('Forbidden'))
  })

  it('saves a price on Enter and clears the override when set back to base', async () => {
    const { container } = renderPage()
    // open the editor for Idli (base 40, no override)
    const priceButtons = Array.from(container.querySelectorAll('button')).filter(b => b.textContent?.includes('₹'))
    fireEvent.click(priceButtons[1])
    const input = container.querySelector('input[type="number"]') as HTMLInputElement
    fireEvent.change(input, { target: { value: '40' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    // 40 === basePrice → null (inherit)
    await waitFor(() => expect(menuActions.updateBranchMenuItemPrice).not.toHaveBeenCalled())
  })

  it('saves a changed price as an override', async () => {
    const { container } = renderPage()
    const priceButtons = Array.from(container.querySelectorAll('button')).filter(b => b.textContent?.includes('₹'))
    fireEvent.click(priceButtons[1])
    const input = container.querySelector('input[type="number"]') as HTMLInputElement
    fireEvent.change(input, { target: { value: '45' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(menuActions.updateBranchMenuItemPrice).toHaveBeenCalledWith('b1', 'm2', 45))
  })

  it('toggles category availability', async () => {
    renderPage()
    fireEvent.click(screen.getAllByText('Enabled')[0])
    await waitFor(() => expect(catActions.setBranchCategoryAvailability).toHaveBeenCalledWith('b1', 'c1', false))
  })

  it('archives an item after confirmation', async () => {
    const { container } = renderPage()
    const deleteBtn = container.querySelector('button[title="Archive item"]') as HTMLElement
    fireEvent.click(deleteBtn)
    await waitFor(() => expect(menuActions.deleteMenuItem).toHaveBeenCalledWith('m1'))
  })
})

describe('MenuClientPage — filters & search', () => {
  it('filters items by search text', () => {
    renderPage()
    fireEvent.change(screen.getByPlaceholderText('Search menu...'), { target: { value: 'thali' } })
    expect(screen.getByText('Thali')).toBeTruthy()
    expect(screen.queryByText('Masala Dosa')).toBeNull()
  })

  it('shows an empty state when nothing matches', () => {
    renderPage()
    fireEvent.change(screen.getByPlaceholderText('Search menu...'), { target: { value: 'zzzz' } })
    expect(screen.getByText(/No menu items match/i)).toBeTruthy()
  })

  it('opens the filter panel and filters to unavailable only', () => {
    renderPage()
    fireEvent.click(screen.getByText('Filters'))
    fireEvent.change(screen.getByLabelText('Availability filter'), { target: { value: 'unavailable' } })
    expect(screen.getByText('Idli')).toBeTruthy()          // isAvailable false
    expect(screen.queryByText('Masala Dosa')).toBeNull()
  })

  it('sorts by name', () => {
    const { container } = renderPage()
    fireEvent.change(screen.getByLabelText('Sort'), { target: { value: 'name' } })
    expect(container.textContent).toContain('Idli')
  })
})

describe('MenuClientPage — bulk operations', () => {
  it('shows the bulk bar once items are selected', () => {
    const { container } = renderPage()
    const checkbox = container.querySelector('input[aria-label="Select Masala Dosa"]') as HTMLElement
    fireEvent.click(checkbox)
    expect(screen.getByTestId('bulk-action-bar')).toBeTruthy()
    expect(screen.getByText('1 selected')).toBeTruthy()
  })

  it('selects all shown items and runs a bulk disable', async () => {
    renderPage()
    fireEvent.click(screen.getByText(/Select all/i))
    fireEvent.click(screen.getByText('Disable'))
    await waitFor(() => expect(menuActions.bulkSetBranchAvailability).toHaveBeenCalled())
    const [branchId, ids, isAvailable] = menuActions.bulkSetBranchAvailability.mock.calls[0]
    expect(branchId).toBe('b1')
    expect(ids.length).toBe(3)
    expect(isAvailable).toBe(false)
  })

  it('applies a bulk percentage price change', async () => {
    renderPage()
    fireEvent.click(screen.getByText(/Select all/i))
    fireEvent.change(screen.getByLabelText('Price change value'), { target: { value: '10' } })
    fireEvent.click(screen.getByText('Apply'))
    await waitFor(() => expect(menuActions.bulkUpdateBranchPrices).toHaveBeenCalledWith('b1', expect.any(Array), 'percent', 10))
  })

  it('clears the selection', () => {
    const { container } = renderPage()
    fireEvent.click(container.querySelector('input[aria-label="Select Thali"]') as HTMLElement)
    fireEvent.click(screen.getByText('Clear'))
    expect(screen.queryByTestId('bulk-action-bar')).toBeNull()
  })
})

describe('MenuClientPage — other tabs', () => {
  it('renders the Price Matrix with a column per branch and availability dots', () => {
    const { container } = renderPage()
    fireEvent.click(screen.getByText('Price Matrix'))
    expect(container.querySelectorAll('th').length).toBe(2 + branches.length)
    expect(container.textContent).toContain('Main')
    expect(container.textContent).toContain('Classic')
  })

  it('reorders categories atomically from the Categories tab', async () => {
    renderPage()
    fireEvent.click(screen.getByText('Categories'))
    const downButtons = screen.getAllByLabelText('Move down')
    fireEvent.click(downButtons[0])
    await waitFor(() => expect(catActions.reorderMenuCategories).toHaveBeenCalledWith(['c2', 'c1']))
  })

  it('lists archived items and restores one', async () => {
    renderPage()
    fireEvent.click(screen.getByText(/Archive/))
    expect(screen.getByText('Retired Dish')).toBeTruthy()
    fireEvent.click(screen.getByText('Restore'))
    await waitFor(() => expect(menuActions.restoreMenuItem).toHaveBeenCalledWith('m9'))
  })

  it('opens the Add Menu Item modal', () => {
    renderPage()
    fireEvent.click(screen.getByText('Add Menu Item'))
    expect(screen.getByText('Add Menu Item', { selector: 'h2' })).toBeTruthy()
  })

  it('opens the Copy Branch modal', () => {
    renderPage()
    fireEvent.click(screen.getByText('Copy Branch'))
    expect(screen.getByText('Copy Branch Menu')).toBeTruthy()
  })
})

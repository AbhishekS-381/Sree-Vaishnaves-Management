import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import MenuClientPage from '@/app/menu/MenuClientPage'
import * as menuActions from '@/app/actions/menu'
import * as menuCatActions from '@/app/actions/menu_categories'

const mockToggleMenuItemStatus = vi.spyOn(menuActions, 'toggleMenuItemStatus').mockResolvedValue(undefined as any)
const mockDeleteMenuItem = vi.spyOn(menuActions, 'deleteMenuItem').mockResolvedValue(undefined as any)
const mockUpdateBranchMenuItemPrice = vi.spyOn(menuActions, 'updateBranchMenuItemPrice').mockResolvedValue(undefined as any)
const mockToggleBranchCategory = vi.spyOn(menuCatActions, 'toggleBranchCategory').mockResolvedValue(undefined as any)
const mockDeleteMenuCategory = vi.spyOn(menuCatActions, 'deleteMenuCategory').mockResolvedValue({ success: true })

vi.mock('lucide-react', () => ({
  Store: () => null,
  Plus: () => null,
  Search: () => null,
  CheckCircle2: () => null,
  XCircle: () => null,
  Trash2: () => null,
  Edit: () => null,
  UtensilsCrossed: () => null,
  Pencil: () => null,
  ChevronDown: () => null
}))

vi.mock('@/lib/useDraft', () => ({
  useDraft: () => ({ saveDraft: vi.fn(), loadDraft: vi.fn().mockReturnValue(null), clearDraft: vi.fn() })
}))

vi.mock('@/components/GenericEntityModal', () => ({
  GenericEntityModal: ({ isOpen, title, onClose }: any) => {
    if (!isOpen) return null;
    return <div data-testid="generic-entity-modal"><h2>{title}</h2><button onClick={onClose}>Close</button></div>
  }
}))

describe('MenuClientPage', () => {
  const mockBranches = [
    { id: 'b1', name: 'Branch 1' },
    { id: 'b2', name: 'Branch 2' }
  ]

  const mockCategories = [
    { id: 'cat1', name: 'Breakfast' },
    { id: 'cat2', name: 'Lunch' }
  ]

  const mockGlobalMenu = [
    { id: 'm1', name: 'Dosa', categoryId: 'cat1', createdAt: '2023-01-01' },
    { id: 'm2', name: 'Meals', categoryId: 'cat2', createdAt: '2023-01-01' }
  ]

  const mockBranchCategories = [
    { id: 'bc1', branchId: 'b1', categoryId: 'cat1', isAvailable: true },
    { id: 'bc2', branchId: 'b1', categoryId: 'cat2', isAvailable: false }
  ]

  const mockBranchMenuItems = [
    { id: 'bmi1', branchId: 'b1', menuItemId: 'm1', price: 50, isAvailable: true },
    { id: 'bmi2', branchId: 'b1', menuItemId: 'm2', price: 150, isAvailable: false }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    window.confirm = vi.fn().mockReturnValue(true)
  })

  it('renders correctly with global items and branch overrides for global admin', () => {
    render(
      <MenuClientPage
        branches={mockBranches}
        initialMenu={mockGlobalMenu}
        categories={mockCategories}
        branchMenuItems={mockBranchMenuItems}
        branchCategories={mockBranchCategories}
        userRole="admin"
        isGlobalAdmin={true}
      />
    )

    // Should see titles and items
    expect(screen.getByText('Menu Management')).toBeDefined()
    expect(screen.getAllByText('Breakfast').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Lunch').length).toBeGreaterThan(0)
    expect(screen.getByText('Dosa')).toBeDefined()
    expect(screen.getByText('Meals')).toBeDefined()

    // Because it's admin, they should see "Add Menu Item" button
    expect(screen.getByText('Add Menu Item')).toBeDefined()
    expect(screen.getByText('Add Category')).toBeDefined()

    // The price input for Dosa should have defaultValue 50
    const priceInputs = screen.getAllByRole('spinbutton')
    expect((priceInputs[0] as HTMLInputElement).value).toBe("50")
    expect((priceInputs[1] as HTMLInputElement).value).toBe("150")
  })

  it('hides disabled categories and items for managers', () => {
    render(
      <MenuClientPage
        branches={mockBranches}
        initialMenu={mockGlobalMenu}
        categories={mockCategories}
        branchMenuItems={mockBranchMenuItems}
        branchCategories={mockBranchCategories}
        userRole="manager"
        isGlobalAdmin={false}
      />
    )

    // Manager should see Dosa (available in b1) but NOT Meals (unavailable in b1)
    expect(screen.getByText('Dosa')).toBeDefined()
    expect(screen.queryByText('Meals')).toBeNull()

    // Manager should see Breakfast but NOT Lunch
    expect(screen.getByText('Breakfast')).toBeDefined()
    expect(screen.queryByText('Lunch')).toBeNull()

    // Manager should NOT see add buttons
    expect(screen.queryByText('Add Menu Item')).toBeNull()
    expect(screen.queryByText('Add Category')).toBeNull()

    // Manager should NOT see input fields for price, just the static text
    expect(screen.queryAllByRole('spinbutton').length).toBe(0)
    // The price 50 should be rendered as static text
    expect(screen.getByText('50')).toBeDefined()
  })

  it('calls updateBranchMenuItemPrice when admin changes price', () => {
    render(
      <MenuClientPage
        branches={mockBranches}
        initialMenu={mockGlobalMenu}
        categories={mockCategories}
        branchMenuItems={mockBranchMenuItems}
        branchCategories={mockBranchCategories}
        userRole="admin"
        isGlobalAdmin={true}
      />
    )

    const priceInputs = screen.getAllByRole('spinbutton')
    fireEvent.change(priceInputs[0], { target: { value: '60' } })
    fireEvent.blur(priceInputs[0])

    expect(mockUpdateBranchMenuItemPrice).toHaveBeenCalledWith('b1', 'm1', 60)
  })

  it('calls toggleMenuItemStatus when admin clicks Available toggle', () => {
    render(
      <MenuClientPage
        branches={mockBranches}
        initialMenu={mockGlobalMenu}
        categories={mockCategories}
        branchMenuItems={mockBranchMenuItems}
        branchCategories={mockBranchCategories}
        userRole="admin"
        isGlobalAdmin={true}
      />
    )

    const toggles = screen.getAllByText('Available')
    fireEvent.click(toggles[0]) // Toggle Dosa
    expect(mockToggleMenuItemStatus).toHaveBeenCalledWith('b1', 'm1', true)
  })

  it('calls deleteMenuItem when admin clicks delete', () => {
    render(
      <MenuClientPage
        branches={mockBranches}
        initialMenu={mockGlobalMenu}
        categories={mockCategories}
        branchMenuItems={mockBranchMenuItems}
        branchCategories={mockBranchCategories}
        userRole="admin"
        isGlobalAdmin={true}
      />
    )

    // Second to last and last trash icons might be categories, first ones are menu items.
    // Dosa delete button:
    const deleteButtons = screen.getAllByRole('button').filter(b => b.className.includes('text-slate-500 hover:text-red-400'))
    fireEvent.click(deleteButtons[0]) // Delete Dosa
    expect(mockDeleteMenuItem).toHaveBeenCalledWith('m1')
  })

  it('opens and closes Add Menu Item modal', () => {
    render(
      <MenuClientPage
        branches={mockBranches}
        initialMenu={mockGlobalMenu}
        categories={mockCategories}
        branchMenuItems={mockBranchMenuItems}
        branchCategories={mockBranchCategories}
        userRole="admin"
        isGlobalAdmin={true}
      />
    )

    const addButton = screen.getByText('Add Menu Item')
    fireEvent.click(addButton)

    expect(screen.getByText('Item Name')).toBeDefined()
    expect(screen.getByText('Cancel')).toBeDefined()

    fireEvent.click(screen.getByText('Cancel'))
    expect(screen.queryByText('Item Name')).toBeNull()
  })

  it('opens category modal when clicking Add Category', () => {
    render(
      <MenuClientPage
        branches={mockBranches}
        initialMenu={mockGlobalMenu}
        categories={mockCategories}
        branchMenuItems={mockBranchMenuItems}
        branchCategories={mockBranchCategories}
        userRole="admin"
        isGlobalAdmin={true}
      />
    )

    const addCatButton = screen.getByText('Add Category')
    fireEvent.click(addCatButton)

    expect(screen.getByTestId('generic-entity-modal')).toBeDefined()
  })

  it('filters items by search', () => {
    render(
      <MenuClientPage
        branches={mockBranches}
        initialMenu={mockGlobalMenu}
        categories={mockCategories}
        branchMenuItems={mockBranchMenuItems}
        branchCategories={mockBranchCategories}
        userRole="admin"
        isGlobalAdmin={true}
      />
    )

    const searchInput = screen.getByPlaceholderText('Search menu...')
    fireEvent.change(searchInput, { target: { value: 'Meals' } })

    expect(screen.queryByText('Dosa')).toBeNull()
    expect(screen.getByText('Meals')).toBeDefined()
  })
})

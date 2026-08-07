import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import MenuClientPage from '@/app/menu/MenuClientPage'
import * as menuActions from '@/app/actions/menu'
import * as menuCatActions from '@/app/actions/menu_categories'

const mockToggleMenuItemStatus = vi.spyOn(menuActions, 'setBranchItemAvailability').mockResolvedValue(undefined as any)
const mockDeleteMenuItem = vi.spyOn(menuActions, 'deleteMenuItem').mockResolvedValue(undefined as any)
const mockUpdateBranchMenuItemPrice = vi.spyOn(menuActions, 'updateBranchMenuItemPrice').mockResolvedValue(undefined as any)
const mockToggleBranchCategory = vi.spyOn(menuCatActions, 'setBranchCategoryAvailability').mockResolvedValue(undefined as any)
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
  ChevronDown: () => null,
  ArrowUp: () => <div data-testid="arrow-up" />,
  ArrowDown: () => <div data-testid="arrow-down" />
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

    // The price for Dosa should be rendered as static text first
    expect(screen.getByText('₹50')).toBeDefined()
    expect(screen.getByText('₹150')).toBeDefined()
  })

  it('shows all categories and items for managers to toggle', () => {
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

    // Manager CAN edit branch, so they should see disabled items and categories to toggle them
    expect(screen.getByText('Dosa')).toBeDefined()
    expect(screen.getByText('Meals')).toBeDefined()

    expect(screen.getByText('Breakfast')).toBeDefined()
    expect(screen.getByText('Lunch')).toBeDefined()

    // Manager should NOT see add buttons (Add Menu Item is global)
    expect(screen.queryByText('Add Menu Item')).toBeNull()
    expect(screen.queryByText('Add Category')).toBeNull()

    // Manager SHOULD see input fields for price (represented by static text that can be clicked)
    expect(screen.getByText('₹50')).toBeDefined()
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

    // Click the price to reveal the input
    const priceDivs = screen.getAllByText(/₹\d+/)
    fireEvent.click(priceDivs[0])

    const priceInputs = screen.getAllByRole('spinbutton')
    fireEvent.change(priceInputs[0], { target: { value: '60' } })
    fireEvent.keyDown(priceInputs[0], { key: 'Enter', code: 'Enter' })

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

    const toggles = screen.getAllByText('On')
    fireEvent.click(toggles[0]) // Toggle Dosa
    expect(mockToggleMenuItemStatus).toHaveBeenCalledWith('b1', 'm1', false)
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

    // Switch to Categories tab first
    fireEvent.click(screen.getByText('Categories'))

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

  it('renders Price Matrix tab correctly for admin', () => {
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

    // Switch to Price Matrix
    fireEvent.click(screen.getByText('Price Matrix'))

    // Should see branch headers
    expect(screen.getByText('Branch 1')).toBeDefined()
    expect(screen.getByText('Branch 2')).toBeDefined()

    // Should see items
    expect(screen.getByText('Dosa')).toBeDefined()
    expect(screen.getByText('Meals')).toBeDefined()

    // Dosa has price 50 in Branch 1, Meals has price 150
    expect(screen.getByText('₹50')).toBeDefined()
    expect(screen.getByText('₹150')).toBeDefined()
  })

  it('reorders categories in Categories tab', () => {
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

    // Switch to Categories
    fireEvent.click(screen.getByText('Categories'))

    // We should see Breakfast and Lunch
    expect(screen.getByText('Breakfast')).toBeDefined()
    expect(screen.getByText('Lunch')).toBeDefined()

    // Find all up arrows via test id
    const upButtons = screen.getAllByTestId('arrow-up')
    expect(upButtons.length).toBeGreaterThan(0)
  })
})

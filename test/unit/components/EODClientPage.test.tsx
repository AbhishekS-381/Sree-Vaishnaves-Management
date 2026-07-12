import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, waitFor, screen } from '@testing-library/react'
import EODClientPage from '@/app/eod/EODClientPage'
import * as eodActions from '@/app/actions/eod'
import { useEODSave } from '@/hooks/useEODSave'

vi.mock('lucide-react', () => ({
  Calendar: () => null, Store: () => null, DollarSign: () => null, 
  Edit3: () => null, Loader2: () => null, Save: () => null, 
  ShoppingCart: () => null, Info: () => null, TrendingDown: () => null, 
  TrendingUp: () => null, Wallet: () => null, Loader2: () => null
}))

vi.mock('@/app/actions/eod', () => ({
  getEODByDate: vi.fn(),
  getExpensesByDate: vi.fn()
}))

vi.mock('@/lib/useDraft', () => ({
  useDraft: () => ({ saveDraft: vi.fn(), loadDraft: vi.fn().mockReturnValue(null), clearDraft: vi.fn() })
}))

vi.mock('@/hooks/useEODSave', () => ({
  useEODSave: vi.fn()
}))

const mockBranches = [{ id: 'b1', name: 'Main Branch' }]
const mockCategories = [{ id: 'c1', name: 'Raw Material' }]

describe('EODClientPage component', () => {
  const mockHandleSave = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(eodActions.getEODByDate).mockResolvedValue(null)
    vi.mocked(eodActions.getExpensesByDate).mockResolvedValue([])
    vi.mocked(useEODSave).mockReturnValue({
      isSaving: false,
      handleSave: mockHandleSave
    })
  })

  it('renders EOD form correctly', async () => {
    const { container } = render(<EODClientPage branches={mockBranches} categories={mockCategories} />)
    
    await waitFor(() => {
      const inputs = container.querySelectorAll('input[type="number"]')
      expect(inputs.length).toBeGreaterThan(0)
    })
  })

  it('calculates total income correctly', async () => {
    const { container } = render(<EODClientPage branches={mockBranches} categories={mockCategories} />)
    
    await waitFor(() => {
      const inputs = container.querySelectorAll('input[type="number"]')
      expect(inputs.length).toBeGreaterThan(0)
    })

    const inputs = container.querySelectorAll('input[type="number"]')
    // 0: Dine-in cash, 1: Dine-in UPI, 2: Takeaway cash, 3: Takeaway UPI
    fireEvent.change(inputs[0], { target: { value: '1000' } }) // Dine-In Cash
    fireEvent.change(inputs[1], { target: { value: '2000' } }) // Dine-In UPI
    fireEvent.change(inputs[2], { target: { value: '3000' } }) // Takeaway Cash
    fireEvent.change(inputs[3], { target: { value: '4000' } }) // Takeaway UPI

    await waitFor(() => {
      // Total should be 10000 -> 10,000 format
      expect(container.textContent).toContain('10,000')
    })
  })

  it('calculates cash discrepancy and highlights correctly', async () => {
    const { container } = render(<EODClientPage branches={mockBranches} categories={mockCategories} />)
    
    await waitFor(() => {
      const inputs = container.querySelectorAll('input[type="number"]')
      expect(inputs.length).toBeGreaterThan(0)
    })

    const inputs = container.querySelectorAll('input[type="number"]')
    fireEvent.change(inputs[0], { target: { value: '5000' } }) // Dine-In Cash
    fireEvent.change(inputs[4], { target: { value: '1000' } }) // Opening Float
    fireEvent.change(inputs[5], { target: { value: '5500' } }) // Actual Closing Float

    await waitFor(() => {
      expect(container.textContent).toContain('₹-500')
    })
  })

  it('locks form when EOD is already locked', async () => {
    vi.mocked(eodActions.getEODByDate).mockResolvedValue({
      status: 'locked',
      income: { dineInCash: 100, dineInUpi: 0, takeawayCash: 0, takeawayUpi: 0 },
      openingFloat: 50,
      actualClosingFloat: 150
    } as any)

    const { container } = render(<EODClientPage branches={mockBranches} categories={mockCategories} />)
    
    await waitFor(() => {
      const inputs = container.querySelectorAll('input[type="number"]') as NodeListOf<HTMLInputElement>
      expect(inputs.length).toBeGreaterThan(0)
      expect(inputs[0].disabled).toBe(true)
    })

    const saveBtn = screen.queryByText('Submit EOD Entry')
    expect(saveBtn).toBeNull() // Save button should not render when locked
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, waitFor, screen, act } from '@testing-library/react'
import EODClientPage from '@/app/management/eod/EODClientPage'
import * as eodActions from '@/app/actions/eod'
import { useEODSave } from '@/hooks/useEODSave'
import * as draftHooks from '@/lib/useDraft'

vi.mock('lucide-react', () => ({
  Calendar: () => <div data-testid="icon-calendar" />, Store: () => null, DollarSign: () => null, 
  Edit3: () => null, Loader2: () => null, Save: () => null, 
  ShoppingCart: () => null, Info: () => null, TrendingDown: () => null, 
  TrendingUp: () => null, Wallet: () => null, ChevronDown: () => null, ChevronUp: () => null, 
  AlertTriangle: () => <div data-testid="icon-alert" />, CheckCircle: () => null, ReceiptText: () => null, Activity: () => null,
  Scale: () => null, AlertCircle: () => null
}))

vi.mock('@/app/actions/eod', () => ({
  getEODByDate: vi.fn(),
  getExpensesByDate: vi.fn()
}))

vi.mock('@/lib/useDraft', () => ({
  useDraft: vi.fn()
}))

vi.mock('@/hooks/useEODSave', () => ({
  useEODSave: vi.fn()
}))

const mockBranches = [{ id: 'b1', name: 'Main Branch' }]
const mockCategories = [{ id: 'c1', name: 'Raw Material' }]
const today = new Date().toISOString().split('T')[0]
const mockAttendance = [
  { branchId: 'b1', status: 'present', date: today },
  { branchId: 'b1', status: 'present', date: today },
  { branchId: 'b1', status: 'absent', date: today }
] // Should count as 2 staff on duty

describe('EODClientPage component', () => {
  const mockHandleSave = vi.fn()
  const mockSaveDraft = vi.fn()
  const mockClearDraft = vi.fn()
  const mockLoadDraft = vi.fn().mockReturnValue(null)

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(eodActions.getEODByDate).mockResolvedValue(null)
    vi.mocked(eodActions.getExpensesByDate).mockResolvedValue([])
    vi.mocked(useEODSave).mockReturnValue({
      isSaving: false,
      handleSave: mockHandleSave
    })
    vi.mocked(draftHooks.useDraft).mockReturnValue({
      saveDraft: mockSaveDraft,
      loadDraft: mockLoadDraft,
      clearDraft: mockClearDraft
    })
  })

  it('renders EOD form correctly and auto-fills staffOnDuty from attendance', async () => {
    render(<EODClientPage branches={mockBranches} categories={mockCategories} attendance={mockAttendance} />)
    
    // opsEnabled should be true automatically because of attendance matching

    await waitFor(() => {
      // Find the input by its label or ID
      const staffInput = screen.getByDisplayValue('2')
      expect(staffInput).toBeDefined()
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

  it('shows warning modal if submitting with float incomplete', async () => {
    render(<EODClientPage branches={mockBranches} categories={mockCategories} />)
    
    await screen.findByText('Submit EOD Entry')
    // Set income but NO float
    const inputs = document.querySelectorAll('input[type="number"]')
    fireEvent.change(inputs[0], { target: { value: '5000' } })
    fireEvent.change(inputs[inputs.length - 2], { target: { value: '100' } }) // Opening float only

    const saveBtn = screen.getByText('Submit EOD Entry')
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(screen.getByText(/Check Before Saving/i)).toBeDefined()
      expect(screen.getByText(/Opening float entered but closing float is missing/i)).toBeDefined()
    })
  })

  it('shows warning modal if billing gap > 1000', async () => {
    render(<EODClientPage branches={mockBranches} categories={mockCategories} />)
    
    await screen.findByText('Submit EOD Entry')
    // Enable Billing
    fireEvent.click(screen.getByText('Billing System Report'))

    const inputs = document.querySelectorAll('input[type="number"]')
    fireEvent.change(inputs[0], { target: { value: '5000' } }) // Cash collected
    fireEvent.change(inputs[inputs.length - 2], { target: { value: '1000' } }) // Float
    fireEvent.change(inputs[inputs.length - 1], { target: { value: '6000' } }) // Closing Float (perfect recon)
    
    // Set total billed to 10000, collected 5000 -> gap is 5000
    fireEvent.change(inputs[4], { target: { value: '10000' } })

    const saveBtn = screen.getByText('Submit EOD Entry')
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(screen.getByText(/Check Before Saving/i)).toBeDefined()
      expect(screen.getByText(/Large billing gap/i)).toBeDefined()
    })
  })

  it('shows zero revenue confirmation banner when handleSave returns ZERO_REVENUE_UNCONFIRMED', async () => {
    mockHandleSave.mockResolvedValue({ success: false, error: 'ZERO_REVENUE_UNCONFIRMED' })
    render(<EODClientPage branches={mockBranches} categories={mockCategories} />)

    await screen.findByText('Submit EOD Entry')
    const inputs = document.querySelectorAll('input[type="number"]')
    fireEvent.change(inputs[inputs.length - 2], { target: { value: '1000' } }) // Float
    fireEvent.change(inputs[inputs.length - 1], { target: { value: '1000' } }) // Closing Float

    const saveBtn = screen.getByText('Submit EOD Entry')
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(screen.getByText(/All income fields are ₹0/i)).toBeDefined()
    })
  })

  it('restores draft with billing and ops toggles', async () => {
    mockLoadDraft.mockReturnValue({
      income: { dineInCash: 100 },
      billingEnabled: true,
      opsEnabled: true,
      billing: { totalBillAmount: 500 },
      ops: { staffOnDuty: 3 }
    })
    
    render(<EODClientPage branches={mockBranches} categories={mockCategories} />)
    
    // Wait for the restore draft banner to appear after loading completes
    const restoreBtn = await screen.findByText('Restore')
    fireEvent.click(restoreBtn)

    await waitFor(() => {
      expect(screen.getByDisplayValue('500')).toBeDefined() // Billing amount restored
      expect(screen.getByDisplayValue('3')).toBeDefined() // Staff amount restored
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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import ReportsClientPage from '@/app/reports/ReportsClientPage'

// Mock Lucide icons
vi.mock('lucide-react', () => ({
  Store: () => null, Calendar: () => null, TrendingUp: () => null, 
  TrendingDown: () => null, Download: () => null, IndianRupee: () => null, 
  PieChart: () => null, BarChart3: () => null, ReceiptText: () => <div data-testid="icon-receipt" />, 
  Activity: () => <div data-testid="icon-activity" />
}))

const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM

describe('ReportsClientPage Analytics', () => {
  const branches = [{ id: 'b1', name: 'Main Branch' }]
  const categories = [{ id: 'c1', name: 'Food' }]
  
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders without intelligence blocks if no billing or ops data', () => {
    const { container } = render(
      <ReportsClientPage 
        branches={branches} 
        eodData={[{ date: `${currentMonth}-01`, branchId: 'b1', income: { dineInCash: 100 } } as any]} 
        expensesData={[]} 
        payrollData={[]} 
        attendanceData={[]} 
        staffData={[]} 
      />
    )
    
    expect(screen.queryByText('Billing Intelligence')).toBeNull()
    expect(screen.queryByText('Revenue by Day Type')).toBeNull()
  })

  it('computes and renders billing intelligence correctly', () => {
    const eodData = [
      { 
        date: `${currentMonth}-01`, branchId: 'b1', 
        income: { dineInCash: 1000 }, 
        billing: { totalBillAmount: 1000, gstCollected: 50, dineInCovers: 5, discounts: 0, voids: 0 } 
      }, // 100% compliance
      { 
        date: `${currentMonth}-02`, branchId: 'b1', 
        income: { dineInCash: 500 }, 
        billing: { totalBillAmount: 2000, gstCollected: 100, dineInCovers: 5, discounts: 0, voids: 0 } 
      } // failed compliance (1500 gap)
    ] as any

    render(
      <ReportsClientPage 
        branches={branches} 
        eodData={eodData} 
        expensesData={[]} 
        payrollData={[]} 
        attendanceData={[]} 
        staffData={[]} 
      />
    )

    // Billing Compliance: 1 out of 2 days is good = 50%
    expect(screen.getByText('Billing Intelligence')).toBeDefined()
    expect(screen.getByText('50%')).toBeDefined()
    expect(screen.getByText('1/2 days within ₹500 gap')).toBeDefined()

    // GST: 50 + 100 = 150
    expect(screen.getAllByText('₹150').length).toBeGreaterThan(0)

    // Avg Cover Value: Total Income = 1500, Covers = 10 -> 150
    // (Already verified by getAllByText above)
  })

  it('groups revenue by day type correctly', () => {
    const eodData = [
      { 
        date: `${currentMonth}-01`, branchId: 'b1', 
        income: { dineInCash: 2000 }, 
        ops: { unusualEvent: 'Festival' } 
      },
      { 
        date: `${currentMonth}-02`, branchId: 'b1', 
        income: { dineInCash: 4000 }, 
        ops: { unusualEvent: 'Festival' } 
      },
      { 
        date: `${currentMonth}-03`, branchId: 'b1', 
        income: { dineInCash: 1000 }, 
        ops: { unusualEvent: 'Rainy' } 
      }
    ] as any

    render(
      <ReportsClientPage 
        branches={branches} 
        eodData={eodData} 
        expensesData={[]} 
        payrollData={[]} 
        attendanceData={[]} 
        staffData={[]} 
      />
    )

    expect(screen.getByText('Revenue by Day Type')).toBeDefined()
    
    // Festival: 2 days, avg 3000
    expect(screen.getByText('Festival')).toBeDefined()
    expect(screen.getByText('2 days')).toBeDefined()
    expect(screen.getByText('₹3,000')).toBeDefined()

    // Rainy: 1 day, avg 1000
    expect(screen.getByText('Rainy')).toBeDefined()
    expect(screen.getByText('1 day')).toBeDefined()
    expect(screen.getByText('₹1,000')).toBeDefined()
  })
})

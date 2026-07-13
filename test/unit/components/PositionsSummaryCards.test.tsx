import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { PositionsSummaryCards } from '@/components/PositionsSummaryCards'

vi.mock('lucide-react', () => ({
  Users: () => null,
  UserCheck: () => null,
  UserX: () => null,
  IndianRupee: () => null,
}))

describe('PositionsSummaryCards', () => {
  const baseRequirements = [
    { id: 'r1', requiredCount: 3, defaultSalary: 25000 },
    { id: 'r2', requiredCount: 2, defaultSalary: 18000 },
  ]

  const baseStaff = [
    { positionId: 'r1', isActive: true },
    { positionId: 'r1', isActive: true },
    { positionId: 'r2', isActive: true },
  ]

  it('renders the positions-summary container', () => {
    const { getByTestId } = render(
      <PositionsSummaryCards requirements={baseRequirements} staff={baseStaff} />
    )
    expect(getByTestId('positions-summary')).toBeTruthy()
  })

  it('displays correct total positions', () => {
    const { getByTestId } = render(
      <PositionsSummaryCards requirements={baseRequirements} staff={baseStaff} />
    )
    // 3 + 2 = 5
    expect(getByTestId('summary-totalPositions').textContent).toBe('5')
  })

  it('displays correct filled positions', () => {
    const { getByTestId } = render(
      <PositionsSummaryCards requirements={baseRequirements} staff={baseStaff} />
    )
    // 2 from r1 + 1 from r2 = 3
    expect(getByTestId('summary-filledPositions').textContent).toBe('3')
  })

  it('displays correct vacant positions', () => {
    const { getByTestId } = render(
      <PositionsSummaryCards requirements={baseRequirements} staff={baseStaff} />
    )
    // 5 - 3 = 2
    expect(getByTestId('summary-vacantPositions').textContent).toBe('2')
  })

  it('displays formatted total salary', () => {
    const { getByTestId } = render(
      <PositionsSummaryCards requirements={baseRequirements} staff={baseStaff} />
    )
    // (3 × 25000) + (2 × 18000) = 75000 + 36000 = 111000
    const salaryText = getByTestId('summary-totalSalary').textContent!
    expect(salaryText).toContain('₹')
    expect(salaryText).toContain('1,11,000')
  })

  it('renders all four card labels', () => {
    const { container } = render(
      <PositionsSummaryCards requirements={baseRequirements} staff={baseStaff} />
    )
    const text = container.textContent!
    expect(text).toContain('Total Positions')
    expect(text).toContain('Filled')
    expect(text).toContain('Vacant')
    expect(text).toContain('Total Salary Budget')
  })

  it('shows zero values when no requirements', () => {
    const { getByTestId } = render(
      <PositionsSummaryCards requirements={[]} staff={[]} />
    )
    expect(getByTestId('summary-totalPositions').textContent).toBe('0')
    expect(getByTestId('summary-filledPositions').textContent).toBe('0')
    expect(getByTestId('summary-vacantPositions').textContent).toBe('0')
    expect(getByTestId('summary-totalSalary').textContent).toContain('₹')
    expect(getByTestId('summary-totalSalary').textContent).toContain('0')
  })

  it('handles missing defaultSalary gracefully', () => {
    const reqs = [{ id: 'r1', requiredCount: 2 }]
    const { getByTestId } = render(
      <PositionsSummaryCards requirements={reqs} staff={[]} />
    )
    expect(getByTestId('summary-totalPositions').textContent).toBe('2')
    expect(getByTestId('summary-totalSalary').textContent).toContain('0')
  })

  it('does not count inactive staff as filled', () => {
    const reqs = [{ id: 'r1', requiredCount: 5 }]
    const staff = [
      { positionId: 'r1', isActive: true },
      { positionId: 'r1', isActive: false },
      { positionId: 'r1', isActive: false },
    ]
    const { getByTestId } = render(
      <PositionsSummaryCards requirements={reqs} staff={staff} />
    )
    expect(getByTestId('summary-filledPositions').textContent).toBe('1')
    expect(getByTestId('summary-vacantPositions').textContent).toBe('4')
  })
})

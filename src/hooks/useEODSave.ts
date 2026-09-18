import { useState } from 'react'
import { saveEODEntry } from '@/app/actions/eod'

type Expense = {
  id: string
  amount: number
  categoryId: string
  notes?: string
}

type Income = {
  dineInCash: number
  dineInUpi: number
  takeawayCash: number
  takeawayUpi: number
}

type Billing = {
  totalBillAmount: number
  billCount: number
  dineInCovers: number
  takeawayOrders: number
  cashCollectedAsBilled: number
  upiCollectedAsBilled: number
  voids: number
  discounts: number
  gstCollected: number
} | null

type Ops = {
  staffOnDuty: number
  powerCutHours: number
  unusualEvent: string
  kitchenIssue: boolean
  zeroRevenueConfirmed: boolean
} | null

export function useEODSave(selectedBranch: string, date: string) {
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async (
    income: Income,
    expenses: Expense[],
    notes: string,
    openingFloat: number | '',
    actualClosingFloat: number | '',
    billing: Billing,
    ops: Ops
  ) => {
    if (!selectedBranch || !date) return { error: 'Branch and Date are required' }

    setIsSaving(true)

    const entryData = {
      branchId: selectedBranch,
      date,
      income,
      openingFloat: openingFloat === '' ? undefined : Number(openingFloat),
      actualClosingFloat: actualClosingFloat === '' ? undefined : Number(actualClosingFloat),
      notes,
      billing: billing ?? undefined,
      ops: ops ?? undefined,
    }

    const expensesOut = expenses.map(ex => ({
      branchId: selectedBranch,
      date,
      amount: ex.amount,
      categoryId: ex.categoryId,
      notes: ex.notes
    }))

    try {
      const res = await saveEODEntry(entryData as any, expensesOut)
      setIsSaving(false)
      // Return result — NO alert() calls here. Let the client handle UI feedback.
      return res
    } catch (e) {
      setIsSaving(false)
      return { error: 'Failed to save EOD. Please try again.' }
    }
  }

  return { isSaving, handleSave }
}

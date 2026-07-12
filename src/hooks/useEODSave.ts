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

export function useEODSave(selectedBranch: string, date: string) {
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async (income: Income, expenses: Expense[], notes: string, openingFloat: number | '', actualClosingFloat: number | '') => {
    if (!selectedBranch || !date) return { error: 'Branch and Date are required' }

    setIsSaving(true)
    const entryData = {
      branchId: selectedBranch,
      date,
      income,
      openingFloat: openingFloat === '' ? undefined : Number(openingFloat),
      actualClosingFloat: actualClosingFloat === '' ? undefined : Number(actualClosingFloat),
      notes
    }

    const expensesOut = expenses.map(ex => ({
      branchId: selectedBranch,
      date,
      amount: ex.amount,
      categoryId: ex.categoryId,
      notes: ex.notes
    }))

    try {
      const res = await saveEODEntry(entryData, expensesOut)
      setIsSaving(false)
      if (res?.error) {
        alert(res.error)
        return { success: false }
      } else {
        alert('EOD Saved successfully!')
        return { success: true }
      }
    } catch (e) {
      setIsSaving(false)
      alert('Failed to save EOD')
      return { success: false }
    }
  }

  return { isSaving, handleSave }
}

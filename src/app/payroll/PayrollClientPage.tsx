"use client"

import { useState, useEffect, useActionState } from 'react'
import { savePayroll, markAsPaid } from '@/app/actions/salary'
import { Calendar, DollarSign, Calculator, CheckCircle, Clock, Loader2, AlertCircle } from 'lucide-react'
import { useDraft } from '@/lib/useDraft'

type Props = {
  staff: any[]
  savedRecords: any[]
  attendanceLogs?: any[]
}

const initialState: any = {
  message: '',
  error: '',
  success: false
}

export default function PayrollClientPage({ staff, savedRecords, attendanceLogs }: Props) {
  const today = new Date()
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [year, setYear] = useState(today.getFullYear())

  // Use Action State for form submission
  const [state, formAction, isPending] = useActionState(savePayroll, initialState)

  // Local state for calculations
  const [entries, setEntries] = useState<Record<string, { days: number, notes: string, advances: number }>>({})
  
  const { saveDraft, loadDraft, clearDraft } = useDraft('payroll')

  // Filter records for current selection
  const currentPayroll = savedRecords.filter(r => r.month === month && r.year === year)
  const isSaved = currentPayroll.length > 0

  // Filter staff based on Joining/Exit Dates for the selected month
  const visibleStaff = staff.filter(s => {
    // 1. If we have a saved record, always show (history preservation)
    if (currentPayroll.find(r => r.staffId === s.id)) return true

    // 2. Otherwise, check dates
    const periodStart = new Date(year, month - 1, 1) // 1st of selected month
    const periodEnd = new Date(year, month, 0) // Last day of selected month

    // Parse joinedAt (ensure it exists, fallback to very old date if missing to be safe)
    const joined = s.joinedAt ? new Date(s.joinedAt) : new Date('2000-01-01')

    // Check if joined after this period ended? (Too new)
    if (joined > periodEnd) return false

    // Check if exited before this period started? (Too old)
    if (s.exitDate) {
      const exited = new Date(s.exitDate)
      if (exited < periodStart) return false
    }

    return true
  })

  // Initialize entries based on staff or existing records
  useEffect(() => {
    const draft = loadDraft(`${year}_${month}`)
    if (draft && Object.keys(draft).length > 0) {
      if (window.confirm(`You have an unsaved draft for ${month}/${year}. Restore it?`)) {
        setEntries(draft)
        return
      } else {
        clearDraft(`${year}_${month}`)
      }
    }

    const initialMap: any = {}
    visibleStaff.forEach(s => {
      // Find existing record if any
      const existing = currentPayroll.find(r => r.staffId === s.id)
      
      let calculatedDays = 30; // Default if no attendance tracking
      if (attendanceLogs && attendanceLogs.length > 0) {
        let hasLogsThisMonth = false;
        let countedDays = 0;
        
        attendanceLogs.forEach(a => {
           if (a.staffId !== s.id || !a.date || a.status === 'unmarked') return;
           const d = new Date(a.date);
           if (d.getMonth() + 1 === month && d.getFullYear() === year) {
             hasLogsThisMonth = true;
             if (a.status === 'present' || a.status === 'holiday') {
                countedDays += 1;
             } else if (a.status === 'half-day') {
                countedDays += 0.5;
             }
           }
        });
        
        if (hasLogsThisMonth) {
          calculatedDays = countedDays;
        }
      }

      initialMap[s.id] = {
        days: existing ? existing.daysWorked : Math.min(31, calculatedDays),
        notes: existing ? existing.notes : '',
        advances: existing ? existing.advances : 0
      }
    })
    setEntries(initialMap)
  }, [month, year, visibleStaff.length, savedRecords.length, attendanceLogs?.length, loadDraft, clearDraft])

  useEffect(() => {
    if (Object.keys(entries).length > 0) {
      saveDraft(`${year}_${month}`, entries)
    }
  }, [entries, year, month, saveDraft])

  const handleDaysChange = (id: string, days: number) => {
    setEntries(prev => ({
      ...prev,
      [id]: { ...prev[id], days }
    }))
  }

  const handleNotesChange = (id: string, notes: string) => {
    setEntries(prev => ({
      ...prev,
      [id]: { ...prev[id], notes }
    }))
  }

  const handleAdvancesChange = (id: string, advances: number) => {
    setEntries(prev => ({
      ...prev,
      [id]: { ...prev[id], advances }
    }))
  }

  const calculatePay = (monthlySalary: number, days: number, advances: number = 0) => {
    if (!monthlySalary) return 0
    return Math.max(0, Math.round((monthlySalary / 30) * days) - advances)
  }

  const handleMarkPaid = async (id: string) => {
    if (confirm('Mark this salary as PAID?')) {
      await markAsPaid(id)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Employee Payroll</h1>
          <p className="text-slate-400 mt-1">Track monthly salaries and work days.</p>
        </div>

        <div className="flex items-center gap-3 bg-card p-2 rounded-xl border border-white/5">
          <div className="flex items-center gap-2 px-3">
            <Calendar className="h-4 w-4 text-primary" />
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="bg-transparent text-white outline-none font-medium"
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1} className="bg-[#1e1b2e]">
                  {new Date(0, i).toLocaleString('default', { month: 'long' })}
                </option>
              ))}
            </select>
          </div>
          <div className="h-6 w-px bg-white/10"></div>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="bg-transparent text-white outline-none font-medium px-3"
          >
            <option value={2024} className="bg-[#1e1b2e]">2024</option>
            <option value={2025} className="bg-[#1e1b2e]">2025</option>
            <option value={2026} className="bg-[#1e1b2e]">2026</option>
          </select>
        </div>
      </div>

      <form action={async (fd) => {
        await formAction(fd);
        if (!state?.error) {
           clearDraft(`${year}_${month}`)
        }
      }} className="space-y-6">
        <input type="hidden" name="month" value={month} />
        <input type="hidden" name="year" value={year} />

        <div className="bg-card rounded-2xl border border-card shadow-lg shadow-black/20 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-[#252033] border-b border-[#3b3054] text-accent text-xs uppercase font-semibold tracking-wider">
                <tr>
                  <th className="px-6 py-4">Employee</th>
                  <th className="px-6 py-4">Monthly Salary</th>
                  <th className="px-6 py-4 w-32">Days Worked</th>
                  <th className="px-6 py-4 w-32">Advances (₹)</th>
                  <th className="px-6 py-4">Payable Amount</th>
                  <th className="px-6 py-4">Notes</th>
                  {isSaved && <th className="px-6 py-4 text-center">Status</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#3b3054]">
                {visibleStaff.length > 0 ? visibleStaff.map(s => {
                  const record = currentPayroll.find(r => r.staffId === s.id)
                  const entry = entries[s.id] || { days: 30, notes: '', advances: 0 }
                  const pay = calculatePay(s.monthlySalary || 0, entry.days, entry.advances)
                  const isPaid = record?.status === 'PAID'

                  return (
                    <tr key={s.id} className="hover:bg-[#2d283e] transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium text-white">{s.name}</div>
                        <div className="text-xs text-slate-400">{s.phone}</div>
                        {s.exitDate && <div className="text-[10px] text-red-400 font-bold uppercase mt-1">Exiting: {s.exitDate}</div>}
                      </td>
                      <td className="px-6 py-4 text-slate-300">
                        {s.monthlySalary ? `₹${s.monthlySalary.toLocaleString()}` : <span className="text-slate-600 italic">Not set</span>}
                      </td>
                      <td className="px-6 py-4">
                        <input
                          type="number"
                          name={`staff_${s.id}_days`}
                          value={entry.days}
                          onChange={(e) => handleDaysChange(s.id, Math.min(31, Math.max(0, Number(e.target.value))))}
                          max={31}
                          min={0}
                          disabled={isPaid}
                          className="w-20 px-3 py-1.5 rounded-lg bg-[#131018] border border-[#3b3054] text-white text-center focus:border-[#c084fc] outline-none disabled:opacity-50"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <input
                          type="number"
                          name={`staff_${s.id}_advances`}
                          value={entry.advances}
                          onChange={(e) => handleAdvancesChange(s.id, Math.max(0, Number(e.target.value)))}
                          min={0}
                          disabled={isPaid}
                          className="w-24 px-3 py-1.5 rounded-lg bg-[#131018] border border-[#3b3054] text-amber-400 text-center focus:border-[#c084fc] outline-none disabled:opacity-50"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-emerald-400 text-lg">₹{pay.toLocaleString()}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <input
                          type="text"
                          name={`staff_${s.id}_notes`}
                          value={entry.notes}
                          onChange={(e) => handleNotesChange(s.id, e.target.value)}
                          placeholder="Remarks..."
                          disabled={isPaid}
                          className="w-full px-3 py-1.5 rounded-lg bg-[#131018] border border-[#3b3054] text-white text-sm focus:border-[#c084fc] outline-none disabled:opacity-50 placeholder:text-slate-600"
                        />
                      </td>
                      {isSaved && (
                        <td className="px-6 py-4 text-center">
                          {isPaid ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold border border-emerald-500/20">
                              <CheckCircle className="h-3 w-3" /> PAID
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleMarkPaid(record?.id)}
                              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 text-xs font-bold border border-amber-500/20 hover:bg-amber-500/20 transition-colors cursor-pointer"
                            >
                              <Clock className="h-3 w-3" /> PENDING
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  )
                }) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                      No active staff found for this period.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot className="bg-[#252033] border-t border-[#3b3054]">
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-right font-bold text-slate-300">Total Payable:</td>
                  <td className="px-6 py-4 font-bold text-xl text-white">
                    ₹{visibleStaff.reduce((sum, s) => sum + calculatePay(s.monthlySalary || 0, entries[s.id]?.days || 0, entries[s.id]?.advances || 0), 0).toLocaleString()}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4">
          <div>
            {state?.message && (
              <div className="flex items-center gap-2 text-emerald-400 bg-emerald-950/30 px-4 py-2 rounded-lg border border-emerald-500/20">
                <CheckCircle className="h-4 w-4" />
                {state.message}
              </div>
            )}
            {state?.error && (
              <div className="flex items-center gap-2 text-red-400 bg-red-950/30 px-4 py-2 rounded-lg border border-red-500/20">
                <AlertCircle className="h-4 w-4" />
                {state.error}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="bg-primary text-[#131018] px-8 py-3 rounded-xl font-bold hover:bg-accent transition-colors shadow-lg shadow-primary/20 flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Calculator className="h-5 w-5" />}
            {isSaved ? 'Update Payroll' : 'Generate Payroll'}
          </button>
        </div>
      </form>
    </div>
  )
}

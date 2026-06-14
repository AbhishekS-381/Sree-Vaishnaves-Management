"use client"

import { useState } from 'react'
import { Store, Calendar, TrendingUp, TrendingDown, Download, IndianRupee, PieChart, BarChart3 } from 'lucide-react'

export default function ReportsClientPage({ branches, eodData, expensesData, payrollData, attendanceData, staffData }: { branches: any[], eodData: any[], expensesData: any[], payrollData: any[], attendanceData: any[], staffData: any[] }) {
  const [selectedBranch, setSelectedBranch] = useState(branches[0]?.id || '')
  
  const today = new Date()
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [year, setYear] = useState(today.getFullYear())

  // Filter logic
  const filteredEOD = eodData.filter(e => {
    if (selectedBranch && e.branchId !== selectedBranch) return false
    const d = new Date(e.date)
    return d.getMonth() + 1 === month && d.getFullYear() === year
  })

  const filteredExpenses = expensesData.filter(e => {
    if (selectedBranch && e.branchId !== selectedBranch) return false
    const d = new Date(e.date)
    return d.getMonth() + 1 === month && d.getFullYear() === year
  })

  const filteredPayroll = payrollData.filter(p => {
    if (selectedBranch) {
        // Simple branch filtering if payload supports it, else global
    }
    return p.month === month && p.year === year
  })

  const filteredAttendance = attendanceData.filter(a => {
    if (selectedBranch && a.branchId !== selectedBranch) return false
    const d = new Date(a.date)
    return d.getMonth() + 1 === month && d.getFullYear() === year && a.status !== 'unmarked'
  })

  // Calculations
  let totalIncome = 0
  let dineInTotal = 0
  let takeawayTotal = 0
  
  filteredEOD.forEach(e => {
    if (e.income) {
      const dineIn = (e.income.dineInCash || 0) + (e.income.dineInUpi || 0)
      const takeaway = (e.income.takeawayCash || 0) + (e.income.takeawayUpi || 0)
      dineInTotal += dineIn
      takeawayTotal += takeaway
      totalIncome += (dineIn + takeaway)
    }
  })

  // Previous month calculation
  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year

  const prevMonthEOD = eodData.filter(e => {
    if (selectedBranch && e.branchId !== selectedBranch) return false
    const d = new Date(e.date)
    return d.getMonth() + 1 === prevMonth && d.getFullYear() === prevYear
  })

  let prevTotalIncome = 0
  prevMonthEOD.forEach(e => {
    if (e.income) {
      prevTotalIncome += (e.income.dineInCash || 0) + (e.income.dineInUpi || 0) + (e.income.takeawayCash || 0) + (e.income.takeawayUpi || 0)
    }
  })

  let momChangeValue = totalIncome - prevTotalIncome
  let momChangePercent = prevTotalIncome === 0 ? (totalIncome > 0 ? 100 : 0) : Math.round((momChangeValue / prevTotalIncome) * 100)

  let totalExpenses = 0
  const expensesByCategory: Record<string, number> = {}
  
  filteredExpenses.forEach(e => {
     const amt = Number(e.amount) || 0
     totalExpenses += amt
     if (e.category) {
        expensesByCategory[e.category] = (expensesByCategory[e.category] || 0) + amt
     }
  })

  let totalSalaryPayable = 0
  filteredPayroll.forEach(p => {
    // Basic aggregation
    totalSalaryPayable += Number(p.payableAmount) || 0
  })

  const salaryPercentOfRevenue = totalIncome > 0 ? ((totalSalaryPayable / totalIncome) * 100).toFixed(1) : '0.0'

  let absentCount = 0
  filteredAttendance.forEach(a => {
    if (a.status === 'absent') absentCount++
  })
  const absenteeismRate = filteredAttendance.length > 0 ? ((absentCount / filteredAttendance.length) * 100).toFixed(1) : '0.0'

  // Grand total P&L
  // In real phase 3, Salary would be an expense. We subtract it if totalSalaryPayable should be deducted from monthly profit.
  const netProfit = totalIncome - totalExpenses - totalSalaryPayable

  const handleExportCSV = () => {
    let csv = `Report: ${month}/${year}\n\n`
    csv += 'Summary\n'
    csv += `Total Revenue,${totalIncome}\n`
    csv += `Total Ledger Expenses,${totalExpenses}\n`
    csv += `Salary Costs,${totalSalaryPayable}\n`
    csv += `Net Profit,${netProfit}\n\n`

    csv += 'Revenue Breakdown\n'
    csv += `Dine-in,${dineInTotal}\n`
    csv += `Takeaway,${takeawayTotal}\n\n`

    csv += 'Expense Breakdown\n'
    Object.entries(expensesByCategory).sort((a,b) => b[1] - a[1]).forEach(([cat, val]) => {
      csv += `${cat},${val}\n`
    })

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `report_${month}_${year}.csv`
    a.click()
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Financial Reports</h1>
          <p className="text-slate-400 mt-1">Monthly P&L, trends, and analytical breakdown.</p>
        </div>
        
        <button 
           onClick={handleExportCSV}
           className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 font-medium py-2.5 px-6 rounded-xl flex items-center gap-2 transition cursor-pointer"
        >
           <Download size={18} /> Export CSV
        </button>
      </div>

      <div className="bg-card p-4 rounded-2xl border border-white/5 flex flex-col md:flex-row gap-4 items-center shadow-sm">
         <div className="flex relative items-center w-full md:w-auto">
           <Store className="w-5 h-5 absolute left-3 text-slate-400" />
           <select
             className="w-full pl-10 pr-10 py-2.5 bg-[#1e1b2e] border border-[#3b3054] rounded-xl text-sm focus:border-[#c084fc] focus:outline-none focus:ring-0 appearance-none cursor-pointer text-slate-200"
             value={selectedBranch}
             onChange={e => setSelectedBranch(e.target.value)}
           >
             <option value="">All Branches Consolidated</option>
             {branches.map(b => (
               <option key={b.id} value={b.id}>{b.name}</option>
             ))}
           </select>
         </div>

         <div className="flex relative items-center gap-2">
            <div className="flex items-center gap-2 bg-[#1e1b2e] border border-[#3b3054] rounded-xl px-3 py-2.5">
                <Calendar className="w-4 h-4 text-primary" />
                <select 
                    value={month} 
                    onChange={e => setMonth(Number(e.target.value))}
                    className="bg-transparent text-sm text-slate-200 outline-none"
                >
                    {Array.from({length: 12}, (_, i) => (
                        <option value={i+1} key={i+1}>{new Date(0, i).toLocaleString('default', { month: 'long' })}</option>
                    ))}
                </select>
            </div>
            
            <div className="flex items-center gap-2 bg-[#1e1b2e] border border-[#3b3054] rounded-xl px-3 py-2.5">
                <select 
                    value={year} 
                    onChange={e => setYear(Number(e.target.value))}
                    className="bg-transparent text-sm text-slate-200 outline-none"
                >
                    <option value={2024}>2024</option>
                    <option value={2025}>2025</option>
                    <option value={2026}>2026</option>
                </select>
            </div>
         </div>
      </div>

      {/* Hero Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
         <div className="bg-card border border-white/5 rounded-2xl p-6 shadow-lg shadow-black/20">
            <div className="flex items-center gap-3 text-emerald-400 mb-2">
               <div className="p-2 bg-emerald-500/10 rounded-lg"><IndianRupee size={20} /></div>
               <span className="font-semibold text-sm uppercase tracking-wider">Total Revenue</span>
            </div>
            <div className="text-3xl font-black text-white mt-4">₹{totalIncome.toLocaleString()}</div>
            <div className={`mt-2 text-xs font-semibold ${momChangeValue >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
               {momChangeValue >= 0 ? '↗' : '↘'} {Math.abs(momChangePercent)}% vs last month
            </div>
         </div>

         <div className="bg-card border border-white/5 rounded-2xl p-6 shadow-lg shadow-black/20">
            <div className="flex items-center gap-3 text-amber-400 mb-2">
               <div className="p-2 bg-amber-500/10 rounded-lg"><TrendingDown size={20} /></div>
               <span className="font-semibold text-sm uppercase tracking-wider">Total Ledger Exp.</span>
            </div>
            <div className="text-3xl font-black text-white mt-4">₹{totalExpenses.toLocaleString()}</div>
         </div>

         <div className="bg-card border border-white/5 rounded-2xl p-6 shadow-lg shadow-black/20">
            <div className="flex items-center gap-3 text-blue-400 mb-2">
               <div className="p-2 bg-blue-500/10 rounded-lg"><BarChart3 size={20} /></div>
               <span className="font-semibold text-sm uppercase tracking-wider">Salary Costs</span>
            </div>
            <div className="text-3xl font-black text-white mt-4">₹{totalSalaryPayable.toLocaleString()}</div>
            <div className="mt-2 text-xs font-semibold text-slate-400">
               {salaryPercentOfRevenue}% of Total Revenue
            </div>
         </div>

         <div className={`border rounded-2xl p-6 shadow-lg shadow-black/20 ${netProfit >= 0 ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
            <div className={`flex items-center gap-3 mb-2 ${netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
               <div className={`p-2 rounded-lg ${netProfit >= 0 ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}><TrendingUp size={20} /></div>
               <span className="font-bold text-sm uppercase tracking-wider">Net Profit</span>
            </div>
            <div className={`text-4xl font-black mt-4 ${netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                ₹{netProfit.toLocaleString()}
            </div>
            <div className="mt-2 text-xs font-semibold opacity-80 text-slate-300">
                (Revenue - Ledger - Salaries)
            </div>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         {/* Breakdown 1 */}
         <div className="bg-card border border-white/5 rounded-2xl overflow-hidden shadow-sm">
           <div className="bg-[#252033] px-6 py-4 border-b border-[#3b3054] flex items-center gap-2">
              <PieChart size={18} className="text-primary"/> 
              <h2 className="text-lg font-bold text-slate-100">Revenue Segmentation</h2>
           </div>
           <div className="p-6">
              {totalIncome === 0 ? (
                 <div className="text-center py-10 text-slate-500 font-medium">No revenue data for this period.</div>
              ) : (
                 <div className="space-y-6">
                    <div>
                       <div className="flex items-center justify-between text-sm mb-2">
                          <span className="text-slate-300 font-medium">Dine-In</span>
                          <span className="font-bold text-white">₹{dineInTotal.toLocaleString()} ({Math.round(dineInTotal/totalIncome*100)}%)</span>
                       </div>
                       <div className="w-full bg-[#131018] rounded-full h-3">
                          <div className="bg-purple-500 h-3 rounded-full" style={{width: `${Math.round(dineInTotal/totalIncome*100)}%`}}></div>
                       </div>
                    </div>
                    <div>
                       <div className="flex items-center justify-between text-sm mb-2">
                          <span className="text-slate-300 font-medium">Takeaway</span>
                          <span className="font-bold text-white">₹{takeawayTotal.toLocaleString()} ({Math.round(takeawayTotal/totalIncome*100)}%)</span>
                       </div>
                       <div className="w-full bg-[#131018] rounded-full h-3">
                          <div className="bg-emerald-500 h-3 rounded-full" style={{width: `${Math.round(takeawayTotal/totalIncome*100)}%`}}></div>
                       </div>
                    </div>
                 </div>
              )}
           </div>
         </div>

         {/* Breakdown 2 */}
         <div className="bg-card border border-white/5 rounded-2xl overflow-hidden shadow-sm">
           <div className="bg-[#252033] px-6 py-4 border-b border-[#3b3054] flex items-center gap-2">
              <TrendingDown size={18} className="text-amber-400"/> 
              <h2 className="text-lg font-bold text-slate-100">Expense Breakdown by Category</h2>
           </div>
           <div className="p-6">
              {totalExpenses === 0 ? (
                 <div className="text-center py-10 text-slate-500 font-medium">No expenses recorded for this period.</div>
              ) : (
                 <div className="space-y-4">
                    {Object.entries(expensesByCategory).sort((a,b) => b[1] - a[1]).map(([cat, val]) => (
                        <div key={cat} className="flex items-center justify-between border-b border-white/5 pb-2 last:border-0 last:pb-0">
                           <span className="text-slate-300 text-sm uppercase tracking-wide font-bold">{cat}</span>
                           <div className="text-right">
                              <span className="block font-bold text-amber-400">₹{val.toLocaleString()}</span>
                           </div>
                        </div>
                    ))}
                 </div>
              )}
           </div>
         </div>

         {/* Salary Analytics */}
         <div className="bg-card border border-white/5 rounded-2xl overflow-hidden shadow-sm lg:col-span-2">
           <div className="bg-[#252033] px-6 py-4 border-b border-[#3b3054] flex items-center gap-2">
              <BarChart3 size={18} className="text-blue-400"/> 
              <h2 className="text-lg font-bold text-slate-100">Deep-Dive Salary Analytics</h2>
           </div>
           <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-[#131018] p-5 rounded-xl border border-white/5">
                 <div className="text-sm font-semibold text-slate-400 mb-2 uppercase tracking-wider">Absenteeism Rate</div>
                 <div className="flex items-end gap-3">
                    <span className="text-4xl font-black text-red-400">{absenteeismRate}%</span>
                    <span className="text-sm text-slate-500 mb-1">({absentCount} absences)</span>
                 </div>
                 <div className="mt-3 text-xs text-slate-500">Based on marked attendance logs for this period.</div>
              </div>
              <div className="bg-[#131018] p-5 rounded-xl border border-white/5">
                 <div className="text-sm font-semibold text-slate-400 mb-2 uppercase tracking-wider">Salary as % of Revenue</div>
                 <div className="flex items-end gap-3">
                    <span className="text-4xl font-black text-blue-400">{salaryPercentOfRevenue}%</span>
                 </div>
                 <div className="mt-3 text-xs text-slate-500">Target is typically 15-25% for healthy margins.</div>
              </div>
           </div>
         </div>
      </div>

    </div>
  )
}

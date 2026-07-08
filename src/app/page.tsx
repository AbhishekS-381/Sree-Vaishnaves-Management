import { readJSON, DB_FILES } from '@/lib/db'
import { Users, Store, IndianRupee, TrendingUp } from 'lucide-react'

import { getSession } from '@/app/actions/auth'

// Basic types for local use
type Branch = { id: string; name: string; status?: string }
type Staff = { id: string; branchId: string; isActive: boolean }

export default async function Dashboard() {
  const session = await getSession();
  const isGlobalOwner = session?.isGlobalOwner;
  const userBranchId = session?.branchId;

  let [branches, staff, eod, expenses, inventory, attendance, payroll, configList] = await Promise.all([
    readJSON<Branch>(DB_FILES.BRANCHES),
    readJSON<Staff>(DB_FILES.STAFF),
    readJSON<any>(DB_FILES.EOD).catch(() => []),
    readJSON<any>(DB_FILES.EXPENSES).catch(() => []),
    readJSON<any>(DB_FILES.INVENTORY).catch(() => []),
    readJSON<any>(DB_FILES.ATTENDANCE).catch(() => []),
    readJSON<any>(DB_FILES.PAYROLL).catch(() => []),
    readJSON<any>(DB_FILES.CONFIG).catch(() => [])
  ]);
  const config = configList[0] || { attendance: true, payroll: true, vendors: true, inventory: true, menu: true, reports: true }

  if (!isGlobalOwner && userBranchId) {
    branches = branches.filter((b: any) => b.id === userBranchId);
    staff = staff.filter((s: any) => s.branchId === userBranchId);
    eod = eod.filter((e: any) => e.branchId === userBranchId);
    expenses = expenses.filter((e: any) => e.branchId === userBranchId);
    inventory = inventory.filter((i: any) => i.branchId === userBranchId);
    // Attendance and payroll usually have branchId attached if generated correctly,
    // but typically they are linked to staffId. We might need to filter based on staff branch.
    // For now, assume they have branchId if they are branch-scoped.
    attendance = attendance.filter((a: any) => a.branchId === userBranchId);
    payroll = payroll.filter((p: any) => p.branchId === userBranchId);
  }

  branches = branches.filter((b: any) => b.isActive !== false);
  staff = staff.filter((s: any) => s.isActive !== false);

  const activeStaff = staff.filter(s => s.isActive).length

  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) // YYYY-MM-DD local
  
  const todayEOD = Array.isArray(eod) ? eod.filter(e => e.date === todayStr) : [];
  let todaysCollection = 0;
  todayEOD.forEach(e => {
    if (e.income) {
      todaysCollection += (e.income.dineInCash || 0) + (e.income.dineInUpi || 0) + (e.income.takeawayCash || 0) + (e.income.takeawayUpi || 0);
    }
  });
  
  const todayExpenses = Array.isArray(expenses) ? expenses.filter(e => e.date === todayStr) : [];
  let todaysExpensesTotal = 0;
  todayExpenses.forEach(e => {
     todaysExpensesTotal += Number(e.amount) || 0;
  });
  
  const netBalance = todaysCollection - todaysExpensesTotal;

  const todayDate = new Date()
  const currentMonth = todayDate.getMonth() + 1
  const currentYear = todayDate.getFullYear()
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate()
  const isEndOfMonth = todayDate.getDate() >= daysInMonth - 2

  const isAttendanceMarked = Array.isArray(attendance) && attendance.some(a => a.date === todayStr)
  const isEODFilled = todayEOD.length > 0
  const isPayrollDue = isEndOfMonth && (!Array.isArray(payroll) || !payroll.some(p => p.month === currentMonth && p.year === currentYear))
  const lowStockItems = Array.isArray(inventory) ? inventory.filter(i => i.currentQuantity <= i.threshold) : []

  const pendingActions = []
  if (config.attendance && !isAttendanceMarked) pendingActions.push({ id: 1, type: 'warning', msg: '⚠ Attendance not marked for today', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' })
  if (!isEODFilled) pendingActions.push({ id: 2, type: 'warning', msg: '⚠ EOD entry not filled', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' })
  if (config.payroll && isPayrollDue) pendingActions.push({ id: 3, type: 'info', msg: 'ℹ Payroll due this month', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' })
  if (config.inventory && lowStockItems.length > 0) pendingActions.push({ id: 4, type: 'warning', msg: `⚠ ${lowStockItems.length} Low stock alert(s)`, color: 'text-red-400 bg-red-500/10 border-red-500/20' })

  const statusStyles: Record<string, string> = {
    operational: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_10px_rgba(52,211,153,0.1)]',
    maintenance: 'bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.1)]',
  }
  const defaultStatusStyle = 'bg-red-500/10 text-red-400 border-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.1)]'

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Dashboard</h1>
          <p className="text-slate-400 mt-2">Welcome back to your restaurant overview.</p>
        </div>
        
        {/* Simple Notification Bell indicating pending actions */}
        <div className="relative p-2 bg-card border border-white/5 rounded-full shadow-lg">
           <svg className="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
           {pendingActions.length > 0 && <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-slate-900 animate-pulse"></span>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card title="Total Branches" value={branches.length} icon={Store} color="lilac" />
        <Card title="Active Staff" value={activeStaff} icon={Users} color="purple" />
        <Card title="Today's Collection" value={`₹${todaysCollection.toLocaleString()}`} icon={IndianRupee} color="emerald" />
        <Card title="Net Balance" value={`₹${netBalance.toLocaleString()}`} icon={TrendingUp} color="amber" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-card p-6 rounded-2xl border border-card shadow-sm min-h-[16rem] flex flex-col">
          <h3 className="font-semibold text-foreground mb-4">Pending Actions</h3>
          {pendingActions.length > 0 ? (
            <div className="space-y-3 flex-1">
              {pendingActions.map(action => (
                <div key={action.id} className={`p-3 rounded-xl border font-medium flex items-center gap-2 ${action.color}`}>
                   {action.msg}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-500 text-sm italic">
              All caught up! No pending actions to show.
            </div>
          )}
        </div>
        <div className="bg-card p-6 rounded-2xl border border-card shadow-sm min-h-[16rem]">
          <h3 className="font-semibold text-foreground mb-4">Branch Status</h3>
          <div className="space-y-3">
            {branches.length > 0 ? branches.map(b => (
              <div key={b.id} className="flex items-center justify-between p-4 bg-[#252033] rounded-xl hover:bg-[#2d283e] transition-colors border border-white/5">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-[#3b3054] border border-white/10 flex items-center justify-center text-accent">
                    <Store className="h-4 w-4" />
                  </div>
                  <span className="font-medium text-slate-200">{b.name}</span>
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${statusStyles[b.status || ''] || defaultStatusStyle}`}>
                  {b.status || 'unknown'}
                </span>
              </div>
            )) : (
              <div className="text-slate-500 text-sm">No branches found.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Card({ title, value, icon: Icon, color }: any) {
  const colors: Record<string, string> = {
    lilac: "bg-purple-500/10 text-purple-300 border border-purple-500/20",
    purple: "bg-indigo-500/10 text-indigo-300 border border-indigo-500/20",
    emerald: "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20",
    amber: "bg-amber-500/10 text-amber-300 border border-amber-500/20"
  }

  return (
    <div className="bg-card p-6 rounded-2xl border border-card shadow-lg shadow-black/20 hover:shadow-purple-900/10 hover:border-primary/30 transition-all duration-300">
      <div className="flex items-center justify-between">
        <div className={`p-3 rounded-xl ${colors[color] || colors.lilac}`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
      <div className="mt-4">
        <h3 className="text-slate-400 text-sm font-medium">{title}</h3>
        <p className="text-2xl font-bold text-white mt-1">{value}</p>
      </div>
    </div>
  )
}

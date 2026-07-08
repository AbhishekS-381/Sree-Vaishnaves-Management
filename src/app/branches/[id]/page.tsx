import { readJSON, DB_FILES } from '@/lib/db'
import { MapPin, Phone, Users, User } from 'lucide-react'
import { notFound, redirect } from 'next/navigation'
import { getSession } from '@/app/actions/auth'

export default async function BranchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  
  const session = await getSession()
  // Owners can view any branch; readonly can view any branch; managers can only view their assigned branch
  const isReadOnly = session?.role === 'readonly'
  if (!session?.isGlobalOwner && !isReadOnly && session?.branchId !== id) {
    redirect('/')
  }

  const branches = await readJSON<any>(DB_FILES.BRANCHES)
  const staff = await readJSON<any>(DB_FILES.STAFF)
  const roles = await readJSON<any>(DB_FILES.ROLES)
  const eod = await readJSON<any>(DB_FILES.EOD).catch(() => [])
  const expenses = await readJSON<any>(DB_FILES.EXPENSES).catch(() => [])
  const requirements = await readJSON<any>(DB_FILES.STAFF_REQUIREMENTS).catch(() => [])

  const branch = branches.find((b: any) => b.id === id)

  if (!branch) {
    notFound()
  }

  const branchStaff = staff.filter((s: any) => s.branchId === branch.id && !s.deletedAt)
  const branchRequirements = requirements.filter((r: any) => r.branchId === branch.id)
  const totalPositions = branchRequirements.reduce((sum: number, r: any) => sum + (Number(r.requiredCount) || 1), 0)

  const getRole = (id: string) => roles.find((r: any) => r.id === id)?.name || id

  // Current month calculations
  const now = new Date()
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  
  const branchEod = eod.filter((e: any) => e.branchId === branch.id && e.date.startsWith(currentMonthStr))
  const branchExpenses = expenses.filter((e: any) => e.branchId === branch.id && e.date.startsWith(currentMonthStr))

  let thisMonthIncome = 0
  branchEod.forEach((e: any) => {
    thisMonthIncome += (Number(e.income?.dineInCash) || 0) + (Number(e.income?.dineInUpi) || 0) + (Number(e.income?.takeawayCash) || 0) + (Number(e.income?.takeawayUpi) || 0)
  })

  let thisMonthExpenses = 0
  branchExpenses.forEach((e: any) => {
    thisMonthExpenses += Number(e.amount) || 0
  })

  const thisMonthProfit = thisMonthIncome - thisMonthExpenses

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="bg-card p-8 rounded-2xl border border-card shadow-lg shadow-black/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">{branch.name}</h1>
            {branch.status && (
              <span className={`inline-block mt-2 text-[10px] uppercase font-bold px-3 py-1 rounded-full border ${branch.status === 'operational' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                  branch.status === 'maintenance' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                    'bg-red-500/10 text-red-400 border-red-500/20'
                }`}>
                {branch.status}
              </span>
            )}
          </div>
        </div>

        <div className="mt-8 flex flex-col md:flex-row gap-6 md:gap-12 text-slate-300">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg border border-blue-500/20">
              <MapPin className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Address</p>
              <span className="font-medium">{branch.address}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/10 text-green-400 rounded-lg border border-green-500/20">
              <Phone className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Contact</p>
              <span className="font-medium">{branch.phone}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Monthly Metrics Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-card p-6 rounded-2xl border border-card shadow-lg flex flex-col">
          <p className="text-sm font-semibold text-slate-400 mb-1">This Month Income</p>
          <p className="text-3xl font-black text-emerald-400">₹{thisMonthIncome.toLocaleString()}</p>
        </div>
        <div className="bg-card p-6 rounded-2xl border border-card shadow-lg flex flex-col">
          <p className="text-sm font-semibold text-slate-400 mb-1">This Month Expenses</p>
          <p className="text-3xl font-black text-rose-400">₹{thisMonthExpenses.toLocaleString()}</p>
        </div>
        <div className="bg-card p-6 rounded-2xl border border-card shadow-lg flex flex-col">
          <p className="text-sm font-semibold text-slate-400 mb-1">This Month Profit</p>
          <p className={`text-3xl font-black ${thisMonthProfit >= 0 ? 'text-primary' : 'text-amber-400'}`}>
            ₹{thisMonthProfit.toLocaleString()}
          </p>
        </div>
        <div className="bg-card p-6 rounded-2xl border border-card shadow-lg flex flex-col">
          <p className="text-sm font-semibold text-slate-400 mb-1">Total Positions Filled</p>
          <p className="text-3xl font-black text-white">
            {branchStaff.length} <span className="text-lg text-slate-500">/ {totalPositions}</span>
          </p>
        </div>
      </div>

      {/* Staff Section */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-slate-200 flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Assigned Staff ({branchStaff.length})
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {branchStaff.length > 0 ? branchStaff.map((s: any) => (
            <div key={s.id} className="bg-card p-5 rounded-xl border border-card shadow-lg hover:shadow-primary/10 transition-all flex items-center gap-4 group">
              <div className="h-12 w-12 rounded-full bg-[#3b3054] flex items-center justify-center text-accent shrink-0 border border-white/5">
                <User className="h-6 w-6" />
              </div>
              <div>
                <p className="font-bold text-white group-hover:text-primary transition-colors">{s.name}</p>
                <p className="text-xs text-accent font-semibold uppercase tracking-wide mt-0.5">{getRole(s.roleId)}</p>
                <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                  <Phone className="h-3 w-3" /> {s.phone}
                </p>
              </div>
            </div>
          )) : (
            <div className="col-span-full py-12 text-center text-slate-500 bg-[#252033] rounded-2xl border border-dashed border-[#3b3054]">
              <p>No staff assigned to this branch yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

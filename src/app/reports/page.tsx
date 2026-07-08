import { readJSON, DB_FILES } from '@/lib/db'
import ReportsClientPage from './ReportsClientPage'
import { getSession } from '@/app/actions/auth'

export default async function ReportsPage() {
  const session = await getSession();
  let [branches, eod, expenses, payroll, attendance, staff] = await Promise.all([
    readJSON<any>(DB_FILES.BRANCHES),
    readJSON<any>(DB_FILES.EOD).catch(() => []),
    readJSON<any>(DB_FILES.EXPENSES).catch(() => []),
    readJSON<any>(DB_FILES.PAYROLL).catch(() => []),
    readJSON<any>(DB_FILES.ATTENDANCE).catch(() => []),
    readJSON<any>(DB_FILES.STAFF).catch(() => [])
  ]);

  if (!session?.isGlobalOwner && session?.role !== 'readonly') {
    branches = branches.filter((b: any) => b.id === session?.branchId)
    eod = eod.filter((e: any) => e.branchId === session?.branchId)
    expenses = expenses.filter((e: any) => e.branchId === session?.branchId)
    payroll = payroll.filter((p: any) => p.branchId === session?.branchId)
    attendance = attendance.filter((a: any) => a.branchId === session?.branchId)
    staff = staff.filter((s: any) => s.branchId === session?.branchId)
  }

  staff = staff.filter((s: any) => s.isActive !== false)

  return (
    <ReportsClientPage 
      branches={branches} 
      eodData={eod}
      expensesData={expenses}
      payrollData={payroll}
      attendanceData={attendance}
      staffData={staff}
    />
  )
}
